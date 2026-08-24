import type { Language, Lead, Stage, Template } from "@/db/schema";

/**
 * Templates support {{name}}, {{interest}} and {{quoted_price}}. An unknown
 * placeholder is left alone rather than blanked, so a typo in a template is visible
 * in the composer instead of silently producing a hole in the message.
 */
export function renderTemplate(body: string, lead: Lead): string {
  const values: Record<string, string> = {
    name: lead.name,
    interest: lead.interest,
    quoted_price: lead.quotedPrice == null ? "" : `₪${lead.quotedPrice.toLocaleString("en-US")}`,
  };
  return body.replace(/\{\{\s*(\w+)\s*\}\}/g, (whole, key: string) =>
    key in values ? values[key] : whole,
  );
}

/**
 * Pick the template for this lead's next message.
 *
 * Falls back along two axes before giving up, because a missing template must never
 * be a dead end in the composer: first down the touch ladder (a 5th nudge reuses the
 * 4th template), then to Hebrew as the house language.
 */
export function pickTemplate(
  templates: Template[],
  stage: Stage,
  language: Language,
  touchNumber: number,
): Template | null {
  const forStage = templates.filter((t) => t.stage === stage);
  if (forStage.length === 0) return null;

  const byLanguage = (lang: Language) => forStage.filter((t) => t.language === lang);

  for (const lang of [language, "he" as Language, "en" as Language]) {
    const candidates = byLanguage(lang);
    if (candidates.length === 0) continue;
    const exact = candidates.find((t) => t.touchNumber === touchNumber);
    if (exact) return exact;
    // Highest template at or below the requested touch, else the lowest available.
    const below = candidates
      .filter((t) => t.touchNumber <= touchNumber)
      .sort((a, b) => b.touchNumber - a.touchNumber)[0];
    if (below) return below;
    return candidates.sort((a, b) => a.touchNumber - b.touchNumber)[0];
  }
  return null;
}
