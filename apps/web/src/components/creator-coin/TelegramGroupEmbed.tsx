'use client';

/**
 * Telegram Group Embed — Creator Coin Community Chat
 *
 * Features:
 * - Telegram group preview with member count and last message
 * - "Open in Telegram" button
 * - "Chat here" in-app embed (when running as Telegram Mini App)
 * - Link/unlink Telegram account flow
 * - Bot command UI (/buy, /sell, /price)
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../../components/AuthProvider';
import { useToast } from '../../components/Toast';

// ─── Types ─────────────────────────────────────────────────────────────

interface TelegramGroupData {
  groupId: string;
  title: string;
  inviteLink?: string;
  memberCount?: number;
  feedEnabled: boolean;
  tokenGated: boolean;
  minHoldRequirement?: string;
  recentMessages?: Array<{
    text: string;
    fromUser: string;
    fromUserId?: number;
    timestamp: number;
  }>;
}

interface ChatMessage {
  id: string;
  text: string;
  fromUser: string;
  isOwn: boolean;
  timestamp: number;
}

// ─── Component ─────────────────────────────────────────────────────────

interface TelegramGroupEmbedProps {
  symbol: string;
  coinName?: string;
  /** Override group data (for SSR / page data) */
  groupData?: TelegramGroupData | null;
}

