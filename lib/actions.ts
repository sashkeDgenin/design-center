"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { interactions, leads, LANGUAGES, SOURCES, STAGES } from "@/db/schema";
import type { Stage } from "@/db/schema";
import {
  computeNextTouch,
  firstTouchDate,
  today as todayFor,
  unansweredTouches,
} from "./cadence";
import { normalizePhone } from "./phone";
import { zonedTimeToUtc } from "./time";
import { getSettings } from "./queries";
import { checkPasscode, endSession, startSession } from "./session";

/**
 * Every action returns a result rather than throwing into a generic error page.
 * The spec is explicit: a write that fails has to be visible, never silently dropped.
 */
export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };

function failed(error: unknown): ActionResult {
  console.error(error);
  const message = error instanceof Error ? error.message : "Unknown error";
  return { ok: false, error: `Not saved: ${message}. Nothing was changed.` };
}

// ---------------------------------------------------------------- auth

export async function signIn(_prev: unknown, formData: FormData): Promise<ActionResult> {
  const passcode = String(formData.get("passcode") ?? "");
  if (!passcode) return { ok: false, error: "Enter your passcode." };
  try {
    if (!checkPasscode(passcode)) return { ok: false, error: "Wrong passcode." };
    await startSession();
  } catch (error) {
    return failed(error);
  }
  const next = String(formData.get("next") ?? "/") || "/";
  redirect(next.startsWith("/") ? next : "/");
}

export async function signOut(): Promise<void> {
  await endSession();
  redirect("/login");
}

// ---------------------------------------------------------------- leads

const quickAdd = z.object({
  name: z.string().trim().min(1, "A name, even just a first name."),
  phone: z.string().trim().min(1, "A phone number is what makes this a lead."),
  source: z.enum(SOURCES),
  interest: z.string().trim().default(""),
});

export async function createLead(_prev: unknown, formData: FormData): Promise<ActionResult> {
  const parsed = quickAdd.safeParse({
    name: formData.get("name"),
    phone: formData.get("phone"),
    source: formData.get("source") ?? "walkout",
    interest: formData.get("interest") ?? "",
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form." };
  }

  const phone = normalizePhone(parsed.data.phone);
  if (!phone) {
    return { ok: false, error: `"${parsed.data.phone}" is not a phone number I can dial.` };
  }

  let id: string;
  try {
    const settings = await getSettings();
    const today = todayFor(settings.quietHours);
    // Due now, not after the first interval. Nothing has been sent yet, so there is
    // no wait to serve: someone just walked out and the first message is the point.
    const firstTouch = firstTouchDate(settings.quietHours, today);

    const [row] = await getDb()
      .insert(leads)
      .values({
        name: parsed.data.name,
        phone,
        phoneRaw: parsed.data.phone,
        source: parsed.data.source,
        interest: parsed.data.interest,
        stage: "nudge",
        nextTouchAt: firstTouch,
      })
      .returning({ id: leads.id });
    id = row.id;
  } catch (error) {
    return failed(error);
  }

  revalidatePath("/");
  redirect(`/leads/${id}?added=1`);
}

const patch = z.object({
  stage: z.enum(STAGES).optional(),
  language: z.enum(LANGUAGES).optional(),
  source: z.enum(SOURCES).optional(),
  name: z.string().trim().min(1).optional(),
  phone: z.string().trim().min(1).optional(),
  interest: z.string().optional(),
  objection: z.string().optional(),
  notes: z.string().optional(),
  quotedPrice: z.string().optional(),
  nextTouchAt: z.string().optional(),
  remindTime: z.string().optional(),
});

/**
 * Field edits from the lead detail screen.
 *
 * Changing stage re-derives the next touch date from the cadence rules, which is
 * what "when a lead enters a stage, auto-set next_touch_at" asks for. An explicit
 * date in the same submission always wins, so the manual override is one tap.
 */
export async function updateLead(leadId: string, formData: FormData): Promise<ActionResult> {
  const raw = Object.fromEntries(
    [...formData.entries()].filter(([, v]) => typeof v === "string"),
  );
  const parsed = patch.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form." };
  }

  try {
    const db = getDb();
    const settings = await getSettings();
    const today = todayFor(settings.quietHours);

    const [current] = await db.select().from(leads).where(eq(leads.id, leadId)).limit(1);
    if (!current) return { ok: false, error: "That lead no longer exists." };

    const values: Record<string, unknown> = {};
    if (parsed.data.name !== undefined) values.name = parsed.data.name;
    if (parsed.data.language !== undefined) values.language = parsed.data.language;
    if (parsed.data.source !== undefined) values.source = parsed.data.source;
    if (parsed.data.interest !== undefined) values.interest = parsed.data.interest;
    if (parsed.data.objection !== undefined) values.objection = parsed.data.objection;
    if (parsed.data.notes !== undefined) values.notes = parsed.data.notes;

    if (parsed.data.phone !== undefined) {
      const phone = normalizePhone(parsed.data.phone);
      if (!phone) return { ok: false, error: `"${parsed.data.phone}" is not a phone number I can dial.` };
      values.phone = phone;
      values.phoneRaw = parsed.data.phone;
    }

    if (parsed.data.quotedPrice !== undefined) {
      const trimmed = parsed.data.quotedPrice.trim();
      if (trimmed === "") {
        values.quotedPrice = null;
      } else {
        const n = Number(trimmed.replace(/[^\d]/g, ""));
        if (!Number.isFinite(n)) return { ok: false, error: "Quoted price must be a number." };
        values.quotedPrice = n;
      }
    }

    let message: string | undefined;

    if (parsed.data.stage !== undefined && parsed.data.stage !== current.stage) {
      const stage = parsed.data.stage as Stage;
      values.stage = stage;
      const log = await db.select().from(interactions).where(eq(interactions.leadId, leadId));
      const result = computeNextTouch(
        stage,
        unansweredTouches(log),
        settings.cadence,
        settings.quietHours,
        today,
      );
      values.nextTouchAt = result.nextTouchAt;
      message = result.explanation;
    }

    // An explicit date always beats a derived one.
    if (parsed.data.nextTouchAt !== undefined) {
      const value = parsed.data.nextTouchAt.trim();
      values.nextTouchAt = value === "" ? null : value;
      if (value !== "") message = `Next touch set to ${value}.`;
    }

    /*
     * The optional alarm. A time on its own is meaningless, so it always pairs with
     * whichever date is in play: the one just submitted, the one just derived from a
     * stage change, or the one already stored.
     *
     * Setting or moving it clears `remindedAt`, otherwise a reminder that already
     * fired would never fire again at its new time.
     */
    if (parsed.data.remindTime !== undefined) {
      const time = parsed.data.remindTime.trim();
      const date =
        (values.nextTouchAt as string | null | undefined) ?? current.nextTouchAt ?? null;

      if (time === "" || date === null) {
        values.remindAt = null;
        values.remindedAt = null;
        if (time === "" && parsed.data.nextTouchAt === undefined) {
          message = "Alarm off. This lead still shows up on its day.";
        }
      } else {
        const at = zonedTimeToUtc(date, time, settings.quietHours.timezone);
        values.remindAt = at;
        values.remindedAt = null;
        message = `Alarm set for ${date} at ${time}.`;
      }
    }

    if (Object.keys(values).length === 0) return { ok: true };

    await db.update(leads).set(values).where(eq(leads.id, leadId));
    revalidatePath("/");
    revalidatePath(`/leads/${leadId}`);
    return { ok: true, message };
  } catch (error) {
    return failed(error);
  }
}

