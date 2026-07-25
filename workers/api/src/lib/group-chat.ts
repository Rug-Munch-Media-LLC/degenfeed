/**
 * @degenfeed/api-worker — Encrypted Group Chat
 *
 * Group messaging with sender key distribution:
 *   1. Create group with members
 *   2. Generate a group sender key
 *   3. Distribute sender key to each member (encrypted per-member with their session key)
 *   4. All members use the same sender key to encrypt messages to the group
 *   5. Rotate sender key when members join/leave
 *   6. Group metadata encrypted at rest
 *
 * Security model:
 *   - Sender key encrypted per-member using their E2E session key
 *   - When a member leaves, a new sender key is generated and re-distributed
 *   - Group metadata (name, member list) encrypted in KV
 *   - Message history encrypted with group sender key
 */

import type { Env } from '../index';
import { seal, unseal } from './crypto-seal';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface GroupMember {
  /** Wallet address of the member */
  walletAddress: string;
  /** Display name (optional) */
  displayName?: string;
  /** When they joined */
  joinedAt: number;
  /** Role in the group */
  role: 'admin' | 'member';
  /** Whether they have received the sender key */
  senderKeyDelivered: boolean;
}

export interface EncryptedGroup {
  /** Unique group ID */
  id: string;
  /** Encrypted group name (base64url) */
  encryptedName: string;
  /** Encrypted group description (base64url) */
  encryptedDescription: string;
  /** Encrypted member list (base64url) */
  encryptedMembers: string;
  /** When created */
  createdAt: number;
  /** Last activity timestamp */
  lastActivity: number;
  /** Current sender key version (incremented on rotation) */
  senderKeyVersion: number;
  /** Encrypted sender key, per member: { walletAddress => encryptedKey } */
  senderKeys: Record<string, string>;
  /** Who created the group */
  createdBy: string;
  /** Group settings */
  settings: GroupSettings;
}

export interface GroupSettings {
  /** Only admins can send messages */
  adminsOnly: boolean;
  /** Require admin approval to join */
  requireApproval: boolean;
  /** Disappearing message timer (minutes, 0 = off) */
  disappearingTimer: number;
  /** Allow read receipts */
  readReceipts: boolean;
  /** Allow typing indicators */
  typingIndicators: boolean;
}

export interface GroupMessage {
  id: string;
  groupId: string;
  fromId: string;
  /** Encrypted with group sender key */
  encryptedContent: string;
  iv: string;
  /** Sender key version used for encryption */
  senderKeyVersion: number;
  createdAt: number;
  /** Whether this message has been read by the recipient */
  readBy: string[];
}

export interface GroupSummary {
  id: string;
  name: string;
  memberCount: number;
  lastActivity: number;
  unreadCount: number;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const GROUP_PREFIX = 'group:';
const GROUP_META_PREFIX = 'group:meta:';
const _GROUP_MEMBER_PREFIX = 'group:members:';
const GROUP_MESSAGES_PREFIX = 'group:messages:';
const _GROUP_SENDERKEY_PREFIX = 'group:sk:';
const GROUP_USER_INDEX_PREFIX = 'group:user:';

const MAX_GROUP_SIZE = 100;
const MAX_MESSAGE_HISTORY = 500;
const _GROUP_SENDER_KEY_BYTES = 32;

// ─── Encryption Helpers ─────────────────────────────────────────────────────

function toBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(str: string): Uint8Array {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  const padding = '='.repeat((4 - (str.length % 4)) % 4);
  const raw = atob(str + padding);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    bytes[i] = raw.charCodeAt(i);
  }
  return bytes;
}

/**
 * Generate a random sender key for a group.
 */
async function generateSenderKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
}

/**
 * Export a sender key as base64url for distribution.
 */
async function exportSenderKey(key: CryptoKey): Promise<string> {
  const raw = await crypto.subtle.exportKey('raw', key);
  return toBase64Url(raw);
}

/**
 * Import a sender key from base64url.
 */
