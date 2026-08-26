/**
 * @degenfeed/api-worker — Structured logger
 *
 * Single-line JSON logger for Cloudflare Workers.
 * Replaces ad-hoc console.log/error calls with a consistent format.
 */

export function log(level: 'info' | 'warn' | 'error', msg: string, data?: unknown): void {
  //   console.log(
  //     JSON.stringify({
  //       l: level,
  //       m: msg,
  //       t: Date.now(),
  //       ...(data ? { d: data } : {}),
  //     }),
  //   );
}
