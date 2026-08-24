import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

/**
 * Migrations always run over a plain TCP connection, including against Neon, which
 * accepts them. The Neon HTTP driver used at request time cannot run a migration.
 */
async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set. Copy .env.example to .env.");

  const pool = new Pool({ connectionString: url });
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
