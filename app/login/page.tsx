import { PasscodeForm } from "@/components/passcode-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return (
    <main className="safe-top safe-bottom flex min-h-dvh flex-col justify-center px-6">
      <div className="mx-auto w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 h-14 w-14 rounded-[14px] bg-ink p-3">
            <div className="space-y-1.5">
              <div className="h-1.5 w-full rounded-sm bg-blocked" />
              <div className="h-1.5 w-4/5 rounded-sm bg-white/80" />
              <div className="h-1.5 w-3/5 rounded-sm bg-white/80" />
            </div>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">LeadDesk</h1>
          <p className="mt-1 text-sm text-ink-soft">Enter your passcode to unlock.</p>
        </div>
        <PasscodeForm next={next} />
      </div>
    </main>
  );
}
