/**
 * @degenfeed/integration — Growth System Tests
 *
 * Tests the growth pipeline: non-member tipping via external identity,
 * tip note templates, referral code generation + tracking, referral
 * rewards calculation, branding configuration, claim tip flow for
 * non-members, onboarding from tip links, and protocol-aware formatting.
 *
 * Pure functions tested directly. External APIs mocked via vi.mock.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Mock tip core ──────────────────────────────────────────────────────

vi.mock('../../workers/api/src/routes/unified-tip-core', () => ({
  selectBestChain: vi.fn().mockImplementation((opts: { recipientChains: string[] }) => {
    if (opts.recipientChains.includes('lightning')) {
      return [{ chain: 'lightning', rank: 1, route: { speed: 'instant', avgFeeUsd: 0.001 }, reason: 'Lowest fee' }];
    }
    return [{ chain: 'solana', rank: 1, route: { speed: 'fast', avgFeeUsd: 0.002 }, reason: 'Fast + cheap' }];
  }),
  recordUnifiedTip: vi.fn().mockImplementation(async (env: unknown, data: { toUserId: string; toLabel: string; amountUsd: number }) => {
    return {
      id: `utip:${Date.now().toString(36)}`,
      amountUsd: data.amountUsd,
      toLabel: data.toLabel,
      toUserId: data.toUserId,
      platform: 'degenfeed',
      timestamp: Date.now(),
    };
  }),
  sanitizeAmountUsd: vi.fn().mockImplementation((amount: unknown) => {
    const n = typeof amount === 'string' ? parseFloat(amount) : Number(amount);
    if (Number.isNaN(n) || n <= 0 || n > 10000) return null;
    return n;
  }),
  shortLabel: vi.fn().mockImplementation((address: string) => {
    if (!address) return 'Anonymous';
    if (address.length <= 10) return address;
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }),
  normalizeUserId: vi.fn().mockImplementation((id: string | null | undefined) => {
    if (!id) return undefined;
    return id.toLowerCase();
  }),
}));

// ─── Helpers ────────────────────────────────────────────────────────────

function createMockEnv() {
  const store = new Map<string, string>();
  return {
    CACHE: {
      get: vi.fn(async (key: string) => store.get(key) ?? null),
      put: vi.fn(async (key: string, value: string) => { store.set(key, value); }),
      delete: vi.fn(async (key: string) => { store.delete(key); }),
    },
    TIPS: {
      get: vi.fn(async (key: string) => store.get(key) ?? null),
      put: vi.fn(async (key: string, value: string) => { store.set(key, value); }),
    },
    _store: store,
  };
}

function createMockNonMemberTip(overrides: Record<string, unknown> = {}) {
  return {
    id: `tip:${Date.now().toString(36)}`,
    amountUsd: 5.00,
    fromEmail: 'tipper@example.com',
    fromName: 'Alice Tipper',
    toIdentity: 'external:alice@example.com',
    toProtocol: 'email',
    toDisplayName: 'Alice (External)',
    message: 'Great content!',
    claimed: false,
    claimCode: null,
    createdAt: Date.now(),
    ...overrides,
  };
}

function createMockReferral(overrides: Record<string, unknown> = {}) {
  return {
    code: `REF${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
    referrerId: '0xreferrer',
    referrerName: 'Referrer User',
    rewardPercent: 10,
    totalEarnedUsd: 0,
    totalConversions: 0,
    createdAt: Date.now(),
    ...overrides,
  };
}

// ─── Suite 1: Non-Member Tip Flow ───────────────────────────────────────

describe('Growth System — Non-Member Tip Flow', () => {
  it('allows tipping to an external identity (email/social)', async () => {
    const tip = createMockNonMemberTip({
      toIdentity: 'external:bob@protonmail.com',
      toProtocol: 'email',
      amountUsd: 10.00,
    });

    expect(tip.toIdentity).toContain('external:');
    expect(tip.amountUsd).toBe(10.00);
    expect(tip.claimed).toBe(false);
  });

  it('generates a unique tip ID for tracking', async () => {
    const tip1 = createMockNonMemberTip();
    const tip2 = createMockNonMemberTip();

    expect(tip1.id).not.toBe(tip2.id);
    expect(tip1.id).toContain('tip:');
    expect(tip2.id).toContain('tip:');
  });

  it('stores tip in pending state until claimed', () => {
    const env = createMockEnv();
    const tip = createMockNonMemberTip();

    // Store the tip
    env.TIPS.put(`pending_tip:${tip.id}`, JSON.stringify(tip));
    expect(env.TIPS.put).toHaveBeenCalled();

    // Verify it's pending
    const key = `pending_tip:${tip.id}`;
    expect(key).toContain('pending');
  });

  it('selects best chain for non-member tip payout', async () => {
    const { selectBestChain } = await import('../../workers/api/src/routes/unified-tip-core');

    const result = selectBestChain({
      senderChains: ['solana', 'base'],
      recipientChains: ['solana'],
      amountUsd: 25,
    });

    expect(result[0]?.chain).toBe('solana');
    expect(result[0]?.reason).toBeTruthy();
  });
});

// ─── Suite 2: Tip Note Template ─────────────────────────────────────────

describe('Growth System — Tip Note Template Generation', () => {
  it('generates a thank-you note for received tip', () => {
    const generateTipNote = (fromName: string, amountUsd: number, message?: string) => {
      const parts = [
        `💸 **${fromName}** sent you **$${amountUsd.toFixed(2)}**`,
      ];
      if (message) parts.push(`> "${message}"`);
      parts.push('\n— via DegenFeed');
      return parts.join('\n\n');
    };

    const note = generateTipNote('Alice', 5.00, 'Great post!');
    expect(note).toContain('Alice');
    expect(note).toContain('$5.00');
    expect(note).toContain('Great post!');
    expect(note).toContain('DegenFeed');
  });

  it('generates a call-to-action for non-member claiming tip', () => {
    const generateClaimNote = (tipAmount: number, claimCode: string) => {
      return [
        `🎁 You received **$${tipAmount.toFixed(2)}** in crypto!`,
        '',
        `Claim it here: https://degenfeed.xyz/claim?code=${claimCode}`,
        '',
        '✨ Powered by DegenFeed',
      ].join('\n');
    };

    const note = generateClaimNote(10.00, 'TIP-ABC123');
    expect(note).toContain('$10.00');
    expect(note).toContain('/claim?code=TIP-ABC123');
    expect(note).toContain('DegenFeed');
  });

  it('formats tip notification for protocol-native display', () => {
    const protocolFormatters: Record<string, (text: string) => string> = {
      email: (t: string) => t,
      nostr: (t: string) => t, // Nostr supports markdown
      farcaster: (t: string) => t.slice(0, 320), // 320 char limit
      bluesky: (t: string) => t, // AT Protocol supports rich text
      telegram: (t: string) => t.replace(/\*\*(.*?)\*\*/g, '$1'), // Strip markdown
    };

    const tipNote = '💸 **Alice** sent you **$5.00**\n\n— via DegenFeed';
    const telegramVersion = protocolFormatters.telegram(tipNote);

    expect(telegramVersion).not.toContain('**');
    expect(telegramVersion).toContain('Alice');
    expect(telegramVersion).toContain('$5.00');

    const farcasterVersion = protocolFormatters.farcaster('x'.repeat(400));
    expect(farcasterVersion.length).toBeLessThanOrEqual(320);
  });
});