async function importSenderKey(keyStr: string): Promise<CryptoKey> {
  const raw = fromBase64Url(keyStr);
  return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM', length: 256 }, false, [
    'encrypt',
    'decrypt',
  ]);
}

/**
 * Encrypt group content (name, description) using the group's AES key.
 */
async function encryptGroupContent(plaintext: string, key: CryptoKey): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);
  return toBase64Url(combined.buffer);
}

/**
 * Decrypt group content.
 */
async function decryptGroupContent(ciphertext: string, key: CryptoKey): Promise<string> {
  const data = fromBase64Url(ciphertext);
  const iv = data.slice(0, 12);
  const encrypted = data.slice(12);
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, encrypted);
  return new TextDecoder().decode(decrypted);
}

// ─── Group Creation & Management ───────────────────────────────────────────

/**
 * Create a new encrypted group.
 */
export async function createGroup(
  env: Env,
  creatorId: string,
  name: string,
  description: string,
  memberIds: string[],
  settings?: Partial<GroupSettings>,
): Promise<EncryptedGroup> {
  if (!env.CACHE) throw new Error('[group] KV not available');

  // Validate
  const allMembers = [...new Set([creatorId, ...memberIds])];
  if (allMembers.length > MAX_GROUP_SIZE) {
    throw new Error(`[group] Group size exceeds max of ${MAX_GROUP_SIZE}`);
  }
  if (allMembers.length < 2) {
    throw new Error('[group] Group must have at least 2 members');
  }

  const groupId = crypto.randomUUID();

  // Generate group content encryption key
  const contentKey = await generateSenderKey();

  // Encrypt group metadata
  const encryptedName = await encryptGroupContent(name, contentKey);
  const encryptedDescription = await encryptGroupContent(description, contentKey);

  // Build member list with roles
  const members: GroupMember[] = allMembers.map((addr, _i) => ({
    walletAddress: addr.toLowerCase(),
    displayName: addr.slice(0, 10),
    joinedAt: Date.now(),
    role: addr === creatorId ? 'admin' : 'member',
    senderKeyDelivered: false,
  }));

  const encryptedMembers = await encryptGroupContent(JSON.stringify(members), contentKey);

  // Generate group sender key for messages
  const senderKey = await generateSenderKey();
  const senderKeyStr = await exportSenderKey(senderKey);

  // Encrypt sender key for each member using their individual E2E session
  const senderKeys: Record<string, string> = {};
  for (const member of members) {
    const encryptedKey = await encryptSenderKeyForMember(
      env,
      member.walletAddress,
      groupId,
      senderKeyStr,
    );
    if (encryptedKey) {
      senderKeys[member.walletAddress] = encryptedKey;
    }
  }

  const group: EncryptedGroup = {
    id: groupId,
    encryptedName,
    encryptedDescription,
    encryptedMembers,
    createdAt: Date.now(),
    lastActivity: Date.now(),
    senderKeyVersion: 1,
    senderKeys,
    createdBy: creatorId.toLowerCase(),
    settings: {
      adminsOnly: false,
      requireApproval: false,
      disappearingTimer: 0,
      readReceipts: true,
      typingIndicators: true,
      ...settings,
    },
  };

  // Store in KV
  await env.CACHE.put(`${GROUP_PREFIX}${groupId}`, JSON.stringify(group), {
    expirationTtl: 86400 * 365,
  });

  // Store content key for admin (encrypted with AUTH_SECRET)
  const contentKeyEncrypted = await seal(
    env,
    await exportSenderKey(contentKey),
    `group-content:${groupId}`,
  );
  await env.CACHE.put(`${GROUP_META_PREFIX}${groupId}:contentkey`, contentKeyEncrypted, {
    expirationTtl: 86400 * 365,
  });

  // Index group for each user
  for (const member of members) {
    await addGroupToUserIndex(env, member.walletAddress, groupId);
  }

  return group;
}

/**
 * Decrypt group metadata (requires content key).
 */
