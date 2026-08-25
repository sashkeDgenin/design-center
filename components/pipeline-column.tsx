"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Lead, Stage } from "@/db/schema";
import { STAGES } from "@/db/schema";
import { STAGE_LABELS } from "@/lib/cadence";
import { updateLead } from "@/lib/actions";
import { StageChip } from "./ui";

/**
 * One stage and everything sitting in it.
 *
 * Moving a lead is a select, not a drag. On a phone, dragging a card between columns
 * with one thumb while standing up is a worse interaction than picking from a list,
 * and it fights the scroll.
 */
export function PipelineColumn({
  stage,
  label,
  meaning,
  leads,
  today,
}: {
  stage: Stage;
  label: string;
  meaning: string;
  leads: Lead[];
  today: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(stage !== "poopy");

  function move(lead: Lead, next: string) {
    setError(null);
    const formData = new FormData();
    formData.set("stage", next);
    startTransition(async () => {
      const result = await updateLead(lead.id, formData);
      if (!result.ok) setError(result.error);
      else router.refresh();
    });
  }

  const tone =
    stage === "photos_in" ? "border-blocked/30 bg-blocked-bg" : "border-line bg-card";

  return (
    <section className={`rounded-[14px] border shadow-sm ${tone}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="tap flex w-full items-center gap-2 px-3.5 py-3 text-start"
        aria-expanded={open}
      >
        <StageChip stage={stage} />
        <span className="text-sm font-semibold text-ink-soft">{leads.length}</span>
        <span aria-hidden className={`ms-auto text-ink-faint transition-transform ${open ? "rotate-90" : ""}`}>
          ›
        </span>
      </button>

      {open ? (
        <div className="border-t border-line/70 px-3.5 py-3">
          {leads.length === 0 ? (
            <p className="py-1 text-xs text-ink-faint">{meaning}</p>
          ) : (
            <ul className="space-y-2">
              {leads.map((lead) => {
                const overdue = lead.nextTouchAt !== null && lead.nextTouchAt < today;
                return (
                  <li key={lead.id} className="rounded-xl border border-line bg-card p-2.5">
                    <div className="flex items-start gap-2">
                      <Link href={`/leads/${lead.id}`} className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold" dir="auto">
                          {lead.name}
                        </span>
                        <span className="block truncate text-xs text-ink-soft" dir="auto">
                          {lead.objection || lead.interest || "No details yet"}
                        </span>
                        <span
                          className={`mt-0.5 block text-[11px] font-medium ${
                            overdue ? "text-overdue" : "text-ink-faint"
                          }`}
                        >
                          {lead.nextTouchAt
                            ? overdue
                              ? `overdue since ${lead.nextTouchAt}`
                              : `next ${lead.nextTouchAt}`
                            : "no reminder"}
                        </span>
                      </Link>
                    </div>
                    <select
                      value={lead.stage}
                      onChange={(e) => move(lead, e.target.value)}
                      disabled={pending}
                      aria-label={`Move ${lead.name}`}
                      className="tap mt-2 w-full rounded-lg border border-line bg-page px-2.5 py-2 text-xs font-medium disabled:opacity-60"
                    >
                      {STAGES.map((s) => (
                        <option key={s} value={s}>
                          {s === lead.stage ? `Stay in ${STAGE_LABELS[s]}` : `Move to ${STAGE_LABELS[s]}`}
                        </option>
                      ))}
                    </select>
                  </li>
                );
              })}
            </ul>
          )}
          {error ? (
            <p role="alert" className="mt-2 rounded-lg bg-blocked-bg px-2.5 py-2 text-xs font-medium text-blocked">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
