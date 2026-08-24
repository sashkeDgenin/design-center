"use client";

import { useState, useTransition } from "react";
import type { LeadDetail } from "@/lib/queries";
import { LANGUAGES, SOURCES, STAGES } from "@/db/schema";
import { STAGE_LABELS } from "@/lib/cadence";
import { updateLead } from "@/lib/actions";
import { Card, Field, inputClass } from "./ui";

const SOURCE_LABELS: Record<(typeof SOURCES)[number], string> = {
  walkout: "Walked out",
  phone_tradein: "Phone: trade-in",
  phone_website: "Phone: website",
  walkin: "Walk-in",
  other: "Other",
};

const LANGUAGE_LABELS: Record<(typeof LANGUAGES)[number], string> = {
  he: "Hebrew",
  ru: "Russian",
  en: "English",
};

/**
 * Stage and date save on change, because those two are the ones I change while
 * standing up. The text fields save together on a single button, so typing is never
 * interrupted by a round trip.
 */
export function LeadFields({ detail }: { detail: LeadDetail }) {
  const { lead } = detail;
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  function save(patch: Record<string, string>) {
    const formData = new FormData();
    for (const [k, v] of Object.entries(patch)) formData.set(k, v);
    startTransition(async () => {
      const result = await updateLead(lead.id, formData);
      setFeedback(
        result.ok
          ? { ok: true, text: result.message ?? "Saved." }
          : { ok: false, text: result.error },
      );
    });
  }

  return (
    <Card className="space-y-4 p-3.5">
      <div className="flex items-baseline gap-2">
        <h2 className="text-sm font-bold">Details</h2>
        {pending ? <span className="text-[11px] text-ink-faint">Saving...</span> : null}
      </div>

      <Field label="Stage" hint="Changing this re-schedules the next touch automatically.">
        <select
          defaultValue={lead.stage}
          onChange={(e) => save({ stage: e.target.value })}
          className={inputClass}
        >
          {STAGES.map((s) => (
            <option key={s} value={s}>
              {STAGE_LABELS[s]}
            </option>
          ))}
        </select>
      </Field>

      <Field
        label="Next touch"
        hint={
          lead.nextTouchAt
            ? "Overrides the automatic date. One tap."
            : "No reminder set. Pick a date to start chasing again."
        }
      >
        <input
          type="date"
          defaultValue={lead.nextTouchAt ?? ""}
          onChange={(e) => save({ nextTouchAt: e.target.value })}
          className={inputClass}
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Language">
          <select
            defaultValue={lead.language}
            onChange={(e) => save({ language: e.target.value })}
            className={inputClass}
          >
            {LANGUAGES.map((l) => (
              <option key={l} value={l}>
                {LANGUAGE_LABELS[l]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Source">
          <select
            defaultValue={lead.source}
            onChange={(e) => save({ source: e.target.value })}
            className={inputClass}
          >
            {SOURCES.map((s) => (
              <option key={s} value={s}>
                {SOURCE_LABELS[s]}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <form
        action={(formData) => {
          startTransition(async () => {
            const result = await updateLead(lead.id, formData);
            setFeedback(
              result.ok
                ? { ok: true, text: result.message ?? "Saved." }
                : { ok: false, text: result.error },
            );
          });
        }}
        className="space-y-3 border-t border-line pt-3"
      >
        <Field label="Name">
          <input name="name" defaultValue={lead.name} dir="auto" className={inputClass} />
        </Field>
        <Field label="Phone">
          <input name="phone" defaultValue={lead.phone} type="tel" className={`${inputClass} font-mono`} />
        </Field>
        <Field label="Interest">
          <input name="interest" defaultValue={lead.interest} dir="auto" className={inputClass} />
        </Field>
        <Field label="Quoted price" hint="Shekels. Leave blank if no price was given.">
          <input
            name="quotedPrice"
            defaultValue={lead.quotedPrice ?? ""}
            inputMode="numeric"
            className={inputClass}
          />
        </Field>
        <Field label="Objection" hint="Why they walked. This is the thing to answer next time.">
          <input name="objection" defaultValue={lead.objection} dir="auto" className={inputClass} />
        </Field>
        <Field label="Notes">
          <textarea
            name="notes"
            defaultValue={lead.notes}
            rows={3}
            dir="auto"
            className="w-full resize-y rounded-xl border border-line bg-page px-3 py-2.5"
          />
        </Field>
        <button
          type="submit"
          disabled={pending}
          className="tap w-full rounded-xl border border-ink bg-card px-4 py-2.5 text-sm font-semibold disabled:opacity-60"
        >
          Save details
        </button>
      </form>

      {feedback ? (
        <p
          role="status"
          className={`rounded-lg px-2.5 py-2 text-xs font-medium ${
            feedback.ok ? "bg-whatsapp/10 text-whatsapp-dark" : "bg-blocked-bg text-blocked"
          }`}
        >
          {feedback.text}
        </p>
      ) : null}
    </Card>
  );
}
