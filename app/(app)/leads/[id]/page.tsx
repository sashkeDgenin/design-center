import Link from "next/link";
import { notFound } from "next/navigation";
import { DatabaseNotReadyError, loadLead } from "@/lib/queries";
import { formatPhone } from "@/lib/phone";
import { STAGE_MEANINGS } from "@/lib/cadence";
import { Card, StageChip } from "@/components/ui";
import { Composer } from "@/components/composer";
import { ReplyBox } from "@/components/reply-box";
import { LeadFields } from "@/components/lead-fields";
import { Timeline } from "@/components/timeline";
import { SetupNeeded } from "@/components/setup-needed";

export const dynamic = "force-dynamic";

export default async function LeadPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ added?: string }>;
}) {
  const { id } = await params;
  const { added } = await searchParams;
  let detail: Awaited<ReturnType<typeof loadLead>>;
  try {
    detail = await loadLead(id);
  } catch (error) {
    if (error instanceof DatabaseNotReadyError) return <SetupNeeded detail={error.detail} />;
    throw error;
  }
  if (!detail) notFound();

  const { lead } = detail;

  return (
    <div className="space-y-5">
      <Link href="/" className="inline-block text-sm font-semibold text-ink-soft">
        &larr; Today
      </Link>

      {added ? (
        <p className="rounded-xl bg-whatsapp/10 px-3 py-2 text-sm font-medium text-whatsapp-dark">
          Lead saved and on today&rsquo;s list. Send the first message now, or find it
          on Today when you get a minute.
        </p>
      ) : null}

      <header>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight" dir="auto">
            {lead.name}
          </h1>
          <StageChip stage={lead.stage} />
        </div>
        <p className="mt-1 text-xs text-ink-soft">{STAGE_MEANINGS[lead.stage]}</p>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <a
            href={`tel:${lead.phone}`}
            className="font-mono text-sm font-semibold text-brand underline underline-offset-2"
          >
            {formatPhone(lead.phone)}
          </a>
          <span className="text-xs text-ink-faint">
            {lead.touchCount} touch{lead.touchCount === 1 ? "" : "es"} sent
            {detail.unanswered > 0 ? ` · ${detail.unanswered} unanswered` : ""}
          </span>
        </div>
      </header>

      <Composer detail={detail} />

      <ReplyBox leadId={lead.id} />

      <LeadFields detail={detail} />

      <Timeline items={detail.timeline} />
    </div>
  );
}
