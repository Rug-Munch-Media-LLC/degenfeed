/**
 * @degenfeed/api-worker — Universal Inbox Protocol Fetchers
 *
 * All protocol-specific data fetchers for the unified inbox.
 * Each function fetches messages, comments, replies, and notifications
 * from a specific decentralized/centralized protocol.
 */

import type { Env } from '../../types';
import type { InboxItem, InboxItemKind } from './types';
import { stripHtml } from './utils';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// NOSTR
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const NOSTR_RELAYS = ['wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.primal.net'];

function nostrFetch(items: InboxItem[], relayUrl: string, subId: string, filters: Record<string, unknown>): Promise<InboxItem[]> {

export async function fetchNostrDMs(pubkey: string, _auth?: Record<string, string>): Promise<InboxItem[]> {

export async function fetchNostrReplies(pubkey: string, _auth?: Record<string, string>): Promise<InboxItem[]> {

export async function fetchNostrNotifications(pubkey: string, _auth?: Record<string, string>): Promise<InboxItem[]> {

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MATRIX
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export async function fetchMatrixDMs(
  userId: string, auth?: Record<string, string>, env?: Env,
): Promise<InboxItem[]> {

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MASTODON
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function mastodonFetch(path: string, instance: string, token: string): Promise<Response | null> {

export async function fetchMastodonDMs(_userId: string, auth?: Record<string, string>): Promise<InboxItem[]> {

export async function fetchMastodonReplies(_userId: string, auth?: Record<string, string>): Promise<InboxItem[]> {

export async function fetchMastodonNotifications(_userId: string, auth?: Record<string, string>): Promise<InboxItem[]> {

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// BLUESKY
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export async function fetchBlueskyDMs(did: string, auth?: Record<string, string>): Promise<InboxItem[]> {

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// FARCASTER
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function getNumericFid(fid: number | string): number {

export async function fetchFarcasterDMs(fid: number | string, auth?: Record<string, string>): Promise<InboxItem[]> {

export async function fetchFarcasterReplies(fid: number | string, auth?: Record<string, string>): Promise<InboxItem[]> {

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PEERTUBE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export async function fetchPeerTubeComments(userId: string, auth?: Record<string, string>): Promise<InboxItem[]> {

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// LEMMY
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export async function fetchLemmyComments(_userId: string, auth?: Record<string, string>): Promise<InboxItem[]> {

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PIXELFED
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export async function fetchPixelfedComments(_userId: string, auth?: Record<string, string>): Promise<InboxItem[]> {

