'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

// ─── Feed Mix Configuration Types ─────────────────────────────

export interface ProtocolWeight {
  /** 0-100 weight for this protocol in the feed mix */
  weight: number;
  /** Min engagement threshold (0 = no filter) */
  minEngagement: number;
  /** Show only verified creators */
  verifiedOnly: boolean;
  /** Minimum content length (chars) */
  minContentLength: number;
}

export interface ContentTypeWeights {
  posts: number;
  images: number;
  videos: number;
  links: number;
  threads: number;
}

export interface FeedMixConfig {
  protocols: Record<string, ProtocolWeight>;
  contentTypes: ContentTypeWeights;
  qualityThresholds: {
    globalMinEngagement: number;
    hideLowQuality: boolean;
    hideThreshold: number;
    verifiedOnly: boolean;
    minContentLength: number;
  };
}

export interface SavedMix {
  id: string;
  name: string;
  description: string;
  config: FeedMixConfig;
}

export interface FeedPreset {
  id: string;
  name: string;
  description: string;
  icon: string;
  config: {
    freshnessPreference: number;
    creatorDiversity: number;
    exploreRatio: number;
    algorithmTransparent: boolean;
    recencyWeight: number;
    engagementWeight: number;
    contentTypes?: Record<string, number>;
  };
}

export const FEED_PRESETS: FeedPreset[] = [
  {
    id: 'tiktok-mode',
    name: 'TikTok Mode',
    description: 'Video-forward, rapid-fire content. Max freshness, low creator diversity.',
    icon: '🎵',
    config: { freshnessPreference: 90, creatorDiversity: 2, exploreRatio: 60, algorithmTransparent: false, recencyWeight: 2.5, engagementWeight: 3.0, contentTypes: { posts: 20, images: 30, videos: 100, links: 10, threads: 10 } },
  },
  {
    id: 'twitter-mode',
    name: 'Twitter Mode',
    description: 'Text-forward, chronological-leaning. Balanced discovery.',
    icon: '🐦',
    config: { freshnessPreference: 70, creatorDiversity: 5, exploreRatio: 30, algorithmTransparent: true, recencyWeight: 2.0, engagementWeight: 1.5, contentTypes: { posts: 100, images: 40, videos: 20, links: 30, threads: 40 } },
  },
  {
    id: 'discover-mode',
    name: 'Discover Mode',
    description: 'Explore-heavy. Maximize new creators, topics, and content types.',
    icon: '✨',
    config: { freshnessPreference: 40, creatorDiversity: 10, exploreRatio: 90, algorithmTransparent: true, recencyWeight: 1.0, engagementWeight: 2.0 },
  },
  {
    id: 'focus-mode',
    name: 'Focus Mode',
    description: 'Followed creators only. Minimum noise, maximum signal.',
    icon: '🎯',
    config: { freshnessPreference: 30, creatorDiversity: 3, exploreRatio: 5, algorithmTransparent: false, recencyWeight: 1.5, engagementWeight: 2.5 },
  },
];

// ─── Defaults ─────────────────────────────────────────────────

const DEFAULT_PROTOCOL_WEIGHT = 50;
const DEFAULT_PROTOCOL_QUALITY: Omit<ProtocolWeight, 'weight'> = {
  minEngagement: 0,
  verifiedOnly: false,
  minContentLength: 0,
};

export const PROTOCOLS = [
  { id: 'nostr', label: 'Nostr', icon: '⚡', color: '#8e30eb' },
  { id: 'farcaster', label: 'Farcaster', icon: '🟣', color: '#8a63d2' },
  { id: 'lens', label: 'Lens', icon: '🌿', color: '#abfe2c' },
  { id: 'bluesky', label: 'Bluesky', icon: '🦋', color: '#1185fe' },
  { id: 'mastodon', label: 'Mastodon', icon: '🐘', color: '#6364ff' },
  { id: 'reddit', label: 'Reddit', icon: '🔴', color: '#ff4500' },
  { id: 'rss', label: 'RSS', icon: '📰', color: '#ffa500' },
  { id: 'lemmy', label: 'Lemmy', icon: '🌲', color: '#22c55e' },
  { id: 'youtube', label: 'YouTube', icon: '▶️', color: '#ff0000' },
  { id: 'peertube', label: 'PeerTube', icon: '📺', color: '#f1680d' },
] as const;

export const CONTENT_TYPE_LABELS: Record<
  keyof ContentTypeWeights,
  { label: string; icon: string }
> = {
  posts: { label: 'Posts', icon: '📝' },
  images: { label: 'Images', icon: '🖼️' },
  videos: { label: 'Videos', icon: '🎬' },
  links: { label: 'Links', icon: '🔗' },
  threads: { label: 'Threads', icon: '🧵' },
};

export function getDefaultProtocols(): Record<string, ProtocolWeight> {
  const p: Record<string, ProtocolWeight> = {};
  for (const proto of PROTOCOLS) {
    p[proto.id] = { weight: DEFAULT_PROTOCOL_WEIGHT, ...DEFAULT_PROTOCOL_QUALITY };
  }
  return p;
}

export function getDefaultFeedMixConfig(): FeedMixConfig {
  return {
    protocols: getDefaultProtocols(),
    contentTypes: { posts: 50, images: 50, videos: 50, links: 50, threads: 50 },
    qualityThresholds: {
      globalMinEngagement: 0,
      hideLowQuality: false,
      hideThreshold: 1.0,
      verifiedOnly: false,
      minContentLength: 0,
    },
  };
}

// ─── Pre-built mixes ──────────────────────────────────────────

