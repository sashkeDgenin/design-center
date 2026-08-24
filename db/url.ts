/**
 * Neon hands out two connection strings for the same database: a pooled one whose
 * host carries a `-pooler` suffix, and a direct one without it.
 *
 * Pooled is right for request traffic. It is wrong for migrations: the pooler runs
 * PgBouncer in transaction mode, which has no session state, so advisory locks and
 * multi-statement DDL transactions do not behave. Schema changes therefore prefer
 * the direct URL when one is configured.
 *
 * On a plain Postgres there is only one URL, and the fallback makes that a no-op.
 */
export function runtimeUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Put it in .env.local (see .env.example for the format).",
    );
  }
  return url;
}

export function migrationUrl(): string {
  const direct = process.env.DATABASE_URL_UNPOOLED;
  if (direct) return direct;

  const url = runtimeUrl();
  if (url.includes("-pooler.")) {
    console.warn(
      "warning: running migrations through Neon's pooled connection.\n" +
        "         Set DATABASE_URL_UNPOOLED to the direct string (the same URL with\n" +
        "         '-pooler' removed from the host) if a migration hangs or errors.",
    );
  }
  return url;
}
