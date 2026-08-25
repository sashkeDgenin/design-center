import "server-only";
import webpush from "web-push";
import { eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { pushSubscriptions } from "@/db/schema";

/**
 * Web Push, so the phone gets told who needs calling without the app being open.
 *
 * VAPID is how a push service knows the message really came from this app. The keys
 * are a pair: the public one is handed to the browser when it subscribes, the private
 * one signs each send and never leaves the server.
 */
export type PushConfig = { publicKey: string; privateKey: string; subject: string };

export function pushConfig(): PushConfig | null {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return null;
  return {
    publicKey,
    privateKey,
    // A contact the push service can use if something is wrong with our sends.
    subject: process.env.VAPID_SUBJECT || "mailto:leaddesk@example.com",
  };
}

export type PushPayload = {
  title: string;
  body: string;
  /** Where tapping the notification lands. */
  url: string;
  tag?: string;
};

export type SendReport = {
  configured: boolean;
  sent: number;
  removed: number;
  failed: number;
  errors: string[];
};

/**
 * Sends to every registered device.
 *
 * A subscription the push service reports as gone (404/410) is deleted rather than
 * retried: that browser is never coming back, and a table of dead endpoints would
 * make every future send slower and noisier.
 */
export async function sendToAll(payload: PushPayload): Promise<SendReport> {
  const config = pushConfig();
  if (!config) {
    return { configured: false, sent: 0, removed: 0, failed: 0, errors: ["VAPID keys are not set"] };
  }

  webpush.setVapidDetails(config.subject, config.publicKey, config.privateKey);

  const db = getDb();
  const subscriptions = await db.select().from(pushSubscriptions);
  if (subscriptions.length === 0) {
    return { configured: true, sent: 0, removed: 0, failed: 0, errors: ["No device is subscribed"] };
  }

  const dead: string[] = [];
  const errors: string[] = [];
  let sent = 0;

  await Promise.all(
    subscriptions.map(async (subscription) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth },
          },
          JSON.stringify(payload),
          { TTL: 12 * 60 * 60 },
        );
        sent += 1;
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          dead.push(subscription.id);
        } else {
          errors.push(`${status ?? "?"}: ${(error as Error).message}`);
        }
      }
    }),
  );

  if (dead.length > 0) {
    await db.delete(pushSubscriptions).where(inArray(pushSubscriptions.id, dead));
  }
  if (sent > 0) {
    await db
      .update(pushSubscriptions)
      .set({ lastSentAt: new Date() })
      .where(inArray(pushSubscriptions.endpoint, subscriptions.map((s) => s.endpoint)));
  }

  return { configured: true, sent, removed: dead.length, failed: errors.length, errors };
}

export async function removeSubscription(endpoint: string): Promise<void> {
  await getDb().delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint));
}