/**
 * The money feature's server half.
 *
 * Called *before* WhatsApp is opened, so a failure to record the touch stops the
 * send instead of losing it. Returns the link only once the row is committed.
 */
export async function logSend(
  leadId: string,
  body: string,
): Promise<ActionResult & { link?: string }> {
  if (!body.trim()) return { ok: false, error: "The message is empty." };

  try {
    const db = getDb();
    const settings = await getSettings();
    const today = todayFor(settings.quietHours);

    const [lead] = await db.select().from(leads).where(eq(leads.id, leadId)).limit(1);
    if (!lead) return { ok: false, error: "That lead no longer exists." };

    await db.insert(interactions).values({
      leadId,
      direction: "out",
      channel: "whatsapp",
      body,
    });

    const log = await db.select().from(interactions).where(eq(interactions.leadId, leadId));
    const unanswered = unansweredTouches(log);
    const result = computeNextTouch(
      lead.stage,
      unanswered,
      settings.cadence,
      settings.quietHours,
      today,
    );

    await db
      .update(leads)
      .set({
        touchCount: lead.touchCount + 1,
        lastContactAt: new Date(),
        nextTouchAt: result.nextTouchAt,
        ...(result.moveToStage ? { stage: result.moveToStage } : {}),
      })
      .where(eq(leads.id, leadId));

    revalidatePath("/");
    revalidatePath(`/leads/${leadId}`);
    const { waLink } = await import("./phone");
    return { ok: true, message: result.explanation, link: waLink(lead.phone, body) };
  } catch (error) {
    return failed(error);
  }
}

/**
 * A pasted reply resets the follow-up ladder and pulls the lead onto today's list:
 * once they have written back, the next move is mine, and it should not wait for a
 * scheduled date to come round.
 */
export async function logReply(_prev: unknown, formData: FormData): Promise<ActionResult> {
  const leadId = String(formData.get("leadId") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  const channel = String(formData.get("channel") ?? "whatsapp");
  if (!leadId) return { ok: false, error: "Missing lead." };
  if (!body) return { ok: false, error: "Paste what they said first." };

  try {
    const db = getDb();
    const settings = await getSettings();
    const today = todayFor(settings.quietHours);

    const [lead] = await db.select().from(leads).where(eq(leads.id, leadId)).limit(1);
    if (!lead) return { ok: false, error: "That lead no longer exists." };

    await db.insert(interactions).values({
      leadId,
      direction: "in",
      channel: channel === "phone" || channel === "in_store" ? channel : "whatsapp",
      body,
    });

    if (lead.stage !== "poopy") {
      await db.update(leads).set({ nextTouchAt: today }).where(eq(leads.id, leadId));
    }

    revalidatePath("/");
    revalidatePath(`/leads/${leadId}`);
    return {
      ok: true,
      message:
        lead.stage === "poopy"
          ? "Reply logged. This lead is dead, so no reminder was set."
          : "Reply logged. Moved onto today's list so it does not get lost.",
    };
  } catch (error) {
    return failed(error);
  }
}
