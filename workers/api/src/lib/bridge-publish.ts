/**
 * @degenfeed/api-worker — Cross-Protocol Bridge Publishing
 *
 * Bridge handlers, Zora special cases, generic publish, and main bridge function.
 */

import type { Protocol } from '@degenfeed/types';
import type { Env } from '../types';
import { alertBridgeFailure } from './alerts';
import { fetchSourceContent } from './bridge-fetchers';
import { recordBridgeOperation, withReliability } from './bridge-reliability';
import type {
  BridgeContentInput,
  BridgeDirectionHandler,
  BridgeReport,
  BridgeResult,
  SourceContent,
} from './bridge-types';
import type { PublishInput } from './publish-orchestrator';

// ─── Bridge Footer Helpers ───────────────────────────────────────────

const BRIDGE_FOOTERS: Record<string, string> = {
  'activitypub→nostr': '\n\n— Bridged from Mastodon via DegenFeed',
  'activitypub→farcaster': '\n\n— From Mastodon via DegenFeed',
  'activitypub→bluesky': '\n\n— From Mastodon via DegenFeed',
  'activitypub→lens': '\n\n— From Mastodon via DegenFeed',
  'activitypub→telegram': '\n\n— From Mastodon',
  'activitypub→rss': '',
  'activitypub→zora': '',
  'bluesky→activitypub': '\n\n— From Bluesky via DegenFeed',
  'bluesky→nostr': '\n\n— From Bluesky via DegenFeed',
  'bluesky→farcaster': '\n\n— From Bluesky via DegenFeed',
  'bluesky→lens': '\n\n— From Bluesky via DegenFeed',
  'bluesky→telegram': '\n\n— From Bluesky',
  'bluesky→rss': '',
  'bluesky→zora': '',
  'nostr→activitypub': '\n\n— From Nostr via DegenFeed',
  'nostr→bluesky': '\n\n— From Nostr via DegenFeed',
  'nostr→farcaster': '\n\n— From Nostr via DegenFeed',
  'nostr→lens': '\n\n— From Nostr via DegenFeed',
  'nostr→telegram': '\n\n— From Nostr',
  'nostr→rss': '',
  'nostr→zora': '',
  'farcaster→activitypub': '\n\n— From Farcaster via DegenFeed',
  'farcaster→bluesky': '\n\n— From Farcaster via DegenFeed',
  'farcaster→nostr': '\n\n— From Farcaster via DegenFeed',
  'farcaster→lens': '\n\n— From Farcaster via DegenFeed',
  'farcaster→telegram': '\n\n— From Farcaster',
  'farcaster→rss': '',
  'farcaster→zora': '',
  'lens→activitypub': '\n\n— From Lens via DegenFeed',
  'lens→bluesky': '\n\n— From Lens via DegenFeed',
  'lens→nostr': '\n\n— From Lens via DegenFeed',
  'lens→farcaster': '\n\n— From Lens via DegenFeed',
  'lens→telegram': '\n\n— From Lens',
  'lens→rss': '',
  'lens→zora': '',
  'telegram→activitypub': '\n\n— From Telegram via DegenFeed',
  'telegram→bluesky': '\n\n— From Telegram via DegenFeed',
  'telegram→nostr': '\n\n— From Telegram via DegenFeed',
  'telegram→farcaster': '\n\n— From Telegram via DegenFeed',
  'telegram→lens': '\n\n— From Telegram via DegenFeed',
  'telegram→rss': '',
  'telegram→zora': '',
  'rss→activitypub': '\n\n— From RSS via DegenFeed',
  'rss→bluesky': '\n\n— From RSS via DegenFeed',
  'rss→nostr': '\n\n— From RSS via DegenFeed',
  'rss→farcaster': '\n\n— From RSS via DegenFeed',
  'rss→lens': '\n\n— From RSS via DegenFeed',
  'rss→telegram': '\n\n— From RSS',
  'zora→activitypub': '\n\n— From Zora via DegenFeed',
  'zora→bluesky': '\n\n— From Zora via DegenFeed',
  'zora→nostr': '\n\n— From Zora via DegenFeed',
  'zora→farcaster': '\n\n— From Zora via DegenFeed',
  'zora→lens': '\n\n— From Zora via DegenFeed',
  'zora→telegram': '\n\n— From Zora',
  'zora→rss': '',
};

function formatProtocolLabel(p: string): string {
  const labels: Record<string, string> = {
    nostr: 'Nostr',
    farcaster: 'Farcaster',
    lens: 'Lens',
    bluesky: 'Bluesky',
    mastodon: 'Mastodon',
    activitypub: 'Mastodon',
    atproto: 'Bluesky',
    telegram: 'Telegram',
    rss: 'RSS',
    threads: 'Threads',
    zora: 'Zora',
  };
  return labels[p] ?? p;
}

function normalizeProtocol(p: string): string {
  if (p === 'activitypub' || p === 'mastodon') return 'mastodon';
  if (p === 'atproto' || p === 'bluesky') return 'bluesky';
  return p;
}

