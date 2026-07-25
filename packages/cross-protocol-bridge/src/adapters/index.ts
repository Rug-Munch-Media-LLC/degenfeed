/**
 * @degenfeed/cross-protocol-bridge — Adapter Registry
 *
 * Registry of all platform-specific content adapters for cross-posting.
 * Each adapter converts a MasterPost into the target platform's format.
 */

import type {
  MasterPost,
  PlatformAdapter,
  PlatformDefinition,
  ProtocolPublishParams,
} from './types';
import { ALL_PLATFORMS } from './types';

export type {
  LinkCard,
  MasterPost,
  MediaAttachment,
  PlatformAdapter,
  PlatformDefinition,
  ProtocolPublishParams,
} from './types';
export { ALL_PLATFORMS, formatHashtags, truncateText } from './types';

// ─── Import all adapters ──────────────────────────────────────────────────

import { blueskyAdapter } from './bluesky-adapter';
import { discordAdapter } from './discord-adapter';
import { farcasterAdapter } from './farcaster-adapter';
import { lemmyAdapter } from './lemmy-adapter';
import { lensAdapter } from './lens-adapter';
import { mastodonAdapter } from './mastodon-adapter';
import { nostrAdapter } from './nostr-adapter';
import { peertubeAdapter } from './peertube-adapter';
import { pixelfedAdapter } from './pixelfed-adapter';
import { redditAdapter } from './reddit-adapter';
import { telegramAdapter } from './telegram-adapter';
import { threadsAdapter } from './threads-adapter';

// ─── Registry ─────────────────────────────────────────────────────────────

const adapters = new Map<string, PlatformAdapter>();

export function registerAdapter(adapter: PlatformAdapter): void {
  adapters.set(adapter.protocol, adapter);
}

export function getAdapter(protocol: string): PlatformAdapter | undefined {
  return adapters.get(protocol);
}

export function getAllAdapters(): PlatformAdapter[] {
  return Array.from(adapters.values());
}

export function getAvailableProtocols(): PlatformDefinition[] {
  return ALL_PLATFORMS.filter((p) => adapters.has(p.id));
}

// ─── Register all built-in adapters ───────────────────────────────────────

export function registerAllAdapters(): void {
  registerAdapter(nostrAdapter);
  registerAdapter(farcasterAdapter);
  registerAdapter(blueskyAdapter);
  registerAdapter(mastodonAdapter);
  registerAdapter(lensAdapter);
  registerAdapter(redditAdapter);
  registerAdapter(telegramAdapter);
  registerAdapter(discordAdapter);
  registerAdapter(threadsAdapter);
  registerAdapter(lemmyAdapter);
  registerAdapter(peertubeAdapter);
  registerAdapter(pixelfedAdapter);
}

// Auto-register on import
registerAllAdapters();

// ─── Multi-platform helpers ───────────────────────────────────────────────

/**
 * Adapt a MasterPost to multiple protocols in parallel.
 * Returns a map of protocol → adapted params.
 */
export function adaptForProtocols(
  master: MasterPost,
  protocols: string[],
): Record<string, { params: ProtocolPublishParams; adapter: PlatformAdapter } | { error: string }> {
  const results: Record<
    string,
    { params: ProtocolPublishParams; adapter: PlatformAdapter } | { error: string }
  > = {};

  for (const protocol of protocols) {
    const adapter = getAdapter(protocol);
    if (!adapter) {
      results[protocol] = { error: `No adapter registered for protocol: ${protocol}` };
      continue;
    }

    try {
      results[protocol] = {
        params: adapter.adapt(master),
        adapter,
      };
    } catch (err) {
      results[protocol] = {
        error: `Adaptation failed: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  return results;
}

/**
 * Generate previews for all requested protocols.
 */
export function previewForProtocols(
  master: MasterPost,
  protocols: string[],
): Record<string, string> {
  const previews: Record<string, string> = {};

  for (const protocol of protocols) {
    const adapter = getAdapter(protocol);
    if (!adapter) {
      previews[protocol] = `[${protocol}] No adapter available`;
      continue;
    }

    try {
      previews[protocol] = adapter.preview(master);
    } catch (err) {
      previews[protocol] =
        `[${protocol}] Preview error: ${err instanceof Error ? err.message : String(err)}`;
    }
  }

  return previews;
}
