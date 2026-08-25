"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Stage } from "@/db/schema";
import { STAGE_LABELS } from "@/lib/cadence";
import { updateLead } from "@/lib/actions";
import { Card } from "./ui";

type Suggestion = {
  can_answer: boolean;
  suggested_reply: string;
  escalate_reason: string | null;
  suggested_stage: Stage | null;
};

/**
 * Asks the model what to say back.
 *
 * When it cannot answer, the missing fact is shown loudly rather than a reply being
 * offered anyway. That refusal is the feature: a made-up delivery date sent to a real
 * customer is worse than no suggestion at all.
 */
export function ReplyHelper({ leadId, onUse }: { leadId: string; onUse: (text: string) => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Suggestion | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function ask() {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const response = await fetch("/api/reply", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ leadId }),
      });
      const data = await response.json();
      if (!response.ok) setError(data.error ?? "The reply helper failed.");
      else setResult(data as Suggestion);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function moveTo(stage: Stage) {
    const formData = new FormData();
    formData.set("stage", stage);
    const outcome = await updateLead(leadId, formData);
    if (outcome.ok) router.refresh();
    else setError(outcome.error);
  }

  return (
    <Card className="p-3.5">
      <div className="flex items-baseline gap-2">
        <h2 className="text-sm font-bold">Help me answer</h2>
        <span className="text-[11px] text-ink-faint">reads the whole thread</span>
      </div>

      <button
        type="button"
        onClick={ask}
        disabled={busy}
        className="tap mt-2 w-full rounded-xl border border-ink bg-card px-4 py-2.5 text-sm font-semibold disabled:opacity-60"
      >
        {busy ? "Thinking..." : "Suggest a reply"}
      </button>

      {error ? (
        <p role="alert" className="mt-2 rounded-lg bg-blocked-bg px-2.5 py-2 text-xs font-medium text-blocked">
          {error}
        </p>
      ) : null}

      {result && !result.can_answer ? (
        <div className="mt-3 rounded-xl border border-blocked/30 bg-blocked-bg p-3">
          <p className="text-sm font-bold text-blocked">Needs you</p>
          <p className="mt-1 text-sm text-ink">
            {result.escalate_reason ?? "This one needs a fact only you have."}
          </p>
          <p className="mt-2 text-[11px] text-ink-soft">
            Add it under <strong>About your store</strong> in Settings and it will be able to
            answer this next time.
          </p>
        </div>
      ) : null}

      {result?.can_answer ? (
        <div className="mt-3 space-y-2">
          <p
            dir="auto"
            className="rounded-xl border border-line bg-page px-3 py-2.5 text-sm leading-relaxed"
          >
            {result.suggested_reply}
          </p>
          <button
            type="button"
            onClick={() => onUse(result.suggested_reply)}
            className="tap w-full rounded-xl bg-ink px-4 py-2.5 text-sm font-semibold text-white"
          >
            Use this
          </button>
          {result.suggested_stage ? (
            <button
              type="button"
              onClick={() => moveTo(result.suggested_stage!)}
              className="tap w-full rounded-xl border border-line px-4 py-2 text-xs font-semibold text-ink-soft"
            >
              Also move to {STAGE_LABELS[result.suggested_stage]}
            </button>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}
