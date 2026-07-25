/**
 * @degenfeed/api-worker — Intelligent Tipping Engine
 *
 * Cross-platform, context-aware, per-network tipping intelligence.
 *
 * TASK 1 — Context-Aware Tip Routing: Determines optimal tipping approach
 *   based on WHERE content lives, WHAT options are available, and whether
 *   tipper/recipient are on our network.
 *
 * TASK 2 — Per-Protocol Tip Options: What tipping methods each protocol
 *   supports natively or via bridge.
 *
 * TASK 3 — Tip Amount Intelligence: Smart amount suggestions from content
 *   type, creator relationship, network context, user balance, history.
 *
 * TASK 4 — Tip Visibility Rules: Public, private, anonymous, protocol-respecting.
 *
 * TASK 5 — Tip Notifications: Context-aware multi-channel notification dispatch.
 *
 * @see ../routes/tip.ts — Ranked method resolution
 * @see ./tip-notifications.ts — Notification pipeline
 * @see ../routes/unified-tip-core.ts — Ledger recording
 */

import type { Protocol } from '@degenfeed/types';
import type { Env } from '../index';
import type { ResolvedTipMethod, TipPostContext } from '../routes/tip';
import {
  type SmartChainSelectionResult,
  type SupportedChain,
  selectBestChain,
} from '../routes/unified-tip-core';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/** Where the content being tipped lives */
export type ContentVenue =
  /** On our platform (DegenFeed) — full tipping menu */
  | 'our_network'
  /** On an external protocol (Lemmy, Mastodon, etc.) */
  | 'external_protocol'
  /** Cross-platform: viewing external content from DegenFeed */
  | 'cross_platform'
  /** Tipping a comment or reply */
  | 'comment_reply';

/** Tipping method identifiers */
export type TipMethod =
  | 'lightning'
  | 'lightning_zap'
  | 'evm'
  | 'solana'
  | 'creator_coin'
  | 'native'
  | 'usdc'
  | 'onchain_tip'
  | 'ethereum'
  | 'base'
  | 'farcaster_frame'
  | 'lens_collect'
  | 'link'
  | 'qr_code'
  | 'bridge'
  | 'plugin'
  | 'action'
  | 'sponsors'
  | 'custom';

/** Visibility level for a tip */
export type TipVisibility = 'public' | 'private' | 'anonymous';

/** Content category for tip amount suggestions */
export type ContentCategory =
  | 'post'
  | 'video'
  | 'live_stream'
  | 'newsletter'
  | 'comment'
  | 'audio_space';

/** User relationship to the creator they are tipping */
export type TipperRelationship = 'first_time' | 'casual' | 'regular' | 'super_fan';

/** Tip amount suggestion with rationale */
export interface TipSuggestion {
  /** Suggested amount in USD */
  amountUsd: number;
  /** Label for the suggestion button */
  label: string;
  /** Brief rationale for this suggestion */
  rationale: string;
  /** Whether this is the default/recommended suggestion */
  recommended: boolean;
}

/** Smart amount intelligence input */
export interface AmountIntelligenceInput {
  /** Category of content being tipped */
  contentCategory: ContentCategory;
  /** Relationship to the creator */
  relationship: TipperRelationship;
  /** Whether the tipper is on DegenFeed (lower fees) */
  onOurNetwork: boolean;
  /** The user's estimated balance in USD (from wallet detection) */
  userBalanceUsd?: number;
  /** Historical average tip amount in USD for this tipper */
  historicalAvgUsd?: number;
  /** Historical preferred amount on this specific protocol */
  protocolAvgUsd?: number;
}

/** Per-protocol tipping capabilities */
export interface ProtocolTipCapability {
  /** Protocol identifier */
  protocol: Protocol;
  /** Display name */
  label: string;
  /** Available tipping methods */
  methods: TipMethod[];
  /** Native method (protocol's own tipping mechanism) */
  nativeMethod: TipMethod | null;
  /** Method used when bridging through DegenFeed */
  bridgeMethod: TipMethod | null;
  /** Whether the protocol supports native tip visibility control */
  supportsVisibilityControl: boolean;
  /** Whether the protocol supports on-chain tips natively */
  supportsOnChain: boolean;
  /** Whether tips on this protocol can include a message */
  supportsMessage: boolean;
  /** Default fee tier for tips on this protocol */
  feeTier: 'free' | 'low' | 'medium' | 'high';
  /** Tips are routed through: 'native' | 'bridge' | 'link' | 'plugin' | 'frame' */
  routingStrategy: 'native' | 'bridge' | 'link' | 'plugin' | 'frame' | 'action' | 'qr';
  /** Protocol-specific tips/methods documentation */
  notes: string;
  /** Link to the mechanism for deeper documentation */
  docsUrl?: string;
}

/** Result of context-aware tip routing */
export interface TipRouteResult {
  /** The venue classification */
  venue: ContentVenue;
  /** The source protocol of the content */
  protocol: Protocol;
  /** Recommended tipping methods sorted by preference */
  methods: ResolvedTipMethod[];
  /** Which method is recommended as best */
  recommendedMethod: TipMethod | null;
  /** Best chain(s) for the tip */
  chainSuggestions: SmartChainSelectionResult[];
  /** Whether we should generate a tip link/QR instead of direct */
  requiresExternalAction: boolean;
  /** URL/link for external tip action (QR, redirect) */
  externalActionUrl?: string;
  /** Whether notification should be sent on the protocol */
  notifyOnProtocol: boolean;
  /** Visibility rules that apply to this route */
  defaultVisibility: TipVisibility;
}

/** Tip amount suggestion group */
export interface AmountSuggestionGroup {
  /** Quick presets (displayed as buttons) */
  presets: TipSuggestion[];
  /** Custom range: min and max reasonable values in USD */
  customRange: { minUsd: number; maxUsd: number };
  /** Suggested default amount in USD */
  defaultAmountUsd: number;
  /** Fee estimate for each chain sorted by cheapest */
  feeEstimates: Array<{ chain: string; feeUsd: number }>;
}

/** Record of a tip for visibility decision */
export interface TipRecordForVisibility {
  tipperId?: string;
  tipperDisplayName?: string;
  recipientId: string;
  recipientDisplayName?: string;
  amountUsd: number;
  currency: string;
  protocol: Protocol;
  method: TipMethod;
  entityId?: string;
  entityType?: string;
}

