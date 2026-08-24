import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_CADENCE, DEFAULT_QUIET_HOURS as Q } from "@/db/defaults";
import type { Interaction, Lead } from "@/db/schema";
import { computeNextTouch, firstTouchDate, shouldAutoMove, unansweredTouches } from "./cadence";
import { normalizePhone, waLink } from "./phone";
import { renderTemplate, pickTemplate } from "./templates";
import { addDays, dayOfWeek, isQuietNow, rollOffRestDay, todayIn } from "./time";

const C = DEFAULT_CADENCE;
// 2026-08-24 is a Monday. 2026-08-29 is a Saturday.
const MON = "2026-08-24";

const interaction = (direction: "in" | "out", minutesAgo: number): Interaction =>
  ({
    id: crypto.randomUUID(),
    leadId: "lead",
    direction,
    channel: "whatsapp",
    body: "",
    createdAt: new Date(Date.UTC(2026, 7, 24, 10, 0) - minutesAgo * 60_000),
  }) as Interaction;

test("date arithmetic survives a DST boundary", () => {
  // Israel ends DST on 2026-10-25. A +1 day step across it must still be +1 day.
  assert.equal(addDays("2026-10-24", 1), "2026-10-25");
  assert.equal(addDays("2026-10-25", 1), "2026-10-26");
  assert.equal(addDays("2026-03-26", 1), "2026-03-27");
  assert.equal(dayOfWeek("2026-08-29"), 6, "2026-08-29 is a Saturday");
});

test("due dates never land on Saturday", () => {
  assert.equal(rollOffRestDay("2026-08-29", 6), "2026-08-30", "Saturday rolls to Sunday");
  assert.equal(rollOffRestDay("2026-08-28", 6), "2026-08-28", "Friday is left alone");
});

test("nudge walks its full ladder: +1, +3, +7, +14", () => {
  const days = [1, 2, 3, 4].map(
    (n) => computeNextTouch("nudge", n, C, Q, MON).nextTouchAt,
  );
  assert.deepEqual(days, [
    "2026-08-25", // +1
    "2026-08-27", // +3
    "2026-08-31", // +7
    "2026-09-07", // +14, the last rung, still used
  ]);
  // None of them auto-move: the move happens when the last wait elapses, not on send.
  for (const n of [1, 2, 3, 4]) {
    assert.equal(computeNextTouch("nudge", n, C, Q, MON).moveToStage, null);
  }
});

test("awaiting_photos walks +1, +2, +4", () => {
  const days = [1, 2, 3].map(
    (n) => computeNextTouch("awaiting_photos", n, C, Q, MON).nextTouchAt,
  );
  assert.deepEqual(days, ["2026-08-25", "2026-08-26", "2026-08-28"]);
});

test("a lead just captured is due today, not tomorrow", () => {
  // The bug this guards: deriving a new lead's date from the ladder put it on
  // tomorrow, so it vanished from Today the moment it was saved.
  assert.equal(firstTouchDate(Q, MON), MON);
  const beforeSaturday = "2026-08-29"; // a Saturday
  assert.equal(firstTouchDate(Q, beforeSaturday), "2026-08-30", "a Saturday capture rolls to Sunday");
  // And it must not be whatever the first nudge interval happens to be.
  assert.notEqual(firstTouchDate(Q, MON), computeNextTouch("nudge", 1, C, Q, MON).nextTouchAt);
});

test("photos_in is always due today", () => {
  const r = computeNextTouch("photos_in", 3, C, Q, MON);
  assert.equal(r.nextTouchAt, MON);
  assert.match(r.explanation, /blocked on you/i);
});

test("poopy clears the date and stops reminders", () => {
  const r = computeNextTouch("poopy", 2, C, Q, MON);
  assert.equal(r.nextTouchAt, null);
  assert.equal(r.moveToStage, null);
});

test("an exhausted nudge moves to get_back_later on +60, never to poopy", () => {
  const lead = { stage: "nudge", nextTouchAt: MON } as Lead;
  const move = shouldAutoMove(lead, 4, C, MON);
  assert.ok(move);
  assert.equal(move.stage, "get_back_later");
  assert.equal(move.nextTouchAt, addDays(MON, 60));
  // Every stage's escape hatch is get_back_later. Nothing auto-poopies.
  for (const rule of Object.values(C)) {
    if (rule) assert.notEqual(rule.exhaustedStage, "poopy");
  }
});

