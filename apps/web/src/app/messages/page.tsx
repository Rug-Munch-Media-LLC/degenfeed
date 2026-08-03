'use client';

/**
 * Messages Hub — DMs, Groups, Voice, Video
 *
 * Tabbed navigation between messaging features.
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useMemo } from 'react';
import { useAuth } from '../../components/AuthProvider';
import { useMessages } from '../../hooks/useMessages';
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

const _PROTOCOLS = ['nostr', 'farcaster', 'lens', 'bluesky', 'mastodon'] as const;

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

  const handleSendNew = useCallback(() => {
    handleSend({ protocol: sendingProtocol, toId: sendToId });
  }, [handleSend, sendingProtocol, sendToId]);

  const handleUserTyping = useCallback(() => {
    if (selectedConvId) handleTyping(selectedConvId);
  }, [selectedConvId, handleTyping]);

  const handleOpenNewMessage = useCallback(() => {
    setShowCompose(true);
    setSearchQuery('');
  }, [setShowCompose, setSearchQuery]);

  // Count total unread across all chat features
  const totalUnread = unreadTotal;

  return (
    <div className="mx-auto flex h-[calc(100dvh-8rem)] flex-col lg:h-[calc(100dvh-4rem)]">
      {/* Top navigation tabs */}
      <nav
        className="flex items-center gap-1 border-b border-[var(--color-border)] bg-[var(--color-glass-bg)] px-3 py-1.5 shrink-0 overflow-x-auto"
        aria-label="Chat features"
      >
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

      {/* DM content (child routes render their own) */}
      {pathname === '/messages' &&
        (!hasSignedIn ? (
          <div className="flex flex-1 items-center justify-center p-6">
            <div className="text-center max-w-sm">
              <span
                className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl text-3xl"
                style={{ backgroundColor: 'var(--color-overlay)', color: 'var(--color-muted)' }}
                aria-hidden="true"
              >
                💬
              </span>
              <p className="text-base font-semibold text-[var(--color-fg)]">Sign in to use DMs</p>
              <p className="mt-1.5 text-sm text-[var(--color-muted)] leading-relaxed">
                Cross-protocol direct messages across Nostr, Farcaster, Lens, Bluesky, Mastodon, and
                more.
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
              <ComposeBar
                value={composeText}
                onChange={setComposeText}
                onSend={handleSendNew}
                sending={sending}
                sendError={sendError}
                protocol={sendingProtocol}
                encrypted={true}
              />
            </div>
          </div>
        ) : (
          <div className="flex flex-1 overflow-hidden">
            <aside
              className={`w-full shrink-0 border-r border-[var(--color-border)] sm:w-[300px] ${selectedConvId && !showCompose ? 'hidden sm:flex sm:flex-col' : 'flex flex-col'}`}
            >
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
                    <span
                      className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl text-3xl"
                      style={{
                        backgroundColor: 'var(--color-overlay)',
                        color: 'var(--color-muted)',
                      }}
                      aria-hidden="true"
                    >
                      💬
                    </span>
                    <p className="text-sm font-medium text-[var(--color-fg)]">
                      Select a conversation
                    </p>
                    <p className="mt-1.5 text-xs text-[var(--color-muted)] leading-relaxed">
                      Choose a conversation from the left panel or start a new message.
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
