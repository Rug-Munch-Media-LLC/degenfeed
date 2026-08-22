/**
 * @degenfeed/api-worker — Intelligent Tips Implementation
 *
 * Context-aware tip routing: venue classification, protocol capabilities,
 * amount intelligence, visibility rules, notifications, action URLs.
 *
 * Implemented against the executable spec in src/__tests__/intelligent-tips.test.ts.
 */

// ── Venue classification ────────────────────────────────────────────

export type TipVenue = 'our_network' | 'cross_platform' | 'external_protocol' | 'comment_reply';

const OUR_NETWORK_PROTOCOLS = new Set(['degenfeed', 'df', 'owncast']);
const COMMENT_CONTENT_TYPES = new Set(['comment', 'reply']);

export function classifyVenue(
  protocol: string,
  hasDFAccount = false,
  viewedFromDegenfeed = false,
  contentType?: string,
): TipVenue {
  // Comments/replies carry their own venue regardless of origin
  if (contentType && COMMENT_CONTENT_TYPES.has(contentType)) return 'comment_reply';
  if (hasDFAccount && OUR_NETWORK_PROTOCOLS.has(protocol.toLowerCase())) return 'our_network';
  return 'cross_platform';
}

// ── Protocol capabilities ───────────────────────────────────────────

export interface ProtocolCapability {
  protocol: string;
  nativeMethod: string | null;
  bridgeMethod: 'bridge' | 'link' | null;
  routingStrategy: 'native' | 'bridge' | 'link' | 'frame';
  feeTier: 'free' | 'low' | 'medium' | 'high';
  methods: string[];
  supportsVisibilityControl: boolean;
  supportsOnChain: boolean;
  supportsMessage: boolean;
}

interface CapabilitySpec {
  nativeMethod: string | null;
  bridgeMethod: 'bridge' | 'link' | null;
  feeTier: ProtocolCapability['feeTier'];
  methods: string[];
  supportsVisibilityControl?: boolean;
  supportsOnChain?: boolean;
  supportsMessage?: boolean;
}

const CAPABILITIES: Record<string, CapabilitySpec> = {
  nostr: {
    nativeMethod: 'lightning_zap',
    bridgeMethod: null,
    feeTier: 'low',
    methods: ['lightning', 'evm', 'solana', 'creator_coin', 'native'],
    supportsVisibilityControl: true,
    supportsOnChain: true,
    supportsMessage: true,
  },
  farcaster: {
    nativeMethod: 'farcaster_frame',
    bridgeMethod: null,
    feeTier: 'low',
    methods: ['usdc', 'evm', 'creator_coin'],
    supportsVisibilityControl: true,
    supportsOnChain: true,
    supportsMessage: true,
  },
  lens: {
    nativeMethod: 'lens_mirror',
    bridgeMethod: null,
    feeTier: 'low',
    methods: ['evm', 'creator_coin'],
    supportsVisibilityControl: true,
    supportsOnChain: true,
    supportsMessage: true,
  },
  telegram: {
    nativeMethod: 'telegram_star',
    bridgeMethod: null,
    feeTier: 'medium',
    methods: ['evm', 'solana', 'creator_coin'],
    supportsVisibilityControl: true,
    supportsOnChain: false,
    supportsMessage: true,
  },
  bluesky: {
    nativeMethod: null,
    bridgeMethod: 'bridge',
    feeTier: 'medium',
    methods: ['lightning', 'evm', 'solana'],
    supportsVisibilityControl: false,
    supportsOnChain: false,
    supportsMessage: false,
  },
  mastodon: {
    nativeMethod: null,
    bridgeMethod: 'bridge',
    feeTier: 'medium',
    methods: ['lightning', 'evm', 'solana'],
    supportsVisibilityControl: false,
    supportsOnChain: false,
    supportsMessage: false,
  },
  lemmy: {
    nativeMethod: null,
    bridgeMethod: 'bridge',
    feeTier: 'medium',
    methods: ['lightning', 'evm', 'solana'],
    supportsVisibilityControl: false,
    supportsOnChain: false,
    supportsMessage: false,
  },
  peertube: {
    nativeMethod: null,
    bridgeMethod: 'bridge',
    feeTier: 'medium',
    methods: ['lightning', 'evm', 'solana'],
    supportsVisibilityControl: false,
    supportsOnChain: false,
    supportsMessage: false,
  },
  owncast: {
    nativeMethod: 'lightning_boost',
    bridgeMethod: null,
    feeTier: 'low',
    methods: ['lightning', 'evm', 'solana'],
    supportsVisibilityControl: false,
    supportsOnChain: false,
    supportsMessage: true,
  },
  reddit: {
    nativeMethod: null,
    bridgeMethod: 'link',
    feeTier: 'high',
    methods: ['lightning', 'evm', 'solana'],
    supportsVisibilityControl: false,
    supportsOnChain: false,
    supportsMessage: false,
  },
  youtube: {
    nativeMethod: null,
    bridgeMethod: 'link',
    feeTier: 'high',
    methods: ['lightning', 'evm', 'solana'],
    supportsVisibilityControl: false,
    supportsOnChain: false,
    supportsMessage: false,
  },
  github: {
    nativeMethod: 'sponsors',
    bridgeMethod: null,
    feeTier: 'free',
    methods: ['fiat_sponsors'],
    supportsVisibilityControl: false,
    supportsOnChain: false,
    supportsMessage: false,
  },
  zora: {
    nativeMethod: 'zora_mint',
    bridgeMethod: null,
    feeTier: 'low',
    methods: ['evm', 'creator_coin'],
    supportsVisibilityControl: true,
    supportsOnChain: true,
    supportsMessage: true,
  },
};

