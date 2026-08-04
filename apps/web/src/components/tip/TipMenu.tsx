'use client';

/**
 * @degenfeed/web — TipMenu
 *
 * Reusable, context-aware tipping menu that adapts based on WHERE
 * content was posted and WHO the user is.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTip } from '../../hooks/useTip';
import { useAnnouncer } from '../ScreenReaderAnnouncer';
import { useSolana } from '../SolanaProvider';
import { useWeb3 } from '../Web3Provider';
import { MenuDropdown } from './components/MenuDropdown';
import { MenuTrigger } from './components/MenuTrigger';
import { PastTipsPopover } from './components/PastTipsPopover';
import { OUR_NETWORK_OPTIONS, PROTOCOL_OPTIONS } from './constants';
import type { TipMenuOption, TipMenuProps } from './types';

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
  const { createTip } = useTip();
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
  const sentTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const options = useMemo<TipMenuOption[]>(() => {
    if (venue === 'our_network') return OUR_NETWORK_OPTIONS;

    const protocolCaps = PROTOCOL_OPTIONS[protocol];
    const opts: TipMenuOption[] = [];

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
    opts.sort((a, b) => {
      if (a.recommended !== b.recommended) return a.recommended ? -1 : 1;
      return a.feeUsd - b.feeUsd;
    });
    return opts;
  }, [venue, protocol, hasWallet, creatorAddresses]);

  const isZoraPost = protocol === 'zora';
  const isExternalProtocol = venue === 'external_protocol' || venue === 'cross_platform';
  const selectedOption = options.find((o) => o.method === selectedMethod);
  const isLightning = selectedMethod === 'lightning' || selectedMethod === 'lightning_zap';

  useEffect(() => {
    if (!isOpen) {
      setSelectedMethod(null);
      setAmount('10');
      setSending(false);
      setError(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && options.length > 0 && !selectedMethod) {
      const recommended =
        options.find((o) => o.recommended && o.available) ?? options.find((o) => o.available);
      if (recommended) setSelectedMethod(recommended.method);
    }
  }, [isOpen, options, selectedMethod]);

  useEffect(
    () => () => {
      if (sentTimer.current) clearTimeout(sentTimer.current);
    },
    [],
  );

  const handleSend = useCallback(async () => {
    if (!selectedMethod || !amount || sending) return;
    setSending(true);
    setError(null);
    try {
      const method = selectedOption?.isNative ? selectedOption.method : selectedMethod;
      const intent = await createTip(authorId, protocol, method, amount, publicationId);
      if (!intent) throw new Error('Failed to create tip');
      setSent(true);
      announce(`Tip of ${amount} sent to ${authorDisplayName}`, 'polite');
      onTipInitiated?.(method, amount);
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

  const handleConnectAndTip = useCallback(async () => {
    if (!evmAccount && !solAccount) {
      const addr = await connectEvm();
      if (!addr) await connectSol();
    }
    setIsOpen(true);
  }, [evmAccount, solAccount, connectEvm, connectSol]);

  const pastTipsLabel = useMemo(() => {
    if (totalTipsUsd <= 0 && pastTips.length === 0) return null;
    if (pastTips.length === 0 && totalTipsUsd > 0) return `$${totalTipsUsd.toFixed(2)} total tips`;
    const topTipper = pastTips.reduce(
      (best, t) => (t.amountUsd > (best?.amountUsd ?? 0) ? t : best),
      pastTips[0],
    );
    return `${pastTips.length} tip${pastTips.length !== 1 ? 's' : ''} · Top: ${topTipper?.tipperName ?? '—'} ($${topTipper?.amountUsd.toFixed(2) ?? '0'})`;
  }, [pastTips, totalTipsUsd]);

  // Zora-specific rendering
  if (isZoraPost && isOpen) {
    return (
      <div ref={menuRef} className={`relative ${className}`}>
        <MenuTrigger
          {...{
            isOpen,
            hasPastTips: pastTips.length > 0,
            pastTipsLabel,
            totalTipsUsd,
            compact,
            authorDisplayName,
            onToggle: () => setIsOpen(!isOpen),
            onShowPastTips: () => setShowPastTips(!showPastTips),
            showPastTips,
          }}
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
            {...{
              selectedMethod,
              onSelect: setSelectedMethod,
              showAmount: selectedMethod !== 'zora_mint',
              amount,
              onAmountChange: setAmount,
              isLightning,
              selectedOption,
              onSend: handleSend,
              onConnectAndTip: handleConnectAndTip,
              sending,
              sent,
              error,
              evmAccount,
              solAccount,
            }}
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

  return (
    <div ref={menuRef} className={`relative ${className}`}>
      <MenuTrigger
        {...{
          isOpen,
          hasPastTips: pastTips.length > 0,
          pastTipsLabel,
          totalTipsUsd,
          compact,
          authorDisplayName,
          onToggle: () => setIsOpen(!isOpen),
          onShowPastTips: () => setShowPastTips(!showPastTips),
          showPastTips,
        }}
      />
      {isOpen && (
        <MenuDropdown
          options={options}
          {...{
            selectedMethod,
            onSelect: setSelectedMethod,
            showAmount: true,
            amount,
            onAmountChange: setAmount,
            isLightning,
            selectedOption,
            onSend: handleSend,
            onConnectAndTip: handleConnectAndTip,
            sending,
            sent,
            error,
            evmAccount,
            solAccount,
            isExternalProtocol,
            protocol,
          }}
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
