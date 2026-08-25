"use client";

import { saveDirection } from "@/lib/settings-actions";
import { Section } from "./section";

export function DirectionToggle({ current }: { current: string }) {
  return (
    <Section
      title="Layout direction"
      summary={current === "rtl" ? "Right to left" : "Left to right"}
    >
      {(report, pending, run) => (
        <div className="space-y-2">
          <div className="flex gap-2">
            {(["ltr", "rtl"] as const).map((dir) => (
              <button
                key={dir}
                type="button"
                onClick={() => run(() => saveDirection(dir))}
                disabled={pending}
                className={`tap flex-1 rounded-xl px-3 py-2.5 text-sm font-semibold disabled:opacity-60 ${
                  current === dir ? "bg-ink text-white" : "border border-line bg-card"
                }`}
              >
                {dir === "ltr" ? "Left to right" : "Right to left"}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-ink-faint">
            Flips the whole interface. Names and messages always read in their own
            direction regardless, so Hebrew and Russian look right either way.
          </p>
        </div>
      )}
    </Section>
  );
}