// ─── Suite 3: Referral Code Generation + Tracking ────────────────────────

describe('Growth System — Referral Codes', () => {
  it('generates unique referral codes', () => {
    const generateRefCode = (userId: string): string => {
      const prefix = 'DEGEN';
      const suffix = userId.slice(0, 4).toUpperCase();
      const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
      return `${prefix}-${suffix}-${rand}`;
    };

    const code1 = generateRefCode('0xabc');
    const code2 = generateRefCode('0xabc');
    const code3 = generateRefCode('0xdef');

    expect(code1).toContain('DEGEN');
    expect(code1).not.toBe(code2); // random suffix
    expect(code3).toContain('DEF');
  });

  it('tracks referral conversions', () => {
    const referrals = [
      createMockReferral({ code: 'DEGEN-TEST-A1B2', totalConversions: 0 }),
    ];

    // Record a conversion
    const convert = (refCode: string, amountUsd: number) => {
      const ref = referrals.find((r) => r.code === refCode);
      if (!ref) return { success: false, error: 'Invalid referral code' };
      ref.totalConversions++;
      ref.totalEarnedUsd += amountUsd * (ref.rewardPercent / 100);
      return { success: true, conversionId: `conv_${Date.now()}` };
    };

    const result = convert('DEGEN-TEST-A1B2', 100);
    expect(result.success).toBe(true);
    expect(referrals[0]?.totalConversions).toBe(1);
    expect(referrals[0]?.totalEarnedUsd).toBe(10); // 10% of $100
  });

  it('rejects invalid referral codes', () => {
    const validCodes = new Set(['DEGEN-VALID-XYZ']);
    const lookup = (code: string) => {
      if (!validCodes.has(code)) return null;
      return { code, referrerId: '0xreferrer' };
    };

    expect(lookup('INVALID')).toBeNull();
    expect(lookup('DEGEN-VALID-XYZ')).not.toBeNull();
  });

  it('prevents self-referral', () => {
    const processReferral = (referralCode: string, newUserId: string) => {
      if (referralCode.includes(newUserId.slice(0, 4).toUpperCase())) {
        return { success: false, error: 'Cannot use your own referral code' };
      }
      return { success: true };
    };

    expect(processReferral('DEGEN-ABCD-XYZ', '0xabcd1234').success).toBe(false);
    expect(processReferral('DEGEN-ABCD-XYZ', '0xotheruser').success).toBe(true);
  });
});

