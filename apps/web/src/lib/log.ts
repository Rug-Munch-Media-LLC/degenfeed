/**
 * @degenfeed/web — Structured logging
 *
 * Lightweight structured logger for Next.js API routes.
 * Emits JSON lines to stdout for Cloudflare/observability pipeline ingestion.
 */

export type LogLevel = 'info' | 'warn' | 'error';

/**
 * Log a structured message.
 * In production, consider sending to an observability sink in addition to stdout.
 */
export function log(level: LogLevel, message: string, data?: unknown): void {
  console.log(
    JSON.stringify({
      l: level,
      m: message,
      t: Date.now(),
      ...(data !== undefined ? { d: data } : {}),
    }),
  );
}
