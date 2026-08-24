import Link from "next/link";
import { QuickAddForm } from "@/components/quick-add-form";

export default function NewLeadPage() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Link href="/" className="text-sm font-semibold text-ink-soft">
          &larr; Today
        </Link>
      </div>
      <div>
        <h1 className="text-xl font-bold tracking-tight">Quick add</h1>
        <p className="mt-0.5 text-sm text-ink-soft">
          Name and number is enough. Everything else can wait until they are out the door.
        </p>
      </div>
      <QuickAddForm />
    </div>
  );
}
