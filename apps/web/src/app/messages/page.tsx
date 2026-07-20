'use client';

import { getProtocolColor, getProtocolIcon, getProtocolLabel } from '@degenfeed/ui';
import { useCallback, useMemo } from 'react';
import { useAuth } from '../../components/AuthProvider';
import { useMessages } from '../../hooks/useMessages';
import { ChatView } from './ChatView';
import { ComposeBar } from './ComposeBar';
import { ConversationList } from './ConversationList';

/* === Constants =============================================== */

const PROTOCOLS = ['nostr', 'farcaster', 'lens', 'bluesky', 'mastodon'] as const;

/* === My IDs helper =========================================== */

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

/* === Page ==================================================== */

export default function MessagesPage() {
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

  // == Select conversation handler ==========================
  const handleSelectConv = useCallback(
    (conv: { conversationId: string }) => {
      selectConv(conv.conversationId);
    },
    [selectConv],
  );

  // == Send from chat view (uses conversation context) =====
  const handleSendFromChat = useCallback(() => {
    if (!selectedConv) return;
    const other = selectedConv.participants[1] ?? selectedConv.participants[0] ?? '';
    handleSend({ protocol: selectedConv.protocol, toId: other });
  }, [selectedConv, handleSend]);

  // == Send from "New Message" compose =====================
  const handleSendNew = useCallback(() => {
    handleSend({ protocol: sendingProtocol, toId: sendToId });
  }, [handleSend, sendingProtocol, sendToId]);

  // == Typing forwarding ===================================
  const handleUserTyping = useCallback(() => {
    if (selectedConvId) {
      handleTyping(selectedConvId);
    }
  }, [selectedConvId, handleTyping]);

  // == New message: reset compose state ====================
  const handleOpenNewMessage = useCallback(() => {
    setShowCompose(true);
    setSearchQuery('');
  }, [setShowCompose, setSearchQuery]);

  // == Render ==============================================

  return (
    <div className="mx-auto flex h-[calc(100dvh-8rem)] flex-col lg:h-[calc(100dvh-4rem)]">
      {/* == Header ========================================== */}
      <header className="flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-glass-bg)] px-4 py-2.5 shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-xl" aria-hidden="true">
            {'💬'}
          </span>
          <div>
            <h1 className="text-base font-bold text-[var(--color-fg)] leading-tight">Messages</h1>
            <p className="text-[10px] text-[var(--color-muted)]">
              {unreadTotal > 0
                ? `${unreadTotal} unread ${unreadTotal === 1 ? 'message' : 'messages'}`
                : 'All caught up'}
            </p>
          </div>
        </div>
      </header>

      {!hasSignedIn ? (
        /* ═══ NOT SIGNED IN ═════════════════════════════════ */
        <div className="flex flex-1 items-center justify-center p-6">
          <div className="text-center max-w-sm">
            <span
              className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl text-3xl"
              style={{
                backgroundColor: 'var(--color-overlay)',
                color: 'var(--color-muted)',
              }}
              aria-hidden="true"
            >
              {'💬'}
            </span>
            <p className="text-base font-semibold text-[var(--color-fg)]">Sign in to use DMs</p>
            <p className="mt-1.5 text-sm text-[var(--color-muted)] leading-relaxed">
              Cross-protocol direct messages across Nostr, Farcaster, Lens, Bluesky, and Mastodon.
              End-to-end encrypted on Nostr.
            </p>
          </div>
        </div>
      ) : showCompose ? (
        /* ═══ NEW MESSAGE COMPOSE (full-screen on mobile) ══ */
        <div className="flex flex-1 flex-col">
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
            {/* Protocol selector */}
            <fieldset className="space-y-1.5 border-0 p-0 m-0">
              <legend className="text-[11px] font-medium text-[var(--color-muted)] uppercase tracking-wider">
                Protocol
              </legend>
              <div className="flex flex-wrap gap-2">
                {PROTOCOLS.map((p) => {
                  const isActive = p === sendingProtocol;
                  const color = getProtocolColor(p);
                  const icon = getProtocolIcon(p);
                  const label = getProtocolLabel(p);
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setSendProtocol(p)}
                      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-all ${
                        isActive
                          ? 'shadow-sm border'
                          : 'opacity-60 hover:opacity-100 border border-transparent'
                      }`}
                      style={
                        isActive
                          ? {
                              backgroundColor: `${color}15`,
                              color,
                              borderColor: `${color}30`,
                            }
                          : undefined
                      }
                      aria-pressed={isActive}
                    >
                      <span>{icon}</span>
                      {label}
                    </button>
                  );
                })}
              </div>
            </fieldset>

            {/* Recipient input */}
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
                placeholder="Pubkey, FID, handle, or ENS\u2026"
                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-3.5 py-2.5 text-sm text-[var(--color-fg)] placeholder:text-[var(--color-muted)] focus:border-degen-500/30 focus:ring-1 focus:ring-degen-500/30 transition-shadow"
              />
            </div>

            {/* Compose area */}
            <ComposeBar
              value={composeText}
              onChange={setComposeText}
              onSend={handleSendNew}
              sending={sending}
              sendError={sendError}
              protocol={sendingProtocol}
            />
          </div>
        </div>
      ) : (
        /* ═══ MAIN SPLIT VIEW ═══════════════════════════════ */
        <div className="flex flex-1 overflow-hidden">
          {/* == Left: Conversation list ========================== */}
          <aside
            className={`w-full shrink-0 border-r border-[var(--color-border)] sm:w-[300px] ${
              selectedConvId && !showCompose ? 'hidden sm:flex sm:flex-col' : 'flex flex-col'
            }`}
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

          {/* == Right: Chat view ==================================== */}
          <section
            className={`flex flex-1 flex-col overflow-hidden ${
              !selectedConvId && !showCompose ? 'hidden sm:flex' : ''
            }`}
            aria-label="Chat view"
          >
            {!selectedConvId ? (
              /* Empty state — no conversation selected */
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
                    {'\u{1F4AC}'}
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
              /* Chat view for selected conversation */
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
              /* Conversation not found in list */
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
      )}
    </div>
  );
}
