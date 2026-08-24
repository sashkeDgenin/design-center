import { Card } from "./ui";

/**
 * Shown when the database is connected but empty: the tables were never created.
 *
 * This is the first thing a new install hits if migrations have not been run, and the
 * raw Postgres error says only `relation "templates" does not exist`, which tells
 * someone standing on a shop floor precisely nothing. Two commands fix it, so the
 * screen shows the two commands.
 */
export function SetupNeeded({ detail }: { detail?: string }) {
  return (
    <div className="space-y-4">
      <Card className="px-5 py-7">
        <p className="text-lg font-bold tracking-tight">Almost there.</p>
        <p className="mt-1 text-sm text-ink-soft">
          The database is connected, but it has no tables yet. That is normal for a brand
          new Neon project: nothing has created them.
        </p>

        <p className="mt-5 text-xs font-semibold text-ink-soft">
          Run these two commands where the app is installed:
        </p>
        <pre className="mt-2 overflow-x-auto rounded-xl bg-ink px-3.5 py-3 text-[13px] leading-relaxed text-white">
          <code>{"npm run db:migrate\nnpm run db:seed"}</code>
        </pre>
        <p className="mt-2 text-xs text-ink-faint">
          The first creates the tables. The second adds eight example leads so this screen
          has something to show. Then reload this page.
        </p>

        <p className="mt-5 text-xs text-ink-faint">
          Prefer not to touch the terminal? <code>./scripts/setup.sh</code> does the same
          thing and checks your settings while it goes.
        </p>
      </Card>

      {detail ? (
        <details className="px-1">
          <summary className="cursor-pointer text-xs font-semibold text-ink-faint">
            What the database actually said
          </summary>
          <p className="mt-1.5 rounded-lg bg-card px-3 py-2 font-mono text-[11px] text-ink-soft">
            {detail}
          </p>
        </details>
      ) : null}
    </div>
  );
}
