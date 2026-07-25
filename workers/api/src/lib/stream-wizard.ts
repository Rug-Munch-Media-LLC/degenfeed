/**
 * @degenfeed/api-worker — Stream Configuration Wizard
 *
 * Step-by-step wizard that guides creators through the "Go Live" setup:
 *
 *   1. "What type of stream?" — Short/Portrait, Full/Landscape
 *   2. "Expected viewers?" — <10 (P2P), 10-50 (Owncast), 50+ (PeerTube)
 *   3. "Where to broadcast?" — Select platforms (simulcast targets)
 *   4. "Monetization?" — Tips on/off, token-gated on/off
 *   5. "Go Live!" — Start streaming with one click
 *
 * The wizard collects preferences, calculates optimal routing,
 * configures simulcast targets, and launches the stream.
 */

import type { Env } from '../index';
import { log } from '../index';
import { SimulcastEngine, type SimulcastPlatform } from './simulcast';
import {
  type SimulcastTarget,
  STREAMING_THRESHOLDS,
  type StreamingMode,
  StreamingRouter,
} from './streaming-router';

// ─── Types ──────────────────────────────────────────────────────────────

export type StreamOrientation = 'portrait' | 'landscape';
export type StreamFormat = 'short' | 'full';
export type ExpectedAudience = 'small' | 'medium' | 'large' | 'massive';
export type MonetizationType = 'tips' | 'token-gated' | 'both' | 'none';

export interface WizardStep {
  step: number;
  name: string;
  description: string;
  completed: boolean;
}

export interface WizardState {
  /** Unique wizard session ID */
  sessionId: string;
  /** Creator wallet address */
  creatorId: string;
  /** Current step (0-indexed) */
  currentStep: number;
  /** Steps completed */
  steps: WizardStep[];
  /** Step 1: Stream config */
  streamConfig?: StreamConfig;
  /** Step 2: Audience estimation */
  audienceConfig?: AudienceConfig;
  /** Step 3: Broadcast targets */
  broadcastConfig?: BroadcastConfig;
  /** Step 4: Monetization */
  monetizationConfig?: MonetizationConfig;
  /** Step 5: Go Live result */
  goLiveResult?: GoLiveResult;
  /** When wizard was started */
  startedAt: number;
  /** When wizard was last updated */
  updatedAt: number;
  /** Whether wizard is completed */
  completed: boolean;
}

export interface StreamConfig {
  title: string;
  description?: string;
  orientation: StreamOrientation;
  format: StreamFormat;
  category?: string;
  tags?: string[];
  thumbnailUrl?: string;
}

export interface AudienceConfig {
  expectedViewers: ExpectedAudience;
  estimatedMaxViewers: number;
  recommendedMode: StreamingMode;
  recommendedLabel: string;
  isFree: boolean;
  estimatedCost: string;
}

export interface BroadcastConfig {
  platforms: SimulcastPlatform[];
  simulcastEnabled: boolean;
  chatBridged: boolean;
  saveReplay: boolean;
}

export interface MonetizationConfig {
  tipsEnabled: boolean;
  tokenGated: boolean;
  tokenAddress?: string;
  minTokenAmount?: string;
}

export interface GoLiveResult {
  streamId: string;
  mode: StreamingMode;
  rtmpUrl?: string;
  streamKey?: string;
  playbackUrl?: string;
  simulcastSessionId?: string;
  simulcastTargets: string[];
  ipfsVodEnabled: boolean;
  costEstimate: string;
}

// ─── Audience Thresholds ─────────────────────────────────────────────

const AUDIENCE_CONFIGS: Record<
  ExpectedAudience,
  {
    maxViewers: number;
    mode: StreamingMode;
    label: string;
    isFree: boolean;
  }
