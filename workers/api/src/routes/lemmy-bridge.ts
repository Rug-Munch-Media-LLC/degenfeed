/**
 * @degenfeed/api-worker — Lemmy Cross-Protocol Bridge
 *
 * Bridges content between Lemmy and other protocols:
 *   1. Cross-post DegenFeed content → Lemmy community
 *   2. Share Lemmy content → Mastodon / Nostr
 *   3. Auto-suggest best community for content
 *
 * Endpoints:
 *   POST /api/lemmy/bridge/cross-post   — Cross-post content TO a Lemmy community
 *   POST /api/lemmy/bridge/share        — Share a Lemmy post TO other protocols
 *   GET  /api/lemmy/bridge/status       — Bridge status and connected accounts
 */

import { LemmyClient } from '@degenfeed/lemmy-sdk';
import { jsonResponse } from '../response-helpers';
import { sanitizeString } from '../sanitize';
import { requireSession } from '../session';
import type { Env } from '../types';

// ─── Constants ─────────────────────────────────────────────────────────

const BRIDGE_INSTANCE = 'https://community.degenfeed.xyz';

/** Communities on our self-hosted instance that we bridge content to. */
const BRIDGE_COMMUNITIES = [
  { id: 'crypto', title: 'Crypto' },
  { id: 'defi', title: 'DeFi' },
  { id: 'nft', title: 'NFT' },
  { id: 'tech', title: 'Tech' },
  { id: 'news', title: 'News' },
  { id: 'memes', title: 'Memes' },
  { id: 'governance', title: 'Governance' },
  { id: 'security', title: 'Security' },
  { id: 'privacy', title: 'Privacy' },
  { id: 'gaming', title: 'Gaming' },
  { id: 'science', title: 'Science' },
  { id: 'trading', title: 'Trading' },
];

/** Niche keyword → community mapping for auto-suggestion. */
const NICHE_COMMUNITY_MAP: Record<string, string[]> = {
  crypto: ['crypto', 'bitcoin', 'ethereum', 'solana', 'web3', 'blockchain', 'nft', 'token', 'coin'],
  defi: ['defi', 'yield', 'liquidity', 'staking', 'lending', 'swap', 'amm', 'pool'],
  trading: ['trading', 'market', 'price', 'chart', 'analysis', 'signal', 'ta'],
  nft: ['nft', 'collectible', 'mint', 'art', 'digital art', 'generative'],
  tech: ['tech', 'programming', 'code', 'software', 'linux', 'ai', 'data', 'open source', 'rust'],
  security: ['security', 'hack', 'vulnerability', 'exploit', 'audit', 'malware', 'infosec'],
  privacy: ['privacy', 'private', 'anonymous', 'encryption', 'tor', 'signal'],
  gaming: ['gaming', 'game', 'play', 'esports', 'gamer', 'rpg', 'mmo'],
  science: ['science', 'research', 'study', 'physics', 'biology', 'space', 'nasa'],
  news: ['news', 'update', 'announcement', 'breaking', 'report', 'press'],
  memes: ['meme', 'funny', 'lol', 'humor', 'shitpost', 'dank'],
  governance: ['governance', 'dao', 'vote', 'proposal', 'treasury', 'democracy'],
};

const MAX_POST_LENGTH = 50000;

// ─── Helpers ───────────────────────────────────────────────────────────

function getClient(jwt?: string): LemmyClient {
  return new LemmyClient(BRIDGE_INSTANCE, jwt);
}

/** Determine the best community for a piece of content. */
function suggestCommunity(
  text: string,
  niches: string[],
): { id: string; title: string; confidence: number } {
  const textLower = text.toLowerCase();

  let bestScore = 0;
  let bestCommunity = 'crypto';

  for (const [comm, keywords] of Object.entries(NICHE_COMMUNITY_MAP)) {
    let score = 0;
    for (const kw of keywords) {
      // Count occurrences for weighted scoring
      let idx = 0;
      let count = 0;
      // biome-ignore lint/suspicious/noAssignInExpressions: standard indexOf scan loop
      while ((idx = textLower.indexOf(kw, idx)) !== -1) {
        count++;
        idx += kw.length;
      }
      score += count;
    }
    // Boost if niche label matches directly
    if (niches.some((n) => n.toLowerCase() === comm)) score += 3;
    if (score > bestScore) {
      bestScore = score;
      bestCommunity = comm;
    }
  }

  const confidence = Math.min(bestScore / 8, 1);
  const community = BRIDGE_COMMUNITIES.find((c) => c.id === bestCommunity);
  return {
    id: bestCommunity,
    title: community?.title ?? bestCommunity,
    confidence,
  };
}

