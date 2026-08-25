import Link from "next/link";
import { signOut } from "@/lib/actions";

/**
 * The shell. Quick add is reachable from every screen, thumb-height, above the home
 * indicator.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh">
      <header className="safe-top sticky top-0 z-20 border-b border-line bg-page/90 backdrop-blur">
        <div className="mx-auto flex max-w-lg items-center gap-3 px-4 py-3">
          <Link href="/" className="text-lg font-bold tracking-tight">
            LeadDesk
          </Link>
          <nav className="ms-auto flex items-center gap-3 text-xs font-semibold text-ink-soft">
            <Link href="/pipeline" className="underline decoration-line underline-offset-2">
              Pipeline
            </Link>
            <Link href="/settings" className="underline decoration-line underline-offset-2">
              Settings
            </Link>
            <form action={signOut}>
              <button type="submit" className="underline decoration-line underline-offset-2">
                Lock
              </button>
            </form>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 pb-32 pt-4">{children}</main>

      {/*
        An inline-end pill rather than a full-width bar: a bar that spans the screen
        permanently hides a row of the list behind it, and the list is the point.
        The scrim keeps whatever scrolls underneath readable instead of clipped.
      */}
      <div className="safe-bottom pointer-events-none fixed inset-x-0 bottom-0 z-30 bg-gradient-to-t from-page via-page/85 to-transparent pt-8">
        <div className="mx-auto flex max-w-lg justify-end px-4 pb-4">
          <Link
            href="/leads/new"
            className="pointer-events-auto flex h-14 items-center justify-center gap-2 rounded-full bg-ink ps-5 pe-6 text-base font-semibold text-white shadow-[var(--shadow-float)] active:scale-[0.97]"
          >
            <span aria-hidden className="text-xl leading-none">+</span>
            Quick add
          </Link>
        </div>
      </div>
    </div>
  );
}
