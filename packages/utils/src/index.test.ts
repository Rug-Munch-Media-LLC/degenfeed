/**
 * @degenfeed/utils — public surface contract test
 *
 * The barrel is the package's only public entry point. Per-module behaviour is
 * covered by that module's own test file; this file guards the contract that
 * survives refactors: every export the monorepo depends on still resolves,
 * with the expected shape, and no export leaks accidentally.
 */

import { describe, expect, it } from 'vitest';
import * as utils from './index';

/**
 * The barrel read as a plain record. `import * as` gives a module namespace
 * whose dynamic member access is a known performance trap; tests only need
 * name → value lookup, which this cast expresses honestly.
 */
const surface = utils as unknown as Record<string, unknown>;

/** Functions consumers call. */
const FUNCTION_EXPORTS = [
  'buildUrl',
  'communityFeedKey',
  'communityKey',
  'communityMembersKey',
  'decodeContentUri',
  'decodeXmlEntities',
  'detectTokens',
  'detectVideoFromEmbeds',
  'encodeContentUri',
  'estimateTranslationLoss',
  'fetchPeerTubeVideo',
  'formatCount',
  'formatDate',
  'formatDuration',
  'formatTimeAgo',
  'formatTimestamp',
  'getAuthorProfileHref',
  'getCurrencyMeta',
  'getDefaultCurrency',
  'getExternalProfileUrl',
  'getInternalProfileId',
  'getInternalProfilePath',
  'getPostContentUri',
  'getProfileUrlFromParts',
  'getProtocolColor',
  'getProtocolEmoji',
  'getProtocolFeedPath',
  'getProtocolIcon',
  'getProtocolLabel',
  'guessNiches',
  'identityKey',
  'isShortFormVideo',
  'isValidEmail',
  'parseDirectVideoUrl',
  'parsePeerTubeUrl',
  'parseProtocols',
  'parseRssItems',
  'parseVideoUrl',
  'parseYouTubeUrl',
  'proxyMediaUrl',
  'proxyUrl',
  'reportError',
  'resolveFediverseHandle',
  'resolveHandle',
  'rmiUrl',
  'safeKey',
  'shortenAddress',
  'slugifyCommunity',
  'stripHtml',
  'translateContent',
  'withConcurrencyLimit',
] as const;

/** Non-function values (registries, maps, constant strings). */
const VALUE_EXPORTS = [
  'CATEGORIES',
  'CATEGORY_DISPLAY_ORDER',
  'CATEGORY_PROTOCOLS',
  'COMMUNITY_INDEX_KEY',
  'COMMUNITY_KV_PREFIX',
  'CURRENCY_META',
  'EXTRA_PROTOCOLS',
  'IDENTITY_KV_PREFIX',
  'PROTOCOLS',
  'PROTOCOL_COLORS',
  'PROTOCOL_DEFAULT_CURRENCY',
  'PROTOCOL_EMOJI',
  'PROTOCOL_FORMATS',
  'PROTOCOL_ICONS',
  'PROTOCOL_ID_REGISTRY',
  'PROTOCOL_LABELS',
  'PROTOCOL_LIST',
  'SIDEBAR_ORDER',
] as const;

describe('@degenfeed/utils barrel', () => {
  it('exports every function consumer imports', () => {
    for (const name of FUNCTION_EXPORTS) {
      expect(typeof surface[name], `${name} must be a function`).toBe('function');
    }
  });

  it('exports every value consumer imports', () => {
    for (const name of VALUE_EXPORTS) {
      expect(surface[name], `${name} must be defined`).toBeDefined();
    }
  });

  it('exposes no runtime export outside the documented surface', () => {
    const documented = new Set<string>([...FUNCTION_EXPORTS, ...VALUE_EXPORTS]);
    const unexpected = Object.keys(surface).filter((key) => !documented.has(key));
    expect(unexpected).toEqual([]);
  });

  it('keeps the canonical protocol registry self-consistent', () => {
    expect(utils.PROTOCOL_LIST.length).toBeGreaterThan(20);
    for (const config of utils.PROTOCOL_LIST) {
      expect(utils.CATEGORIES[config.category]).toBeDefined();
      expect(utils.getProtocolColor(config.id)).toBe(utils.PROTOCOL_COLORS[config.id]);
    }
  });
});

describe('protocol display helpers', () => {
  it('returns the configured colour and label for known protocols', () => {
    expect(utils.getProtocolColor('nostr')).toBe(utils.PROTOCOL_COLORS.nostr);
    expect(utils.getProtocolLabel('nostr')).toBe(utils.PROTOCOL_LABELS.nostr);
  });

  it('returns the configured emoji and icon for known protocols', () => {
    expect(utils.getProtocolEmoji('nostr')).toBe('⚡');
    expect(utils.getProtocolIcon('nostr')).toBe(utils.PROTOCOL_ICONS.nostr);
  });

  it('falls back deterministically for unknown protocols', () => {
    const unknown = 'not-a-protocol';
    expect(utils.getProtocolColor(unknown)).toBe('#666');
    expect(utils.getProtocolIcon(unknown)).toBe('?');
    expect(utils.getProtocolEmoji(unknown)).toBe('●');
    expect(utils.getProtocolLabel(unknown)).toBe(unknown);
  });

  it('derives the emoji map from the icon map (single canonical source)', () => {
    for (const [protocol, icon] of Object.entries(utils.PROTOCOL_ICONS)) {
      expect(utils.PROTOCOL_EMOJI[protocol] ?? icon).toBeDefined();
    }
  });
});
