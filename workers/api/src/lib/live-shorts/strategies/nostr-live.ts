/**
 * @degenfeed/api-worker — Nostr Live Short Strategy
 *
 * Nostr has NATIVE live streaming support via Kind 30311 (parameterized
 * replaceable events per NIP-93). Many Nostr clients (Damus, Primal, Amethyst)
 * already render Kind 30311 events with inline video players. This is the
 * best possible live experience on Nostr.
 *
 * Strategy: Use Nostr's native Kind 30311 live event format with short-form
 * extensions:
 *   - `t: short` tag for client filtering
 *   - `duration: 60` tag for short-form awareness
 *   - `streaming` tag points to HLS URL
 *   - `status: live` → `status: ended` transition
 *   - `current_participants` for live viewer counts
 *
 * Native live support: FULL — Kind 30311 is the nostr native live event.
 */

import type { NostrEvent } from "@degenfeed/nostr-sdk";
import type { Env } from "../../../index";
import type { ProtocolStrategy, LiveSessionInfo, ViewerCountResult } from "../live-strategy";
import { LIVE_SHORT_STRATEGIES } from "../protocol-strategies";

const STRATEGY = LIVE_SHORT_STRATEGIES.nostr;

const DEFAULT_RELAYS = "wss://relay.damus.io,wss://nos.lol,wss://relay.primal.net,wss://relay.degenfeed.xyz";

/**
 * Nostr live short strategy using Kind 30311.
 */
