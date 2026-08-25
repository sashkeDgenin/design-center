"use client";

import { useState, useTransition } from "react";
import { Card } from "../ui";
import type { ActionResult } from "@/lib/actions";

/**
 * A collapsible settings block with its own save state.
 *
 * Collapsed by default because this screen is long and read on a phone: the thing
 * you came for should never be four scrolls down.
 */
export function Section({
  title,
  summary,
  defaultOpen = false,
  children,
}: {
  title: string;
  summary: string;
  defaultOpen?: boolean;
  children: (report: (result: ActionResult) => void, pending: boolean, run: (fn: () => Promise<ActionResult>) => void) => React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const report = (result: ActionResult) =>
    setMessage(result.ok ? { ok: true, text: result.message ?? "Saved." } : { ok: false, text: result.error });

  const run = (fn: () => Promise<ActionResult>) =>
    startTransition(async () => {
      setMessage(null);
      report(await fn());
    });

  return (
    <Card className="overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="tap flex w-full items-center gap-3 px-3.5 py-3 text-start"
        aria-expanded={open}
      >
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold">{title}</span>
          <span className="block truncate text-xs text-ink-soft">{summary}</span>
        </span>
        <span aria-hidden className={`shrink-0 text-ink-faint transition-transform ${open ? "rotate-90" : ""}`}>
          ›
        </span>
      </button>

      {open ? (
        <div className="border-t border-line px-3.5 py-3">
          {children(report, pending, run)}
          {message ? (
            <p
              role="status"
              className={`mt-3 rounded-lg px-2.5 py-2 text-xs font-medium ${
                message.ok ? "bg-whatsapp/10 text-whatsapp-dark" : "bg-blocked-bg text-blocked"
              }`}
            >
              {message.text}
            </p>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}

export const settingsInput =
  "tap w-full rounded-xl border border-line bg-page px-3 py-2.5 text-sm";
export const settingsButton =
  "tap w-full rounded-xl bg-ink px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60";