> = {
  small: {
    maxViewers: STREAMING_THRESHOLDS.P2P_MAX,
    mode: 'p2p',
    label: 'P2P (Free)',
    isFree: true,
  },
  medium: {
    maxViewers: STREAMING_THRESHOLDS.OWNCAST_MAX,
    mode: 'owncast',
    label: 'Owncast Server (Free)',
    isFree: true,
  },
  large: {
    maxViewers: STREAMING_THRESHOLDS.PEERTUBE_MAX,
    mode: 'peertube',
    label: 'PeerTube Federated (Free)',
    isFree: true,
  },
  massive: {
    maxViewers: 10000,
    mode: 'livepeer',
    label: 'Livepeer CDN ($0.003/viewer-hr)',
    isFree: false,
  },
};

// ─── Wizard Steps ───────────────────────────────────────────────────

const WIZARD_STEPS: WizardStep[] = [
  { step: 1, name: 'Stream Setup', description: 'What type of stream?', completed: false },
  { step: 2, name: 'Audience', description: 'Expected viewers?', completed: false },
  { step: 3, name: 'Broadcast', description: 'Where to broadcast?', completed: false },
  { step: 4, name: 'Monetization', description: 'Tips & token gating', completed: false },
  { step: 5, name: 'Go Live!', description: 'Start streaming', completed: false },
];

// ─── KV Keys ───────────────────────────────────────────────────────

function wizardKey(sessionId: string): string {
  return `wizard:${sessionId}`;
}

function wizardCreatorKey(creatorId: string): string {
  return `wizard:creator:${creatorId}`;
}

// ─── StreamWizard ────────────────────────────────────────────────────

export class StreamWizard {
  private env: Env;

  constructor(env: Env) {
    this.env = env;
  }

  // ─── Step 0: Initialize Wizard ─────────────────────────────────

