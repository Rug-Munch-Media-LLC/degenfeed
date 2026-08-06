'use client';

//
// /feed/[protocol]/[sort] — protocol feed with a pre-selected sort tab.
//
// Lets empty-state CTAs and deep links land on the right tab, e.g.
//   /feed/nostr/popular   → popular feed
//   /feed/youtube/videos  → video feed
//
// Reuses the same ProtocolFeedContent as /feed/[protocol] so switching
// between tabs stays a single client-side render.
//

import { use } from 'react';
import { normalizeSort, ProtocolFeedContent, type SortMode } from '../ProtocolFeedContent';

interface Props {
  params: Promise<{ protocol: string; sort: string }>;
}

export default function ProtocolSortPage({ params }: Props) {
  const { protocol, sort } = use(params);
  const initialSort: SortMode = normalizeSort(sort);
  return <ProtocolFeedContent protocol={protocol} initialSort={initialSort} />;
}
