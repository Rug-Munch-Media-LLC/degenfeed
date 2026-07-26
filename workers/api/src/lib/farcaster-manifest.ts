/**
 * @degenfeed/api-worker — Farcaster Frames v2 Manifest Builder
 *
 * Generates the manifest file at `/.well-known/farcaster.json` per
 * the Frames v2 / Mini Apps specification.
 *
 * The manifest declares metadata about the frame application and
 * includes an optional accountAssociation to verify domain ownership
 * via a JFS (JSON Farcaster Signature) signed by the developer's
 * Farcaster custody address.
 *
 * @see https://miniapps.farcaster.xyz/docs/specification
 * @see https://github.com/farcasterxyz/protocol/discussions/205
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export type AccountAssociation = {};
