/**
 * @degenfeed/realtime — Unified Chat Inbox
 *
 * Aggregates ALL messages from ALL protocols into ONE unified inbox.
 * Protocol badges for: Nostr, Farcaster, Bluesky, Mastodon, Matrix, Telegram,
 * Lens, Discord, IRC, XMPP, Rocket.Chat.
 *
 * Features: delivery status, read receipts, typing indicators, reactions,
 * reply/thread, offline queue with auto-retry.
 */

import type { TransportProtocol } from './protocol-transports';

export type { TransportProtocol };

export interface InboxMessage {
  id: string;
  fromId: string;
  fromName?: string;
  fromAvatar?: string;
  fromHandle?: string;
  protocol: TransportProtocol;
  protocolBadge: ProtocolBadge;
  toId: string;
  body: string;
  encryptedBlob?: string;
  encrypted: boolean;
  createdAt: number;
  deliveryStatus: DeliveryStatusMap;
  read: boolean;
  readBy: string[];
  readAt?: number;
  replyTo?: string;
  threadRootId?: string;
  threadReplyCount?: number;
  reactions: InboxReaction[];
  contentType?: 'text' | 'image' | 'link' | 'audio' | 'video' | 'file';
  mediaUrl?: string;
  mediaType?: string;
  forwardedFrom?: string;
  deleted: boolean;
}

export interface ProtocolBadge {
  id: string;
  label: string;
  color: string;
  icon: string;
}

export interface DeliveryStatusMap {
  [protocol: string]: 'sent' | 'delivered' | 'read' | 'failed' | 'pending';
}

export interface InboxReaction {
  userId: string;
  emoji: string;
  timestamp: number;
}

export interface InboxThread {
  rootId: string;
  messages: InboxMessage[];
  participantCount: number;
  lastActivity: number;
}

export interface InboxSummary {
  conversationId: string;
  otherUserId: string;
  otherUserName?: string;
  otherUserAvatar?: string;
  lastMessage?: InboxMessage;
  unreadCount: number;
  activeProtocols: TransportProtocol[];
  lastActivity: number;
  isTyping: boolean;
  typingUserId?: string;
}

export const PROTOCOL_BADGES: Record<string, ProtocolBadge> = {
  nostr: { id: 'nostr', label: 'Nostr', color: '#8b5cf6', icon: 'zap' },
  farcaster: { id: 'farcaster', label: 'Farcaster', color: '#6A47E4', icon: 'fc' },
  bluesky: { id: 'bluesky', label: 'Bluesky', color: '#0285FF', icon: 'cloud' },
  mastodon: { id: 'mastodon', label: 'Mastodon', color: '#6364FF', icon: 'mastodon' },
  matrix: { id: 'matrix', label: 'Matrix', color: '#0DBD8B', icon: 'message-square' },
  telegram: { id: 'telegram', label: 'Telegram', color: '#0088cc', icon: 'send' },
  lens: { id: 'lens', label: 'Lens', color: '#ABFE2C', icon: 'lens' },
  discord: { id: 'discord', label: 'Discord', color: '#5865F2', icon: 'discord' },
  irc: { id: 'irc', label: 'IRC', color: '#FF6600', icon: 'terminal' },
  xmpp: { id: 'xmpp', label: 'XMPP', color: '#0022FF', icon: 'message-circle' },
  rocketchat: { id: 'rocketchat', label: 'Rocket.Chat', color: '#F5455C', icon: 'discord' },
  nwc: { id: 'nwc', label: 'NWC', color: '#9945FF', icon: 'zap' },
  'direct-ws': { id: 'direct-ws', label: 'Direct', color: '#22c55e', icon: 'wifi' },
  wallet: { id: 'wallet', label: 'Wallet', color: '#f59e0b', icon: 'wallet' },
  xmtp: { id: 'xmtp', label: 'XMTP', color: '#FF6B00', icon: 'x' },
  'nostr-group': { id: 'nostr-group', label: 'Nostr Group', color: '#7c3aed', icon: 'users' },
};

