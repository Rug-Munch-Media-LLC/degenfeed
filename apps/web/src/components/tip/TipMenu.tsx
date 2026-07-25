'use client';

/**
 * @degenfeed/web — TipMenu
 *
 * TASK 1 + TASK 3: Per-Post Tipping Options + Tipping UI Component
 *
 * Reusable, context-aware tipping menu that adapts based on WHERE
 * content was posted and WHO the user is.
 *
 * Context detection:
 *   - DegenFeed (our network): All options (Lightning, ETH, SOL, USDC, Creator Coins)
 *   - External protocol (Lemmy, Mastodon): Protocol-native shown first, DegenFeed as alternative
 *   - Zora image: "Bid on Zora" + "Tip via DegenFeed" + Lightning
 *
 * Features:
 *   - Shows fee estimates for each option
 *   - Past tips on hover
 *   - "Top Tipper" badge display
 *   - Adapts options based on wallet connection state
 *
 * @see ../hooks/useTip.ts — Tip hook
 * @see ./TipButton.tsx — Existing tip button
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTip } from '../../hooks/useTip';
import { useAnnouncer } from '../ScreenReaderAnnouncer';
import { useSolana } from '../SolanaProvider';
import { useWeb3 } from '../Web3Provider';

// ─── Types ───────────────────────────────────────────────────────────────

export type ContentVenue = 'our_network' | 'external_protocol' | 'cross_platform' | 'comment_reply';

export interface TipMenuOption {
  /** Method identifier */
  method: string;
  /** Display label */
  label: string;
  /** Short description */
  description: string;
  /** Emoji/icon */
  icon: string;
  /** Whether this option is available */
  available: boolean;
  /** Fee estimate string */
  fee: string;
  /** Fee in USD for sorting */
  feeUsd: number;
  /** Whether this is the recommended option */
  recommended: boolean;
  /** Whether this is protocol-native */
  isNative: boolean;
  /** Whether this is a bridge option */
  isBridge: boolean;
  /** Action URL if external */
  actionUrl?: string;
  /** Address for direct send */
  address?: string;
  /** Chain identifier */
  chain?: string;
}

export interface PastTip {
  tipperName: string;
  amountUsd: number;
  method: string;
  at: number;
}

export interface TipMenuProps {
  /** Where the content lives */
  venue: ContentVenue;
  /** The protocol of the content */
  protocol: string;
  /** Author/user identifier */
  authorId: string;
  /** Display name */
  authorDisplayName: string;
  /** Publication/post ID */
  publicationId?: string;
  /** Content URL */
  contentUrl?: string;
  /** Whether the user has a wallet connected */
  hasWallet?: boolean;
  /** Creator's available addresses (from postContext) */
  creatorAddresses?: {
    evm?: string;
    solana?: string;
    lightning?: string;
  };
  /** Past tips on this post (for hover display) */
  pastTips?: PastTip[];
  /** Total past tip amount on this post */
  totalTipsUsd?: number;
  /** Callback when tip is initiated */
  onTipInitiated?: (method: string, amount: string) => void;
  /** Additional CSS classes */
  className?: string;
  /** Show compact variant */
  compact?: boolean;
}

// ─── Protocol Capabilities Map (client-side quick lookup) ─────────────────

const PROTOCOL_OPTIONS: Record<
  string,
  {
    nativeMethod: {
      method: string;
      label: string;
      icon: string;
      fee: string;
      feeUsd: number;
    } | null;
    bridgeMethod: {
      method: string;
      label: string;
      icon: string;
      fee: string;
      feeUsd: number;
    } | null;
    supportsOnChain: boolean;
    supportsLightning: boolean;
  }
