/**
 * Web2 User Onboarding — DegenFeed's "normie on-ramp"
 *
 * Special onboarding flow for web2 users:
 * 1. "Connect your Twitter" → auto-discovers your content
 * 2. "Your tweets can earn tips on web3" → incentive to bridge
 * 3. One-click bridge setup → wallet creation (or link existing)
 * 4. "Your identity is now portable across 27+ networks"
 *
 * @module bridge/web2-onboarding
 */

// ─── Types ──────────────────────────────────────────────────────────────

export type OnboardingStep =
  | 'welcome'
  | 'connect-twitter'
  | 'content-discovery'
  | 'bridge-setup'
  | 'wallet-create'
  | 'wallet-link'
  | 'identity-portable'
  | 'complete';

export interface OnboardingFlow {
  /** Unique session ID */
  sessionId: string;
  /** Current step in the flow */
  currentStep: OnboardingStep;
  /** Steps completed so far */
  completedSteps: OnboardingStep[];
  /** Whether the flow is complete */
  isComplete: boolean;
  /** When the flow started */
  startedAt: number;
  /** When the flow was completed */
  completedAt?: number;

  /** Connected web2 accounts */
  connectedAccounts: {
    twitter?: { userId: string; username: string };
    github?: { userId: string; login: string };
    discord?: { userId: string; username: string };
    reddit?: { userId: string; username: string };
  };

  /** The generated wallet (if created) */
  createdWallet?: {
    address: string;
    chain: 'evm' | 'solana';
    seedGenerated: boolean;
    backedUp: boolean;
  };

  /** Linked existing wallet */
  linkedWallet?: {
    address: string;
    chain: 'evm' | 'solana';
    verified: boolean;
  };

  /** The unified DegenFeed ID */
  degenfeedId?: string;

  /** Content that was discovered from connected accounts */
  discoveredContent: {
    totalPosts: number;
    totalEngagement: number;
    niches: string[];
    topSources: string[];
  };

  /** Bridge status per network */
  bridges: Record<
    string,
    {
      enabled: boolean;
      connectedAt?: number;
      postCount?: number;
    }
  >;
}

// ─── Onboarding Orchestrator ────────────────────────────────────────────

export class Web2Onboarding {
  private sessions = new Map<string, OnboardingFlow>();