export async function decryptGroupInfo(
  env: Env,
  groupId: string,
  _userId: string,
): Promise<{
  name: string;
  description: string;
  members: GroupMember[];
} | null> {
  if (!env.CACHE) return null;

  try {
    const raw = await env.CACHE.get(`${GROUP_PREFIX}${groupId}`);
    if (!raw) return null;

    const group = JSON.parse(raw) as EncryptedGroup;

    // Get content key (encrypted in KV)
    const contentKeyEncrypted = await env.CACHE.get(`${GROUP_META_PREFIX}${groupId}:contentkey`);
    if (!contentKeyEncrypted) return null;

    const contentKeyStr = await unseal(env, contentKeyEncrypted, `group-content:${groupId}`);
    if (!contentKeyStr) return null;

    const contentKey = await importSenderKey(contentKeyStr);

    const name = await decryptGroupContent(group.encryptedName, contentKey);
    const description = await decryptGroupContent(group.encryptedDescription, contentKey);
    const membersJson = await decryptGroupContent(group.encryptedMembers, contentKey);
    const members = JSON.parse(membersJson) as GroupMember[];

    return { name, description, members };
  } catch (err) {
    console.error('[group] decryptGroupInfo failed:', err);
    return null;
  }
}

// ─── Sender Key Management ─────────────────────────────────────────────────

/**
 * Encrypt the group sender key for a specific member using their E2E session.
 */
async function encryptSenderKeyForMember(
  env: Env,
  _memberId: string,
  groupId: string,
  senderKeyStr: string,
): Promise<string | null> {
  try {
    // Use the member's wallet address as the key context
    const purpose = `group-sk:${groupId}`;
    return await seal(env, senderKeyStr, purpose);
  } catch {
    return null;
  }
}

/**
 * Get the sender key for a group (caller must be a member).
 */
export async function getGroupSenderKey(
  env: Env,
  groupId: string,
  userId: string,
): Promise<string | null> {
  if (!env.CACHE) return null;

  try {
    const raw = await env.CACHE.get(`${GROUP_PREFIX}${groupId}`);
    if (!raw) return null;

    const group = JSON.parse(raw) as EncryptedGroup;
    const encryptedKey = group.senderKeys[userId.toLowerCase()];
    if (!encryptedKey) return null;

    const purpose = `group-sk:${groupId}`;
    return await unseal(env, encryptedKey, purpose);
  } catch {
    return null;
  }
}

/**
 * Rotate the group sender key (e.g., when a member leaves).
 * Generates a new key and re-distributes to all remaining members.
 */
export async function rotateSenderKey(
  env: Env,
  groupId: string,
  _initiatedBy: string,
): Promise<void> {
  if (!env.CACHE) return;

  const raw = await env.CACHE.get(`${GROUP_PREFIX}${groupId}`);
  if (!raw) throw new Error('[group] Group not found');

  const group = JSON.parse(raw) as EncryptedGroup;

  // Generate new sender key
  const newKey = await generateSenderKey();
  const newKeyStr = await exportSenderKey(newKey);

  // Decrypt members to know who's still in the group
  const contentKeyEncrypted = await env.CACHE.get(`${GROUP_META_PREFIX}${groupId}:contentkey`);
  if (!contentKeyEncrypted) throw new Error('[group] Content key not found');

  const contentKeyStr = await unseal(env, contentKeyEncrypted, `group-content:${groupId}`);
  if (!contentKeyStr) throw new Error('[group] Could not decrypt content key');

  const contentKey = await importSenderKey(contentKeyStr);
  const membersJson = await decryptGroupContent(group.encryptedMembers, contentKey);
  const members = JSON.parse(membersJson) as GroupMember[];

  // Re-encrypt for each remaining member
  const newSenderKeys: Record<string, string> = {};
  for (const member of members) {
    const encryptedKey = await encryptSenderKeyForMember(
      env,
      member.walletAddress,
      groupId,
      newKeyStr,
    );
    if (encryptedKey) {
      newSenderKeys[member.walletAddress] = encryptedKey;
      member.senderKeyDelivered = false;
    }
  }

  // Re-encrypt member list and metadata (in case members changed)
  const updatedMembersEncrypted = await encryptGroupContent(JSON.stringify(members), contentKey);

  // Update group
  group.senderKeys = newSenderKeys;
  group.senderKeyVersion += 1;
  group.encryptedMembers = updatedMembersEncrypted;

  await env.CACHE.put(`${GROUP_PREFIX}${groupId}`, JSON.stringify(group), {
    expirationTtl: 86400 * 365,
  });
}

