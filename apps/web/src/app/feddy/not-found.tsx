import Link from 'next/link';

export default function FeddyNotFound() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-20 text-center">
      <span className="mb-4 text-5xl">🔍</span>
      <h2 className="mb-2 text-xl font-bold text-[var(--color-fg)]">Page Not Found</h2>
      <p className="mb-6 text-sm text-[var(--color-muted)]">
        This Feddy community page doesn&apos;t exist. Check the URL or browse the directory.
      </p>
      <div className="flex items-center justify-center gap-3">
        <Link
          href="/feddy"
          className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-5 py-2.5 text-sm font-medium text-[var(--color-fg)] transition-all hover:border-degen-500/30"
        >
          Browse Directory
        </Link>
        <Link
          href="/feddy/create"
          className="rounded-xl bg-degen-500 px-5 py-2.5 text-sm font-bold text-black transition-all hover:bg-degen-400"
        >
          Create Community
        </Link>
      </div>
    </div>
  );
}
