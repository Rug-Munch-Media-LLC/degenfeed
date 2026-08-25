/**
 * @degenfeed/api-worker — Universal Inbox Utilities
 *
 * Shared helpers for KV operations, pagination, HTML stripping, and protocol formatting.
 */

import type { Protocol } from '@degenfeed/types';
import type { Env } from '../../index';
import { kvGetJson } from '../kv-json';
import { MAX_INBOX_AGE_MS, MAX_INBOX_ITEMS, PROTOCOL_LABELS } from './constants';
import type { InboxFeed, InboxItem, InboxItemKind } from './types';

// ─── HTML Stripping ───────────────────────────────────────────────────────

export function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ─── Protocol Label ──────────────────────────────────────────────────────

export function formatProtocol(p: string): string {
  return PROTOCOL_LABELS[p] ?? p.charAt(0).toUpperCase() + p.slice(1);
}

// ─── KV Helpers ──────────────────────────────────────────────────────────

export async function getInboxItems(env: Env, key: string): Promise<InboxItem[]> {
  if (!env.CACHE) return [];
  try {
    const raw = await env.CACHE.get(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as InboxItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function saveInboxItems(env: Env, key: string, items: InboxItem[]): Promise<void> {
  if (!env.CACHE) return;
  try {
    const now = Date.now();
    const valid = items.filter((i) => now - i.createdAt < MAX_INBOX_AGE_MS).slice(-MAX_INBOX_ITEMS);
    await env.CACHE.put(key, JSON.stringify(valid), {
      expirationTtl: Math.ceil(MAX_INBOX_AGE_MS / 1000),
    });
  } catch (e) {
    console.error('[universal-inbox] KV save failed:', e);
  }
}

export async function upsertInboxItem(env: Env, key: string, newItem: InboxItem): Promise<void> {
  const items = await getInboxItems(env, key);
  const existingIdx = items.findIndex((i) => i.id === newItem.id);
  if (existingIdx >= 0) {
    items[existingIdx] = { ...items[existingIdx], ...newItem, read: newItem.read };
  } else {
    items.push(newItem);
  }
  items.sort((a, b) => b.createdAt - a.createdAt);
  await saveInboxItems(env, key, items);
}

// ─── User Linked Protocols ──────────────────────────────────────────────

export async function getUserLinkedProtocols(
  walletAddress: string,
  env: Env,
): Promise<
  Record<
    string,
    {
      id: string;
      auth?: Record<string, string>;
      handle?: string;
      displayName?: string;
      avatarUrl?: string;
      linkedAt: number;
    }
  >
> {
  const result: Record<
    string,
    {
      id: string;
      auth?: Record<string, string>;
      handle?: string;
      displayName?: string;
      avatarUrl?: string;
      linkedAt: number;
    }
  > = {};

  try {
    if (env.CACHE) {
      const identityRaw = (await kvGetJson(env.CACHE, `identity:${walletAddress}`)) as Record<
        string,
        {
          id: string;
          auth?: Record<string, string>;
          handle?: string;
          displayName?: string;
          avatarUrl?: string;
          linkedAt?: number;
        }
      > | null;
      if (identityRaw) {
        for (const [protocol, info] of Object.entries(identityRaw)) {
          result[protocol] = {
            id: info.id ?? '',
            auth: info.auth,
            handle: info.handle,
            displayName: info.displayName,
            avatarUrl: info.avatarUrl,
            linkedAt: info.linkedAt ?? Date.now(),
          };
        }
      }
    }

    if (!result.nostr) {
      result.nostr = {
        id: walletAddress,
        handle: walletAddress.slice(0, 12),
        linkedAt: Date.now(),
      };
    }
  } catch {
    result.nostr = { id: walletAddress, handle: walletAddress.slice(0, 12), linkedAt: Date.now() };
  }

  return result;
}

// ─── Pagination ───────────────────────────────────────────────────────────

export function paginateInbox(
  items: InboxItem[],
  limit: number,
  cursor?: string,
  includeRead?: boolean,
  kindFilter?: InboxItemKind,
): InboxFeed {
  let filtered = items;

  if (!includeRead) {
    filtered = filtered.filter((i) => !i.read);
  }

  if (kindFilter) {
    filtered = filtered.filter((i) => i.kind === kindFilter);
  }

  if (cursor) {
    const cursorTime = Number.parseInt(cursor, 10);
    if (!Number.isNaN(cursorTime)) {
      const cursorIdx = filtered.findIndex((i) => i.createdAt <= cursorTime);
      if (cursorIdx >= 0) {
        filtered = filtered.slice(cursorIdx);
      }
    }
  }

  const page = filtered.slice(0, limit);
  const nextCursor =
    filtered.length > limit ? String(page[page.length - 1]?.createdAt ?? '') : undefined;

  const byKind: Partial<Record<InboxItemKind, number>> = {};
  const byProtocol: Partial<Record<Protocol, number>> = {};
  for (const item of page) {
    byKind[item.kind] = (byKind[item.kind] ?? 0) + 1;
    byProtocol[item.protocol] = (byProtocol[item.protocol] ?? 0) + 1;
  }

  return {
    items: page,
    meta: {
      total: filtered.length,
      unread: page.filter((i) => !i.read).length,
      byKind,
      byProtocol,
      nextCursor,
      fetchedAt: Date.now(),
    },
  };
}