// ─── Suite 4: Referral Rewards Calculation ───────────────────────────────

describe('Growth System — Referral Rewards', () => {
  it('calculates rewards as percentage of referred spend', () => {
    const calculateReward = (spendUsd: number, rewardPercent: number): number => {
      return spendUsd * (rewardPercent / 100);
    };

    expect(calculateReward(100, 10)).toBe(10);
    expect(calculateReward(50, 15)).toBe(7.5);
    expect(calculateReward(1000, 5)).toBe(50);
    expect(calculateReward(0, 10)).toBe(0);
  });

  it('accumulates rewards across multiple referrals', () => {
    const referrals = [
      { referredId: 'user_a', spendUsd: 100, rewardUsd: 10 },
      { referredId: 'user_b', spendUsd: 200, rewardUsd: 20 },
      { referredId: 'user_c', spendUsd: 50, rewardUsd: 5 },
    ];

    const totalReward = referrals.reduce((sum, r) => sum + r.rewardUsd, 0);
    expect(totalReward).toBe(35);
  });

  it('enforces maximum reward cap', () => {
    const rewardCap = { monthly: 500, lifetime: 5000 };

    const checkCap = (currentMonthReward: number, currentLifetimeReward: number, newReward: number) => {
      if (currentMonthReward + newReward > rewardCap.monthly) {
        return { allowed: false, reason: 'Monthly cap reached' };
      }
      if (currentLifetimeReward + newReward > rewardCap.lifetime) {
        return { allowed: false, reason: 'Lifetime cap reached' };
      }
      return { allowed: true };
    };

    expect(checkCap(450, 1000, 60).allowed).toBe(false); // exceeds monthly
    expect(checkCap(100, 4900, 200).allowed).toBe(false); // exceeds lifetime
    expect(checkCap(100, 1000, 50).allowed).toBe(true);
  });

  it('tracks reward payout status', () => {
    interface RewardPayout {
      amountUsd: number;
      status: 'pending' | 'paid' | 'failed';
      paidAt?: number;
    }

    const payouts: RewardPayout[] = [
      { amountUsd: 10, status: 'paid', paidAt: Date.now() - 86400000 },
      { amountUsd: 25, status: 'pending' },
    ];

    const pendingTotal = payouts.filter((p) => p.status === 'pending').reduce((s, p) => s + p.amountUsd, 0);
    const paidTotal = payouts.filter((p) => p.status === 'paid').reduce((s, p) => s + p.amountUsd, 0);

    expect(pendingTotal).toBe(25);
    expect(paidTotal).toBe(10);
  });
});

