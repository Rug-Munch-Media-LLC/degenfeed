/**
 * @degenfeed/api-worker — Hubble Cast Publisher
 *
 * Signs and submits Farcaster casts to our self-hosted Hubble.
 * Self-hosted Farcaster publishing — no external API dependency.
 *
 * Uses the DegenFeed bot signer key for automated publishing.
 * The bot must have a registered signer on Farcaster.
 *
 * Env vars required:
 *   FARCASTER_BOT_FID        — FID for the bot account
 *   FARCASTER_BOT_SIGNER_KEY — ED25519 private key hex for the bot signer
 *   FARCASTER_BOT_HUB_URL    — Hubble URL (default: http://127.0.0.1:2281)
 */

const DEFAULT_HUB_URL = 'http://127.0.0.1:2281';

export type PublishCastOptions = {};
