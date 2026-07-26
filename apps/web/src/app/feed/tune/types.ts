'use client';

/* ─── Types ───────────────────────────────────────────────────── */

export interface AlgorithmWeights {
  recency: number;
  relevance: number;
  popularity: number;
  creatorAffinity: number;
  diversity: number;
  sourceQuality: number;
  interactionHistory: number;
}

export interface WeightPreset {
  name: string;
  slug: string;
  icon: string;
  description: string;
  weights: AlgorithmWeights;
}

export interface CustomRule {
  id: string;
  type: 'boost-creator' | 'mute-hashtag' | 'min-engagement' | 'content-type';
  creatorId?: string;
  creatorName?: string;
  hashtag?: string;
  minLikes?: number;
  contentType?: string;
  adjustment?: number;
  description: string;
  enabled: boolean;
  createdAt: number;
}

export interface SignalSource {
  id: string;
  label: string;
  icon: string;
  description: string;
  enabled: boolean;
}

/* ─── Defaults ──────────────────────────────────────────────── */

export const DEFAULT_WEIGHTS: AlgorithmWeights = {
  recency: 50,
  relevance: 50,
  popularity: 50,
  creatorAffinity: 50,
  diversity: 50,
  sourceQuality: 50,
  interactionHistory: 50,
};

export const PRESETS: WeightPreset[] = [
  {
    name: 'Latest First',
    slug: 'latest-first',
    icon: '📰',
    description: 'Newest posts at the top',
    weights: {
      recency: 90,
      relevance: 40,
      popularity: 40,
      creatorAffinity: 30,
      diversity: 30,
      sourceQuality: 30,
      interactionHistory: 30,
    },
  },
  {
    name: "What's Hot",
    slug: 'whats-hot',
    icon: '🔥',
    description: 'Trending and viral content',
    weights: {
      recency: 50,
      relevance: 40,
      popularity: 80,
      creatorAffinity: 40,
      diversity: 30,
      sourceQuality: 40,
      interactionHistory: 50,
    },
  },
  {
    name: 'For You',
    slug: 'for-you',
    icon: '🎯',
    description: 'Personalized to your interests',
    weights: {
      recency: 50,
      relevance: 70,
      popularity: 50,
      creatorAffinity: 60,
      diversity: 30,
      sourceQuality: 40,
      interactionHistory: 70,
    },
  },
  {
    name: 'Discovery Mode',
    slug: 'discovery',
    icon: '🌈',
    description: 'Explore new topics and creators',
    weights: {
      recency: 40,
      relevance: 40,
      popularity: 40,
      creatorAffinity: 30,
      diversity: 80,
      sourceQuality: 50,
      interactionHistory: 20,
    },
  },
  {
    name: 'Balanced',
    slug: 'balanced',
    icon: '⚖️',
    description: 'A fair mix of everything',
    weights: {
      recency: 50,
      relevance: 50,
      popularity: 50,
      creatorAffinity: 50,
      diversity: 50,
      sourceQuality: 50,
      interactionHistory: 50,
    },
  },
];

export const WEIGHT_LABELS: Record<
  keyof AlgorithmWeights,
  { label: string; icon: string; desc: string }
> = {
  recency: { label: 'Recency', icon: '🕐', desc: 'How recent the post is' },
  relevance: { label: 'Relevance', icon: '🎯', desc: 'Match to your interests and topics' },
  popularity: { label: 'Popularity', icon: '🔥', desc: 'Engagement: likes, reposts, replies' },
  creatorAffinity: {
    label: 'Creator Affinity',
    icon: '👤',
    desc: 'Accounts you follow and interact with',
  },
  diversity: { label: 'Diversity', icon: '🌈', desc: 'Mix of different authors and topics' },
  sourceQuality: {
    label: 'Source Quality',
    icon: '📡',
    desc: 'Trust and quality of the source protocol',
  },
  interactionHistory: {
    label: 'Your History',
    icon: '🔄',
    desc: 'Your past interactions with similar content',
  },
};

export const RULE_TYPE_LABELS: Record<
  CustomRule['type'],
  { label: string; icon: string; fields: string[] }
> = {
  'boost-creator': {
    label: 'Boost Creator',
    icon: '⭐',
    fields: ['creatorId', 'creatorName', 'adjustment'],
  },
  'mute-hashtag': { label: 'Mute Hashtag', icon: '🚫', fields: ['hashtag'] },
  'min-engagement': { label: 'Min Engagement', icon: '📊', fields: ['minLikes'] },
  'content-type': { label: 'Content Type', icon: '📋', fields: ['contentType'] },
};
