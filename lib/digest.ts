import type { TodayBoard } from "./queries";
import type { PushPayload } from "./push";

/**
 * Turns the Today board into the one line that appears on a lock screen.
 *
 * A notification is read at a glance while walking into the shop, so it leads with
 * the number and then names the people. Blocked leads come first because they are
 * waiting on you, not the other way round.
 */
export function buildDigest(board: TodayBoard): PushPayload | null {
  // Never on the rest day, and never outside working hours. The cron fires daily;
  // this is what stops it firing on a Saturday.
  if (board.quiet.reason === "rest_day") return null;

  const total = board.blocked.length + board.overdue.length + board.due.length;
  if (total === 0) return null;

  const names = (list: typeof board.blocked) => list.map((c) => c.lead.name);
  const blocked = names(board.blocked);
  const chase = [...names(board.overdue), ...names(board.due)];

  const title =
    blocked.length > 0
      ? `${blocked.length} waiting on your price`
      : `${total} to follow up today`;

  const parts: string[] = [];
  if (blocked.length > 0) {
    parts.push(`${list(blocked)} ${blocked.length === 1 ? "needs" : "need"} a number from you.`);
  }
  if (chase.length > 0) {
    parts.push(
      blocked.length > 0
        ? `Also chase ${list(chase)}.`
        : `${list(chase)} ${chase.length === 1 ? "is" : "are"} due.`,
    );
  }

  return {
    title,
    body: parts.join(" "),
    url: "/",
    // One tag, so a new digest replaces yesterday's rather than stacking up.
    tag: "leaddesk-digest",
  };
}

/** "Avi", "Avi and Tanya", "Avi, Tanya and 2 more" */
function list(names: string[]): string {
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  if (names.length === 3) return `${names[0]}, ${names[1]} and ${names[2]}`;
  return `${names[0]}, ${names[1]} and ${names.length - 2} more`;
}