  /**
   * Start a new onboarding session.
   */
  startSession(sessionId?: string): OnboardingFlow {
    const id = sessionId || `onboard-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const flow: OnboardingFlow = {
      sessionId: id,
      currentStep: 'welcome',
      completedSteps: [],
      isComplete: false,
      startedAt: Date.now(),
      connectedAccounts: {},
      discoveredContent: {
        totalPosts: 0,
        totalEngagement: 0,
        niches: [],
        topSources: [],
      },
      bridges: {},
    };
    this.sessions.set(id, flow);
    return flow;
  }

  /**
   * Get the current state of an onboarding flow.
   */
  getFlow(sessionId: string): OnboardingFlow | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Step 1: Connect Twitter/X.
   * Discovers the user's Twitter content and starts the bridge flow.
   */
  async connectTwitter(
    sessionId: string,
    twitterUserId: string,
    twitterUsername: string,
    oauthToken: string,
  ): Promise<OnboardingFlow> {
    const flow = this.getOrThrow(sessionId);

    flow.connectedAccounts.twitter = { userId: twitterUserId, username: twitterUsername };
    flow.completedSteps.push('connect-twitter');

    // Auto-discover content (simulate — in production, fetch from Twitter API)
    flow.discoveredContent = {
      totalPosts: 142,
      totalEngagement: 3847,
      niches: ['crypto', 'defi', 'tech', 'ai'],
      topSources: ['twitter', 'github'],
    };

    console.log(
      `[onboarding] Twitter connected: @${twitterUsername} — ${flow.discoveredContent.totalPosts} posts discovered`,
    );

    // Advance to content discovery step
    flow.currentStep = 'content-discovery';
    this.sessions.set(sessionId, flow);
    return flow;
  }

  /**
   * Step 2: Show discovered content with tip potential.
   * "Your tweets can earn tips on web3"
   */
  async showContentValue(sessionId: string): Promise<{
    estimatedEarnings: string;
    topPosts: Array<{ text: string; estimatedTips: string }>;
    niches: string[];
  }> {
    const flow = this.getOrThrow(sessionId);

    // Calculate estimated earnings based on discovered content
    const estimatedEarnings = `~${(flow.discoveredContent.totalEngagement * 0.001).toFixed(2)} ETH`;
    const nicheStr = flow.discoveredContent.niches.slice(0, 3).join(', ');

    console.log(
      `[onboarding] Content value: ${estimatedEarnings} potential from ${flow.discoveredContent.totalPosts} posts (${nicheStr})`,
    );

    return {
      estimatedEarnings,
      topPosts: [
        { text: 'Bitcoin is the future of money', estimatedTips: '0.005 ETH' },
        { text: 'Just deployed my first Solana program', estimatedTips: '0.003 ETH' },
        { text: 'DeFi summer never ended', estimatedTips: '0.002 ETH' },
      ],
      niches: flow.discoveredContent.niches,
    };
  }

  /**
   * Step 3: Decide wallet strategy.
   * User can either create a new wallet or link an existing one.
   */
  async chooseWalletStrategy(
    sessionId: string,
    strategy: 'create' | 'link-existing',
  ): Promise<OnboardingFlow> {
    const flow = this.getOrThrow(sessionId);

    if (strategy === 'create') {
      flow.currentStep = 'wallet-create';
    } else {
      flow.currentStep = 'wallet-link';
    }

    flow.completedSteps.push('bridge-setup');
    this.sessions.set(sessionId, flow);
    return flow;
  }

  /**
   * Step 3a: Create a new wallet for the user.
   * Non-custodial: we generate the keypair on the client and never see the private key.
   */
  async createWallet(sessionId: string): Promise<{
    address: string;
    chain: 'evm' | 'solana';
    seedPhrase?: string;
    warning: string;
  }> {
    const flow = this.getOrThrow(sessionId);

    // In production: generate the wallet via client-side ethers.js / @solana/web3.js
    // For demo: return a deterministic address based on session
    const address = `0x${Buffer.from(sessionId).toString('hex').slice(0, 40).padEnd(40, '0')}`;

    flow.createdWallet = {
      address,
      chain: 'evm',
      seedGenerated: true,
      backedUp: false,
    };
    flow.completedSteps.push('wallet-create');
    flow.currentStep = 'identity-portable';

    this.sessions.set(sessionId, flow);

    console.log(`[onboarding] Wallet created: ${address} (EVM) — remind user to back up seed`);

    return {
      address,
      chain: 'evm',
      seedPhrase: '<runtime-generated-mnemonic>', // gitleaks:allow — placeholder replaced at runtime
      warning: 'WRITE THIS DOWN. Never share it. DegenFeed cannot recover your wallet.',
    };
  }

  /**
   * Step 3b: Link an existing wallet.
   * Verify ownership via signed message.
   */
  async linkExistingWallet(
    sessionId: string,
    walletAddress: string,
    chain: 'evm' | 'solana',
    signature: string,
    message: string,
  ): Promise<OnboardingFlow> {
    const flow = this.getOrThrow(sessionId);

    // In production: verify signature matches message + wallet address
    const verified = signature.length > 10; // Placeholder

    flow.linkedWallet = {
      address: walletAddress,
      chain,
      verified,
    };
    flow.completedSteps.push('wallet-link');
    flow.currentStep = 'identity-portable';

    this.sessions.set(sessionId, flow);
    console.log(
      `[onboarding] Wallet linked: ${walletAddress} (${chain}) — ${verified ? 'verified' : 'verification failed'}`,
    );

    return flow;
  }

  /**
   * Step 4: Configure bridges.
   * "Your identity is now portable across 27+ networks"
   */
  async configureBridges(
    sessionId: string,
    enabledBridges: Array<{
      protocol: string;
      autoPost: boolean;
      bidirectional: boolean;
    }>,
  ): Promise<{
    bridgeCount: number;
    bridgedProtocols: string[];
    identityUrl: string;
  }> {
    const flow = this.getOrThrow(sessionId);

    for (const bridge of enabledBridges) {
      flow.bridges[bridge.protocol] = {
        enabled: true,
        connectedAt: Date.now(),
        postCount: 0,
      };
    }

    flow.completedSteps.push('identity-portable');
    flow.degenfeedId = `df:${flow.sessionId}`;
    flow.isComplete = true;
    flow.completedAt = Date.now();
    flow.currentStep = 'complete';

    this.sessions.set(sessionId, flow);

    const identityUrl = `https://degenfeed.xyz/profile/${flow.degenfeedId}`;

    console.log(
      `[onboarding] COMPLETE: ${flow.degenfeedId} — ${enabledBridges.length} bridges active`,
    );
    console.log(`[onboarding] Identity portable: ${identityUrl}`);

    return {
      bridgeCount: enabledBridges.length,
      bridgedProtocols: enabledBridges.map((b) => b.protocol),
      identityUrl,
    };
  }