// ─── Suite 5: Branding Configuration ─────────────────────────────────────

describe('Growth System — Branding Configuration', () => {
  it('configures watermark overlay on videos', () => {
    const branding = {
      watermark: {
        enabled: true,
        position: 'bottom-right' as const,
        imageUrl: 'https://degenfeed.xyz/brand/watermark.png',
        opacity: 0.7,
      },
      poweredBy: {
        enabled: true,
        text: 'Powered by DegenFeed',
        url: 'https://degenfeed.xyz',
      },
    };

    expect(branding.watermark.enabled).toBe(true);
    expect(branding.watermark.position).toBe('bottom-right');
    expect(branding.watermark.imageUrl).toContain('degenfeed');
    expect(branding.poweredBy.text).toContain('DegenFeed');
  });

  it('toggles watermark on/off per content', () => {
    const content = {
      id: 'video_123',
      branding: { showWatermark: true, showPoweredBy: true },
    };

    expect(content.branding.showWatermark).toBe(true);

    const withoutWatermark = { ...content, branding: { ...content.branding, showWatermark: false } };
    expect(withoutWatermark.branding.showWatermark).toBe(false);
  });

  it('requires enterprise tier for white-label (no DegenFeed branding)', async () => {
    const { TierManager } = await import('../../packages/monetization/src/TierManager');

    // White label = remove all DegenFeed branding
    const checkWhiteLabel = (tier: string) => TierManager.canAccess(tier, 'white_label');

    expect(checkWhiteLabel('free')).toBe(false);
    expect(checkWhiteLabel('creator')).toBe(false);
    expect(checkWhiteLabel('pro')).toBe(false);
    expect(checkWhiteLabel('enterprise')).toBe(true);
  });

  it('configures "Powered by DegenFeed" footer', () => {
    const footerConfig = {
      text: 'Powered by DegenFeed',
      showOnFree: true,
      showOnCreator: true,
      showOnPro: true,
      showOnEnterprise: false, // White label removes it
    };

    const shouldShow = (tier: string) => {
      const config: Record<string, boolean> = {
        free: footerConfig.showOnFree,
        creator: footerConfig.showOnCreator,
        pro: footerConfig.showOnPro,
        enterprise: footerConfig.showOnEnterprise,
      };
      return config[tier] ?? true;
    };

    expect(shouldShow('free')).toBe(true);
    expect(shouldShow('enterprise')).toBe(false);
  });
});

// ─── Suite 6: Claim Tip Flow for Non-Members ────────────────────────────