const DEFAULT_METHODS = ['lightning', 'evm', 'solana'];

export function getProtocolCapability(protocol: string): ProtocolCapability {
  const spec = CAPABILITIES[protocol];
  if (!spec) {
    return {
      protocol,
      nativeMethod: null,
      bridgeMethod: 'bridge',
      routingStrategy: 'bridge',
      feeTier: 'medium',
      methods: [...DEFAULT_METHODS],
      supportsVisibilityControl: false,
      supportsOnChain: false,
      supportsMessage: false,
    };
  }
  const strategyOverrides: Record<string, ProtocolCapability['routingStrategy']> = {
    farcaster: 'frame',
  };
  return {
    protocol,
    nativeMethod: spec.nativeMethod,
    bridgeMethod: spec.bridgeMethod,
    routingStrategy:
      strategyOverrides[protocol] ??
      (spec.nativeMethod ? 'native' : (spec.bridgeMethod ?? 'bridge')),
    feeTier: spec.feeTier,
    methods: [...spec.methods],
    supportsVisibilityControl: spec.supportsVisibilityControl ?? false,
    supportsOnChain: spec.supportsOnChain ?? false,
    supportsMessage: spec.supportsMessage ?? false,
  };
}

export function listAllProtocolCapabilities(): ProtocolCapability[] {
  return Object.keys(CAPABILITIES).map(getProtocolCapability);
}

// ── Content categories ──────────────────────────────────────────────

export type AmountContentCategory =
  | 'post'
  | 'video'
  | 'live_stream'
  | 'newsletter'
  | 'comment'
  | 'audio_space';

const CATEGORY_ALIASES: Record<string, AmountContentCategory> = {
  post: 'post',
  video: 'video',
  clip: 'video',
  short: 'video',
  live_stream: 'live_stream',
  stream: 'live_stream',
  newsletter: 'newsletter',
  article: 'newsletter',
  comment: 'comment',
  reply: 'comment',
  audio_space: 'audio_space',
  space: 'audio_space',
};

export function contentCategoryFromString(s: string): AmountContentCategory {
  return CATEGORY_ALIASES[s] ?? 'post';
}

// ── Tip amount intelligence ─────────────────────────────────────────

export interface AmountIntelligenceInput {
  contentCategory: AmountContentCategory;
  relationship?: 'first_time' | 'casual' | 'regular' | 'super_fan';
  onOurNetwork?: boolean;
  userBalanceUsd?: number;
  historicalAvgUsd?: number;
  protocolAvgUsd?: number;
}

export interface TipPreset {
  amountUsd: number;
  label: string;
  rationale: string;
  recommended: boolean;
}

export interface FeeEstimate {
  chain: string;
  feeUsd: number;
  feePercent: number;
}

export interface CustomRange {
  minUsd: number;
  maxUsd: number;
}

export interface AmountIntelligenceResult {
  presets: TipPreset[];
  defaultAmountUsd: number;
  feeEstimates: FeeEstimate[];
  customRange: CustomRange;
}

const CATEGORY_BASE: Record<AmountContentCategory, { base: number; min: number; max: number }> = {
  post: { base: 2, min: 0.5, max: 10 },
  video: { base: 3, min: 1, max: 25 },
  live_stream: { base: 4, min: 1, max: 25 },
  newsletter: { base: 4, min: 1, max: 20 },
  comment: { base: 1, min: 0.25, max: 5 },
  audio_space: { base: 3, min: 1, max: 15 },
};

const RELATIONSHIP_MULTIPLIER: Record<string, number> = {
  first_time: 0.75,
  casual: 1,
  regular: 1.25,
  super_fan: 1.6,
};

