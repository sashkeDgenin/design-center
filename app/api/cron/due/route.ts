import { and, inArray, isNotNull, isNull, lte, ne } from "drizzle-orm";
import { getDb } from "@/db";
import { leads } from "@/db/schema";
import { getSettings } from "@/lib/queries";
import { sendToAll } from "@/lib/push";
import { isQuietNow, timeIn } from "@/lib/time";

export const dynamic = "force-dynamic";

/**
 * Fires the per-lead reminders whose moment has arrived.
 *
 * Called far more often than the morning digest, by whatever scheduler is wired up.
 * Everything here is driven by `remind_at <= now`, so running late only means a late
 * notification, never a missed one, and running twice in a minute sends nothing
 * extra: `reminded_at` is stamped in the same breath.
 */
function authorised(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!authorised(request)) {
    const unconfigured = !process.env.CRON_SECRET;
    return Response.json(
      {
        error: unconfigured
          ? "CRON_SECRET is not set, so timed reminders cannot run. Add it to the project's environment variables and redeploy."
          : "Not authorised.",
      },
      { status: 401 },
    );
  }

  const db = getDb();
  const settings = await getSettings();
  const now = new Date();

  // Never buzz outside working hours or on the rest day. A reminder set for a
  // moment inside quiet hours simply waits: it stays unsent and goes out on the
  // next sweep once the day opens, rather than being dropped.
  const quiet = isQuietNow(settings.quietHours, now);
  if (quiet.quiet) {
    return Response.json({ sent: 0, held: true, reason: quiet.reason });
  }

  const due = await db
    .select()
    .from(leads)
    .where(
      and(
        isNotNull(leads.remindAt),
        isNull(leads.remindedAt),
        lte(leads.remindAt, now),
        ne(leads.stage, "poopy"),
      ),
    );

  if (due.length === 0) return Response.json({ sent: 0, due: 0 });

  const names = due.map((l) => l.name);
  const first = due[0];
  const payload =
    due.length === 1
      ? {
          title: `Call ${first.name}`,
          body: [first.interest, first.objection].filter(Boolean).join(" · ") || "Time to follow up.",
          url: `/leads/${first.id}`,
          tag: `lead-${first.id}`,
        }
      : {
          title: `${due.length} to call now`,
          body: names.slice(0, 4).join(", ") + (names.length > 4 ? ` and ${names.length - 4} more` : ""),
          url: "/",
          tag: "leaddesk-due",
        };

  const report = await sendToAll(payload);

  // Stamp only once the phone has actually been told, so a transient push failure
  // retries on the next sweep instead of being silently swallowed. The exception is
  // having no device subscribed at all: there is nobody to tell, and holding these
  // open would dump a week of backlog the moment notifications get turned on.
  const delivered = report.sent > 0;
  const nobodyToTell = report.configured && report.sent === 0 && report.failed === 0;
  if (delivered || nobodyToTell) {
    await db
      .update(leads)
      .set({ remindedAt: now })
      .where(inArray(leads.id, due.map((l) => l.id)));
  }

  return Response.json({
    stamped: delivered || nobodyToTell,
    sent: report.sent,
    due: due.length,
    at: timeIn(settings.quietHours.timezone, now),
    payload,
    report,
  });
}
