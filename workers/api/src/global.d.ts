/**
 * Minimal `process` global for cross-platform packages that reference
 * `typeof process !== 'undefined'` guards at runtime.
 *
 * Cloudflare Workers don't have `process.env` — the guard is used by
 * shared packages (feed-providers, token-gate) to detect Node.js vs Workers.
 */
declare var process: {
  env: Record<string, string | undefined>;
} | undefined;
