/**
 * @degenfeed/web/lib/nostr — Client-side Nostr publishing helper
 *
 * Used by the Mastodon->Nostr bridge in the composer.
 *
 * Looks up the user's Nostr identity in IndexedDB, reads the nsec
 * from the keys field, signs a text note, and publishes to relays.
 */

import { getIdentity, type StoredIdentity } from '@degenfeed/storage';

const DEFAULT_RELAYS = ['wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.primal.net'];

export interface NostrPublishResult {
  ok: boolean;
  eventId?: string;
  relays: Array<{ url: string; ok: boolean; error?: string }>;
  error?: string;
}

interface RelayPoolLike {
  publish(event: { id: string; sig: string; [k: string]: unknown }): Promise<unknown>;
  disconnectAll(): void;
}

async function loadNostrIdentity(publicId: string): Promise<StoredIdentity | null> {
  try {
    const record = await getIdentity(`nostr:${publicId}`);
    return record ?? null;
  } catch {
    return null;
  }
}

function getNsec(record: StoredIdentity): string | null {
  return (record.keys?.nsec || record.keys?._secret || record.encryptedSecret) as string | null;
}

export async function publishNoteToNostr(opts: {
  text: string;
  publicId: string;
  relays?: string[];
}): Promise<NostrPublishResult> {
  const record = await loadNostrIdentity(opts.publicId);
  if (!record) {
    return { ok: false, relays: [], error: 'No Nostr identity linked' };
  }
  const nsec = getNsec(record);
  if (!nsec) {
    return { ok: false, relays: [], error: 'Could not unlock Nostr key' };
  }

  try {
    const nostr = await import('@degenfeed/nostr-sdk');
    const ev = nostr.createTextNote(opts.text, nsec, []);
    ev.pubkey = nostr.getPublicKey(nsec);
    ev.id = nostr.getEventHash(ev);
    nostr.signEvent(ev, nsec);

    const relayUrls = opts.relays ?? DEFAULT_RELAYS;
    const pool = new nostr.RelayPool(relayUrls, { eoseTimeout: 3000 }) as unknown as RelayPoolLike;

    const relayResults: NostrPublishResult['relays'] = [];
    for (const url of relayUrls) {
      try {
        await pool.publish(ev as unknown as { id: string; sig: string; [k: string]: unknown });
        relayResults.push({ url, ok: true });
      } catch (e) {
        relayResults.push({ url, ok: false, error: String(e) });
      }
    }
    pool.disconnectAll();

    const okCount = relayResults.filter((r) => r.ok).length;
    return {
      ok: okCount > 0,
      eventId: ev.id,
      relays: relayResults,
      error: okCount === 0 ? 'No relay accepted the event' : undefined,
    };
  } catch (e) {
    return { ok: false, relays: [], error: String(e) };
  }
}

/**
 * Client-side Nostr engage: like (kind 7 reaction), repost (kind 6),
 * or reply (kind 1 with e/p reply tags). Signs locally with the
 * decrypted nsec and publishes to relays. Returns success if any
 * relay accepts the event.
 */
export async function engageNostr(opts: {
  action: 'like' | 'repost' | 'reply';
  eventId: string;
  pubkey: string;
  content?: string;
  publicId: string; // our Nostr hex public key
}): Promise<{ ok: boolean; error?: string }> {
  const record = await loadNostrIdentity(opts.publicId);
  if (!record) return { ok: false, error: 'No Nostr identity linked' };
  const nsec = getNsec(record);
  if (!nsec) return { ok: false, error: 'Could not unlock Nostr key' };

  try {
    const nostr = await import('@degenfeed/nostr-sdk');
    const ev =
      opts.action === 'reply'
        ? (() => {
            const unsigned = {
              pubkey: nostr.getPublicKey(nsec),
              created_at: Math.floor(Date.now() / 1000),
              kind: 1,
              tags: [
                ['e', opts.eventId, '', 'reply'],
                ['p', opts.pubkey],
              ],
              content: opts.content ?? '',
            };
            return nostr.signEvent(unsigned, nsec);
          })()
        : opts.action === 'like'
          ? nostr.createReaction('+', opts.eventId, opts.pubkey, nsec)
          : (() => {
              // repost: create a text note with the original event in tags
              const unsigned = {
                pubkey: nostr.getPublicKey(nsec),
                created_at: Math.floor(Date.now() / 1000),
                kind: 6,
                tags: [
                  ['e', opts.eventId],
                  ['p', opts.pubkey],
                ],
                content: opts.content ?? '',
              };
              return nostr.signEvent(unsigned, nsec);
            })();

    const pool = new nostr.RelayPool(DEFAULT_RELAYS, { eoseTimeout: 3000 });
    let published = false;
    for (const _url of DEFAULT_RELAYS) {
      try {
        pool.publish(ev);
        published = true;
      } catch {
        /* continue */
      }
    }
    pool.disconnectAll();
    return published ? { ok: true } : { ok: false, error: 'No relay accepted the event' };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}
