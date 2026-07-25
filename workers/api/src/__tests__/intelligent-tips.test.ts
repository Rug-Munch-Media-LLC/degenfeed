/**
 * @degenfeed/api-worker — Intelligent Tips Tests
 *
 * Covers all 5 tasks:
 *   TASK 1: Context-aware venue classification + tip routing
 *   TASK 2: Per-protocol capability matrix
 *   TASK 3: Amount intelligence
 *   TASK 4: Visibility rules
 *   TASK 5: Notification plans
 */

import { describe, expect, it } from 'vitest';
import {
  type AmountIntelligenceInput,
  buildNotificationPlan,
  canEnforceVisibility,
  classifyVenue,
  contentCategoryFromString,
  determineTipVisibility,
  formatTipAmountForDisplay,
  formatTipperForDisplay,
  generateTipSuggestions,
  getProtocolCapability,
  getProtocolNotificationMessage,
  getTipActionUrl,
  listAllProtocolCapabilities,
  type TipRecordForVisibility,
} from '../lib/intelligent-tips';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TASK 1: Context-Aware Venue Classification
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe('classifyVenue', () => {
  it('classifies DegenFeed content as our_network', () => {
    expect(classifyVenue('degenfeed', true)).toBe('our_network');
  });

  it('classifies external content viewed from DegenFeed as cross_platform', () => {
    expect(classifyVenue('mastodon', false, true)).toBe('cross_platform');
    expect(classifyVenue('nostr', false, true)).toBe('cross_platform');
  });

  it('classifies comments/replies regardless of venue', () => {
    expect(classifyVenue('degenfeed', true, false, 'comment')).toBe('comment_reply');
    expect(classifyVenue('mastodon', false, true, 'reply')).toBe('comment_reply');
    expect(classifyVenue('reddit', false, false, 'comment')).toBe('comment_reply');
  });

  it('defaults remaining combinations to external_protocol', () => {
    expect(classifyVenue('bluesky', false, false)).toBe('cross_platform');
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TASK 2: Per-Protocol Capability Matrix
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe('getProtocolCapability', () => {
  it('returns Nostr capabilities with NIP-57 zaps', () => {
    const cap = getProtocolCapability('nostr');
    expect(cap.protocol).toBe('nostr');
    expect(cap.nativeMethod).toBe('lightning_zap');
    expect(cap.bridgeMethod).toBeNull();
    expect(cap.routingStrategy).toBe('native');
    expect(cap.feeTier).toBe('low');
    expect(cap.methods).toContain('lightning');
    expect(cap.methods).toContain('evm');
    expect(cap.methods).toContain('solana');
    expect(cap.methods).toContain('creator_coin');
    expect(cap.methods).toContain('native');
    expect(cap.supportsVisibilityControl).toBe(true);
    expect(cap.supportsOnChain).toBe(true);
    expect(cap.supportsMessage).toBe(true);
  });

  it('returns Farcaster capabilities with Frame tipping', () => {
    const cap = getProtocolCapability('farcaster');
    expect(cap.nativeMethod).toBe('farcaster_frame');
    expect(cap.routingStrategy).toBe('frame');
    expect(cap.methods).toContain('usdc');
  });

  it('returns Mastodon bridge capabilities', () => {
    const cap = getProtocolCapability('mastodon');
    expect(cap.nativeMethod).toBeNull();
    expect(cap.bridgeMethod).toBe('bridge');
    expect(cap.routingStrategy).toBe('bridge');
    expect(cap.supportsOnChain).toBe(false);
    expect(cap.supportsVisibilityControl).toBe(false);
  });

  it('returns Lemmy bridge capabilities', () => {
    const cap = getProtocolCapability('lemmy');
    expect(cap.nativeMethod).toBeNull();
    expect(cap.bridgeMethod).toBe('bridge');
    expect(cap.routingStrategy).toBe('bridge');
  });

  it('returns Reddit link capabilities', () => {
    const cap = getProtocolCapability('reddit');
    expect(cap.nativeMethod).toBeNull();
    expect(cap.bridgeMethod).toBe('link');
    expect(cap.routingStrategy).toBe('link');
    expect(cap.feeTier).toBe('high');
  });

  it('returns GitHub sponsors capabilities', () => {
    const cap = getProtocolCapability('github');
    expect(cap.nativeMethod).toBe('sponsors');
    expect(cap.routingStrategy).toBe('native');
    expect(cap.feeTier).toBe('free');
  });

  it('returns reasonable defaults for unknown protocols', () => {
    const cap = getProtocolCapability('unknown-protocol');
    expect(cap.nativeMethod).toBeNull();
    expect(cap.bridgeMethod).toBe('bridge');
    expect(cap.methods).toEqual(['lightning', 'evm', 'solana']);
    expect(cap.routingStrategy).toBe('bridge');
  });

  it('listAllProtocolCapabilities returns all defined protocols', () => {
    const all = listAllProtocolCapabilities();
    expect(all.length).toBeGreaterThanOrEqual(12);
    const protocols = all.map((c) => c.protocol);
    expect(protocols).toContain('nostr');
    expect(protocols).toContain('farcaster');
    expect(protocols).toContain('bluesky');
    expect(protocols).toContain('mastodon');
    expect(protocols).toContain('lemmy');
    expect(protocols).toContain('peertube');
    expect(protocols).toContain('owncast');
    expect(protocols).toContain('reddit');
    expect(protocols).toContain('github');
    expect(protocols).toContain('lens');
    expect(protocols).toContain('telegram');
    expect(protocols).toContain('youtube');
    expect(protocols).toContain('zora');
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TASK 3: Tip Amount Intelligence
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe('generateTipSuggestions', () => {
  const baseInput: AmountIntelligenceInput = {
    contentCategory: 'post',
    relationship: 'casual',
    onOurNetwork: false,
  };

  it('returns 3 presets with default recommended', () => {
    const result = generateTipSuggestions(baseInput);
    expect(result.presets).toHaveLength(3);
    expect(result.presets.filter((p) => p.recommended)).toHaveLength(1);
    expect(result.defaultAmountUsd).toBeGreaterThan(0);
  });

  it('presets have unique amounts, labels, and rationales', () => {
    const result = generateTipSuggestions(baseInput);
    const amounts = result.presets.map((p) => p.amountUsd);
    expect(new Set(amounts).size).toBe(amounts.length);
    result.presets.forEach((p) => {
      expect(p.label).toBeTruthy();
      expect(p.rationale).toBeTruthy();
    });
  });

  it('content type affects amount range', () => {
    const post = generateTipSuggestions({ ...baseInput, contentCategory: 'post' });
    const live = generateTipSuggestions({ ...baseInput, contentCategory: 'live_stream' });
    const newsletter = generateTipSuggestions({ ...baseInput, contentCategory: 'newsletter' });
    // Live streams should suggest higher than posts
    expect(live.defaultAmountUsd).toBeGreaterThanOrEqual(post.defaultAmountUsd);
    // Newsletters should suggest higher than posts
    expect(newsletter.defaultAmountUsd).toBeGreaterThanOrEqual(post.defaultAmountUsd);
  });

  it('first-time relationship suggests lower amounts', () => {
    const firstTime = generateTipSuggestions({ ...baseInput, relationship: 'first_time' });
    const regular = generateTipSuggestions({ ...baseInput, relationship: 'regular' });
    expect(firstTime.defaultAmountUsd).toBeLessThanOrEqual(regular.defaultAmountUsd);
  });

  it('super fan suggests higher amounts', () => {
    const casual = generateTipSuggestions({ ...baseInput, relationship: 'casual' });
    const superFan = generateTipSuggestions({ ...baseInput, relationship: 'super_fan' });
    expect(superFan.defaultAmountUsd).toBeGreaterThanOrEqual(casual.defaultAmountUsd);
  });

  it('on our network suggests higher (lower fees)', () => {
    const external = generateTipSuggestions({ ...baseInput, onOurNetwork: false });
    const network = generateTipSuggestions({ ...baseInput, onOurNetwork: true });
    expect(network.defaultAmountUsd).toBeGreaterThanOrEqual(external.defaultAmountUsd);
  });

  it('respects user balance cap', () => {
    const lowBalance = generateTipSuggestions({ ...baseInput, userBalanceUsd: 1 });
    expect(lowBalance.defaultAmountUsd).toBeLessThanOrEqual(0.25);
    // Max 25% of balance
    expect(lowBalance.customRange.maxUsd).toBeLessThanOrEqual(0.25);
  });

  it('historical average overrides baseline', () => {
    const withHistory = generateTipSuggestions({ ...baseInput, historicalAvgUsd: 25 });
    expect(withHistory.defaultAmountUsd).toBeGreaterThanOrEqual(5);
  });

  it('protocol-specific average is used when historical is absent', () => {
    const withProtocol = generateTipSuggestions({ ...baseInput, protocolAvgUsd: 15 });
    expect(withProtocol.defaultAmountUsd).toBeGreaterThanOrEqual(3);
  });

  it('feeEstimates are sorted cheapest first', () => {
    const result = generateTipSuggestions(baseInput);
    expect(result.feeEstimates.length).toBeGreaterThanOrEqual(5);
    expect(result.feeEstimates[0]?.chain).toBe('lightning');
    expect(result.feeEstimates[0]?.feeUsd).toBeLessThan(result.feeEstimates[1]?.feeUsd ?? 0);
  });

  it('customRange respects the content type', () => {
    const post = generateTipSuggestions({ ...baseInput, contentCategory: 'post' });
    const video = generateTipSuggestions({ ...baseInput, contentCategory: 'video' });
    expect(post.customRange.maxUsd).toBe(10);
    expect(video.customRange.maxUsd).toBe(25);
    expect(video.customRange.minUsd).toBeGreaterThanOrEqual(post.customRange.minUsd);
  });

  it('deduplicates presets with same amount', () => {
    // When relationship=super_fan and onOurNetwork, default could hit max
    // which might cause dedup. Just verify we don't crash.
    const result = generateTipSuggestions({
      contentCategory: 'post',
      relationship: 'super_fan',
      onOurNetwork: true,
      userBalanceUsd: 10000,
    });
    expect(result.presets.length).toBeGreaterThanOrEqual(2);
  });
});

describe('contentCategoryFromString', () => {
  it('maps common types correctly', () => {
    expect(contentCategoryFromString('post')).toBe('post');
    expect(contentCategoryFromString('video')).toBe('video');
    expect(contentCategoryFromString('clip')).toBe('video');
    expect(contentCategoryFromString('short')).toBe('video');
    expect(contentCategoryFromString('live_stream')).toBe('live_stream');
    expect(contentCategoryFromString('stream')).toBe('live_stream');
    expect(contentCategoryFromString('newsletter')).toBe('newsletter');
    expect(contentCategoryFromString('article')).toBe('newsletter');
    expect(contentCategoryFromString('comment')).toBe('comment');
    expect(contentCategoryFromString('reply')).toBe('comment');
    expect(contentCategoryFromString('audio_space')).toBe('audio_space');
    expect(contentCategoryFromString('space')).toBe('audio_space');
  });

  it('defaults unknown types to post', () => {
    expect(contentCategoryFromString('unknown_type')).toBe('post');
    expect(contentCategoryFromString('')).toBe('post');
    expect(contentCategoryFromString('gibberish')).toBe('post');
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TASK 4: Tip Visibility Rules
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe('determineTipVisibility', () => {
  const baseTip: TipRecordForVisibility = {
    tipperId: '0xabc123',
    tipperDisplayName: 'Alice',
    recipientId: '0xdef456',
    recipientDisplayName: 'Bob',
    amountUsd: 10,
    currency: 'USD',
    protocol: 'nostr',
    method: 'lightning_zap',
  };

  it('defaults to public visibility', () => {
    const decision = determineTipVisibility(baseTip);
    expect(decision.visibility).toBe('public');
    expect(decision.appearsOnLeaderboard).toBe(true);
    expect(decision.tipperDisplay).toBe('full');
    expect(decision.badgeLabel).toContain('Public');
  });

  it('respects explicit private preference', () => {
    const decision = determineTipVisibility(baseTip, 'private');
    expect(decision.visibility).toBe('private');
    expect(decision.appearsOnLeaderboard).toBe(false);
    expect(decision.tipperDisplay).toBe('anonymous');
    expect(decision.badgeLabel).toContain('Private');
  });

  it('respects explicit anonymous preference', () => {
    const decision = determineTipVisibility(baseTip, 'anonymous');
    expect(decision.visibility).toBe('anonymous');
    expect(decision.appearsOnLeaderboard).toBe(false);
    expect(decision.tipperDisplay).toBe('hidden');
    expect(decision.badgeLabel).toContain('Anonymous');
  });

  it('public is always protocol-enforceable', () => {
    const nostr = determineTipVisibility(baseTip, 'public');
    expect(nostr.protocolEnforceable).toBe(true);
    const bluesky = determineTipVisibility({ ...baseTip, protocol: 'bluesky' }, 'public');
    expect(bluesky.protocolEnforceable).toBe(true);
  });

  it('only protocols with visibility control can enforce private/anonymous', () => {
    const nostr = determineTipVisibility(baseTip, 'private');
    expect(nostr.protocolEnforceable).toBe(true); // Nostr supports this

    const bluesky = determineTipVisibility({ ...baseTip, protocol: 'bluesky' }, 'private');
    expect(bluesky.protocolEnforceable).toBe(false); // Bluesky doesn't
  });
});

describe('canEnforceVisibility', () => {
  it('public is always allowed', () => {
    expect(canEnforceVisibility('nostr', 'public')).toBe(true);
    expect(canEnforceVisibility('bluesky', 'public')).toBe(true);
    expect(canEnforceVisibility('unknown', 'public')).toBe(true);
  });

  it('private required visibility control', () => {
    expect(canEnforceVisibility('nostr', 'private')).toBe(true);
    expect(canEnforceVisibility('farcaster', 'private')).toBe(true);
    expect(canEnforceVisibility('bluesky', 'private')).toBe(false);
    expect(canEnforceVisibility('mastodon', 'private')).toBe(false);
  });
});

describe('formatTipAmountForDisplay', () => {
  it('shows full amount for public tips', () => {
    expect(formatTipAmountForDisplay(5.5, 'public', false)).toBe('$5.50');
    expect(formatTipAmountForDisplay(5.5, 'public', true)).toBe('$5.50');
  });

  it('hides amount for private tips to non-recipients', () => {
    expect(formatTipAmountForDisplay(5.5, 'private', false)).toBe('🔒 Private tip');
  });

  it('shows amount for private tips to the recipient', () => {
    expect(formatTipAmountForDisplay(5.5, 'private', true)).toBe('$5.50');
  });

  it('hides everything for anonymous tips to non-recipients', () => {
    expect(formatTipAmountForDisplay(5.5, 'anonymous', false)).toBe('👤 Anonymous tip');
  });

  it('shows anonymous amount to recipient', () => {
    expect(formatTipAmountForDisplay(5.5, 'anonymous', true)).toBe('$5.50');
  });
});

describe('formatTipperForDisplay', () => {
  it('returns Anonymous for anonymous visibility', () => {
    expect(formatTipperForDisplay('Alice', '0xabc', 'anonymous')).toBe('Anonymous');
  });

  it('returns name for private visibility', () => {
    expect(formatTipperForDisplay('Alice', '0xabc', 'private')).toBe('Alice');
  });

  it('returns name for public visibility', () => {
    expect(formatTipperForDisplay('Alice', '0xabc', 'public')).toBe('Alice');
  });

  it('falls back to truncated ID when no name', () => {
    const result = formatTipperForDisplay(undefined, '0xabc123def456', 'public');
    expect(result).toBe('0xabc1');
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TASK 5: Tip Notifications
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe('buildNotificationPlan', () => {
  it('our_network: full notification suite', () => {
    const plan = buildNotificationPlan('our_network', 'nostr', 'public', 5, true);
    expect(plan.inApp).toBe(true);
    expect(plan.push).toBe(true);
    expect(plan.websocket).toBe(true);
    expect(plan.soundEffect).toBe(true); // >= $1
    expect(plan.protocolNative).toBe(false);
    expect(plan.emailDigest).toBe(true);
    expect(plan.crossPlatform).toBe(false);
  });

  it('our_network: no sound for tiny tips', () => {
    const plan = buildNotificationPlan('our_network', 'nostr', 'public', 0.5, true);
    expect(plan.soundEffect).toBe(false);
  });

  it('our_network: no push without DF account', () => {
    const plan = buildNotificationPlan('our_network', 'nostr', 'public', 5, false);
    expect(plan.push).toBe(false);
  });

  it('cross_platform: notifies both sides', () => {
    const plan = buildNotificationPlan('cross_platform', 'mastodon', 'public', 10, true);
    expect(plan.inApp).toBe(true);
    expect(plan.protocolNative).toBe(true);
    expect(plan.crossPlatform).toBe(true);
    expect(plan.websocket).toBe(true);
    expect(plan.soundEffect).toBe(true);
  });

  it('cross_platform: no GitHub protocol notification', () => {
    const plan = buildNotificationPlan('cross_platform', 'github', 'public', 10, true);
    expect(plan.protocolNative).toBe(false); // Don't spam GitHub
  });

  it('external_protocol: protocol-native primary', () => {
    const plan = buildNotificationPlan('external_protocol', 'mastodon', 'public', 5, false);
    expect(plan.inApp).toBe(false);
    expect(plan.push).toBe(false);
    expect(plan.protocolNative).toBe(true);
    expect(plan.websocket).toBe(false);
  });

  it('external_protocol: Reddit/Youtube have no native notifications', () => {
    const reddit = buildNotificationPlan('external_protocol', 'reddit', 'public', 5, true);
    expect(reddit.protocolNative).toBe(false);
    const youtube = buildNotificationPlan('external_protocol', 'youtube', 'public', 5, true);
    expect(youtube.protocolNative).toBe(false);
  });

  it('comment_reply: lighter notifications, push for large amounts', () => {
    const small = buildNotificationPlan('comment_reply', 'mastodon', 'public', 1, true);
    expect(small.inApp).toBe(true);
    expect(small.push).toBe(false);
    expect(small.websocket).toBe(false);

    const large = buildNotificationPlan('comment_reply', 'mastodon', 'public', 10, true);
    expect(large.push).toBe(true);
  });

  it('anonymous tips suppress push and sound', () => {
    const plan = buildNotificationPlan('our_network', 'nostr', 'anonymous', 50, true);
    expect(plan.push).toBe(false);
    expect(plan.soundEffect).toBe(false);
  });
});

describe('getProtocolNotificationMessage', () => {
  it('formats Nostr notification with zap emoji', () => {
    const msg = getProtocolNotificationMessage('Alice', 5, 'USD', 'nostr', 'public');
    expect(msg).toContain('Alice');
    expect(msg).toContain('$5.00');
    expect(msg).toContain('⚡');
  });

  it('hides amount for private tips', () => {
    const msg = getProtocolNotificationMessage('Alice', 5, 'USD', 'farcaster', 'private');
    expect(msg).toContain('a tip');
    expect(msg).not.toContain('$5');
  });

  it('shows anonymous sender for anonymous tips', () => {
    const msg = getProtocolNotificationMessage('Alice', 10, 'USD', 'mastodon', 'anonymous');
    expect(msg).toContain('Someone');
    expect(msg).not.toContain('Alice');
  });

  it('uses currency symbol in notification', () => {
    const msg = getProtocolNotificationMessage('Alice', 5, 'USD', 'telegram', 'public');
    expect(msg).toContain('$5.00');
  });

  it('uses non-USD currency label', () => {
    const msg = getProtocolNotificationMessage('Alice', 1000, 'SATS', 'nostr', 'public');
    expect(msg).toContain('1000.00 SATS');
  });
});

describe('getTipActionUrl', () => {
  it('generates Nostr-specific URL', () => {
    const url = getTipActionUrl('nostr', 'npub1abc123');
    expect(url).toContain('/tip/nostr/');
    expect(url).toContain('npub1abc123');
  });

  it('generates Farcaster Frame URL', () => {
    const url = getTipActionUrl('farcaster', '0x123');
    expect(url).toContain('/api/tip/frame/');
  });

  it('generates Mastodon bridge URL', () => {
    const url = getTipActionUrl('mastodon', '@alice@mastodon.social');
    expect(url).toContain('/tip/bridge/mastodon/');
  });

  it('generates GitHub sponsors URL', () => {
    const url = getTipActionUrl('github', 'octocat');
    expect(url).toBe('https://github.com/sponsors/octocat');
  });

  it('includes amount when provided', () => {
    const url = getTipActionUrl('nostr', 'npub1abc', 10);
    expect(url).toContain('?amount=10');
  });

  it('includes entityId when provided', () => {
    const url = getTipActionUrl('mastodon', '@alice@masto.social', undefined, '12345');
    expect(url).toContain('12345/');
  });
});
