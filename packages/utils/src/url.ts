/**
 * @degenfeed/utils — URL construction
 *
 * Single responsibility: build an absolute URL from a base, a path and an
 * optional query object, skipping undefined values.
 */

/**
 * Resolve `path` against `base` and append defined query parameters.
 *
 * `undefined` values are omitted; empty strings are kept. Throws whatever
 * `new URL()` throws when `base` is not absolute.
 */
export function buildUrl(
  base: string,
  path: string,
  params?: Record<string, string | undefined>,
): string {
  const url = new URL(path, base);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined) url.searchParams.set(k, v);
    }
  }
  return url.toString();
}