  /**
   * Initialize a new stream wizard session.
   */
  async initialize(creatorId: string): Promise<WizardState> {
    const sessionId =
      crypto.randomUUID?.() ?? `wiz-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

    const state: WizardState = {
      sessionId,
      creatorId,
      currentStep: 0,
      steps: WIZARD_STEPS.map((s) => ({ ...s })),
      startedAt: Date.now(),
      updatedAt: Date.now(),
      completed: false,
    };

    await this.persist(state);
    return state;
  }

  // ─── Step 1: Stream Configuration ──────────────────────────────

  /**
   * Set the stream configuration (type, orientation, title).
   * Step 1 of the wizard.
   */
  async setStreamConfig(sessionId: string, config: StreamConfig): Promise<WizardState> {
    const state = await this.getState(sessionId);
    if (!state) throw new Error('Wizard session not found');

    if (!config.title?.trim()) {
      throw new Error('Stream title is required');
    }

    state.streamConfig = {
      ...config,
      title: config.title.trim().slice(0, 120),
      description: config.description?.trim().slice(0, 500),
      tags: (config.tags ?? []).slice(0, 10),
    };

    state.steps[0].completed = true;
    state.currentStep = 1;
    state.updatedAt = Date.now();

    await this.persist(state);
    return state;
  }

  // ─── Step 2: Audience Estimation ───────────────────────────────

  /**
   * Set expected audience size and get routing recommendation.
   * Step 2 of the wizard.
   */
  async setAudienceConfig(
    sessionId: string,
    expectedViewers: ExpectedAudience,
  ): Promise<{ state: WizardState; recommendation: AudienceConfig }> {
    const wizardState = await this.getState(sessionId);
    if (!wizardState) throw new Error('Wizard session not found');

    const audienceCfg = AUDIENCE_CONFIGS[expectedViewers];
    const router = new StreamingRouter(this.env);
    const decision = router.decideMode(audienceCfg.maxViewers);

    const recommendation: AudienceConfig = {
      expectedViewers,
      estimatedMaxViewers: audienceCfg.maxViewers,
      recommendedMode: audienceCfg.mode,
      recommendedLabel: audienceCfg.label,
      isFree: audienceCfg.isFree,
      estimatedCost: decision.estimatedCost,
    };

    wizardState.audienceConfig = recommendation;
    wizardState.steps[1].completed = true;
    wizardState.currentStep = 2;
    wizardState.updatedAt = Date.now();

    await this.persist(wizardState);
    return { state: wizardState, recommendation };
  }

  // ─── Step 3: Broadcast Targets ─────────────────────────────────

  /**
   * Select broadcast platforms for simulcast.
   * Step 3 of the wizard.
   */
  async setBroadcastConfig(
    sessionId: string,
    platforms: SimulcastPlatform[],
    options?: {
      simulcastEnabled?: boolean;
      chatBridged?: boolean;
      saveReplay?: boolean;
    },
  ): Promise<WizardState> {
    const state = await this.getState(sessionId);
    if (!state) throw new Error('Wizard session not found');

    // Always include the recommended platform
    const _recommendedMode = state.audienceConfig?.recommendedMode;
    const allPlatforms = [...new Set(platforms)];

    state.broadcastConfig = {
      platforms: allPlatforms,
      simulcastEnabled: options?.simulcastEnabled ?? allPlatforms.length > 0,
      chatBridged: options?.chatBridged ?? true,
      saveReplay: options?.saveReplay ?? true,
    };

    state.steps[2].completed = true;
    state.currentStep = 3;
    state.updatedAt = Date.now();

    await this.persist(state);
    return state;
  }

  // ─── Step 4: Monetization ─────────────────────────────────────

  /**
   * Configure monetization options.
   * Step 4 of the wizard.
   */
  async setMonetizationConfig(sessionId: string, config: MonetizationConfig): Promise<WizardState> {
    const state = await this.getState(sessionId);
    if (!state) throw new Error('Wizard session not found');

    state.monetizationConfig = config;
    state.steps[3].completed = true;
    state.currentStep = 4;
    state.updatedAt = Date.now();

    await this.persist(state);
    return state;
  }

  // ─── Step 5: Go Live! ─────────────────────────────────────────

  /**
   * Execute the "Go Live" action — starts the stream with all configured options.
   * Step 5 of the wizard.
   */
  async goLive(sessionId: string): Promise<{ state: WizardState; result: GoLiveResult }> {
    const state = await this.getState(sessionId);
    if (!state) throw new Error('Wizard session not found');

    // Validate all required configs exist
    if (!state.streamConfig) throw new Error('Complete stream setup first (Step 1)');
    if (!state.audienceConfig) throw new Error('Complete audience estimation first (Step 2)');

    const router = new StreamingRouter(this.env);
    const mode = state.audienceConfig.recommendedMode;

    // Determine simulcast targets
    const simulcastTargets = state.broadcastConfig?.platforms ?? [this.getDefaultPlatform(mode)];
    const targets: SimulcastTarget[] = simulcastTargets.map((platform) => ({
      platform,
      enabled: true,
      health: 'healthy' as const,
    }));

    // Create the stream
    const stream = await router.createStream(state.creatorId, state.streamConfig.title, 0, {
      autoSwitch: true,
      privacy: 'public',
      tokenGated: state.monetizationConfig?.tokenGated,
      tokenAddress: state.monetizationConfig?.tokenAddress,
      simulcastTargets: targets,
    });

    // Start simulcast if multiple platforms selected
    let simulcastSessionId: string | undefined;
    if (state.broadcastConfig?.simulcastEnabled && simulcastTargets.length > 1) {
      try {
        const simulcastEngine = new SimulcastEngine(this.env);
        const simulcast = await simulcastEngine.startSimulcast({
          title: state.streamConfig.title,
          description: state.streamConfig.description,
          creatorId: state.creatorId,
          creatorDisplayName: state.creatorId.slice(0, 8),
          sourcePlatform: 'owncast',
          sourceStreamId: stream.streamId,
          sourceRtmpUrl: stream.rtmpUrl || '',
          sourceStreamKey: stream.streamKey || '',
          targets: simulcastTargets.filter(
            (p) => p !== this.getDefaultPlatform(mode),
          ) as SimulcastPlatform[],
          chatBridged: state.broadcastConfig?.chatBridged ?? true,
          saveReplay: state.broadcastConfig?.saveReplay ?? true,
        });
        simulcastSessionId = simulcast.id;
      } catch (err) {
        log('warn', '[stream-wizard] Simulcast start failed, continuing with single platform', {
          error: String(err),
        });
      }
    }

    // Announce monetization
    if (state.monetizationConfig?.tipsEnabled) {
      log('info', '[stream-wizard] Tips enabled for stream', {
        streamId: stream.streamId,
      });
    }

    const result: GoLiveResult = {
      streamId: stream.streamId,
      mode: stream.mode,
      rtmpUrl: stream.rtmpUrl,
      streamKey: stream.streamKey,
      playbackUrl: stream.playbackUrl,
      simulcastSessionId,
      simulcastTargets: simulcastTargets.map((t) => (typeof t === 'string' ? t : t.platform)),
      ipfsVodEnabled: true,
      costEstimate: router.getEstimatedCost(mode, state.audienceConfig.estimatedMaxViewers),
    };

    state.goLiveResult = result;
    state.steps[4].completed = true;
    state.completed = true;
    state.updatedAt = Date.now();

    await this.persist(state);

    log('info', '[stream-wizard] Stream launched via wizard', {
      sessionId,
      streamId: stream.streamId,
      mode,
      title: state.streamConfig.title,
      targets: result.simulcastTargets,
    });

    return { state, result };
  }

  // ─── State Management ─────────────────────────────────────────

  /**
   * Get current wizard state.
   */
  async getState(sessionId: string): Promise<WizardState | null> {
    try {
      const raw = await this.env.CACHE?.get(wizardKey(sessionId));
      return raw ? (JSON.parse(raw) as WizardState) : null;
    } catch {
      return null;
    }
  }

  /**
   * Get active wizard for a creator (if any).
   */
  async getActiveWizard(creatorId: string): Promise<WizardState | null> {
    try {
      const raw = await this.env.CACHE?.get(wizardCreatorKey(creatorId));
      if (!raw) return null;
      const sessionId = raw;
      return this.getState(sessionId);
    } catch {
      return null;
    }
  }

  /**
   * Cancel a wizard session.
   */
  async cancelWizard(sessionId: string): Promise<void> {
    const state = await this.getState(sessionId);
    if (!state) return;

    await this.env.CACHE?.delete(wizardKey(sessionId));
    await this.env.CACHE?.delete(wizardCreatorKey(state.creatorId));
  }

  /**
   * Get the current step info with available options.
   */
  async getCurrentStep(sessionId: string): Promise<{
    step: number;
    name: string;
    description: string;
    options: Record<string, unknown>;
  } | null> {
    const state = await this.getState(sessionId);
    if (!state) return null;

    const stepInfo = WIZARD_STEPS[state.currentStep];
    if (!stepInfo) return null;

    const options = this.getStepOptions(state.currentStep, state);

    return {
      step: state.currentStep + 1,
      name: stepInfo.name,
      description: stepInfo.description,
      options,
    };
  }

  // ─── Helpers ───────────────────────────────────────────────────

  /**
   * Get available options for the current step.
   */
  private getStepOptions(step: number, state: WizardState): Record<string, unknown> {
    switch (step) {
      case 0:
        return {
          orientations: [
            {
              id: 'portrait',
              label: 'Portrait',
              description: 'Vertical video (TikTok/Shorts style)',
              emoji: '📱',
            },
            {
              id: 'landscape',
              label: 'Landscape',
              description: 'Horizontal video (traditional stream)',
              emoji: '🖥️',
            },
          ],
          formats: [
            {
              id: 'short',
              label: 'Short Form',
              description: 'Under 60 seconds, vertical',
              emoji: '🎬',
            },
            {
              id: 'full',
              label: 'Full Stream',
              description: 'Traditional live stream',
              emoji: '📺',
            },
          ],
          categories: [
            'Gaming',
            'Music',
            'Talk Show',
            'Education',
            'Art',
            'Crypto/DeFi',
            'NFTs',
            'Coding',
            'Just Chatting',
            'Sports',
          ],
        };

      case 1:
        return {
          audiences: [
            {
              id: 'small',
              label: 'Small (<10)',
              description: 'P2P — zero bandwidth cost',
              mode: 'p2p',
              isFree: true,
              emoji: '🔗',
            },
            {
              id: 'medium',
              label: 'Medium (10-50)',
              description: 'Owncast — server handles it',
              mode: 'owncast',
              isFree: true,
              emoji: '📡',
            },
            {
              id: 'large',
              label: 'Large (50-500)',
              description: 'PeerTube — federated distribution',
              mode: 'peertube',
              isFree: true,
              emoji: '🎥',
            },
            {
              id: 'massive',
              label: 'Massive (500+)',
              description: 'Livepeer CDN — scales to thousands',
              mode: 'livepeer',
              isFree: false,
              emoji: '⚡',
            },
          ],
        };

      case 2:
        return {
          recommendedPlatform: state.audienceConfig?.recommendedMode || 'owncast',
          platforms: [
            { id: 'owncast', label: 'Owncast', emoji: '📡', recommended: true },
            { id: 'peertube', label: 'PeerTube', emoji: '🎥', recommended: true },
            {
              id: 'youtube',
              label: 'YouTube Live',
              emoji: '▶️',
              configured: !!this.env.YOUTUBE_API_KEY,
            },
            { id: 'twitch', label: 'Twitch', emoji: '📺', configured: !!this.env.TWITCH_CLIENT_ID },
            {
              id: 'farcaster',
              label: 'Farcaster',
              emoji: '📱',
              configured: !!this.env.FARCASTER_SIGNER_KEY,
            },
            { id: 'nostr', label: 'Nostr', emoji: '⚡', configured: true },
            { id: 'kick', label: 'Kick', emoji: '🎲', configured: false },
          ],
          simulcastEnabled: true,
          chatBridged: true,
          saveReplay: true,
        };

      case 3:
        return {
          monetizationTypes: [
            { id: 'none', label: 'Free', description: 'No monetization', emoji: '🆓' },
            { id: 'tips', label: 'Tips', description: 'Viewers can send crypto tips', emoji: '💸' },
            {
              id: 'token-gated',
              label: 'Token Gated',
              description: 'Only token holders can view',
              emoji: '🔐',
            },
            {
              id: 'both',
              label: 'Tips + Token Gate',
              description: 'Both monetization methods',
              emoji: '💰',
            },
          ],
          chains: ['ethereum', 'base', 'polygon', 'solana', 'zora'],
        };

      case 4:
        return {
          readyToGoLive: true,
          summary: {
            title: state.streamConfig?.title,
            orientation: state.streamConfig?.orientation,
            audience: state.audienceConfig?.expectedViewers,
            mode: state.audienceConfig?.recommendedMode,
            modeLabel: state.audienceConfig?.recommendedLabel,
            platforms: state.broadcastConfig?.platforms,
            tipsEnabled: state.monetizationConfig?.tipsEnabled,
            tokenGated: state.monetizationConfig?.tokenGated,
            cost: state.audienceConfig?.estimatedCost,
            isFree: state.audienceConfig?.isFree,
          },
        };

      default:
        return {};
    }
  }

  /**
   * Get the default streaming platform for a given mode.
   */
  private getDefaultPlatform(mode: StreamingMode): string {
    switch (mode) {
      case 'p2p':
        return 'degenfeed';
      case 'owncast':
        return 'owncast';
      case 'peertube':
        return 'peertube';
      case 'livepeer':
      case 'cloudflare':
        return 'owncast';
      default:
        return 'owncast';
    }
  }

  private async persist(state: WizardState): Promise<void> {
    try {
      await this.env.CACHE?.put(wizardKey(state.sessionId), JSON.stringify(state), {
        expirationTtl: 86400,
      });

      await this.env.CACHE?.put(wizardCreatorKey(state.creatorId), state.sessionId, {
        expirationTtl: 86400,
      });
    } catch {
      // Non-critical
    }
  }
}

// ─── Route Handlers ──────────────────────────────────────────────────

/**
 * POST /api/live/wizard/start
 * Start a new stream configuration wizard.
 */
export async function handleWizardStart(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);

  try {
    const body = (await request.json()) as { creatorId?: string };
    if (!body.creatorId) {
      return new Response(JSON.stringify({ error: 'creatorId is required' }), { status: 400 });
    }

    const wizard = new StreamWizard(env);
    const state = await wizard.initialize(body.creatorId);

    return new Response(
      JSON.stringify({
        ok: true,
        sessionId: state.sessionId,
        currentStep: 1,
        step: WIZARD_STEPS[0],
        next: {
          step: 1,
          name: 'Stream Setup',
          options: wizard.getCurrentStep(state.sessionId),
        },
      }),
      { status: 201, headers: { 'content-type': 'application/json' } },
    );
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: `Failed to start wizard: ${error}` }), {
      status: 500,
    });
  }
}

/**
 * POST /api/live/wizard/step1
 * Set stream configuration.
 */
export async function handleWizardStep1(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);

  try {
    const body = (await request.json()) as {
      sessionId?: string;
      title?: string;
      description?: string;
      orientation?: StreamOrientation;
      format?: StreamFormat;
      category?: string;
      tags?: string[];
    };

    if (!body.sessionId || !body.title) {
      return new Response(JSON.stringify({ error: 'sessionId and title are required' }), {
        status: 400,
      });
    }

    const wizard = new StreamWizard(env);
    const state = await wizard.setStreamConfig(body.sessionId, {
      title: body.title,
      description: body.description,
      orientation: body.orientation || 'landscape',
      format: body.format || 'full',
      category: body.category,
      tags: body.tags,
    });

    return new Response(
      JSON.stringify({
        ok: true,
        sessionId: state.sessionId,
        currentStep: 2,
        next: wizard.getCurrentStep(state.sessionId),
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: `Step 1 failed: ${error}` }), { status: 500 });
  }
}

/**
 * POST /api/live/wizard/step2
 * Set audience estimation.
 */
export async function handleWizardStep2(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);

  try {
    const body = (await request.json()) as {
      sessionId?: string;
      expectedViewers?: ExpectedAudience;
    };

    if (!body.sessionId || !body.expectedViewers) {
      return new Response(JSON.stringify({ error: 'sessionId and expectedViewers are required' }), {
        status: 400,
      });
    }

    const validAudiences: ExpectedAudience[] = ['small', 'medium', 'large', 'massive'];
    if (!validAudiences.includes(body.expectedViewers)) {
      return new Response(
        JSON.stringify({ error: `Invalid audience. Must be: ${validAudiences.join(', ')}` }),
        { status: 400 },
      );
    }

    const wizard = new StreamWizard(env);
    const { state, recommendation } = await wizard.setAudienceConfig(
      body.sessionId,
      body.expectedViewers,
    );

    return new Response(
      JSON.stringify({
        ok: true,
        sessionId: state.sessionId,
        currentStep: 3,
        recommendation,
        next: wizard.getCurrentStep(state.sessionId),
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: `Step 2 failed: ${error}` }), { status: 500 });
  }
}

/**
 * POST /api/live/wizard/step3
 * Set broadcast targets.
 */
export async function handleWizardStep3(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);

  try {
    const body = (await request.json()) as {
      sessionId?: string;
      platforms?: SimulcastPlatform[];
      simulcastEnabled?: boolean;
      chatBridged?: boolean;
      saveReplay?: boolean;
    };

    if (!body.sessionId || !body.platforms) {
      return new Response(JSON.stringify({ error: 'sessionId and platforms are required' }), {
        status: 400,
      });
    }

    const wizard = new StreamWizard(env);
    const state = await wizard.setBroadcastConfig(body.sessionId, body.platforms, {
      simulcastEnabled: body.simulcastEnabled,
      chatBridged: body.chatBridged,
      saveReplay: body.saveReplay,
    });

    return new Response(
      JSON.stringify({
        ok: true,
        sessionId: state.sessionId,
        currentStep: 4,
        next: wizard.getCurrentStep(state.sessionId),
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: `Step 3 failed: ${error}` }), { status: 500 });
  }
}

/**
 * POST /api/live/wizard/step4
 * Set monetization configuration.
 */
export async function handleWizardStep4(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);

  try {
    const body = (await request.json()) as {
      sessionId?: string;
      tipsEnabled?: boolean;
      tokenGated?: boolean;
      tokenAddress?: string;
      minTokenAmount?: string;
    };

    if (!body.sessionId) {
      return new Response(JSON.stringify({ error: 'sessionId is required' }), { status: 400 });
    }

    const wizard = new StreamWizard(env);
    const state = await wizard.setMonetizationConfig(body.sessionId, {
      tipsEnabled: body.tipsEnabled ?? false,
      tokenGated: body.tokenGated ?? false,
      tokenAddress: body.tokenAddress,
      minTokenAmount: body.minTokenAmount,
    });

    return new Response(
      JSON.stringify({
        ok: true,
        sessionId: state.sessionId,
        currentStep: 5,
        next: wizard.getCurrentStep(state.sessionId),
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: `Step 4 failed: ${error}` }), { status: 500 });
  }
}

/**
 * POST /api/live/wizard/step5
 * Go Live!
 */
export async function handleWizardGoLive(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);

  try {
    const body = (await request.json()) as { sessionId?: string };
    if (!body.sessionId) {
      return new Response(JSON.stringify({ error: 'sessionId is required' }), { status: 400 });
    }

    const wizard = new StreamWizard(env);
    const { state, result } = await wizard.goLive(body.sessionId);

    return new Response(
      JSON.stringify({
        ok: true,
        sessionId: state.sessionId,
        streamId: result.streamId,
        mode: result.mode,
        rtmpUrl: result.rtmpUrl,
        streamKey: result.streamKey,
        playbackUrl: result.playbackUrl,
        simulcastSessionId: result.simulcastSessionId,
        simulcastTargets: result.simulcastTargets,
        ipfsVodEnabled: result.ipfsVodEnabled,
        costEstimate: result.costEstimate,
        steps: state.steps.map((s) => ({
          step: s.step,
          name: s.name,
          completed: s.completed,
        })),
      }),
      { status: 201, headers: { 'content-type': 'application/json' } },
    );
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: `Failed to go live: ${error}` }), {
      status: 500,
    });
  }
}

/**
 * GET /api/live/wizard/status/:sessionId
 * Get current wizard status.
 */
export async function handleWizardStatus(
  request: Request,
  env: Env,
  sessionId: string,
): Promise<Response> {
  if (request.method !== 'GET') return methodNotAllowed(['GET']);

  try {
    const wizard = new StreamWizard(env);
    const state = await wizard.getState(sessionId);

    if (!state) {
      return new Response(JSON.stringify({ error: 'Wizard session not found' }), { status: 404 });
    }

    return new Response(
      JSON.stringify({
        sessionId: state.sessionId,
        completed: state.completed,
        currentStep: state.currentStep + 1,
        totalSteps: 5,
        steps: state.steps,
        streamConfig: state.streamConfig,
        audienceConfig: state.audienceConfig,
        broadcastConfig: state.broadcastConfig,
        monetizationConfig: state.monetizationConfig,
        goLiveResult: state.goLiveResult,
        nextStep: wizard.getCurrentStep(state.sessionId),
      }),
      {
        status: 200,
        headers: { 'content-type': 'application/json' },
      },
    );
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: `Failed to get wizard status: ${error}` }), {
      status: 500,
    });
  }
}

/**
 * DELETE /api/live/wizard/cancel/:sessionId
 * Cancel a wizard session.
 */
export async function handleWizardCancel(
  request: Request,
  env: Env,
  sessionId: string,
): Promise<Response> {
  if (request.method !== 'DELETE') return methodNotAllowed(['DELETE']);

  try {
    const wizard = new StreamWizard(env);
    await wizard.cancelWizard(sessionId);

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: `Failed to cancel wizard: ${error}` }), {
      status: 500,
    });
  }
}
