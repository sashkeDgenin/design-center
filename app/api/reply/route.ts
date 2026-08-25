import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { loadLead, getSettings } from "@/lib/queries";
import { STAGES } from "@/db/schema";

export const dynamic = "force-dynamic";

/**
 * The model the spec asked for. Overridable without a deploy, since the useful
 * model for "write a short WhatsApp reply in Hebrew" changes faster than this app.
 */
const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";

const REPLY_SCHEMA = {
  type: "object",
  properties: {
    can_answer: {
      type: "boolean",
      description: "False when the answer is not in the store notes.",
    },
    suggested_reply: {
      type: "string",
      description: "The message to send, in the lead's language. Empty when can_answer is false.",
    },
    escalate_reason: {
      type: ["string", "null"],
      description: "When can_answer is false, the specific missing fact. Otherwise null.",
    },
    suggested_stage: {
      type: ["string", "null"],
      enum: [...STAGES, null],
      description: "A stage to move the lead to, if the reply clearly implies one.",
    },
  },
  required: ["can_answer", "suggested_reply", "escalate_reason", "suggested_stage"],
  additionalProperties: false,
} as const;

const ReplyShape = z.object({
  can_answer: z.boolean(),
  suggested_reply: z.string(),
  escalate_reason: z.string().nullable(),
  suggested_stage: z.enum(STAGES).nullable(),
});

const LANGUAGE_NAMES: Record<string, string> = {
  he: "Hebrew",
  ru: "Russian",
  en: "English",
};

function systemPrompt(knowledgeBase: string): string {
  return `You help a single salesperson at a residential furniture store answer WhatsApp messages from leads.

Rules, in order of importance:

1. Never invent a price, a discount, a delivery date, or whether something is in stock. If the answer is not in the store notes below, set can_answer to false and put the specific missing fact in escalate_reason. Refusing is always better than guessing: a wrong price quoted on WhatsApp is a real problem for a real shop.
2. Never say an offer is ending or expiring unless the store notes say it is.
3. The goal of every message is a visit to the store, not closing a sale over WhatsApp. Move towards a specific time whenever the lead is warm.
4. Write in the lead's language. Hebrew must read like a salesperson typing on a phone, not like a translation: casual, contractions, no stiff formality.
5. Keep it to one to three sentences. This is WhatsApp, not email.
6. Suggest a stage only when the lead's message clearly implies it, for example agreeing to come in means schedule_meeting. Otherwise use null. Never suggest poopy; that call belongs to the salesperson alone.

=== STORE NOTES (the only facts you may state) ===
${knowledgeBase.trim() || "(empty: the salesperson has not filled these in, so you cannot answer anything factual)"}
=== END STORE NOTES ===`;
}

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json(
      { error: "No Anthropic API key is set on the server, so the reply helper is off." },
      { status: 503 },
    );
  }

  let leadId: string;
  try {
    ({ leadId } = (await request.json()) as { leadId: string });
  } catch {
    return Response.json({ error: "Bad request body." }, { status: 400 });
  }

  const [detail, settings] = await Promise.all([loadLead(leadId), getSettings()]);
  if (!detail) return Response.json({ error: "That lead no longer exists." }, { status: 404 });

  const { lead, timeline } = detail;
  const history = timeline
    .map((i) => `${i.direction === "out" ? "Salesperson" : lead.name}: ${i.body}`)
    .join("\n");

  const facts = [
    `Name: ${lead.name}`,
    `Language: ${LANGUAGE_NAMES[lead.language] ?? lead.language}`,
    `Stage: ${lead.stage}`,
    `Interested in: ${lead.interest || "not recorded"}`,
    lead.quotedPrice != null ? `Already quoted: ₪${lead.quotedPrice}` : "No price quoted yet",
    lead.objection ? `Why they hesitated: ${lead.objection}` : null,
    lead.notes ? `Notes: ${lead.notes}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const client = new Anthropic();
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 2048,
      // Adaptive thinking: judging whether a fact is actually in the store notes is
      // exactly the call that benefits from it, and getting it wrong quotes a price
      // that does not exist.
      thinking: { type: "adaptive" },
      output_config: {
        effort: "medium",
        format: { type: "json_schema", schema: REPLY_SCHEMA },
      },
      system: [
        {
          type: "text",
          text: systemPrompt(settings.knowledgeBase),
          // The store notes are the same on every call; the conversation is not.
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [
        {
          role: "user",
          content: `About this lead:\n${facts}\n\nThe conversation so far, oldest first:\n${history || "(nothing yet)"}\n\nWrite the next message from the salesperson.`,
        },
      ],
    });

    const text = response.content.find((b) => b.type === "text");
    if (!text || text.type !== "text") {
      return Response.json({ error: "The model returned nothing usable." }, { status: 502 });
    }

    const parsed = ReplyShape.safeParse(JSON.parse(text.text));
    if (!parsed.success) {
      return Response.json({ error: "The model's answer did not match the expected shape." }, { status: 502 });
    }

    // Belt and braces: the prompt forbids it, and so does this.
    const suggested = parsed.data.suggested_stage === "poopy" ? null : parsed.data.suggested_stage;
    return Response.json({ ...parsed.data, suggested_stage: suggested });
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      return Response.json({ error: "The Anthropic API key was rejected." }, { status: 502 });
    }
    if (error instanceof Anthropic.RateLimitError) {
      return Response.json({ error: "Rate limited. Try again in a moment." }, { status: 429 });
    }
    return Response.json({ error: `Reply helper failed: ${(error as Error).message}` }, { status: 502 });
  }
}
