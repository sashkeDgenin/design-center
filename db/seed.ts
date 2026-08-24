import "dotenv/config";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { DEFAULT_CADENCE, DEFAULT_QUIET_HOURS, KNOWLEDGE_BASE_SEED } from "./defaults";
import { interactions, leads, settings, templates } from "./schema";
import type { Language, Source, Stage } from "./schema";
import { TEMPLATE_SEEDS } from "./seed-templates";

const TZ = DEFAULT_QUIET_HOURS.timezone;

function today(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function shift(days: number): string {
  const [y, m, d] = today().split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d, 12) + days * 86_400_000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${t.getUTCFullYear()}-${p(t.getUTCMonth() + 1)}-${p(t.getUTCDate())}`;
}

function hoursAgo(h: number): Date {
  return new Date(Date.now() - h * 3_600_000);
}

type SeedLead = {
  name: string;
  phoneRaw: string;
  phone: string;
  stage: Stage;
  source: Source;
  language: Language;
  interest: string;
  quotedPrice: number | null;
  objection: string;
  notes: string;
  nextTouchAt: string | null;
  lastContactAt: Date | null;
  touchCount: number;
  log: { direction: "out" | "in"; channel: "whatsapp" | "phone" | "in_store"; body: string; hoursAgo: number }[];
};

/**
 * Eight leads spread across all six stages, so the app looks like a working day the
 * first time it opens. Dates are relative to today, which keeps the seed useful no
 * matter when it is run.
 */
const SEED_LEADS: SeedLead[] = [
  {
    name: "Dana", phoneRaw: "054-231-8890", phone: "+972542318890",
    stage: "nudge", source: "walkout", language: "he",
    interest: "3-seat Milano, grey fabric", quotedPrice: 8900,
    objection: "Wants to measure the living room wall first",
    notes: "Came in with her sister. Loved the Milano, worried it is too wide for the alcove.",
    nextTouchAt: shift(-2), lastContactAt: hoursAgo(72), touchCount: 1,
    log: [
      { direction: "in", channel: "in_store", body: "Walked in around 17:30, spent 20 minutes on the Milano. Took a photo of the tag.", hoursAgo: 96 },
      { direction: "out", channel: "whatsapp", body: "היי דנה, נעים היה להכיר היום 🙂 ה3-seat Milano, grey fabric שהסתכלת עליו עדיין אצלנו. רוצה שאשמור לך אותו?", hoursAgo: 72 },
    ],
  },
  {
    name: "Yossi", phoneRaw: "0503117742", phone: "+972503117742",
    stage: "nudge", source: "walkout", language: "he",
    interest: "Recliner armchair, brown leather", quotedPrice: 4200,
    objection: "Price. Said he saw something similar cheaper online.",
    notes: "Knows exactly what he wants. Will move on price comparison, not on style.",
    nextTouchAt: today(), lastContactAt: hoursAgo(96), touchCount: 2,
    log: [
      { direction: "out", channel: "whatsapp", body: "היי יוסי, נעים היה להכיר היום 🙂 הRecliner armchair, brown leather שהסתכלת עליו עדיין אצלנו. רוצה שאשמור לך אותו?", hoursAgo: 168 },
      { direction: "out", channel: "whatsapp", body: "היי יוסי, רק מוודא שלא פספסתי אותך. יש לי עוד כמה אפשרויות בRecliner armchair, brown leather שלא הספקנו לראות. שווה קפיצה קצרה לחנות?", hoursAgo: 96 },
    ],
  },
  {
    name: "Marina", phoneRaw: "+972 52 884 1200", phone: "+972528841200",
    stage: "awaiting_photos", source: "phone_tradein", language: "ru",
    interest: "Trade-in against a corner sofa", quotedPrice: null,
    objection: "",
    notes: "Called about the trade-in offer. Old sofa is a 6-year-old corner unit, fabric.",
    nextTouchAt: shift(-1), lastContactAt: hoursAgo(48), touchCount: 1,
    log: [
      { direction: "in", channel: "phone", body: "Called asking whether the trade-in applies to a corner sofa. Told her yes, asked for photos.", hoursAgo: 50 },
      { direction: "out", channel: "whatsapp", body: "Marina, напоминаю: пришлите, пожалуйста, фото старого дивана. Достаточно 2-3 снимков с разных сторон, и я вернусь с оценкой.", hoursAgo: 48 },
    ],
  },
  {
    name: "Avi", phoneRaw: "052-770-3391", phone: "+972527703391",
    stage: "photos_in", source: "phone_tradein", language: "he",
    interest: "Trade-in, 5-year-old 3-seater", quotedPrice: null,
    objection: "",
    notes: "Photos look clean, minor wear on the left arm. Needs a number from me.",
    nextTouchAt: today(), lastContactAt: hoursAgo(20), touchCount: 2,
    log: [
      { direction: "out", channel: "whatsapp", body: "היי אבי, תזכורת קטנה: אפשר תמונות של הספה הישנה?", hoursAgo: 72 },
      { direction: "out", channel: "whatsapp", body: "היי אבי, התמונות עוד לא הגיעו. ברגע שהן אצלי אני נותן לך מחיר טרייד-אין תוך יום.", hoursAgo: 44 },
      { direction: "in", channel: "whatsapp", body: "שלחתי 4 תמונות. מחכה למחיר 🙏", hoursAgo: 20 },
    ],
  },
  {
    name: "Tanya", phoneRaw: "0587764410", phone: "+972587764410",
    stage: "photos_in", source: "phone_tradein", language: "ru",
    interest: "Trade-in, leather 2-seater plus armchair", quotedPrice: null,
    objection: "",
    notes: "Leather is cracked on the seat cushions. Valuation will be low, prepare her for it.",
    nextTouchAt: today(), lastContactAt: hoursAgo(6), touchCount: 1,
    log: [
      { direction: "out", channel: "whatsapp", body: "Tanya, напоминаю: пришлите, пожалуйста, фото старого дивана.", hoursAgo: 30 },
      { direction: "in", channel: "whatsapp", body: "Отправила фото дивана и кресла. Сколько дадите?", hoursAgo: 6 },
    ],
  },
  {
    name: "Sarah", phoneRaw: "+972 54 990 2277", phone: "+972549902277",
    stage: "schedule_meeting", source: "phone_website", language: "en",
    interest: "Sectional plus ottoman, cream", quotedPrice: 12400,
    objection: "",
    notes: "Found us through the website. Wants to see the cream in daylight before deciding.",
    nextTouchAt: today(), lastContactAt: hoursAgo(26), touchCount: 1,
    log: [
      { direction: "in", channel: "phone", body: "Enquired through the website form, called her back. Interested in the cream sectional.", hoursAgo: 52 },
      { direction: "out", channel: "whatsapp", body: "Hi Sarah, let's set a time for you to come into the store and see it in person. What works for you this week?", hoursAgo: 26 },
      { direction: "in", channel: "whatsapp", body: "Thursday could work but I need to check with my husband, will confirm.", hoursAgo: 24 },
    ],
  },
  {
    name: "Eitan", phoneRaw: "053-448-1109", phone: "+972534481109",
    stage: "get_back_later", source: "walkin", language: "he",
    interest: "Dining set, 6 chairs, oak", quotedPrice: 6300,
    objection: "Moving apartment in March, nowhere to put it until then",
    notes: "Genuinely wants it, genuinely cannot take delivery yet. Do not chase before March.",
    nextTouchAt: shift(47), lastContactAt: hoursAgo(240), touchCount: 1,
    log: [
      { direction: "out", channel: "whatsapp", body: "היי איתן, עבר קצת זמן מאז שדיברנו על הDining set, 6 chairs, oak. העיתוי מסתדר יותר טוב עכשיו?", hoursAgo: 240 },
      { direction: "in", channel: "whatsapp", body: "עדיין רוצה, אבל אנחנו עוברים דירה במרץ. תחזור אליי אחרי זה?", hoursAgo: 236 },
    ],
  },
  {
    name: "Rami", phoneRaw: "050-661-0043", phone: "+972506610043",
    stage: "poopy", source: "walkout", language: "he",
    interest: "Queen bed frame", quotedPrice: 3100,
    objection: "Bought elsewhere",
    notes: "Bought the same frame down the road for less. Nothing to chase, keeping the record.",
    nextTouchAt: null, lastContactAt: hoursAgo(500), touchCount: 1,
    log: [
      { direction: "out", channel: "whatsapp", body: "היי רמי, הQueen bed frame שהסתכלת עליו עדיין אצלנו. רוצה שאשמור לך אותו?", hoursAgo: 504 },
      { direction: "in", channel: "whatsapp", body: "תודה, כבר קניתי במקום אחר.", hoursAgo: 500 },
    ],
  },
];

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set. Copy .env.example to .env.");

  const pool = new Pool({ connectionString: url });
  const db = drizzle(pool);
  const reset = process.argv.includes("--reset");

  try {
    if (reset) {
      // interactions cascade from leads
      await db.execute(sql`truncate table ${interactions}, ${leads}, ${templates}, ${settings} cascade`);
      console.log("cleared existing rows");
    }

    const existing = await db.select({ id: settings.id }).from(settings).limit(1);
    if (existing.length === 0) {
      await db.insert(settings).values({
        id: 1,
        cadence: DEFAULT_CADENCE,
        quietHours: DEFAULT_QUIET_HOURS,
        knowledgeBase: KNOWLEDGE_BASE_SEED,
        uiDirection: "ltr",
      });
      console.log("settings row created");
    } else {
      console.log("settings row already present, left alone");
    }

    const templateCount = await db.select({ id: templates.id }).from(templates).limit(1);
    if (templateCount.length === 0) {
      await db.insert(templates).values(TEMPLATE_SEEDS);
      console.log(`${TEMPLATE_SEEDS.length} templates inserted`);
    } else {
      console.log("templates already present, left alone");
    }

    const leadCount = await db.select({ id: leads.id }).from(leads).limit(1);
    if (leadCount.length > 0) {
      console.log("leads already present, left alone (use --reset to start over)");
      return;
    }

    for (const seed of SEED_LEADS) {
      const { log, ...lead } = seed;
      const [row] = await db.insert(leads).values(lead).returning({ id: leads.id });
      if (log.length > 0) {
        await db.insert(interactions).values(
          log.map((entry) => ({
            leadId: row.id,
            direction: entry.direction,
            channel: entry.channel,
            body: entry.body,
            createdAt: hoursAgo(entry.hoursAgo),
          })),
        );
      }
    }
    console.log(`${SEED_LEADS.length} leads inserted across all six stages`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
