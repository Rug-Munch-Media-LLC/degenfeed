'use client';

/**
 * @app/join/[type]/[id]/client — Client-side join page logic.
 *
 * Handles platform detection, greeting display, and routing to the
 * correct join view (stream, space, or coin).
 */

import { useCallback, useState } from 'react';
import { PlatformGreeting } from '../../../components/join/PlatformGreeting';
import { StreamJoinView } from '../../../components/join/StreamJoinView';
import { SpaceJoinView } from '../../../components/join/SpaceJoinView';
import { useSourcePlatform } from '../../../components/join/useSourcePlatform';
import type { SourcePlatform } from '../../../components/join/types';

/* ─── Props ────────────────────────────────────────────────────── */

interface JoinPageClientProps {
  type: 'stream' | 'space' | 'coin';
  id: string;
}

/* ─── Coin Join Placeholder ────────────────────────────────────── */

function CoinJoinView({ _symbol, _sourcePlatform }: { _symbol: string; _sourcePlatform: SourcePlatform }) {
  return (
    <div className="mx-auto flex min-h-[calc(100dvh-4rem)] max-w-5xl flex-col items-center justify-center px-4">
      <div className="flex max-w-md flex-col items-center rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-card)] px-8 py-12 text-center">
        <span className="mb-4 text-5xl" aria-hidden="true">
          🪙
        </span>
        <h1 className="mb-2 text-lg font-bold text-[var(--color-fg)]">Coin Launch</h1>
        <p className="mb-6 text-sm text-[var(--color-muted)]">
          Coin launch streaming is coming soon. Check back for live trading and chat.
        </p>
        <a
          href="/launch"
          className="rounded-xl bg-degen-500 px-5 py-2.5 text-xs font-bold text-black transition-all hover:bg-degen-400"
        >
          Browse Launches
        </a>
      </div>
    </div>
  );
}

/* ─── Main Client Component ───────────────────────────────────── */

export function JoinPageClient({ type, id }: JoinPageClientProps) {
  const { platform, referrerDomain } = useSourcePlatform();
  const [greetingDismissed, setGreetingDismissed] = useState(false);

  const handleGreetingDismiss = useCallback(() => {
    setGreetingDismissed(true);
  }, []);

  return (
    <div className="min-h-screen">
      {/* Platform greeting banner (dismissable) */}
      {!greetingDismissed && (
        <div className="mx-auto max-w-7xl px-4 pt-4">
          <PlatformGreeting
            platform={platform}
            onDismiss={handleGreetingDismiss}
          />
        </div>
      )}

      {/* Route to the correct join view */}
      {type === 'stream' && (
        <StreamJoinView
          streamId={id}
          sourcePlatform={platform}
          sourceInstance={referrerDomain || undefined}
        />
      )}

      {type === 'space' && (
        <SpaceJoinView
          spaceId={id}
          sourcePlatform={platform}
          sourceInstance={referrerDomain || undefined}
        />
      )}

      {type === 'coin' && (
        <CoinJoinView _symbol={id} _sourcePlatform={platform} />
      )}
    </div>
  );
}
