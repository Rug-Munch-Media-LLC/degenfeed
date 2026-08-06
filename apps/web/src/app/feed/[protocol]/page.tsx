'use client';

//
// /feed/[protocol] — protocol feed page.
//
// Client Components cannot be async. Read the `params` promise with
// React's `use()` so the page is a pure client component — navigation
// between protocols is a lightweight client-side transition with no
// per-navigation server render round-trip.
//
// The real feed UI lives in ProtocolFeedContent (shared with the
// /feed/[protocol]/[sort] route) so empty-state CTAs like "Browse
// popular instead" resolve to the same component.
//

import { use } from 'react';
import { ProtocolFeedContent, normalizeSort } from './ProtocolFeedContent';

interface Props {
  params: Promise<{ protocol: string }>;
  searchParams?: Promise<{ sort?: string }>;
}

export default function ProtocolFeedPage({ params, searchParams }: Props) {
  const { protocol } = use(params);
  const sp = searchParams ? use(searchParams) : undefined;
  return <ProtocolFeedContent protocol={protocol} initialSort={normalizeSort(sp?.sort)} />;
}