export function generateTipSuggestions(input: AmountIntelligenceInput): AmountIntelligenceResult {
  const cat = CATEGORY_BASE[input.contentCategory] ?? CATEGORY_BASE.post;
  const relMul = RELATIONSHIP_MULTIPLIER[input.relationship ?? 'casual'] ?? 1;
  const networkMul = input.onOurNetwork ? 1.2 : 1;

  let baseline = cat.base * relMul * networkMul;

  // Historical average overrides baseline; protocol average is a softer signal
  if (input.historicalAvgUsd && input.historicalAvgUsd > 0) {
    baseline = Math.max(baseline, Math.min(input.historicalAvgUsd, cat.max));
  } else if (input.protocolAvgUsd && input.protocolAvgUsd > 0) {
    baseline = Math.max(baseline, Math.min(input.protocolAvgUsd, cat.max));
  }

  // Balance cap: never suggest more than 25% of the user's balance
  const balanceCap =
    input.userBalanceUsd !== undefined ? input.userBalanceUsd * 0.25 : Number.POSITIVE_INFINITY;

  const maxUsd = Math.min(cat.max, balanceCap);
  const minUsd = Math.min(cat.min, maxUsd);
  const defaultAmountUsd = Math.max(0.25, Math.min(baseline, maxUsd));

  // Three ascending presets around the default, deduplicated
  const raw = [defaultAmountUsd * 0.5, defaultAmountUsd, defaultAmountUsd * 2];
  const seen = new Set<number>();
  const amounts = raw
    .map((a) => Math.round(Math.max(0.25, Math.min(a, maxUsd)) * 100) / 100)
    .filter((a) => {
      if (seen.has(a)) return false;
      seen.add(a);
      return true;
    });

  while (amounts.length < 3) {
    const last = amounts[amounts.length - 1];
    if (last === undefined) break;
    const next = Math.round((last + 0.25) * 100) / 100;
    if (seen.has(next)) break;
    amounts.push(next);
  }

  const labels = ['Nice', 'Solid', 'Legend'];
  const rationales = [
    `${input.relationship ?? 'casual'} · ${input.contentCategory}`,
    `matches typical ${input.contentCategory} support`,
    input.onOurNetwork ? 'on our network — lower fees' : 'cross-network support',
  ];
  const presets: TipPreset[] = amounts.map((amountUsd, i) => ({
    amountUsd,
    label: labels[i] ?? `Tier ${i + 1}`,
    rationale: rationales[i] ?? '',
    recommended: i === 1 || amounts.length < 2,
  }));
  if (!presets.some((p) => p.recommended)) {
    const mid = presets[Math.floor(presets.length / 2)] ?? presets[0];
    if (mid) mid.recommended = true;
  }

  // Fee estimates, cheapest first
  const feeEstimates: FeeEstimate[] = [
    { chain: 'lightning', feeUsd: 0.01, feePercent: 0.1 },
    { chain: 'internal', feeUsd: 0.05, feePercent: 0.5 },
    { chain: 'base', feeUsd: 0.08, feePercent: 0.8 },
    { chain: 'solana', feeUsd: 0.1, feePercent: 1 },
    { chain: 'ethereum', feeUsd: 1.5, feePercent: 15 },
    { chain: 'polygon', feeUsd: 0.2, feePercent: 2 },
  ].sort((a, b) => a.feeUsd - b.feeUsd);

  return { presets, defaultAmountUsd, feeEstimates, customRange: { minUsd, maxUsd } };
}

// ── Visibility rules ────────────────────────────────────────────────

export type TipVisibility = 'public' | 'private' | 'anonymous';

const VISIBILITY_CONTROLLING_PROTOCOLS = new Set([
  'nostr',
  'farcaster',
  'lens',
  'zora',
  'telegram',
]);

export function canEnforceVisibility(protocol: string, visibility: TipVisibility): boolean {
  if (visibility === 'public') return true;
  return VISIBILITY_CONTROLLING_PROTOCOLS.has(protocol);
}

export interface TipRecordForVisibility {
  tipperId: string;
  tipperDisplayName?: string;
  recipientId: string;
  recipientDisplayName?: string;
  amountUsd: number;
  currency: string;
  protocol: string;
  method: string;
}

export interface VisibilityDecision {
  visibility: TipVisibility;
  appearsOnLeaderboard: boolean;
  tipperDisplay: 'full' | 'anonymous' | 'hidden';
  badgeLabel: string;
  protocolEnforceable: boolean;
}

export function determineTipVisibility(
  tip: TipRecordForVisibility,
  preference: TipVisibility = 'public',
): VisibilityDecision {
  const enforceable = canEnforceVisibility(tip.protocol, preference);
  const effective: TipVisibility = enforceable ? preference : 'public';

  switch (effective) {
    case 'private':
      return {
        visibility: 'private',
        appearsOnLeaderboard: false,
        tipperDisplay: 'anonymous',
        badgeLabel: '🔒 Private tip',
        protocolEnforceable: enforceable,
      };
    case 'anonymous':
      return {
        visibility: 'anonymous',
        appearsOnLeaderboard: false,
        tipperDisplay: 'hidden',
        badgeLabel: '👤 Anonymous tip',
        protocolEnforceable: enforceable,
      };
    default:
      return {
        visibility: 'public',
        appearsOnLeaderboard: true,
        tipperDisplay: 'full',
        badgeLabel: '🌐 Public tip',
        // Reports whether the REQUESTED preference was enforceable (public
        // always is; a non-enforceable private/anonymous falls back here).
        protocolEnforceable: enforceable || preference === 'public',
      };
  }
}

