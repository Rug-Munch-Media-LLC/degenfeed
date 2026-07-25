/**
 * @degenfeed/api-worker — Algorithm Control API
 *
 * Gives users TOTAL control over their feed algorithm weights, signal sources,
 * custom rules, and presets. Supports the /api/algo/* routes.
 *
 * All user-specific data is stored in KV under `algo:*` keys.
 *
 * Auth: All endpoints require a valid session cookie (`__Host-dfid`).
 */

import type { UnifiedPost } from '@degenfeed/types';
import { type Env, jsonResponse, noCacheJsonResponse } from '../index';
import { type ExplainerContext, explainPost } from '../lib/feed-explainer';
import { requireSession } from '../session';

// ─── Types ──────────────────────────────────────────────────────────────

export interface AlgorithmWeights {
  recency: number; // 0-100
  relevance: number; // 0-100
  popularity: number; // 0-100
  creatorAffinity: number; // 0-100
  diversity: number; // 0-100
  sourceQuality: number; // 0-100
  interactionHistory: number; // 0-100
}

export interface WeightPreset {
  name: string;
  slug: string;
  icon: string;
  description: string;
  weights: AlgorithmWeights;
}

export interface SignalSource {
  id: string;
  label: string;
  icon: string;
  description: string;
  enabled: boolean;
  category: 'engagement' | 'content' | 'social' | 'quality' | 'discovery';
}

