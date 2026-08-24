import type { CadenceSettings, Interaction, Lead, QuietHoursSettings, Stage } from "@/db/schema";
import { addDays, type IsoDate, rollOffRestDay, todayIn } from "./time";

export type CadenceResult = {
  /** Null means "stop reminding me": only `poopy` should end up here. */
  nextTouchAt: IsoDate | null;
  /** Set when the ladder ran out and the lead should change stage automatically. */
  moveToStage: Stage | null;
  /** Plain-English trace, shown in the UI so an auto-move is never a surprise. */
  explanation: string;
};

/**
 * How many outbound touches have gone unanswered.
 *
 * Counted from the interaction log rather than a column, because "no reply" is a
 * fact about the conversation: every inbound message resets the ladder, which is
 * exactly what should happen when a lead finally writes back.
 */
export function unansweredTouches(interactions: Interaction[]): number {
  const sorted = [...interactions].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
  );
  let count = 0;
  for (const i of sorted) {
    if (i.direction === "in") count = 0;
    else count += 1;
  }
  return count;
}

/**
 * Where the next reminder lands, given the stage and how many touches have gone
 * unanswered. `unanswered` is the count *including* the touch just logged, so after
 * a first nudge it is 1 and the first interval applies.
 */
export function computeNextTouch(
  stage: Stage,
  unanswered: number,
  cadence: CadenceSettings,
  quiet: QuietHoursSettings,
  from: IsoDate,
): CadenceResult {
  const rule = cadence[stage];

  if (!rule) {
    return {
      nextTouchAt: null,
      moveToStage: null,
      explanation: "Dead lead. Reminders are off and the record is kept.",
    };
  }

  // Ladder spent: there is no rung left to schedule, so hand the lead on rather
  // than keep chasing. Note this is `>`, not `>=`: the final rung still gets used.
  // The ordinary auto-move happens in `shouldAutoMove` once that last wait elapses.
  if (rule.exhaustedStage && unanswered > rule.intervals.length) {
    const days = rule.exhaustedInterval ?? 30;
    return {
      nextTouchAt: rollOffRestDay(addDays(from, days), quiet.restDay),
      moveToStage: rule.exhaustedStage,
      explanation: `${unanswered} touches with no reply, so this moves to ${labelFor(rule.exhaustedStage)} and comes back in ${days} days.`,
    };
  }

  const index = Math.min(Math.max(unanswered, 1), rule.intervals.length) - 1;
  const days = rule.intervals[index] ?? rule.intervals.at(-1) ?? 1;
  const raw = addDays(from, days);
  const rolled = rollOffRestDay(raw, quiet.restDay);

  const base =
    days === 0
      ? "Due today. This one is blocked on you, not on them."
      : `Back in ${days} day${days === 1 ? "" : "s"}.`;

  return {
    nextTouchAt: rolled,
    moveToStage: null,
    explanation: rolled === raw ? base : `${base} Rolled off the rest day to ${rolled}.`,
  };
}

/**
 * Applied when a lead comes due, not when a touch is logged.
 *
 * The ladder is walked to the end first: a nudge gets all four of its intervals, and
 * only when the last wait has elapsed with still no reply does the lead move on. Doing
 * it at read time means no cron job, and a lead that replies in the meantime never
 * gets moved at all.
 */
export function shouldAutoMove(
  lead: Lead,
  unanswered: number,
  cadence: CadenceSettings,
  today: IsoDate,
): { stage: Stage; nextTouchAt: IsoDate; reason: string } | null {
  const rule = cadence[lead.stage];
  if (!rule || rule.maxUnanswered === null || !rule.exhaustedStage) return null;
  if (unanswered < rule.maxUnanswered) return null;
  if (!lead.nextTouchAt || lead.nextTouchAt > today) return null;

  const days = rule.exhaustedInterval ?? 30;
  return {
    stage: rule.exhaustedStage,
    nextTouchAt: addDays(today, days),
    reason: `${unanswered} touches, no reply`,
  };
}

export const STAGE_LABELS: Record<Stage, string> = {
  nudge: "Nudge",
  awaiting_photos: "Waiting trade-in photos",
  photos_in: "Photos in - needs my price",
  schedule_meeting: "Schedule meeting",
  get_back_later: "Get back later",
  poopy: "Poopy lead",
};

export function labelFor(stage: Stage): string {
  return STAGE_LABELS[stage];
}

export const STAGE_MEANINGS: Record<Stage, string> = {
  nudge: "Left the store without buying. Being actively chased.",
  awaiting_photos: "Asked for photos of their old sofa, nothing received yet.",
  photos_in: "Photos arrived. Blocked on you.",
  schedule_meeting: "Warm. The goal is a booked store visit.",
  get_back_later: "Real interest, wrong timing.",
  poopy: "Dead. Record kept, reminders stopped.",
};

/**
 * When a lead just captured on the shop floor becomes due: now.
 *
 * The interval ladder describes the wait *between* touches, so it cannot apply
 * before the first one has gone out. Deriving a new lead's date from intervals[0]
 * schedules it for tomorrow, which drops it off the Today screen the instant it is
 * saved and reads, correctly, as the app having lost it.
 *
 * Late-evening captures are already handled: quiet hours stop the list surfacing
 * after 20:00, and a capture on the rest day rolls to the next.
 */
export function firstTouchDate(quiet: QuietHoursSettings, from: IsoDate): IsoDate {
  return rollOffRestDay(from, quiet.restDay);
}

/** Today, in the zone quiet hours are configured for. */
export function today(quiet: QuietHoursSettings, now: Date = new Date()): IsoDate {
  return todayIn(quiet.timezone, now);
}