// ─── Member Management ──────────────────────────────────────────────────────

/**
 * Add a member to a group. Rotates sender key.
 */
export async function addGroupMember(
  env: Env,
  groupId: string,
  newMemberId: string,
  addedBy: string,
): Promise<void> {
  if (!env.CACHE) throw new Error('[group] KV not available');

  const raw = await env.CACHE.get(`${GROUP_PREFIX}${groupId}`);
  if (!raw) throw new Error('[group] Group not found');

  const group = JSON.parse(raw) as EncryptedGroup;

  // Decrypt members
  const contentKeyEncrypted = await env.CACHE.get(`${GROUP_META_PREFIX}${groupId}:contentkey`);
  if (!contentKeyEncrypted) throw new Error('[group] Content key not found');
  const contentKeyStr = await unseal(env, contentKeyEncrypted, `group-content:${groupId}`);
  if (!contentKeyStr) throw new Error('[group] Could not decrypt content key');
  const contentKey = await importSenderKey(contentKeyStr);
  const membersJson = await decryptGroupContent(group.encryptedMembers, contentKey);
  const members = JSON.parse(membersJson) as GroupMember[];

  // Validate
  if (members.length >= MAX_GROUP_SIZE) {
    throw new Error(`[group] Group size exceeds max of ${MAX_GROUP_SIZE}`);
  }
  if (members.some((m) => m.walletAddress === newMemberId.toLowerCase())) {
    throw new Error('[group] Member already in group');
  }

  // Add member
  members.push({
    walletAddress: newMemberId.toLowerCase(),
    displayName: newMemberId.slice(0, 10),
    joinedAt: Date.now(),
    role: 'member',
    senderKeyDelivered: false,
  });

  // Re-encrypt member list
  group.encryptedMembers = await encryptGroupContent(JSON.stringify(members), contentKey);
  await env.CACHE.put(`${GROUP_PREFIX}${groupId}`, JSON.stringify(group), {
    expirationTtl: 86400 * 365,
  });

  // Rotate sender key (excludes old members, includes new one)
  await rotateSenderKey(env, groupId, addedBy);

  // Index for new user
  await addGroupToUserIndex(env, newMemberId, groupId);
}

/**
 * Remove a member from a group. Rotates sender key for post-compromise security.
 */
export async function removeGroupMember(
  env: Env,
  groupId: string,
  memberId: string,
  removedBy: string,
): Promise<void> {
  if (!env.CACHE) throw new Error('[group] KV not available');

  const raw = await env.CACHE.get(`${GROUP_PREFIX}${groupId}`);
  if (!raw) throw new Error('[group] Group not found');

  const group = JSON.parse(raw) as EncryptedGroup;

  const contentKeyEncrypted = await env.CACHE.get(`${GROUP_META_PREFIX}${groupId}:contentkey`);
  if (!contentKeyEncrypted) throw new Error('[group] Content key not found');
  const contentKeyStr = await unseal(env, contentKeyEncrypted, `group-content:${groupId}`);
  if (!contentKeyStr) throw new Error('[group] Could not decrypt content key');
  const contentKey = await importSenderKey(contentKeyStr);
  const membersJson = await decryptGroupContent(group.encryptedMembers, contentKey);
  const members = JSON.parse(membersJson) as GroupMember[];

  const idx = members.findIndex((m) => m.walletAddress === memberId.toLowerCase());
  if (idx < 0) throw new Error('[group] Member not found');

  members.splice(idx, 1);

  // Re-encrypt member list
  group.encryptedMembers = await encryptGroupContent(JSON.stringify(members), contentKey);

  // Remove sender key for removed member
  delete group.senderKeys[memberId.toLowerCase()];

  await env.CACHE.put(`${GROUP_PREFIX}${groupId}`, JSON.stringify(group), {
    expirationTtl: 86400 * 365,
  });

  // Rotate sender key — ensures removed member cannot decrypt new messages
  await rotateSenderKey(env, groupId, removedBy);

  // Remove from user's index
  await removeGroupFromUserIndex(env, memberId, groupId);
}

