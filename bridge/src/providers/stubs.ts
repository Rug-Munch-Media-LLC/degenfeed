/**
 * @deprecated All stub providers have been replaced with real implementations.
 *
 * Old stubs: fetchNostrPosts, fetchFarcasterPosts, fetchLensPosts, fetchPixelfedPosts
 * New providers:
 *   - ./nostr.ts   — connects to self-hosted relay + public relays via WebSocket
 *   - ./farcaster.ts — uses self-hosted Hubble REST API
 *   - ./lens.ts    — uses Lens v2 GraphQL API
 *   - ./pixelfed.ts — uses public Pixelfed instances via Mastodon-compatible API
 *
 * This file exists only to prevent import errors if something still references it.
 * All imports in server.ts point to the individual provider files directly.
 */
export {};
