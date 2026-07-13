/**
 * Runtime schema guards for provider API responses.
 *
 * Every `fetchRemote` / `fetchJson` call in feed-providers returns
 * external JSON that can change shape at any time. These guards validate
 * the received payload before it enters the rest of the pipeline, so a
 * breaking API change produces a loud error instead of a silent feed outage.
 */

// ─── Nostr ────────────────────────────────────────────────────────

interface NostrEventPartial {
  id?: unknown;
  pubkey?: unknown;
  kind?: unknown;
}

export function isNostrEvent(obj: unknown): obj is NostrEventPartial {
  if (!obj || typeof obj !== 'object') return false;
  const e = obj as Record<string, unknown>;
  return typeof e.id === 'string' && typeof e.pubkey === 'string' && typeof e.kind === 'number';
}
