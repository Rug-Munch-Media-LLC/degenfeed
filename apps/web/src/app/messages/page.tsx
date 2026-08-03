'use client';

/**
 * Messages Hub — DMs, Groups, Voice, Video
 *
 * Tabbed navigation between messaging features.
 */

import {
  type DegenIdentity,
  getOfflineQueue,
  resolveDegenIdentity,
  useChatUnread,
  useDegenChatConnection,
} from '@degenfeed/degenchat';
import { getProtocolColor, getProtocolLabel } from '@degenfeed/ui';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../components/AuthProvider';
import { DegenChatLogo, DegenChatWordmark } from '../../components/DegenChatBrand';
import { useMessages } from '../../hooks/useMessages';
import { usePushNotifications } from '../../hooks/usePushNotifications';
import { retryFetch } from '../../lib/retryFetch';
import { ChatView } from './ChatView';
import { ComposeBar } from './ComposeBar';
import { ConversationList } from './ConversationList';

/* ─── Navigation tabs ────────────────────────────────────────────────── */

const CHAT_TABS = [
  { id: 'messages', label: 'DMs', icon: '💬', href: '/messages' },
  { id: 'groups', label: 'Groups', icon: '👥', href: '/messages/groups' },
  { id: 'voice', label: 'Voice', icon: '🎤', href: '/messages/voice' },
  { id: 'video', label: 'Video', icon: '📹', href: '/messages/video' },
] as const;

/* ─── Constants ──────────────────────────────────────────────────────── */

const TRANSPORT_OPTIONS = [
  { id: 'nostr', label: 'Nostr', icon: '☀️', color: '#E33A3A', e2e: true },
  { id: 'matrix', label: 'Matrix', icon: '🧩', color: '#0DBD8B', e2e: true },
  { id: 'bluesky', label: 'Bluesky', icon: '🦋', color: '#1185FE', e2e: false },
  { id: 'mastodon', label: 'Mastodon', icon: '🐘', color: '#6364FF', e2e: false },
  { id: 'direct-ws', label: 'Direct', icon: '🔗', color: '#00FF41', e2e: true },
] as const;

/* ─── Helper ─────────────────────────────────────────────────────────── */

function getMyIds(tokens: Record<string, string>): string[] {
  return [
    tokens.nostr_pubkey,
    tokens.farcaster_fid ? String(tokens.farcaster_fid) : undefined,
    tokens.lens_profileId,
    tokens.bluesky_did,
    tokens.mastodon_handle,
    tokens.evmAddress,
    tokens.solanaAddress,
    tokens.did,
    tokens.fid,
    tokens.lensProfileId,
  ].filter(Boolean) as string[];
}

/* ─── Encryption Info Banner ─────────────────────────────────────────── */