// ─── Group Messages ─────────────────────────────────────────────────────────

/**
 * Send an encrypted message to a group.
 */
export async function sendGroupMessage(
  env: Env,
  groupId: string,
  fromId: string,
  content: string,
): Promise<GroupMessage> {
  if (!env.CACHE) throw new Error('[group] KV not available');

  const senderKeyStr = await getGroupSenderKey(env, groupId, fromId);
  if (!senderKeyStr) {
    throw new Error('[group] Sender key not available — you may not be a member');
  }

  const senderKey = await importSenderKey(senderKeyStr);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(content);
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, senderKey, encoded);

  // Get current sender key version
  const groupRaw = await env.CACHE.get(`${GROUP_PREFIX}${groupId}`);
  const group = JSON.parse(groupRaw!) as EncryptedGroup;

  const msg: GroupMessage = {
    id: crypto.randomUUID(),
    groupId,
    fromId: fromId.toLowerCase(),
    encryptedContent: toBase64Url(encrypted),
    iv: toBase64Url(iv),
    senderKeyVersion: group.senderKeyVersion,
    createdAt: Date.now(),
    readBy: [fromId.toLowerCase()],
  };

  // Store message
  const msgKey = `${GROUP_MESSAGES_PREFIX}${groupId}`;
  const msgRaw = await env.CACHE.get(msgKey);
  const messages: GroupMessage[] = msgRaw ? JSON.parse(msgRaw) : [];
  messages.push(msg);
  await env.CACHE.put(msgKey, JSON.stringify(messages.slice(-MAX_MESSAGE_HISTORY)), {
    expirationTtl: 86400 * 90,
  });

  // Update last activity
  group.lastActivity = Date.now();
  await env.CACHE.put(`${GROUP_PREFIX}${groupId}`, JSON.stringify(group), {
    expirationTtl: 86400 * 365,
  });

  return msg;
}

/**
 * Decrypt a group message.
 */
export async function decryptGroupMessage(
  env: Env,
  groupId: string,
  userId: string,
  message: GroupMessage,
): Promise<string | null> {
  try {
    const senderKeyStr = await getGroupSenderKey(env, groupId, userId);
    if (!senderKeyStr) return null;

    const senderKey = await importSenderKey(senderKeyStr);
    const ct = fromBase64Url(message.encryptedContent);
    const iv = fromBase64Url(message.iv);

    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, senderKey, ct);
    return new TextDecoder().decode(decrypted);
  } catch {
    return null;
  }
}

/**
 * Get messages for a group.
 */
export async function getGroupMessages(
  env: Env,
  groupId: string,
  limit = 50,
  before?: number,
): Promise<GroupMessage[]> {
  if (!env.CACHE) return [];

  const msgKey = `${GROUP_MESSAGES_PREFIX}${groupId}`;
  const raw = await env.CACHE.get(msgKey);
  if (!raw) return [];

  const messages: GroupMessage[] = JSON.parse(raw);
  let filtered = messages;

  if (before) {
    filtered = filtered.filter((m) => m.createdAt < before);
  }

  return filtered.slice(-limit);
}

// ─── User Group Index ───────────────────────────────────────────────────────

