"use client";

import { useActionState } from "react";
import { createLead } from "@/lib/actions";
import { SOURCES } from "@/db/schema";
import { Field, inputClass } from "./ui";

const SOURCE_LABELS: Record<(typeof SOURCES)[number], string> = {
  walkout: "Walked out",
  phone_tradein: "Phone: trade-in",
  phone_website: "Phone: website",
  walkin: "Walk-in",
  other: "Other",
};

/**
 * Four fields, one thumb, ten seconds. Everything else on the lead is optional and
 * editable later, which is the only way this gets filled in while someone is still
 * walking towards the door.
 */
export function QuickAddForm() {
  const [state, action, pending] = useActionState(createLead, null);

  return (
    <form action={action} className="space-y-4">
      <Field label="Name">
        <input
          name="name"
          autoFocus
          autoComplete="off"
          dir="auto"
          placeholder="First name is enough"
          className={inputClass}
        />
      </Field>

      <Field label="Phone" hint="Israeli numbers can go in as 054..., the +972 is added for you.">
        <input
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="off"
          defaultValue="+972"
          className={`${inputClass} font-mono`}
        />
      </Field>

      <Field label="Source">
        <select name="source" defaultValue="walkout" className={inputClass}>
          {SOURCES.map((s) => (
            <option key={s} value={s}>
              {SOURCE_LABELS[s]}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Interest" hint="What they actually looked at. Future you will want this.">
        <input
          name="interest"
          autoComplete="off"
          dir="auto"
          placeholder="3-seat Milano, grey fabric"
          className={inputClass}
        />
      </Field>

      {state && !state.ok ? (
        <p role="alert" className="rounded-lg bg-blocked-bg px-3 py-2 text-sm font-medium text-blocked">
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="tap w-full rounded-xl bg-ink px-4 py-3.5 text-base font-semibold text-white disabled:opacity-60"
      >
        {pending ? "Saving..." : "Save lead"}
      </button>
      <p className="text-center text-xs text-ink-faint">
        Saved as a Nudge, first follow-up scheduled for tomorrow.
      </p>
    </form>
  );
}