/** Sanitize post body. */
function sanitizePostBody(raw: unknown): string {
  const str = sanitizeString(raw, MAX_POST_LENGTH) || '';
  return str
    .replace(/<[^>]*>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ─── POST /api/lemmy/bridge/cross-post — Cross-post TO Lemmy ─────────

export async function handleLemmyBridgeCrossPost(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  try {
    const body = (await request.json()) as {
      title?: string;
      body?: string;
      url?: string;
      communityId?: number;
      communityName?: string;
      autoSuggest?: boolean;
      niches?: string[];
      protocol?: string;
      sourcePostId?: string;
      jwt?: string;
    };

    const title = sanitizeString(body.title, 250);
    const postBody = sanitizePostBody(body.body);
    const url = body.url ? sanitizeString(body.url, 2048) : undefined;
    const jwt = body.jwt || env.LEMMY_BOT_JWT;
    const autoSuggest = body.autoSuggest ?? true;
    const niches = body.niches || [];

    if (!title && !url) {
      return jsonResponse({ error: 'title or url is required' }, 400);
    }

    if (!jwt) {
      return jsonResponse(
        { error: 'Lemmy auth required. Provide jwt or configure LEMMY_BOT_JWT' },
        401,
      );
    }

    const client = getClient(jwt);

    // Resolve community
    let resolvedCommunityId = body.communityId;
    let resolvedCommunityName = body.communityName;
    let suggestionUsed = false;

    if (!resolvedCommunityId && autoSuggest) {
      const suggestion = suggestCommunity(`${title} ${postBody} ${url || ''}`, niches);
      resolvedCommunityName = suggestion.id;
      suggestionUsed = true;
    }

    if (!resolvedCommunityId && resolvedCommunityName) {
      try {
        const communityView = await client.getCommunity(resolvedCommunityName);
        resolvedCommunityId = communityView.community.id;
      } catch {
        return jsonResponse(
          { error: `Community '${resolvedCommunityName}' not found on ${BRIDGE_INSTANCE}` },
          404,
        );
      }
    }

    if (!resolvedCommunityId) {
      return jsonResponse({ error: 'Could not determine target community' }, 400);
    }

    const displayTitle = title || (url ? new URL(url).hostname : 'Shared link');
    const created = await client.createPost({
      communityId: resolvedCommunityId,
      name: displayTitle,
      body: postBody || undefined,
      url,
      languageId: 37,
    });

    // Record the bridge in storage if source post ID is provided
    if (body.sourcePostId && env.CACHE) {
      try {
        const bridgeKey = `bridge:lemmy:${body.sourcePostId}`;
        await env.CACHE.put(
          bridgeKey,
          JSON.stringify({
            sourceProtocol: body.protocol || 'degenfeed',
            sourcePostId: body.sourcePostId,
            lemmyPostId: created.post.id,
            lemmyUrl: created.post.ap_id,
            communityName: created.community.name,
            createdAt: Date.now(),
          }),
          { expirationTtl: 60 * 60 * 24 * 365 },
        );
      } catch {
        // Non-fatal
      }
    }

    return jsonResponse({
      success: true,
      post: {
        id: created.post.id,
        name: created.post.name,
        url: created.post.ap_id,
        communityName: created.community.name,
        communityTitle: created.community.title,
        instance: BRIDGE_INSTANCE,
        permalink: `${BRIDGE_INSTANCE}/post/${created.post.id}`,
      },
      meta: {
        autoSuggested: suggestionUsed,
        sourcePostId: body.sourcePostId,
        createdAt: Date.now(),
      },
    });
  } catch (err) {
    return jsonResponse(
      {
        error: 'Failed to cross-post to Lemmy',
        message: err instanceof Error ? err.message : 'unknown',
      },
      502,
    );
  }
}

// ─── POST /api/lemmy/bridge/share — Share Lemmy post to other protocols

export async function handleLemmyBridgeShare(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  try {
    const body = (await request.json()) as {
      lemmyPostUrl?: string;
      lemmyPostTitle?: string;
      lemmyPostBody?: string;
      targets?: string[];
      communityName?: string;
    };

    const postUrl = sanitizeString(body.lemmyPostUrl, 2048);
    const title = sanitizeString(body.lemmyPostTitle, 500);
    const postBody = sanitizePostBody(body.lemmyPostBody);
    const targets = body.targets ?? ['mastodon'];
    const communityName = sanitizeString(body.communityName, 200);

    if (!postUrl && !title) {
      return jsonResponse({ error: 'lemmyPostUrl or lemmyPostTitle is required' }, 400);
    }

    // Build share text with attribution
    const instance = postUrl ? new URL(postUrl).hostname : BRIDGE_INSTANCE;
    const communityTag = communityName ? `c/${communityName}` : 'Lemmy';
    const shareParts: string[] = [];

    if (title) shareParts.push(title);
    if (postBody) {
      const excerpt = postBody.length > 200 ? `${postBody.slice(0, 200)}...` : postBody;
      shareParts.push(excerpt);
    }
    if (postUrl) {
      shareParts.push(`\n💬 Discuss on ${instance} — ${postUrl}`);
    } else {
      shareParts.push(`\n💬 Posted via DegenFeed`);
    }

    const shareText = shareParts.join('\n\n');

    // Publish to each target
    const results: Record<string, { ok: boolean; id?: string; error?: string; url?: string }> = {};

    for (const target of targets) {
      try {
        switch (target) {
          case 'mastodon': {
            const mastodonToken = env.GTS_BOT_TOKEN;
            if (!mastodonToken) {
              results.mastodon = { ok: false, error: 'GTS_BOT_TOKEN not configured' };
              break;
            }
            const { GtSClient } = await import('@degenfeed/mastodon-sdk');
            const gts = new GtSClient(
              env.GOTOSOCIAL_INSTANCE_URL || 'https://social.degenfeed.xyz',
              mastodonToken,
            );
            const status = await gts.publish(shareText, { visibility: 'public' });
            results.mastodon = {
              ok: true,
              id: status.id,
              url: status.url,
            };
            break;
          }

          case 'nostr': {
            // Publish kind 1 note via relay
            const { createTextNote, signEvent, getPublicKey } = await import(
              '@degenfeed/nostr-sdk'
            );
            const { RelayPool } = await import('@degenfeed/nostr-sdk');
            const relays = (env.RELAY_URLS || '').split(',').filter(Boolean);
            if (relays.length === 0) {
              results.nostr = { ok: false, error: 'No relay URLs configured' };
              break;
            }

            // Use bot key or generate ephemeral
            const nsec = env.NOSTR_BOT_NSEC;
            if (!nsec) {
              results.nostr = { ok: false, error: 'NOSTR_BOT_NSEC not configured' };
              break;
            }
            const { nsecDecode } = await import('@degenfeed/nostr-sdk');
            const { hex: secretKey } = nsecDecode(nsec);

            const event = createTextNote(secretKey, shareText, [
              ['t', 'lemmy'],
              ['t', 'degenfeed'],
              ['proxy', postUrl || '', 'activitypub'],
            ]);
            const signed = signEvent(event, secretKey);

            const pool = new RelayPool(relays);
            await pool.publish(signed);

            const _pubkey = getPublicKey(secretKey);
            results.nostr = {
              ok: true,
              id: signed.id,
              url: relays[0] ? `${relays[0]}/${signed.id}` : undefined,
            };
            break;
          }

          case 'atprotocol': {
            // Publish via AT Protocol (Bluesky PDS)
            const { PdsClient } = await import('@degenfeed/bluesky-sdk');
            const bskyIdentifier = env.BSKY_BOT_IDENTIFIER;
            const bskyPassword = env.BSKY_BOT_PASSWORD;
            if (!bskyIdentifier || !bskyPassword) {
              results.atprotocol = { ok: false, error: 'BSKY_BOT env vars not configured' };
              break;
            }
            const pds = new PdsClient('https://pds.degenfeed.xyz');
            // Create session via createSession
            const sessionRes = await fetch(
              'https://bsky.social/xrpc/com.atproto.server.createSession',
              {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ identifier: bskyIdentifier, password: bskyPassword }),
              },
            );
            if (!sessionRes.ok) {
              results.atprotocol = { ok: false, error: 'Bluesky auth failed' };
              break;
            }
            const sessionData = (await sessionRes.json()) as { accessJwt: string; did: string };
            pds.setAuth(sessionData.accessJwt);

            // Create a record (skeet) via com.atproto.repo.createRecord
            const recordRes = await fetch(
              'https://bsky.social/xrpc/com.atproto.repo.createRecord',
              {
                method: 'POST',
                headers: {
                  'content-type': 'application/json',
                  authorization: `Bearer ${sessionData.accessJwt}`,
                },
                body: JSON.stringify({
                  repo: sessionData.did,
                  collection: 'app.bsky.feed.post',
                  record: {
                    text: shareText.slice(0, 300),
                    createdAt: new Date().toISOString(),
                    facets: postUrl
                      ? [
                          {
                            index: { byteStart: 0, byteEnd: shareText.length },
                            features: [{ $type: 'app.bsky.richtext.facet#link', uri: postUrl }],
                          },
                        ]
                      : undefined,
                  },
                }),
              },
            );
            if (recordRes.ok) {
              const recordData = (await recordRes.json()) as { uri: string; cid: string };
              results.atprotocol = {
                ok: true,
                id: recordData.uri,
                url: `https://bsky.app/profile/${bskyIdentifier}/post/${recordData.cid}`,
              };
            } else {
              results.atprotocol = { ok: false, error: 'Bluesky record creation failed' };
            }
            break;
          }

          default:
            results[target] = { ok: false, error: `Unsupported target: ${target}` };
        }
      } catch (err) {
        results[target] = {
          ok: false,
          error: err instanceof Error ? err.message : 'unknown error',
        };
      }
    }

    return jsonResponse({
      success: true,
      shareText,
      results,
      meta: {
        lemmyUrl: postUrl,
        communityTag,
        instance,
        sharedAt: Date.now(),
      },
    });
  } catch (err) {
    return jsonResponse(
      {
        error: 'Failed to share Lemmy post',
        message: err instanceof Error ? err.message : 'unknown',
      },
      502,
    );
  }
}