export function getProtocolBadge(protocol: string): ProtocolBadge {
  return (
    PROTOCOL_BADGES[protocol] ?? {
      id: protocol as TransportProtocol,
      label: protocol.charAt(0).toUpperCase() + protocol.slice(1),
      color: '#6b7280',
      icon: 'message-circle',
    }
  );
}

export class UnifiedInbox {
  async storeMessage(env: { CACHE?: any }, message: InboxMessage): Promise<void> {
    if (!env.CACHE) return;
    try {
      const inboxKey = `unified-inbox:${message.toId}`;
      const raw = await env.CACHE.get(inboxKey);
      const inbox: InboxMessage[] = raw ? JSON.parse(raw) : [];
      if (!inbox.some((m) => m.id === message.id)) {
        inbox.push(message);
        await env.CACHE.put(inboxKey, JSON.stringify(inbox.slice(-1000)), {
          expirationTtl: 86400 * 90,
        });
      }
      const convId = this.buildConversationId(message.fromId, message.toId);
      const convKey = `unified-conv:${convId}`;
      const convRaw = await env.CACHE.get(convKey);
      const conv: InboxMessage[] = convRaw ? JSON.parse(convRaw) : [];
      if (!conv.some((m) => m.id === message.id)) {
        conv.push(message);
        await env.CACHE.put(convKey, JSON.stringify(conv.slice(-2000)), {
          expirationTtl: 86400 * 90,
        });
      }
    } catch {}
  }

  async markAsRead(
    env: { CACHE?: any },
    userId: string,
    conversationId: string,
    messageIds?: string[],
  ): Promise<void> {
    if (!env.CACHE) return;
    try {
      const convKey = `unified-conv:${conversationId}`;
      const raw = await env.CACHE.get(convKey);
      if (!raw) return;
      const conv: InboxMessage[] = JSON.parse(raw);
      let updated = false;
      for (const msg of conv) {
        if (msg.toId !== userId) continue;
        if (messageIds && !messageIds.includes(msg.id)) continue;
        if (!msg.read) {
          msg.read = true;
          msg.readAt = Date.now();
          updated = true;
        }
        if (!msg.readBy.includes(userId)) {
          msg.readBy.push(userId);
          updated = true;
        }
      }
      if (updated) {
        await env.CACHE.put(convKey, JSON.stringify(conv), { expirationTtl: 86400 * 90 });
        const inboxKey = `unified-inbox:${userId}`;
        const inboxRaw = await env.CACHE.get(inboxKey);
        if (inboxRaw) {
          const inbox: InboxMessage[] = JSON.parse(inboxRaw);
          for (const msg of inbox) {
            if (messageIds && !messageIds.includes(msg.id)) continue;
            if (msg.toId === userId && !msg.read) {
              msg.read = true;
              msg.readAt = Date.now();
            }
          }
          await env.CACHE.put(inboxKey, JSON.stringify(inbox), { expirationTtl: 86400 * 90 });
        }
      }
    } catch {}
  }

  async getUnreadCount(
    env: { CACHE?: any },
    userId: string,
    conversationId?: string,
  ): Promise<number> {
    if (!env.CACHE) return 0;
    try {
      if (conversationId) {
        const convKey = `unified-conv:${conversationId}`;
        const raw = await env.CACHE.get(convKey);
        if (!raw) return 0;
        return (JSON.parse(raw) as InboxMessage[]).filter((m) => m.toId === userId && !m.read)
          .length;
      }
      const inboxKey = `unified-inbox:${userId}`;
      const raw = await env.CACHE.get(inboxKey);
      if (!raw) return 0;
      return (JSON.parse(raw) as InboxMessage[]).filter((m) => m.toId === userId && !m.read).length;
    } catch {
      return 0;
    }
  }