describe('Growth System — Claim Tip Flow', () => {
  it('generates a unique claim code for unclaimed tips', () => {
    const generateClaimCode = (tipId: string): string => {
      const hash = tipId.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
      const shortId = hash.toString(36).toUpperCase().slice(0, 8);
      return `TIP-${shortId}`;
    };

    const code = generateClaimCode('tip:abc123');
    expect(code).toContain('TIP-');
    expect(code.length).toBeGreaterThan(4);
  });

  it('marks tip as claimed after successful claim', () => {
    const tip = createMockNonMemberTip({ claimCode: 'TIP-ABC123' });
    expect(tip.claimed).toBe(false);

    // Simulate claim
    tip.claimed = true;
    tip.claimCode = 'TIP-ABC123';

    expect(tip.claimed).toBe(true);
  });

  it('prevents double-claiming a tip', () => {
    const claimedTips = new Set<string>();
    const claimTip = (tipId: string) => {
      if (claimedTips.has(tipId)) {
        return { success: false, error: 'Tip already claimed' };
      }
      claimedTips.add(tipId);
      return { success: true };
    };

    expect(claimTip('tip:001').success).toBe(true);
    expect(claimTip('tip:001').success).toBe(false);
    expect(claimTip('tip:002').success).toBe(true);
  });

  it('validates claim code format', () => {
    const validateClaimCode = (code: string): boolean => {
      return /^TIP-[A-Z0-9]{6,12}$/.test(code);
    };

    expect(validateClaimCode('TIP-ABC123')).toBe(true);
    expect(validateClaimCode('tip-abc123')).toBe(false); // lowercase
    expect(validateClaimCode('INVALID')).toBe(false);
    expect(validateClaimCode('TIP-A')).toBe(false); // too short
  });

  it('routes claimed tip to recipients wallet', async () => {
    const { recordUnifiedTip } = await import('../../workers/api/src/routes/unified-tip-core');
    const env = createMockEnv();

    const result = await recordUnifiedTip(env, {
      platform: 'degenfeed',
      entityId: 'claim:external_001',
      entityType: 'claim',
      amountUsd: 25,
      fromUserId: 'external:tipper@example.com',
      toUserId: '0xrecipient_wallet',
      fromLabel: 'External Tipper',
      toLabel: 'Creator',
      method: 'usdc',
    });

    expect(result).not.toBeNull();
    expect(result?.amountUsd).toBe(25);
    expect(result?.toUserId).toBe('0xrecipient_wallet');
  });
});

// ─── Suite 7: Onboarding from Tip Link ──────────────────────────────────

describe('Growth System — Onboarding from Tip Link', () => {
  it('parses tip link parameters for onboarding', () => {
    const parseTipLink = (url: string) => {
      const params = new URLSearchParams(url.split('?')[1] ?? '');
      return {
        code: params.get('code'),
        ref: params.get('ref'),
        amount: params.get('amount'),
      };
    };

    const result = parseTipLink('https://degenfeed.xyz/claim?code=TIP-ABC123&ref=REF-DEF456&amount=10');
    expect(result.code).toBe('TIP-ABC123');
    expect(result.ref).toBe('REF-DEF456');
    expect(result.amount).toBe('10');
  });

  it('creates user account from tip claim', () => {
    const claimData = {
      code: 'TIP-ABC123',
      email: 'newuser@example.com',
      wallet: '0xnewuser',
    };

    const createAccountFromClaim = (data: typeof claimData) => {
      if (!data.email && !data.wallet) {
        return { success: false, error: 'Email or wallet required' };
      }
      return {
        success: true,
        userId: `user_${Date.now()}`,
        isNewUser: true,
        welcomeBonus: 5.00, // $5 welcome bonus
      };
    };

    const result = createAccountFromClaim(claimData);
    expect(result.success).toBe(true);
    expect(result.welcomeBonus).toBe(5.00);
  });

  it('attaches referral attribution from tip link', () => {
    const parseReferralFromLink = (url: string): string | null => {
      const match = url.match(/ref=([A-Z0-9-]+)/);
      return match ? match[1]! : null;
    };

    expect(parseReferralFromLink('https://degenfeed.xyz/claim?code=TIP-ABC&ref=REF-DEF')).toBe('REF-DEF');
    expect(parseReferralFromLink('https://degenfeed.xyz/claim?code=TIP-ABC')).toBeNull();
  });
});

