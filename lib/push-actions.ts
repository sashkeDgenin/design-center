"use server";

import { revalidatePath } from "next/cache";
import { sql } from "drizzle-orm";
import { getDb } from "@/db";
import { pushSubscriptions } from "@/db/schema";
import { loadToday } from "./queries";
import { buildDigest } from "./digest";
import { removeSubscription, sendToAll } from "./push";
import type { ActionResult } from "./actions";

/** Saves the subscription this browser was issued, so the server can push to it. */
export async function saveSubscription(
  endpoint: string,
  p256dh: string,
  auth: string,
  label: string,
): Promise<ActionResult> {
  if (!endpoint || !p256dh || !auth) {
    return { ok: false, error: "The browser did not return a usable subscription." };
  }
  try {
    await getDb()
      .insert(pushSubscriptions)
      .values({ endpoint, p256dh, auth, label })
      // Re-subscribing on the same browser reissues the same endpoint; keep one row.
      .onConflictDoUpdate({
        target: pushSubscriptions.endpoint,
        set: { p256dh, auth, label, createdAt: sql`now()` },
      });
    revalidatePath("/settings");
    return { ok: true, message: "This phone will now be told who needs calling." };
  } catch (error) {
    return { ok: false, error: `Could not save: ${(error as Error).message}` };
  }
}

export async function forgetSubscription(endpoint: string): Promise<ActionResult> {
  try {
    await removeSubscription(endpoint);
    revalidatePath("/settings");
    return { ok: true, message: "Notifications off for this phone." };
  } catch (error) {
    return { ok: false, error: `Could not remove: ${(error as Error).message}` };
  }
}

/**
 * Sends the real digest right now.
 *
 * Worth having as a button: notifications are the one feature you cannot verify by
 * looking at the screen, and waiting until tomorrow morning to find out the keys are
 * wrong is no way to find out.
 */
export async function sendTestPush(): Promise<ActionResult> {
  try {
    const board = await loadToday();
    const digest = buildDigest(board) ?? {
      title: "LeadDesk is working",
      body: "Nothing is due right now, so this is what a quiet day looks like.",
      url: "/",
      tag: "leaddesk-digest",
    };
    const report = await sendToAll(digest);
    if (!report.configured) {
      return { ok: false, error: "Notification keys are not set on the server yet." };
    }
    if (report.sent === 0) {
      return { ok: false, error: report.errors[0] ?? "No device is subscribed." };
    }
    return {
      ok: true,
      message: `Sent to ${report.sent} device${report.sent === 1 ? "" : "s"}. Check your phone.`,
    };
  } catch (error) {
    return { ok: false, error: `Could not send: ${(error as Error).message}` };
  }
}
