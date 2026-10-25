'use client';

/**
 * @degenfeed/ui — permanent-storage side effect for a published post.
 *
 * Non-critical by design: the post has already gone out when this runs, so any
 * failure is swallowed rather than surfaced as a publish error.
 */

import type { ContentProof } from '@degenfeed/types';

export interface StorePermanentlyArgs {
  content: string;
  protocols: string[];
  onStoring: (storing: boolean) => void;
  onProof: (proof: ContentProof) => void;
}

export function storePermanently({
  content,
  protocols,
  onStoring,
  onProof,
}: StorePermanentlyArgs): void {
  onStoring(true);
  fetch('/api/permanence/store', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      content,
      tags: [
        { name: 'Protocol', value: protocols.join(',') },
        { name: 'App-Version', value: '0.1.0' },
      ],
    }),
  })
    .then((r) => (r.ok ? (r.json() as Promise<{ proof: ContentProof }>) : null))
    .then((data) => {
      if (data?.proof) onProof(data.proof);
    })
    .catch(() => {
      /* non-critical — post already published */
    })
    .finally(() => onStoring(false));
}
