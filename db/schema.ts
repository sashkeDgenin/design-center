import {
  boolean,
  date,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * The exact stage set from the spec. Do not add stages: the cadence engine, the
 * Today screen ordering and the seeded templates all key off precisely these six.
 *
 * `photos_in` is deliberately split out from `awaiting_photos` because that gap is
 * where leads die: photos arrived and the ball is in my court.
 */
export const STAGES = [
  "nudge",
  "awaiting_photos",
  "photos_in",
  "schedule_meeting",
  "get_back_later",
  "poopy",
] as const;
export type Stage = (typeof STAGES)[number];

export const SOURCES = [
  "walkout",
  "phone_tradein",
  "phone_website",
  "walkin",
  "other",
] as const;
export type Source = (typeof SOURCES)[number];

export const LANGUAGES = ["he", "ru", "en"] as const;
export type Language = (typeof LANGUAGES)[number];

export const DIRECTIONS = ["out", "in"] as const;
export const CHANNELS = ["whatsapp", "phone", "in_store"] as const;

export const stageEnum = pgEnum("stage", STAGES);
export const sourceEnum = pgEnum("source", SOURCES);
export const languageEnum = pgEnum("language", LANGUAGES);
export const directionEnum = pgEnum("direction", DIRECTIONS);
export const channelEnum = pgEnum("channel", CHANNELS);

export const leads = pgTable("leads", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  /** Normalized E.164, e.g. +9725XXXXXXXX. This is what wa.me links are built from. */
  phone: text("phone").notNull(),
  /** Exactly what was typed, kept so a bad normalization is never a lost phone number. */
  phoneRaw: text("phone_raw").notNull(),
  stage: stageEnum("stage").notNull().default("nudge"),
  source: sourceEnum("source").notNull().default("walkout"),
  language: languageEnum("language").notNull().default("he"),
  interest: text("interest").notNull().default(""),
  /** ILS. Nullable: most leads walk out before a price is ever quoted. */
  quotedPrice: integer("quoted_price"),
  objection: text("objection").notNull().default(""),
  notes: text("notes").notNull().default(""),
  /**
   * The engine of the whole app. A plain calendar date, not a timestamp, because
   * "due today" is a question about the Asia/Jerusalem calendar, not about an instant.
   * Null means no reminder is scheduled (only `poopy` leads should sit like that).
   */
  nextTouchAt: date("next_touch_at"),
  /**
   * The exact moment to buzz the phone about this lead, when a time was chosen.
   *
   * Separate from `next_touch_at`, which stays a plain date and drives the Today
   * screen. Null means "no alarm": the lead still appears on Today on its date and
   * still shows up in the morning digest, it just does not interrupt anything.
   */
  remindAt: timestamp("remind_at", { withTimezone: true }),
  /** Set when the reminder has been pushed, so it fires once and not every sweep. */
  remindedAt: timestamp("reminded_at", { withTimezone: true }),
  lastContactAt: timestamp("last_contact_at", { withTimezone: true }),
  touchCount: integer("touch_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  archived: boolean("archived").notNull().default(false),
});

export const interactions = pgTable("interactions", {
  id: uuid("id").defaultRandom().primaryKey(),
  leadId: uuid("lead_id")
    .notNull()
    .references(() => leads.id, { onDelete: "cascade" }),
  direction: directionEnum("direction").notNull(),
  channel: channelEnum("channel").notNull().default("whatsapp"),
  body: text("body").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const templates = pgTable(
  "templates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    stage: stageEnum("stage").notNull(),
    language: languageEnum("language").notNull(),
    /** 1 = first follow-up, 2 = second, and so on. */
    touchNumber: integer("touch_number").notNull(),
    /** Supports {{name}}, {{interest}} and {{quoted_price}}. */
    body: text("body").notNull(),
  },
  (t) => [uniqueIndex("templates_slot_idx").on(t.stage, t.language, t.touchNumber)],
);

/**
 * Exactly one row, id = 1. Cadence intervals, quiet hours and the knowledge base
 * live here rather than in source so the Settings screen can edit them without a
 * deploy. The spec is explicit that none of this may be hardcoded.
 */
export const settings = pgTable("settings", {
  id: integer("id").primaryKey().default(1),
  cadence: jsonb("cadence").$type<CadenceSettings>().notNull(),
  quietHours: jsonb("quiet_hours").$type<QuietHoursSettings>().notNull(),
  knowledgeBase: text("knowledge_base").notNull().default(""),
  /** UI writing direction. Message bodies always use dir="auto" regardless. */
  uiDirection: text("ui_direction").notNull().default("ltr"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * One row per browser that agreed to receive notifications.
 *
 * A push subscription is issued by the browser's own push service and belongs to
 * that browser on that device, so switching phones or clearing site data produces a
 * new one rather than updating the old. Dead ones are deleted when the push service
 * reports them gone (HTTP 404 or 410).
 */
export const pushSubscriptions = pgTable("push_subscriptions", {
  id: uuid("id").defaultRandom().primaryKey(),
  /** The push service URL. Unique per browser install, so it is the natural key. */
  endpoint: text("endpoint").notNull().unique(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  /** Free text from the browser, only so a device is recognisable in Settings. */
  label: text("label").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastSentAt: timestamp("last_sent_at", { withTimezone: true }),
});

export type StageCadence = {
  /**
   * Days to wait after each unanswered outbound touch. intervals[0] applies after
   * the first touch, intervals[1] after the second, and so on. Once the ladder is
   * exhausted the last value repeats until `maxUnanswered` trips.
   */
  intervals: number[];
  /**
   * How many unanswered touches this stage tolerates before the lead is moved on
   * automatically. Null means never auto-move. Nothing ever auto-moves to `poopy`:
   * that call is mine alone.
   */
  maxUnanswered: number | null;
  exhaustedStage: Stage | null;
  exhaustedInterval: number | null;
};

export type CadenceSettings = Record<Stage, StageCadence | null>;

export type QuietHoursSettings = {
  timezone: string;
  /** Nothing is surfaced before this hour, local time. */
  startHour: number;
  /** Nothing is surfaced from this hour onward, local time. */
  endHour: number;
  /** 0 = Sunday ... 6 = Saturday. Due dates that land here roll forward a day. */
  restDay: number;
};

export type Lead = typeof leads.$inferSelect;
export type NewLead = typeof leads.$inferInsert;
export type Interaction = typeof interactions.$inferSelect;
export type Template = typeof templates.$inferSelect;
export type Settings = typeof settings.$inferSelect;
export type PushSubscription = typeof pushSubscriptions.$inferSelect;
