/**
 * @degenfeed/utils — String helpers
 *
 * Single responsibility: small, allocation-cheap string transforms shared by
 * the web app and the workers.
 */

/**
 * Coerce an arbitrary string into a key safe for a map/KV namespace:
 * lowercased, with every character outside `[a-z0-9@._-]` replaced by `_`.
 */
export function safeKey(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9@._-]/g, '_');
}

/**
 * Abbreviate an address/hash as `head...tail`.
 *
 * Returns the input untouched when shortening would not save space
 * (`length < head + tail + 3`).
 */
export function shortenAddress(addr: string, head = 6, tail = 4): string {
  if (addr.length < head + tail + 3) return addr;
  return `${addr.slice(0, head)}...${addr.slice(-tail)}`;
}