function getBridgeFooter(source: string, target: string): string {
  if (target === 'rss' || target === 'zora') return '';
  if (target === 'telegram' && source !== 'telegram')
    return `\n\n— From ${formatProtocolLabel(source)}`;
  return BRIDGE_FOOTERS[`${source}→${target}`] ?? '\n\n— Via DegenFeed cross-protocol bridge';
}

// ─── Generic Bridge Publish ──────────────────────────────────────────

async function reliableBridgePublish<T>(
  protocol: string,
  operation: () => Promise<T>,
  env: Env,
): Promise<T | null> {
  const start = performance.now();
  try {
    const result = await withReliability(protocol, operation, { env });
    recordBridgeOperation(env, protocol, true, performance.now() - start);
    return result;
  } catch (err) {
    recordBridgeOperation(
      env,
      protocol,
      false,
      performance.now() - start,
      err instanceof Error ? err.message : String(err),
    );
    return null;
  }
}

function getProtocolMaxLength(protocol: string): number {
  return (
    {
      mastodon: 500,
      bluesky: 300,
      nostr: 10000,
      farcaster: 320,
      lens: 10000,
      telegram: 4000,
      rss: 100000,
      threads: 500,
    }[protocol] ?? 10000
  );
}

async function genericBridgePublish(
  source: SourceContent,
  sourceProtocol: string,
  targetProtocol: string,
  targetAuth: Record<string, string>,
  env: Env,
): Promise<{ ok: boolean; nativeId?: string; nativeUri?: string; error?: string }> {
  const result = await reliableBridgePublish(
    targetProtocol,
    async () => {
      const { orchestratePublish } = await import('./publish-orchestrator');
      const footer = getBridgeFooter(sourceProtocol, targetProtocol);
      const maxLen = getProtocolMaxLength(targetProtocol);
      let text = source.text;
      const textWithFooter = footer ? `${text}${footer}` : text;
      if (textWithFooter.length > maxLen) {
        const fl = footer.length;
        text =
          maxLen - fl - 3 > 0
            ? `${source.text.slice(0, maxLen - fl - 3)}...${footer}`
            : `${source.text.slice(0, maxLen - 3)}...`;
      } else {
        text = textWithFooter;
      }

      const report = await orchestratePublish(
        {
          text,
          title: source.title,
          targets: [targetProtocol as Protocol],
          auth: targetAuth,
          images: source.images,
          links: source.links,
          hashtags: source.hashtags,
        } as PublishInput,
        env,
      );
      const result = report.results[targetProtocol];
      return {
        ok: result?.ok ?? false,
        nativeId: result?.nativeId,
        nativeUri: result?.nativeUri,
        error: result?.error,
      };
    },
    env,
  );
  return result ?? { ok: false, error: 'Bridge publish returned null' };
}

// ─── Zora Special Bridge Handlers ────────────────────────────────────

async function bridgeToZora(source: SourceContent, protocol: string) {
  return {
    ok: true,
    nativeId: `zora:${protocol}:bridge`,
    nativeUri: `https://degenfeed.xyz/api/mint/x402?protocol=${protocol}&text=${encodeURIComponent(source.text.slice(0, 200))}`,
  };
}
async function bridgeFromZora(
  source: SourceContent,
  target: string,
  ta: Record<string, string>,
  env: Env,
) {
  return genericBridgePublish(source, 'zora', target, ta, env);
}

async function bridgeMastodonToZora(s: SourceContent, _auth: Record<string, string>, _e: Env) {
  return bridgeToZora(s, 'mastodon');
}
async function bridgeBlueskyToZora(s: SourceContent, _auth: Record<string, string>, _e: Env) {
  return bridgeToZora(s, 'bluesky');
}
async function bridgeNostrToZora(s: SourceContent, _auth: Record<string, string>, _e: Env) {
  return bridgeToZora(s, 'nostr');
}
async function bridgeFarcasterToZora(s: SourceContent, _auth: Record<string, string>, _e: Env) {
  return bridgeToZora(s, 'farcaster');
}
async function bridgeLensToZora(s: SourceContent, _auth: Record<string, string>, _e: Env) {
  return bridgeToZora(s, 'lens');
}
async function bridgeTelegramToZora(s: SourceContent, _auth: Record<string, string>, _e: Env) {
  return bridgeToZora(s, 'telegram');
}
async function bridgeZoraToMastodon(s: SourceContent, t: Record<string, string>, e: Env) {
  return bridgeFromZora(s, 'mastodon', t, e);
}
async function bridgeZoraToBluesky(s: SourceContent, t: Record<string, string>, e: Env) {
  return bridgeFromZora(s, 'bluesky', t, e);
}
async function bridgeZoraToNostr(s: SourceContent, t: Record<string, string>, e: Env) {
  return bridgeFromZora(s, 'nostr', t, e);
}
async function bridgeZoraToFarcaster(s: SourceContent, t: Record<string, string>, e: Env) {
  return bridgeFromZora(s, 'farcaster', t, e);
}
async function bridgeZoraToLens(s: SourceContent, t: Record<string, string>, e: Env) {
  return bridgeFromZora(s, 'lens', t, e);
}
async function bridgeZoraToTelegram(s: SourceContent, t: Record<string, string>, e: Env) {
  return bridgeFromZora(s, 'telegram', t, e);
}
async function bridgeZoraToRss(s: SourceContent, t: Record<string, string>, e: Env) {
  return bridgeFromZora(s, 'rss', t, e);
}

