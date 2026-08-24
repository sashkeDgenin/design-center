"use client";

import { useActionState, useEffect, useRef } from "react";
import { logReply } from "@/lib/actions";
import { Card } from "./ui";

/**
 * Paste what they said. The AI reply helper reads this history when it lands
 * (build step 8); until then, logging the reply is what stops the thread going cold,
 * and it resets the follow-up ladder so a replying lead is never auto-moved.
 */
export function ReplyBox({ leadId }: { leadId: string }) {
  const [state, action, pending] = useActionState(logReply, null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <Card className="p-3.5">
      <h2 className="mb-2 text-sm font-bold">Paste their reply</h2>
      <form ref={formRef} action={action} className="space-y-2">
        <input type="hidden" name="leadId" value={leadId} />
        <textarea
          name="body"
          rows={3}
          dir="auto"
          placeholder="What they wrote back..."
          className="w-full resize-y rounded-xl border border-line bg-page px-3 py-2.5"
        />
        <div className="flex items-center gap-2">
          <select name="channel" defaultValue="whatsapp" className="tap rounded-xl border border-line bg-card px-3 py-2 text-sm">
            <option value="whatsapp">WhatsApp</option>
            <option value="phone">Phone call</option>
            <option value="in_store">In store</option>
          </select>
          <button
            type="submit"
            disabled={pending}
            className="tap flex-1 rounded-xl border border-ink bg-card px-4 py-2.5 text-sm font-semibold disabled:opacity-60"
          >
            {pending ? "Logging..." : "Log reply"}
          </button>
        </div>
      </form>

      {state ? (
        <p
          role="status"
          className={`mt-2 rounded-lg px-2.5 py-2 text-xs font-medium ${
            state.ok ? "bg-whatsapp/10 text-whatsapp-dark" : "bg-blocked-bg text-blocked"
          }`}
        >
          {state.ok ? state.message : state.error}
        </p>
      ) : null}
    </Card>
  );
}
