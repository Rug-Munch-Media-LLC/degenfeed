/**
 * @degenfeed/feed-core — Protocol Quality Presets
 *
 * Smart defaults per protocol. Each protocol has different content norms,
 * so we auto-apply the best filters for each. Users can override the
 * preset for any protocol or the unified feed.
 *
 * Presets control:
 *   - minEngagement: minimum likes+reposts required
 *   - hideLinkOnly: suppress posts that are just links
 *   - hideLowQuality: apply spamScore-based filtering
 *   - minContentLength: minimum character count
 *   - Protocol-specific toggles (nostrOnlyKind1, farcasterHideDegen, etc.)
 *   - exploreRatio: % of explore (discovery) vs exploit (preferences)
 *   - showCrossProtocol: include posts from other protocols
 */

import { contentQualityScore } from './spam';

// ─── Preset Names ───────────────────────────────────────────────────

export type PresetName = 'quality' | 'balanced' | 'everything' | 'custom';

export const PRESET_NAMES: PresetName[] = ['quality', 'balanced', 'everything', 'custom'];

export const PRESET_LABELS: Record<PresetName, string> = {
  quality: 'Quality',
  balanced: 'Balanced',
  everything: 'Everything',
  custom: 'Custom',
};

export const PRESET_DESCRIPTIONS: Record<PresetName, string> = {
  quality: 'Smart per-protocol quality filters',
  balanced: 'Moderate filtering for broad content',
  everything: 'No filtering at all — raw firehose',
  custom: 'Your own custom settings',
};

// ─── Protocol Quality Preset Interface ──────────────────────────────

export interface ProtocolQualityPreset {
  protocol: string;
  label: string;
  description: string;
  // Quality filters
  minEngagement: number;
  hideLinkOnly: boolean;
  hideLowQuality: boolean;
  minContentLength: number;
  // Protocol-specific
  nostrOnlyKind1?: boolean;
  farcasterHideDegen?: boolean;
  lensShowOriginalOnly?: boolean;
  mastodonLocalOnly?: boolean;
  blueskyNoReplySpam?: boolean;
  // Discovery
  exploreRatio: number;
  showCrossProtocol: boolean;
}

// ─── Protocol-Specific Smart Presets ────────────────────────────────

export const PROTOCOL_PRESETS: Record<string, ProtocolQualityPreset> = {
  farcaster: {
    protocol: 'farcaster',
    label: 'Farcaster Quality',
    description: 'Hide low-effort casts, prioritize channels',
    minEngagement: 0,
    hideLinkOnly: true,
    hideLowQuality: true,
    minContentLength: 0,
    farcasterHideDegen: true,
    exploreRatio: 0.15,
    showCrossProtocol: true,
  },
  nostr: {
    protocol: 'nostr',
    label: 'Nostr Quality',
    description: 'Long-form notes only, no spam relays',
    minEngagement: 0,
    hideLinkOnly: true,
    hideLowQuality: true,
    minContentLength: 50,
    nostrOnlyKind1: true,
    exploreRatio: 0.2,
    showCrossProtocol: true,
  },
  lens: {
    protocol: 'lens',
    label: 'Lens Quality',
    description: 'Original publications, no mirrors',
    minEngagement: 0,
    hideLinkOnly: false,
    hideLowQuality: true,
    minContentLength: 0,
    lensShowOriginalOnly: true,
    exploreRatio: 0.15,
    showCrossProtocol: true,
  },
  bluesky: {
    protocol: 'bluesky',
    label: 'Bluesky Quality',
    description: 'Hide reply spam, show original skeets',
    minEngagement: 1,
    hideLinkOnly: true,
    hideLowQuality: true,
    minContentLength: 20,
    blueskyNoReplySpam: true,
    exploreRatio: 0.1,
    showCrossProtocol: true,
  },
  mastodon: {
    protocol: 'mastodon',
    label: 'Mastodon Quality',
    description: 'Local instance focus, hide bot content',
    minEngagement: 0,
    hideLinkOnly: false,
    hideLowQuality: true,
    minContentLength: 0,
    mastodonLocalOnly: false,
    exploreRatio: 0.15,
    showCrossProtocol: true,
  },
  lemmy: {
    protocol: 'lemmy',
    label: 'Lemmy Quality',
    description: 'Discussion-focused, hide low-effort',
    minEngagement: 0,
    hideLinkOnly: false,
    hideLowQuality: true,
    minContentLength: 100,
    exploreRatio: 0.1,
    showCrossProtocol: false,
  },
};

// ─── Built-in Preset Profiles  ──────────────────────────────────────

/**
 * The preset profiles that users can select (Quality, Balanced, Everything).
 * Each maps to a set of filter overrides applied on top of the protocol
 * preset (or standalone for the unified feed).
 */
export interface PresetProfile {
  name: PresetName;
  label: string;
  description: string;
  minEngagement: number;
  hideLinkOnly: boolean;
  hideLowQuality: boolean;
  minContentLength: number;
  showCrossProtocol: boolean;
}

