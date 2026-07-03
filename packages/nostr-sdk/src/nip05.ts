export interface Nip05Result {
  pubkey: string;
  relays?: string[];
}

/**
 * Normalize a NIP-05 identifier: lowercase, strip leading @.
 * Returns [name, domain] or throws.
 */
export function parseNip05(nip05: string): { name: string; domain: string } {
  let normalized = nip05.trim().toLowerCase();
  if (normalized.startsWith('@')) normalized = normalized.slice(1);

  // Handle _@domain shorthand (catch-all)
  if (normalized.startsWith('_@')) {
    return { name: '_', domain: normalized.slice(2) };
  }

  const atIndex = normalized.indexOf('@');
  if (atIndex === -1 || atIndex === 0 || atIndex === normalized.length - 1) {
    throw new Error(`Invalid NIP-05 identifier: ${nip05}`);
  }

  return {
    name: normalized.slice(0, atIndex),
    domain: normalized.slice(atIndex + 1),
  };
}

/**
 * Resolve a NIP-05 identifier to a pubkey.
 *
 * @param nip05 The NIP-05 identifier (e.g. "user@example.com")
 * @param fetchFn Optional custom fetch function (for testing)
 * @returns The pubkey hex string, or null if not found
 */
export async function resolveNip05(
  nip05: string,
  fetchFn: typeof fetch = fetch,
): Promise<Nip05Result | null> {
  const { name, domain } = parseNip05(nip05);

  try {
    const url = `https://${domain}/.well-known/nostr.json?name=${encodeURIComponent(name)}`;
    const res = await fetchFn(url);

    if (!res.ok) return null;

    const json = (await res.json()) as {
      names?: Record<string, string>;
      relays?: Record<string, string[]>;
    };

    if (!json.names || !json.names[name]) return null;

    const pubkey = json.names[name];
    const relays = json.relays?.[pubkey];

    return {
      pubkey,
      relays,
    };
  } catch {
    return null;
  }
}

/**
 * Verify that a pubkey matches a NIP-05 identifier.
 * Fetches the well-known url and checks the mapping.
 */
export async function verifyNip05(
  nip05: string,
  pubkey: string,
  fetchFn: typeof fetch = fetch,
): Promise<boolean> {
  const result = await resolveNip05(nip05, fetchFn);
  if (!result) return false;
  return result.pubkey === pubkey;
}