  async toggleReaction(
    env: { CACHE?: any },
    conversationId: string,
    messageId: string,
    userId: string,
    emoji: string,
  ): Promise<InboxReaction[] | null> {
    if (!env.CACHE) return null;
    try {
      const convKey = `unified-conv:${conversationId}`;
      const raw = await env.CACHE.get(convKey);
      if (!raw) return null;
      const conv: InboxMessage[] = JSON.parse(raw);
      const msg = conv.find((m) => m.id === messageId);
      if (!msg) return null;
      const existingIdx = msg.reactions.findIndex((r) => r.userId === userId && r.emoji === emoji);
      if (existingIdx >= 0) msg.reactions.splice(existingIdx, 1);
      else msg.reactions.push({ userId, emoji, timestamp: Date.now() });
      await env.CACHE.put(convKey, JSON.stringify(conv), { expirationTtl: 86400 * 90 });
      for (const partyId of [msg.fromId, msg.toId]) {
        const inboxKey = `unified-inbox:${partyId}`;
        const inboxRaw = await env.CACHE.get(inboxKey);
        if (inboxRaw) {
          const inbox: InboxMessage[] = JSON.parse(inboxRaw);
          const inboxMsg = inbox.find((m) => m.id === messageId);
          if (inboxMsg) inboxMsg.reactions = msg.reactions;
          await env.CACHE.put(inboxKey, JSON.stringify(inbox), { expirationTtl: 86400 * 90 });
        }
      }
      return msg.reactions;
    } catch {
      return null;
    }
  }

  async updateDeliveryStatus(
    env: { CACHE?: any },
    conversationId: string,
    messageId: string,
    protocol: string,
    status: 'sent' | 'delivered' | 'read' | 'failed',
  ): Promise<void> {
    if (!env.CACHE) return;
    try {
      const convKey = `unified-conv:${conversationId}`;
      const raw = await env.CACHE.get(convKey);
      if (!raw) return;
      const conv: InboxMessage[] = JSON.parse(raw);
      const msg = conv.find((m) => m.id === messageId);
      if (!msg) return;
      msg.deliveryStatus[protocol] = status;
      await env.CACHE.put(convKey, JSON.stringify(conv), { expirationTtl: 86400 * 90 });
    } catch {}
  }

  async getThread(
    env: { CACHE?: any },
    conversationId: string,
    rootMessageId: string,
  ): Promise<InboxMessage[]> {
    if (!env.CACHE) return [];
    try {
      const convKey = `unified-conv:${conversationId}`;
      const raw = await env.CACHE.get(convKey);
      if (!raw) return [];
      return (JSON.parse(raw) as InboxMessage[])
        .filter((m) => m.id === rootMessageId || m.threadRootId === rootMessageId)
        .sort((a, b) => a.createdAt - b.createdAt);
    } catch {
      return [];
    }
  }

  async getConversations(env: { CACHE?: any }, userId: string): Promise<InboxSummary[]> {
    if (!env.CACHE) return [];
    try {
      const inboxKey = `unified-inbox:${userId}`;
      const raw = await env.CACHE.get(inboxKey);
      if (!raw) return [];
      const inbox: InboxMessage[] = JSON.parse(raw);
      const convMap = new Map<string, InboxMessage[]>();
      for (const msg of inbox) {
        const convId = this.buildConversationId(msg.fromId, msg.toId);
        const existing = convMap.get(convId) ?? [];
        existing.push(msg);
        convMap.set(convId, existing);
      }
      const summaries: InboxSummary[] = [];
      for (const [convId, messages] of convMap) {
        messages.sort((a, b) => b.createdAt - a.createdAt);
        const [partyA, partyB] = convId.split(':');
        const otherUserId = partyA === userId ? partyB : partyA;
        const lastMessage = messages[0];
        summaries.push({
          conversationId: convId,
          otherUserId,
          otherUserName: lastMessage?.fromName,
          otherUserAvatar: lastMessage?.fromAvatar,
          lastMessage,
          unreadCount: messages.filter((m) => m.toId === userId && !m.read).length,
          activeProtocols: [...new Set(messages.map((m) => m.protocol))],
          lastActivity: lastMessage?.createdAt ?? 0,
          isTyping: false,
        });
      }
      return summaries.sort((a, b) => b.lastActivity - a.lastActivity);
    } catch {
      return [];
    }
  }

