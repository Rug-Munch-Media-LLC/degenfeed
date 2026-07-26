/**
 * @degenfeed/api-worker — Lemmy Registration & Auth
 *
 * Handles account creation and authentication for the self-hosted Lemmy instance
 * at community.degenfeed.xyz (talk.degenfeed.xyz).
 *
 * Endpoints:
 *   POST /api/lemmy/register     — Create a Lemmy account (auto-provisioned on signup)
 *   POST /api/lemmy/auth         — Login to an existing Lemmy account
 *   POST /api/lemmy/logout       — Invalidate Lemmy session
 *   GET  /api/lemmy/auth/status  — Check if the user's Lemmy account exists and is healthy
 *
 * Flow:
 *   1. User signs up for DegenFeed → wallet-based session
 *   2. POST /api/lemmy/register creates @username@lemmy.degenfeed.xyz
 *   3. Credentials encrypted and stored in PLATFORM_ACCOUNTS KV
 *   4. User can auth via POST /api/lemmy/auth (returns JWT)
 *   5. JWT used for all write operations (post, comment, vote)
 */

import { generateKeyPairBetween } from '@degenfeed/utils';
import { sealForWallet } from '../lib/crypto-seal';
import { log } from '../logger';
import { jsonResponse, noCacheJsonResponse } from '../response-helpers';
import { requireSession } from '../session';
import type { Env } from '../types';

// ─── Constants ─────────────────────────────────────────────────────────

const LEMMY_INSTANCE_URL = 'https://community.degenfeed.xyz';
const LEMMY_API = `${LEMMY_INSTANCE_URL}/api/v3`;

const USERNAME_REGEX = /^[a-zA-Z0-9_\-.]{2,30}$/;

const LEMMY_FEDERATED_INSTANCES = [
  'lemmy.ml',
  'lemmy.world',
  'beehaw.org',
  'sh.itjust.works',
  'programming.dev',
  'lemmy.zip',
  'discuss.tchncs.de',
  'feddit.org',
  'lemmy.ca',
  'lemmy.one',
  'lemmy.dbzer0.com',
  'sopuli.xyz',
  'midwest.social',
  'startrek.website',
  'fedia.io',
];

// ─── POST /api/lemmy/register — Create Lemmy account ─────────────────

export async function handleLemmyRegister(request: Request, env: Env): Promise<Response> {
