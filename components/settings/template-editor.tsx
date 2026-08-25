"use client";

import { useState } from "react";
import type { Template } from "@/db/schema";
import { STAGES, LANGUAGES } from "@/db/schema";
import { STAGE_LABELS } from "@/lib/cadence";
import { addTemplate, deleteTemplate, saveTemplate } from "@/lib/settings-actions";
import { Section, settingsButton, settingsInput } from "./section";

const LANGUAGE_LABELS: Record<string, string> = { he: "Hebrew", ru: "Russian", en: "English" };

/**
 * Templates grouped by stage, since that is how you think about them: what do I say
 * to someone who walked out, versus someone whose photos I already have.
 */
export function TemplateEditor({ templates }: { templates: Template[] }) {
  const [stage, setStage] = useState<string>("nudge");
  const shown = templates
    .filter((t) => t.stage === stage)
    .sort((a, b) => a.language.localeCompare(b.language) || a.touchNumber - b.touchNumber);

  return (
    <Section title="Message templates" summary={`${templates.length} messages across all stages`}>
      {(report, pending, run) => (
        <div className="space-y-3">
          <select
            value={stage}
            onChange={(e) => setStage(e.target.value)}
            className={settingsInput}
            aria-label="Stage"
          >
            {STAGES.map((s) => (
              <option key={s} value={s}>
                {STAGE_LABELS[s]} ({templates.filter((t) => t.stage === s).length})
              </option>
            ))}
          </select>

          {shown.length === 0 ? (
            <p className="rounded-lg bg-overdue-bg px-2.5 py-2 text-xs text-overdue">
              No messages for this stage. Anything here will have to be typed by hand in
              the composer until you add one below.
            </p>
          ) : null}

          {shown.map((template) => (
            <div key={template.id} className="rounded-xl border border-line bg-page p-2.5">
              <div className="mb-1.5 flex items-center gap-2">
                <span className="text-[11px] font-semibold text-ink-soft">
                  #{template.touchNumber} · {LANGUAGE_LABELS[template.language]}
                </span>
                <button
                  type="button"
                  onClick={() => run(() => deleteTemplate(template.id))}
                  disabled={pending}
                  className="ms-auto text-[11px] font-semibold text-blocked underline"
                >
                  Delete
                </button>
              </div>
              <form
                action={(formData) => run(() => saveTemplate(template.id, String(formData.get("body") ?? "")))}
              >
                <textarea
                  name="body"
                  defaultValue={template.body}
                  dir="auto"
                  rows={3}
                  className="w-full resize-y rounded-lg border border-line bg-card px-2.5 py-2 text-sm leading-relaxed"
                />
                <button
                  type="submit"
                  disabled={pending}
                  className="tap mt-1.5 w-full rounded-lg border border-ink bg-card px-3 py-2 text-xs font-semibold disabled:opacity-60"
                >
                  Save this one
                </button>
              </form>
            </div>
          ))}

          <details className="rounded-xl border border-line bg-page p-2.5">
            <summary className="cursor-pointer text-xs font-semibold">Add a message</summary>
            <form action={(formData) => run(() => addTemplate(formData))} className="mt-2 space-y-2">
              <input type="hidden" name="stage" value={stage} />
              <div className="grid grid-cols-2 gap-2">
                <select name="language" defaultValue="he" className={settingsInput}>
                  {LANGUAGES.map((l) => (
                    <option key={l} value={l}>
                      {LANGUAGE_LABELS[l]}
                    </option>
                  ))}
                </select>
                <input
                  name="touchNumber"
                  type="number"
                  min={1}
                  defaultValue={shown.length + 1}
                  className={settingsInput}
                  aria-label="Which follow-up"
                />
              </div>
              <textarea
                name="body"
                dir="auto"
                rows={3}
                placeholder="היי {{name}}, ..."
                className="w-full resize-y rounded-lg border border-line bg-card px-2.5 py-2 text-sm"
              />
              <button type="submit" disabled={pending} className={settingsButton}>
                Add
              </button>
            </form>
          </details>

          <p className="text-[11px] text-ink-faint">
            Variables: <code>{"{{name}}"}</code> <code>{"{{interest}}"}</code>{" "}
            <code>{"{{quoted_price}}"}</code>. A message with no template for its language
            falls back to Hebrew.
          </p>
        </div>
      )}
    </Section>
  );
}
