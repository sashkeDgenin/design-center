import { loadToday } from "@/lib/queries";
import { buildDigest } from "@/lib/digest";
import { sendToAll } from "@/lib/push";

export const dynamic = "force-dynamic";

/**
 * The daily "who needs calling" push, invoked by Vercel Cron.
 *
 * Vercel sends CRON_SECRET as a bearer token when that variable is set. Without the
 * check anyone who found this URL could make the phone buzz, so a configured secret
 * is required in production; locally it is skipped so the route can be exercised.
 */
function authorised(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!authorised(request)) {
    // Distinguish "you are not the scheduler" from "this was never configured".
    // The second is a setup step, and a bare 401 reads as a broken deployment.
    const unconfigured = !process.env.CRON_SECRET;
    return Response.json(
      {
        error: unconfigured
          ? "CRON_SECRET is not set, so the daily notification cannot run. Add it to the project's environment variables and redeploy."
          : "Not authorised.",
      },
      { status: 401 },
    );
  }

  const board = await loadToday();
  const digest = buildDigest(board);

  if (!digest) {
    return Response.json({
      sent: false,
      reason: board.quiet.reason === "rest_day" ? "rest day" : "nothing due",
    });
  }

  const report = await sendToAll(digest);
  return Response.json({ sent: report.sent > 0, digest, report });
}
