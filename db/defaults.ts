import type { CadenceSettings, QuietHoursSettings } from "./schema";

/**
 * Seed values only. Once a settings row exists these are never consulted again:
 * the Settings screen edits the row, and every read goes to the database.
 */
export const DEFAULT_CADENCE: CadenceSettings = {
  // +1, then +3, then +7, then +14. Four unanswered touches and the lead moves to
  // get_back_later on +60. Never to poopy: that is a human decision.
  nudge: {
    intervals: [1, 3, 7, 14],
    maxUnanswered: 4,
    exhaustedStage: "get_back_later",
    exhaustedInterval: 60,
  },
  // +1, then +2, then +4, then three unanswered and it drops to get_back_later.
  // The spec gives no interval for this hand-off, so it takes get_back_later's own default.
  awaiting_photos: {
    intervals: [1, 2, 4],
    maxUnanswered: 3,
    exhaustedStage: "get_back_later",
    exhaustedInterval: 30,
  },
  // Always today. This is a task for me, not a wait on them.
  photos_in: {
    intervals: [0],
    maxUnanswered: null,
    exhaustedStage: null,
    exhaustedInterval: null,
  },
  // +1 day until a date is actually agreed.
  schedule_meeting: {
    intervals: [1],
    maxUnanswered: null,
    exhaustedStage: null,
    exhaustedInterval: null,
  },
  // +30 by default, but any date can be picked by hand.
  get_back_later: {
    intervals: [30],
    maxUnanswered: null,
    exhaustedStage: null,
    exhaustedInterval: null,
  },
  // Dead. No date, no reminders, record kept.
  poopy: null,
};

export const DEFAULT_QUIET_HOURS: QuietHoursSettings = {
  timezone: "Asia/Jerusalem",
  startHour: 9,
  endHour: 20,
  restDay: 6, // Saturday
};

export const KNOWLEDGE_BASE_SEED = `> **This file is not filled in yet.** The AI reply helper reads only what is
> written here. Until you fill it in, its answers are unreliable and it will
> refuse most questions rather than invent an answer.

## Store
Name:
Hours:
Address:
Website:
Phone:

## Product lines and price ranges

## Delivery
Lead time:
Fee:

## Warranty

## Fabric and leather options

## Trade-in valuation rule

## Current discount offer
Terms (and the real expiry date, if any):

## Never say without asking me
- Any price not written above
- Any delivery date
- Whether a specific item is in stock
- Any discount beyond the offer above
`;