export const PREBUILT_MIXES: SavedMix[] = [
  {
    id: 'defi-heavy',
    name: 'DeFi Heavy',
    description: 'Maximize DeFi content from Farcaster, Reddit, and RSS',
    config: {
      protocols: {
        nostr: { weight: 40, ...DEFAULT_PROTOCOL_QUALITY },
        farcaster: { weight: 80, ...DEFAULT_PROTOCOL_QUALITY },
        lens: { weight: 50, ...DEFAULT_PROTOCOL_QUALITY },
        bluesky: { weight: 40, ...DEFAULT_PROTOCOL_QUALITY },
        mastodon: { weight: 30, ...DEFAULT_PROTOCOL_QUALITY },
        reddit: { weight: 80, ...DEFAULT_PROTOCOL_QUALITY },
        rss: { weight: 70, ...DEFAULT_PROTOCOL_QUALITY },
        lemmy: { weight: 30, ...DEFAULT_PROTOCOL_QUALITY },
        youtube: { weight: 50, ...DEFAULT_PROTOCOL_QUALITY },
        peertube: { weight: 20, ...DEFAULT_PROTOCOL_QUALITY },
      },
      contentTypes: { posts: 70, images: 30, videos: 40, links: 60, threads: 50 },
      qualityThresholds: {
        globalMinEngagement: 5,
        hideLowQuality: true,
        hideThreshold: 1.5,
        verifiedOnly: false,
        minContentLength: 0,
      },
    },
  },
  {
    id: 'nft-focus',
    name: 'NFT Focus',
    description: 'Visual-heavy feed from Lens, Twitter, and OpenSea RSS',
    config: {
      protocols: {
        nostr: { weight: 40, ...DEFAULT_PROTOCOL_QUALITY },
        farcaster: { weight: 60, ...DEFAULT_PROTOCOL_QUALITY },
        lens: { weight: 80, ...DEFAULT_PROTOCOL_QUALITY },
        bluesky: { weight: 50, ...DEFAULT_PROTOCOL_QUALITY },
        mastodon: { weight: 30, ...DEFAULT_PROTOCOL_QUALITY },
        reddit: { weight: 50, ...DEFAULT_PROTOCOL_QUALITY },
        rss: { weight: 60, ...DEFAULT_PROTOCOL_QUALITY },
        lemmy: { weight: 20, ...DEFAULT_PROTOCOL_QUALITY },
        youtube: { weight: 30, ...DEFAULT_PROTOCOL_QUALITY },
        peertube: { weight: 20, ...DEFAULT_PROTOCOL_QUALITY },
      },
      contentTypes: { posts: 50, images: 90, videos: 60, links: 40, threads: 30 },
      qualityThresholds: {
        globalMinEngagement: 3,
        hideLowQuality: true,
        hideThreshold: 1.0,
        verifiedOnly: false,
        minContentLength: 0,
      },
    },
  },
  {
    id: 'trading-signals',
    name: 'Trading Signals',
    description: 'Fast-moving trading chatter, alpha calls, and market analysis',
    config: {
      protocols: {
        nostr: { weight: 70, ...DEFAULT_PROTOCOL_QUALITY },
        farcaster: { weight: 90, ...DEFAULT_PROTOCOL_QUALITY },
        lens: { weight: 40, ...DEFAULT_PROTOCOL_QUALITY },
        bluesky: { weight: 60, ...DEFAULT_PROTOCOL_QUALITY },
        mastodon: { weight: 30, ...DEFAULT_PROTOCOL_QUALITY },
        reddit: { weight: 70, ...DEFAULT_PROTOCOL_QUALITY },
        rss: { weight: 30, ...DEFAULT_PROTOCOL_QUALITY },
        lemmy: { weight: 20, ...DEFAULT_PROTOCOL_QUALITY },
        youtube: { weight: 20, ...DEFAULT_PROTOCOL_QUALITY },
        peertube: { weight: 10, ...DEFAULT_PROTOCOL_QUALITY },
      },
      contentTypes: { posts: 90, images: 50, videos: 30, links: 70, threads: 40 },
      qualityThresholds: {
        globalMinEngagement: 10,
        hideLowQuality: true,
        hideThreshold: 2.0,
        verifiedOnly: false,
        minContentLength: 10,
      },
    },
  },
  {
    id: 'news-only',
    name: 'News Only',
    description: 'Long-form news, analysis, and newsletters only',
    config: {
      protocols: {
        nostr: { weight: 30, ...DEFAULT_PROTOCOL_QUALITY },
        farcaster: { weight: 40, ...DEFAULT_PROTOCOL_QUALITY },
        lens: { weight: 20, ...DEFAULT_PROTOCOL_QUALITY },
        bluesky: { weight: 40, ...DEFAULT_PROTOCOL_QUALITY },
        mastodon: { weight: 30, ...DEFAULT_PROTOCOL_QUALITY },
        reddit: { weight: 50, ...DEFAULT_PROTOCOL_QUALITY },
        rss: { weight: 100, ...DEFAULT_PROTOCOL_QUALITY },
        lemmy: { weight: 30, ...DEFAULT_PROTOCOL_QUALITY },
        youtube: { weight: 30, ...DEFAULT_PROTOCOL_QUALITY },
        peertube: { weight: 10, ...DEFAULT_PROTOCOL_QUALITY },
      },
      contentTypes: { posts: 80, images: 30, videos: 30, links: 90, threads: 60 },
      qualityThresholds: {
        globalMinEngagement: 5,
        hideLowQuality: true,
        hideThreshold: 1.0,
        verifiedOnly: false,
        minContentLength: 100,
      },
    },
  },
  {
    id: 'balanced',
    name: 'Balanced',
    description: 'The default — even mix across all protocols and content types',
    config: getDefaultFeedMixConfig(),
  },
];

// ─── Mock preview posts ───────────────────────────────────────

interface PreviewPost {
  protocol: string;
  protocolColor: string;
  icon: string;
  author: string;
  content: string;
  likes: number;
}

function generatePreviewPosts(config: FeedMixConfig): PreviewPost[] {
  // Sort protocols by weight descending, pick top 3
  const sorted = Object.entries(config.protocols)
    .filter(([, pw]) => pw.weight > 20)
    .sort(([, a], [, b]) => b.weight - a.weight);

  const topProtocols = sorted.slice(0, 3).map(([id]) => id);
  const meta = Object.fromEntries(PROTOCOLS.map((p) => [p.id, p]));

  const samples: Record<string, PreviewPost> = {
    nostr: {
      protocol: 'Nostr',
      protocolColor: '#8e30eb',
      icon: '⚡',
      author: 'PabloF7z',
      content:
        'Nostr relays now processing over 1M events/day. New relay discovery protocols are making the network more resilient than ever. Decentralization is working.',
      likes: 89,
    },
    farcaster: {
      protocol: 'Farcaster',
      protocolColor: '#8a63d2',
      icon: '🟣',
      author: 'dwr.eth',
      content:
        'The on-chain economy is accelerating. DegenFeed is bringing together content from every protocol — this is what an open social graph looks like. LFG.',
      likes: 142,
    },
    lens: {
      protocol: 'Lens',
      protocolColor: '#abfe2c',
      icon: '🌿',
      author: 'stani.lens',
      content:
        'Lens Protocol v2: gasless profiles, community moderation, and creator monetization. The next generation of decentralized social is here.',
      likes: 567,
    },
    bluesky: {
      protocol: 'Bluesky',
      protocolColor: '#1185fe',
      icon: '🦋',
      author: 'alice.bsky.social',
      content:
        'AT Protocol federation model deep dive is live. TL;DR: much simpler than people think. Open repo, come build with us.',
      likes: 234,
    },
    reddit: {
      protocol: 'Reddit',
      protocolColor: '#ff4500',
      icon: '🔴',
      author: 'u/crypto_maxi',
      content:
        "Daily discussion thread: BTC dominance rising as altcoins cool off. What's everyone buying during this dip?",
      likes: 345,
    },
    rss: {
      protocol: 'RSS',
      protocolColor: '#ffa500',
      icon: '📰',
      author: 'CoinDesk',
      content:
        'Bitcoin ETF Inflows Surge Past $1B Weekly as Institutional Adoption Accelerates — BlackRock and Fidelity lead the charge with record-breaking volumes.',
      likes: 123,
    },
    mastodon: {
      protocol: 'Mastodon',
      protocolColor: '#6364ff',
      icon: '🐘',
      author: 'mastodonuser',
      content:
        'Just migrated my DegenFeed identity to a new Mastodon instance. The cross-protocol identity linking made it seamless. This is the future of social.',
      likes: 56,
    },
  };

  return topProtocols.map((id) => {
    const s = samples[id];
    if (!s) {
      const m = meta[id];
      return {
        protocol: m?.label ?? id,
        protocolColor: m?.color ?? '#666',
        icon: m?.icon ?? '•',
        author: `${m?.label ?? id} user`,
        content: 'Content from this protocol in your mix.',
        likes: Math.floor(Math.random() * 100),
      };
    }
    return s;
  });
}

