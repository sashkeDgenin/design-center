"use client";

import type { CadenceSettings } from "@/db/schema";
import { STAGES } from "@/db/schema";
import { STAGE_LABELS } from "@/lib/cadence";
import { saveCadence } from "@/lib/settings-actions";
import { Section, settingsButton, settingsInput } from "./section";

/**
 * Intervals are edited as a plain comma-separated list of days, which reads exactly
 * like the ladder does in your head: "1, 3, 7, 14".
 */
export function CadenceEditor({ cadence }: { cadence: CadenceSettings }) {
  const active = STAGES.filter((stage) => cadence[stage] !== null);
  const summary = active
    .map((stage) => `${STAGE_LABELS[stage].split(" ")[0]} ${cadence[stage]!.intervals.join("/")}`)
    .join(" · ");

  return (
    <Section title="Follow-up timing" summary={summary}>
      {(report, pending, run) => (
        <form
          action={(formData) => run(() => saveCadence(formData))}
          className="space-y-4"
        >
          {active.map((stage) => {
            const rule = cadence[stage]!;
            return (
              <div key={stage}>
                <p className="mb-1 text-xs font-semibold">{STAGE_LABELS[stage]}</p>
                <div className="grid grid-cols-[1fr_auto] gap-2">
                  <label className="block">
                    <span className="mb-1 block text-[11px] text-ink-faint">
                      Days between messages
                    </span>
                    <input
                      name={`${stage}.intervals`}
                      defaultValue={rule.intervals.join(", ")}
                      inputMode="numeric"
                      className={`${settingsInput} font-mono`}
                    />
                  </label>
                  <label className="block w-24">
                    <span className="mb-1 block text-[11px] text-ink-faint">Give up after</span>
                    <input
                      name={`${stage}.maxUnanswered`}
                      defaultValue={rule.maxUnanswered ?? ""}
                      inputMode="numeric"
                      placeholder="never"
                      className={`${settingsInput} text-center font-mono`}
                    />
                  </label>
                </div>
              </div>
            );
          })}

          <p className="text-[11px] text-ink-faint">
            &ldquo;1, 3, 7, 14&rdquo; means chase after a day, then three, then a week,
            then a fortnight. Give up after four unanswered and the lead moves to Get
            back later. Nothing ever moves itself to Poopy.
          </p>

          <button type="submit" disabled={pending} className={settingsButton}>
            {pending ? "Saving..." : "Save timing"}
          </button>
        </form>
      )}
    </Section>
  );
}
