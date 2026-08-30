'use client';

import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../../components/AuthProvider';

// ─── Types ──────────────────────────────────────────────────────────────────

type RoomTransport = 'nostr' | 'matrix' | 'farcaster' | 'bluesky' | 'telegram' | 'web';

interface RoomMember {
  id: string;
  displayName?: string;
  transport: RoomTransport;
  role: 'admin' | 'member';
  joinedAt: number;
  lastActive: number;
  identity: {
    nostr?: { npub: string };
    matrix?: { userId: string };
    farcaster?: { fid: number; username?: string };
    bluesky?: { handle?: string };
    telegram?: { chatId: string };
  };
}

interface RoomInfo {
  id: string;
  name: string;
  description: string;
  creator: string;
  transports: Record<RoomTransport, boolean>;
  members: RoomMember[];
  memberCount: number;
  myTransport: RoomTransport;
  myRole: string | null;
  createdAt: number;
  lastActivity: number;
  iconUrl?: string;
}

interface RoomMessage {
  id: string;
  roomId: string;
  fromId: string;
  fromName: string;
  content: string;
  createdAt: number;
  sourceTransport: RoomTransport;
  mentions?: string[];
  deliveryStatus?: Record<string, MemberDeliveryStatus>;
  replyTo?: string;
}

interface MemberDeliveryStatus {
  transport: RoomTransport;
  ok: boolean;
  nativeId?: string;
  error?: string;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const TRANSPORT_CONFIG: Record<RoomTransport, { label: string; icon: string; color: string }> = {
  nostr: { label: 'Nostr', icon: '🟣', color: '#E33A3A' },
  matrix: { label: 'Matrix', icon: '🔵', color: '#0DBD8B' },
  farcaster: { label: 'Farcaster', icon: '🟠', color: '#8A63D2' },
  bluesky: { label: 'Bluesky', icon: '🔷', color: '#1185FE' },
  telegram: { label: 'Telegram', icon: '✈️', color: '#26A5E4' },
  web: { label: 'Web', icon: '🌐', color: '#00FF41' },
};

const TRANSPORT_OPTIONS: Array<{ id: RoomTransport; label: string; icon: string }> = [
  { id: 'nostr', label: 'Nostr', icon: '🟣' },
  { id: 'matrix', label: 'Matrix', icon: '🔵' },
  { id: 'farcaster', label: 'Farcaster', icon: '🟠' },
  { id: 'bluesky', label: 'Bluesky', icon: '🔷' },
  { id: 'telegram', label: 'Telegram', icon: '✈️' },
  { id: 'web', label: 'Web', icon: '🌐' },
];

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatTime(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function shortId(id: string): string {
  if (id.startsWith('0x')) return `${id.slice(0, 6)}…${id.slice(-4)}`;
  if (id.length > 12) return `${id.slice(0, 6)}…`;
  return id;
}

// ─── Transport Badge ────────────────────────────────────────────────────────

function TransportBadge({ transport }: { transport: RoomTransport }) {
  const config = TRANSPORT_CONFIG[transport] || TRANSPORT_CONFIG.web;
  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium"
      style={{
        backgroundColor: `${config.color}18`,
        color: config.color,
        border: `1px solid ${config.color}30`,
      }}
      title={config.label}
    >
      <span aria-hidden="true">{config.icon}</span>
      <span className="hidden sm:inline">{config.label}</span>
    </span>
  );
}

// ─── Protocol Badge ─────────────────────────────────────────────────────────

function ProtocolIcon({ protocol }: { protocol: string }) {
  const config = TRANSPORT_CONFIG[protocol as RoomTransport];
  if (!config) return <span>🌐</span>;
  return (
    <span
      className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px]"
      style={{ backgroundColor: `${config.color}20` }}
      role="img"
      title={config.label}
      aria-label={config.label}
    >
      {config.icon}
    </span>
  );
}

// ─── Member Row ─────────────────────────────────────────────────────────────

