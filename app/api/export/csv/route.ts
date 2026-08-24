import { loadEverything } from "@/lib/queries";

export const dynamic = "force-dynamic";

function cell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text = value instanceof Date ? value.toISOString() : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

const COLUMNS = [
  "id", "name", "phone", "phone_raw", "stage", "source", "language", "interest",
  "quoted_price", "objection", "notes", "next_touch_at", "last_contact_at",
  "touch_count", "created_at", "archived", "interactions_out", "interactions_in",
] as const;

export async function GET() {
  const { leads, interactions } = await loadEverything();

  const counts = new Map<string, { out: number; in: number }>();
  for (const i of interactions) {
    const c = counts.get(i.leadId) ?? { out: 0, in: 0 };
    c[i.direction] += 1;
    counts.set(i.leadId, c);
  }

  const rows = leads.map((l) => {
    const c = counts.get(l.id) ?? { out: 0, in: 0 };
    return [
      l.id, l.name, l.phone, l.phoneRaw, l.stage, l.source, l.language, l.interest,
      l.quotedPrice, l.objection, l.notes, l.nextTouchAt, l.lastContactAt,
      l.touchCount, l.createdAt, l.archived, c.out, c.in,
    ].map(cell).join(",");
  });

  // BOM so Hebrew and Russian survive a double-click into Excel.
  const body = `﻿${COLUMNS.join(",")}\n${rows.join("\n")}\n`;
  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(body, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="leaddesk-leads-${stamp}.csv"`,
    },
  });
}
