'use client';

import { useEffect, useRef, useState } from 'react';
import { useIsMobile, useKeyboardHeight } from '../../hooks/useMobileResponsive';
import type { ChatMessage } from '../../hooks/usePeerTubeStream';

/* === Types ============================================ */

interface PeerTubeChatFeedProps {
  messages: ChatMessage[];
  onSend: (text: string) => Promise<void>;
  tokenAddress: string;
  tokenSymbol?: string;
  isConnected?: boolean;
  compact?: boolean;
  maxHeight?: string;
}

/* === Helper =========================================== */

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function shortenAddress(addr: string): string {
  if (addr.length < 10) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

/* === Main Component ================================== */

export default function PeerTubeChatFeed({
  messages,
  onSend,
  tokenAddress,
  tokenSymbol,
  isConnected = true,
  compact = false,
  maxHeight = '400px',
}: PeerTubeChatFeedProps) {
  const isMobile = useIsMobile();
  const keyboardHeight = useKeyboardHeight();
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (autoScroll && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [autoScroll]);

  const handleScroll = () => {
    const el = chatContainerRef.current;
    if (!el) return;
    // If user scrolls up, disable auto-scroll
    const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
    setAutoScroll(isAtBottom);
  };

  // Handle mobile keyboard
  useEffect(() => {
    if (keyboardHeight > 0 && inputRef.current) {
      setTimeout(() => {
        inputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 300);
    }
  }, [keyboardHeight]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending) return;

    setSending(true);
    try {
      await onSend(text);
      setInput('');
    } catch (err) {
      console.error('[PeerTubeChat] Send failed:', err);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (compact) {
    return (
      <div className="overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-card)]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-3 py-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-[var(--color-fg)]">💬 Live Chat</span>
            <span className="flex items-center gap-1 text-[10px] text-[var(--color-muted)]">
              <span
                className={`inline-block h-1.5 w-1.5 rounded-full ${
                  isConnected ? 'bg-green-400' : 'bg-red-400'
                }`}
              />
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
          {tokenSymbol && (
            <a
              href={`https://video.degenfeed.xyz/search?search=$${tokenSymbol.toLowerCase()}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] text-[var(--color-muted)] hover:text-degen-400 transition-colors"
            >
              🌐 Federated via PeerTube
            </a>
          )}
        </div>

        {/* Messages */}
        <div
          ref={chatContainerRef}
          onScroll={handleScroll}
          className="space-y-1 overflow-y-auto p-2"
          style={{ maxHeight }}
        >
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="text-2xl opacity-30">💬</div>
              <p className="mt-2 text-xs text-[var(--color-muted)]">
                No messages yet. Be the first to say something!
              </p>
            </div>
          ) : (
            messages.map((msg) => <ChatBubble key={msg.id} message={msg} compact />)
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input — keyboard aware */}
        <div
          className="border-t border-[var(--color-border)] p-2"
          style={isMobile && keyboardHeight > 0 ? { paddingBottom: keyboardHeight } : undefined}
        >
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Send a message..."
              maxLength={500}
              disabled={sending}
              className="flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-overlay)] px-3 py-2 text-xs text-[var(--color-fg)] placeholder-[var(--color-muted)] outline-none focus:border-degen-500/30 disabled:opacity-50"
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={!input.trim() || sending}
              className="rounded-lg bg-degen-500/20 px-3.5 py-2 text-xs font-medium text-degen-400 hover:bg-degen-500/30 transition-colors disabled:opacity-50 touch-target"
              style={{ minHeight: 44 }}
            >
              {sending ? '...' : 'Send'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Full version
  return (
    <div className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-card)]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-[var(--color-fg)]">💬 Live Chat</span>
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
              isConnected ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
            }`}
          >
            <span
              className={`inline-block h-1.5 w-1.5 rounded-full ${
                isConnected ? 'bg-green-400' : 'bg-red-400'
              }`}
            />
            {isConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-[var(--color-muted)]">{messages.length} messages</span>
          <a
            href={`https://video.degenfeed.xyz/search?search=$${tokenSymbol?.toLowerCase() ?? tokenAddress.slice(0, 8)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 rounded-md border border-[var(--color-border)] px-2 py-0.5 text-[10px] text-[var(--color-muted)] hover:text-degen-400 transition-colors"
          >
            🌐 PeerTube
          </a>
        </div>
      </div>

      {/* Messages */}
      <div
        ref={chatContainerRef}
        onScroll={handleScroll}
        className="space-y-2 overflow-y-auto p-3"
        style={{ maxHeight }}
      >
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="text-3xl opacity-30">💬</div>
            <p className="mt-2 text-sm text-[var(--color-muted)]">No messages yet</p>
            <p className="text-xs text-[var(--color-muted)]">
              Chat is federated via PeerTube&apos;s XMPP network
            </p>
          </div>
        ) : (
          messages.map((msg) => <ChatBubble key={msg.id} message={msg} />)
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input — keyboard aware */}
      <div
        className="border-t border-[var(--color-border)] p-2.5 sm:p-3"
        style={isMobile && keyboardHeight > 0 ? { paddingBottom: keyboardHeight } : undefined}
      >
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Send a message to the stream..."
            maxLength={500}
            disabled={sending}
            className="flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-overlay)] px-3 py-2.5 text-sm text-[var(--color-fg)] placeholder-[var(--color-muted)] outline-none focus:border-degen-500/30 disabled:opacity-50"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!input.trim() || sending}
            className="btn-primary flex items-center gap-1 px-4 py-2.5 text-sm disabled:opacity-50 touch-target"
            style={{ minHeight: 44 }}
          >
            {sending ? (
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : (
              'Send'
            )}
          </button>
        </div>
        <p className="mt-1 text-[10px] text-[var(--color-muted)]">
          Chat is federated across the PeerTube fediverse (ActivityPub/XMPP)
        </p>
      </div>
    </div>
  );
}

/* === Chat Bubble ===================================== */

function ChatBubble({ message, compact = false }: { message: ChatMessage; compact?: boolean }) {
  const isWalletAddress = message.accountName.startsWith('0x');

  return (
    <div
      className={`group flex gap-2 rounded-lg p-2 transition-colors hover:bg-[var(--color-overlay)] ${
        message.isCreator ? 'bg-degen-500/5' : ''
      } ${message.isHolder ? 'bg-green-500/5' : ''}`}
    >
      {/* Avatar */}
      <div
        className={`flex-shrink-0 rounded-full bg-gradient-to-br ${
          message.isCreator
            ? 'from-degen-400 to-purple-500'
            : message.isHolder
              ? 'from-green-400 to-emerald-500'
              : 'from-[var(--color-muted)] to-[var(--color-border)]'
        } ${compact ? 'h-6 w-6 text-[10px]' : 'h-8 w-8 text-xs'}`}
      >
        <div className="flex h-full w-full items-center justify-center font-bold text-white">
          {message.displayName[0]?.toUpperCase() ?? '?'}
        </div>
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span
            className={`truncate font-medium ${
              compact ? 'text-[11px]' : 'text-xs'
            } ${message.isCreator ? 'text-degen-400' : 'text-[var(--color-fg)]'}`}
          >
            {message.isCreator ? (
              <span className="flex items-center gap-1">
                {message.displayName}
                <span className="text-[10px] text-degen-400">★ Creator</span>
              </span>
            ) : isWalletAddress ? (
              shortenAddress(message.displayName)
            ) : (
              message.displayName
            )}
          </span>
          <span className={`text-[10px] text-[var(--color-muted)] ${compact ? 'hidden' : ''}`}>
            {formatTime(message.timestamp)}
          </span>
          {message.isHolder && !message.isCreator && (
            <span className="text-[10px] text-green-400">● Holder</span>
          )}
        </div>
        <p
          className={`mt-0.5 text-[var(--color-fg)] ${
            compact ? 'text-[11px] leading-tight' : 'text-sm'
          }`}
        >
          {message.message}
        </p>
      </div>
    </div>
  );
}
