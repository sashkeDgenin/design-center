"use client";

import { useState } from "react";

/**
 * Quiet hours suppress surfacing, not access.
 *
 * Outside 09:00-20:00, and all of Saturday, the due list is not put in front of me.
 * It is still one tap away, because a blank screen with no way forward would be a
 * dead end, and because sometimes I do want to look.
 */
export function QuietHoursNotice({
  reason,
  count,
  timezone,
  children,
}: {
  reason: "before_hours" | "after_hours" | "rest_day" | null;
  count: number;
  timezone: string;
  children: React.ReactNode;
}) {
  const [shown, setShown] = useState(false);

  const headline = {
    before_hours: "Too early.",
    after_hours: "Day's done.",
    rest_day: "Shabbat.",
    null: "Quiet hours.",
  }[reason ?? "null"];

  const body = {
    before_hours: "Nothing goes out before 09:00. It will all still be here.",
    after_hours: "Nothing goes out after 20:00. Get some rest.",
    rest_day: "Nothing goes out on Saturday. Anything due today has been rolled to Sunday.",
    null: "Nothing is being surfaced right now.",
  }[reason ?? "null"];

  if (shown) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 rounded-xl border border-line bg-card px-3 py-2">
          <span className="text-xs text-ink-soft">
            {headline} Showing anyway.
          </span>
          <button
            type="button"
            onClick={() => setShown(false)}
            className="ms-auto text-xs font-semibold text-brand underline"
          >
            Hide
          </button>
        </div>
        {children}
      </div>
    );
  }

  return (
    <div className="rounded-[14px] border border-line bg-card px-5 py-8 text-center shadow-sm">
      <p className="text-base font-semibold">{headline}</p>
      <p className="mx-auto mt-1 max-w-[34ch] text-sm text-ink-soft">{body}</p>
      <p className="mt-3 text-sm font-medium">
        {count === 0
          ? "Nothing is waiting on you."
          : `${count} lead${count === 1 ? "" : "s"} waiting for tomorrow.`}
      </p>
      {count > 0 ? (
        <button
          type="button"
          onClick={() => setShown(true)}
          className="tap mt-4 inline-flex items-center justify-center rounded-xl border border-line px-5 py-2.5 text-sm font-semibold"
        >
          Show them anyway
        </button>
      ) : null}
      <p className="mt-3 text-[11px] text-ink-faint">Quiet hours follow {timezone}.</p>
    </div>
  );
}
