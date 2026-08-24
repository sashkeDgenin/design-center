"use client";

import { useActionState } from "react";
import { signIn } from "@/lib/actions";

export function PasscodeForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState(signIn, null);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next ?? "/"} />
      <input
        name="passcode"
        type="password"
        inputMode="numeric"
        autoComplete="current-password"
        autoFocus
        placeholder="Passcode"
        aria-label="Passcode"
        className="tap w-full rounded-xl border border-line bg-card px-4 py-3 text-center text-lg tracking-widest shadow-sm"
      />
      {state && !state.ok ? (
        <p role="alert" className="rounded-lg bg-blocked-bg px-3 py-2 text-center text-sm font-medium text-blocked">
          {state.error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="tap w-full rounded-xl bg-ink px-4 py-3 font-semibold text-white disabled:opacity-60"
      >
        {pending ? "Checking..." : "Unlock"}
      </button>
    </form>
  );
}
