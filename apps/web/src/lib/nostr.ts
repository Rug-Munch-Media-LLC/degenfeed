/**
 * @degenfeed/web/lib/nostr — Client-side Nostr publishing helper
 *
 * Used by the Mastodon->Nostr bridge in the composer.
 *
 * Looks up the user's Nostr identity in IndexedDB, decrypts the saved
 * nsec using the auto-unlock passphrase, signs a text note, and
 * publishes to a small set of public relays.
 *
 * Returns per-relay publish results. We consider the publish successful
 * if at least one relay accepts the event.
 */

import { decryptSecret } from '@degenfeed/auth';
import { getIdentity, type StoredIdentity } from '@degenfeed/storage';

const DEFAULT_RELAYS = ['wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.primal.net'];

const AUTO_UNLOCK_PASSPHRASE = 'auto-unlock-passphrase';

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

async function decryptNsec(record: StoredIdentity): Promise<string | null> {
  if (!record.encryptedSecret) return null;
  try {
    const secret = await decryptSecret(
      { ciphertext: record.encryptedSecret, salt: record.salt, iv: record.iv },
      AUTO_UNLOCK_PASSPHRASE,
    );
    return secret;
  } catch {
    return null;
  }
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
  const nsec = await decryptNsec(record);
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
