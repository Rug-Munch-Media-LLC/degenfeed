const SUSPICIOUS_PATTERNS = [/<script/i, /javascript:/i];

export const ALLOWED_PROTOCOLS = new Set([
  'nostr',
  'farcaster',
  'lens',
  'bluesky',
  'rss',
  'mastodon',
  'ethereum',
  'solana',
]);

export function hasSuspiciousPayload(value: string): boolean {
  return SUSPICIOUS_PATTERNS.some((pattern) => pattern.test(value));
}

function isControlChar(code: number): boolean {
  return (
    (code >= 0x00 && code <= 0x08) ||
    code === 0x0b ||
    code === 0x0c ||
    (code >= 0x0e && code <= 0x1f) ||
    code === 0x7f
  );
}

export function sanitizeString(input: unknown, maxLength: number): string {
  if (typeof input !== 'string') return '';
  let cleaned = '';
  for (const char of input) {
    if (isControlChar(char.charCodeAt(0))) continue;
    cleaned += char;
  }
  return cleaned.trim().slice(0, maxLength).trim();
}

export function sanitizeStringArray(input: unknown, maxLength: number, maxItems = 50): string[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((item) => sanitizeString(item, maxLength))
    .filter((item) => item.length > 0)
    .slice(0, maxItems);
}

const AMOUNT_RE = /^(?!0+(?:\.0+)?$)\d+(?:\.\d{1,8})?$/;

export function isValidAmount(value: string): boolean {
  return AMOUNT_RE.test(value);
}

export function isAllowedProtocol(value: string): boolean {
  return ALLOWED_PROTOCOLS.has(value);
}

const EVM_ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

export function isValidEvmAddress(value: string): boolean {
  return EVM_ADDRESS_RE.test(value);
}

const SOLANA_ADDRESS_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export function isValidSolanaAddress(value: string): boolean {
  return SOLANA_ADDRESS_RE.test(value);
}

// ─── SSRF-hardened URL fetching ────────────────────────────────────

/**
 * SSRF RISK — This module validates user-provided URLs before fetching.
 * Several classes of SSRF attacks remain possible:
 *
 * 1. DNS rebinding — a hostname resolves to a public IP at validation
 *    time but switches to a private IP when the actual fetch occurs.
 *    Mitigation: Cloudflare Workers' network sandbox prevents connections
 *    to private IP ranges (10.x, 172.16-31.x, 192.168.x, 127.x, ::1) at
 *    the platform level. If this worker ever gains explicit network access
 *    to private ranges (service_binding, etc.), add hostname→IP resolution
 *    here using a trusted DNS resolver.
 *
 * 2. Open redirect — an allowed host redirects to a blocked host.
 *    Mitigation: `safeFetch` validates every redirect target manually with
 *    `redirect: 'manual'` + per-hop `isValidFetchUrl` checks.
 *
 * 3. Compromised allowlisted host — an attacker controls a host in
 *    `ALLOWED_URL_HOSTS` and serves malicious redirects or content.
 *    Mitigation: keep the allowlist minimal; redirect validation blocks
 *    off-host pivoting; per-host rate limiting reduces blast.
 *
 * 4. IDN homograph / hostname confusion.
 *    Mitigation: `new URL()` normalizes hostnames (punycode) and rejects
 *    malformed ones.
 *
 * 5. Path traversal / local file inclusion via URL path.
 *    Mitigation: `DENIED_PATH_PATTERNS` blocks `/etc/passwd`, `/proc/`,
 *    `.env`, `.git`, etc.
 */

const ALLOWED_URL_PROTOCOLS = new Set(['https:', 'http:']);

/**
 * Known content hosts — embed, frame, and RSS resolvers may fetch from
 * these hosts on behalf of users. Keep this list minimal to limit SSRF
 * blast radius. Only add hosts where users need to resolve embeds/frames
 * or fetch RSS feeds.
 *
 * ⚠️ If ANY host here is compromised, it becomes an SSRF vector via
 *    open redirects or content injection.
 */
const ALLOWED_URL_HOSTS = new Set([
  'degenfeed.xyz',
  'app.degenfeed.xyz',
  'social.degenfeed.xyz',
  'www.reddit.com',
  'old.reddit.com',
  'www.facebook.com',
  'bsky.social',
  'www.threads.net',
  'public.threads.net',
  'mastodon.social',
  'bitcoinhackers.org',
  'lemmy.world',
  'lemmy.ml',
  'programming.dev',
  'sh.itjust.works',
  'lemmy.dbzer0.com',
  'sopuli.xyz',
  'relay.damus.io',
  'nos.lol',
  'relay.primal.net',
  'relay.nostr.band',
  'nostr.wine',
  'api.nostr.band',
  // Self-hosted proxy services for feed fetching
  'redlib.degenfeed.xyz',
  'rss-bridge.degenfeed.xyz',
]);

// ─── Private IP detection ──────────────────────────────────────────

const PRIVATE_IPV4_RE = /^(10\.|127\.|0\.0\.0\.0|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)/;

const PRIVATE_IPV6_PREFIXES = ['::1', 'fc00:', 'fd00:', 'fe80:'];

function isPrivateIp(hostname: string): boolean {
  if (PRIVATE_IPV4_RE.test(hostname)) return true;
  const lower = hostname.toLowerCase();
  for (const prefix of PRIVATE_IPV6_PREFIXES) {
    if (lower === prefix || lower.startsWith(prefix)) return true;
  }
  return false;
}