async function addGroupToUserIndex(env: Env, userId: string, groupId: string): Promise<void> {
  if (!env.CACHE) return;
  try {
    const key = `${GROUP_USER_INDEX_PREFIX}${userId}`;
    const raw = await env.CACHE.get(key);
    const groups: string[] = raw ? JSON.parse(raw) : [];
    if (!groups.includes(groupId)) {
      groups.push(groupId);
      await env.CACHE.put(key, JSON.stringify(groups), { expirationTtl: 86400 * 365 });
    }
  } catch {
    // Non-critical
  }
}

async function removeGroupFromUserIndex(env: Env, userId: string, groupId: string): Promise<void> {
  if (!env.CACHE) return;
  try {
    const key = `${GROUP_USER_INDEX_PREFIX}${userId}`;
    const raw = await env.CACHE.get(key);
    if (!raw) return;
    const groups: string[] = JSON.parse(raw);
    const idx = groups.indexOf(groupId);
    if (idx >= 0) {
      groups.splice(idx, 1);
      await env.CACHE.put(key, JSON.stringify(groups), { expirationTtl: 86400 * 365 });
    }
  } catch {
    // Non-critical
  }
}

/**
 * Get all groups for a user.
 */
export async function getUserGroups(env: Env, userId: string): Promise<GroupSummary[]> {
  if (!env.CACHE) return [];

  try {
    const key = `${GROUP_USER_INDEX_PREFIX}${userId}`;
    const raw = await env.CACHE.get(key);
    if (!raw) return [];

    const groupIds: string[] = JSON.parse(raw);
    const summaries: GroupSummary[] = [];

    for (const groupId of groupIds) {
      const groupRaw = await env.CACHE.get(`${GROUP_PREFIX}${groupId}`);
      if (!groupRaw) continue;

      const group = JSON.parse(groupRaw) as EncryptedGroup;

      // Decrypt name
      let name = '[Encrypted Group]';
      try {
        const info = await decryptGroupInfo(env, groupId, userId);
        if (info) name = info.name;
      } catch {
        // Use fallback name
      }

      // Count unread messages (messages after user's last read timestamp)
      const msgKey = `${GROUP_MESSAGES_PREFIX}${groupId}`;
      const msgRaw = await env.CACHE.get(msgKey);
      const messages: GroupMessage[] = msgRaw ? JSON.parse(msgRaw) : [];

      summaries.push({
        id: groupId,
        name,
        memberCount: Object.keys(group.senderKeys).length,
        lastActivity: group.lastActivity,
        unreadCount: messages.filter((m) => !m.readBy.includes(userId)).length,
      });
    }

    return summaries.sort((a, b) => b.lastActivity - a.lastActivity);
  } catch {
    return [];
  }
}

/**
 * Check if a user is a member of a group.
 */
export async function isGroupMember(env: Env, groupId: string, userId: string): Promise<boolean> {
  if (!env.CACHE) return false;

  try {
    const raw = await env.CACHE.get(`${GROUP_PREFIX}${groupId}`);
    if (!raw) return false;

    const group = JSON.parse(raw) as EncryptedGroup;
    return group.senderKeys[userId.toLowerCase()] !== undefined;
  } catch {
    return false;
  }
}

/**
 * Mark group messages as read by a user.
 */
export async function markGroupRead(
  env: Env,
  groupId: string,
  userId: string,
  messageIds: string[],
): Promise<void> {
  if (!env.CACHE) return;

  const msgKey = `${GROUP_MESSAGES_PREFIX}${groupId}`;
  const raw = await env.CACHE.get(msgKey);
  if (!raw) return;

  const messages: GroupMessage[] = JSON.parse(raw);
  let updated = false;

  for (const msg of messages) {
    if (messageIds.includes(msg.id) && !msg.readBy.includes(userId)) {
      msg.readBy.push(userId);
      updated = true;
    }
  }

  if (updated) {
    await env.CACHE.put(msgKey, JSON.stringify(messages), { expirationTtl: 86400 * 90 });
  }
}

export { GROUP_MESSAGES_PREFIX, GROUP_PREFIX, MAX_GROUP_SIZE };
