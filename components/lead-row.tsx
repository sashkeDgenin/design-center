import Link from "next/link";
import type { LeadCard } from "@/lib/queries";
import { relativeDays } from "@/lib/time";
import { Card, StageChip } from "./ui";
import { SendButton } from "./send-button";

/**
 * One line of context per row: whatever is most useful to see before tapping. The
 * objection beats the interest when there is one, because that is the thing to
 * answer.
 */
function context(card: LeadCard): string {
  const { lead } = card;
  return lead.objection || lead.interest || "No details yet";
}

export function LeadRow({
  card,
  tone = "plain",
  today,
  timezone,
}: {
  card: LeadCard;
  tone?: "plain" | "blocked" | "overdue";
  today: string;
  timezone: string;
}) {
  const { lead, draft } = card;
  const since = relativeDays(lead.lastContactAt, today, timezone);

  return (
    <Card tone={tone} className="overflow-hidden">
      <div className="flex items-stretch">
        <Link href={`/leads/${lead.id}`} className="min-w-0 flex-1 px-3.5 py-3">
          <div className="flex items-center gap-2">
            <span className="truncate text-[15px] font-semibold" dir="auto">
              {lead.name}
            </span>
            <StageChip stage={lead.stage} />
          </div>
          <p className="mt-0.5 truncate text-sm text-ink-soft" dir="auto">
            {context(card)}
          </p>
          <p className="mt-1 text-[11px] font-medium text-ink-faint">
            Last contact {since}
            {card.unanswered > 0
              ? ` · ${card.unanswered} unanswered`
              : card.lastInboundAt
                ? " · they replied"
                : ""}
          </p>
        </Link>

        <div className="flex items-center border-s border-line/70 px-2.5">
          <SendButton
            leadId={lead.id}
            body={draft.body}
            label="Send"
            size="small"
            disabled={!draft.hasTemplate}
            disabledReason={undefined}
          />
        </div>
      </div>
      {!draft.hasTemplate ? (
        <p className="border-t border-line/70 px-3.5 py-2 text-[11px] text-ink-soft">
          No template for this stage yet.{" "}
          <Link href={`/leads/${lead.id}`} className="font-semibold text-brand underline">
            Write the message by hand
          </Link>
          .
        </p>
      ) : null}
    </Card>
  );
}