> = {
  nostr: {
    nativeMethod: {
      method: 'lightning_zap',
      label: '⚡ Zap (NIP-57)',
      icon: '⚡',
      fee: '< $0.001',
      feeUsd: 0.001,
    },
    bridgeMethod: null,
    supportsOnChain: true,
    supportsLightning: true,
  },
  farcaster: {
    nativeMethod: {
      method: 'farcaster_frame',
      label: '◈ Tip Frame',
      icon: '◈',
      fee: '< $0.01',
      feeUsd: 0.01,
    },
    bridgeMethod: null,
    supportsOnChain: true,
    supportsLightning: true,
  },
  lens: {
    nativeMethod: {
      method: 'lens_collect',
      label: '◎ Lens Collect',
      icon: '◎',
      fee: '~$0.01',
      feeUsd: 0.01,
    },
    bridgeMethod: null,
    supportsOnChain: true,
    supportsLightning: true,
  },
  zora: {
    nativeMethod: {
      method: 'zora_mint',
      label: '🎨 Bid on Zora',
      icon: '🎨',
      fee: '~$0.01-0.05',
      feeUsd: 0.03,
    },
    bridgeMethod: {
      method: 'degenfeed_tip',
      label: '🔄 Tip via DegenFeed',
      icon: '🔄',
      fee: '< $0.01',
      feeUsd: 0.01,
    },
    supportsOnChain: true,
    supportsLightning: true,
  },
  bluesky: {
    nativeMethod: {
      method: 'bluesky_custom',
      label: '☁️ Bluesky Tip',
      icon: '☁️',
      fee: '~$0.001',
      feeUsd: 0.001,
    },
    bridgeMethod: {
      method: 'qr_code',
      label: '📱 QR Code (DegenFeed)',
      icon: '📱',
      fee: 'Free',
      feeUsd: 0,
    },
    supportsOnChain: false,
    supportsLightning: true,
  },
  mastodon: {
    nativeMethod: null,
    bridgeMethod: {
      method: 'bridge',
      label: '🌉 DegenFeed Bridge',
      icon: '🌉',
      fee: '< $0.01',
      feeUsd: 0.01,
    },
    supportsOnChain: false,
    supportsLightning: true,
  },
  lemmy: {
    nativeMethod: null,
    bridgeMethod: {
      method: 'bridge',
      label: '🌉 DegenFeed Bridge',
      icon: '🌉',
      fee: '< $0.01',
      feeUsd: 0.01,
    },
    supportsOnChain: false,
    supportsLightning: true,
  },
  github: {
    nativeMethod: {
      method: 'github_sponsors',
      label: '🐙 GitHub Sponsors',
      icon: '🐙',
      fee: 'Free',
      feeUsd: 0,
    },
    bridgeMethod: {
      method: 'link',
      label: '🔗 Tip Link (DegenFeed)',
      icon: '🔗',
      fee: 'Free',
      feeUsd: 0,
    },
    supportsOnChain: false,
    supportsLightning: true,
  },
};

// ─── Chain fee estimates for display ─────────────────────────────────────

const _CHAIN_FEES: Record<string, { fee: string; feeUsd: number }> = {
  lightning: { fee: '< $0.001', feeUsd: 0.001 },
  ethereum: { fee: '~$0.50-5.00', feeUsd: 2.0 },
  base: { fee: '< $0.01', feeUsd: 0.01 },
  solana: { fee: '< $0.01', feeUsd: 0.002 },
  polygon: { fee: '~$0.01-0.05', feeUsd: 0.03 },
};

// ─── Option set for our network (full menu) ──────────────────────────────

const OUR_NETWORK_OPTIONS: TipMenuOption[] = [
  {
    method: 'lightning',
    label: '⚡ Lightning (instant, <$0.001)',
    description: 'Bitcoin Lightning — instant, near-zero fees, works globally',
    icon: '⚡',
    available: true,
    fee: '< $0.001',
    feeUsd: 0.001,
    recommended: true,
    isNative: false,
    isBridge: false,
    chain: 'lightning',
  },
  {
    method: 'onchain_tip',
    label: '⛓️ Direct on-chain (0% fee)',
    description: 'ETH via DegenFeed contract on Base — 0% fee, no intermediary',
    icon: '⛓️',
    available: true,
    fee: '0% (L2 gas only)',
    feeUsd: 0.01,
    recommended: false,
    isNative: false,
    isBridge: false,
    chain: 'base',
  },
  {
    method: 'base',
    label: '🔵 Base (USDC/ETH)',
    description: 'Send USDC or ETH on Base L2 — sub-cent fees, fast settlement',
    icon: '🔵',
    available: true,
    fee: '< $0.01',
    feeUsd: 0.01,
    recommended: false,
    isNative: false,
    isBridge: false,
    chain: 'base',
  },
  {
    method: 'solana',
    label: '◎ Solana',
    description: 'Send SOL, USDC, or any SPL token — sub-cent fees, fast',
    icon: '◎',
    available: true,
    fee: '< $0.01',
    feeUsd: 0.002,
    recommended: false,
    isNative: false,
    isBridge: false,
    chain: 'solana',
  },
  {
    method: 'creator_coin',
    label: '🪙 Creator Coin',
    description: 'Buy and tip creator-branded coins — support while investing',
    icon: '🪙',
    available: false,
    fee: 'Low (varies)',
    feeUsd: 0.1,
    recommended: false,
    isNative: false,
    isBridge: false,
  },
  {
    method: 'usdc',
    label: '● USDC (any chain)',
    description: 'Send USDC stablecoin on any supported chain — no volatility',
    icon: '●',
    available: true,
    fee: 'Varies by chain',
    feeUsd: 0.05,
    recommended: false,
    isNative: false,
    isBridge: false,
  },
];