export const nostrLiveStrategy: ProtocolStrategy = {
  config: STRATEGY,

  async announceLive(
    env: Env,
    sessionId: string,
    creator: string,
    creatorHandle: string,
    title: string,
    playbackUrl: string,
    duration: number,
  ): Promise<LiveSessionInfo> {
    try {
      const nostr = await import("@degenfeed/nostr-sdk");
      const nsec = env.NOSTR_PRIVATE_KEY ?? "";

      if (!nsec) {
        return {
          protocolId: "",
          protocolUrl: "",
          announced: false,
          error: "NOSTR_PRIVATE_KEY not configured",
        };
      }

      const pubkey = nostr.getPublicKey(nsec);
      const relayUrls = (env.RELAY_URLS || DEFAULT_RELAYS)
        .split(",")
        .map((u: string) => u.trim())
        .filter(Boolean);

      // Build Kind 30311 — parameterized replaceable live event
      // NIP-93: The 'd' tag uniquely identifies the live event.
      // Re-publishing with the same 'd' replaces the previous event.
      const tags: string[][] = [
        ["d", `degenfeed-live-${sessionId}`],
        ["title", title],
        ["summary", `Live short by ${creatorHandle} on DegenFeed`],
        ["streaming", playbackUrl],
        ["status", "live"],
        ["current_participants", "1"],
        ["t", "short"],
        ["t", "liveshort"],
        ["t", "degenfeed"],
        ["duration", String(Math.min(duration, 120))],
        ["p", pubkey],
        ["relays", relayUrls[0] ?? "wss://relay.degenfeed.xyz"],
        ["image", `https://app.degenfeed.xyz/og/live/${sessionId}`],
      ];

      const content = [
        `🔴 LIVE SHORT: ${title}`,
        "",
        `${creatorHandle} is streaming on DegenFeed`,
        "",
        `Duration: ${duration}s`,
        `Watch: ${playbackUrl}`,
      ].join("\n");

      const unsigned = {
        pubkey,
        created_at: Math.floor(Date.now() / 1000),
        kind: 30311,
        tags,
        content,
      };

      const signed = nostr.signEvent(unsigned, nsec);

      // Publish to relay pool
      const pool = new nostr.RelayPool(relayUrls, { eoseTimeout: 5000 });
      await pool.publish(signed);
      pool.disconnectAll();

      return {
        protocolId: signed.id,
        protocolUrl: `nostr:${signed.id}`,
        announced: true,
      };
    } catch (err) {
      return {
        protocolId: "",
        protocolUrl: "",
        announced: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  },

  async updateEnded(
    env: Env,
    sessionId: string,
    protocolId: string,
    title: string,
    recordingUrl: string,
  ): Promise<void> {
    // Re-publish with status=ended (replaceable event)
    try {
      const nostr = await import("@degenfeed/nostr-sdk");
      const nsec = env.NOSTR_PRIVATE_KEY ?? "";
      if (!nsec || !protocolId) return;

      const pubkey = nostr.getPublicKey(nsec);
      const relayUrls = (env.RELAY_URLS || DEFAULT_RELAYS)
        .split(",")
        .map((u: string) => u.trim())
        .filter(Boolean);

      const tags: string[][] = [
        ["d", `degenfeed-live-${sessionId}`],
        ["status", "ended"],
        ["ended_at", String(Math.floor(Date.now() / 1000))],
        ["title", title],
        ["t", "short"],
        ["t", "degenfeed"],
        ["recording", recordingUrl],
        ["p", pubkey],
      ];

      const content = [
        `✅ RECORDING: ${title}`,
        "",
        `Watch the recording: ${recordingUrl}`,
      ].join("\n");

      const unsigned = {
        pubkey,
        created_at: Math.floor(Date.now() / 1000),
        kind: 30311,
        tags,
        content,
      };

      const signed = nostr.signEvent(unsigned, nsec);
      const pool = new nostr.RelayPool(relayUrls, { eoseTimeout: 5000 });
      await pool.publish(signed);
      pool.disconnectAll();
    } catch {
      // Non-critical
    }
  },

  async getViewerCount(
    env: Env,
    protocolId: string,
  ): Promise<ViewerCountResult> {
    // Fetch the Kind 30311 event and read current_participants
    if (!protocolId) return { count: 0, rawSignal: 0 };

    try {
      const nostr = await import("@degenfeed/nostr-sdk");
      const relayUrls = (env.RELAY_URLS || DEFAULT_RELAYS)
        .split(",")
        .map((u: string) => u.trim())
        .filter(Boolean);

      const pool = new nostr.RelayPool(relayUrls, { eoseTimeout: 3000 });
      const events = await pool.list([{ ids: [protocolId], kinds: [30311], limit: 1 }]);
      pool.disconnectAll();

      const event = events[0] as NostrEvent | undefined;
      if (!event) return { count: 0, rawSignal: 0 };

      const participants = event.tags?.find((t: string[]) => t[0] === "current_participants");
      const count = participants?.[1] ? parseInt(participants[1], 10) : 0;

      return {
        count: Number.isFinite(count) ? count : 0,
        rawSignal: count,
      };
    } catch {
      return { count: 0, rawSignal: 0 };
    }
  },

  async postTipNotification(
    env: Env,
    protocolId: string,
    tipper: string,
    amount: string,
    chain: string,
    message?: string,
  ): Promise<void> {
    // Post a kind 9734 zap request or kind 1 reaction with tip info
    try {
      const nostr = await import("@degenfeed/nostr-sdk");
      const nsec = env.NOSTR_PRIVATE_KEY ?? "";
      if (!nsec || !protocolId) return;

      const pubkey = nostr.getPublicKey(nsec);
      const relayUrls = (env.RELAY_URLS || DEFAULT_RELAYS)
        .split(",")
        .map((u: string) => u.trim())
        .filter(Boolean);

      const content = message
        ? `⚡ ${amount} ${chain} tip from ${tipper.slice(0, 8)}...: ${message}`
        : `⚡ ${amount} ${chain} tip received!`;

      const unsigned = {
        pubkey,
        created_at: Math.floor(Date.now() / 1000),
        kind: 1,
        tags: [
          ["e", protocolId],
          ["p", pubkey],
          ["t", "tip"],
          ["amount", amount],
          ["chain", chain],
        ],
        content,
      };

      const signed = nostr.signEvent(unsigned, nsec);
      const pool = new nostr.RelayPool(relayUrls, { eoseTimeout: 3000 });
      await pool.publish(signed);
      pool.disconnectAll();
    } catch {
      // Non-critical
    }
  },
};
