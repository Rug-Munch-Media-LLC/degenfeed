/**
 * @degenfeed/api-worker — Live chat protocol poll bridge barrel
 *
 * Binds the chat engine's `sendChatMessage` to the four external protocol
 * pollers. `unified-chat.ts` re-exports these four bound functions under
 * their original public names, so the public surface of the module is
 * unchanged; only the implementation moved behind this seam.
 *
 * The DI shape is deliberate: the bridges never import the engine, which
 * keeps `unified-chat.ts` -> bridges -> (no engine) acyclic and each bridge
 * independently testable with a fake sender.
 *
 * `MASTODON_INSTANCE_URL` is a wrangler.toml var the worker `Env` type does
 * not declare (same pre-existing gap as lib/frame-crosspost.ts), so the
 * resolved instance is typed at the seam rather than read off `env` here.
 */

import type { Env } from '../index';
import { type ActivityPubDeps, pollActivityPubChat as runActivityPub } from './activitypub-bridge';
import { type BlueskyDeps, pollBlueskyChat as runBluesky } from './bluesky-bridge';
import { type FarcasterDeps, pollFarcasterChat as runFarcaster } from './farcaster-bridge';
import { pollNostrChat as runNostr } from './nostr-bridge';
import { sendChatMessage } from './unified-chat';

const DEFAULT_FARCASTER_HUB = 'http://127.0.0.1:2281';
const DEFAULT_AP_INSTANCE = 'https://social.degenfeed.xyz';

/** Poll Nostr relays for NIP-53 replies to the live event. */
export function pollNostrChat(env: Env, streamId: string, eventId: string): Promise<number> {
  return runNostr(streamId, eventId, { env, send: sendChatMessage });
}

/** Poll the Farcaster hub for casts replying to the live stream. */
export function pollFarcasterChat(
  env: Env,
  streamId: string,
  parentCastHash?: string,
): Promise<number> {
  const deps: FarcasterDeps = {
    env,
    send: sendChatMessage,
    hubUrl: env.FARCASTER_HUB_URL || DEFAULT_FARCASTER_HUB,
  };
  return runFarcaster(streamId, parentCastHash, deps);
}

/** Poll Bluesky for replies/mentions on the live stream post. */
export function pollBlueskyChat(env: Env, streamId: string, bskyPostUri?: string): Promise<number> {
  const accessToken = env.BSKY_ACCESS_TOKEN;
  const senderDid = env.BSKY_DID;
  if (!accessToken || !senderDid) return Promise.resolve(0);

  const deps: BlueskyDeps = { env, send: sendChatMessage, accessToken, senderDid };
  return runBluesky(streamId, bskyPostUri, deps);
}

/** Poll Mastodon/ActivityPub for replies to the live stream post. */
export function pollActivityPubChat(
  env: Env,
  streamId: string,
  apPostId?: string,
): Promise<number> {
  const accessToken = env.GTS_ACCESS_TOKEN || env.MASTODON_ACCESS_TOKEN;
  if (!accessToken) return Promise.resolve(0);

  const deps: ActivityPubDeps = {
    env,
    send: sendChatMessage,
    accessToken,
    instance: env.GTS_INSTANCE_URL || DEFAULT_AP_INSTANCE,
  };
  return runActivityPub(streamId, apPostId, deps);
}
