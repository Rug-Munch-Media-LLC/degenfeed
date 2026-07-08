/**
 * Lightweight error reporter that ships to Sentry when a DSN is configured.
 * No npm dependency — uses the standard Sentry Envelope API directly
 * to keep the Worker and browser bundles small.
 *
 * Usage:
 *   reportError(error, { env: 'production', tags: { protocol: 'nostr' } })
 *
 * Call `initSentry(dsn)` before any other usage. If never called,
 * reportError() is a console.error stub.
 */

interface ReportContext {
  env?: string;
  tags?: Record<string, string>;
}

interface SentryDsnParts {
  host: string;
  projectId: string;
  publicKey: string;
}

function parseDsn(dsn: string): SentryDsnParts | null {
  try {
    const u = new URL(dsn);
    return { host: u.hostname, projectId: u.pathname.replace(/\//g, ''), publicKey: u.username };
  } catch {
    return null;
  }
}

function createEventId(): string {
  return Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
}

async function shipToSentry(dsn: string, body: unknown): Promise<void> {
  const parts = parseDsn(dsn);
  if (!parts) return;
  const url = `https://${parts.host}/api/${parts.projectId}/envelope/`;
  const envelope =
    JSON.stringify({ sent_at: new Date().toISOString(), dsn }) +
    '\n' +
    JSON.stringify({ type: 'event' }) +
    '\n' +
    JSON.stringify(body);
  try {
    await fetch(url, {
      method: 'POST',
      body: envelope,
      headers: { 'content-type': 'application/x-sentry-envelope' },
    });
  } catch {
    /* Fire-and-forget */
  }
}

let _dsn = '';

export function initSentry(dsn: string): void {
  _dsn = dsn;
}

export function reportError(error: Error | string, ctx: ReportContext = {}): void {
  const message = typeof error === 'string' ? error : error.message;
  const stack = typeof error === 'string' ? undefined : error.stack;
  console.error(`[DegenFeed] ${message}`, { stack, ...ctx });
  if (!_dsn) return;
  shipToSentry(_dsn, {
    event_id: createEventId(),
    timestamp: Date.now() / 1000,
    level: 'error',
    exception: {
      values: [
        {
          type: typeof error === 'string' ? 'Error' : error.name,
          value: message,
          stacktrace: stack ? { frames: [] } : undefined,
        },
      ],
    },
    tags: ctx.tags ?? {},
    environment: ctx.env ?? 'production',
    platform: 'javascript',
  }).catch(() => {});
}
