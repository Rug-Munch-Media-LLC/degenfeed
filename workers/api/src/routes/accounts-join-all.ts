/**
 * @degenfeed/api-worker — Join All Networks
 *
 * One-click account creation on ALL self-hosted protocols.
 * Users sign up once on DegenFeed and get accounts everywhere.
 *
 * Routes:
 *   POST /api/accounts/join-all     — One-click: create accounts on ALL networks
 *   GET  /api/accounts/join-all/status — Check which networks are joined
 *   POST /api/accounts/join-all/retry  — Retry failed network registrations
 *
 * Protocols provisioned:
 *   Bluesky (PDS), Mastodon (GTS), Farcaster (Hubble), Lens, PeerTube,
 *   Lemmy, Pixelfed, WriteFreely, BookWyrm, Mobilizon, Owncast,
 *   Funkwhale, Castopod, Nostr
 *
 * Every account is auto-linked to the user's DegenFeed wallet.
 * One SSO session spans all networks.
 */

import { registerOnPlatform } from '@degenfeed/crossplatform-register';
import { identityKey } from '@degenfeed/utils';
import { sealForWallet } from '../lib/crypto-seal';
import { log } from '../logger';
import { checkPremiumStatus } from '../premium';
import { jsonResponse, noCacheJsonResponse } from '../response-helpers';
import { requireSession } from '../session';
import type { Env } from '../types';

// ─── All protocols in registration order ─────────────────────────────────

const ALL_PROTOCOLS = [
  'mastodon', // GoToSocial — ActivityPub social
  'bluesky', // AT Protocol PDS
  'nostr', // Nostr relay
  'lemmy', // Lemmy — federated communities
  'peertube', // PeerTube — federated video
  'pixelfed', // Pixelfed — federated images
  'writefreely', // WriteFreely — federated blogging
  'bookwyrm', // BookWyrm — federated book reviews
  'funkwhale', // Funkwhale — federated music
  'mobilizon', // Mobilizon — federated events
  'owncast', // Owncast — live streaming
  'castopod', // Castopod — federated podcasts
  'farcaster', // Farcaster — on-chain social (Premium)
  'lens', // Lens — on-chain social (Premium)
] as const;

const PREMIUM_PROTOCOLS = new Set(['farcaster', 'lens']);

const PROTOCOL_INSTANCES: Record<string, string> = {
