"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { settings as settingsTable, templates as templatesTable, STAGES, LANGUAGES } from "@/db/schema";
import type { CadenceSettings, QuietHoursSettings, Stage } from "@/db/schema";
import { getSettings } from "./queries";
import type { ActionResult } from "./actions";

/** Settings live in one row; every writer upserts id 1 so the row cannot go missing. */
async function writeSettings(patch: Partial<{
  cadence: CadenceSettings;
  quietHours: QuietHoursSettings;
  knowledgeBase: string;
  uiDirection: string;
}>): Promise<void> {
  const db = getDb();
  const current = await getSettings();
  await db
    .insert(settingsTable)
    .values({
      id: 1,
      cadence: patch.cadence ?? current.cadence,
      quietHours: patch.quietHours ?? current.quietHours,
      knowledgeBase: patch.knowledgeBase ?? current.knowledgeBase,
      uiDirection: patch.uiDirection ?? current.uiDirection,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: settingsTable.id,
      set: { ...patch, updatedAt: new Date() },
    });
}

export async function saveTemplate(id: string, body: string): Promise<ActionResult> {
  if (!body.trim()) return { ok: false, error: "A template cannot be empty." };
  try {
    await getDb().update(templatesTable).set({ body }).where(eq(templatesTable.id, id));
    revalidatePath("/settings");
    revalidatePath("/");
    return { ok: true, message: "Template saved." };
  } catch (error) {
    return { ok: false, error: `Not saved: ${(error as Error).message}` };
  }
}

export async function addTemplate(formData: FormData): Promise<ActionResult> {
  const parsed = z
    .object({
      stage: z.enum(STAGES),
      language: z.enum(LANGUAGES),
      touchNumber: z.coerce.number().int().min(1).max(20),
      body: z.string().trim().min(1, "Write the message first."),
    })
    .safeParse(Object.fromEntries(formData.entries()));

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form." };
  }

  try {
    await getDb()
      .insert(templatesTable)
      .values(parsed.data)
      .onConflictDoUpdate({
        target: [templatesTable.stage, templatesTable.language, templatesTable.touchNumber],
        set: { body: parsed.data.body },
      });
    revalidatePath("/settings");
    return { ok: true, message: "Template added." };
  } catch (error) {
    return { ok: false, error: `Not saved: ${(error as Error).message}` };
  }
}

export async function deleteTemplate(id: string): Promise<ActionResult> {
  try {
    await getDb().delete(templatesTable).where(eq(templatesTable.id, id));
    revalidatePath("/settings");
    return { ok: true, message: "Template deleted." };
  } catch (error) {
    return { ok: false, error: `Not deleted: ${(error as Error).message}` };
  }
}

/**
 * Cadence intervals, entered as a comma-separated list of days per stage.
 *
 * A stage with no rule at all (poopy) stays null: it is the one stage that must
 * never schedule anything.
 */
export async function saveCadence(formData: FormData): Promise<ActionResult> {
  try {
    const current = await getSettings();
    const next: CadenceSettings = { ...current.cadence };

    for (const stage of STAGES) {
      const rule = current.cadence[stage];
      if (!rule) continue;

      const raw = String(formData.get(`${stage}.intervals`) ?? "").trim();
      const intervals = raw
        .split(",")
        .map((part) => Number(part.trim()))
        .filter((n) => Number.isFinite(n) && n >= 0);

      if (intervals.length === 0) {
        return { ok: false, error: `${stage}: give at least one number of days.` };
      }

      const maxRaw = String(formData.get(`${stage}.maxUnanswered`) ?? "").trim();
      const maxUnanswered = maxRaw === "" ? null : Number(maxRaw);
      if (maxUnanswered !== null && (!Number.isFinite(maxUnanswered) || maxUnanswered < 1)) {
        return { ok: false, error: `${stage}: give-up count must be a whole number, or blank.` };
      }

      next[stage as Stage] = { ...rule, intervals, maxUnanswered };
    }

    await writeSettings({ cadence: next });
    revalidatePath("/settings");
    revalidatePath("/");
    return { ok: true, message: "Follow-up timing saved." };
  } catch (error) {
    return { ok: false, error: `Not saved: ${(error as Error).message}` };
  }
}

export async function saveQuietHours(formData: FormData): Promise<ActionResult> {
  const parsed = z
    .object({
      startHour: z.coerce.number().int().min(0).max(23),
      endHour: z.coerce.number().int().min(1).max(24),
      restDay: z.coerce.number().int().min(-1).max(6),
      timezone: z.string().trim().min(1),
    })
    .safeParse(Object.fromEntries(formData.entries()));

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the values." };
  }
  if (parsed.data.startHour >= parsed.data.endHour) {
    return { ok: false, error: "The start of the day has to come before the end of it." };
  }

  try {
    await writeSettings({ quietHours: parsed.data });
    revalidatePath("/settings");
    revalidatePath("/");
    return { ok: true, message: "Quiet hours saved." };
  } catch (error) {
    return { ok: false, error: `Not saved: ${(error as Error).message}` };
  }
}

export async function saveKnowledgeBase(formData: FormData): Promise<ActionResult> {
  const body = String(formData.get("knowledgeBase") ?? "");
  try {
    await writeSettings({ knowledgeBase: body });
    revalidatePath("/settings");
    return { ok: true, message: "Store details saved. The AI reply helper reads these." };
  } catch (error) {
    return { ok: false, error: `Not saved: ${(error as Error).message}` };
  }
}

export async function saveDirection(direction: string): Promise<ActionResult> {
  try {
    await writeSettings({ uiDirection: direction === "rtl" ? "rtl" : "ltr" });
    revalidatePath("/", "layout");
    return { ok: true, message: direction === "rtl" ? "Right to left." : "Left to right." };
  } catch (error) {
    return { ok: false, error: `Not saved: ${(error as Error).message}` };
  }
}
