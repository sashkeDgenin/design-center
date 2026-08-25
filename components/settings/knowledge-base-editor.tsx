"use client";

import { saveKnowledgeBase } from "@/lib/settings-actions";
import { Section, settingsButton } from "./section";

const PLACEHOLDER_MARKER = "This file is not filled in yet";

/**
 * The store's facts, injected into every AI call.
 *
 * The warning is not decoration: the reply helper is instructed to refuse rather
 * than invent, so an empty document means it refuses almost everything.
 */
export function KnowledgeBaseEditor({ value }: { value: string }) {
  const unfilled = value.includes(PLACEHOLDER_MARKER) || value.trim().length < 40;

  return (
    <Section
      title="About your store"
      summary={unfilled ? "Not filled in yet — AI replies will refuse most questions" : "Prices, delivery, warranty, trade-in rule"}
    >
      {(report, pending, run) => (
        <form action={(formData) => run(() => saveKnowledgeBase(formData))} className="space-y-3">
          {unfilled ? (
            <p className="rounded-lg bg-overdue-bg px-2.5 py-2 text-xs text-overdue">
              Until this is filled in, the AI reply helper will say it cannot answer
              almost everything. That is deliberate: it is told never to invent a price,
              a delivery date or a stock level.
            </p>
          ) : null}

          <textarea
            name="knowledgeBase"
            defaultValue={value}
            dir="auto"
            rows={16}
            className="w-full resize-y rounded-xl border border-line bg-page px-3 py-2.5 font-mono text-[13px] leading-relaxed"
          />

          <button type="submit" disabled={pending} className={settingsButton}>
            {pending ? "Saving..." : "Save store details"}
          </button>
        </form>
      )}
    </Section>
  );
}