/** Visibility decision for a tip */
export interface TipVisibilityDecision {
  /** Who can see the amount */
  visibility: TipVisibility;
  /** Whether the tip appears on the leaderboard */
  appearsOnLeaderboard: boolean;
  /** How the tipper identity is displayed */
  tipperDisplay: 'full' | 'anonymous' | 'hidden';
  /** Display label for the visibility badge */
  badgeLabel: string;
  /** Whether the protocol can enforce this visibility */
  protocolEnforceable: boolean;
}

/** Notification channels available for a tip */
export interface TipNotificationPlan {
  /** Send in-app notification (DegenFeed bell) */
  inApp: boolean;
  /** Send push notification */
  push: boolean;
  /** Send WebSocket broadcast for real-time */
  websocket: boolean;
  /** Notify on the native protocol (Mastodon mention, Nostr zap, etc.) */
  protocolNative: boolean;
  /** Include in weekly email digest */
  emailDigest: boolean;
  /** Play a sound effect */
  soundEffect: boolean;
  /** Cross-platform notification (notify on the platform where tip originated) */
  crossPlatform: boolean;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TASK 2 — Per-Protocol Tip Options
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Complete per-protocol tipping capability matrix.
 *
 * | Protocol | Lightning | EVM | Solana | Creator Coin | Native |
 * |----------|-----------|-----|--------|-------------|--------|
 * | Nostr    | NIP-57    | ✅  | ✅     | ✅          | ✅ zap |
 * | Farcaster| ✅        | ✅ USDC | ✅ | ✅          | ✅ frame |
 * | Bluesky  | ✅        | ✅  | ✅     | ✅          | ✅ custom |
 * | Mastodon | ✅        | ✅  | ✅     | ✅          | ⚠️ bridge |
 * | Lemmy    | ✅        | ✅  | ✅     | ✅          | ⚠️ bridge |
 * | PeerTube | ✅        | ✅  | ✅     | ✅          | ✅ plugin |
 * | Owncast  | ✅        | ✅  | ✅     | ✅          | ✅ action |
 * | Reddit   | ✅        | ✅  | ✅     | ✅          | ⚠️ link   |
 * | GitHub   | ✅        | ✅  | ✅     | ✅          | ✅ sponsors |
 * | Lens     | ✅        | ✅  | ✅     | ✅          | ✅ collect |
 * | Threads  | ✅        | ✅  | ✅     | ✅          | ⚠️ bridge |
 * | Telegram | ✅        | ✅  | ✅     | ✅          | ⚠️ link   |
 * | YouTube  | ✅        | ✅  | ✅     | ✅          | ⚠️ link   |
 * | Zora     | ✅        | ✅  | ✅     | n/a         | ✅ mint   |
 * | Discord  | ✅        | ✅  | ✅     | ✅          | ⚠️ link   |
 */

const PROTOCOL_TIP_MATRIX: Record<string, ProtocolTipCapability> = {
  nostr: {
    protocol: 'nostr',
    label: 'Nostr',
    methods: ['lightning', 'lightning_zap', 'evm', 'solana', 'creator_coin', 'native'],
    nativeMethod: 'lightning_zap',
    bridgeMethod: null,
    supportsVisibilityControl: true,
    supportsOnChain: true,
    supportsMessage: true,
    feeTier: 'low',
    routingStrategy: 'native',
    notes:
      'NIP-57 zaps support Lightning tipping with optional DM notification. DegenFeed extends with EVM/Solana.',
    docsUrl: 'https://github.com/nostr-protocol/nips/blob/master/57.md',
  },
  farcaster: {
    protocol: 'farcaster',
    label: 'Farcaster',
    methods: ['lightning', 'evm', 'solana', 'creator_coin', 'native', 'usdc'],
    nativeMethod: 'farcaster_frame',
    bridgeMethod: null,
    supportsVisibilityControl: true,
    supportsOnChain: true,
    supportsMessage: true,
    feeTier: 'low',
    routingStrategy: 'frame',
    notes: 'Farcaster Frames enable embedded tipping UI. USDC on Base with near-zero fees.',
    docsUrl: 'https://docs.farcaster.xyz/learn/what-is-farcaster/frames',
  },
  bluesky: {
    protocol: 'bluesky',
    label: 'Bluesky',
    methods: ['lightning', 'evm', 'solana', 'creator_coin', 'custom'],
    nativeMethod: 'custom',
    bridgeMethod: 'qr_code',
    supportsVisibilityControl: false,
    supportsOnChain: false,
    supportsMessage: false,
    feeTier: 'medium',
    routingStrategy: 'qr',
    notes:
      'No native tipping on Bluesky. DegenFeed generates tip QR codes embedded in AT Protocol embed cards.',
  },
  mastodon: {
    protocol: 'mastodon',
    label: 'Mastodon',
    methods: ['lightning', 'evm', 'solana', 'creator_coin'],
    nativeMethod: null,
    bridgeMethod: 'bridge',
    supportsVisibilityControl: false,
    supportsOnChain: false,
    supportsMessage: true,
    feeTier: 'medium',
    routingStrategy: 'bridge',
    notes:
      'Mastodon has no native tipping. DegenFeed bridges tips via ActivityPub: tip recorded in ledger, optionally announced on Mastodon.',
  },
  lemmy: {
    protocol: 'lemmy',
    label: 'Lemmy',
    methods: ['lightning', 'evm', 'solana', 'creator_coin'],
    nativeMethod: null,
    bridgeMethod: 'bridge',
    supportsVisibilityControl: false,
    supportsOnChain: false,
    supportsMessage: true,
    feeTier: 'medium',
    routingStrategy: 'bridge',
    notes:
      'Lemmy has no native tipping. DegenFeed bridges tips — recorded in ledger, optionally announced as comment.',
  },
  peertube: {
    protocol: 'peertube',
    label: 'PeerTube',
    methods: ['lightning', 'evm', 'solana', 'creator_coin', 'native'],
    nativeMethod: 'plugin',
    bridgeMethod: null,
    supportsVisibilityControl: false,
    supportsOnChain: false,
    supportsMessage: true,
    feeTier: 'low',
    routingStrategy: 'plugin',
    notes:
      'PeerTube supports tipping plugins. DegenFeed provides a plugin that routes tips through our unified ledger.',
  },
  owncast: {
    protocol: 'owncast',
    label: 'Owncast',
    methods: ['lightning', 'evm', 'solana', 'creator_coin', 'native'],
    nativeMethod: 'action',
    bridgeMethod: null,
    supportsVisibilityControl: false,
    supportsOnChain: false,
    supportsMessage: true,
    feeTier: 'low',
    routingStrategy: 'action',
    notes:
      'Owncast supports custom actions. DegenFeed action endpoint for livestream tipping overlays.',
  },
  reddit: {
    protocol: 'reddit',
    label: 'Reddit',
    methods: ['lightning', 'evm', 'solana', 'creator_coin'],
    nativeMethod: null,
    bridgeMethod: 'link',
    supportsVisibilityControl: false,
    supportsOnChain: false,
    supportsMessage: false,
    feeTier: 'high',
    routingStrategy: 'link',
    notes:
      'No native tipping on Reddit. Generate DegenFeed tip link or QR code to share in comments.',
  },
  github: {
    protocol: 'github',
    label: 'GitHub',
    methods: ['lightning', 'evm', 'solana', 'creator_coin', 'native'],
    nativeMethod: 'sponsors',
    bridgeMethod: 'link',
    supportsVisibilityControl: false,
    supportsOnChain: false,
    supportsMessage: false,
    feeTier: 'free',
    routingStrategy: 'native',
    notes:
      'GitHub Sponsors for native. DegenFeed adds cross-chain tipping via issue/PR description tip links.',
    docsUrl: 'https://github.com/sponsors',
  },
  lens: {
    protocol: 'lens',
    label: 'Lens',
    methods: ['lightning', 'evm', 'solana', 'creator_coin', 'native'],
    nativeMethod: 'lens_collect',
    bridgeMethod: null,
    supportsVisibilityControl: true,
    supportsOnChain: true,
    supportsMessage: true,
    feeTier: 'low',
    routingStrategy: 'native',
    notes: 'Lens Collect module for paid posts. DegenFeed adds direct ETH/SOL tipping.',
  },
  threads: {
    protocol: 'threads',
    label: 'Threads',
    methods: ['lightning', 'evm', 'solana', 'creator_coin'],
    nativeMethod: null,
    bridgeMethod: 'bridge',
    supportsVisibilityControl: false,
    supportsOnChain: false,
    supportsMessage: false,
    feeTier: 'medium',
    routingStrategy: 'bridge',
    notes: 'Threads has no tipping. DegenFeed bridges via ActivityPub/AT Protocol when available.',
  },
  telegram: {
    protocol: 'telegram',
    label: 'Telegram',
    methods: ['lightning', 'evm', 'solana', 'creator_coin'],
    nativeMethod: null,
    bridgeMethod: 'link',
    supportsVisibilityControl: false,
    supportsOnChain: false,
    supportsMessage: true,
    feeTier: 'medium',
    routingStrategy: 'link',
    notes:
      'Telegram Stars for native payments (limited). DegenFeed generates tip links for Telegram bot integration.',
  },
  youtube: {
    protocol: 'youtube',
    label: 'YouTube',
    methods: ['lightning', 'evm', 'solana', 'creator_coin'],
    nativeMethod: null,
    bridgeMethod: 'link',
    supportsVisibilityControl: false,
    supportsOnChain: false,
    supportsMessage: false,
    feeTier: 'medium',
    routingStrategy: 'link',
    notes:
      'Super Chat for native tipping (Google takes 30%). DegenFeed provides cheaper cross-chain tip links.',
  },
  zora: {
    protocol: 'zora',
    label: 'Zora',
    methods: ['evm', 'lightning', 'solana', 'native'],
    nativeMethod: 'custom',
    bridgeMethod: null,
    supportsVisibilityControl: true,
    supportsOnChain: true,
    supportsMessage: true,
    feeTier: 'low',
    routingStrategy: 'native',
    notes:
      'Zora mints and creator coins. DegenFeed adds Lightning and multi-chain tipping to Zora posts.',
  },
};

/**
 * Get tipping capabilities for a specific protocol.
 * Falls back to sensible defaults for unlisted protocols.
 */
export function getProtocolCapability(protocol: string): ProtocolTipCapability {
  const cap = PROTOCOL_TIP_MATRIX[protocol];
  if (cap) return cap;

  // Sensible defaults for unknown protocols
  return {
    protocol: protocol as Protocol,
    label: protocol.charAt(0).toUpperCase() + protocol.slice(1),
    methods: ['lightning', 'evm', 'solana'],
    nativeMethod: null,
    bridgeMethod: 'bridge',
    supportsVisibilityControl: false,
    supportsOnChain: false,
    supportsMessage: false,
    feeTier: 'medium',
    routingStrategy: 'bridge',
    notes: `No native tipping support detected for ${protocol}. Bridging through DegenFeed unified ledger.`,
  };
}

/**
 * List all protocols with their tipping capabilities.
 */
export function listAllProtocolCapabilities(): ProtocolTipCapability[] {
  return Object.values(PROTOCOL_TIP_MATRIX);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TASK 1 — Context-Aware Tip Routing
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Classify the venue for a tipping interaction.
 *
 * @param protocol - The protocol the content lives on
 * @param isOnOurNetwork - Whether the user is on DegenFeed
 * @param isExternalViewing - Whether we're viewing cross-platform from DegenFeed
 * @param entityType - Type of content being tipped
 */
export function classifyVenue(
  protocol: string,
  isOnOurNetwork: boolean,
  isExternalViewing?: boolean,
  entityType?: string,
): ContentVenue {
  // Comment or reply regardless of venue
  if (entityType === 'comment' || entityType === 'reply') {
    return 'comment_reply';
  }

  // We own the experience
  if (isOnOurNetwork && protocol === 'degenfeed') {
    return 'our_network';
  }

  // Viewing external content through DegenFeed
  if (isExternalViewing && protocol !== 'degenfeed') {
    return 'cross_platform';
  }

  // Content on an external protocol
  if (!isOnOurNetwork || (protocol !== 'degenfeed' && isOnOurNetwork)) {
    return 'cross_platform';
  }

  return 'external_protocol';
}

/**
 * Context-aware tip routing — determines the optimal approach for a tip
 * based on where content is, what's available, and who the participants are.
 *
 * @param protocol - Protocol of the content being tipped
 * @param postContext - Author context with wallet addresses
 * @param venue - Classified venue
 * @param amountUsd - Desired tip amount in USD (for chain suggestions)
 * @param env - Environment for KV lookups
 */
export async function routeTip(
  protocol: string,
  postContext: TipPostContext | null,
  venue: ContentVenue,
  amountUsd?: number,
  env?: Env,
): Promise<TipRouteResult> {
  const capability = getProtocolCapability(protocol);
  const author = postContext?.author;

  // Determine default visibility based on venue
  const defaultVisibility = venue === 'our_network' ? 'public' : 'private';

  // Determine if we should notify on protocol
  const notifyOnProtocol = venue === 'cross_platform' || venue === 'external_protocol';

  // ── Build the external action URL (QR or link) if needed ──────────
  const requiresExternalAction =
    capability.routingStrategy === 'qr' || capability.routingStrategy === 'link';
  let externalActionUrl: string | undefined;

  if (requiresExternalAction && env) {
    const base = env.GOTOSOCIAL_INSTANCE_URL || 'https://degenfeed.xyz';
    const entityId = postContext?.authorId ?? '';
    const amt = amountUsd ? `?amount=${amountUsd}` : '';
    externalActionUrl = `${base}/tip/${encodeURIComponent(protocol)}/${encodeURIComponent(entityId)}${amt}`;
  }

  // ── Build method suggestions ───────────────────────────────────────
  const methods = buildContextualMethods(capability, postContext, venue, env);

  // ── Chain suggestions ──────────────────────────────────────────────
  const chainSuggestions = selectBestChain({
    senderChains: ['lightning', 'solana', 'base', 'ethereum'],
    recipientChains: [
      ...(author?.lightningAddress ? ['lightning' as SupportedChain] : []),
      ...(author?.evmAddress ? ['base' as SupportedChain, 'ethereum' as SupportedChain] : []),
      ...(author?.solanaAddress ? ['solana' as SupportedChain] : []),
    ],
    amountUsd: Math.max(0.01, amountUsd ?? 10),
    recipientHasLightning: !!author?.lightningAddress,
    recipientHasSolana: !!author?.solanaAddress,
    recipientHasEvm: !!author?.evmAddress,
  });

  // ── Pick recommended method ────────────────────────────────────────
  const available = methods.filter((m) => m.available);
  const recommendedMethod = (
    available.length > 0 ? available[0]?.method : null
  ) as TipMethod | null;

  return {
    venue,
    protocol: protocol as Protocol,
    methods,
    recommendedMethod,
    chainSuggestions,
    requiresExternalAction,
    externalActionUrl,
    notifyOnProtocol,
    defaultVisibility,
  };
}

/**
 * Build the list of available tip methods contextualized for the venue + protocol.
 */
function buildContextualMethods(
  capability: ProtocolTipCapability,
  postContext: TipPostContext | null,
  venue: ContentVenue,
  env?: Env,
): ResolvedTipMethod[] {
  const methods: ResolvedTipMethod[] = [];
  const author = postContext?.author;
  const instanceUrl = env?.GOTOSOCIAL_INSTANCE_URL || 'https://degenfeed.xyz';

  // Lightning (always offered when address available)
  if (venue === 'our_network' || capability.methods.includes('lightning')) {
    methods.push({
      method: 'lightning_zap',
      label: venue === 'our_network' ? 'Lightning (instant, < $0.001)' : 'Lightning',
      description: 'Bitcoin Lightning via Nostr — instant, near-zero fees, works globally',
      icon: '⚡',
      available: !!author?.lightningAddress || !!author?.nostrPubkey,
      address: author?.lightningAddress,
      minAmount: 0.00001,
      fee: '< $0.001',
      recommended: false,
      rank: 0,
    });
  }

  // EVM / on-chain (when address available)
  if (capability.methods.includes('evm')) {
    const onOurNetwork = venue === 'our_network';
    methods.push({
      method: 'onchain_tip',
      label: onOurNetwork ? 'Direct on-chain (0% fee, L2)' : 'Ethereum / EVM',
      description: onOurNetwork
        ? 'ETH via DegenFeed contract on Base — 0% fee, no intermediary, sub-cent gas'
        : 'Send ETH, USDC, or any ERC-20 on Ethereum, Optimism, Arbitrum, Polygon',
      icon: onOurNetwork ? '⛓️' : '◆',
      available: !!author?.evmAddress,
      address: author?.evmAddress,
      chain: 'base',
      minAmount: 0.0001,
      fee: onOurNetwork ? '0% (L2 gas only)' : '~$0.05-5 (varies by chain)',
      recommended: false,
      rank: 2,
    });
  }

  // Base L2 (cheap, fast)
  if (capability.methods.includes('usdc') || venue === 'our_network') {
    methods.push({
      method: 'base',
      label: 'Base (USDC/ETH)',
      description: 'Send USDC or ETH on Base L2 — sub-cent fees, fast settlement',
      icon: '🔵',
      available: !!author?.evmAddress,
      address: author?.evmAddress,
      chain: 'base',
      minAmount: 0.0001,
      fee: '< $0.01',
      recommended: false,
      rank: 1,
    });
  }

  // Solana (when address available)
  if (capability.methods.includes('solana')) {
    methods.push({
      method: 'solana',
      label: 'Solana',
      description: 'Send SOL, USDC, or any SPL token — sub-cent fees, fast',
      icon: '◎',
      available: !!author?.solanaAddress,
      address: author?.solanaAddress,
      chain: 'solana',
      minAmount: 0.001,
      fee: '< $0.01',
      recommended: false,
      rank: 3,
    });
  }

  // Creator Coins (when capability allows)
  if (capability.methods.includes('creator_coin')) {
    methods.push({
      method: 'creator_coin',
      label: 'Creator Coin',
      description: 'Buy and tip creator-branded coins — support while investing',
      icon: '🪙',
      available: false, // Resolved dynamically when creator has coins
      fee: 'Low (varies)',
      recommended: false,
      rank: 5,
    });
  }

  // Protocol-native method
  if (capability.nativeMethod) {
    const nativeLabel = getNativeLabel(capability);
    methods.push({
      method: capability.nativeMethod,
      label: nativeLabel,
      description: `Native ${capability.label} tipping mechanism`,
      icon: getNativeIcon(capability),
      available: true,
      minAmount: 0,
      fee: capability.feeTier === 'free' ? 'Free' : capability.feeTier === 'low' ? 'Low' : 'Varies',
      recommended: false,
      rank: -1, // Native methods get top priority
    });

    // If it's a Farcaster frame, add action URL
    if (capability.nativeMethod === 'farcaster_frame' && postContext?.authorId) {
      methods[methods.length - 1].actionUrl =
        `${instanceUrl}/api/tip/frame/${encodeURIComponent(postContext.authorId)}`;
    }
  }

  // Bridge method for external protocols
  if (capability.bridgeMethod && venue !== 'our_network') {
    methods.push({
      method: 'bridge',
      label: `DegenFeed Bridge (${capability.label})`,
      description: `Send via DegenFeed's unified bridge — recorded on-ledger, optionally posted on ${capability.label}`,
      icon: '🌉',
      available: true,
      fee: '< $0.01',
      recommended: false,
      rank: 4,
    });
  }

  // Sort by rank
  methods.sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99));

