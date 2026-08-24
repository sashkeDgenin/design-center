import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";
import { drizzle as drizzlePg, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { neon } from "@neondatabase/serverless";
import { Pool } from "pg";
import * as schema from "./schema";
import { runtimeUrl } from "./url";

/**
 * Neon's serverless driver speaks HTTP to Neon and nothing else, so it cannot talk
 * to a plain Postgres. Production runs on Neon; local dev and CI run on ordinary
 * Postgres. Pick the driver from the URL rather than making that a manual step.
 */
function isNeonUrl(url: string): boolean {
  return /\.neon\.tech|neon\.build/.test(url);
}

/**
 * Both drivers expose the same Drizzle query builder; only the transport differs.
 * The union of their two instance types collapses Drizzle's `.returning()` overloads,
 * so the shared surface is named once here and the Neon instance is widened to it.
 */
type Database = NodePgDatabase<typeof schema>;

function create(): Database {
  const url = runtimeUrl();
  if (isNeonUrl(url)) {
    return drizzleNeon({ client: neon(url), schema }) as unknown as Database;
  }
  return drizzlePg({ client: new Pool({ connectionString: url }), schema });
}

let cached: Database | undefined;

/**
 * Lazily built so that importing this module never opens a connection. Next builds
 * import route modules to collect metadata, and a build should not need a database.
 */
export function getDb(): Database {
  cached ??= create();
  return cached;
}

export { schema };