  async getConversation(
    env: { CACHE?: any },
    conversationId: string,
    limit = 50,
    before?: number,
  ): Promise<InboxMessage[]> {
    if (!env.CACHE) return [];
    try {
      const convKey = `unified-conv:${conversationId}`;
      const raw = await env.CACHE.get(convKey);
      if (!raw) return [];
      let conv: InboxMessage[] = JSON.parse(raw);
      if (before) conv = conv.filter((m) => m.createdAt < before);
      return conv.slice(-limit);
    } catch {
      return [];
    }
  }

  async getMessage(
    env: { CACHE?: any },
    conversationId: string,
    messageId: string,
  ): Promise<InboxMessage | null> {
    if (!env.CACHE) return null;
    try {
      const convKey = `unified-conv:${conversationId}`;
      const raw = await env.CACHE.get(convKey);
      if (!raw) return null;
      return (JSON.parse(raw) as InboxMessage[]).find((m) => m.id === messageId) ?? null;
    } catch {
      return null;
    }
  }

  async deleteMessage(
    env: { CACHE?: any },
    conversationId: string,
    messageId: string,
    userId: string,
  ): Promise<boolean> {
    if (!env.CACHE) return false;
    try {
      const convKey = `unified-conv:${conversationId}`;
      const raw = await env.CACHE.get(convKey);
      if (!raw) return false;
      const conv: InboxMessage[] = JSON.parse(raw);
      const msg = conv.find((m) => m.id === messageId);
      if (!msg || msg.fromId !== userId) return false;
      msg.deleted = true;
      msg.body = '[deleted]';
      await env.CACHE.put(convKey, JSON.stringify(conv), { expirationTtl: 86400 * 90 });
      return true;
    } catch {
      return false;
    }
  }

  createInboxMessage(params: {
    id: string;
    fromId: string;
    fromName?: string;
    fromAvatar?: string;
    toId: string;
    body: string;
    encryptedBlob?: string;
    encrypted?: boolean;
    protocol: TransportProtocol;
    createdAt?: number;
    replyTo?: string;
    threadRootId?: string;
    contentType?: 'text' | 'image' | 'link' | 'audio' | 'video' | 'file';
    mediaUrl?: string;
  }): InboxMessage {
    const badge = getProtocolBadge(params.protocol);
    const now = params.createdAt ?? Date.now();
    return {
      id: params.id,
      fromId: params.fromId,
      fromName: params.fromName,
      fromAvatar: params.fromAvatar,
      fromHandle: badge.label === 'Wallet' ? params.fromId.slice(0, 10) : undefined,
      protocol: params.protocol,
      protocolBadge: badge,
      toId: params.toId,
      body: params.body,
      encryptedBlob: params.encryptedBlob,
      encrypted: params.encrypted ?? !!params.encryptedBlob,
      createdAt: now,
      deliveryStatus: {},
      read: false,
      readBy: [],
      reactions: [],
      deleted: false,
      replyTo: params.replyTo,
      threadRootId: params.threadRootId,
      contentType: params.contentType,
      mediaUrl: params.mediaUrl,
    };
  }

  private buildConversationId(idA: string, idB: string): string {
    const sorted = [idA.toLowerCase(), idB.toLowerCase()].sort();
    return `${sorted[0]}:${sorted[1]}`;
  }
}

let _inboxInstance: UnifiedInbox | null = null;
export function getInbox(): UnifiedInbox {
  if (!_inboxInstance) _inboxInstance = new UnifiedInbox();
  return _inboxInstance;
}
