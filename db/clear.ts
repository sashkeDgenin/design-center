import "./env";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { interactions, leads } from "./schema";
import { runtimeUrl } from "./url";

/**
 * Empties the lead list, ready for real leads.
 *
 * Deletes every lead and its history. Deliberately leaves `settings` and `templates`
 * alone: the cadence rules and the 33 message templates are configuration, not demo
 * data, and re-seeding them would throw away any editing already done.
 *
 * Destructive and not undoable, so it refuses to run without --yes.
 */
async function main() {
  const confirmed = process.argv.includes("--yes");
  const pool = new Pool({ connectionString: runtimeUrl() });
  const db = drizzle(pool);

  try {
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(leads);

    if (count === 0) {
      console.log("No leads to clear. Nothing to do.");
      return;
    }

    if (!confirmed) {
      console.log(`This would permanently delete ${count} lead(s) and all their history.`);
      console.log("Your message templates and settings are kept.");
      console.log("");
      console.log("There is no undo. Export first if you want a copy:");
      console.log("  open /api/export/json in the app while it is running");
      console.log("");
      console.log("Then re-run with --yes:");
      console.log("  npm run db:clear -- --yes");
      process.exitCode = 1;
      return;
    }

    await db.execute(sql`truncate table ${interactions}, ${leads} cascade`);
    console.log(`Cleared ${count} lead(s). Templates and settings kept.`);
    console.log("The app is now empty and ready for real leads.");
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