function EncryptionInfoBanner() {
  return (
    <div className="mx-3 mt-2 rounded-lg border border-degen-500/15 bg-degen-500/5 px-3 py-2">
      <div className="flex items-start gap-2">
        <span className="mt-0.5 shrink-0 text-degen-400" aria-hidden="true">
          <svg aria-hidden="true" width="12" height="12" viewBox="0 0 16 16" fill="none">
            <rect
              x="3"
              y="7"
              width="10"
              height="7"
              rx="1.5"
              stroke="currentColor"
              strokeWidth="1.2"
            />
            <path
              d="M5 7V4a3 3 0 016 0v3"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
            />
          </svg>
        </span>
        <div>
          <p className="text-[10px] font-medium text-degen-400">
            Messages are end-to-end encrypted
          </p>
          <p className="text-[8px] text-degen-400/50 mt-0.5 leading-relaxed">
            No one — not even DegenFeed — can read your messages.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ─── Page ───────────────────────────────────────────────────────────── */

export default function MessagesPage() {
  const pathname = usePathname();
  const { ready, signedInProtocols, tokens } = useAuth();
  const hasSignedIn = ready && Object.values(signedInProtocols).some(Boolean);
  const { register: registerPush } = usePushNotifications();

  // Best-effort push registration for chat notifications when signed in
  useEffect(() => {
    if (hasSignedIn) {
      registerPush();
    }
  }, [hasSignedIn, registerPush]);

  const {
    filteredConversations,
    convLoading,
    convError,
    unreadTotal,
    selectedConvId,
    selectedConv,
    messages,
    msgLoading,
    msgError,
    sending,
    sendError,
    sendingProtocol,
    sendToId,
    showCompose,
    composeText,
    searchQuery,
    typingUsersForSelected,
    realtimeConnected,
    setComposeText,
    setSendProtocol,
    setSendToId,
    setShowCompose,
    setSearchQuery,
    fetchConversations,
    selectConv,
    clearSelectedConv,
    handleSend,
    handleTyping,
  } = useMessages();

  const myIds = useMemo(() => getMyIds(tokens), [tokens]);
  const isActiveTab = (href: string) => pathname === href;

  // Multi-protocol compose: which protocols to send to
  const [composeProtocols, setComposeProtocols] = useState<string[]>(['nostr']);

  const handleSelectConv = useCallback(
    (conv: { conversationId: string }) => {
      selectConv(conv.conversationId);
    },
    [selectConv],
  );

  const handleSendFromChat = useCallback(() => {
    if (!selectedConv) return;
    const other = selectedConv.participants[1] ?? selectedConv.participants[0] ?? '';
    handleSend({ protocol: selectedConv.protocol, toId: other });
  }, [selectedConv, handleSend]);

  const handleSendNew = useCallback(async () => {
    const text = composeText.trim();
    if (!text || !sendToId) return;
    // Fan out to every selected protocol
    for (const protocol of composeProtocols) {
      await handleSend({ protocol, toId: sendToId, content: text });
    }
  }, [composeText, sendToId, composeProtocols, handleSend]);

  const handleUserTyping = useCallback(() => {
    if (selectedConvId) handleTyping(selectedConvId);
  }, [selectedConvId, handleTyping]);

  const handleOpenNewMessage = useCallback(() => {
    setShowCompose(true);
    setSearchQuery('');
  }, [setShowCompose, setSearchQuery]);

  // ── DegenChat connection status (Redis hub + per-adapter states) ──────
  const { adapterStates, hubStatus, reconnecting, restart } = useDegenChatConnection({
    signedInProtocols,
  });

  // ── Offline queue: pending messages waiting for replay ────────────────
  const { pending: pendingCount } = useChatUnread({ enabled: false });

  const flushOfflineQueue = useCallback(async () => {
    const queue = getOfflineQueue();
    const result = await queue.flush(async (message) => {
      try {
        const res = await retryFetch('/api/messages/send', {
          maxRetries: 1,
          fetchOptions: {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              to: message.toId,
              body: message.body,
              preferredProtocol: message.protocol,
              nostrPubkey: tokens.nostr_pubkey,
              auth: tokens,
            }),
          },
        });
        return res.ok;
      } catch {
        return false;
      }
    });
    window.dispatchEvent(new CustomEvent('degenchat:offline-queue'));
    return result;
  }, [tokens]);

  // Auto-flush the offline queue whenever realtime connectivity returns.
  const prevRealtimeConnected = useRef<boolean | null>(null);
  useEffect(() => {
    if (!hasSignedIn) return;
    const was = prevRealtimeConnected.current;
    prevRealtimeConnected.current = realtimeConnected;
    if (realtimeConnected && (was === false || was === null) && getOfflineQueue().size > 0) {
      void flushOfflineQueue();
    }
  }, [realtimeConnected, hasSignedIn, flushOfflineQueue]);

  // ── Compose: resolve the recipient's cross-protocol identity ──────────
  const [resolvedIdentity, setResolvedIdentity] = useState<DegenIdentity | null>(null);
  const [resolvingIdentity, setResolvingIdentity] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const identifier = sendToId.trim();
    if (!identifier) {
      setResolvedIdentity(null);
      setResolvingIdentity(false);
      return;
    }
    setResolvingIdentity(true);
    const timer = setTimeout(async () => {
      try {
        const resolved = await resolveDegenIdentity(identifier);
        if (cancelled) return;
        setResolvedIdentity(resolved);
        // Auto-select reachable delivery protocols for the fan-out.
        const reachable = resolved.deliveryProtocols.filter((p) =>
          TRANSPORT_OPTIONS.some((t) => t.id === p),
        );
        if (reachable.length > 0) setComposeProtocols(reachable.slice(0, 5));
      } catch {
        if (!cancelled) setResolvedIdentity(null);
      } finally {
        if (!cancelled) setResolvingIdentity(false);
      }
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [sendToId]);

  // Count total unread across all chat features
  const totalUnread = unreadTotal;

  return (
    <div className="mx-auto flex h-[calc(100dvh-8rem)] flex-col lg:h-[calc(100dvh-4rem)]">
      {/* Top navigation tabs */}
      <nav
        className="flex items-center gap-1 border-b border-[var(--color-border)] bg-[var(--color-glass-bg)] px-3 py-1.5 shrink-0 overflow-x-auto"
        aria-label="Chat features"
      >
        <div className="mr-2 hidden shrink-0 items-center md:flex">
          <DegenChatWordmark size="sm" />
        </div>
        {CHAT_TABS.map((tab) => {
          const active = isActiveTab(tab.href);
          return (
            <Link
              key={tab.id}
              href={tab.href}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-all ${
                active
                  ? 'bg-degen-500/15 text-degen-400 shadow-sm'
                  : 'text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-overlay)]'
              }`}
              aria-current={active ? 'page' : undefined}
            >
              <span className="text-sm">{tab.icon}</span>
              <span>{tab.label}</span>
              {tab.id === 'messages' && totalUnread > 0 && (
                <span className="ml-0.5 flex h-4 min-w-[14px] items-center justify-center rounded-full bg-degen-500 px-1 text-[8px] font-bold text-black">
                  {totalUnread > 99 ? '99+' : totalUnread}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Offline queue banner — messages queued while disconnected */}
      {hasSignedIn && pendingCount > 0 && (
        <div
          className="flex shrink-0 items-center justify-between gap-2 border-b border-amber-500/20 bg-amber-500/10 px-4 py-2"
          role="status"
        >
          <span className="text-[11px] font-medium text-amber-400">
            ⏳ {pendingCount} message{pendingCount > 1 ? 's' : ''} pending in the offline queue
          </span>
          <button
            type="button"
            onClick={() => void flushOfflineQueue()}
            className="rounded-lg bg-amber-500/20 px-2.5 py-1 text-[10px] font-semibold text-amber-400 transition-colors hover:bg-amber-500/30"
          >
            Send now
          </button>
        </div>
      )}

      {/* DM content (child routes render their own) */}
      {pathname === '/messages' &&
        (!hasSignedIn ? (
          <div className="flex flex-1 items-center justify-center p-6">
            <div className="text-center max-w-sm">
              <div className="mb-4 flex justify-center">
                <DegenChatWordmark size="md" />
              </div>
              <p className="text-base font-semibold text-[var(--color-fg)]">
                Sign in to use DegenChat
              </p>
              <p className="mt-1.5 text-sm text-[var(--color-muted)] leading-relaxed">
                Chat across every protocol — Nostr, Farcaster, Mastodon, Bluesky, Lens, Matrix, and
                XMPP in one inbox.
                <strong className="text-degen-400"> End-to-end encrypted by default.</strong>
              </p>
            </div>
          </div>
        ) : showCompose ? (
          <div className="flex flex-1 flex-col">
            <EncryptionInfoBanner />
            <div className="flex items-center gap-3 border-b border-[var(--color-border)] bg-[var(--color-glass-bg)] px-3 py-2.5">
              <button
                type="button"
                onClick={() => setShowCompose(false)}
                className="rounded-lg p-1.5 text-[var(--color-muted)] hover:bg-[var(--color-overlay)] hover:text-[var(--color-fg)] transition-colors"
                aria-label="Cancel new message"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
              <span className="text-sm font-semibold text-[var(--color-fg)]">New Message</span>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <fieldset className="space-y-1.5 border-0 p-0 m-0">
                <legend className="text-[11px] font-medium text-[var(--color-muted)] uppercase tracking-wider">
                  Transport Protocol
                </legend>
                <div className="flex flex-wrap gap-2">
                  {TRANSPORT_OPTIONS.map((p) => {
                    const isActive = p.id === sendingProtocol;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setSendProtocol(p.id)}
                        className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-all ${isActive ? 'shadow-sm border' : 'opacity-60 hover:opacity-100 border border-transparent'}`}
                        style={
                          isActive
                            ? {
                                backgroundColor: `${p.color}15`,
                                color: p.color,
                                borderColor: `${p.color}30`,
                              }
                            : undefined
                        }
                        aria-pressed={isActive}
                      >
                        <span>{p.icon}</span>
                        {p.label}
                        {p.e2e && (
                          <span className="text-[8px] opacity-60" title="End-to-end encrypted">
                            🔒
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
              <div className="space-y-1.5">
                <label
                  htmlFor="new-msg-recipient"
                  className="text-[11px] font-medium text-[var(--color-muted)] uppercase tracking-wider"
                >
                  Recipient
                </label>
                <input
                  id="new-msg-recipient"
                  type="text"
                  value={sendToId}
                  onChange={(e) => setSendToId(e.target.value)}
                  placeholder="Pubkey, handle, wallet, or ENS…"
                  className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-3.5 py-2.5 text-sm text-[var(--color-fg)] placeholder:text-[var(--color-muted)] focus:border-degen-500/30 focus:ring-1 focus:ring-degen-500/30 transition-shadow"
                />
              </div>
              {resolvingIdentity && (
                <p className="text-[10px] text-[var(--color-muted)]" role="status">
                  Resolving identity…
                </p>
              )}
              {resolvedIdentity && !resolvingIdentity && (
                <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-[10px] font-semibold text-[var(--color-fg)]">
                      {resolvedIdentity.displayName ?? resolvedIdentity.raw}
                    </span>
                    <span className="ml-auto shrink-0 text-[9px] text-[var(--color-muted)]">
                      {resolvedIdentity.deliveryProtocols.length} reachable
                    </span>
                  </div>
                  {resolvedIdentity.deliveryProtocols.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {resolvedIdentity.deliveryProtocols.map((p) => (
                        <span
                          key={p}
                          className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-semibold"
                          style={{
                            backgroundColor: `${getProtocolColor(p)}18`,
                            color: getProtocolColor(p),
                          }}
                        >
                          {getProtocolLabel(p)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <ComposeBar
                value={composeText}
                onChange={setComposeText}
                onSend={handleSendNew}
                sending={sending}
                sendError={sendError}
                protocol={sendingProtocol}
                protocols={TRANSPORT_OPTIONS.map((p) => p.id)}
                multiProtocols={composeProtocols}
                onMultiProtocolsChange={setComposeProtocols}
                encrypted={true}
              />
            </div>
          </div>
        ) : (
          <div className="flex flex-1 overflow-hidden">
            <aside
              className={`w-full shrink-0 border-r border-[var(--color-border)] sm:w-[300px] ${selectedConvId && !showCompose ? 'hidden sm:flex sm:flex-col' : 'flex flex-col'}`}
            >
              {/* DegenChat hub + adapter status */}
              {hasSignedIn && (
                <div className="flex shrink-0 items-center gap-1 border-b border-[var(--color-border)] bg-[var(--color-glass-bg)] px-3 py-1.5">
                  <span
                    className="mr-1 text-[9px] font-semibold uppercase tracking-wider text-[var(--color-muted)]"
                    aria-hidden="true"
                  >
                    Hubs
                  </span>
                  {Object.entries(adapterStates).map(([protocol, state]) => (
                    <span
                      key={protocol}
                      className="h-2 w-2 rounded-full"
                      style={{
                        backgroundColor:
                          state === 'connected'
                            ? getProtocolColor(protocol)
                            : state === 'connecting'
                              ? '#f59e0b'
                              : 'var(--color-muted)',
                        opacity: state === 'disconnected' ? 0.4 : 1,
                      }}
                      role="img"
                      title={`${getProtocolLabel(protocol)}: ${state}`}
                      aria-label={`${getProtocolLabel(protocol)}: ${state}`}
                    />
                  ))}
                  {reconnecting && (
                    <span className="ml-1 text-[9px] text-amber-400" role="status">
                      reconnecting…
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={restart}
                    className="ml-auto rounded px-1.5 py-0.5 text-[10px] text-[var(--color-muted)] transition-colors hover:bg-[var(--color-overlay)] hover:text-degen-400"
                    title={`DegenChat hub: ${hubStatus ? `${hubStatus.mode} (${hubStatus.connected ? 'connected' : 'disconnected'})` : 'starting…'} — click to restart`}
                    aria-label="Restart DegenChat hub"
                  >
                    ↻
                  </button>
                </div>
              )}
              <ConversationList
                conversations={filteredConversations}
                loading={convLoading}
                error={convError}
                selectedId={selectedConvId}
                unreadTotal={unreadTotal}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                onSelect={handleSelectConv}
                onNewMessage={handleOpenNewMessage}
                onRetry={fetchConversations}
              />
            </aside>
            <section
              className={`flex flex-1 flex-col overflow-hidden ${!selectedConvId && !showCompose ? 'hidden sm:flex' : ''}`}
              aria-label="Chat view"
            >
              {!selectedConvId ? (
                <div className="flex flex-1 items-center justify-center">
                  <div className="text-center max-w-xs px-4">
                    <div className="mb-4 flex justify-center">
                      <DegenChatLogo size={56} />
                    </div>
                    <p className="text-sm font-medium text-[var(--color-fg)]">
                      Select a conversation
                    </p>
                    <p className="mt-1.5 text-xs text-[var(--color-muted)] leading-relaxed">
                      Choose a conversation from the left panel or start a new message. Chat across
                      every protocol.
                    </p>
                  </div>
                </div>
              ) : selectedConv ? (
                <ChatView
                  conversation={selectedConv}
                  messages={messages}
                  loading={msgLoading}
                  error={msgError}
                  sending={sending}
                  sendError={sendError}
                  composeText={composeText}
                  onComposeChange={setComposeText}
                  onSend={handleSendFromChat}
                  onTyping={handleUserTyping}
                  onBack={clearSelectedConv}
                  typingUsers={typingUsersForSelected}
                  myIds={myIds}
                />
              ) : (
                <div className="flex flex-1 items-center justify-center">
                  <div className="text-center px-4">
                    <p className="text-sm text-[var(--color-muted)]">Conversation not found</p>
                    <button
                      type="button"
                      onClick={clearSelectedConv}
                      className="mt-3 text-xs text-degen-400 hover:underline transition-colors"
                    >
                      Back to conversations
                    </button>
                  </div>
                </div>
              )}
            </section>
          </div>
        ))}
    </div>
  );
}
