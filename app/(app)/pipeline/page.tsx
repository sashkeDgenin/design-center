import Link from "next/link";
import { and, asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { leads, STAGES } from "@/db/schema";
import type { Lead, Stage } from "@/db/schema";
import { DatabaseNotReadyError, getSettings } from "@/lib/queries";
import { STAGE_LABELS, STAGE_MEANINGS, today as todayFor } from "@/lib/cadence";
import { SetupNeeded } from "@/components/setup-needed";
import { PipelineColumn } from "@/components/pipeline-column";

export const dynamic = "force-dynamic";

/**
 * The whole book, by stage.
 *
 * Read-mostly on purpose: Today is where the work happens. This is for the weekly
 * "where is everything" look, and for moving something that has changed state.
 */
export default async function PipelinePage() {
  let all: Lead[];
  let today: string;
  try {
    const settings = await getSettings();
    today = todayFor(settings.quietHours);
    all = await getDb()
      .select()
      .from(leads)
      .where(eq(leads.archived, false))
      .orderBy(asc(leads.nextTouchAt));
  } catch (error) {
    if (error instanceof DatabaseNotReadyError) return <SetupNeeded detail={error.detail} />;
    throw error;
  }

  const byStage = new Map<Stage, Lead[]>();
  for (const stage of STAGES) byStage.set(stage, []);
  for (const lead of all) byStage.get(lead.stage)?.push(lead);

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Pipeline</h1>
        <p className="mt-0.5 text-sm text-ink-soft">
          {all.length} lead{all.length === 1 ? "" : "s"} in the book. Move one by picking a
          new stage; the next follow-up date is worked out for you.
        </p>
      </header>

      {all.length === 0 ? (
        <div className="rounded-[14px] border border-line bg-card px-5 py-8 text-center shadow-sm">
          <p className="text-base font-semibold">Nothing in the pipeline yet.</p>
          <p className="mx-auto mt-1 max-w-[34ch] text-sm text-ink-soft">
            Every lead you add shows up here, sorted by where it has got to.
          </p>
          <Link
            href="/leads/new"
            className="tap mt-4 inline-flex items-center justify-center rounded-xl bg-ink px-5 py-2.5 text-sm font-semibold text-white"
          >
            Add the first one
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {STAGES.map((stage) => (
            <PipelineColumn
              key={stage}
              stage={stage}
              label={STAGE_LABELS[stage]}
              meaning={STAGE_MEANINGS[stage]}
              leads={byStage.get(stage) ?? []}
              today={today}
            />
          ))}
        </div>
      )}
    </div>
  );
}
