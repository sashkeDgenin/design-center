# LeadDesk

A follow-up CRM for one furniture salesperson, used one-handed on a phone while
standing on the shop floor.

The whole product exists to close one gap: leads that die because nobody followed
up. Everything here serves that loop.

1. Capture a lead in about ten seconds
2. The app says who is due today
3. The app hands over a message already written
4. One tap opens WhatsApp with that message typed to that person
5. Paste their reply back in, and the thread stays alive

## Status: build steps 1 to 5 are done

The spec asks for steps 1 to 5 first, then a stop, so the app is usable before the
rest is built. That is where this is.

**Built and working**

- Schema, Neon connection, seed data (8 leads across all six stages, 33 templates)
- Passcode gate
- Quick add, lead detail, interaction logging
- `wa.me` deep-link composer with template rendering
- Cadence engine and the Today screen

**Not built yet, on purpose**

- Pipeline board (step 6)
- Settings screens for templates, cadence, quiet hours, knowledge base (step 7)
- AI reply helper (step 8)

Two things that step 7 will eventually put a UI on already exist underneath, because
the spec says they must not be hardcoded: **cadence intervals, quiet hours and the
knowledge base live in the `settings` table**, and **templates live in the `templates`
table**. Editing them today means a SQL update; step 7 only adds the screen. Nothing
in `lib/` reads a hardcoded cadence value.

**JSON and CSV export ship now**, not in step 7, because the spec lists "export from
day one" as a non-negotiable. `GET /api/export/json` returns everything including
poopy and archived leads. `GET /api/export/csv` returns the lead table with a BOM so
Hebrew and Russian survive a double-click into Excel.

## Running it

```bash
./scripts/setup.sh
```

That walks you through it: it opens the Neon console, tells you which button to
press, takes the connection string and a passcode, generates the session secret
itself, writes `.env.local`, then creates the tables and seeds the sample leads
and reads them back to prove it worked. Safe to re-run, and it remembers what you
already entered.

By hand instead:

```bash
cp .env.example .env.local   # then fill in the values
npm install
npm run db:generate       # only after changing db/schema.ts
npm run db:migrate
npm run db:seed           # add --reset via npm run db:reset to start over
npm run dev
```

`DATABASE_URL` picks the driver automatically: a `*.neon.tech` URL uses Neon's
serverless HTTP driver, anything else uses node-postgres, so a plain local Postgres
works for development without changing code.

**Pooled vs direct.** Neon gives two connection strings for the same database. The
pooled one (its host carries a `-pooler` suffix) is what the Connect modal shows by
default and is right for request traffic. Migrations use `DATABASE_URL_UNPOOLED`
when it is set, because the pooler runs PgBouncer in transaction mode, which has no
session state, and schema changes can hang or fail through it. Get the direct string
by switching "Connection pooling" off in the same modal. On a plain local Postgres
there is only one URL and the variable can stay blank. If migrations run against a
pooled host with no direct URL configured, `db/url.ts` prints a warning rather than
failing silently.

Secrets go in **`.env.local`**, which is gitignored. Next.js reads that file
natively, and `db/env.ts` makes the command-line scripts read it too, in the same
precedence Next uses: `.env.local` first, `.env` filling any gaps. Without that the
scripts would read only `.env`, so a value put in `.env.local` would work in
`npm run dev` and then fail in `npm run db:migrate`.

`npm test` runs the cadence, quiet-hours, phone and template unit tests.

## Picking a Neon region

**A Neon project's region cannot be changed after it is created**, so this is the one
setup choice worth slowing down for. Pick the region closest to where the phone
actually is, not the default: every screen in this app is a database round trip, and
the whole point is capturing a lead in ten seconds while someone walks to the door.
For a store in Israel that is AWS Europe (Frankfurt), `eu-central-1`, not a US region.

If you deploy to Vercel, pin the functions to the matching region too, otherwise a
request travels to a US function and back to a European database and gives away the
latency the region choice just bought.

Postgres version does not matter here: the schema is plain DDL (enums, `uuid`,
`jsonb`, `timestamptz`, one unique index) and runs the same on 16 through 18. Leave
Neon Auth off; this app authenticates with one passcode and has no user table, so
Neon Auth would only add tables nothing reads.

## Deploying

Vercel, with the same environment variables set in the project. `SESSION_SECRET`
must be a real random value:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Then open the deployed URL on the phone and add it to the home screen. The manifest
and icons are in place, so it launches full-screen.

## How the follow-up engine works

`next_touch_at` is a plain calendar date, not a timestamp, because "due today" is a
question about the Asia/Jerusalem calendar rather than an instant. Date arithmetic
anchors at 12:00 UTC so a +1 day step never lands on the wrong day across a DST
boundary.

**The ladder.** Each stage has a list of intervals. After the first unanswered touch
the first interval applies, after the second the second, and so on. A `nudge` walks
+1, +3, +7, +14 and an `awaiting_photos` walks +1, +2, +4.

**Unanswered is counted from the interaction log**, not from a column, because "no
reply" is a fact about the conversation. Any inbound message resets the count, so a
lead who writes back drops to the bottom of the ladder rather than being chased on.

**The auto-move happens when the ladder's last wait elapses**, not when the last
touch is sent. A nudge therefore gets all four of its intervals, and only when it
next comes due with four unanswered touches does it move to `get_back_later` on +60.
This is reconciled at read time on the Today screen, so there is no cron job, and a
lead who replied in the meantime is never moved at all. Nothing ever auto-moves to
`poopy`: that is a human decision, and the tests assert no rule can express it.

**Quiet hours suppress surfacing, not access.** Outside 09:00 to 20:00, and all of
Saturday, the Today screen shows a quiet notice instead of the due list. The list is
one tap away behind "Show them anyway", because a blank screen with no way forward
would be a dead end. Due dates that land on Saturday roll to Sunday when they are
computed.

## Decisions worth knowing about

**A pasted reply pulls the lead onto today's list.** The spec does not say this
explicitly. The reasoning: once they have written back the next move is mine, and it
should not wait for a scheduled date to come round. It also resets the ladder.

**The touch is logged before WhatsApp opens.** A send that was logged but not opened
is a nuisance; a send that was opened but not logged is a lost lead. The button waits
for the server to confirm the write, then navigates, and shows a manual fallback link
if the browser declines to navigate on its own.

**`{{quoted_price}}` is not used in the seeded templates.** It renders correctly and
is offered in the composer, but most leads walk out before a price is quoted, and an
empty price mid-sentence reads worse than no mention of price. Add it to a template
where it fits.

**The UI copy is English with RTL layout support.** `settings.ui_direction` flips the
whole shell, and every layout uses logical properties so it flips cleanly. All user
content (names, messages, notes) carries `dir="auto"`, so Hebrew and Russian render
correctly in either mode. English sentences that open with a digit are pinned to
`ltr` so the bidi algorithm does not strand the number.

**One ambiguity in the spec, resolved.** For `nudge` the spec lists four intervals
and also says "after 4 touches with no reply, auto-move". Read literally those
conflict: the fourth interval would never be used. The ladder is walked in full and
the move happens after the last wait, which honours both. Both the interval list and
the trip point are settings, so this is changeable without a deploy.

## Layout

```
app/            screens: login, Today, quick add, lead detail, export routes
components/     UI, composer, send button, reply box, timeline
lib/            cadence engine, dates, phone, templates, queries, actions, session
db/             schema, dual driver, migrations, seed
proxy.ts        passcode gate over every route except the PWA assets
```
