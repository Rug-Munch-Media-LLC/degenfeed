'use client';

/**
 * @degenfeed/ui — secondary publish options (bridge, Lens collect, permanence).
 */

import type { ContentProof } from '@degenfeed/types';

export interface ComposeOptionsProps {
  showBridgeOption: boolean;
  bridgeToNostr: boolean;
  onBridgeChange: (checked: boolean) => void;
  showLensOption: boolean;
  lensCollect: boolean;
  onLensCollectChange: (checked: boolean) => void;
  makePermanent: boolean;
  onMakePermanentChange: (checked: boolean) => void;
  storing: boolean;
  permanenceProof: ContentProof | null;
}

const checkboxClass =
  'h-3.5 w-3.5 flex-shrink-0 rounded border border-[var(--color-border)] bg-[var(--color-card)] accent-[var(--color-accent)]';

export function ComposeOptions({
  showBridgeOption,
  bridgeToNostr,
  onBridgeChange,
  showLensOption,
  lensCollect,
  onLensCollectChange,
  makePermanent,
  onMakePermanentChange,
  storing,
  permanenceProof,
}: ComposeOptionsProps) {
  return (
    <>
      {showBridgeOption && (
        <label className="mb-3 flex items-center gap-2 text-xs text-[var(--color-muted)]">
          <input
            type="checkbox"
            checked={bridgeToNostr}
            onChange={(e) => onBridgeChange(e.target.checked)}
            className={checkboxClass}
          />
          <span>
            Also cross-post to <span className="font-medium text-[var(--color-fg)]">Nostr</span>{' '}
            <span className="text-[var(--color-muted)]">(signed locally with your Nostr key)</span>
          </span>
        </label>
      )}

      {showLensOption && (
        <label className="mb-3 flex items-center gap-2 text-xs text-[var(--color-muted)]">
          <input
            type="checkbox"
            checked={lensCollect}
            onChange={(e) => onLensCollectChange(e.target.checked)}
            className={checkboxClass}
          />
          <span>
            Enable <span className="font-medium text-[var(--color-success)]">Free Collect</span> on
            Lens{' '}
            <span className="text-[var(--color-muted)]">(anyone can mint this post as an NFT)</span>
          </span>
        </label>
      )}

      <label className="mb-3 flex items-start gap-2 text-xs text-[var(--color-muted)]">
        <input
          type="checkbox"
          checked={makePermanent}
          onChange={(e) => onMakePermanentChange(e.target.checked)}
          className={`${checkboxClass} mt-0.5`}
          disabled={storing}
        />
        <span aria-live="polite">
          {storing ? (
            <span className="text-[var(--color-accent)]">Storing on Arweave + IPFS…</span>
          ) : permanenceProof ? (
            <span className="text-[var(--color-success)]">
              Stored permanently
              <span className="ml-1 text-[10px] text-[var(--color-muted)]">
                (Arweave{permanenceProof.arweaveTxId ? ' ✓' : ''}
                {permanenceProof.ipfsCid ? ' + IPFS ✓' : ''})
              </span>
            </span>
          ) : (
            <span>
              Store on <span className="font-medium text-[var(--color-accent)]">Arweave</span> +{' '}
              <span className="font-medium text-[var(--color-accent)]">IPFS</span>{' '}
              <span className="font-medium text-[var(--color-fg)]">(permanent)</span>{' '}
              <span className="text-[10px] text-[var(--color-muted)]">— censorship-resistant</span>
            </span>
          )}
        </span>
      </label>
    </>
  );
}