// ─── Topic configuration (existing) ───────────────────────────

export interface TopicDef {
  id: string;
  label: string;
  icon: string;
  color: string;
}

export const TOPICS: TopicDef[] = [
  { id: 'crypto', label: 'Crypto', icon: '₿', color: '#f59e0b' },
  { id: 'defi', label: 'DeFi', icon: 'D', color: '#6366f1' },
  { id: 'nft', label: 'NFT', icon: 'N', color: '#ec4899' },
  { id: 'ai', label: 'AI', icon: 'AI', color: '#06b6d4' },
  { id: 'tech', label: 'Tech', icon: '💻', color: '#3b82f6' },
  { id: 'science', label: 'Science', icon: '🔬', color: '#22d3ee' },
  { id: 'startups', label: 'Startups', icon: '🚀', color: '#f97316' },
  { id: 'regulation', label: 'Regulation', icon: '⚖', color: '#ef4444' },
  { id: 'security', label: 'Security', icon: '🔒', color: '#dc2626' },
  { id: 'macro', label: 'Macro', icon: '📈', color: '#10b981' },
  { id: 'memecoin', label: 'Memecoin', icon: '🐸', color: '#f97316' },
  { id: 'layer2', label: 'Layer 2', icon: '⧫', color: '#8b5cf6' },
  { id: 'stablecoin', label: 'Stablecoin', icon: '💲', color: '#22d3ee' },
  { id: 'etf', label: 'ETF', icon: '🏛', color: '#e879f9' },
  { id: 'onchain', label: 'Onchain', icon: 'O', color: '#34d399' },
  { id: 'gaming', label: 'Gaming', icon: '🎮', color: '#f43f5e' },
  { id: 'privacy', label: 'Privacy', icon: '🛡', color: '#a78bfa' },
  { id: 'mining', label: 'Mining', icon: '⛏', color: '#fb923c' },
];

export const DEFAULT_WEIGHT = 50;

export function getDefaultWeights(): Record<string, number> {
  const w: Record<string, number> = {};
  for (const t of TOPICS) w[t.id] = DEFAULT_WEIGHT;
  return w;
}

/** Number of topics with weight !== 50 */
export function countTunedTopics(weights: Record<string, number>): number {
  return Object.values(weights).filter((v) => v !== DEFAULT_WEIGHT).length;
}

/** Build the topic_weights query-string value: `defi:75,nft:30,ai:80` */
export function encodeTopicWeights(weights: Record<string, number>): string {
  return Object.entries(weights)
    .filter(([, v]) => v !== DEFAULT_WEIGHT)
    .map(([k, v]) => `${k}:${v}`)
    .join(',');
}

// ─── LocalStorage helpers ─────────────────────────────────────

const LS_FEED_MIX = 'df_feed_mix_config';
const LS_SAVED_MIXES = 'df_saved_mixes';

export function loadFeedMixConfig(): FeedMixConfig {
  if (typeof window === 'undefined') return getDefaultFeedMixConfig();
  try {
    const raw = localStorage.getItem(LS_FEED_MIX);
    if (raw) {
      const parsed = JSON.parse(raw) as FeedMixConfig;
      // Merge with defaults to handle any missing fields
      const defaults = getDefaultFeedMixConfig();
      return {
        protocols: { ...defaults.protocols, ...parsed.protocols },
        contentTypes: { ...defaults.contentTypes, ...parsed.contentTypes },
        qualityThresholds: { ...defaults.qualityThresholds, ...parsed.qualityThresholds },
      };
    }
  } catch {
    /* ignore */
  }
  return getDefaultFeedMixConfig();
}

export function saveFeedMixConfig(config: FeedMixConfig): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LS_FEED_MIX, JSON.stringify(config));
  } catch {
    /* quota */
  }
}

export function loadSavedMixes(): SavedMix[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LS_SAVED_MIXES);
    return raw ? (JSON.parse(raw) as SavedMix[]) : [];
  } catch {
    return [];
  }
}

export function saveSavedMixes(mixes: SavedMix[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LS_SAVED_MIXES, JSON.stringify(mixes));
  } catch {
    /* quota */
  }
}

// ─── Color helpers ────────────────────────────────────────────

function sliderGradient(weight: number): string {
  if (weight < 50) {
    const pct = Math.abs(weight - 50) / 50;
    return `linear-gradient(to right, transparent, rgba(239, 68, 68, ${pct * 0.7}))`;
  }
  if (weight > 50) {
    const pct = (weight - 50) / 50;
    return `linear-gradient(to right, transparent, rgba(34, 197, 94, ${pct * 0.7}))`;
  }
  return `linear-gradient(to right, transparent, rgba(107, 114, 128, 0.4))`;
}

function thumbColor(weight: number): string {
  if (weight < 30) return '#ef4444';
  if (weight <= 70) return '#6b7280';
  return '#22c55e';
}

function weightLabel(weight: number): string {
  if (weight <= 20) return 'Minimal';
  if (weight <= 40) return 'Reduced';
  if (weight <= 60) return 'Default';
  if (weight <= 80) return 'Boosted';
  return 'Max';
}

// ─── Tuner Section Types ──────────────────────────────────────

type TunerTab = 'topics' | 'mix' | 'quality' | 'algorithm' | 'mixes';

// ─── FeedTuner Props ──────────────────────────────────────────

interface FeedTunerProps {
  weights: Record<string, number>;
  onWeightsChange: (weights: Record<string, number>) => void;
  onApply: (weights: Record<string, number>) => void;
  onReset: () => void;
  onClose: () => void;
  /** Feed mix config for the mix builder tab */
  feedMixConfig?: FeedMixConfig;
  onFeedMixChange?: (config: FeedMixConfig) => void;
  onFeedMixApply?: (config: FeedMixConfig) => void;
  onFeedMixReset?: () => void;
  /** Saved mixes */
  savedMixes?: SavedMix[];
  onSaveMix?: (mix: SavedMix) => void;
  onLoadMix?: (mix: SavedMix) => void;
  onDeleteMix?: (id: string) => void;
  /** Algorithm transparency toggle */
  algorithmTransparent?: boolean;
  onAlgorithmTransparencyChange?: (value: boolean) => void;
  /** Content freshness (0-100) */
  freshnessPreference?: number;
  onFreshnessChange?: (value: number) => void;
  /** Creator diversity (1-10) */
  creatorDiversity?: number;
  onCreatorDiversityChange?: (value: number) => void;
  /** Explore vs exploit ratio (0-100) */
  exploreRatio?: number;
  onExploreRatioChange?: (value: number) => void;
  /** Active feed preset */
  activePreset?: string | null;
  onApplyPreset?: (presetId: string) => void;
  /** Feed presets catalog */
  feedPresets?: FeedPreset[];
}

