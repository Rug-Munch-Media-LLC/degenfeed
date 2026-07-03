/**
 * NIP-46: Nostr Remote Signer.
 *
 * Minimal implementation for connecting to a NIP-46 signer (Amber, nsecBunker).
 * Uses a local ephemeral key for encrypted communication.
 *
 * Full spec: https://github.com/nostr-protocol/nips/blob/master/46.md
 */

import { generateSecretKey, getPublicKey, signEvent } from './event';

interface Nip46Session {
  remotePubkey: string;
  localSecretKey: string;
  localPubkey: string;
  relayUrl: string;
  /** Resolves when the connection is established. */
  ready: Promise<void>;
  resolveReady: () => void;
  pendingRequests: Map<string, { resolve: (v: unknown) => void; reject: (e: Error) => void }>;
  ws: WebSocket | null;
  connected: boolean;
}

/**
 * Options for connecting to a NIP-46 remote signer.
 */
export interface Nip46ConnectOptions {
  /** The relay URL where the signer listens. */
  relayUrl: string;
  /** The signer's pubkey (from the bunker:// URI). */
  remotePubkey: string;
  /** How long to wait for the connection in ms. Default: 15000 */
  timeout?: number;
  /** Called when the connection URI is available (for QR display). */
  showConnectUri?: (uri: string) => Promise<void>;
}

/**
 * Connect to a NIP-46 remote signer.
 * Returns a session object with getPublicKey and signEvent methods.
 */
export async function connectNostrConnect(opts: Nip46ConnectOptions): Promise<{
  getPublicKey: () => Promise<string>;
  signEvent: (event: {
    kind: number;
    tags: string[][];
    content: string;
    created_at: number;
  }) => Promise<{ id: string; sig: string }>;
  close: () => void;
}> {
  const localSecretKey = generateSecretKey();
  const localPubkey = getPublicKey(localSecretKey);
  let resolveReady!: () => void;
  const ready = new Promise<void>((r) => {
    resolveReady = r;
  });

  const session: Nip46Session = {
    remotePubkey: opts.remotePubkey,
    localSecretKey,
    localPubkey,
    relayUrl: opts.relayUrl,
    ready,
    resolveReady,
    pendingRequests: new Map(),
    ws: null,
    connected: false,
  };

  // Build the bunker connection URI
  const connectUri = `bunker://${opts.remotePubkey}?relay=${encodeURIComponent(opts.relayUrl)}&secret=${localPubkey}`;

  if (opts.showConnectUri) {
    await opts.showConnectUri(connectUri);
  }

  // Connect via WebSocket to the relay
  const ws = new WebSocket(opts.relayUrl);
  session.ws = ws;

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('NIP-46 connection timeout'));
    }, opts.timeout ?? 15000);

    ws.onopen = () => {
      session.connected = true;
      // Subscribe to kind 24133 events from the remote pubkey
      ws.send(
        JSON.stringify([
          'REQ',
          'nip46-init',
          { kinds: [24133], authors: [opts.remotePubkey], limit: 1 },
        ]),
      );
    };

    ws.onmessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data as string) as unknown[];
        if (!Array.isArray(data)) return;

        const [type, _subId, ...rest] = data;

        if (type === 'EVENT' && rest.length >= 1) {
          const [rawEvent] = rest as Record<string, unknown>[];
          const nostrEvent = rawEvent as { kind: number; content: string };

          if (nostrEvent.kind === 24133) {
            // NIP-46 response/request
            handleNip46Message(session, nostrEvent.content);
          }
        } else if (type === 'EOSE') {
          // Initial EOSE, we can proceed
          session.resolveReady();
          clearTimeout(timeout);
          resolve({
            getPublicKey: () => requestGetPublicKey(session),
            signEvent: (ev) => requestSignEvent(session, ev),
            close: () => {
              ws.close();
            },
          });
        }
      } catch (err) {
        console.error('[nip46] Error handling message:', err);
      }
    };

    ws.onerror = () => {
      clearTimeout(timeout);
      reject(new Error('NIP-46 WebSocket error'));
    };

    ws.onclose = () => {
      session.connected = false;
    };
  });
}

// ─── NIP-46 Request/Response handling ──────────────────────────────────

function handleNip46Message(session: Nip46Session, content: string): void {
  try {
    const msg = JSON.parse(content) as {
      id: string;
      method?: string;
      params?: string[];
      result?: unknown;
      error?: string;
    };

    if (msg.method === 'connect') {
      // Handle connect response (bunker URI flow)
      const pending = session.pendingRequests.get(msg.id);
      if (pending) {
        pending.resolve(msg.params?.[0] ?? null);
        session.pendingRequests.delete(msg.id);
      }
    }

    const pending = session.pendingRequests.get(msg.id);
    if (pending) {
      if (msg.error) {
        pending.reject(new Error(msg.error));
      } else {
        pending.resolve(msg.result);
      }
      session.pendingRequests.delete(msg.id);
    }
  } catch {
    // Ignore malformed messages
  }
}

async function sendNip46Request(
  session: Nip46Session,
  method: string,
  params: string[],
): Promise<unknown> {
  const id = crypto.randomUUID();
  const content = JSON.stringify({ id, method, params });

  // Create a kind 24133 event
  const event = {
    pubkey: session.localPubkey,
    created_at: Math.floor(Date.now() / 1000),
    kind: 24133,
    tags: [['p', session.remotePubkey]],
    content,
  };

  const signed = signEvent(event, session.localSecretKey);

  return new Promise((resolve, reject) => {
    session.pendingRequests.set(id, { resolve, reject });
    session.ws?.send(JSON.stringify(['EVENT', signed]));

    // Timeout
    setTimeout(() => {
      const pending = session.pendingRequests.get(id);
      if (pending) {
        session.pendingRequests.delete(id);
        reject(new Error(`NIP-46 request timeout: ${method}`));
      }
    }, 10000);
  });
}

async function requestGetPublicKey(session: Nip46Session): Promise<string> {
  return (await sendNip46Request(session, 'get_public_key', [])) as string;
}

async function requestSignEvent(
  session: Nip46Session,
  event: { kind: number; tags: string[][]; content: string; created_at: number },
): Promise<{ id: string; sig: string }> {
  return (await sendNip46Request(session, 'sign_event', [JSON.stringify(event)])) as {
    id: string;
    sig: string;
  };
}
