'use client';

import { usePathname } from 'next/navigation';
import { Shell } from './Shell';

/**
 * Conditionally wraps children with Shell.
 * - Root path `/` → renders standalone (no sidebar, no header nav, no BottomNav)
 * - All other paths → renders inside Shell with full layout
 */
export function ConditionalShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Landing page renders standalone — no Shell wrapper
  if (pathname === '/') {
    return <>{children}</>;
  }

  return <Shell>{children}</Shell>;
}
