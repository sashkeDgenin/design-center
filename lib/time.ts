/**
 * Calendar-date helpers, all operating on "YYYY-MM-DD" strings.
 *
 * "Due today" is a question about the Asia/Jerusalem calendar, not about an instant
 * in time, so due dates are stored and compared as plain dates. Arithmetic anchors
 * each date at 12:00 UTC, which keeps a +1 day step from ever landing on the
 * previous or next day when a DST boundary falls in between.
 */

export type IsoDate = string;

const DAY_MS = 86_400_000;

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function toUtcNoon(date: IsoDate): number {
  const [y, m, d] = date.split("-").map(Number);
  return Date.UTC(y, m - 1, d, 12);
}

function fromMs(ms: number): IsoDate {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** Today's calendar date in the given zone. en-CA formats as YYYY-MM-DD. */
export function todayIn(timezone: string, now: Date = new Date()): IsoDate {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Wall-clock hour 0-23 in the given zone. */
export function hourIn(timezone: string, now: Date = new Date()): number {
  return Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone,
      hour: "2-digit",
      hour12: false,
    }).format(now),
  );
}

export function addDays(date: IsoDate, days: number): IsoDate {
  return fromMs(toUtcNoon(date) + days * DAY_MS);
}

/** 0 = Sunday ... 6 = Saturday. */
export function dayOfWeek(date: IsoDate): number {
  return new Date(toUtcNoon(date)).getUTCDay();
}

export function daysBetween(from: IsoDate, to: IsoDate): number {
  return Math.round((toUtcNoon(to) - toUtcNoon(from)) / DAY_MS);
}

export function isBefore(a: IsoDate, b: IsoDate): boolean {
  return a < b; // ISO dates are lexicographically ordered
}

/**
 * Nothing is ever due on the rest day. A date that lands there rolls forward to the
 * next day, which is what "roll Saturday's due leads to Sunday" asks for.
 */
export function rollOffRestDay(date: IsoDate, restDay: number): IsoDate {
  return dayOfWeek(date) === restDay ? addDays(date, 1) : date;
}

/**
 * Quiet hours suppress *surfacing*, not access. Outside the window the Today screen
 * defaults to a quiet notice instead of the due list, and the list is still one tap
 * away. Nothing here blocks a write.
 */
export function isQuietNow(
  quiet: { timezone: string; startHour: number; endHour: number; restDay: number },
  now: Date = new Date(),
): { quiet: boolean; reason: "before_hours" | "after_hours" | "rest_day" | null } {
  const today = todayIn(quiet.timezone, now);
  if (dayOfWeek(today) === quiet.restDay) return { quiet: true, reason: "rest_day" };
  const hour = hourIn(quiet.timezone, now);
  if (hour < quiet.startHour) return { quiet: true, reason: "before_hours" };
  if (hour >= quiet.endHour) return { quiet: true, reason: "after_hours" };
  return { quiet: false, reason: null };
}

/** "3 days ago", for the one-line context on each Today row. */
export function relativeDays(from: Date | null, today: IsoDate, timezone: string): string {
  if (!from) return "never contacted";
  const then = todayIn(timezone, from);
  const diff = daysBetween(then, today);
  if (diff <= 0) return "today";
  if (diff === 1) return "yesterday";
  return `${diff} days ago`;
}

/**
 * How far ahead of UTC a zone is at a given instant, in milliseconds.
 *
 * Israel moves between +02:00 and +03:00, so this cannot be a constant.
 */
function zoneOffsetMs(at: Date, timezone: string): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(at)
      .map((p) => [p.type, p.value]),
  ) as Record<string, string>;

  const asIfUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour) % 24,
    Number(parts.minute),
    Number(parts.second),
  );
  return asIfUtc - at.getTime();
}

/**
 * Turns a wall-clock date and time in a zone into the actual instant it happens.
 *
 * "14:30 on the 30th" means 14:30 where the shop is, which is a different instant
 * in summer than in winter. The offset is applied twice because the first guess can
 * land on the wrong side of a clock change, and the second pass settles it.
 */
export function zonedTimeToUtc(date: IsoDate, time: string, timezone: string): Date {
  const naive = new Date(`${date}T${time.length === 5 ? time : "09:00"}:00Z`);
  let instant = new Date(naive.getTime() - zoneOffsetMs(naive, timezone));
  instant = new Date(naive.getTime() - zoneOffsetMs(instant, timezone));
  return instant;
}

/** The wall-clock "HH:MM" an instant corresponds to in a zone. */
export function timeIn(timezone: string, at: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(at);
}
