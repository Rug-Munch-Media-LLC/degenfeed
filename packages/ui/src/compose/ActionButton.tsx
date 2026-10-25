'use client';

/**
 * @degenfeed/ui — the composer's primary action.
 *
 * Replaces three duplicated `btn-primary text-sm disabled:opacity-50` blocks.
 * Token-only styling so the library does not depend on an app-level CSS class.
 */

import type { ButtonHTMLAttributes, ReactNode } from 'react';

export interface ActionButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
}

export function ActionButton({ children, className = '', ...rest }: ActionButtonProps) {
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-2 rounded-full bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-[var(--color-bg)] shadow-[0_0_20px_var(--color-accent-glow)] transition hover:brightness-110 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:brightness-100 ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