  // Mark first available as recommended
  const firstAvailable = methods.find((m) => m.available);
  if (firstAvailable) {
    return methods.map((m) =>
      m.method === firstAvailable.method ? { ...m, recommended: true } : m,
    );
  }

  return methods;
}

function getNativeLabel(capability: ProtocolTipCapability): string {
  switch (capability.protocol) {
    case 'nostr':
      return '⚡ Zap (NIP-57)';
    case 'farcaster':
      return '◈ Tip Frame';
    case 'lens':
      return '◎ Lens Collect';
    case 'github':
      return '🐙 GitHub Sponsors';
    case 'peertube':
      return '🎬 PeerTube Plugin';
    case 'owncast':
      return '📡 Owncast Action';
    case 'zora':
      return '🎨 Zora Mint';
    default:
      return `Native ${capability.label} Tip`;
  }
}

function getNativeIcon(capability: ProtocolTipCapability): string {
  switch (capability.protocol) {
    case 'nostr':
      return '⚡';
    case 'farcaster':
      return '◈';
    case 'lens':
      return '◎';
    case 'github':
      return '🐙';
    case 'peertube':
      return '🎬';
    case 'owncast':
      return '📡';
    case 'zora':
      return '🎨';
    default:
      return '🔗';
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TASK 3 — Tip Amount Intelligence
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Content type → USD range mapping.
 * First tip on a post → lower end. Frequent tipper → can suggest higher.
 */
const CONTENT_AMOUNT_RANGES: Record<
  ContentCategory,
  { minUsd: number; maxUsd: number; defaultUsd: number }
> = {
  post: { minUsd: 0.5, maxUsd: 10, defaultUsd: 2 },
  video: { minUsd: 1, maxUsd: 25, defaultUsd: 5 },
  live_stream: { minUsd: 2, maxUsd: 50, defaultUsd: 10 },
  newsletter: { minUsd: 2, maxUsd: 100, defaultUsd: 10 },
  comment: { minUsd: 0.25, maxUsd: 5, defaultUsd: 1 },
  audio_space: { minUsd: 1, maxUsd: 25, defaultUsd: 5 },
};

/** Relationship multipliers applied to the default amount */
const RELATIONSHIP_MULTIPLIERS: Record<TipperRelationship, number> = {
  first_time: 0.5,
  casual: 1.0,
  regular: 1.5,
  super_fan: 3.0,
};

/** Network context discount/premium */
const NETWORK_MULTIPLIERS: Record<string, number> = {
  our_network: 1.2, // Lower fees → can tip more
  external: 0.8, // Higher friction → suggest conservative
  cross_platform: 1.0,
};

/**
 * Generate smart tip amount suggestions based on:
 * 1. Content type
 * 2. Creator relationship
 * 3. Network context
 * 4. User balance
 * 5. Historical tips
 */
export function generateTipSuggestions(input: AmountIntelligenceInput): AmountSuggestionGroup {
  const range = CONTENT_AMOUNT_RANGES[input.contentCategory] ?? CONTENT_AMOUNT_RANGES.post;
  const relationshipMultiplier =
    RELATIONSHIP_MULTIPLIERS[input.relationship] ?? RELATIONSHIP_MULTIPLIERS.casual;
  const networkMultiplier = input.onOurNetwork
    ? NETWORK_MULTIPLIERS.our_network
    : NETWORK_MULTIPLIERS.external;

  // Calculate baseline
  const baselineUsd = range.defaultUsd * relationshipMultiplier * networkMultiplier;

  // Clamp to range
  const clampedBaseline = Math.min(Math.max(baselineUsd, range.minUsd), range.maxUsd);

  // Respect user balance if known
  const balanceCap = input.userBalanceUsd
    ? Math.min(input.userBalanceUsd, input.userBalanceUsd * 0.25) // Max 25% of balance
    : Infinity;

  // Historical average override
  const historicalOverride = input.historicalAvgUsd ?? input.protocolAvgUsd;

  // Final default
  const defaultAmountUsd = historicalOverride
    ? Math.min(historicalOverride * 1.2, balanceCap, range.maxUsd)
    : Math.min(clampedBaseline, balanceCap);

  // Build presets (3 buttons)
  const presets: TipSuggestion[] = [];

  // Small: 50% of default
  presets.push({
    amountUsd: Math.round(Math.min(defaultAmountUsd * 0.5, balanceCap) * 100) / 100,
    label: input.relationship === 'first_time' ? '👋 Say hi' : '🙏 Small',
    rationale:
      input.relationship === 'first_time'
        ? 'Perfect for a first tip — low commitment, high signal'
        : 'A small gesture of appreciation',
    recommended: false,
  });

  // Default (recommended)
  const presetsDefault = Math.max(0.25, Math.round(defaultAmountUsd * 100) / 100);
  presets.push({
    amountUsd: presetsDefault,
    label:
      input.relationship === 'first_time'
        ? '👍 Nice post'
        : input.relationship === 'regular'
          ? '❤️ Keep it up'
          : '✨ Great content',
    rationale: input.historicalAvgUsd
      ? `Based on your usual ${input.historicalAvgUsd < 2 ? 'generous' : input.historicalAvgUsd < 10 ? 'thoughtful' : 'whale'} tips`
      : input.relationship === 'first_time'
        ? 'A great way to start supporting this creator'
        : input.onOurNetwork
          ? 'Low fees mean more goes to the creator'
          : 'Reasonable amount for external tipping',
    recommended: true,
  });

  // Large: 3x default or max range
  presets.push({
    amountUsd: Math.min(
      Math.round(Math.min(defaultAmountUsd * 3, range.maxUsd, balanceCap) * 100) / 100,
      balanceCap === Infinity ? range.maxUsd : balanceCap,
    ),
    label: input.relationship === 'super_fan' ? '🐳 Whale mode' : '🚀 Extra',
    rationale: 'Make a bigger impact — this creator will notice',
    recommended: false,
  });

  // Deduplicate amounts
  const seen = new Set<number>();
  const dedupedPresets = presets.filter((p) => {
    const rounded = Math.round(p.amountUsd * 100);
    if (seen.has(rounded)) return false;
    seen.add(rounded);
    return true;
  });

  // Fee estimates
  const feeEstimates = [
    { chain: 'lightning', feeUsd: 0.001 },
    { chain: 'solana', feeUsd: 0.002 },
    { chain: 'base', feeUsd: 0.01 },
    { chain: 'polygon', feeUsd: 0.05 },
    { chain: 'arbitrum', feeUsd: 0.05 },
    { chain: 'optimism', feeUsd: 0.05 },
    { chain: 'ethereum', feeUsd: 5.0 },
  ];

  return {
    presets: dedupedPresets,
    customRange: {
      minUsd: range.minUsd,
      maxUsd: Math.min(range.maxUsd, balanceCap === Infinity ? range.maxUsd : balanceCap),
    },
    defaultAmountUsd: presetsDefault,
    feeEstimates,
  };
}

/**
 * Quick helper to get the right range for a content category string from
 * external content type metadata.
 */
export function contentCategoryFromString(type: string): ContentCategory {
  const normalized = type.toLowerCase().replace(/[^a-z_]/g, '');
  switch (normalized) {
    case 'video':
    case 'clip':
    case 'short':
      return 'video';
    case 'live':
    case 'stream':
    case 'live_stream':
    case 'broadcast':
      return 'live_stream';
    case 'newsletter':
    case 'article':
    case 'long_form':
      return 'newsletter';
    case 'comment':
    case 'reply':
      return 'comment';
    case 'space':
    case 'audio_space':
    case 'audio':
      return 'audio_space';
    default:
      return 'post';
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TASK 4 — Tip Visibility Rules
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Visibility badge labels for display.
 */
const VISIBILITY_BADGE_LABELS: Record<TipVisibility, string> = {
  public: '🌍 Public',
  private: '🔒 Private',
  anonymous: '👤 Anonymous',
};

/**
 * Determine the visibility rules for a tip based on:
 * 1. The protocol's native visibility capabilities
 * 2. The tipper's explicit preference
 * 3. Protocol norms (e.g., Nostr zaps can be private via NIP-57)
 *
 * @returns A visibility decision with display info and protocol enforceability.
 */
export function determineTipVisibility(
  tip: TipRecordForVisibility,
  preference?: TipVisibility,
): TipVisibilityDecision {
  const capability = getProtocolCapability(tip.protocol);
  const chosen = preference ?? 'public';

  // Validation: if the protocol doesn't support visibility control,
  // public becomes the only real option (we still respect the pref in
  // our ledger but can't enforce it on the protocol side).
  const protocolEnforceable = capability.supportsVisibilityControl || chosen === 'public';

  // Leaderboard appearance
  const appearsOnLeaderboard = chosen === 'public';

  // Tipper display mode
  const tipperDisplay =
    chosen === 'anonymous'
      ? 'hidden'
      : chosen === 'private'
        ? 'anonymous' // Amount hidden but name shown
        : 'full';

  return {
    visibility: chosen,
    appearsOnLeaderboard,
    tipperDisplay,
    badgeLabel: VISIBILITY_BADGE_LABELS[chosen],
    protocolEnforceable,
  };
}

/**
 * Check if a tip visibility is compatible with a protocol's capabilities.
 * Returns true if the requested visibility can be honored.
 */
export function canEnforceVisibility(protocol: string, visibility: TipVisibility): boolean {
  const capability = getProtocolCapability(protocol);
  if (visibility === 'public') return true;
  return capability.supportsVisibilityControl;
}

/**
 * Get display-safe tip amount string based on visibility.
 * - Public: shows the full amount
 * - Private: shows "Private tip" (only creator sees amount)
 * - Anonymous: hides both tipper and amount
 */
export function formatTipAmountForDisplay(
  amountUsd: number,
  visibility: TipVisibility,
  viewerIsRecipient: boolean,
): string {
  if (visibility === 'private' && !viewerIsRecipient) {
    return '🔒 Private tip';
  }
  if (visibility === 'anonymous' && !viewerIsRecipient) {
    return '👤 Anonymous tip';
  }
  return `$${amountUsd.toFixed(2)}`;
}

/**
 * Format the tipper identity for display based on visibility.
 */
export function formatTipperForDisplay(
  tipperName: string | undefined,
  tipperId: string | undefined,
  visibility: TipVisibility,
): string {
  switch (visibility) {
    case 'anonymous':
      return 'Anonymous';
    case 'private':
      return tipperName ?? tipperId?.slice(0, 6) ?? 'Someone';
    default:
      return tipperName ?? tipperId?.slice(0, 6) ?? 'Someone';
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TASK 5 — Tip Notifications
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Build a context-aware notification plan for a tip.
 *
 * Rules:
 * 1. On our network: In-app + WebSocket + sound + (push enabled)
 * 2. External protocol: Protocol-native notification + (in-app if user has DF account)
 * 3. Cross-platform: Both in-app + protocol-native + WebSocket
 * 4. Email digest: Weekly summary for all users with emailDigest pref
 */
export function buildNotificationPlan(
  venue: ContentVenue,
  protocol: string,
  visibility: TipVisibility,
  amountUsd: number,
  recipientHasDegenFeedAccount: boolean,
): TipNotificationPlan {
  const plan: TipNotificationPlan = {
    inApp: false,
    push: false,
    websocket: false,
    protocolNative: false,
    emailDigest: true,
    soundEffect: false,
    crossPlatform: false,
  };

  switch (venue) {
    case 'our_network': {
      // Full notification suite
      plan.inApp = true;
      plan.push = recipientHasDegenFeedAccount;
      plan.websocket = true;
      plan.soundEffect = amountUsd >= 1; // Sound only for tips >= $1
      plan.protocolNative = false; // Not needed — we ARE the protocol
      plan.emailDigest = true;
      plan.crossPlatform = false;
      break;
    }

    case 'cross_platform': {
      // Viewing Mastodon from DegenFeed → notify both
      plan.inApp = recipientHasDegenFeedAccount;
      plan.push = recipientHasDegenFeedAccount && amountUsd >= 5; // Push for larger tips
      plan.websocket = recipientHasDegenFeedAccount;
      plan.protocolNative = true; // Notify on the source protocol
      plan.soundEffect = recipientHasDegenFeedAccount && amountUsd >= 5;
      plan.emailDigest = true;
      plan.crossPlatform = true;

      // Protocol-specific tweaks for cross-platform notifications
      if (protocol === 'nostr') {
        plan.protocolNative = true; // NIP-57 zaps always trigger native
      } else if (protocol === 'github') {
        plan.protocolNative = false; // Don't spam GitHub with tip notifications
      }
      break;
    }

    case 'external_protocol': {
      // Tipping on external protocol directly
      plan.inApp = recipientHasDegenFeedAccount;
      plan.push = false; // Don't spam with push for external-only
      plan.websocket = recipientHasDegenFeedAccount;
      plan.protocolNative = true; // Primary notification is on-protocol
      plan.soundEffect = false;
      plan.emailDigest = recipientHasDegenFeedAccount;
      plan.crossPlatform = false;

      // Some protocols don't support native notifications effectively
      if (protocol === 'reddit' || protocol === 'youtube') {
        plan.protocolNative = false; // No reliable notification API
      }
      break;
    }

    case 'comment_reply': {
      // Tipping a comment — lighter notifications
      plan.inApp = recipientHasDegenFeedAccount;
      plan.push = recipientHasDegenFeedAccount && amountUsd >= 10; // Only push for meaningful amounts
      plan.websocket = false;
      plan.protocolNative = true; // Notify as reply on protocol
      plan.soundEffect = false;
      plan.emailDigest = true;
      plan.crossPlatform = venue === 'cross_platform';
      break;
    }
  }

  // Anonymous tips get minimal notifications (no tipper identity)
  if (visibility === 'anonymous') {
    plan.push = false;
    plan.soundEffect = false;
  }

  return plan;
}

/**
 * Get the protocol-specific notification message for a tip.
 * Used for protocol-native notifications (Mastodon mention, Nostr DM, etc.).
 */
export function getProtocolNotificationMessage(
  tipperLabel: string,
  amountUsd: number,
  currency: string,
  protocol: string,
  visibility: TipVisibility,
): string {
  const tipper = visibility === 'anonymous' ? 'Someone' : tipperLabel;
  const amount =
    visibility === 'private'
      ? 'a tip'
      : `${currency === 'USD' ? '$' : ''}${amountUsd.toFixed(2)}${currency !== 'USD' && currency !== '$' ? ` ${currency}` : ''}`;

  switch (protocol) {
    case 'nostr':
      return `${tipper} sent you ${amount} ⚡`;
    case 'farcaster':
      return `${tipper} framed you with ${amount}! ◈`;
    case 'mastodon':
    case 'lemmy':
    case 'threads':
    case 'bluesky':
      return `💜 ${tipper} tipped you ${amount} via DegenFeed!`;
    case 'telegram':
      return `🎁 ${tipper} sent ${amount}!`;
    case 'github':
      return `⭐ ${tipper} sponsored you with ${amount}!`;
    case 'peertube':
    case 'owncast':
      return `🎬 ${tipper} supported your content with ${amount}!`;
    default:
      return `💜 ${tipper} tipped you ${amount} on DegenFeed!`;
  }
}

/**
 * Platform-specific tip URL generation.
 * Generates a URL where the tip action happens based on protocol.
 */
export function getTipActionUrl(
  protocol: string,
  recipientId: string,
  amountUsd?: number,
  entityId?: string,
): string {
  const base = 'https://degenfeed.xyz';
  const amt = amountUsd ? `?amount=${amountUsd}` : '';
  const ent = entityId ? `${entityId}/` : '';

  switch (protocol) {
    case 'nostr':
      // Nostr zap — uses a relay-based flow via DegenFeed
      return `${base}/tip/nostr/${encodeURIComponent(recipientId)}${amt}`;
    case 'farcaster':
      // Farcaster Frame
      return `${base}/api/tip/frame/${encodeURIComponent(recipientId)}${amt}`;
    case 'mastodon':
    case 'lemmy':
      // ActivityPub bridge
      return `${base}/tip/bridge/${encodeURIComponent(protocol)}/${encodeURIComponent(recipientId)}/${ent}${amt}`;
    case 'bluesky':
      // AT Protocol embed card
      return `${base}/tip/bsky/${encodeURIComponent(recipientId)}${amt}`;
    case 'github':
      return `https://github.com/sponsors/${encodeURIComponent(recipientId)}`;
    case 'reddit':
    case 'telegram':
    case 'youtube':
      // Link-based tipping
      return `${base}/tip/link/${encodeURIComponent(protocol)}/${encodeURIComponent(recipientId)}${amt}`;
    default:
      return `${base}/tip/${encodeURIComponent(recipientId)}${amt}`;
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ROUTE HANDLER: GET /api/intelligent-tips/resolve
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { jsonResponse } from '../index';
import { hasSuspiciousPayload, sanitizeString } from '../sanitize';

/**
 * GET /api/intelligent-tips/resolve
 *
 * One-shot intelligent tip resolution: returns route, suggestions, visibility, and notification plan.
 *
 * Query params:
 *   protocol         — Content protocol (nostr, farcaster, etc.)
 *   authorId         — Author identifier
 *   isOnOurNetwork   — Whether the user is on DegenFeed (true/false)
 *   isExternalViewing — Whether viewing cross-platform (true/false)
 *   entityType       — Content type (post, video, comment, etc.)
 *   relation         — Tipper relationship (first_time, casual, regular, super_fan)
 *   userBalanceUsd   — Estimated user balance in USD
 *   amountUsd        — Desired tip amount in USD (optional, for chain suggestions)
 *   postContext      — JSON-encoded TipPostContext (optional)
 */
export async function handleIntelligentTipResolve(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const protocol = sanitizeString(url.searchParams.get('protocol'), 32);
  const authorId = sanitizeString(url.searchParams.get('authorId'), 256);
  const isOnOurNetwork = url.searchParams.get('isOnOurNetwork') === 'true';
  const isExternalViewing = url.searchParams.get('isExternalViewing') === 'true';
  const entityType = sanitizeString(url.searchParams.get('entityType'), 32) || 'post';
  const relationship = (sanitizeString(url.searchParams.get('relation'), 32) ||
    'casual') as TipperRelationship;
  const userBalanceUsd = Number.parseFloat(url.searchParams.get('userBalanceUsd') ?? 'NaN');
  const amountUsd = Number.parseFloat(url.searchParams.get('amountUsd') ?? 'NaN');
  const postContextParam = sanitizeString(url.searchParams.get('postContext'), 2048);

  if (!protocol || !authorId || hasSuspiciousPayload(`${protocol}${authorId}`)) {
    return jsonResponse({ error: 'protocol and authorId required' }, 400);
  }

  let postContext: TipPostContext | null = null;
  if (postContextParam) {
    try {
      const parsed = JSON.parse(postContextParam) as TipPostContext;
      if (typeof parsed.protocol === 'string' && typeof parsed.authorId === 'string') {
        postContext = parsed;
      }
    } catch {
      /* ignore */
    }
  }

  // 1. Classify venue
  const venue = classifyVenue(protocol, isOnOurNetwork, isExternalViewing, entityType);

  // 2. Route the tip
  const route = await routeTip(
    protocol,
    postContext,
    venue,
    Number.isFinite(amountUsd) ? amountUsd : undefined,
    env,
  );

  // 3. Generate amount suggestions
  const contentCategory = contentCategoryFromString(entityType);
  const relationshipTyped: TipperRelationship = [
    'first_time',
    'casual',
    'regular',
    'super_fan',
  ].includes(relationship)
    ? relationship
    : 'casual';
  const amountInput: AmountIntelligenceInput = {
    contentCategory,
    relationship: relationshipTyped,
    onOurNetwork: isOnOurNetwork,
    userBalanceUsd: Number.isFinite(userBalanceUsd) ? userBalanceUsd : undefined,
  };
  const suggestions = generateTipSuggestions(amountInput);

  // 4. Determine visibility
  const tipRecord: TipRecordForVisibility = {
    tipperId: postContext?.authorId,
    recipientId: authorId,
    amountUsd: Number.isFinite(amountUsd) ? amountUsd : suggestions.defaultAmountUsd,
    currency: 'USD',
    protocol: protocol as Protocol,
    method: route.recommendedMethod ?? 'lightning',
  };
  const visibility = determineTipVisibility(tipRecord);

  // 5. Build notification plan
  const notificationPlan = buildNotificationPlan(
    venue,
    protocol,
    visibility.visibility,
    amountInput.userBalanceUsd ?? suggestions.defaultAmountUsd,
    isOnOurNetwork,
  );

  // 6. Get protocol capability info
  const capability = getProtocolCapability(protocol);

  return jsonResponse({
    venue,
    protocol,
    route: {
      methods: route.methods,
      recommendedMethod: route.recommendedMethod,
      chainSuggestions: route.chainSuggestions,
      requiresExternalAction: route.requiresExternalAction,
      externalActionUrl: route.externalActionUrl,
      defaultVisibility: route.defaultVisibility,
    },
    capability: {
      nativeMethod: capability.nativeMethod,
      bridgeMethod: capability.bridgeMethod,
      routingStrategy: capability.routingStrategy,
      feeTier: capability.feeTier,
      supportsOnChain: capability.supportsOnChain,
      supportsMessage: capability.supportsMessage,
    },
    suggestions: {
      presets: suggestions.presets,
      customRange: suggestions.customRange,
      defaultAmountUsd: suggestions.defaultAmountUsd,
      feeEstimates: suggestions.feeEstimates,
    },
    visibility: {
      chosen: visibility.visibility,
      badgeLabel: visibility.badgeLabel,
      appearsOnLeaderboard: visibility.appearsOnLeaderboard,
      tipperDisplay: visibility.tipperDisplay,
      protocolEnforceable: visibility.protocolEnforceable,
    },
    notifications: notificationPlan,
    _links: {
      self: `/api/intelligent-tips/resolve?protocol=${encodeURIComponent(protocol)}&authorId=${encodeURIComponent(authorId)}`,
      tipAction:
        route.externalActionUrl ??
        getTipActionUrl(
          protocol,
          authorId,
          amountInput.userBalanceUsd ?? suggestions.defaultAmountUsd,
        ),
    },
  });
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ROUTE HANDLER: GET /api/intelligent-tips/protocols
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * GET /api/intelligent-tips/protocols
 *
 * Returns the full per-protocol tipping capability matrix.
 * Useful for the frontend to know what tipping options to show.
 */
export async function handleProtocolCapabilities(_request: Request): Promise<Response> {
  const capabilities = listAllProtocolCapabilities();

  return jsonResponse({
    protocols: capabilities.map((c) => ({
      protocol: c.protocol,
      label: c.label,
      nativeMethod: c.nativeMethod,
      bridgeMethod: c.bridgeMethod,
      routingStrategy: c.routingStrategy,
      feeTier: c.feeTier,
      supportsOnChain: c.supportsOnChain,
      supportsMessage: c.supportsMessage,
      notes: c.notes,
      docsUrl: c.docsUrl,
    })),
    count: capabilities.length,
  });
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ROUTE HANDLER: POST /api/intelligent-tips/suggest-amount
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { validateBodySize } from '../sanitize';

/**
 * POST /api/intelligent-tips/suggest-amount
 *
 * Body: { contentCategory, relationship, onOurNetwork, userBalanceUsd, historicalAvgUsd, protocolAvgUsd }
 *
 * Returns smart amount suggestions for a tip.
 */
export async function handleSuggestAmount(request: Request): Promise<Response> {
  const bodySizeCheck = validateBodySize(request, 2 * 1024);
  if (!bodySizeCheck.ok) return jsonResponse({ error: bodySizeCheck.error }, 413);

  try {
    const body = (await request.json()) as Partial<AmountIntelligenceInput> & {
      contentCategory?: string;
      relationship?: string;
    };

    const category = body.contentCategory
      ? contentCategoryFromString(body.contentCategory)
      : ((body.contentCategory as ContentCategory | undefined) ?? 'post');

    const relation = (body.relationship ?? 'casual') as TipperRelationship;
    if (!['first_time', 'casual', 'regular', 'super_fan'].includes(relation)) {
      return jsonResponse(
        { error: 'Invalid relationship. Must be: first_time, casual, regular, super_fan' },
        400,
      );
    }

    const input: AmountIntelligenceInput = {
      contentCategory: category,
      relationship: relation,
      onOurNetwork: body.onOurNetwork ?? false,
      userBalanceUsd: body.userBalanceUsd,
      historicalAvgUsd: body.historicalAvgUsd,
      protocolAvgUsd: body.protocolAvgUsd,
    };

    const suggestions = generateTipSuggestions(input);
    return jsonResponse(suggestions);
  } catch (err) {
    return jsonResponse({ error: String(err) }, 500);
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// EXPORT — Unified Intelligent Tip object
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const intelligentTips = {
  classifyVenue,
  routeTip,
  getProtocolCapability,
  listAllProtocolCapabilities,
  generateTipSuggestions,
  contentCategoryFromString,
  determineTipVisibility,
  canEnforceVisibility,
  formatTipAmountForDisplay,
  formatTipperForDisplay,
  buildNotificationPlan,
  getProtocolNotificationMessage,
  getTipActionUrl,
} as const;