// ── Display formatting ──────────────────────────────────────────────

export function formatTipAmountForDisplay(
  amountUsd: number,
  visibility: TipVisibility,
  isRecipient: boolean,
): string {
  if (visibility === 'public' || isRecipient) {
    return `$${amountUsd.toFixed(2)}`;
  }
  if (visibility === 'private') return '🔒 Private tip';
  return '👤 Anonymous tip';
}

export function formatTipperForDisplay(
  name: string | undefined,
  id: string,
  visibility: TipVisibility,
): string {
  if (visibility === 'anonymous') return 'Anonymous';
  if (name) return name;
  return id.slice(0, 6);
}

// ── Notifications ───────────────────────────────────────────────────

export interface NotificationPlan {
  inApp: boolean;
  push: boolean;
  websocket: boolean;
  soundEffect: boolean;
  protocolNative: boolean;
  emailDigest: boolean;
  crossPlatform: boolean;
}

const NO_NATIVE_NOTIFICATION = new Set(['reddit', 'youtube', 'github']);

export function buildNotificationPlan(
  venue: TipVenue | 'comment_reply',
  protocol: string,
  visibility: TipVisibility,
  amountUsd: number,
  hasDFAccount: boolean,
): NotificationPlan {
  const anonymous = visibility === 'anonymous';
  const plan: NotificationPlan = {
    inApp: false,
    push: false,
    websocket: false,
    soundEffect: false,
    protocolNative: false,
    emailDigest: false,
    crossPlatform: false,
  };

  if (venue === 'our_network') {
    plan.inApp = true;
    plan.websocket = true;
    plan.push = hasDFAccount && !anonymous;
    plan.soundEffect = !anonymous && amountUsd >= 1;
    plan.emailDigest = true;
  } else if (venue === 'cross_platform') {
    plan.inApp = true;
    plan.websocket = true;
    plan.push = hasDFAccount && !anonymous;
    plan.soundEffect = !anonymous && amountUsd >= 1;
    plan.crossPlatform = true;
    plan.protocolNative = !NO_NATIVE_NOTIFICATION.has(protocol);
  } else if (venue === 'comment_reply') {
    plan.inApp = true;
    plan.push = hasDFAccount && !anonymous && amountUsd >= 5;
    plan.websocket = false;
    plan.protocolNative = !NO_NATIVE_NOTIFICATION.has(protocol);
  } else {
    // external_protocol: protocol-native is primary when it exists
    plan.protocolNative = !NO_NATIVE_NOTIFICATION.has(protocol);
  }
  return plan;
}

const PROTOCOL_TIP_EMOJI: Record<string, string> = {
  nostr: '⚡',
  farcaster: '🎮',
  telegram: '✈️',
  lens: '🌿',
  zora: '🎨',
};

export function getProtocolNotificationMessage(
  tipperName: string,
  amount: number,
  currency: string,
  protocol: string,
  visibility: TipVisibility,
): string {
  const sender = visibility === 'anonymous' ? 'Someone' : tipperName;
  const emoji = PROTOCOL_TIP_EMOJI[protocol] ?? '💰';
  const amountLabel =
    visibility === 'private'
      ? 'a tip'
      : currency === 'USD'
        ? `$${amount.toFixed(2)}`
        : `${amount.toFixed(2)} ${currency}`;
  return `${emoji} ${sender} tipped ${amountLabel}${visibility === 'public' ? ` via ${protocol}` : ''}`;
}

// ── Action URLs ─────────────────────────────────────────────────────

export function getTipActionUrl(
  protocol: string,
  entityId: string,
  amountUsd?: number,
  contentId?: string,
): string {
  let url: string;
  switch (protocol) {
    case 'nostr':
      url = `/tip/nostr/${entityId}`;
      break;
    case 'farcaster':
      url = `/api/tip/frame/${entityId}`;
      break;
    case 'github':
      return `https://github.com/sponsors/${entityId}`;
    case 'mastodon':
    case 'lemmy':
    case 'peertube':
    case 'bluesky':
      url = `/tip/bridge/${protocol}/${contentId ? `${contentId}/` : ''}${entityId}`;
      break;
    default:
      url = `/tip/${protocol}/${entityId}`;
  }
  if (amountUsd !== undefined) url += `?amount=${amountUsd}`;
  return url;
}