// ─── GET /api/lemmy/bridge/status — Bridge status ─────────────────────

export async function handleLemmyBridgeStatus(_request: Request, env: Env): Promise<Response> {
  const configStatus: Record<string, { configured: boolean; instance?: string }> = {
    lemmyBotJwt: { configured: !!env.LEMMY_BOT_JWT, instance: BRIDGE_INSTANCE },
    mastodonBot: {
      configured: !!env.GTS_BOT_TOKEN,
      instance: env.GOTOSOCIAL_INSTANCE_URL || 'https://social.degenfeed.xyz',
    },
    nostrBot: {
      configured: !!env.NOSTR_BOT_NSEC,
      instance: (env.RELAY_URLS || '').split(',')[0] || undefined,
    },
    atprotocolBot: {
      configured: !!env.BSKY_BOT_IDENTIFIER && !!env.BSKY_BOT_PASSWORD,
      instance: 'bsky.social',
    },
  };

  return jsonResponse({
    bridge: {
      communities: BRIDGE_COMMUNITIES,
      instance: BRIDGE_INSTANCE,
    },
    bots: configStatus,
    connectedBots: Object.values(configStatus).filter((c) => c.configured).length,
    totalConfigured: Object.keys(configStatus).length,
    checkedAt: Date.now(),
  });
}