// ─── Component ───────────────────────────────────────────────────────────

export function TipMenu({
  venue,
  protocol,
  authorId,
  authorDisplayName,
  publicationId,
  contentUrl,
  hasWallet = false,
  creatorAddresses = {},
  pastTips = [],
  totalTipsUsd = 0,
  onTipInitiated,
  className = '',
  compact = false,
}: TipMenuProps) {
  const { state, resolveMethods, createTip } = useTip();
  const { account: evmAccount, connect: connectEvm } = useWeb3();
  const { account: solAccount, connect: connectSol } = useSolana();
  const { announce } = useAnnouncer();

  const [isOpen, setIsOpen] = useState(false);
  const [showPastTips, setShowPastTips] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null);
  const [amount, setAmount] = useState('10');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const menuRef = useRef<HTMLDivElement>(null);
  const sentTimer = useRef<ReturnType<typeof setTimeout>>();

  // ── Compute available options based on context ────────────────────────
  const options = useMemo<TipMenuOption[]>(() => {
    if (venue === 'our_network') {
      return OUR_NETWORK_OPTIONS;
    }

    // External protocol or cross-platform
    const protocolCaps = PROTOCOL_OPTIONS[protocol];
    const opts: TipMenuOption[] = [];

    // Native method first (for external protocols)
    if (protocolCaps?.nativeMethod) {
      const nm = protocolCaps.nativeMethod;
      opts.push({
        method: nm.method,
        label: nm.label,
        description: `Native ${protocol} tipping`,
        icon: nm.icon,
        available: true,
        fee: nm.fee,
        feeUsd: nm.feeUsd,
        recommended: true,
        isNative: true,
        isBridge: false,
      });
    }

    // DegenFeed bridge/alternative
    if (protocolCaps?.bridgeMethod) {
      const bm = protocolCaps.bridgeMethod;
      opts.push({
        method: bm.method,
        label: bm.label,
        description: 'Send via DegenFeed unified bridge',
        icon: bm.icon,
        available: hasWallet,
        fee: bm.fee,
        feeUsd: bm.feeUsd,
        recommended: false,
        isNative: false,
        isBridge: true,
      });
    }

    // Lightning (always offered when we have addresses)
    if (protocolCaps?.supportsLightning ?? true) {
      opts.push({
        method: 'lightning',
        label: '⚡ Lightning (via DegenFeed)',
        description: 'Bitcoin Lightning — instant, near-zero fees',
        icon: '⚡',
        available: hasWallet || !!creatorAddresses.lightning,
        fee: '< $0.001',
        feeUsd: 0.001,
        recommended: !protocolCaps?.nativeMethod,
        isNative: false,
        isBridge: false,
        chain: 'lightning',
      });
    }

    // Full on-chain menu (only if user has wallet)
    if (hasWallet && (protocolCaps?.supportsOnChain ?? true)) {
      if (creatorAddresses.evm) {
        opts.push({
          method: 'onchain_tip',
          label: '⛓️ Direct on-chain (ETH/USDC)',
          description: 'Send directly to creator wallet on Base',
          icon: '⛓️',
          available: true,
          fee: '< $0.01',
          feeUsd: 0.01,
          recommended: false,
          isNative: false,
          isBridge: false,
          chain: 'base',
          address: creatorAddresses.evm,
        });
      }
      if (creatorAddresses.solana) {
        opts.push({
          method: 'solana',
          label: '◎ Solana (SOL/USDC)',
          description: 'Send directly to creator Solana wallet',
          icon: '◎',
          available: true,
          fee: '< $0.01',
          feeUsd: 0.002,
          recommended: false,
          isNative: false,
          isBridge: false,
          chain: 'solana',
          address: creatorAddresses.solana,
        });
      }
    }

    // If no wallet — show "Tip via DegenFeed" as alternative with a note
    if (!hasWallet && !protocolCaps?.nativeMethod && !protocolCaps?.bridgeMethod) {
      opts.push({
        method: 'degenfeed_tip',
        label: '🔄 Tip via DegenFeed',
        description: 'Connect wallet to unlock full tipping options',
        icon: '🔄',
        available: false,
        fee: 'Connect wallet',
        feeUsd: 0,
        recommended: false,
        isNative: false,
        isBridge: true,
      });
    }

    // Sort: recommended first, then by fee
    opts.sort((a, b) => {
      if (a.recommended !== b.recommended) return a.recommended ? -1 : 1;
      return a.feeUsd - b.feeUsd;
    });

    return opts;
  }, [venue, protocol, hasWallet, creatorAddresses]);

  // ── Detect Zora-specific content ──────────────────────────────────────
  const isZoraPost = protocol === 'zora';
  const isExternalProtocol = venue === 'external_protocol' || venue === 'cross_platform';

  // ── Amount presets (USD) ──────────────────────────────────────────────
  const amountPresets = useMemo(() => {
    const isSats = selectedMethod === 'lightning' || selectedMethod === 'lightning_zap';
    if (isSats) {
      return [
        { label: '1K', value: '1000', usd: 0.6 },
        { label: '5K', value: '5000', usd: 3.0 },
        { label: '10K', value: '10000', usd: 6.0 },
        { label: '50K', value: '50000', usd: 30.0 },
      ];
    }
    return [
      { label: '$1', value: '1', usd: 1 },
      { label: '$5', value: '5', usd: 5 },
      { label: '$10', value: '10', usd: 10 },
      { label: '$25', value: '25', usd: 25 },
    ];
  }, [selectedMethod]);

  const selectedOption = options.find((o) => o.method === selectedMethod);
  const isLightning = selectedMethod === 'lightning' || selectedMethod === 'lightning_zap';

  // ── Reset on close ────────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) {
      setSelectedMethod(null);
      setAmount('10');
      setSending(false);
      setError(null);
    }
  }, [isOpen]);

  // ── Auto-select recommended method ────────────────────────────────────
  useEffect(() => {
    if (isOpen && options.length > 0 && !selectedMethod) {
      const recommended =
        options.find((o) => o.recommended && o.available) ?? options.find((o) => o.available);
      if (recommended) setSelectedMethod(recommended.method);
    }
  }, [isOpen, options, selectedMethod]);

  // ── Cleanup sent timer ───────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (sentTimer.current) clearTimeout(sentTimer.current);
    };
  }, []);

  // ── Handle tip send ──────────────────────────────────────────────────
  const handleSend = useCallback(async () => {
    if (!selectedMethod || !amount || sending) return;
    setSending(true);
    setError(null);

    try {
      const method = selectedOption?.isNative ? selectedOption.method : selectedMethod;

      // Create the tip intent
      const intent = await createTip(authorId, protocol, method, amount, publicationId);
      if (!intent) throw new Error('Failed to create tip');

      setSent(true);
      announce(`Tip of ${amount} sent to ${authorDisplayName}`, 'polite');
      onTipInitiated?.(method, amount);

      // Auto-reset after 3s
      sentTimer.current = setTimeout(() => setSent(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSending(false);
    }
  }, [
    selectedMethod,
    amount,
    sending,
    selectedOption,
    createTip,
    authorId,
    protocol,
    publicationId,
    authorDisplayName,
    announce,
    onTipInitiated,
  ]);

  // ── Handle connect + send for external protocols ──────────────────────
  const handleConnectAndTip = useCallback(async () => {
    if (!evmAccount && !solAccount) {
      // Try connecting EVM first (most common)
      const addr = await connectEvm();
      if (!addr) {
        // Try Solana
        await connectSol();
      }
    }
    // After connection attempt, available options may change
    setIsOpen(true);
  }, [evmAccount, solAccount, connectEvm, connectSol]);

  // ── Format past tips count ───────────────────────────────────────────
  const pastTipsLabel = useMemo(() => {
    if (totalTipsUsd <= 0 && pastTips.length === 0) return null;
    if (pastTips.length === 0 && totalTipsUsd > 0) return `$${totalTipsUsd.toFixed(2)} total tips`;
    const topTipper = pastTips.reduce(
      (best, t) => (t.amountUsd > (best?.amountUsd ?? 0) ? t : best),
      pastTips[0],
    );
    return `${pastTips.length} tip${pastTips.length !== 1 ? 's' : ''} · Top: ${topTipper?.tipperName ?? '—'} ($${topTipper?.amountUsd.toFixed(2) ?? '0'})`;
  }, [pastTips, totalTipsUsd]);

  // ── Zora-specific rendering ──────────────────────────────────────────
  if (isZoraPost && isOpen) {
    return (
      <div ref={menuRef} className={`relative ${className}`}>
        <MenuTrigger
          isOpen={isOpen}
          hasPastTips={pastTips.length > 0}
          pastTipsLabel={pastTipsLabel}
          totalTipsUsd={totalTipsUsd}
          compact={compact}
          authorDisplayName={authorDisplayName}
          onToggle={() => setIsOpen(!isOpen)}
          onShowPastTips={() => setShowPastTips(!showPastTips)}
          showPastTips={showPastTips}
        />

        {isOpen && (
          <MenuDropdown
            options={[
              {
                method: 'zora_mint',
                label: '🎨 Bid on Zora',
                description: 'Place a bid on this Zora NFT',
                icon: '🎨',
                available: true,
                fee: '~$0.01-0.05',
                feeUsd: 0.03,
                recommended: true,
                isNative: true,
                isBridge: false,
                actionUrl: contentUrl,
              },
              {
                method: 'degenfeed_tip',
                label: '🔄 Tip creator via DegenFeed',
                description: hasWallet ? 'Send directly to creator' : 'Connect wallet to tip',
                icon: '🔄',
                available: hasWallet,
                fee: '< $0.01',
                feeUsd: 0.01,
                recommended: false,
                isNative: false,
                isBridge: true,
              },
              {
                method: 'lightning',
                label: '⚡ Tip via Lightning',
                description: 'Bitcoin Lightning — instant, near-zero fees',
                icon: '⚡',
                available: true,
                fee: '< $0.001',
                feeUsd: 0.001,
                recommended: false,
                isNative: false,
                isBridge: false,
                chain: 'lightning',
              },
            ]}
            selectedMethod={selectedMethod}
            onSelect={setSelectedMethod}
            showAmount={selectedMethod !== 'zora_mint'}
            amount={amount}
            onAmountChange={setAmount}
            amountPresets={amountPresets}
            isLightning={isLightning}
            selectedOption={selectedOption}
            onSend={handleSend}
            onConnectAndTip={handleConnectAndTip}
            sending={sending}
            sent={sent}
            error={error}
            evmAccount={evmAccount}
            solAccount={solAccount}
          />
        )}

        {showPastTips && pastTips.length > 0 && (
          <PastTipsPopover
            pastTips={pastTips}
            totalTipsUsd={totalTipsUsd}
            onClose={() => setShowPastTips(false)}
          />
        )}
      </div>
    );
  }

  // ── Standard rendering ──────────────────────────────────────────────
  return (
    <div ref={menuRef} className={`relative ${className}`}>
      <MenuTrigger
        isOpen={isOpen}
        hasPastTips={pastTips.length > 0}
        pastTipsLabel={pastTipsLabel}
        totalTipsUsd={totalTipsUsd}
        compact={compact}
        authorDisplayName={authorDisplayName}
        onToggle={() => setIsOpen(!isOpen)}
        onShowPastTips={() => setShowPastTips(!showPastTips)}
        showPastTips={showPastTips}
      />

      {isOpen && (
        <MenuDropdown
          options={options}
          selectedMethod={selectedMethod}
          onSelect={setSelectedMethod}
          showAmount={true}
          amount={amount}
          onAmountChange={setAmount}
          amountPresets={amountPresets}
          isLightning={isLightning}
          selectedOption={selectedOption}
          onSend={handleSend}
          onConnectAndTip={handleConnectAndTip}
          sending={sending}
          sent={sent}
          error={error}
          evmAccount={evmAccount}
          solAccount={solAccount}
          isExternalProtocol={isExternalProtocol}
          protocol={protocol}
        />
      )}

      {showPastTips && pastTips.length > 0 && (
        <PastTipsPopover
          pastTips={pastTips}
          totalTipsUsd={totalTipsUsd}
          onClose={() => setShowPastTips(false)}
        />
      )}
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────

interface MenuTriggerProps {
  isOpen: boolean;
  hasPastTips: boolean;
  pastTipsLabel: string | null;
  totalTipsUsd: number;
  compact: boolean;
  authorDisplayName: string;
  onToggle: () => void;
  onShowPastTips: () => void;
  showPastTips: boolean;
}

function MenuTrigger({
  isOpen,
  hasPastTips,
  pastTipsLabel,
  totalTipsUsd,
  compact,
  authorDisplayName,
  onToggle,
  onShowPastTips,
  showPastTips,
}: MenuTriggerProps) {
  return (
    <div className="inline-flex items-center gap-1">
      <button
        type="button"
        onClick={onToggle}
        className={`inline-flex items-center gap-1.5 rounded-lg font-medium transition-all ${
          compact ? 'px-2 py-1 text-[10px]' : 'px-3 py-1.5 text-xs'
        } ${
          isOpen
            ? 'bg-degen-500/15 text-degen-400'
            : 'text-[var(--color-muted)] hover:bg-degen-500/10 hover:text-degen-400'
        }`}
        aria-label={`Tip ${authorDisplayName}`}
        aria-expanded={isOpen}
      >
        <svg
          width={compact ? '12' : '14'}
          height={compact ? '12' : '14'}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5" />
          <path d="M8.5 8.5v.01" />
          <path d="M16 15a4 4 0 0 0-8 0" />
        </svg>
        <span>{compact ? '' : 'Tip'}</span>
      </button>

      {/* Past tips indicator */}
      {hasPastTips && (
        <button
          type="button"
          onClick={onShowPastTips}
          onMouseEnter={() => !showPastTips && onShowPastTips()}
          onMouseLeave={() => showPastTips && onShowPastTips()}
          className="rounded-md px-1.5 py-0.5 text-[9px] text-[var(--color-muted)] hover:text-degen-400 transition-colors"
          title={pastTipsLabel ?? undefined}
        >
          ${totalTipsUsd.toFixed(0)}
        </button>
      )}
    </div>
  );
}

interface MenuDropdownProps {
  options: TipMenuOption[];
  selectedMethod: string | null;
  onSelect: (method: string) => void;
  showAmount: boolean;
  amount: string;
  onAmountChange: (amount: string) => void;
  amountPresets: Array<{ label: string; value: string; usd: number }>;
  isLightning: boolean;
  selectedOption: TipMenuOption | undefined;
  onSend: () => void;
  onConnectAndTip: () => void;
  sending: boolean;
  sent: boolean;
  error: string | null;
  evmAccount: string | null;
  solAccount: string | null;
  isExternalProtocol?: boolean;
  protocol?: string;
}

function MenuDropdown({
  options,
  selectedMethod,
  onSelect,
  showAmount,
  amount,
  onAmountChange,
  amountPresets,
  isLightning,
  selectedOption,
  onSend,
  onConnectAndTip,
  sending,
  sent,
  error,
  evmAccount,
  solAccount,
  isExternalProtocol,
  protocol,
}: MenuDropdownProps) {
  const hasWallet = !!evmAccount || !!solAccount;

  if (sent) {
    return (
      <div className="absolute right-0 top-full z-50 mt-1 w-64 rounded-xl border border-green-900/50 bg-[var(--color-card)] p-4 shadow-2xl backdrop-blur-xl">
        <div className="text-center">
          <div className="mb-2 inline-flex h-10 w-10 items-center justify-center rounded-full bg-green-900/30">
            <span className="text-lg">✅</span>
          </div>
          <p className="text-sm font-semibold text-[var(--color-fg)]">Tip sent!</p>
          {selectedOption && (
            <p className="mt-0.5 text-[10px] text-[var(--color-muted)]">
              {amount} {isLightning ? 'sats' : 'USD'} via {selectedOption.label}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="absolute right-0 top-full z-50 mt-1 w-72 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] shadow-2xl backdrop-blur-xl">
      <div className="max-h-80 overflow-y-auto p-3">
        {/* Protocol context header */}
        {isExternalProtocol && protocol && (
          <div className="mb-2 rounded-lg bg-amber-900/10 border border-amber-900/30 px-2.5 py-1.5">
            <p className="text-[10px] text-amber-400">
              🌐 {protocol} content — native tip option shown first
            </p>
          </div>
        )}

        {/* Wallet connect prompt */}
        {!hasWallet && (
          <div className="mb-2 rounded-lg bg-blue-900/10 border border-blue-900/30 px-2.5 py-1.5">
            <p className="text-[10px] text-blue-400">Connect wallet for full options</p>
            <button
              type="button"
              onClick={onConnectAndTip}
              className="mt-1 w-full rounded-lg bg-blue-500/20 px-2 py-1 text-[10px] font-medium text-blue-400 hover:bg-blue-500/30 transition-colors"
            >
              Connect Wallet
            </button>
          </div>
        )}

        {/* Method selector */}
        <div className="mb-3 space-y-1">
          {options.map((opt) => (
            <button
              key={opt.method}
              type="button"
              onClick={() => {
                if (opt.available) onSelect(opt.method);
                else if (opt.method === 'degenfeed_tip' || opt.method === 'qr_code') {
                  onConnectAndTip();
                }
              }}
              disabled={!opt.available && !opt.isBridge}
              className={`w-full flex items-center gap-2.5 rounded-lg border px-2.5 py-2 text-left transition-all ${
                selectedMethod === opt.method
                  ? 'border-degen-500 bg-degen-500/10'
                  : opt.available
                    ? 'border-transparent hover:border-[var(--color-border)] hover:bg-[var(--color-card)]'
                    : 'border-transparent opacity-40 cursor-not-allowed'
              }`}
            >
              <span className="text-base">{opt.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-medium text-[var(--color-fg)] truncate">
                    {opt.label}
                  </span>
                  {opt.recommended && (
                    <span className="shrink-0 rounded-full bg-degen-500/20 px-1.5 py-0.5 text-[8px] font-medium text-degen-400">
                      Best
                    </span>
                  )}
                  {opt.isNative && (
                    <span className="shrink-0 rounded-full bg-purple-900/20 px-1.5 py-0.5 text-[8px] font-medium text-purple-400">
                      Native
                    </span>
                  )}
                  {opt.isBridge && (
                    <span className="shrink-0 rounded-full bg-cyan-900/20 px-1.5 py-0.5 text-[8px] font-medium text-cyan-400">
                      Bridge
                    </span>
                  )}
                </div>
                <span className="text-[9px] text-[var(--color-muted)] line-clamp-1">
                  {opt.description}
                </span>
              </div>
              <span className="shrink-0 text-[9px] text-[var(--color-muted)]">{opt.fee}</span>
            </button>
          ))}
        </div>

        {/* Amount selector */}
        {showAmount && selectedMethod && (
          <div className="mb-3">
            <label className="mb-1.5 block text-[9px] font-medium uppercase tracking-wider text-[var(--color-muted)]">
              Amount {isLightning ? '(sats)' : '(USD)'}
            </label>
            <div className="flex gap-1 mb-2">
              {amountPresets.map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() => onAmountChange(preset.value)}
                  className={`flex-1 rounded-lg border px-2 py-1.5 text-center text-[10px] font-medium transition-all ${
                    amount === preset.value
                      ? 'border-degen-500 bg-degen-500/10 text-degen-400'
                      : 'border-[var(--color-border)] text-[var(--color-muted)] hover:border-degen-500/30'
                  }`}
                >
                  <div>{preset.label}</div>
                  <div className="text-[8px] opacity-60">
                    {isLightning ? `~$${preset.usd.toFixed(2)}` : `${preset.value} USD`}
                  </div>
                </button>
              ))}
            </div>
            <input
              type="text"
              value={amount}
              onChange={(e) => onAmountChange(e.target.value)}
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-2.5 py-1.5 text-xs font-mono text-[var(--color-fg)] outline-none focus:border-degen-500 transition-colors"
              placeholder={isLightning ? '1000' : '10'}
              aria-label="Custom tip amount"
            />
          </div>
        )}

        {/* Fee estimate hint */}
        {selectedOption?.fee && (
          <p className="mb-3 text-[9px] text-[var(--color-muted)] text-center">
            Fee: {selectedOption.fee}
            {selectedOption.chain && ` • ${selectedOption.chain}`}
          </p>
        )}

        {/* Error */}
        {error && (
          <div className="mb-2 rounded-lg bg-red-900/20 border border-red-900/40 px-2.5 py-1.5">
            <p className="text-[10px] text-red-400">{error}</p>
          </div>
        )}

        {/* Send / Action button */}
        {selectedMethod && (
          <button
            type="button"
            onClick={onSend}
            disabled={sending || !amount || Number.parseFloat(amount) <= 0}
            className="btn-primary w-full text-xs py-2 disabled:opacity-50"
          >
            {sending ? (
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Sending...
              </span>
            ) : (
              `Send ${amount} ${isLightning ? 'sats' : `$${amount}`}`
            )}
          </button>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-[var(--color-border)] px-3 py-2">
        <p className="text-center text-[8px] text-[var(--color-muted)]">
          Powered by DegenFeed • No platform fees
        </p>
      </div>
    </div>
  );
}

// ─── Past Tips Popover ──────────────────────────────────────────────────

interface PastTipsPopoverProps {
  pastTips: PastTip[];
  totalTipsUsd: number;
  onClose: () => void;
}

function PastTipsPopover({ pastTips, totalTipsUsd, onClose }: PastTipsPopoverProps) {
  return (
    <div
      className="absolute right-0 top-full z-50 mt-1 w-64 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-3 shadow-2xl backdrop-blur-xl"
      onMouseLeave={onClose}
    >
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-xs font-semibold text-[var(--color-fg)]">💰 Past Tips</h3>
        <span className="text-xs font-bold text-degen-400">${totalTipsUsd.toFixed(2)}</span>
      </div>

      <div className="max-h-40 space-y-1 overflow-y-auto">
        {pastTips.length === 0 ? (
          <p className="text-[10px] text-[var(--color-muted)]">No tips yet</p>
        ) : (
          pastTips.slice(0, 10).map((tip, i) => (
            <div
              key={`${tip.tipperName}-${tip.at}-${i}`}
              className="flex items-center justify-between rounded-md px-2 py-1 hover:bg-[var(--color-card)] transition-colors"
            >
              <div className="flex items-center gap-1.5 min-w-0">
                {/* Top tipper badge */}
                {i === 0 && (
                  <span className="shrink-0" title="Top Tipper">
                    👑
                  </span>
                )}
                <span className="truncate text-[10px] text-[var(--color-fg)]">
                  {tip.tipperName}
                </span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <span className="text-[10px] font-medium text-[var(--color-fg)]">
                  ${tip.amountUsd.toFixed(2)}
                </span>
                <span className="text-[8px] text-[var(--color-muted)]">{tip.method}</span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Top Tipper highlight */}
      {pastTips.length > 0 && (
        <div className="mt-2 rounded-lg bg-amber-900/10 border border-amber-900/30 px-2 py-1.5">
          <p className="text-[9px] text-amber-400">
            👑 <strong>Top Tipper:</strong> {pastTips[0].tipperName} ($
            {pastTips[0].amountUsd.toFixed(2)})
          </p>
        </div>
      )}

      <button
        type="button"
        onClick={onClose}
        className="mt-2 w-full rounded-lg bg-[var(--color-card)] px-2 py-1 text-[9px] text-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors"
      >
        Close
      </button>
    </div>
  );
}
