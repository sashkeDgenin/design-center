"use client";

import { useEffect, useState, useTransition } from "react";
import { forgetSubscription, saveSubscription, sendTestPush } from "@/lib/push-actions";
import { Card } from "./ui";

type State = "checking" | "unsupported" | "blocked" | "off" | "on";

/**
 * The VAPID public key arrives as base64url and the Push API wants raw bytes.
 * Backed by an explicit ArrayBuffer, since a Uint8Array over SharedArrayBuffer is
 * not a valid BufferSource.
 */
function toBytes(base64Url: string): Uint8Array<ArrayBuffer> {
  const padded = (base64Url + "=".repeat((4 - (base64Url.length % 4)) % 4))
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const raw = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

function deviceLabel(): string {
  const ua = navigator.userAgent;
  if (/Android/i.test(ua)) return "Android phone";
  if (/iPhone|iPad/i.test(ua)) return "iPhone";
  return "This browser";
}

export function NotificationsToggle({ publicKey }: { publicKey: string | null }) {
  const [state, setState] = useState<State>("checking");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [working, setWorking] = useState(false);
  const [transitioning, startTransition] = useTransition();
  const pending = working || transitioning;

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setState("unsupported");
      return;
    }
    if (Notification.permission === "denied") {
      setState("blocked");
      return;
    }
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setState(sub ? "on" : "off"))
      .catch(() => setState("off"));
  }, []);

  /**
   * Subscribing talks to the phone's push service (Google's, on Android), and that
   * call can hang indefinitely rather than failing: no signal, a firewall in the way,
   * or a device without Play Services all produce a promise that never settles. So it
   * races a timeout, and every path ends in a message. A button that silently does
   * nothing forever is the worst outcome here, because the natural read is that the
   * app is broken.
   */
  async function turnOn() {
    setMessage(null);
    if (!publicKey) {
      setMessage({ ok: false, text: "The server has no notification keys set yet." });
      return;
    }

    setWorking(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "blocked" : "off");
        setMessage({ ok: false, text: "Permission was not granted, so nothing will be sent." });
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const subscription = await Promise.race([
        registration.pushManager.subscribe({
          // Required: every push must result in a visible notification.
          userVisibleOnly: true,
          applicationServerKey: toBytes(publicKey),
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("timeout")), 20_000),
        ),
      ]);

      const json = subscription.toJSON();
      startTransition(async () => {
        const result = await saveSubscription(
          subscription.endpoint,
          json.keys?.p256dh ?? "",
          json.keys?.auth ?? "",
          deviceLabel(),
        );
        setState(result.ok ? "on" : "off");
        setMessage(result.ok ? { ok: true, text: result.message ?? "On." } : { ok: false, text: result.error });
      });
    } catch (error) {
      setState("off");
      const timedOut = (error as Error).message === "timeout";
      setMessage({
        ok: false,
        text: timedOut
          ? "Your phone's notification service did not answer. Check you are online and try again; on Android this also needs Google Play Services."
          : `Could not subscribe: ${(error as Error).message}`,
      });
    } finally {
      setWorking(false);
    }
  }

  async function turnOff() {
    setMessage(null);
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      const endpoint = subscription.endpoint;
      await subscription.unsubscribe();
      startTransition(async () => {
        const result = await forgetSubscription(endpoint);
        setState("off");
        setMessage(result.ok ? { ok: true, text: result.message ?? "Off." } : { ok: false, text: result.error });
      });
    } else {
      setState("off");
    }
  }

  function test() {
    setMessage(null);
    startTransition(async () => {
      const result = await sendTestPush();
      setMessage(result.ok ? { ok: true, text: result.message ?? "Sent." } : { ok: false, text: result.error });
    });
  }

  return (
    <Card className="p-3.5">
      <h2 className="text-sm font-bold">Tell me who to call</h2>
      <p className="mt-1 text-xs text-ink-soft">
        One notification each morning naming the people who need chasing, so you do not
        have to remember to open this.
      </p>

      <div className="mt-3">
        {state === "checking" ? <p className="text-xs text-ink-faint">Checking...</p> : null}

        {state === "unsupported" ? (
          <p className="rounded-lg bg-overdue-bg px-2.5 py-2 text-xs text-overdue">
            This browser cannot do notifications. On Android use Chrome; on iPhone the app
            has to be added to the home screen first.
          </p>
        ) : null}

        {state === "blocked" ? (
          <p className="rounded-lg bg-blocked-bg px-2.5 py-2 text-xs text-blocked">
            Notifications are blocked for this site. Turn them back on in your browser&rsquo;s
            site settings, then reload this page.
          </p>
        ) : null}

        {state === "off" ? (
          <button
            type="button"
            onClick={turnOn}
            disabled={pending}
            className="tap w-full rounded-xl bg-ink px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
          >
            {pending ? "Asking your phone..." : "Turn on notifications"}
          </button>
        ) : null}

        {state === "on" ? (
          <div className="space-y-2">
            <p className="flex items-center gap-2 rounded-lg bg-whatsapp/10 px-2.5 py-2 text-xs font-semibold text-whatsapp-dark">
              <span aria-hidden>✓</span> This phone is subscribed.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={test}
                disabled={pending}
                className="tap flex-1 rounded-xl border border-ink bg-card px-3 py-2.5 text-sm font-semibold disabled:opacity-60"
              >
                {pending ? "Sending..." : "Send one now"}
              </button>
              <button
                type="button"
                onClick={turnOff}
                disabled={pending}
                className="tap rounded-xl border border-line px-3 py-2.5 text-sm font-semibold text-ink-soft disabled:opacity-60"
              >
                Turn off
              </button>
            </div>
          </div>
        ) : null}

        {message ? (
          <p
            role="status"
            className={`mt-2 rounded-lg px-2.5 py-2 text-xs font-medium ${
              message.ok ? "bg-whatsapp/10 text-whatsapp-dark" : "bg-blocked-bg text-blocked"
            }`}
          >
            {message.text}
          </p>
        ) : null}
      </div>
    </Card>
  );
}
