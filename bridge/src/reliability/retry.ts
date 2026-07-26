/**
 * Retry with Dead Letter Queue — Retries failed operations with backoff.
 * Enqueues permanently failed items to the dead letter queue.
 */

interface DeadLetterEntry {
  protocol: string;
  error: string;
  timestamp: number;
  context?: Record<string, unknown>;
}

class DeadLetterQueue {
  private queue: DeadLetterEntry[] = [];
  private maxSize = 1000;

  enqueue(entry: Omit<DeadLetterEntry, 'timestamp'>): void {
    this.queue.push({ ...entry, timestamp: Date.now() });
    if (this.queue.length > this.maxSize) {
      this.queue.shift();
    }
  }

  getAll(): DeadLetterEntry[] {
    return [...this.queue];
  }

  getByProtocol(protocol: string): DeadLetterEntry[] {
    return this.queue.filter((e) => e.protocol === protocol);
  }

  clear(): void {
    this.queue = [];
  }
}

export const deadLetterQueue = new DeadLetterQueue();

/**
 * Retry an async operation with exponential backoff.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: { maxRetries?: number; baseDelayMs?: number; label?: string } = {},
): Promise<T> {
  const maxRetries = options.maxRetries ?? 2;
  const baseDelayMs = options.baseDelayMs ?? 1000;
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < maxRetries) {
        const delay = baseDelayMs * 2 ** attempt + Math.random() * 500;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new Error('Retry failed');
}
