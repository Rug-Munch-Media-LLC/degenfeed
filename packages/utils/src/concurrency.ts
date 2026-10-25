/**
 * @degenfeed/utils — Bounded concurrency
 *
 * Single responsibility: run an async mapper over a list with at most `limit`
 * in flight, preserving input order in the result.
 */

/**
 * Map `items` through `fn` with at most `limit` concurrent invocations.
 *
 * Contract invariants:
 * - results are index-aligned with `items`
 * - at most `limit` invocations are in flight at any moment
 * - a rejected invocation does not reject the whole batch; its slot is left
 *   `undefined` (callers must tolerate holes — this is the documented
 *   behaviour of the original implementation, preserved here deliberately)
 * - an empty list resolves to `[]` without calling `fn`
 */
export async function withConcurrencyLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = Array.from({ length: items.length });
  const queue = items.map((item, index) => ({ item, index }));
  const runners = new Set<Promise<void>>();
  const width = Math.max(1, Math.floor(limit) || 1);

  while (queue.length > 0 || runners.size > 0) {
    while (runners.size < width && queue.length > 0) {
      const next = queue.shift();
      if (!next) break;
      const { item, index } = next;
      const promise = fn(item)
        .then((result) => {
          results[index] = result;
        })
        .catch(() => {})
        .finally(() => {
          runners.delete(promise);
        });
      runners.add(promise);
    }
    if (runners.size > 0) {
      await Promise.race(runners);
    }
  }
  return results;
}
