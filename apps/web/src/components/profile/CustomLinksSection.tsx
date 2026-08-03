'use client';

/**
 * CustomLinksSection — renders linktree-style custom links on a profile.
 */

export interface CustomLink {
  label: string;
  url: string;
}

export function CustomLinksSection({ links }: { links: CustomLink[] }) {
  if (!links || links.length === 0) return null;

  return (
    <div className="mx-auto mt-3 max-w-lg space-y-1.5">
      {links.map((link, i) => (
        <a
          key={`${link.url}-${i}`}
          href={link.url}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="block rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] px-4 py-2 text-center text-xs font-medium text-[var(--color-fg)] transition-colors hover:border-degen-500/30 hover:bg-degen-500/[0.03]"
        >
          {link.label}
        </a>
      ))}
    </div>
  );
}
