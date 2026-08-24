import Link from "next/link";
import { DatabaseNotReadyError, loadToday } from "@/lib/queries";
import { LeadRow } from "@/components/lead-row";
import { Card, EmptyState, SectionHeading } from "@/components/ui";
import { QuietHoursNotice } from "@/components/quiet-hours-notice";
import { SetupNeeded } from "@/components/setup-needed";
import { daysBetween } from "@/lib/time";

// The whole point of this screen is that it is current.
export const dynamic = "force-dynamic";

export default async function TodayPage() {
  let board: Awaited<ReturnType<typeof loadToday>>;
  try {
    board = await loadToday();
  } catch (error) {
    // A database with no tables is a setup step, not a crash.
    if (error instanceof DatabaseNotReadyError) return <SetupNeeded detail={error.detail} />;
    throw error;
  }
  const total = board.blocked.length + board.overdue.length + board.due.length;

  return (
    <div className="space-y-5">
      {board.autoMoved.length > 0 ? (
        <Card className="px-3.5 py-3">
          <p className="text-sm font-semibold">Moved automatically</p>
          <ul className="mt-1 space-y-0.5 text-sm text-ink-soft">
            {board.autoMoved.map((m) => (
              <li key={m.name}>
                <span dir="auto" className="font-medium text-ink">{m.name}</span> went to
                Get back later ({m.reason}).
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {board.quiet.quiet ? (
        <QuietHoursNotice
          reason={board.quiet.reason}
          count={total}
          timezone={board.timezone}
        >
          <Board board={board} total={total} />
        </QuietHoursNotice>
      ) : (
        <Board board={board} total={total} />
      )}
    </div>
  );
}

function Board({
  board,
  total,
}: {
  board: Awaited<ReturnType<typeof loadToday>>;
  total: number;
}) {
  if (total === 0) {
    return (
      <div className="space-y-3">
        <EmptyState
          title="Nothing is due. You are straight."
          body={
            board.activeCount === 0
              ? "No active leads yet. Add the next person who walks out without buying."
              : `${board.activeCount} active lead${board.activeCount === 1 ? "" : "s"} on the go, ${board.upcomingCount} scheduled ahead.` +
                (board.nextUpAt
                  ? ` Next one comes up in ${daysBetween(board.today, board.nextUpAt)} day${daysBetween(board.today, board.nextUpAt) === 1 ? "" : "s"}.`
                  : "")
          }
          action={{ href: "/leads/new", label: "Add a lead" }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {board.blocked.length > 0 ? (
        <section>
          <SectionHeading
            title="Blocked on me"
            count={board.blocked.length}
            tone="blocked"
            hint="they are waiting on you"
          />
          <div className="space-y-2">
            {board.blocked.map((card) => (
              <LeadRow
                key={card.lead.id}
                card={card}
                tone="blocked"
                today={board.today}
                timezone={board.timezone}
              />
            ))}
          </div>
        </section>
      ) : null}

      {board.overdue.length > 0 ? (
        <section>
          <SectionHeading
            title="Overdue"
            count={board.overdue.length}
            tone="overdue"
            hint="should have gone out already"
          />
          <div className="space-y-2">
            {board.overdue.map((card) => (
              <LeadRow
                key={card.lead.id}
                card={card}
                tone="overdue"
                today={board.today}
                timezone={board.timezone}
              />
            ))}
          </div>
        </section>
      ) : null}

      {board.due.length > 0 ? (
        <section>
          <SectionHeading title="Due today" count={board.due.length} />
          <div className="space-y-2">
            {board.due.map((card) => (
              <LeadRow
                key={card.lead.id}
                card={card}
                today={board.today}
                timezone={board.timezone}
              />
            ))}
          </div>
        </section>
      ) : null}

      {/*
        Explicitly ltr: this is an English sentence that opens with a digit, and in an
        rtl paragraph the bidi algorithm strands that digit at the far end. The layout
        around it still flips; only the sentence's own reading order is pinned.
      */}
      <p dir="ltr" className="px-1 text-center text-xs text-ink-faint">
        {board.activeCount} active lead{board.activeCount === 1 ? "" : "s"} ·{" "}
        {board.upcomingCount} scheduled ahead ·{" "}
        <Link href="/api/export/json" className="underline">
          export
        </Link>
      </p>
    </div>
  );
}