function MemberRow({ member, isMe }: { member: RoomMember; isMe: boolean }) {
  const transportConfig = TRANSPORT_CONFIG[member.transport] || TRANSPORT_CONFIG.web;
  const joinedDate = new Date(member.joinedAt).toLocaleDateString();

  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-degen-500/5 transition-colors">
      {/* Avatar placeholder */}
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
        style={{ backgroundColor: `${transportConfig.color}20`, color: transportConfig.color }}
      >
        {(member.displayName || member.id).charAt(0).toUpperCase()}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium truncate">
            {member.displayName || shortId(member.id)}
          </span>
          {isMe && (
            <span className="text-[9px] px-1 py-0.5 rounded bg-degen-500/10 text-degen-400">
              you
            </span>
          )}
          {member.role === 'admin' && <span className="text-[9px] text-yellow-400">&#9733;</span>}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <TransportBadge transport={member.transport} />
          <span className="text-[9px] text-degen-400/50">Joined {joinedDate}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Message Bubble ─────────────────────────────────────────────────────────

function MessageBubble({ message, isMe }: { message: RoomMessage; isMe: boolean }) {
  const sourceConfig = TRANSPORT_CONFIG[message.sourceTransport] || TRANSPORT_CONFIG.web;

  // Check delivery status
  const deliveryInfo = message.deliveryStatus ? Object.values(message.deliveryStatus) : [];

  const failedCount = deliveryInfo.filter((d) => !d.ok && d.error !== 'pending').length;

  return (
    <div className={`flex ${isMe ? 'justify-end' : 'justify-start'} mb-3`}>
      <div
        className={`max-w-[80%] min-w-[120px] rounded-2xl px-3 py-2 ${
          isMe ? 'bg-degen-500/15 rounded-br-sm' : 'bg-degen-600/10 rounded-bl-sm'
        }`}
      >
        {/* Sender name (not me) */}
        {!isMe && (
          <div className="flex items-center gap-1.5 mb-1">
            <ProtocolIcon protocol={message.sourceTransport} />
            <span className="text-[10px] font-medium text-degen-400 truncate">
              {message.fromName || shortId(message.fromId)}
            </span>
          </div>
        )}

        {/* Message content */}
        <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{message.content}</p>

        {/* Delivery status and time */}
        <div className="flex items-center justify-end gap-1.5 mt-1">
          {/* Source protocol indicator */}
          <span
            className="text-[8px] px-1 py-0.5 rounded"
            style={{ color: sourceConfig.color, backgroundColor: `${sourceConfig.color}15` }}
          >
            {sourceConfig.icon} {sourceConfig.label}
          </span>

          {/* Time */}
          <span className="text-[9px] text-degen-400/40">{formatTime(message.createdAt)}</span>

          {/* Delivery status */}
          {isMe && failedCount > 0 && (
            <span className="text-[9px] text-red-400/60" title={`${failedCount} undelivered`}>
              &#9888;
            </span>
          )}
          {isMe && failedCount === 0 && (
            <span className="text-[9px] text-degen-400/40">&#10003;</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Invite Modal ───────────────────────────────────────────────────────────

function InviteModal({
  open,
  onClose,
  onInvite,
  inviting,
}: {
  open: boolean;
  onClose: () => void;
  onInvite: (target: string) => Promise<void>;
  inviting: boolean;
}) {
  const [target, setTarget] = useState('');
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setTarget('');
      setError(null);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  const handleSubmit = useCallback(async () => {
    if (!target.trim()) {
      setError('Enter a wallet address, npub, FID, DID, or handle');
      return;
    }
    setError(null);
    try {
      await onInvite(target.trim());
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invite failed');
    }
  }, [target, onInvite, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="bg-degen-900 border border-degen-700 rounded-2xl p-5 w-full max-w-sm mx-3 shadow-2xl"
      >
        <h3 className="text-sm font-semibold mb-1">Invite to Room</h3>
        <p className="text-[11px] text-degen-400/60 mb-4">
          Enter a wallet address, npub, Farcaster FID, Bluesky DID, or any handle
        </p>

        <input
          ref={inputRef}
          type="text"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          placeholder="e.g. 0x..., npub1..., @alice.bsky.social"
          className="w-full px-3 py-2 rounded-lg bg-degen-800 border border-degen-600 text-sm placeholder:text-degen-400/40 outline-none focus:border-degen-400 transition-colors"
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
        />

        {error && <p className="text-[11px] text-red-400 mt-2">{error}</p>}

        <div className="flex gap-2 mt-4">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-3 py-2 rounded-lg text-sm border border-degen-600 text-degen-300 hover:bg-degen-800 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={inviting || !target.trim()}
            className="flex-1 px-3 py-2 rounded-lg text-sm font-medium bg-degen-400 text-black hover:bg-degen-300 disabled:opacity-40 transition-colors"
          >
            {inviting ? 'Inviting…' : 'Send Invite'}
          </button>
        </div>

        {/* Quick tips */}
        <div className="mt-3 pt-3 border-t border-degen-700/50">
          <p className="text-[9px] text-degen-400/40 mb-1.5">Supported identifiers:</p>
          <div className="flex flex-wrap gap-1">
            {[
              { label: 'Wallet', example: '0x1234…' },
              { label: 'npub', example: 'npub1…' },
              { label: 'FID', example: '12345' },
              { label: 'DID', example: 'did:plc:…' },
              { label: 'Handle', example: '@alice.bsky.social' },
            ].map((item) => (
              <span
                key={item.label}
                className="px-1.5 py-0.5 rounded text-[8px] bg-degen-700/30 text-degen-400/50"
                title={item.example}
              >
                {item.label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Transport Selector ─────────────────────────────────────────────────────

function TransportSelector({
  current,
  onSelect,
}: {
  current: RoomTransport;
  onSelect: (t: RoomTransport) => void;
}) {
  return (
    <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-degen-800/50">
      <span className="text-[9px] text-degen-400/50 mr-1">via</span>
      {TRANSPORT_OPTIONS.map((opt) => (
        <button
          type="button"
          key={opt.id}
          onClick={() => onSelect(opt.id)}
          className={`px-2 py-1 rounded-md text-[10px] transition-colors ${
            current === opt.id
              ? 'bg-degen-500/20 text-degen-200 font-medium'
              : 'text-degen-400/50 hover:text-degen-300 hover:bg-degen-700/30'
          }`}
          title={opt.label}
        >
          {opt.icon} {opt.label}
        </button>
      ))}
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function RoomPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { tokens } = useAuth();
  const roomId = id ?? '';

  const [room, setRoom] = useState<RoomInfo | null>(null);
  const [messages, setMessages] = useState<RoomMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [composeText, setComposeText] = useState('');
  const [myTransport, setMyTransport] = useState<RoomTransport>('web');
  const [showInvite, setShowInvite] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // My user ID
  const myId = useMemo(
    () => [tokens.evmAddress, tokens.solanaAddress].filter(Boolean)[0] || '',
    [tokens],
  );

  // ── Fetch room data ──────────────────────────────────────────────
  const fetchRoom = useCallback(async () => {
    if (!roomId) return;
    setLoading(true);
    setError(null);
    try {
      const [roomRes, msgRes] = await Promise.all([
        fetch(`/api/rooms/unified/${roomId}`),
        fetch(`/api/rooms/unified/${roomId}/messages?limit=50`),
      ]);

      if (!roomRes.ok) {
        const err = await roomRes.json().catch(() => ({ error: 'Failed to load room' }));
        throw new Error(err.error || 'Room not found');
      }

      const roomData = (await roomRes.json()) as RoomInfo;
      setRoom(roomData);
      setMyTransport(roomData.myTransport || 'web');

      if (msgRes.ok) {
        const msgData = (await msgRes.json()) as { messages: RoomMessage[] };
        setMessages(msgData.messages || []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load room');
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  useEffect(() => {
    fetchRoom();
  }, [fetchRoom]);

  // ── Scroll to bottom on new messages ──────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // ── Poll for new messages ─────────────────────────────────────
  useEffect(() => {
    if (!roomId) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/rooms/unified/${roomId}/messages?limit=50`);
        if (res.ok) {
          const data = (await res.json()) as { messages: RoomMessage[] };
          setMessages((prev) => {
            const existingIds = new Set(prev.map((m) => m.id));
            const newMsgs = data.messages.filter((m) => !existingIds.has(m.id));
            if (newMsgs.length === 0) return prev;
            return [...prev, ...newMsgs];
          });
        }
      } catch {
        // Silently retry
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [roomId]);

  // ── Send message ─────────────────────────────────────────────
  const handleSend = useCallback(async () => {
    const text = composeText.trim();
    if (!text || sending || !roomId) return;

    setSending(true);
    try {
      const res = await fetch(`/api/rooms/unified/${roomId}/message`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          content: text,
          sourceTransport: myTransport,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Send failed' }));
        throw new Error(err.error || 'Send failed');
      }

      const data = (await res.json()) as {
        messageId: string;
        createdAt: number;
        deliveryStatus: Array<{
          memberId: string;
          transport: RoomTransport;
          ok: boolean;
          error?: string;
        }>;
      };

      // Build delivery status map
      const deliveryStatus: Record<string, MemberDeliveryStatus> = {};
      if (data.deliveryStatus) {
        for (const d of data.deliveryStatus) {
          deliveryStatus[d.memberId] = {
            transport: d.transport,
            ok: d.ok,
            error: d.error,
          };
        }
      }

      // Add message locally
      const newMsg: RoomMessage = {
        id: data.messageId,
        roomId,
        fromId: myId,
        fromName: room?.members.find((m) => m.id === myId)?.displayName || shortId(myId),
        content: text,
        createdAt: data.createdAt,
        sourceTransport: myTransport,
        deliveryStatus,
      };

      setMessages((prev) => [...prev, newMsg]);
      setComposeText('');
    } catch (err) {
      console.error('[room] send error:', err);
    } finally {
      setSending(false);
    }
  }, [composeText, sending, roomId, myTransport, myId, room]);

  // ── Invite ───────────────────────────────────────────────────
  const handleInvite = useCallback(
    async (target: string) => {
      setInviting(true);
      try {
        const res = await fetch(`/api/rooms/unified/${roomId}/invite`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ target }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: 'Invite failed' }));
          throw new Error(err.error || 'Invite failed');
        }
      } finally {
        setInviting(false);
      }
    },
    [roomId],
  );

  // ── Update transport ─────────────────────────────────────────
  const handleTransportChange = useCallback(
    async (transport: RoomTransport) => {
      setMyTransport(transport);
      try {
        await fetch(`/api/rooms/unified/${roomId}/transport`, {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ transport }),
        });
      } catch {
        // Best-effort
      }
    },
    [roomId],
  );

  // ── Leave room ──────────────────────────────────────────────
  const handleLeave = useCallback(async () => {
    if (!confirm('Leave this room?')) return;
    try {
      const res = await fetch(`/api/rooms/unified/${roomId}/leave`, {
        method: 'POST',
      });
      if (res.ok) {
        router.push('/messages');
      }
    } catch {
      // Silently fail
    }
  }, [roomId, router]);

  // ── Render states ──────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="flex flex-col items-center gap-3">
          <div className="w-6 h-6 border-2 border-degen-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-degen-400/50">Loading room…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <p className="text-sm text-red-400 mb-2">{error}</p>
          <button
            type="button"
            onClick={fetchRoom}
            className="px-3 py-1.5 rounded-lg text-sm border border-degen-600 hover:bg-degen-800 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-sm text-degen-400/50">Room not found</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-degen-950">
      {/* ── Header ────────────────────────────────────────────── */}
      <header className="shrink-0 border-b border-degen-800 bg-degen-900/80 backdrop-blur-sm">
        <div className="flex items-center gap-3 px-4 py-3">
          {/* Back */}
          <button
            type="button"
            onClick={() => router.push('/messages')}
            className="p-1.5 rounded-lg hover:bg-degen-800 transition-colors"
            aria-label="Back to messages"
          >
            <svg aria-hidden="true" width="18" height="18" viewBox="0 0 20 20" fill="none">
              <path
                d="M12 4l-6 6 6 6"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>

          {/* Room info */}
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-semibold truncate">{room.name}</h1>
            <p className="text-[10px] text-degen-400/50 truncate">
              {room.memberCount} member{room.memberCount !== 1 ? 's' : ''}
              {room.description ? ` · ${room.description}` : ''}
            </p>
          </div>

          {/* Member count toggle */}
          <button
            type="button"
            onClick={() => setShowMembers(!showMembers)}
            className="p-2 rounded-lg hover:bg-degen-800 transition-colors relative"
            aria-label="Toggle member list"
          >
            <svg aria-hidden="true" width="18" height="18" viewBox="0 0 20 20" fill="none">
              <circle cx="7" cy="6" r="2.5" stroke="currentColor" strokeWidth="1.3" />
              <circle cx="14" cy="6" r="2.5" stroke="currentColor" strokeWidth="1.3" />
              <path
                d="M2 16c0-2.5 2-4.5 5-4.5s5 2 5 4.5"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinecap="round"
              />
              <path
                d="M12 16c0-2.5 2-4.5 5-4.5s5 2 5 4.5"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinecap="round"
              />
            </svg>
            {room.memberCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-degen-400 text-black text-[7px] font-bold flex items-center justify-center">
                {room.memberCount}
              </span>
            )}
          </button>

          {/* Invite */}
          <button
            type="button"
            onClick={() => setShowInvite(true)}
            className="p-2 rounded-lg hover:bg-degen-800 transition-colors"
            aria-label="Invite to room"
          >
            <svg aria-hidden="true" width="18" height="18" viewBox="0 0 20 20" fill="none">
              <circle cx="10" cy="10" r="7.5" stroke="currentColor" strokeWidth="1.3" />
              <path
                d="M10 6.5v7M6.5 10h7"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinecap="round"
              />
            </svg>
          </button>

          {/* Leave */}
          <button
            type="button"
            onClick={handleLeave}
            className="p-2 rounded-lg hover:bg-red-900/30 transition-colors text-red-400/60 hover:text-red-400"
            aria-label="Leave room"
          >
            <svg aria-hidden="true" width="16" height="16" viewBox="0 0 20 20" fill="none">
              <path
                d="M8 3h8a1 1 0 011 1v12a1 1 0 01-1 1H8"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinecap="round"
              />
              <path
                d="M12 10H3m0 0l3-3m-3 3l3 3"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>

        {/* Active transports */}
        <div className="flex items-center gap-1 px-4 pb-2">
          {(Object.entries(room.transports) as Array<[RoomTransport, boolean]>)
            .filter(([, active]) => active)
            .map(([transport]) => (
              <TransportBadge key={transport} transport={transport} />
            ))}
        </div>
      </header>

      {/* ── Main Content ──────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Message area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="text-2xl mb-2">💬</div>
                <p className="text-xs text-degen-400/50">No messages yet</p>
                <p className="text-[10px] text-degen-400/30 mt-1">
                  Send a message to start the conversation
                </p>
              </div>
            ) : (
              messages.map((msg) => (
                <MessageBubble key={msg.id} message={msg} isMe={msg.fromId === myId} />
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Compose area */}
          <div className="shrink-0 border-t border-degen-800 bg-degen-900/50 px-4 py-3">
            {/* Transport selector */}
            <div className="mb-2">
              <TransportSelector current={myTransport} onSelect={handleTransportChange} />
            </div>

            <div className="flex items-end gap-2">
              <textarea
                value={composeText}
                onChange={(e) => setComposeText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder={`Message ${room.name}…  (Enter to send)`}
                rows={1}
                className="flex-1 px-3 py-2 rounded-xl bg-degen-800 border border-degen-700 text-sm placeholder:text-degen-400/30 outline-none resize-none focus:border-degen-400 transition-colors max-h-32"
              />
              <button
                type="button"
                onClick={handleSend}
                disabled={!composeText.trim() || sending}
                className="p-2.5 rounded-xl bg-degen-400 text-black hover:bg-degen-300 disabled:opacity-30 transition-colors shrink-0"
                aria-label="Send message"
              >
                {sending ? (
                  <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                ) : (
                  <svg aria-hidden="true" width="16" height="16" viewBox="0 0 20 20" fill="none">
                    <path d="M3 10l14-7-7 14-2-5-5-2z" fill="currentColor" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* ── Member panel ────────────────────────────────────── */}
        {showMembers && (
          <aside className="w-64 shrink-0 border-l border-degen-800 bg-degen-900/50 overflow-y-auto hidden md:block">
            <div className="p-3">
              <h3 className="text-[10px] font-semibold text-degen-400 uppercase tracking-wider mb-3">
                Members ({room.members.length})
              </h3>

              <div className="space-y-1">
                {room.members.map((member) => (
                  <MemberRow key={member.id} member={member} isMe={member.id === myId} />
                ))}
              </div>
            </div>
          </aside>
        )}
      </div>

      {/* ── Invite Modal ──────────────────────────────────────── */}
      <InviteModal
        open={showInvite}
        onClose={() => setShowInvite(false)}
        onInvite={handleInvite}
        inviting={inviting}
      />

      {/* Mobile member panel (overlay) */}
      {showMembers && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm md:hidden"
          onPointerDown={() => setShowMembers(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="absolute right-0 top-0 bottom-0 w-72 bg-degen-900 border-l border-degen-700 shadow-2xl overflow-y-auto"
          >
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-semibold text-degen-400 uppercase tracking-wider">
                  Members ({room.members.length})
                </h3>
                <button
                  type="button"
                  onClick={() => setShowMembers(false)}
                  className="p-1 rounded hover:bg-degen-800"
                >
                  <svg aria-hidden="true" width="16" height="16" viewBox="0 0 20 20" fill="none">
                    <path
                      d="M5 5l10 10M15 5l-10 10"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
              </div>
              <div className="space-y-1">
                {room.members.map((member) => (
                  <MemberRow key={member.id} member={member} isMe={member.id === myId} />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
