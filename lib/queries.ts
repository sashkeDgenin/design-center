import { cache } from "react";
import { and, asc, desc, eq, inArray, ne } from "drizzle-orm";
import { getDb } from "@/db";
import { DEFAULT_CADENCE, DEFAULT_QUIET_HOURS, KNOWLEDGE_BASE_SEED } from "@/db/defaults";
import {
  interactions,
  leads,
  settings as settingsTable,
  templates as templatesTable,
} from "@/db/schema";
import type { Interaction, Lead, Settings, Template } from "@/db/schema";
import { shouldAutoMove, today as todayFor, unansweredTouches } from "./cadence";
import { pickTemplate, renderTemplate } from "./templates";
import { waLink } from "./phone";
import { isQuietNow, type IsoDate } from "./time";

/**
 * Thrown when the database is reachable but has no tables yet: a fresh Neon project
 * that has never been migrated. This is the single most likely first-run failure, and
 * the raw Postgres error ("relation \"templates\" does not exist") tells a user
 * nothing about what to do, so it is caught and turned into instructions instead.
 */
export class DatabaseNotReadyError extends Error {
  constructor(readonly detail: string) {
    super("The database has no tables yet.");
    this.name = "DatabaseNotReadyError";
  }
}

/**
 * Postgres 42P01, undefined_table.
 *
 * Drizzle wraps driver errors, so the outer error says only "Failed query: select ..."
 * and the 42P01 sits on its `cause`. The chain is walked rather than the top level
 * inspected, which is the difference between catching this and not.
 */
function isMissingTable(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; current != null && depth < 5; depth += 1) {
    if ((current as { code?: string }).code === "42P01") return true;
    if (current instanceof Error && /relation ".+" does not exist/i.test(current.message)) {
      return true;
    }
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}

/** Runs a query, converting "no tables" into something the UI can act on. */
async function needingTables<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (isMissingTable(error)) {
      throw new DatabaseNotReadyError(
        error instanceof Error ? error.message : String(error),
      );
    }
    throw error;
  }
}

export type ResolvedSettings = Pick<
  Settings,
  "cadence" | "quietHours" | "knowledgeBase" | "uiDirection"
>;

const FALLBACK_SETTINGS: ResolvedSettings = {
  cadence: DEFAULT_CADENCE,
  quietHours: DEFAULT_QUIET_HOURS,
  knowledgeBase: KNOWLEDGE_BASE_SEED,
  uiDirection: "ltr",
};

/**
 * Settings come from the database, never from source. Falling back to the defaults
 * when the row is missing keeps the app usable before the first seed, and keeps a
 * database blip off the login screen.
 */
export const getSettings = cache(async (): Promise<ResolvedSettings> => {
  try {
    const [row] = await getDb().select().from(settingsTable).limit(1);
    return row ?? FALLBACK_SETTINGS;
  } catch {
    return FALLBACK_SETTINGS;
  }
});

export const getTemplates = cache(async (): Promise<Template[]> => {
  return needingTables(() =>
    getDb().select().from(templatesTable).orderBy(asc(templatesTable.touchNumber)),
  );
});

/** The message that would be sent next, already rendered and ready to open. */
export type Draft = {
  body: string;
  link: string;
  touchNumber: number;
  hasTemplate: boolean;
};

export function draftFor(
  lead: Lead,
  allTemplates: Template[],
  unanswered: number,
): Draft {
  const touchNumber = unanswered + 1;
  const template = pickTemplate(allTemplates, lead.stage, lead.language, touchNumber);
  const body = template ? renderTemplate(template.body, lead) : "";
  return {
    body,
    link: waLink(lead.phone, body),
    touchNumber,
    hasTemplate: template !== null,
  };
}

export type LeadCard = {
  lead: Lead;
  unanswered: number;
  draft: Draft;
  lastInboundAt: Date | null;
};

export type TodayBoard = {
  today: IsoDate;
  quiet: ReturnType<typeof isQuietNow>;
  timezone: string;
  blocked: LeadCard[];
  overdue: LeadCard[];
  due: LeadCard[];
  /** Everything not archived and not poopy. */
  activeCount: number;
  /** Active leads scheduled beyond today. */
  upcomingCount: number;
  nextUpAt: IsoDate | null;
  autoMoved: { name: string; reason: string }[];
};

async function interactionsByLead(leadIds: string[]): Promise<Map<string, Interaction[]>> {
  const map = new Map<string, Interaction[]>();
  if (leadIds.length === 0) return map;
  const rows = await getDb()
    .select()
    .from(interactions)
    .where(inArray(interactions.leadId, leadIds))
    .orderBy(asc(interactions.createdAt));
  for (const row of rows) {
    const list = map.get(row.leadId) ?? [];
    list.push(row);
    map.set(row.leadId, list);
  }
  return map;
}

