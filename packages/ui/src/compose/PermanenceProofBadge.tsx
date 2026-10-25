'use client';

/**
 * @degenfeed/ui — links to the Arweave / IPFS copies of a stored post.
 */

import type { ContentProof } from '@degenfeed/types';

export interface PermanenceProofBadgeProps {
  proof: ContentProof;
}

export function PermanenceProofBadge({ proof }: PermanenceProofBadgeProps) {
  return (
    <div className="mb-3 flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2">
      <span className="text-xs font-bold text-[var(--color-success)]" aria-hidden="true">
        🔗
      </span>
      <span className="text-[11px] text-[var(--color-fg)]">
        Stored permanently
        {proof.arweaveTxId && (
          <a
            href={`https://arweave.net/${proof.arweaveTxId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-1 underline hover:text-[var(--color-accent)]"
            onClick={(e) => e.stopPropagation()}
          >
            Arweave
          </a>
        )}
        {proof.ipfsCid && (
          <a
            href={`https://ipfs.io/ipfs/${proof.ipfsCid}`}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-1 underline hover:text-[var(--color-accent)]"
            onClick={(e) => e.stopPropagation()}
          >
            IPFS
          </a>
        )}
      </span>
      {proof.arweaveTxId && (
        <span
          className="ml-auto max-w-[120px] truncate font-mono text-[10px] text-[var(--color-muted)]"
          title={proof.arweaveTxId}
        >
          {proof.arweaveTxId.slice(0, 8)}...{proof.arweaveTxId.slice(-4)}
        </span>
      )}
    </div>
  );
}
