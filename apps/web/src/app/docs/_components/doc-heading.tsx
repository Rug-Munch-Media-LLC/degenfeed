'use client';

import type { ReactNode } from 'react';

function AnchorLink({ id }: { id: string }) {
  return (
    <a
      href={`#${id}`}
      className="ml-2 text-[var(--color-muted)] opacity-0 transition-opacity group-hover:opacity-100 hover:text-degen-400"
      aria-label={`Link to ${id} section`}
    >
      #
    </a>
  );
}

export function H2({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h2
      id={id}
      className="group mt-12 mb-4 flex items-center gap-2 text-2xl font-bold text-[var(--color-fg)] scroll-mt-24"
    >
      {children}
      <AnchorLink id={id} />
    </h2>
  );
}

export function H3({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h3
      id={id}
      className="group mt-8 mb-3 flex items-center gap-2 text-lg font-semibold text-[var(--color-fg)] scroll-mt-24"
    >
      {children}
      <AnchorLink id={id} />
    </h3>
  );
}

export function H4({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h4
      id={id}
      className="group mt-6 mb-2 flex items-center gap-2 text-base font-semibold text-[var(--color-fg)] scroll-mt-24"
    >
      {children}
      <AnchorLink id={id} />
    </h4>
  );
}
