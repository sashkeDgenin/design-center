import type { Interaction } from "@/db/schema";
import { Card } from "./ui";

const CHANNEL_LABELS: Record<string, string> = {
  whatsapp: "WhatsApp",
  phone: "Phone",
  in_store: "In store",
};

function stamp(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

/** Chat-style, newest at the bottom, mine on one side and theirs on the other. */
export function Timeline({ items }: { items: Interaction[] }) {
  return (
    <Card className="p-3.5">
      <h2 className="mb-3 text-sm font-bold">History</h2>
      {items.length === 0 ? (
        <p className="py-4 text-center text-sm text-ink-soft">
          Nothing logged yet. The first message you send will show up here.
        </p>
      ) : (
        <ol className="space-y-2.5">
          {items.map((item) => {
            const mine = item.direction === "out";
            return (
              <li key={item.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] ${mine ? "items-end" : "items-start"} flex flex-col`}>
                  <div
                    dir="auto"
                    className={`whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                      mine
                        ? "rounded-ee-sm bg-whatsapp/12 text-ink"
                        : "rounded-es-sm bg-page text-ink ring-1 ring-line"
                    }`}
                  >
                    {item.body}
                  </div>
                  <span className="mt-0.5 px-1 text-[10px] text-ink-faint">
                    {mine ? "Me" : "Them"} · {CHANNEL_LABELS[item.channel] ?? item.channel} ·{" "}
                    {stamp(item.createdAt)}
                  </span>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </Card>
  );
}
