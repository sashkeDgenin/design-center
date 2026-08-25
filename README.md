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

## Status: all eight build steps are done

- Schema, Neon connection, seed data (8 leads across all six stages, 33 templates)
- Passcode gate
- Quick add, lead detail, interaction logging
- `wa.me` deep-link composer with template rendering
- Cadence engine and the Today screen
- Pipeline board
- Settings: templates, cadence, working hours, store notes, layout direction, export
- AI reply helper

Plus **push notifications**, which the spec did not ask for: one notification each
morning naming the people who need chasing.

## Notifications

Two kinds, and they answer different questions.

**The morning digest** says who needs chasing today. One push, around 09:00, from
Vercel Cron.

**Timed reminders** are per lead. Put a time next to a lead's next-touch date and the
phone buzzes at that moment, naming that lead and linking straight to them. Leave the
time blank and the lead behaves as before: it appears on Today on its date and in the
digest, but interrupts nothing.

A reminder fires once. `remind_at` is the moment, `reminded_at` is stamped when the
push actually lands, and the stamp only happens on delivery, so a transient push
failure retries on the next sweep rather than being swallowed. Reminders falling
inside quiet hours or on the rest day are **held, not dropped**: they go out on the
first sweep after the day opens. Nothing ever fires for a `poopy` lead.

### The scheduler problem

Timed reminders need something to call `/api/cron/due` often. Vercel's Hobby plan runs
a cron **once a day**, so it cannot do this. Three ways round it:

| Option | Cost | Precision |
|---|---|---|
| Vercel Pro | $20/month | per minute |
| GitHub Actions (`.github/workflows/reminders.yml`) | free | 15 minutes, often 10-30 late |
| A third-party pinger | usually free | per minute |

The workflow in this repo is the free path. It needs a repository **secret**
`CRON_SECRET` matching Vercel's, and a repository **variable** `APP_URL` set to the
production domain. Two caveats worth knowing before relying on it: GitHub's scheduler
drifts under load, and on a public repository it is **silently disabled after 60 days
without repo activity**. If reminders stop for no reason, look at the Actions tab
first.


Turned on from Settings. The browser issues a subscription, the server stores it, and
a daily cron builds the same list the Today screen shows and pushes it.

Android Chrome supports this in an ordinary browser tab. iPhone needs the app added
to the home screen first, and iOS 16.4 or newer.

Three things have to be configured or nothing arrives:

- `NEXT_PUBLIC_VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` (`npx web-push generate-vapid-keys`)
- `CRON_SECRET`, or the daily job is refused. Without it the endpoint returns a message
  saying exactly that rather than a bare 401, because a silent no-op here means the
  notifications simply never arrive and nothing says why.
- The cron itself, declared in `vercel.json`. Vercel's Hobby plan allows one run per
  day and fires it anywhere inside the scheduled hour, so this is a morning digest
  rather than a per-lead alert.

**Settings has a "Send one now" button.** Notifications are the one feature you cannot
check by looking at the screen, and finding out tomorrow morning that the keys were
wrong is no way to find out.

## The AI reply helper

`POST /api/reply` reads the lead, the whole conversation and your store notes, and
returns strict JSON. The key never reaches the browser.

It is told never to invent a price, a discount, a delivery date or a stock level. When
the answer is not in your store notes it refuses and names the missing fact, and the
screen shows a **Needs you** banner instead of a suggestion. That refusal is the
feature: a made-up delivery date sent to a real customer is worse than no suggestion.

Without `ANTHROPIC_API_KEY` the button reports that the helper is off and everything
else works unchanged.

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

## The eight seeded leads are fake

Dana, Yossi, Marina, Avi, Tanya, Sarah, Eitan and Rami do not exist. They are there
so the Today screen has something to show on the first run, and they cover all six
stages so every part of the app is visible immediately.

Their phone numbers are all `+9720000000NN`. That is deliberate: a realistic-looking
Israeli mobile is somebody's real number, and one tap of Send on a demo lead would
open WhatsApp to a stranger. `0000` is not an allocated prefix, so wa.me refuses it.

When you are ready for real leads:

```bash
npm run db:clear -- --yes
```

That deletes every lead and its history, and keeps your settings and your 33 message
templates, which are configuration rather than demo data. It refuses to run without
`--yes`, and there is no undo, so export first from `/api/export/json` if you want a
copy.

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

### Pick a real passcode before going public

Locally the passcode barely matters: nothing outside your machine can reach the app.
On a public URL it is the only thing in front of the lead list, and **nothing rate
limits guesses**, which is a deliberate reading of "do not over-build this" rather
than an oversight. A four-digit code is 10,000 combinations and a script works
through that in minutes.

So the entropy has to come from the passcode itself. Something like
`milano-grey-sofa-77` is far stronger than `4821` and no harder to live with: the
field is a normal password input, so Safari offers to store it in the keychain and
autofills it with Face ID after the first time.

Use a different passcode in production from the one used in development.

### Deploying

Vercel, with the same environment variables set in the project. `SESSION_SECRET`
must be a real random value, and production should have its own rather than reusing
the development one:

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

**A lead just captured is due today.** The interval ladder describes the wait
*between* touches, so it cannot apply before the first one has gone out. Deriving a
new lead's date from the first interval put it on tomorrow, which dropped it off the
Today screen the instant it was saved and read, correctly, as the app having lost it.

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