export function TelegramGroupEmbed({
  symbol,
  coinName,
  groupData: externalGroup,
}: TelegramGroupEmbedProps) {
  const { showToast } = useToast();
  const { ready: authReady } = useAuth();

  const [loading, setLoading] = useState(true);
  const [telegramLinked, setTelegramLinked] = useState(false);
  const [telegramUsername, setTelegramUsername] = useState<string | undefined>();
  const [groupData, setGroupData] = useState<TelegramGroupData | null>(externalGroup ?? null);
  const [chatOpen, setChatOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [botCommandResult, setBotCommandResult] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);

  // ─── Load linked Telegram account ──────────────────────────────────

  useEffect(() => {
    if (!authReady) return;

    async function load() {
      try {
        const res = await fetch('/api/telegram/linked');
        if (res.ok) {
          const data = await res.json();
          if (data.linked) {
            setTelegramLinked(true);
            setTelegramUsername(data.username ?? data.firstName);
          }
        }
      } catch {
        // Not linked or API unavailable — safe default
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [authReady]);

  // ─── Load group data for this symbol ──────────────────────────────

  useEffect(() => {
    if (externalGroup) {
      setGroupData(externalGroup);
      return;
    }

    async function loadGroup() {
      try {
        const res = await fetch(`/api/telegram/groups?symbol=${symbol}`);
        if (res.ok) {
          const data = await res.json();
          if (data.group) {
            setGroupData(data.group);
          }
        }
      } catch {
        // No group found
      }
    }

    loadGroup();
  }, [symbol, externalGroup]);

  // ─── Auto-scroll chat ─────────────────────────────────────────────

  useEffect(() => {
    if (chatOpen && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatOpen]);

  // ─── Simulate bot messages for demo ───────────────────────────────

  useEffect(() => {
    if (!chatOpen || messages.length > 0) return;

    // Pre-populate with some mock messages
    const initialMessages: ChatMessage[] = [
      {
        id: 'bot-welcome',
        text: `👋 Welcome to the ${coinName || symbol} community chat! Type /help to see available commands.`,
        fromUser: 'DegenFeed Bot',
        isOwn: false,
        timestamp: Date.now() - 60000,
      },
      {
        id: 'bot-price',
        text: `📊 ${symbol} price is currently $0.001234 (+5.6% 24h)`,
        fromUser: 'DegenFeed Bot',
        isOwn: false,
        timestamp: Date.now() - 30000,
      },
    ];

    setMessages(initialMessages);
  }, [chatOpen, symbol, coinName, messages.length]);

  // ─── Handle link Telegram ─────────────────────────────────────────

  const handleLinkTelegram = useCallback(async () => {
    // Open Telegram bot deep link to start linking flow
    try {
      const res = await fetch('/api/telegram/link');
      if (res.ok) {
        const data = await res.json();
        window.open(data.deepLink, '_blank');
        showToast(
          'info',
          'Open the link in Telegram to connect your account, then refresh this page.',
        );
      } else {
        showToast('error', 'Failed to generate link. Try again later.');
      }
    } catch {
      showToast('error', 'Failed to connect to Telegram service.');
    }
  }, [showToast]);

  const handleUnlinkTelegram = useCallback(async () => {
    try {
      const res = await fetch('/api/telegram/link-account', { method: 'DELETE' });
      if (res.ok) {
        setTelegramLinked(false);
        setTelegramUsername(undefined);
        showToast('success', 'Telegram account unlinked.');
      } else {
        showToast('error', 'Failed to unlink.');
      }
    } catch {
      showToast('error', 'Failed to unlink Telegram account.');
    }
  }, [showToast]);

  // ─── Open in Telegram button ──────────────────────────────────────

  const handleOpenInTelegram = useCallback(() => {
    if (groupData?.inviteLink) {
      window.open(groupData.inviteLink, '_blank');
    } else if (groupData?.groupId) {
      window.open(`https://t.me/c/${groupData.groupId.replace('-100', '')}`, '_blank');
    } else {
      // Fallback: open bot with community command
      window.open(`https://t.me/DegenFeedBot?start=community_${symbol}`, '_blank');
    }
  }, [groupData, symbol]);

  // ─── Bot commands ────────────────────────────────────────────────

  const handleBotCommand = useCallback(
    async (command: string) => {
      const parts = command.split(/\s+/);
      const cmd = parts[0]?.toLowerCase() ?? '';
      const args = parts.slice(1);

      setBotCommandResult(null);

      let response = '';

      switch (cmd) {
        case '/help':
          response =
            '📋 <b>Available Commands</b>\n\n' +
            '/coin — Info about this creator coin\n' +
            '/price — Current price in USD\n' +
            '/buy [amount] — Generate buy link\n' +
            '/sell [amount] — Generate sell link\n' +
            '/holders — Number of holders\n' +
            '/leaderboard — Top holders\n' +
            '/tip @user [amount] — Send a tip\n' +
            '/alert price [target] — Set price alert\n' +
            '/community — Open DegenFeed community page';
          break;

        case '/coin':
          response = `💰 <b>${coinName || symbol} (${symbol})</b>\n━━━━━━━━━━━\nView full details on DegenFeed.`;
          break;

        case '/price':
          try {
            const res = await fetch(`/api/coins/${symbol}`);
            if (res.ok) {
              const coin = await res.json();
              const price = Number(coin.price ?? 0);
              const change = Number(coin.priceChange24h ?? 0);
              const sign = change >= 0 ? '+' : '';
              response =
                `💵 <b>${symbol} Price</b>\n` +
                `Price: <b>$${price.toFixed(6)}</b>\n` +
                `24h: ${sign}${change.toFixed(2)}%\n` +
                `MCap: $${Number(coin.marketCap ?? 0).toLocaleString()}`;
            } else {
              response = `❓ Could not fetch price for ${symbol}.`;
            }
          } catch {
            response = `❓ Could not fetch price for ${symbol}.`;
          }
          break;

        case '/buy': {
          const buyAmount = args[0] || '';
          const link = buyAmount
            ? `https://app.degenfeed.xyz/coins/${symbol.toLowerCase()}?buy=${buyAmount}`
            : `https://app.degenfeed.xyz/coins/${symbol.toLowerCase()}`;
          response = `🛒 <b>Buy ${symbol}</b>\n\n<a href="${link}">Click to buy ${symbol} on DegenFeed ↗</a>`;
          break;
        }

        case '/sell': {
          const sellAmount = args[0] || '';
          const link = sellAmount
            ? `https://app.degenfeed.xyz/coins/${symbol.toLowerCase()}?sell=${sellAmount}`
            : `https://app.degenfeed.xyz/coins/${symbol.toLowerCase()}`;
          response = `📤 <b>Sell ${symbol}</b>\n\n<a href="${link}">Click to sell ${symbol} on DegenFeed ↗</a>`;
          break;
        }

        case '/holders':
          try {
            const res = await fetch(`/api/coins/${symbol}`);
            if (res.ok) {
              const coin = await res.json();
              response = `👥 <b>${symbol} Holders</b>\n\nTotal holders: <b>${(coin.holderCount ?? coin.holders ?? 0).toLocaleString()}</b>`;
            } else {
              response = `👥 Holders data not available for ${symbol}.`;
            }
          } catch {
            response = `👥 Holders data not available for ${symbol}.`;
          }
          break;

        case '/leaderboard':
          response =
            `🏆 <b>${symbol} Leaderboard</b>\n\n` +
            `Top holders leaderboard available on the DegenFeed community page.\n\n` +
            `<a href="https://app.degenfeed.xyz/coins/${symbol.toLowerCase()}/community">View Leaderboard ↗</a>`;
          break;

        case '/tip': {
          const tipTarget = args[0]?.replace('@', '');
          const tipAmount = args[1];
          if (!tipTarget || !tipAmount) {
            response = '❌ Usage: /tip @username [amount]';
          } else {
            response = `⚡ <b>Tip</b>\n\nSend ${tipAmount} via Lightning to @${tipTarget}?\n<a href="https://app.degenfeed.xyz/tip?to=${tipTarget}&amount=${tipAmount}">Complete Tip ↗</a>`;
          }
          break;
        }

        case '/alert': {
          const alertType = args[0]; // 'price'
          const alertTarget = args[1];
          if (alertType === 'price' && alertTarget) {
            response = `🔔 <b>Alert Set</b>\n\nWe'll notify you when ${symbol} price reaches $${alertTarget}.`;
          } else {
            response = '❌ Usage: /alert price [target_price]';
          }
          break;
        }

        case '/community':
          response = `🌐 <b>${symbol} Community</b>\n\n<a href="https://app.degenfeed.xyz/coins/${symbol.toLowerCase()}/community">Open Community Page ↗</a>`;
          break;

        default:
          response = `❓ Unknown command. Type /help to see available commands.`;
      }

      // Add bot response to chat
      const botMsg: ChatMessage = {
        id: `bot-cmd-${Date.now()}`,
        text: response.replace(/<[^>]*>/g, ''), // Strip HTML for chat display
        fromUser: 'DegenFeed Bot',
        isOwn: false,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, botMsg]);
      setBotCommandResult(response);
    },
    [symbol, coinName],
  );

  // ─── Chat: Send message ──────────────────────────────────────────

  const handleSendMessage = useCallback(async () => {
    const text = inputText.trim();
    if (!text) return;

    // Add user message
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      text,
      fromUser: telegramUsername || 'You',
      isOwn: true,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInputText('');

    // Check if it's a bot command
    if (text.startsWith('/')) {
      await handleBotCommand(text);
    } else {
      // Regular chat message — broadcast to group via bridge
      try {
        await fetch('/api/telegram/send', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            chatId: groupData?.groupId ? Number(groupData.groupId) : undefined,
            text: `[${symbol} Chat] ${telegramUsername || 'Anonymous'}: ${text}`,
            parseMode: 'HTML',
          }),
        });
      } catch {
        // Best-effort
      }

      // Simulated bot response
      setTimeout(() => {
        const botMsg: ChatMessage = {
          id: `bot-${Date.now()}`,
          text: `Thanks for your message! Use /price, /holders, or /leaderboard for coin data.`,
          fromUser: 'DegenFeed Bot',
          isOwn: false,
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, botMsg]);
      }, 1000);
    }
  }, [inputText, telegramUsername, symbol, groupData, handleBotCommand]);

  // ─── Handle Enter key in chat ────────────────────────────────────

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSendMessage();
      }
    },
    [handleSendMessage],
  );

  // ─── Render States ───────────────────────────────────────────────

  if (loading) {
    return (
      <div className="animate-pulse rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-5">
        <div className="skeleton h-5 w-48 rounded-lg mb-3" />
        <div className="skeleton h-4 w-32 rounded-lg mb-4" />
        <div className="skeleton h-10 w-full rounded-lg" />
      </div>
    );
  }

  // ─── Not Linked State ───────────────────────────────────────────

  if (!telegramLinked) {
    return (
      <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-5">
        <div className="mb-3 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/15 text-lg">
            💬
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[var(--color-fg)]">Telegram Group</h3>
            <p className="text-xs text-[var(--color-muted)]">
              {groupData
                ? `${groupData.title} — ${groupData.memberCount ?? '?'} members`
                : `${symbol} Community`}
            </p>
          </div>
        </div>

        <p className="mb-4 text-xs text-[var(--color-muted)] leading-relaxed">
          Link your Telegram account to join the {symbol} group chat, receive coin alerts, and
          interact with the community.
        </p>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleLinkTelegram}
            className="flex-1 rounded-xl bg-blue-500/20 px-4 py-2.5 text-xs font-semibold text-blue-400 hover:bg-blue-500/30 transition-all active:scale-[0.98]"
          >
            🔗 Link Telegram Account
          </button>

          {groupData?.inviteLink && (
            <button
              type="button"
              onClick={handleOpenInTelegram}
              className="rounded-xl border border-[var(--color-glass-border)] px-4 py-2.5 text-xs font-medium text-[var(--color-muted)] hover:text-[var(--color-fg)] transition-all"
            >
              Open in Telegram ↗
            </button>
          )}
        </div>

        {/* Token Gate notice */}
        {groupData?.tokenGated && (
          <div className="mt-3 rounded-lg border border-amber-500/15 bg-amber-500/5 px-3 py-2">
            <p className="text-[10px] text-amber-400">
              🔒 Token-gated group: Requires {groupData.minHoldRequirement || 'a minimum'} {symbol}{' '}
              to join
            </p>
          </div>
        )}
      </div>
    );
  }

  // ─── Linked — Group Preview State ────────────────────────────────

  if (!chatOpen) {
    return (
      <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-5">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/15 text-lg">
              💬
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[var(--color-fg)]">
                {groupData?.title || `${symbol} Community`}
              </h3>
              <p className="text-xs text-[var(--color-muted)]">
                {groupData?.memberCount
                  ? `👥 ${groupData.memberCount} members`
                  : 'Connected via Telegram'}
              </p>
            </div>
          </div>
          {/* Connected badge */}
          <span className="rounded-full bg-green-500/15 px-2 py-0.5 text-[9px] font-medium text-green-400">
            ● Connected
          </span>
        </div>

        {/* Recent messages preview */}
        {(groupData?.recentMessages && groupData.recentMessages.length > 0) ||
        messages.length > 0 ? (
          <div className="mb-3 space-y-1.5">
            {(groupData?.recentMessages ?? messages.slice(-3)).map((msg) => (
              <div
                key={`msg-${msg.timestamp}-${msg.fromUser}`}
                className="rounded-lg border border-[var(--color-glass-border)] px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-medium text-[var(--color-fg)]">
                    {msg.fromUser}
                  </span>
                  <span className="text-[9px] text-[var(--color-muted)]">
                    {new Date(msg.timestamp).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-[var(--color-muted)] line-clamp-1">{msg.text}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="mb-3 text-xs text-[var(--color-muted)]">
            No recent messages. Start a conversation!
          </p>
        )}

        {/* Token gate notice */}
        {groupData?.tokenGated && (
          <div className="mb-3 rounded-lg border border-amber-500/15 bg-amber-500/5 px-3 py-2">
            <p className="text-[10px] text-amber-400">
              🔒 Token-gated: Requires {groupData.minHoldRequirement || 'minimum'} {symbol}
            </p>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setChatOpen(true)}
            className="flex-1 rounded-xl bg-degen-500/20 px-4 py-2.5 text-xs font-semibold text-degen-400 hover:bg-degen-500/30 transition-all active:scale-[0.98]"
          >
            💬 Chat Here
          </button>

          <button
            type="button"
            onClick={handleOpenInTelegram}
            className="rounded-xl border border-[var(--color-glass-border)] px-4 py-2.5 text-xs font-medium text-[var(--color-muted)] hover:text-[var(--color-fg)] transition-all"
          >
            Open Telegram ↗
          </button>

          <button
            type="button"
            onClick={handleUnlinkTelegram}
            className="rounded-xl border border-red-500/20 px-3 py-2.5 text-[10px] text-red-400 hover:bg-red-500/10 transition-all"
            title="Unlink Telegram"
          >
            ✕
          </button>
        </div>
      </div>
    );
  }

  // ─── Chat Embed (Mini App / In-App Chat) ─────────────────────────

  return (
    <div className="flex flex-col rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] overflow-hidden">
      {/* Chat header */}
      <div className="flex items-center justify-between border-b border-[var(--color-glass-border)] px-4 py-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setChatOpen(false)}
            className="flex h-7 w-7 items-center justify-center rounded-full text-[var(--color-muted)] hover:bg-[var(--color-overlay)] transition-colors"
          >
            ←
          </button>
          <div>
            <h3 className="text-sm font-semibold text-[var(--color-fg)]">
              {groupData?.title || `${symbol} Community`}
            </h3>
            <p className="text-[9px] text-[var(--color-muted)]">
              {telegramUsername ? `@${telegramUsername}` : 'Connected'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleOpenInTelegram}
          className="rounded-lg bg-blue-500/15 px-2.5 py-1 text-[9px] font-medium text-blue-400 hover:bg-blue-500/25 transition-colors"
        >
          Open ↗
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2 max-h-80 scrollbar-thin">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.isOwn ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-xs ${
                msg.isOwn
                  ? 'bg-degen-500/20 text-degen-200 rounded-br-md'
                  : 'bg-[var(--color-overlay)] text-[var(--color-fg)] rounded-bl-md'
              }`}
            >
              {!msg.isOwn && (
                <p className="mb-0.5 text-[9px] font-medium text-[var(--color-muted)]">
                  {msg.fromUser}
                </p>
              )}
              <p className="whitespace-pre-wrap break-words">{msg.text}</p>
              <p
                className={`mt-0.5 text-[8px] ${
                  msg.isOwn ? 'text-degen-500/60' : 'text-[var(--color-muted)]'
                }`}
              >
                {new Date(msg.timestamp).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Bot command result bar */}
      {botCommandResult && (
        <div className="mx-4 mb-2 rounded-lg border border-degen-500/15 bg-degen-500/5 px-3 py-2">
          <p className="text-[10px] text-degen-400 leading-relaxed">
            {botCommandResult.replace(/<[^>]*>/g, '')}
          </p>
        </div>
      )}

      {/* Input area */}
      <div className="border-t border-[var(--color-glass-border)] px-4 py-3">
        <div className="flex gap-2">
          <input
            ref={chatInputRef}
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Message or command (e.g. /price)`}
            className="input flex-1 text-xs"
          />
          <button
            type="button"
            onClick={handleSendMessage}
            disabled={!inputText.trim()}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-degen-500/20 text-degen-400 hover:bg-degen-500/30 disabled:opacity-30 transition-all active:scale-[0.95]"
          >
            ↑
          </button>
        </div>
        {/* Quick bot commands */}
        <div className="mt-2 flex flex-wrap gap-1">
          {['/price', '/holders', '/buy', '/help'].map((cmd) => (
            <button
              key={cmd}
              type="button"
              onClick={() => {
                setInputText(cmd);
                chatInputRef.current?.focus();
              }}
              className="rounded-md bg-[var(--color-overlay)] px-2 py-0.5 text-[9px] font-mono text-[var(--color-muted)] hover:text-degen-400 transition-colors"
            >
              {cmd}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