// ─── Per-host rate limiter ─────────────────────────────────────────

const HOST_REQ_LIMIT = 30;
const HOST_REQ_WINDOW_MS = 60_000;

const hostRequestCounts = new Map<string, number[]>();

function isHostRateLimited(hostname: string): boolean {
  const now = Date.now();
  const windowStart = now - HOST_REQ_WINDOW_MS;
  let timestamps = hostRequestCounts.get(hostname);
  if (!timestamps) {
    timestamps = [];
    hostRequestCounts.set(hostname, timestamps);
  }
  const active = timestamps.filter((t) => t > windowStart);
  active.push(now);
  hostRequestCounts.set(hostname, active);
  return active.length > HOST_REQ_LIMIT;
}

// ─── URL validation ────────────────────────────────────────────────

const MAX_URL_LENGTH = 2048;

const DENIED_PATH_PATTERNS = [
  /\/\.\./,
  /\/proc\//,
  /\/sys\//,
  /\/etc\//,
  /\/\.env/,
  /\/\.git\//,
  /\/\.aws\//,
  /\/server-status/,
  /\/server-info/,
  /\/\.svn\//,
  /\/\.hg\//,
  /\/cgi-bin\//,
  /\/wp-admin\//,
  /\/\.ssh\//,
  /\/\.kube\//,
  /\/\.docker\//,
  /\/\/+/,
];

const ALLOWED_PORTS = new Set([80, 443]);

export function isValidFetchUrl(rawUrl: string): boolean {
  if (rawUrl.length > MAX_URL_LENGTH) return false;

  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return false;
  }

  if (!ALLOWED_URL_PROTOCOLS.has(url.protocol)) return false;

  if (!url.hostname || url.hostname.length === 0) return false;

  if (url.port && !ALLOWED_PORTS.has(Number(url.port))) return false;

  for (const pattern of DENIED_PATH_PATTERNS) {
    if (pattern.test(url.pathname)) return false;
  }

  if (isPrivateIp(url.hostname)) return false;

  /**
   * DNS rebinding note: The `URL` constructor normalizes IP-literal
   * hostnames, so `isPrivateIp` catches e.g. `http://10.0.0.1/` and
   * `http://[::1]/`. For DNS-based hostnames, resolution happens at
   * fetch time. Cloudflare Workers' network sandbox prevents connections
   * to private ranges regardless of DNS — so DNS rebinding is mitigated
   * at the platform level. If this worker ever gains service_binding or
   * explicit private-network access, add a hostname→IP resolution step
   * here (e.g. via a trusted DNS-over-HTTPS resolver).
   */

  return ALLOWED_URL_HOSTS.has(url.hostname);
}

// ─── Safe fetch with redirect validation ───────────────────────────

const MAX_REDIRECTS = 5;

/**
 * Fetch a URL with SSRF-hardened redirect handling.
 *
 * Uses `redirect: 'manual'` so that every hop in a redirect chain is
 * independently validated by `isValidFetchUrl`. This prevents:
 *   - Open redirect chains that escape the host allowlist
 *   - Infinite redirect loops (hard cap at MAX_REDIRECTS)
 *   - Redirects to private IPs or blocked hosts
 *
 * HTTP redirect semantics are preserved:
 *   - 301/302/303 → method changed to GET, body cleared
 *   - 307/308     → method and body preserved
 */
export async function safeFetch(url: string, init?: RequestInit): Promise<Response> {
  const parsed = new URL(url);
  if (isHostRateLimited(parsed.hostname)) {
    return new Response('Rate limit exceeded for host', { status: 429 });
  }

  let currentUrl = url;
  let currentInit = init;
  for (let attempt = 0; attempt <= MAX_REDIRECTS; attempt++) {
    if (!isValidFetchUrl(currentUrl)) {
      return new Response('Blocked URL in redirect chain', { status: 400 });
    }

    const response = await fetch(currentUrl, {
      ...currentInit,
      redirect: 'manual',
    });

    const status = response.status;
    if ([301, 302, 303, 307, 308].includes(status)) {
      const location = response.headers.get('location');
      if (!location) {
        return new Response('Redirect with no Location header', { status: 502 });
      }

      const resolvedLocation = new URL(location, currentUrl).href;

      // 301/302/303: change POST to GET, clear body (HTTP spec)
      // 307/308: preserve method and body
      if ([301, 302, 303].includes(status)) {
        currentInit = { ...currentInit, method: 'GET', body: undefined };
      }

      currentUrl = resolvedLocation;
      continue;
    }

    return response;
  }

  return new Response('Too many redirects', { status: 502 });
}

// ─── Body size validation ─────────────────────────────────────────

export function validateBodySize(
  request: Request,
  maxBytes: number,
): { ok: true } | { ok: false; error: string } {
  const contentLength = request.headers.get('content-length');
  if (contentLength === null) return { ok: true };
  const bytes = parseInt(contentLength, 10);
  if (Number.isNaN(bytes)) return { ok: true };
  if (bytes > maxBytes) {
    return { ok: false, error: `Request body too large (max ${maxBytes} bytes)` };
  }
  return { ok: true };
}

// ─── Instance URL validation ──────────────────────────────────────

export function isValidInstanceUrl(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl);
    if (!ALLOWED_URL_PROTOCOLS.has(url.protocol)) return false;
    return url.hostname.endsWith('.degenfeed.xyz') || ALLOWED_URL_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
}