/**
 * Builds the Today screen.
 *
 * Reconciling exhausted leads happens here, at read time, rather than in a cron job.
 * A lead that has run out its ladder is moved the moment it next comes due, and a
 * lead that replied in the meantime is never moved at all.
 */
export async function loadToday(): Promise<TodayBoard> {
  const db = getDb();
  const settings = await getSettings();
  const allTemplates = await getTemplates();
  const today = todayFor(settings.quietHours);

  const active = await needingTables(() =>
    db
      .select()
      .from(leads)
      .where(and(eq(leads.archived, false), ne(leads.stage, "poopy")))
      .orderBy(asc(leads.nextTouchAt)),
  );

  const logs = await interactionsByLead(active.map((l) => l.id));

  const autoMoved: { name: string; reason: string }[] = [];
  const reconciled: Lead[] = [];

  for (const lead of active) {
    const unanswered = unansweredTouches(logs.get(lead.id) ?? []);
    const move = shouldAutoMove(lead, unanswered, settings.cadence, today);
    if (!move) {
      reconciled.push(lead);
      continue;
    }
    const [updated] = await db
      .update(leads)
      .set({ stage: move.stage, nextTouchAt: move.nextTouchAt })
      .where(eq(leads.id, lead.id))
      .returning();
    autoMoved.push({ name: lead.name, reason: move.reason });
    reconciled.push(updated);
  }

  const card = (lead: Lead): LeadCard => {
    const log = logs.get(lead.id) ?? [];
    const unanswered = unansweredTouches(log);
    const lastInbound = [...log].reverse().find((i) => i.direction === "in");
    return {
      lead,
      unanswered,
      draft: draftFor(lead, allTemplates, unanswered),
      lastInboundAt: lastInbound?.createdAt ?? null,
    };
  };

  const blocked = reconciled.filter((l) => l.stage === "photos_in").map(card);
  const rest = reconciled.filter((l) => l.stage !== "photos_in");

  const overdue = rest
    .filter((l) => l.nextTouchAt !== null && l.nextTouchAt < today)
    .map(card);
  const due = rest.filter((l) => l.nextTouchAt === today).map(card);
  const upcoming = rest.filter((l) => l.nextTouchAt !== null && l.nextTouchAt > today);

  return {
    today,
    quiet: isQuietNow(settings.quietHours),
    timezone: settings.quietHours.timezone,
    blocked,
    overdue,
    due,
    activeCount: reconciled.length,
    upcomingCount: upcoming.length,
    nextUpAt: upcoming.map((l) => l.nextTouchAt!).sort()[0] ?? null,
    autoMoved,
  };
}

export type LeadDetail = LeadCard & {
  timeline: Interaction[];
  today: IsoDate;
  timezone: string;
  templatesForStage: Template[];
};

export async function loadLead(id: string): Promise<LeadDetail | null> {
  const db = getDb();
  const settings = await getSettings();
  const allTemplates = await getTemplates();

  const [lead] = await needingTables(() =>
    db.select().from(leads).where(eq(leads.id, id)).limit(1),
  );
  if (!lead) return null;

  const timeline = await db
    .select()
    .from(interactions)
    .where(eq(interactions.leadId, id))
    .orderBy(asc(interactions.createdAt));

  const unanswered = unansweredTouches(timeline);
  const lastInbound = [...timeline].reverse().find((i) => i.direction === "in");

  return {
    lead,
    unanswered,
    draft: draftFor(lead, allTemplates, unanswered),
    lastInboundAt: lastInbound?.createdAt ?? null,
    timeline,
    today: todayFor(settings.quietHours),
    timezone: settings.quietHours.timezone,
    templatesForStage: allTemplates.filter((t) => t.stage === lead.stage),
  };
}

/** Everything, for the export routes. Poopy and archived leads included: it is my data. */
export async function loadEverything() {
  const db = getDb();
  const [allLeads, allInteractions, allTemplates, [settingsRow]] = await Promise.all([
    db.select().from(leads).orderBy(desc(leads.createdAt)),
    db.select().from(interactions).orderBy(asc(interactions.createdAt)),
    db.select().from(templatesTable),
    db.select().from(settingsTable).limit(1),
  ]);
  return { leads: allLeads, interactions: allInteractions, templates: allTemplates, settings: settingsRow ?? null };
}
