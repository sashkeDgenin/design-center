import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { migrationUrl } from "./url";

/**
 * Migrations always run over a plain TCP connection, including against Neon, which
 * accepts them. The Neon HTTP driver used at request time cannot run a migration.
 */
async function main() {
  const pool = new Pool({ connectionString: migrationUrl() });
  try {
    await migrate(drizzle(pool), { migrationsFolder: "./db/migrations" });
    console.log("migrations applied");
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