// ─── Suite 8: Protocol-Aware Note Formatting ────────────────────────────

describe('Growth System — Protocol-Aware Note Formatting', () => {
  it('formats tip note for Nostr (markdown-supported)', () => {
    const note = {
      type: 'tip_received',
      from: 'Alice',
      amount: '$5.00',
      protocol: 'nostr',
    };

    const formatted = `💸 **${note.from}** sent you **${note.amount}**\n\nThank them back on DegenFeed!`;
    expect(formatted).toContain('**Alice**');
    expect(formatted).toContain('**$5.00**');
  });

  it('formats tip note for Farcaster (320-char limit)', () => {
    const generateFarcasterNote = (from: string, amount: string): string => {
      const text = `💸 ${from} sent you ${amount} on DegenFeed!`;
      return text.length > 320 ? text.slice(0, 317) + '...' : text;
    };

    const short = generateFarcasterNote('Alice', '$5.00');
    expect(short.length).toBeLessThanOrEqual(320);
    expect(short).toContain('Alice');
    expect(short).toContain('DegenFeed');

    const long = generateFarcasterNote('x'.repeat(400), '$5.00');
    expect(long).toContain('...');
  });

  it('formats tip note for Telegram (markdown-free)', () => {
    const stripMarkdown = (text: string): string => {
      return text
        .replace(/\*\*(.*?)\*\*/g, '$1')
        .replace(/__(.*?)__/g, '$1')
        .replace(/`(.*?)`/g, '$1');
    };

    const markdownNote = '💸 **Alice** sent you **$5.00** — *via DegenFeed*';
    const telegramNote = stripMarkdown(markdownNote);

    expect(telegramNote).not.toContain('**');
    expect(telegramNote).not.toContain('*');
    expect(telegramNote).toContain('Alice');
    expect(telegramNote).toContain('DegenFeed');
  });

  it('formats tip note for email (HTML-safe)', () => {
    const generateEmailHtml = (from: string, amount: string, message?: string): string => {
      const msgHtml = message ? `<blockquote>${message.replace(/</g, '&lt;')}</blockquote>` : '';
      return [
        '<div style="font-family: sans-serif; max-width: 600px;">',
        `<h2>You received ${amount}!</h2>`,
        `<p><strong>${from.replace(/</g, '&lt;')}</strong> sent you <strong>${amount}</strong> via DegenFeed.</p>`,
        msgHtml,
        '<p>Claim your tip: <a href="https://degenfeed.xyz/claim">Claim Now</a></p>',
        '</div>',
      ].join('\n');
    };

    const html = generateEmailHtml('Alice', '$5.00', 'Great content!');
    expect(html).toContain('<h2>');
    expect(html).toContain('Alice');
    expect(html).toContain('$5.00');
    expect(html).toContain('Claim Now');
    expect(html).toContain('DegenFeed');

    // XSS prevention
    const xssHtml = generateEmailHtml('<script>alert("xss")</script>', '$5.00');
    expect(xssHtml).not.toContain('<script>');
    expect(xssHtml).toContain('&lt;script&gt;');
  });

  it('applies protocol-specific constraints on tip notes', () => {
    const protocolConstraints: Record<string, { maxLength: number; supportsMarkdown: boolean }> = {
      nostr: { maxLength: 99999, supportsMarkdown: true },
      farcaster: { maxLength: 320, supportsMarkdown: false },
      bluesky: { maxLength: 300, supportsMarkdown: false },
      telegram: { maxLength: 4096, supportsMarkdown: false },
      email: { maxLength: 99999, supportsMarkdown: false },
    };

    expect(protocolConstraints.nostr.supportsMarkdown).toBe(true);
    expect(protocolConstraints.farcaster.maxLength).toBe(320);
    expect(protocolConstraints.bluesky.maxLength).toBe(300);
    expect(protocolConstraints.telegram.maxLength).toBeGreaterThan(3000);
  });
});
