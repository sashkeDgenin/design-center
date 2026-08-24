"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { logSend } from "@/lib/actions";

/**
 * The money feature.
 *
 * The touch is recorded first and WhatsApp is opened only once the server has
 * confirmed the write. That ordering is deliberate: a send that was logged but not
 * opened is a nuisance, a send that was opened but not logged is a lost lead.
 *
 * The automatic navigation is followed by a visible fallback link, because a browser
 * that declines to navigate after an await must never leave the message stranded.
 */
export function SendButton({
  leadId,
  body,
  label = "Open WhatsApp",
  size = "large",
  disabled = false,
  disabledReason,
}: {
  leadId: string;
  body: string;
  label?: string;
  size?: "large" | "small";
  disabled?: boolean;
  disabledReason?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fallback, setFallback] = useState<string | null>(null);

  const classes =
    size === "large"
      ? "tap w-full rounded-xl bg-whatsapp px-4 py-3.5 text-base font-semibold text-white active:bg-whatsapp-dark"
      : "tap shrink-0 rounded-xl bg-whatsapp px-3 py-2 text-sm font-semibold text-white active:bg-whatsapp-dark";

  async function send() {
    setError(null);
    setFallback(null);
    const result = await logSend(leadId, body);
    if (!result.ok || !result.link) {
      setError(result.ok ? "The server did not return a link." : result.error);
      return;
    }
    setFallback(result.link);
    startTransition(() => router.refresh());
    window.location.href = result.link;
  }

  if (disabled) {
    return (
      <div className="w-full">
        <button type="button" disabled className={`${classes} cursor-not-allowed opacity-40`}>
          {label}
        </button>
        {disabledReason ? (
          <p className="mt-1.5 text-center text-xs text-ink-soft">{disabledReason}</p>
        ) : null}
      </div>
    );
  }

  return (
    <div className={size === "large" ? "w-full" : "shrink-0"}>
      <button type="button" onClick={send} disabled={pending} className={classes}>
        {pending ? "Logging..." : label}
      </button>
      {error ? (
        <p role="alert" className="mt-1.5 rounded-lg bg-blocked-bg px-2 py-1.5 text-xs font-medium text-blocked">
          {error}
        </p>
      ) : null}
      {fallback ? (
        <a
          href={fallback}
          className="mt-1.5 block text-center text-xs font-semibold text-brand underline"
        >
          WhatsApp did not open? Tap here.
        </a>
      ) : null}
    </div>
  );
}
