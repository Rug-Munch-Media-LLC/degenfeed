/**
 * BoundedCache — size/TTL-bounded LRU cache for module-level caches.
 *
 * Modeled on server/response-cache.ts (FeedResponseCache): every module-scope
 * cache must have (a) a max entry count, (b) a TTL, and (c) a periodic sweep
 * so expired entries are released even when never read again. Optionally
 * byte-bounded via a sizeOf callback (for Buffer-valued caches like the
 * image proxy).
 */
export interface BoundedCacheOptions<V> {
  /** Hard cap on entry count. Oldest (LRU) entries are evicted beyond this. */
  maxEntries: number;
  /** Entry TTL in ms. Expired entries are dropped on read and by the sweep. */
  ttlMs: number;
  /** How often the background sweep runs (default 60s). */
  sweepIntervalMs?: number;
  /** Optional per-value byte size; when set, total bytes are capped at maxBytes. */
  sizeOf?: (value: V) => number;
  /** Byte cap, requires sizeOf. Evicts LRU entries until under the cap. */
  maxBytes?: number;
}

interface Entry<V> {
  value: V;
  expiresAt: number;
  bytes: number;
}

export class BoundedCache<V> {
  private map = new Map<string, Entry<V>>();
  private readonly maxEntries: number;
  private readonly ttlMs: number;
  private readonly sizeOf?: (value: V) => number;
  private readonly maxBytes: number;
  private bytes = 0;
  private sweepTimer: NodeJS.Timeout | undefined;

  constructor(options: BoundedCacheOptions<V>) {
    this.maxEntries = options.maxEntries;
    this.ttlMs = options.ttlMs;
    this.sizeOf = options.sizeOf;
    this.maxBytes = options.maxBytes ?? Number.POSITIVE_INFINITY;
    if (options.maxBytes !== undefined && !options.sizeOf) {
      throw new Error('BoundedCache: maxBytes requires sizeOf');
    }
    const interval = options.sweepIntervalMs ?? 60_000;
    this.sweepTimer = setInterval(() => this.sweep(), interval);
    this.sweepTimer.unref();
  }

  get(key: string): V | undefined {
    const entry = this.map.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= Date.now()) {
      this.delete(key);
      return undefined;
    }
    // LRU refresh: re-insert to move to the end of iteration order
    this.map.delete(key);
    this.map.set(key, entry);
    return entry.value;
  }

  set(key: string, value: V): void {
    this.delete(key);
    const bytes = this.sizeOf ? this.sizeOf(value) : 0;
    this.map.set(key, { value, expiresAt: Date.now() + this.ttlMs, bytes });
    this.bytes += bytes;
    this.evictOverflow();
  }

  has(key: string): boolean {
    return this.get(key) !== undefined;
  }

  delete(key: string): void {
    const entry = this.map.get(key);
    if (entry) {
      this.bytes -= entry.bytes;
      this.map.delete(key);
    }
  }

  get size(): number {
    return this.map.size;
  }

  get totalBytes(): number {
    return this.bytes;
  }

  clear(): void {
    this.map.clear();
    this.bytes = 0;
  }

  /** Remove expired entries. Called periodically and safe to call manually. */
  sweep(): void {
    const now = Date.now();
    for (const [key, entry] of this.map) {
      if (entry.expiresAt <= now) {
        this.map.delete(key);
        this.bytes -= entry.bytes;
      }
    }
  }

  /** Stop the background sweep (for tests / shutdown). */
  dispose(): void {
    if (this.sweepTimer) {
      clearInterval(this.sweepTimer);
      this.sweepTimer = undefined;
    }
  }

  private evictOverflow(): void {
    // Evict LRU (first-inserted) entries until under both caps
    while (this.map.size > this.maxEntries || this.bytes > this.maxBytes) {
      const oldest = this.map.keys().next();
      if (oldest.done) break;
      this.delete(oldest.value);
    }
  }
}