export function FeedTuner({
  weights,
  onWeightsChange,
  onApply,
  onReset,
  onClose,
  feedMixConfig: externalFeedMixConfig,
  onFeedMixChange,
  onFeedMixApply,
  onFeedMixReset,
  savedMixes: externalSavedMixes,
  onSaveMix,
  onLoadMix,
  onDeleteMix,
  algorithmTransparent,
  onAlgorithmTransparencyChange,
  freshnessPreference,
  onFreshnessChange,
  creatorDiversity,
  onCreatorDiversityChange,
  exploreRatio,
  onExploreRatioChange,
  activePreset,
  onApplyPreset,
  feedPresets,
}: FeedTunerProps) {
  const [activeTab, setActiveTab] = useState<TunerTab>('topics');
  const [localWeights, setLocalWeights] = useState<Record<string, number>>(weights);
  const [localFeedMix, setLocalFeedMix] = useState<FeedMixConfig>(
    () => externalFeedMixConfig ?? loadFeedMixConfig(),
  );
  const [localSavedMixes, setLocalSavedMixes] = useState<SavedMix[]>(
    () => externalSavedMixes ?? loadSavedMixes(),
  );
  const [mixNameInput, setMixNameInput] = useState('');
  const [mixSavedToast, setMixSavedToast] = useState(false);
  const [mixCollapsed, setMixCollapsed] = useState(false);
  const [qualityCollapsed, setQualityCollapsed] = useState(false);
  const [localAlgorithmTransparent, setLocalAlgorithmTransparent] = useState(algorithmTransparent ?? false);
  const [localFreshness, setLocalFreshness] = useState(freshnessPreference ?? 50);
  const [localCreatorDiversity, setLocalCreatorDiversity] = useState(creatorDiversity ?? 5);
  const [localExploreRatio, setLocalExploreRatio] = useState(exploreRatio ?? 30);
  const [localActivePreset, setLocalActivePreset] = useState(activePreset ?? null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const previewPosts = useMemo(() => generatePreviewPosts(localFeedMix), [localFeedMix]);

  // Sync from parent
  useEffect(() => {
    setLocalWeights(weights);
  }, [weights]);

  useEffect(() => {
    if (externalFeedMixConfig) setLocalFeedMix(externalFeedMixConfig);
  }, [externalFeedMixConfig]);

  useEffect(() => {
    if (externalSavedMixes) setLocalSavedMixes(externalSavedMixes);
  }, [externalSavedMixes]);

  useEffect(() => {
    if (algorithmTransparent !== undefined) setLocalAlgorithmTransparent(algorithmTransparent);
  }, [algorithmTransparent]);
  useEffect(() => {
    if (freshnessPreference !== undefined) setLocalFreshness(freshnessPreference);
  }, [freshnessPreference]);
  useEffect(() => {
    if (creatorDiversity !== undefined) setLocalCreatorDiversity(creatorDiversity);
  }, [creatorDiversity]);
  useEffect(() => {
    if (exploreRatio !== undefined) setLocalExploreRatio(exploreRatio);
  }, [exploreRatio]);
  useEffect(() => {
    if (activePreset !== undefined) setLocalActivePreset(activePreset);
  }, [activePreset]);

  const tunedCount = countTunedTopics(localWeights);

  // ─── Topic slider handlers ─────────────────────────────────

  const handleSlider = useCallback(
    (topicId: string, value: number) => {
      const next = { ...localWeights, [topicId]: value };
      setLocalWeights(next);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        onWeightsChange(next);
      }, 200);
    },
    [localWeights, onWeightsChange],
  );

  // ─── Protocol mix handler ──────────────────────────────────

  const handleProtocolWeight = useCallback((protocolId: string, weight: number) => {
    setLocalFeedMix((prev) => ({
      ...prev,
      protocols: {
        ...prev.protocols,
        [protocolId]: { ...prev.protocols[protocolId], weight },
      },
    }));
  }, []);

  // ─── Content type handler ──────────────────────────────────

  const handleContentTypeWeight = useCallback((type: keyof ContentTypeWeights, value: number) => {
    setLocalFeedMix((prev) => ({
      ...prev,
      contentTypes: { ...prev.contentTypes, [type]: value },
    }));
  }, []);

  // ─── Quality threshold handlers ────────────────────────────

  const handleProtocolQuality = useCallback(
    (protocolId: string, field: keyof ProtocolWeight, value: number | boolean) => {
      setLocalFeedMix((prev) => ({
        ...prev,
        protocols: {
          ...prev.protocols,
          [protocolId]: { ...prev.protocols[protocolId], [field]: value },
        },
      }));
    },
    [],
  );

  const handleGlobalQuality = useCallback(
    (field: keyof FeedMixConfig['qualityThresholds'], value: number | boolean) => {
      setLocalFeedMix((prev) => ({
        ...prev,
        qualityThresholds: { ...prev.qualityThresholds, [field]: value },
      }));
    },
    [],
  );

  // ─── Save/Load mix ─────────────────────────────────────────

  const handleSaveCurrentMix = useCallback(() => {
    const name = mixNameInput.trim() || `Custom Mix ${localSavedMixes.length + 1}`;
    const mix: SavedMix = {
      id: `custom-${Date.now()}`,
      name,
      description: 'Your custom feed mix',
      config: localFeedMix,
    };
    const updated = [...localSavedMixes, mix];
    setLocalSavedMixes(updated);
    saveSavedMixes(updated);
    setMixNameInput('');
    setMixSavedToast(true);
    setTimeout(() => setMixSavedToast(false), 2500);
    onSaveMix?.(mix);
  }, [mixNameInput, localSavedMixes, localFeedMix, onSaveMix]);

  const handleLoadMix = useCallback(
    (mix: SavedMix) => {
      setLocalFeedMix(mix.config);
      saveFeedMixConfig(mix.config);
      onLoadMix?.(mix);
    },
    [onLoadMix],
  );

  const handleDeleteMix = useCallback(
    (id: string) => {
      const updated = localSavedMixes.filter((m) => m.id !== id);
      setLocalSavedMixes(updated);
      saveSavedMixes(updated);
      onDeleteMix?.(id);
    },
    [localSavedMixes, onDeleteMix],
  );

  // ─── Feed mix apply / reset ────────────────────────────────

  const handleMixApply = useCallback(() => {
    saveFeedMixConfig(localFeedMix);
    onFeedMixApply?.(localFeedMix);
  }, [localFeedMix, onFeedMixApply]);

  const handleMixReset = useCallback(() => {
    const defaults = getDefaultFeedMixConfig();
    setLocalFeedMix(defaults);
    saveFeedMixConfig(defaults);
    onFeedMixReset?.();
  }, [onFeedMixReset]);

  const handleAlgorithmReset = useCallback(() => {
    setLocalAlgorithmTransparent(false);
    setLocalFreshness(50);
    setLocalCreatorDiversity(5);
    setLocalExploreRatio(30);
    setLocalActivePreset(null);
    onAlgorithmTransparencyChange?.(false);
    onFreshnessChange?.(50);
    onCreatorDiversityChange?.(5);
    onExploreRatioChange?.(30);
  }, [onAlgorithmTransparencyChange, onFreshnessChange, onCreatorDiversityChange, onExploreRatioChange]);

  // ─── Immediate mix persist ─────────────────────────────────

  const _persistMixImmediately = useCallback(
    (config: FeedMixConfig) => {
      saveFeedMixConfig(config);
      onFeedMixChange?.(config);
    },
    [onFeedMixChange],
  );

  // ─── Tab navigation ────────────────────────────────────────

  const tunerTabs: { id: TunerTab; label: string; icon: string }[] = [
    { id: 'topics', label: 'Topics', icon: '🎚️' },
    { id: 'mix', label: 'Feed Mix', icon: '🔀' },
    { id: 'quality', label: 'Quality', icon: '🛡️' },
    { id: 'algorithm', label: 'Algorithm', icon: '🧠' },
    { id: 'mixes', label: 'Saved', icon: '💾' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center">
      <div
        className="flex w-full max-w-lg flex-col rounded-t-2xl border border-[var(--color-border)] bg-[var(--color-card)] shadow-2xl sm:rounded-2xl"
        style={{ maxHeight: '90vh' }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Tune your feed"
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-4">
          <div>
            <h2 className="text-base font-bold text-[var(--color-fg)]">🎛️ Feed Controls</h2>
            <p className="text-xs text-gray-500">
              Fine-tune every aspect of your feed
              {tunedCount > 0 && activeTab === 'topics' && (
                <span className="ml-1.5 text-degen-400">· {tunedCount} tuned</span>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-500 hover:bg-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors"
            aria-label="Close tuner"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path
                d="M12 4L4 12M4 4l8 8"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        {/* ── Sub-tabs ── */}
        <div
          className="flex border-b border-[var(--color-border)] px-5"
          role="tablist"
          aria-label="Tuner sections"
        >
          {tunerTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium transition-colors border-b-2 ${
                activeTab === tab.id
                  ? 'border-degen-500 text-[var(--color-fg)]'
                  : 'border-transparent text-gray-500 hover:text-gray-300'
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* ── Scrollable content ── */}
        <div className="flex-1 overflow-y-auto px-5 py-3" style={{ scrollbarWidth: 'thin' }}>
          {/* ═══ TAB 1: TOPICS (original tuner) ═══ */}
          {activeTab === 'topics' && (
            <div className="space-y-1">
              <p className="text-xs text-gray-500 mb-2">
                Slide to control what topics you see more or less of
              </p>
              {TOPICS.map((topic) => {
                const w = localWeights[topic.id] ?? DEFAULT_WEIGHT;
                return (
                  <div key={topic.id} className="topic-slider-group py-2">
                    <div className="flex items-center justify-between mb-1">
                      <label
                        htmlFor={`tuner-${topic.id}`}
                        className="flex items-center gap-2 text-sm font-medium text-[var(--color-fg)]"
                      >
                        <span style={{ color: topic.color }}>{topic.icon}</span>
                        <span>{topic.label}</span>
                      </label>
                      <div className="flex items-center gap-2">
                        <span
                          className="text-xs font-mono tabular-nums"
                          style={{ color: thumbColor(w) }}
                        >
                          {w}
                        </span>
                        <span className="text-[10px] text-gray-500 w-16 text-right">
                          {weightLabel(w)}
                        </span>
                      </div>
                    </div>
                    <div className="relative">
                      <div
                        className="absolute inset-0 rounded-full pointer-events-none"
                        style={{ background: sliderGradient(w) }}
                      />
                      <input
                        id={`tuner-${topic.id}`}
                        type="range"
                        min="0"
                        max="100"
                        step="1"
                        value={w}
                        onChange={(e) => handleSlider(topic.id, Number(e.target.value))}
                        className="tuner-slider relative w-full h-1.5 appearance-none rounded-full bg-gray-700 cursor-pointer accent-degen-500"
                        aria-label={`${topic.label} weight`}
                        style={
                          {
                            '--slider-thumb-color': thumbColor(w),
                            accentColor: thumbColor(w),
                          } as React.CSSProperties
                        }
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ═══ TAB 2: FEED MIX ═══ */}
          {activeTab === 'mix' && (
            <div className="space-y-5">
              {/* Protocol sliders */}
              <div>
                <button
                  type="button"
                  onClick={() => setMixCollapsed((c) => !c)}
                  className="flex items-center justify-between w-full text-sm font-semibold text-[var(--color-fg)] mb-2"
                >
                  <span>Protocol Mix</span>
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    aria-hidden="true"
                    className={`transition-transform ${mixCollapsed ? '-rotate-90' : ''}`}
                  >
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </button>
                <p className="text-[10px] text-gray-500 mb-2">
                  Set how much of your feed comes from each protocol (0-100%)
                </p>
                {!mixCollapsed && (
                  <div className="space-y-2">
                    {PROTOCOLS.map((proto) => {
                      const pw = localFeedMix.protocols[proto.id] ?? {
                        weight: DEFAULT_PROTOCOL_WEIGHT,
                        ...DEFAULT_PROTOCOL_QUALITY,
                      };
                      return (
                        <div key={proto.id} className="flex items-center gap-2">
                          <span
                            className="text-xs w-20 shrink-0 font-medium text-[var(--color-fg)]"
                            style={{ color: proto.color }}
                          >
                            {proto.icon} {proto.label}
                          </span>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            step="5"
                            value={pw.weight}
                            onChange={(e) => handleProtocolWeight(proto.id, Number(e.target.value))}
                            className="flex-1 h-1.5 cursor-pointer appearance-none rounded-full bg-gray-700 accent-degen-500"
                            aria-label={`${proto.label} mix weight`}
                          />
                          <span className="text-xs font-mono tabular-nums text-gray-400 w-8 text-right">
                            {pw.weight}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="border-t border-[var(--color-border)] pt-4">
                {/* Content type mix */}
                <p className="text-sm font-semibold text-[var(--color-fg)] mb-1">
                  Content Type Mix
                </p>
                <p className="text-[10px] text-gray-500 mb-2">
                  Control how much of each content type appears
                </p>
                <div className="space-y-2">
                  {(
                    Object.entries(CONTENT_TYPE_LABELS) as [
                      keyof ContentTypeWeights,
                      { label: string; icon: string },
                    ][]
                  ).map(([key, meta]) => (
                    <div key={key} className="flex items-center gap-2">
                      <span className="text-xs w-24 shrink-0 font-medium text-[var(--color-fg)]">
                        {meta.icon} {meta.label}
                      </span>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        step="5"
                        value={localFeedMix.contentTypes[key]}
                        onChange={(e) => handleContentTypeWeight(key, Number(e.target.value))}
                        className="flex-1 h-1.5 cursor-pointer appearance-none rounded-full bg-gray-700 accent-degen-500"
                        aria-label={`${meta.label} weight`}
                      />
                      <span className="text-xs font-mono tabular-nums text-gray-400 w-8 text-right">
                        {localFeedMix.contentTypes[key]}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ═══ TAB 3: QUALITY THRESHOLDS ═══ */}
          {activeTab === 'quality' && (
            <div className="space-y-5">
              {/* Global quality */}
              <div>
                <p className="text-sm font-semibold text-[var(--color-fg)] mb-3">
                  Global Quality Settings
                </p>
                <div className="space-y-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-muted)]/30 p-3">
                  {/* Hide low quality */}
                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="text-xs font-medium text-[var(--color-fg)]">
                      Hide low-quality posts
                    </span>
                    <input
                      type="checkbox"
                      checked={localFeedMix.qualityThresholds.hideLowQuality}
                      onChange={(e) => handleGlobalQuality('hideLowQuality', e.target.checked)}
                      className="h-4 w-4 rounded border-white/20 bg-[var(--color-muted)] text-degen-500 focus:ring-degen-500"
                    />
                  </label>

                  {localFeedMix.qualityThresholds.hideLowQuality && (
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-gray-400 w-16">Threshold</span>
                      <input
                        type="range"
                        min="0"
                        max="5"
                        step="0.5"
                        value={localFeedMix.qualityThresholds.hideThreshold}
                        onChange={(e) =>
                          handleGlobalQuality('hideThreshold', Number(e.target.value))
                        }
                        className="flex-1 h-1 cursor-pointer appearance-none rounded-full bg-gray-700 accent-degen-500"
                      />
                      <span className="text-[10px] font-mono text-gray-500 w-8 text-right">
                        {localFeedMix.qualityThresholds.hideThreshold.toFixed(1)}
                      </span>
                    </div>
                  )}

                  {/* Verified only */}
                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="text-xs font-medium text-[var(--color-fg)]">
                      Show only verified creators
                    </span>
                    <input
                      type="checkbox"
                      checked={localFeedMix.qualityThresholds.verifiedOnly}
                      onChange={(e) => handleGlobalQuality('verifiedOnly', e.target.checked)}
                      className="h-4 w-4 rounded border-white/20 bg-[var(--color-muted)] text-degen-500 focus:ring-degen-500"
                    />
                  </label>

                  {/* Global min engagement */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-[var(--color-fg)]">
                        Minimum engagement
                      </span>
                      <span className="text-[10px] font-mono text-gray-500">
                        {localFeedMix.qualityThresholds.globalMinEngagement}
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="5"
                      value={localFeedMix.qualityThresholds.globalMinEngagement}
                      onChange={(e) =>
                        handleGlobalQuality('globalMinEngagement', Number(e.target.value))
                      }
                      className="w-full h-1.5 cursor-pointer appearance-none rounded-full bg-gray-700 accent-degen-500"
                    />
                  </div>

                  {/* Min content length */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-[var(--color-fg)]">
                        Minimum content length
                      </span>
                      <span className="text-[10px] font-mono text-gray-500">
                        {localFeedMix.qualityThresholds.minContentLength} chars
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="500"
                      step="25"
                      value={localFeedMix.qualityThresholds.minContentLength}
                      onChange={(e) =>
                        handleGlobalQuality('minContentLength', Number(e.target.value))
                      }
                      className="w-full h-1.5 cursor-pointer appearance-none rounded-full bg-gray-700 accent-degen-500"
                    />
                  </div>
                </div>
              </div>

              {/* Per-protocol quality */}
              <div>
                <button
                  type="button"
                  onClick={() => setQualityCollapsed((c) => !c)}
                  className="flex items-center justify-between w-full text-sm font-semibold text-[var(--color-fg)] mb-2"
                >
                  <span>Per-Protocol Tuning</span>
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    aria-hidden="true"
                    className={`transition-transform ${qualityCollapsed ? '-rotate-90' : ''}`}
                  >
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </button>
                {!qualityCollapsed && (
                  <div className="space-y-3">
                    {PROTOCOLS.map((proto) => {
                      const pw = localFeedMix.protocols[proto.id] ?? {
                        weight: DEFAULT_PROTOCOL_WEIGHT,
                        ...DEFAULT_PROTOCOL_QUALITY,
                      };
                      return (
                        <details
                          key={proto.id}
                          className="rounded-xl border border-[var(--color-border)] bg-[var(--color-muted)]/20"
                        >
                          <summary className="flex cursor-pointer items-center gap-2 px-3 py-2 text-xs font-medium text-[var(--color-fg)] hover:text-degen-400 transition-colors">
                            <span style={{ color: proto.color }}>{proto.icon}</span>
                            <span>{proto.label}</span>
                            <span className="ml-auto text-[10px] text-gray-500">
                              {pw.minEngagement > 0 || pw.verifiedOnly || pw.minContentLength > 0
                                ? '✓ tuned'
                                : 'default'}
                            </span>
                          </summary>
                          <div className="px-3 pb-3 space-y-2.5 border-t border-[var(--color-border)] pt-2">
                            {/* Min engagement */}
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-gray-400 w-20 shrink-0">
                                Min engagement
                              </span>
                              <input
                                type="range"
                                min="0"
                                max="50"
                                step="5"
                                value={pw.minEngagement}
                                onChange={(e) =>
                                  handleProtocolQuality(
                                    proto.id,
                                    'minEngagement',
                                    Number(e.target.value),
                                  )
                                }
                                className="flex-1 h-1 cursor-pointer appearance-none rounded-full bg-gray-700 accent-degen-500"
                              />
                              <span className="text-[10px] font-mono text-gray-500 w-6 text-right">
                                {pw.minEngagement}
                              </span>
                            </div>

                            {/* Min content length */}
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-gray-400 w-20 shrink-0">
                                Min length
                              </span>
                              <input
                                type="range"
                                min="0"
                                max="500"
                                step="25"
                                value={pw.minContentLength}
                                onChange={(e) =>
                                  handleProtocolQuality(
                                    proto.id,
                                    'minContentLength',
                                    Number(e.target.value),
                                  )
                                }
                                className="flex-1 h-1 cursor-pointer appearance-none rounded-full bg-gray-700 accent-degen-500"
                              />
                              <span className="text-[10px] font-mono text-gray-500 w-8 text-right">
                                {pw.minContentLength}c
                              </span>
                            </div>

                            {/* Verified only */}
                            <label className="flex items-center justify-between cursor-pointer">
                              <span className="text-[10px] text-gray-400">Verified only</span>
                              <input
                                type="checkbox"
                                checked={pw.verifiedOnly}
                                onChange={(e) =>
                                  handleProtocolQuality(proto.id, 'verifiedOnly', e.target.checked)
                                }
                                className="h-3.5 w-3.5 rounded border-white/20 bg-[var(--color-muted)] text-degen-500 focus:ring-degen-500"
                              />
                            </label>
                          </div>
                        </details>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ═══ TAB 4: ALGORITHM ═══ */}
          {activeTab === 'algorithm' && (
            <div className="space-y-5">
              {/* Feed Presets */}
              <div>
                <p className="text-sm font-semibold text-[var(--color-fg)] mb-1">
                  🎮 Feed Presets
                </p>
                <p className="text-[10px] text-gray-500 mb-2">
                  One-click feed personalities — overrides all settings below
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {(feedPresets ?? FEED_PRESETS).map((preset) => {
                    const isActive = localActivePreset === preset.id;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => {
                          setLocalActivePreset(preset.id);
                          onApplyPreset?.(preset.id);
                        }}
                        className={`rounded-xl border p-3 text-left transition-all ${
                          isActive
                            ? 'border-degen-500 bg-degen-500/10 ring-1 ring-degen-500/30'
                            : 'border-[var(--color-border)] bg-[var(--color-muted)]/20 hover:border-degen-500/30'
                        }`}
                      >
                        <span className="text-lg">{preset.icon}</span>
                        <p className="text-xs font-semibold text-[var(--color-fg)] mt-1">
                          {preset.name}
                        </p>
                        <p className="text-[9px] text-gray-500 mt-0.5 leading-tight">
                          {preset.description}
                        </p>
                      </button>
                    );
                  })}
                </div>
                {localActivePreset && (
                  <button
                    type="button"
                    onClick={() => {
                      setLocalActivePreset(null);
                      onApplyPreset?.('__clear__');
                    }}
                    className="mt-2 text-[10px] text-degen-400 hover:text-degen-300"
                  >
                    Clear preset → manual control
                  </button>
                )}
              </div>

              <div className="border-t border-[var(--color-border)] pt-4 space-y-4">
                {/* Algorithm transparency */}
                <label className="flex items-center justify-between cursor-pointer">
                  <div>
                    <p className="text-xs font-semibold text-[var(--color-fg)]">
                      🔍 Algorithm Transparency
                    </p>
                    <p className="text-[10px] text-gray-500">
                      {localAlgorithmTransparent
                        ? '"Why this post?" explanations shown on every card'
                        : 'TikTok-style — no explanations, just content'}
                    </p>
                  </div>
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={localAlgorithmTransparent}
                      onChange={(e) => {
                        setLocalAlgorithmTransparent(e.target.checked);
                        onAlgorithmTransparencyChange?.(e.target.checked);
                        setLocalActivePreset(null);
                      }}
                      className="h-4 w-4 rounded border-white/20 bg-[var(--color-muted)] text-degen-500 focus:ring-degen-500"
                    />
                  </div>
                </label>

                {/* Content freshness */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <div>
                      <p className="text-xs font-semibold text-[var(--color-fg)]">
                        🌱 Content Freshness
                      </p>
                      <p className="text-[10px] text-gray-500">
                        {localFreshness < 30
                          ? 'Evergreen — only the best, regardless of age'
                          : localFreshness < 60
                            ? 'Balanced — mix of fresh and established'
                            : 'Bleeding edge — mostly recent content'}
                      </p>
                    </div>
                    <span className="text-xs font-mono tabular-nums text-gray-400 w-8 text-right">
                      {localFreshness}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={localFreshness}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setLocalFreshness(val);
                      onFreshnessChange?.(val);
                      setLocalActivePreset(null);
                    }}
                    className="w-full h-1.5 cursor-pointer appearance-none rounded-full bg-gray-700 accent-degen-500"
                    aria-label="Content freshness"
                  />
                </div>

                {/* Creator diversity */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <div>
                      <p className="text-xs font-semibold text-[var(--color-fg)]">
                        👥 Creator Diversity
                      </p>
                      <p className="text-[10px] text-gray-500">
                        {localCreatorDiversity <= 2
                          ? 'Same few creators — familiar voices'
                          : localCreatorDiversity <= 5
                            ? 'Moderate diversity'
                            : 'Maximum variety — many different creators'}
                      </p>
                    </div>
                    <span className="text-xs font-mono tabular-nums text-gray-400 w-8 text-right">
                      {localCreatorDiversity}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    step="1"
                    value={localCreatorDiversity}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setLocalCreatorDiversity(val);
                      onCreatorDiversityChange?.(val);
                      setLocalActivePreset(null);
                    }}
                    className="w-full h-1.5 cursor-pointer appearance-none rounded-full bg-gray-700 accent-degen-500"
                    aria-label="Creator diversity"
                  />
                </div>

                {/* Explore vs Exploit */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <div>
                      <p className="text-xs font-semibold text-[var(--color-fg)]">
                        🧭 Explore vs Exploit
                      </p>
                      <p className="text-[10px] text-gray-500">
                        {localExploreRatio < 20
                          ? 'Familiar — content you already know you like'
                          : localExploreRatio < 60
                            ? 'Balanced — some discovery, mostly familiar'
                            : 'Discovery — new creators, topics, and formats'}
                      </p>
                    </div>
                    <span className="text-xs font-mono tabular-nums text-gray-400 w-12 text-right">
                      {localExploreRatio}% explore
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-gray-500 mb-1">
                    <span>Exploit</span>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="5"
                      value={localExploreRatio}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setLocalExploreRatio(val);
                        onExploreRatioChange?.(val);
                        setLocalActivePreset(null);
                      }}
                      className="flex-1 h-1.5 cursor-pointer appearance-none rounded-full bg-gray-700 accent-degen-500"
                      aria-label="Explore vs exploit ratio"
                    />
                    <span>Explore</span>
                  </div>
                </div>
              </div>

              {/* Stats summary */}
              <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-muted)]/20 p-3">
                <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wider mb-1.5">
                  Current Algorithm Profile
                </p>
                <div className="space-y-1 text-[10px] text-gray-400">
                  <div className="flex justify-between">
                    <span>Mode</span>
                    <span className="text-[var(--color-fg)] font-medium">
                      {localAlgorithmTransparent ? 'Transparent' : 'Black Box'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Freshness</span>
                    <span className="text-[var(--color-fg)] font-medium">{localFreshness}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Creator cap</span>
                    <span className="text-[var(--color-fg)] font-medium">{localCreatorDiversity}/page</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Explore ratio</span>
                    <span className="text-[var(--color-fg)] font-medium">{localExploreRatio}%</span>
                  </div>
                  {localActivePreset && (
                    <div className="flex justify-between">
                      <span>Preset</span>
                      <span className="text-degen-400 font-medium">
                        {(feedPresets ?? FEED_PRESETS).find((p) => p.id === localActivePreset)?.name ?? localActivePreset}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ═══ TAB 5: SAVED MIXES ═══ */}
          {activeTab === 'mixes' && (
            <div className="space-y-4">
              {/* Save current mix */}
              <div className="rounded-xl border border-degen-500/30 bg-degen-500/5 p-3">
                <p className="text-xs font-semibold text-[var(--color-fg)] mb-2">
                  Save Current Settings as Mix
                </p>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={mixNameInput}
                    onChange={(e) => setMixNameInput(e.target.value)}
                    placeholder="Mix name (e.g. 'Weekend Vibes')"
                    maxLength={50}
                    className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-[var(--color-fg)] placeholder-gray-500 focus:border-degen-500/50 focus:outline-none"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleSaveCurrentMix();
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleSaveCurrentMix}
                    className="btn-primary text-xs whitespace-nowrap"
                  >
                    Save Mix
                  </button>
                </div>
                {mixSavedToast && <p className="mt-1 text-[10px] text-degen-400">✓ Mix saved!</p>}
              </div>

              {/* Pre-built mixes */}
              <div>
                <p className="text-xs font-semibold text-[var(--color-fg)] mb-2">Pre-built Mixes</p>
                <div className="space-y-1.5">
                  {[
                    ...PREBUILT_MIXES,
                    ...localSavedMixes.filter((m) => !PREBUILT_MIXES.find((p) => p.id === m.id)),
                  ].map((mix) => {
                    const isPrebuilt = !!PREBUILT_MIXES.find((p) => p.id === mix.id);
                    return (
                      <div
                        key={mix.id}
                        className="flex items-center justify-between rounded-lg border border-[var(--color-border)] bg-[var(--color-muted)]/20 px-3 py-2.5"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-[var(--color-fg)] truncate">
                            {mix.name}
                            {isPrebuilt && (
                              <span className="ml-1.5 text-[9px] uppercase tracking-wider text-degen-400">
                                Built-in
                              </span>
                            )}
                          </p>
                          {mix.description && (
                            <p className="text-[10px] text-gray-500 truncate">{mix.description}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 ml-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleLoadMix(mix)}
                            className="rounded-lg px-2.5 py-1 text-[10px] font-medium text-degen-400 hover:bg-degen-500/10 transition-colors"
                          >
                            Load
                          </button>
                          {!isPrebuilt && (
                            <button
                              type="button"
                              onClick={() => handleDeleteMix(mix.id)}
                              className="rounded-lg p-1 text-gray-500 hover:text-red-400 transition-colors"
                              aria-label={`Delete ${mix.name}`}
                            >
                              <svg
                                width="12"
                                height="12"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                              >
                                <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {localSavedMixes.length === 0 && (
                    <p className="text-xs text-gray-500 italic py-2">
                      No custom mixes saved yet. Configure a mix above and save it!
                    </p>
                  )}
                </div>
              </div>

              {/* Import / Export */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const data = {
                      feedMixConfig: localFeedMix,
                      savedMixes: localSavedMixes,
                      algorithm: {
                        transparent: localAlgorithmTransparent,
                        freshness: localFreshness,
                        diversity: localCreatorDiversity,
                        explore: localExploreRatio,
                        preset: localActivePreset,
                      },
                    };
                    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `degenfeed-config-${new Date().toISOString().slice(0, 10)}.json`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="flex-1 rounded-lg border border-degen-500/30 px-3 py-2 text-xs font-medium text-degen-400 hover:bg-degen-500/10 transition-colors text-center"
                >
                  ⬇️ Export Config
                </button>
                <label className="flex-1 cursor-pointer rounded-lg border border-degen-500/30 px-3 py-2 text-xs font-medium text-degen-400 hover:bg-degen-500/10 transition-colors text-center">
                  📂 Import Config
                  <input
                    type="file"
                    accept=".json"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = (ev) => {
                        try {
                          const data = JSON.parse(ev.target?.result as string);
                          if (data.feedMixConfig) {
                            setLocalFeedMix(data.feedMixConfig);
                            saveFeedMixConfig(data.feedMixConfig);
                          }
                          if (data.savedMixes) {
                            setLocalSavedMixes(data.savedMixes);
                            saveSavedMixes(data.savedMixes);
                          }
                          if (data.algorithm) {
                            if (typeof data.algorithm.transparent === 'boolean') {
                              setLocalAlgorithmTransparent(data.algorithm.transparent);
                              onAlgorithmTransparencyChange?.(data.algorithm.transparent);
                            }
                            if (typeof data.algorithm.freshness === 'number') {
                              setLocalFreshness(data.algorithm.freshness);
                              onFreshnessChange?.(data.algorithm.freshness);
                            }
                            if (typeof data.algorithm.diversity === 'number') {
                              setLocalCreatorDiversity(data.algorithm.diversity);
                              onCreatorDiversityChange?.(data.algorithm.diversity);
                            }
                            if (typeof data.algorithm.explore === 'number') {
                              setLocalExploreRatio(data.algorithm.explore);
                              onExploreRatioChange?.(data.algorithm.explore);
                            }
                            if (data.algorithm.preset) {
                              setLocalActivePreset(data.algorithm.preset);
                            }
                          }
                          window.dispatchEvent(new CustomEvent('df-toast', { detail: { kind: 'success', message: 'Config imported!' } }));
                        } catch {
                          window.dispatchEvent(new CustomEvent('df-toast', { detail: { kind: 'error', message: 'Invalid config file' } }));
                        }
                      };
                      reader.readAsText(file);
                    }}
                  />
                </label>
              </div>
            </div>
          )}
        </div>

        {/* ═══ FEED PREVIEW (shown at bottom of content area) ═══ */}
        <div className="border-t border-[var(--color-border)] px-5 py-3">
          <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wider mb-2">
            Preview with current settings
          </p>
          <div className="space-y-2">
            {previewPosts.map((post) => (
              <div
                key={post.protocol}
                className="flex items-start gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-muted)]/20 p-2.5"
              >
                <div
                  className="h-6 w-6 shrink-0 rounded-full flex items-center justify-center text-[10px] font-bold"
                  style={{ backgroundColor: `${post.protocolColor}22`, color: post.protocolColor }}
                >
                  {post.author.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-[10px] font-medium text-[var(--color-fg)] truncate">
                      {post.author}
                    </span>
                    <span
                      className="text-[8px] px-1 py-0.5 rounded-full font-medium"
                      style={{
                        backgroundColor: `${post.protocolColor}18`,
                        color: post.protocolColor,
                      }}
                    >
                      {post.icon} {post.protocol}
                    </span>
                  </div>
                  <p className="text-[10px] text-gray-400 line-clamp-2">{post.content}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[9px] text-gray-500">❤️ {post.likes}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="flex items-center justify-between gap-3 border-t border-[var(--color-border)] px-5 py-4">
          <button
            type="button"
            onClick={activeTab === 'topics' ? onReset : activeTab === 'algorithm' ? handleAlgorithmReset : handleMixReset}
            className="rounded-lg border border-[var(--color-border)] px-4 py-2 text-xs font-medium text-gray-400 hover:bg-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors"
          >
            {activeTab === 'topics' ? 'Reset topics' : activeTab === 'algorithm' ? 'Reset algorithm' : 'Reset mix'}
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-xs font-medium text-gray-400 hover:text-[var(--color-fg)] transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                if (activeTab === 'topics') {
                  onApply(localWeights);
                } else {
                  handleMixApply();
                }
              }}
              className="btn-primary text-sm"
            >
              Apply
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