export interface SignalConfig {
  signals: SignalSource[];
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

// ─── Defaults ───────────────────────────────────────────────────────────

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
    description: 'Newest posts at the top — never miss breaking updates',
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
    description: 'Trending and viral content from across the network',
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
    description: 'Personalized content based on your interests and activity',
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
    description: 'Explore new topics and creators outside your bubble',
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
    description: 'A fair mix of recency, popularity, and relevance',
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

export const DEFAULT_SIGNALS: SignalSource[] = [
  {
    id: 'recency',
    label: 'Recency',
    icon: '🕐',
    description: 'How recently the post was published',
    enabled: true,
    category: 'engagement',
  },
  {
    id: 'likes',
    label: 'Likes',
    icon: '👍',
    description: 'Total likes on the post',
    enabled: true,
    category: 'engagement',
  },
  {
    id: 'reposts',
    label: 'Reposts',
    icon: '🔄',
    description: 'How many times the post was shared',
    enabled: true,
    category: 'engagement',
  },
  {
    id: 'replies',
    label: 'Replies',
    icon: '💬',
    description: 'Discussion activity on the post',
    enabled: true,
    category: 'engagement',
  },
  {
    id: 'niche-match',
    label: 'Niche Match',
    icon: '🎯',
    description: 'How well the post matches your selected topics',
    enabled: true,
    category: 'content',
  },
  {
    id: 'creator-affinity',
    label: 'Creator Affinity',
    icon: '👤',
    description: 'Your history with the post author',
    enabled: true,
    category: 'social',
  },
  {
    id: 'followed-creators',
    label: 'Followed Creators',
    icon: '⭐',
    description: 'Posts from people you follow',
    enabled: true,
    category: 'social',
  },
  {
    id: 'content-quality',
    label: 'Content Quality',
    icon: '💎',
    description: 'Quality signals like length, media, originality',
    enabled: true,
    category: 'quality',
  },
  {
    id: 'source-trust',
    label: 'Source Trust',
    icon: '📡',
    description: 'Trust level of the source protocol',
    enabled: true,
    category: 'quality',
  },
  {
    id: 'diversity',
    label: 'Diversity',
    icon: '🌈',
    description: 'Mix of different authors and topics',
    enabled: true,
    category: 'discovery',
  },
  {
    id: 'velocity',
    label: 'Trending Velocity',
    icon: '📈',
    description: 'How fast the post is gaining engagement',
    enabled: true,
    category: 'engagement',
  },
  {
    id: 'reputation',
    label: 'Author Reputation',
    icon: '⭐',
    description: 'Reputation score of the post author',
    enabled: true,
    category: 'quality',
  },
  {
    id: 'dwell-time',
    label: 'Dwell Time',
    icon: '⏱️',
    description: 'How long users spend viewing similar content',
    enabled: true,
    category: 'engagement',
  },
  {
    id: 'feedback',
    label: 'Your Feedback',
    icon: '✋',
    description: '"Show more/less like this" signals',
    enabled: true,
    category: 'social',
  },
];

// ─── KV key helpers ─────────────────────────────────────────────────────

function algoWeightsKey(address: string): string {
  return `algo:weights:${address.toLowerCase()}`;
}

function algoRulesKey(address: string): string {
  return `algo:rules:${address.toLowerCase()}`;
}

function algoSignalsKey(address: string): string {
  return `algo:signals:${address.toLowerCase()}`;
}

// ─── KV read/write helpers ─────────────────────────────────────────────

async function getWeights(env: Env, address: string): Promise<AlgorithmWeights> {
  try {
    const raw = await env.CACHE?.get(algoWeightsKey(address));
    if (raw) return JSON.parse(raw) as AlgorithmWeights;
  } catch {
    /* KV operation failed -- use defaults */
  }
  return { ...DEFAULT_WEIGHTS };
}

async function setWeights(env: Env, address: string, weights: AlgorithmWeights): Promise<void> {
  await env.CACHE?.put(algoWeightsKey(address), JSON.stringify(weights), {
    expirationTtl: 60 * 60 * 24 * 400, // ~13 months
  });
}

async function getRules(env: Env, address: string): Promise<CustomRule[]> {
  try {
    const raw = await env.CACHE?.get(algoRulesKey(address));
    if (raw) return JSON.parse(raw) as CustomRule[];
  } catch {
    /* KV operation failed */
  }
  return [];
}

async function setRules(env: Env, address: string, rules: CustomRule[]): Promise<void> {
  await env.CACHE?.put(algoRulesKey(address), JSON.stringify(rules), {
    expirationTtl: 60 * 60 * 24 * 400,
  });
}

async function getSignals(env: Env, address: string): Promise<SignalSource[]> {
  try {
    const raw = await env.CACHE?.get(algoSignalsKey(address));
    if (raw) {
      const parsed = JSON.parse(raw) as { signals: SignalSource[] };
      return parsed.signals;
    }
  } catch {
    /* KV operation failed */
  }
  return DEFAULT_SIGNALS.map((s) => ({ ...s }));
}

async function setSignals(env: Env, address: string, signals: SignalSource[]): Promise<void> {
  await env.CACHE?.put(algoSignalsKey(address), JSON.stringify({ signals }), {
    expirationTtl: 60 * 60 * 24 * 400,
  });
}

// ─── Validation helpers ─────────────────────────────────────────────────

function validateWeights(body: unknown): AlgorithmWeights | null {
  if (!body || typeof body !== 'object') return null;
  const w = body as Record<string, unknown>;
  const weights: AlgorithmWeights = {
    recency: clamp(w.recency, 0, 100, DEFAULT_WEIGHTS.recency),
    relevance: clamp(w.relevance, 0, 100, DEFAULT_WEIGHTS.relevance),
    popularity: clamp(w.popularity, 0, 100, DEFAULT_WEIGHTS.popularity),
    creatorAffinity: clamp(w.creatorAffinity, 0, 100, DEFAULT_WEIGHTS.creatorAffinity),
    diversity: clamp(w.diversity, 0, 100, DEFAULT_WEIGHTS.diversity),
    sourceQuality: clamp(w.sourceQuality, 0, 100, DEFAULT_WEIGHTS.sourceQuality),
    interactionHistory: clamp(w.interactionHistory, 0, 100, DEFAULT_WEIGHTS.interactionHistory),
  };
  return weights;
}

function clamp(n: unknown, min: number, max: number, fallback: number): number {
  if (typeof n !== 'number' || !Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function sanitizeRules(body: unknown): CustomRule[] | null {
  if (!Array.isArray(body)) return null;
  const validTypes = new Set(['boost-creator', 'mute-hashtag', 'min-engagement', 'content-type']);
  const rules: CustomRule[] = [];
  for (const item of body) {
    if (!item || typeof item !== 'object') continue;
    const r = item as Record<string, unknown>;
    if (!validTypes.has(String(r.type))) continue;
    rules.push({
      id: String(r.id ?? crypto.randomUUID()),
      type: r.type as CustomRule['type'],
      creatorId: r.creatorId ? String(r.creatorId) : undefined,
      creatorName: r.creatorName ? String(r.creatorName) : undefined,
      hashtag: r.hashtag ? String(r.hashtag) : undefined,
      minLikes: typeof r.minLikes === 'number' ? r.minLikes : undefined,
      contentType: r.contentType ? String(r.contentType) : undefined,
      adjustment: typeof r.adjustment === 'number' ? clamp(r.adjustment, -100, 100, 0) : undefined,
      description: String(r.description ?? ''),
      enabled: r.enabled !== false,
      createdAt: typeof r.createdAt === 'number' ? r.createdAt : Date.now(),
    });
  }
  return rules;
}

// ─── Request body parser ────────────────────────────────────────────────

async function parseBody<T>(request: Request): Promise<{ data: T; error?: Response }> {
  let body: T;
  try {
    body = (await request.json()) as T;
  } catch {
    return { data: undefined as unknown as T, error: jsonResponse({ error: 'Invalid JSON' }, 400) };
  }
  return { data: body };
}

// ═════════════════════════════════════════════════════════════════════════
// ROUTE HANDLERS
// ═════════════════════════════════════════════════════════════════════════

// ─── GET /api/algo/weights — Get current weights ────────────────────────

export async function handleGetWeights(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const weights = await getWeights(env, session.address);
  return noCacheJsonResponse({ weights });
}

// ─── PUT /api/algo/weights — Update weights ────────────────────────────

export async function handleUpdateWeights(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const { data: body, error } = await parseBody<unknown>(request);
  if (error) return error;

  const weights = validateWeights(body);
  if (!weights) {
    return jsonResponse(
      { error: 'Invalid weights format. Each weight must be a number 0-100.' },
      400,
    );
  }

  await setWeights(env, session.address, weights);
  return noCacheJsonResponse({ ok: true, weights });
}

// ─── POST /api/algo/weights/reset — Reset to defaults ──────────────────

export async function handleResetWeights(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const defaults = { ...DEFAULT_WEIGHTS };
  await setWeights(env, session.address, defaults);
  return noCacheJsonResponse({ ok: true, weights: defaults });
}

// ─── GET /api/algo/weights/presets — List presets ──────────────────────

export async function handleGetPresets(_request: Request, _env: Env): Promise<Response> {
  return noCacheJsonResponse({ presets: PRESETS });
}

// ─── POST /api/algo/weights/preset/:name — Apply a preset ─────────────

export async function handleApplyPreset(
  request: Request,
  env: Env,
  name: string,
): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const preset = PRESETS.find((p) => p.slug === name);
  if (!preset) {
    return jsonResponse(
      { error: `Preset "${name}" not found. Available: ${PRESETS.map((p) => p.slug).join(', ')}` },
      404,
    );
  }

  await setWeights(env, session.address, { ...preset.weights });
  return noCacheJsonResponse({ ok: true, preset: preset.name, weights: preset.weights });
}

// ─── GET /api/algo/explain/:postId — Explain a post ───────────────────

export async function handleExplainPost(
  request: Request,
  env: Env,
  postId: string,
): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  // Parse query params for the post data (the API caller must provide context)
  const params = new URL(request.url).searchParams;

  // Load user context from KV
  const weights = await getWeights(env, session.address);
  const rules = await getRules(env, session.address);
  const activeRules = rules.filter((r) => r.enabled);

  // Build the explainer context
  const ctx: ExplainerContext = {
    userNiches: new Set(
      params
        .get('niches')
        ?.split(',')
        .map((n) => n.trim().toLowerCase())
        .filter(Boolean) ?? [],
    ),
    followedCreators: new Set(params.get('followed')?.split(',') ?? []),
    mutedNiches: new Set(
      params
        .get('mutedNiches')
        ?.split(',')
        .map((n) => n.trim().toLowerCase())
        .filter(Boolean) ?? [],
    ),
    weights: {
      recency: weights.recency,
      engagement: weights.popularity,
      relevance: weights.relevance,
      quality: weights.sourceQuality,
      reputation: weights.creatorAffinity,
      diversity: weights.diversity,
      source: weights.sourceQuality,
      velocity: weights.interactionHistory,
    },
    mode: params.get('mode') ?? 'standard',
    customRules: activeRules,
    now: Date.now(),
  };

  // Build a minimal post object from query params for explanation
  // (In production, the post would come from the feed cache)
  const niches = params.get('postNiches')?.split(',').filter(Boolean) ?? [];
  const authorId = params.get('authorId') ?? '';
  const displayName = params.get('authorName') ?? '';
  const createdAt = Number(params.get('createdAt')) || Date.now();
  const protocol = params.get('protocol') ?? 'nostr';
  const likes = Number(params.get('likes')) || 0;
  const reposts = Number(params.get('reposts')) || 0;
  const replies = Number(params.get('replies')) || 0;

  const post: UnifiedPost = {
    id: postId,
    text: params.get('text') ?? '',
    html: params.get('text') ?? '',
    author: {
      id: authorId,
      primary: { protocol: protocol as UnifiedPost['author']['primary']['protocol'], id: authorId },
      displayName,
      bio: '',
      avatarUrl: '',
      handles: {},
      verified: [],
      followerCount: 0,
      followingCount: 0,
      links: [],
      keys: {},
    },
    metrics: { likes, reposts, replies, quotes: 0 },
    embeds: [],
    niches,
    createdAt,
    protocol: protocol as UnifiedPost['protocol'],
    contentType: (params.get('contentType') as UnifiedPost['contentType']) ?? 'text',
    qualityScore: { score: 0, max: 100, ratio: 0, reasons: [] },
    engagement: {
      viewerLiked: false,
      viewerReposted: false,
      viewerBookmarked: false,
      raw: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
    },
    raw: null,
  };

  const explanation = explainPost(post, ctx);

  return noCacheJsonResponse({ explanation });
}

// ─── POST /api/algo/rules — Add a custom rule ─────────────────────────

export async function handleAddRule(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const { data: body, error } = await parseBody<{ rule: unknown }>(request);
  if (error) return error;

  const rules = sanitizeRules([body.rule ?? body]);
  if (!rules || rules.length === 0) {
    return jsonResponse(
      {
        error:
          'Invalid rule. Must include type (boost-creator, mute-hashtag, min-engagement, or content-type) and required fields.',
      },
      400,
    );
  }

  const existing = await getRules(env, session.address);
  existing.push(rules[0]);
  await setRules(env, session.address, existing);

  return noCacheJsonResponse({ ok: true, rule: rules[0] }, 201);
}

// ─── DELETE /api/algo/rules/:ruleId — Remove a custom rule ────────────

export async function handleDeleteRule(
  request: Request,
  env: Env,
  ruleId: string,
): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const existing = await getRules(env, session.address);
  const filtered = existing.filter((r) => r.id !== ruleId);
  if (filtered.length === existing.length) {
    return jsonResponse({ error: 'Rule not found' }, 404);
  }