  /**
   * Get the onboarding summary for the user dashboard.
   */
  getOnboardingSummary(sessionId: string): {
    connected: string[];
    walletStatus: string;
    earnings: string;
    bridges: string[];
    nextSteps: string[];
  } | null {
    const flow = this.sessions.get(sessionId);
    if (!flow) return null;

    const connected: string[] = [];
    if (flow.connectedAccounts.twitter) connected.push(`Twitter: @${flow.connectedAccounts.twitter.username}`);
    if (flow.connectedAccounts.github) connected.push(`GitHub: @${flow.connectedAccounts.github.login}`);
    if (flow.connectedAccounts.discord) connected.push(`Discord: ${flow.connectedAccounts.discord.username}`);

    const walletStatus = flow.createdWallet
      ? 'New wallet created'
      : flow.linkedWallet
        ? `Wallet linked: ${flow.linkedWallet.address.slice(0, 6)}...${flow.linkedWallet.address.slice(-4)}`
        : 'No wallet configured';

    const bridges = Object.entries(flow.bridges)
      .filter(([, b]) => b.enabled)
      .map(([protocol]) => protocol);

    const nextSteps: string[] = [];
    if (!flow.connectedAccounts.github) nextSteps.push('Connect GitHub');
    if (!flow.connectedAccounts.discord) nextSteps.push('Connect Discord');
    if (!flow.createdWallet?.backedUp) nextSteps.push('Back up your seed phrase');
    if (bridges.length < 3) nextSteps.push('Enable more protocol bridges');

    return {
      connected,
      walletStatus,
      earnings: `~${(flow.discoveredContent.totalEngagement * 0.001).toFixed(2)} ETH potential`,
      bridges,
      nextSteps,
    };
  }

  /**
   * Get all active onboarding sessions.
   */
  getActiveSessions(): OnboardingFlow[] {
    return [...this.sessions.values()].filter((s) => !s.isComplete);
  }

  /**
   * Get completion stats.
   */
  getStats(): {
    totalSessions: number;
    completedSessions: number;
    walletsCreated: number;
    walletsLinked: number;
    averageBridges: number;
  } {
    const all = [...this.sessions.values()];
    const completed = all.filter((s) => s.isComplete);

    return {
      totalSessions: all.length,
      completedSessions: completed.length,
      walletsCreated: completed.filter((s) => s.createdWallet).length,
      walletsLinked: completed.filter((s) => s.linkedWallet).length,
      averageBridges:
        completed.length > 0
          ? completed.reduce((sum, s) => sum + Object.keys(s.bridges).length, 0) / completed.length
          : 0,
    };
  }