test("a lead that is not yet due is never auto-moved", () => {
  const lead = { stage: "nudge", nextTouchAt: "2026-09-30" } as Lead;
  assert.equal(shouldAutoMove(lead, 9, C, MON), null);
});

test("a reply resets the ladder, so a replying lead is never auto-moved", () => {
  const withReply = [
    interaction("out", 500),
    interaction("out", 400),
    interaction("in", 300), // they wrote back
    interaction("out", 200),
  ];
  assert.equal(unansweredTouches(withReply), 1);
  const lead = { stage: "nudge", nextTouchAt: MON } as Lead;
  assert.equal(shouldAutoMove(lead, unansweredTouches(withReply), C, MON), null);

  assert.equal(unansweredTouches([]), 0);
  assert.equal(
    unansweredTouches([interaction("out", 300), interaction("out", 200)]),
    2,
  );
});

test("quiet hours close overnight and all of Saturday", () => {
  const at = (iso: string) => isQuietNow(Q, new Date(iso));
  assert.equal(at("2026-08-24T05:00:00Z").quiet, true, "08:00 local is before hours");
  assert.equal(at("2026-08-24T07:00:00Z").quiet, false, "10:00 local is open");
  assert.equal(at("2026-08-24T16:30:00Z").quiet, false, "19:30 local is open");
  assert.equal(at("2026-08-24T17:30:00Z").quiet, true, "20:30 local is after hours");
  assert.equal(at("2026-08-29T10:00:00Z").reason, "rest_day", "Saturday is closed");
  assert.equal(todayIn("Asia/Jerusalem", new Date("2026-08-24T21:30:00Z")), "2026-08-25");
});

test("Israeli phone numbers normalize to E.164 however they are typed", () => {
  for (const input of ["054-123-4567", "0541234567", "+972 54 123 4567", "972541234567"]) {
    assert.equal(normalizePhone(input), "+972541234567", `failed on ${input}`);
  }
  assert.equal(normalizePhone(""), null);
  assert.equal(normalizePhone("   "), null);
});

test("the wa.me link carries no plus and an escaped body", () => {
  const link = waLink("+972541234567", "היי דנה, מה שלומך? 🙂");
  assert.ok(link.startsWith("https://wa.me/972541234567?text="));
  assert.ok(!link.includes(" "), "spaces must be percent-encoded");
  assert.equal(decodeURIComponent(link.split("text=")[1]), "היי דנה, מה שלומך? 🙂");
});

test("template variables render, and unknown ones are left visible", () => {
  const lead = { name: "Dana", interest: "3-seat Milano", quotedPrice: 8900 } as Lead;
  assert.equal(
    renderTemplate("Hi {{name}}, the {{interest}} is {{quoted_price}}", lead),
    "Hi Dana, the 3-seat Milano is ₪8,900",
  );
  assert.equal(renderTemplate("{{nope}}", lead), "{{nope}}", "typos stay visible");
  const noPrice = { ...lead, quotedPrice: null } as Lead;
  assert.equal(renderTemplate("{{quoted_price}}", noPrice), "");
});

test("template lookup falls back down the ladder and then to Hebrew", () => {
  const t = (stage: string, language: string, touchNumber: number, body: string) =>
    ({ id: body, stage, language, touchNumber, body }) as never;
  const all = [
    t("nudge", "he", 1, "he-1"),
    t("nudge", "he", 2, "he-2"),
    t("nudge", "ru", 1, "ru-1"),
  ];
  assert.equal(pickTemplate(all, "nudge", "he", 2)?.body, "he-2", "exact match");
  assert.equal(pickTemplate(all, "nudge", "he", 9)?.body, "he-2", "reuses the last rung");
  assert.equal(pickTemplate(all, "nudge", "ru", 2)?.body, "ru-1", "falls down the ladder");
  assert.equal(pickTemplate(all, "nudge", "en", 1)?.body, "he-1", "falls back to Hebrew");
  assert.equal(pickTemplate(all, "poopy", "he", 1), null, "no template is not a crash");
});