  await setRules(env, session.address, filtered);
  return noCacheJsonResponse({ ok: true });
}

// ─── GET /api/algo/rules — List custom rules ─────────────────────────

export async function handleListRules(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const rules = await getRules(env, session.address);
  return noCacheJsonResponse({ rules });
}

// ─── GET /api/algo/signals — List available signal sources ────────────

export async function handleGetSignals(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const signals = await getSignals(env, session.address);
  return noCacheJsonResponse({ signals });
}

// ─── PUT /api/algo/signals — Enable/disable signal sources ───────────

export async function handleUpdateSignals(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const { data: body, error } = await parseBody<{
    signals?: Array<{ id: string; enabled: boolean }>;
  }>(request);
  if (error) return error;

  if (!Array.isArray(body.signals)) {
    return jsonResponse({ error: 'signals array required' }, 400);
  }

  const current = await getSignals(env, session.address);
  const updateMap = new Map(body.signals.map((s) => [s.id, s.enabled]));

  const updated = current.map((s) => ({
    ...s,
    enabled: updateMap.has(s.id) ? updateMap.get(s.id)! : s.enabled,
  }));

  await setSignals(env, session.address, updated);
  return noCacheJsonResponse({ ok: true, signals: updated });
}

// ─── GET /api/algo/presets/share/:name — Generate a shareable preset link ──

export async function handleSharePreset(
  request: Request,
  _env: Env,
  name: string,
): Promise<Response> {
  const preset = PRESETS.find((p) => p.slug === name);
  if (!preset) {
    return jsonResponse({ error: `Preset "${name}" not found` }, 404);
  }

  // Encode weights as a compact query string
  const w = preset.weights;
  const encoded = `w=${w.recency},${w.relevance},${w.popularity},${w.creatorAffinity},${w.diversity},${w.sourceQuality},${w.interactionHistory}`;
  const shareUrl = `${request.headers.get('origin') || 'https://degenfeed.xyz'}/feed/tune?preset=${preset.slug}&${encoded}`;

  return noCacheJsonResponse({
    ok: true,
    shareUrl,
    preset: preset.name,
    slug: preset.slug,
  });
}
