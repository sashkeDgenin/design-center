import Link from "next/link";
import type { Stage } from "@/db/schema";
import { STAGE_LABELS } from "@/lib/cadence";

const STAGE_STYLES: Record<Stage, string> = {
  nudge: "bg-blue-50 text-blue-700 ring-blue-200",
  awaiting_photos: "bg-overdue-bg text-overdue ring-amber-200",
  photos_in: "bg-blocked text-white ring-blocked",
  schedule_meeting: "bg-violet-50 text-violet-700 ring-violet-200",
  get_back_later: "bg-slate-100 text-slate-600 ring-slate-200",
  poopy: "bg-stone-100 text-stone-500 ring-stone-200",
};

export function StageChip({ stage, className = "" }: { stage: Stage; className?: string }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${STAGE_STYLES[stage]} ${className}`}
    >
      {STAGE_LABELS[stage]}
    </span>
  );
}

export function Card({
  children,
  className = "",
  tone = "plain",
}: {
  children: React.ReactNode;
  className?: string;
  tone?: "plain" | "blocked" | "overdue";
}) {
  const tones = {
    plain: "border-line bg-card",
    blocked: "border-blocked/30 bg-blocked-bg",
    overdue: "border-amber-200 bg-overdue-bg",
  };
  return (
    <div
      className={`rounded-[14px] border shadow-[var(--shadow-card)] ${tones[tone]} ${className}`}
    >
      {children}
    </div>
  );
}

export function SectionHeading({
  title,
  count,
  hint,
  tone = "plain",
}: {
  title: string;
  count: number;
  hint?: string;
  tone?: "plain" | "blocked" | "overdue";
}) {
  const dot = {
    plain: "bg-ink-faint",
    blocked: "bg-blocked",
    overdue: "bg-overdue",
  }[tone];
  return (
    <div className="mb-2 flex items-baseline gap-2 px-1">
      <span className={`h-2 w-2 shrink-0 rounded-full ${dot}`} aria-hidden />
      <h2 className="text-sm font-bold tracking-tight">{title}</h2>
      <span className="text-sm font-medium text-ink-faint">{count}</span>
      {hint ? <span className="ms-auto text-[11px] text-ink-faint">{hint}</span> : null}
    </div>
  );
}

/**
 * No dead ends: every empty state names the next action rather than showing an empty
 * container.
 */
export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: { href: string; label: string };
}) {
  return (
    <Card className="px-5 py-10 text-center">
      <p className="text-base font-semibold">{title}</p>
      {/* ltr for the same bidi reason as the Today footer: English copy, leading digits. */}
      <p dir="ltr" className="mx-auto mt-1 max-w-[34ch] text-sm text-ink-soft">
        {body}
      </p>
      {action ? (
        <Link
          href={action.href}
          className="tap mt-4 inline-flex items-center justify-center rounded-xl bg-ink px-5 py-2.5 text-sm font-semibold text-white"
        >
          {action.label}
        </Link>
      ) : null}
    </Card>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-ink-soft">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-[11px] text-ink-faint">{hint}</span> : null}
    </label>
  );
}

export const inputClass =
  "tap w-full rounded-xl border border-line bg-card px-3 py-2.5 shadow-sm";