export const PRESET_PROFILES: Record<PresetName, PresetProfile> = {
  quality: {
    name: 'quality',
    label: 'Quality',
    description: 'Smart per-protocol quality filters',
    minEngagement: 1,
    hideLinkOnly: true,
    hideLowQuality: true,
    minContentLength: 20,
    showCrossProtocol: true,
  },
  balanced: {
    name: 'balanced',
    label: 'Balanced',
    description: 'Moderate filtering for broad content',
    minEngagement: 0,
    hideLinkOnly: false,
    hideLowQuality: true,
    minContentLength: 0,
    showCrossProtocol: true,
  },
  everything: {
    name: 'everything',
    label: 'Everything',
    description: 'No filtering at all — raw firehose',
    minEngagement: 0,
    hideLinkOnly: false,
    hideLowQuality: false,
    minContentLength: 0,
    showCrossProtocol: true,
  },
  custom: {
    name: 'custom',
    label: 'Custom',
    description: 'Your own custom settings',
    minEngagement: 0,
    hideLinkOnly: false,
    hideLowQuality: false,
    minContentLength: 0,
    showCrossProtocol: true,
  },
};

// ─── Resolver ───────────────────────────────────────────────────────

export interface ResolvedPreset {
  presetName: PresetName;
  protocolPreset: ProtocolQualityPreset | null;
  profile: PresetProfile;
  minEngagement: number;
  hideLinkOnly: boolean;
  hideLowQuality: boolean;
  minContentLength: number;
  showCrossProtocol: boolean;
}

/**
 * Resolve the effective quality settings for a given protocol + preset name.
 * Merges the protocol-specific smart preset on top of the chosen profile.
 */
export function resolvePreset(presetName: PresetName, protocol?: string): ResolvedPreset {
  const profile = PRESET_PROFILES[presetName] ?? PRESET_PROFILES.balanced;
  const protocolPreset = protocol ? (PROTOCOL_PRESETS[protocol] ?? null) : null;

  // Start with the profile values, then let protocol-specific presets override
  let minEngagement = profile.minEngagement;
  let hideLinkOnly = profile.hideLinkOnly;
  let hideLowQuality = profile.hideLowQuality;
  let minContentLength = profile.minContentLength;
  let showCrossProtocol = profile.showCrossProtocol;

  if (protocolPreset && presetName === 'quality') {
    // "Quality" mode: use the protocol's smart preset values
    minEngagement = protocolPreset.minEngagement;
    hideLinkOnly = protocolPreset.hideLinkOnly;
    hideLowQuality = protocolPreset.hideLowQuality;
    minContentLength = protocolPreset.minContentLength;
    showCrossProtocol = protocolPreset.showCrossProtocol;
  }

  return {
    presetName,
    protocolPreset,
    profile,
    minEngagement,
    hideLinkOnly,
    hideLowQuality,
    minContentLength,
    showCrossProtocol,
  };
}

// ─── Filter Application ─────────────────────────────────────────────

export interface QualityFilterResult {
  passed: boolean;
  reasons: string[];
}

/**
 * Apply the resolved quality preset filters to a single post.
 * Returns whether it passes and the reasons for filtering.
 */
export function applyQualityFilters(
  post: {
    text: string;
    metrics?: { likes: number; reposts: number; replies: number; quotes?: number };
  },
  preset: ResolvedPreset,
  _protocol?: string,
): QualityFilterResult {
  const reasons: string[] = [];
  const text = post.text?.trim() ?? '';

  // ── Min content length ──────────────────────────────────────────
  if (preset.minContentLength > 0 && text.length < preset.minContentLength) {
    reasons.push(`too-short:${text.length}<${preset.minContentLength}`);
  }

  // ── Min engagement ──────────────────────────────────────────────
  if (preset.minEngagement > 0 && post.metrics) {
    const total = (post.metrics.likes ?? 0) + (post.metrics.reposts ?? 0);
    if (total < preset.minEngagement) {
      reasons.push(`low-engagement:${total}<${preset.minEngagement}`);
    }
  }

  // ── Link-only filter ────────────────────────────────────────────
  if (preset.hideLinkOnly) {
    const urlFree = text.replace(/https?:\/\/\S+/g, '').trim();
    if (urlFree.length < 15 && text.length > 30) {
      reasons.push('link-only');
    }
  }

  // ── Quality score filter ────────────────────────────────────────
  if (preset.hideLowQuality) {
    const quality = contentQualityScore(text);
    if (quality < 0.4) {
      reasons.push(`low-quality:${quality.toFixed(2)}`);
    }
  }

  return {
    passed: reasons.length === 0,
    reasons,
  };
}

/**
 * KV key for storing a user's preset choice per protocol.
 * Pattern: `user:preset:{wallet}:{protocol}`
 */
export function presetKvKey(wallet: string, protocol?: string): string {
  const key = protocol ? `${protocol}` : 'unified';
  return `user:preset:${wallet.toLowerCase()}:${key}`;
}
