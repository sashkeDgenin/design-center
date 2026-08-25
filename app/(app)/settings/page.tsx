import Link from "next/link";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { pushSubscriptions } from "@/db/schema";
import { getSettings, getTemplates, DatabaseNotReadyError } from "@/lib/queries";
import { pushConfig } from "@/lib/push";
import { SetupNeeded } from "@/components/setup-needed";
import { NotificationsToggle } from "@/components/notifications-toggle";
import { CadenceEditor } from "@/components/settings/cadence-editor";
import { QuietHoursEditor } from "@/components/settings/quiet-hours-editor";
import { TemplateEditor } from "@/components/settings/template-editor";
import { KnowledgeBaseEditor } from "@/components/settings/knowledge-base-editor";
import { DirectionToggle } from "@/components/settings/direction-toggle";
import { Card } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  let settings, templates, devices;
  try {
    [settings, templates] = await Promise.all([getSettings(), getTemplates()]);
    devices = await getDb().select().from(pushSubscriptions);
  } catch (error) {
    if (error instanceof DatabaseNotReadyError) return <SetupNeeded detail={error.detail} />;
    throw error;
  }

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="mt-0.5 text-sm text-ink-soft">
          Everything here is stored in your database, not baked into the app.
        </p>
      </header>

      <NotificationsToggle publicKey={pushConfig()?.publicKey ?? null} />

      {devices.length > 0 ? (
        <Card className="px-3.5 py-3">
          <p className="text-xs font-semibold text-ink-soft">Subscribed devices</p>
          <ul className="mt-1 space-y-0.5">
            {devices.map((d) => (
              <li key={d.id} className="text-sm">
                {d.label || "Unknown device"}
                <span className="ms-1 text-[11px] text-ink-faint">
                  {d.lastSentAt ? `· last sent ${d.lastSentAt.toLocaleDateString("en-GB")}` : "· nothing sent yet"}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <TemplateEditor templates={templates} />
      <CadenceEditor cadence={settings.cadence} />
      <QuietHoursEditor quietHours={settings.quietHours} />
      <KnowledgeBaseEditor value={settings.knowledgeBase} />
      <DirectionToggle current={settings.uiDirection} />

      <Card className="p-3.5">
        <h2 className="text-sm font-bold">Your data</h2>
        <p className="mt-1 text-xs text-ink-soft">
          Everything, in formats nothing can lock you out of.
        </p>
        <div className="mt-3 flex gap-2">
          <a
            href="/api/export/json"
            className="tap flex-1 rounded-xl border border-ink bg-card px-3 py-2.5 text-center text-sm font-semibold"
          >
            Export JSON
          </a>
          <a
            href="/api/export/csv"
            className="tap flex-1 rounded-xl border border-ink bg-card px-3 py-2.5 text-center text-sm font-semibold"
          >
            Export CSV
          </a>
        </div>
      </Card>

      <p className="pb-2 text-center text-xs text-ink-faint">
        <Link href="/" className="underline">
          Back to Today
        </Link>
      </p>
    </div>
  );
}