// ─── Bridge Handler ──────────────────────────────────────────────────

export function getBridgeHandler(
  sourceProtocol: string,
  targetProtocol: string,
): BridgeDirectionHandler | null {
  const ns = normalizeProtocol(sourceProtocol);
  const nt = normalizeProtocol(targetProtocol);
  if (ns === nt) return null;
  const key = `${ns}→${nt}`;
  const special: Record<string, BridgeDirectionHandler> = {
    'mastodon→zora': bridgeMastodonToZora,
    'bluesky→zora': bridgeBlueskyToZora,
    'nostr→zora': bridgeNostrToZora,
    'farcaster→zora': bridgeFarcasterToZora,
    'lens→zora': bridgeLensToZora,
    'telegram→zora': bridgeTelegramToZora,
    'zora→mastodon': bridgeZoraToMastodon,
    'zora→bluesky': bridgeZoraToBluesky,
    'zora→nostr': bridgeZoraToNostr,
    'zora→farcaster': bridgeZoraToFarcaster,
    'zora→lens': bridgeZoraToLens,
    'zora→telegram': bridgeZoraToTelegram,
    'zora→rss': bridgeZoraToRss,
  };
  if (special[key]) return special[key];
  return (source, targetAuth, env) => genericBridgePublish(source, ns, nt, targetAuth, env);
}

// ─── Main Bridge Function ────────────────────────────────────────────

export async function bridgeContent(input: BridgeContentInput, env: Env): Promise<BridgeReport> {
  const startedAt = Date.now();
  const results: BridgeResult[] = [];
  const targets = input.targets ?? [];

  if (targets.length === 0) {
    return { results: [], successCount: 0, failureCount: 1, startedAt, completedAt: Date.now() };
  }

  // Never bridge a protocol back to itself
  const effectiveTargets = targets.filter((t) => t !== normalizeProtocol(input.sourceProtocol));

  // Fetch source once, then publish to all targets in parallel — sequential
  // publishing multiplies retry backoff across dead endpoints.
  const source = await fetchSourceContent(
    input.sourceProtocol,
    input.sourceNativeId,
    input.auth ?? {},
    env,
  );

  const publishOne = async (targetProtocol: Protocol): Promise<void> => {
    if (!source) {
      results.push({
        ok: false,
        sourceProtocol: input.sourceProtocol,
        sourceNativeId: input.sourceNativeId,
        targetProtocol,
        error: 'Failed to fetch source content',
      });
      return;
    }
    const handler = getBridgeHandler(input.sourceProtocol, targetProtocol);
    if (!handler) {
      results.push({
        ok: false,
        sourceProtocol: input.sourceProtocol,
        sourceNativeId: input.sourceNativeId,
        targetProtocol,
        error: `No bridge handler for ${input.sourceProtocol}→${targetProtocol}`,
      });
      return;
    }
    try {
      const result = await handler(source, input.auth ?? {}, env);
      results.push({
        ok: result.ok,
        sourceProtocol: input.sourceProtocol,
        sourceNativeId: input.sourceNativeId,
        targetProtocol,
        nativeId: result.nativeId,
        nativeUri: result.nativeUri,
        error: result.error,
      });
      if (!result.ok)
        alertBridgeFailure(
          env,
          input.sourceProtocol,
          result.error || 'Unknown error',
          targetProtocol,
        );
    } catch (err) {
      results.push({
        ok: false,
        sourceProtocol: input.sourceProtocol,
        sourceNativeId: input.sourceNativeId,
        targetProtocol,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  };

  await Promise.all(effectiveTargets.map(publishOne));

  const successCount = results.filter((r) => r.ok).length;
  return {
    results,
    successCount,
    failureCount: results.length - successCount,
    startedAt,
    completedAt: Date.now(),
  };
}

export async function bridgeContentToAll(
  input: BridgeContentInput,
  env: Env,
): Promise<BridgeReport> {
  const allTargets: Protocol[] = (
    ['mastodon', 'bluesky', 'nostr', 'farcaster', 'lens', 'telegram', 'rss'] as Protocol[]
  ).filter((p) => p !== normalizeProtocol(input.sourceProtocol));
  return bridgeContent({ ...input, targets: allTargets }, env);
}

export async function handleBridgeWebhook(
  sourceProtocol: string,
  sourceNativeId: string,
  text: string,
  targets: Protocol[],
  auth: Record<string, string>,
  env: Env,
): Promise<BridgeReport> {
  return bridgeContent(
    {
      sourceUri: `df://${sourceProtocol}:${sourceNativeId}`,
      sourceProtocol: sourceProtocol as Protocol,
      sourceNativeId,
      text,
      auth,
      targets,
    },
    env,
  );
}

export { fetchReplies } from './bridge-replies';