  private getOrThrow(sessionId: string): OnboardingFlow {
    const flow = this.sessions.get(sessionId);
    if (!flow) throw new Error(`Onboarding session not found: ${sessionId}`);
    return flow;
  }
}

// ─── Incentive Templates ────────────────────────────────────────────────

export const ONBOARDING_MESSAGES = {
  welcome: {
    title: 'Welcome to DegenFeed',
    subtitle: 'Your content works across 27+ networks',
    cta: 'Connect Twitter to start',
  },
  connectTwitter: {
    title: 'Connect Your Twitter',
    body: 'We\'ll discover your content and show you how it can earn on web3',
    incentive: 'Your tweets can earn tips from crypto communities',
  },
  contentDiscovery: {
    title: 'Your Content Has Value',
    body: 'We found your best posts — they could earn tips on web3',
    estimated: 'Estimated monthly earning potential',
  },
  bridgeSetup: {
    title: 'One-Click Bridge Setup',
    body: 'Your identity becomes portable across 27+ networks instantly',
    features: [
      'Bluesky, Mastodon, Nostr, Farcaster, Lens',
      'Twitter → Nostr content bridge',
      'Mastodon → Farcaster cross-posting',
    ],
  },
  walletCreate: {
    title: 'Your Web3 Wallet',
    body: 'We\'ll help you create a wallet — or link one you already have',
    warning: 'Write down your seed phrase. Never share it.',
  },
  complete: {
    title: 'Your Identity is Portable',
    body: 'You\'re now connected across the open social graph',
    stats: 'Connected to 27+ networks',
    cta: 'Go to your feed',
  },
} as const;

// ─── Quick Onboarding: All-in-One ───────────────────────────────────────

/**
 * Express onboarding: connect Twitter, create wallet, enable bridges in one call.
 */
export async function quickOnboard(opts: {
  twitterUserId?: string;
  twitterUsername?: string;
  walletAddress?: string;
  walletChain?: 'evm' | 'solana';
  enableBridges?: string[];
}): Promise<{
  sessionId: string;
  degenfeedId: string;
  walletAddress?: string;
  bridges: string[];
  identityUrl: string;
  message: string;
}> {
  const onboarding = new Web2Onboarding();
  const flow = onboarding.startSession();

  if (opts.twitterUserId && opts.twitterUsername) {
    await onboarding.connectTwitter(
      flow.sessionId,
      opts.twitterUserId,
      opts.twitterUsername,
      'oauth-token-placeholder',
    );
  }

  if (opts.walletAddress && opts.walletChain) {
    await onboarding.linkExistingWallet(
      flow.sessionId,
      opts.walletAddress,
      opts.walletChain,
      'placeholder-signature',
      'Verify wallet for DegenFeed',
    );
  } else {
    await onboarding.createWallet(flow.sessionId);
  }

  const bridges =
    opts.enableBridges?.map((p) => ({
      protocol: p,
      autoPost: true,
      bidirectional: true,
    })) || [
      { protocol: 'nostr', autoPost: true, bidirectional: true },
      { protocol: 'farcaster', autoPost: true, bidirectional: true },
      { protocol: 'lens', autoPost: true, bidirectional: true },
      { protocol: 'bluesky', autoPost: true, bidirectional: true },
      { protocol: 'mastodon', autoPost: true, bidirectional: true },
    ];

  const bridgeResult = await onboarding.configureBridges(flow.sessionId, bridges);

  return {
    sessionId: flow.sessionId,
    degenfeedId: flow.degenfeedId || `df:${flow.sessionId}`,
    walletAddress: opts.walletAddress || flow.createdWallet?.address,
    bridges: bridgeResult.bridgedProtocols,
    identityUrl: bridgeResult.identityUrl,
    message: `🎉 Welcome! Your identity is now portable across ${bridgeResult.bridgeCount} networks.`,
  };
}
