'use client';

import { useState } from 'react';

export default function InfoTooltip({ text }: { text: string }) {
  const [show, setShow] = useState(false);
  return (
    <span className="relative inline-flex items-center">
      <button
        type="button"
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onClick={() => setShow(!show)}
        className="ml-1 flex h-3.5 w-3.5 items-center justify-center rounded-full border border-[var(--color-glass-border)] text-[8px] text-[var(--color-muted)] hover:border-degen-400 hover:text-degen-400"
        aria-label="More info"
      >
        ?
      </button>
      {show && (
        <span className="absolute bottom-full left-1/2 z-10 mb-1 w-48 -translate-x-1/2 rounded-lg border border-[var(--color-glass-border)] bg-[var(--color-card)] p-2 text-[10px] leading-tight text-[var(--color-muted)] shadow-xl">
          {text}
        </span>
      )}
    </span>
  );
}
