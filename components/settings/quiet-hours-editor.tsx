"use client";

import type { QuietHoursSettings } from "@/db/schema";
import { saveQuietHours } from "@/lib/settings-actions";
import { Section, settingsButton, settingsInput } from "./section";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function QuietHoursEditor({ quietHours }: { quietHours: QuietHoursSettings }) {
  return (
    <Section
      title="Working hours"
      summary={`${quietHours.startHour}:00 to ${quietHours.endHour}:00 · closed ${
        DAYS[quietHours.restDay] ?? "never"
      }`}
    >
      {(report, pending, run) => (
        <form action={(formData) => run(() => saveQuietHours(formData))} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-[11px] text-ink-faint">Day starts</span>
              <input
                name="startHour"
                type="number"
                min={0}
                max={23}
                defaultValue={quietHours.startHour}
                className={settingsInput}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] text-ink-faint">Day ends</span>
              <input
                name="endHour"
                type="number"
                min={1}
                max={24}
                defaultValue={quietHours.endHour}
                className={settingsInput}
              />
            </label>
          </div>

          <label className="block">
            <span className="mb-1 block text-[11px] text-ink-faint">Closed on</span>
            <select name="restDay" defaultValue={quietHours.restDay} className={settingsInput}>
              {DAYS.map((day, index) => (
                <option key={day} value={index}>
                  {day}
                </option>
              ))}
              <option value={-1}>Never closed</option>
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-[11px] text-ink-faint">Time zone</span>
            <input name="timezone" defaultValue={quietHours.timezone} className={settingsInput} />
          </label>

          <p className="text-[11px] text-ink-faint">
            Outside these hours the Today screen stays quiet rather than putting the list
            in front of you, and anything falling due on the closed day rolls to the next.
          </p>

          <button type="submit" disabled={pending} className={settingsButton}>
            {pending ? "Saving..." : "Save hours"}
          </button>
        </form>
      )}
    </Section>
  );
}
