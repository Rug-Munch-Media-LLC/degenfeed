/**
 * @degenfeed/api-worker — Cross-Platform Mention Resolution
 *
 * Resolve @mentions in message content against room members.
 * Supports: @displayName, @npub1..., @0x..., @FID, @handle.bsky.social
 */

import { normalizeMention } from './unified-room-constants';
import type { MentionResolution, RoomMember } from './unified-room-types';

export function resolveMentions(content: string, members: RoomMember[]): MentionResolution[] {
  const mentionPattern = /@(\S+)/g;
  const resolutions: MentionResolution[] = [];
  let match: RegExpExecArray | null;

  // biome-ignore lint/suspicious/noAssignInExpressions: standard RegExp exec loop pattern
  while ((match = mentionPattern.exec(content)) !== null) {
    const raw = `@${match[1]}`;
    const normalized = normalizeMention(raw);

    const byName = members.find(
      (m) => m.displayName?.toLowerCase() === normalized || m.id.toLowerCase() === normalized,
    );
    if (byName) {
      resolutions.push({
        raw,
        memberId: byName.id,
        displayName: byName.displayName || byName.id,
        resolvedVia: 'member-name',
      });
      continue;
    }

    const byNpub = members.find((m) => m.identity.nostr?.npub?.toLowerCase() === normalized);
    if (byNpub) {
      resolutions.push({
        raw,
        memberId: byNpub.id,
        displayName: byNpub.displayName || byNpub.id,
        resolvedVia: 'npub',
      });
      continue;
    }

    if (/^\d+$/.test(normalized)) {
      const fid = parseInt(normalized, 10);
      const byFid = members.find((m) => m.identity.farcaster?.fid === fid);
      if (byFid) {
        resolutions.push({
          raw,
          memberId: byFid.id,
          displayName: byFid.displayName || byFid.id,
          resolvedVia: 'fid',
        });
        continue;
      }
    }

    if (normalized.startsWith('0x')) {
      const byWallet = members.find((m) => m.id === normalized);
      if (byWallet) {
        resolutions.push({
          raw,
          memberId: byWallet.id,
          displayName: byWallet.displayName || byWallet.id,
          resolvedVia: 'wallet',
        });
        continue;
      }
    }

    if (normalized.endsWith('.bsky.social')) {
      const byBsky = members.find((m) => m.identity.bluesky?.handle?.toLowerCase() === normalized);
      if (byBsky) {
        resolutions.push({
          raw,
          memberId: byBsky.id,
          displayName: byBsky.displayName || byBsky.id,
          resolvedVia: 'bsky-handle',
        });
        continue;
      }
    }

    resolutions.push({ raw, memberId: null, displayName: null, resolvedVia: 'unknown' });
  }

  return resolutions;
}
