/**
 * Bluesky Jetstream Firehose Subscriber
 *
 * Real-time AT Protocol content via Bluesky's Jetstream WebSocket
 * (JSON — no CBOR decoding needed). Maintains a bounded ring buffer of
 * the most recent posts so the bluesky provider can surface live content
 * without hammering the public AppView.
 *
 * Jetstream docs: https://docs.bsky.app/docs/advanced-guides/jetstream
 * Endpoint: wss://jetstream2.us-east.bsky.network/subscribe
 *
 * The subscriber is lazy — it only opens the socket on first use, and
 * auto-reconnects with backoff. `getFirehosePosts()` returns the latest
 * posts that passed the crypto/category filter.
 */

import WebSocket from 'ws';
import type { UnifiedPost } from '../../server';
import { postToUnified } from './mapper';
import type { BskyPostView, JetstreamCommit } from './types';

const JETSTREAM_URL =
  process.env.BLUESKY_JETSTREAM_URL ||
  'wss://jetstream2.us-east.bsky.network/subscribe?wantedCollections=app.bsky.feed.post&maxMessageSizeBytes=1000000';

const MAX_BUFFER = 250;
const FILTER_TERMS =
  /(bitcoin|btc|ethereum|eth|solana|sol|crypto|defi|nft|web3|blockchain|ai|artificial|llm|meme|token|airdrop|staking|yield|liquidity|degen|trading|market|sec|etf)/i;

interface FirehoseState {
  ws: WebSocket | null;
  started: boolean;
  posts: UnifiedPost[];
  reconnectAttempts: number;
  lastError: string;
  connectedAt: number | null;
}

const state: FirehoseState = {
  ws: null,
  started: false,
  posts: [],
  reconnectAttempts: 0,
  lastError: '',
  connectedAt: null,
};

function jetstreamRecordToPostView(evt: JetstreamCommit): BskyPostView | null {
  const record = evt.commit.record;
  if (!record?.text?.trim()) return null;
  const rkey = evt.commit.rkey;
  return {
    uri: `at://${evt.did}/app.bsky.feed.post/${rkey}`,
    cid: evt.commit.cid || '',
    author: {
      did: evt.did,
      handle: evt.did.slice(0, 12),
      displayName: undefined,
    },
    record: {
      text: record.text,
      createdAt: record.createdAt || new Date().toISOString(),
      facets: record.facets || undefined,
      embed: record.embed ? (record.embed as BskyPostView['record']['embed']) : undefined,
      reply: record.reply,
    },
    likeCount: 0,
    repostCount: 0,
    replyCount: 0,
    indexedAt: new Date().toISOString(),
  };
}

function pushPost(post: UnifiedPost): void {
  // Keep the ring buffer bounded
  state.posts.unshift(post);
  if (state.posts.length > MAX_BUFFER) state.posts.length = MAX_BUFFER;
}

function handleMessage(data: unknown): void {
  try {
    const raw =
      typeof data === 'string'
        ? data
        : Buffer.isBuffer(data)
          ? data.toString('utf8')
          : ArrayBuffer.isView(data)
            ? Buffer.from(data.buffer, data.byteOffset, data.byteLength).toString('utf8')
            : String(data);
    const evt = JSON.parse(raw) as JetstreamCommit;
    if (evt.kind !== 'commit' || evt.commit.operation !== 'create') return;
    if (evt.commit.collection !== 'app.bsky.feed.post') return;

    const record = evt.commit.record;
    if (!record?.text) return;

    // Keep only relevant content for the DegenFeed audience.
    if (!FILTER_TERMS.test(record.text)) return;

    const postView = jetstreamRecordToPostView(evt);
    if (!postView) return;
    const unified = postToUnified(postView);
    if (!unified.text) return;

    // De-dupe against the buffer
    const key = unified.text.slice(0, 80);
    if (state.posts.some((p) => p.text.slice(0, 80) === key)) return;

    pushPost(unified);
  } catch {
    // Skip malformed frames
  }
}

function openSocket(): void {
  if (
    state.ws &&
    (state.ws.readyState === WebSocket.OPEN || state.ws.readyState === WebSocket.CONNECTING)
  ) {
    return;
  }
  try {
    state.ws = new WebSocket(JETSTREAM_URL);
  } catch {
    // WebSocket not available in this runtime
    state.lastError = 'WebSocket unavailable';
    return;
  }

  state.ws.addEventListener('open', () => {
    state.connectedAt = Date.now();
    state.reconnectAttempts = 0;
    console.log('[bluesky:firehose] Jetstream connected');
  });

  state.ws.addEventListener('message', (e: { data: unknown }) => handleMessage(e.data));

  state.ws.addEventListener('close', () => {
    state.connectedAt = null;
    state.ws = null;
    const backoff = Math.min(30_000, 1000 * 2 ** state.reconnectAttempts);
    state.reconnectAttempts += 1;
    console.log(`[bluesky:firehose] disconnected, reconnecting in ${backoff}ms`);
    setTimeout(openSocket, backoff);
  });

  state.ws.addEventListener('error', (e: { message?: string }) => {
    state.lastError = e.message || 'websocket error';
    console.log(`[bluesky:firehose] error: ${state.lastError}`);
  });
}

/** Ensure the firehose subscriber is running (lazy). */
export function startFirehose(): void {
  if (state.started) return;
  state.started = true;
  openSocket();
}

/**
 * Return the latest firehose posts, optionally filtered to a category
 * (image / video / link / text / all). Empty while disconnected.
 */
export function getFirehosePosts(limit = 25, category?: string): UnifiedPost[] {
  let posts = state.posts;
  if (category && category !== 'all') {
    posts = posts.filter((p) => p.embeds.some((e) => e.kind === category));
  }
  return posts.slice(0, limit);
}

export function firehoseStatus(): {
  connected: boolean;
  bufferSize: number;
  lastError: string;
  connectedAt: number | null;
} {
  return {
    connected: !!state.ws && state.ws.readyState === WebSocket.OPEN,
    bufferSize: state.posts.length,
    lastError: state.lastError,
    connectedAt: state.connectedAt,
  };
}
