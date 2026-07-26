/**
 * @degenfeed/api-worker — Universal Inbox Utilities
 *
 * Shared helpers for KV operations, pagination, HTML stripping, and protocol formatting.
 */

import type { Protocol } from '@degenfeed/types';
import type { Env } from '../../types';
import { DEFAULT_PAGE_SIZE, MAX_INBOX_AGE_MS, MAX_INBOX_ITEMS, PROTOCOL_CAPABILITIES, PROTOCOL_LABELS } from './constants';
import type { InboxFeed, InboxItem, InboxItemKind } from './types';

// ─── HTML Stripping ───────────────────────────────────────────────────────

export function stripHtml(html: string): string {

// ─── Protocol Label ──────────────────────────────────────────────────────

export function formatProtocol(p: string): string {

// ─── KV Helpers ──────────────────────────────────────────────────────────

export async function getInboxItems(env: Env, key: string): Promise<InboxItem[]> {

export async function saveInboxItems(env: Env, key: string, items: InboxItem[]): Promise<void> {

export async function upsertInboxItem(env: Env, key: string, newItem: InboxItem): Promise<void> {

// ─── User Linked Protocols ──────────────────────────────────────────────

export async function getUserLinkedProtocols(
  walletAddress: string,
  env: Env,
): Promise<
  Record<
    string,
    {
  >
> {

// ─── Pagination ───────────────────────────────────────────────────────────

export function paginateInbox(
  items: InboxItem[],
  limit: number,
  cursor?: string,
  includeRead?: boolean,
  kindFilter?: InboxItemKind,
): InboxFeed {

