/**
 * @degenfeed/api-worker — Cross-Protocol Holder Identity Routes
 *
 * One identity across all protocols. Endpoints for resolving and
 * displaying cross-protocol holder information.
 *
 * Routes:
 *   GET  /api/identity/cross-protocol/:wallet    — Get all identities for a wallet
 *   GET  /api/identity/resolve/:protocol/:id     — Resolve protocol identity → wallet
 *   GET  /api/identity/badges/:wallet/:coin       — Get holder badges
 *   GET  /api/leaderboard/cross-protocol/:coin    — Cross-protocol holder leaderboard
 *   GET  /api/identity/merge                      — Check if two identities share a wallet
 */

import { Hono } from 'hono';
import {
  getCrossProtocolLeaderboard,
  getHolderBadges,
  getHolderIdentities,
  resolveCommonWallet,
  resolveWalletFromProtocol,
} from '../lib/cross-protocol-holder';
import { jsonResponse, noCacheJsonResponse } from '../response-helpers';
import { sanitizeString } from '../sanitize';
import type { Env } from '../types';

// ─── Router ─────────────────────────────────────────────────────────────

export const crossProtocolIdentity = new Hono<{ Bindings: Env }>();

// ─── GET /api/identity/cross-protocol/:wallet ───────────────────────────
// Get all protocol identities linked to a wallet

crossProtocolIdentity.get('/cross-protocol/:wallet', async (c) => {
  const wallet = sanitizeString(c.req.param('wallet'), 64)?.toLowerCase();
  if (!wallet || !/^0x[a-f0-9]{40}$/.test(wallet)) {
    return jsonResponse({ error: 'Invalid wallet address' }, 400);
  }

  try {
    const identities = await getHolderIdentities(wallet, c.env);
    return noCacheJsonResponse({
      wallet,
      identities,
      protocolCount: identities.length,
      activeProtocols: identities.map((i) => i.protocol),
    });
  } catch (err) {
    console.warn('[cross-protocol-identity] Fetch failed:', String(err));
    return jsonResponse({ error: 'Failed to fetch identities' }, 500);
  }
});

// ─── GET /api/identity/resolve/:protocol/:id ────────────────────────────
// Resolve a protocol identity to a wallet address

crossProtocolIdentity.get('/resolve/:protocol/:id', async (c) => {
  const protocol = sanitizeString(c.req.param('protocol'), 32)?.toLowerCase();
  const identity = sanitizeString(c.req.param('id'), 256);
  if (!protocol || !identity) {
    return jsonResponse({ error: 'protocol and id are required' }, 400);
  }

  try {
    const wallet = await resolveWalletFromProtocol(protocol, identity, c.env);
    if (!wallet) {
      return noCacheJsonResponse({
        found: false,
        protocol,
        identity,
        wallet: null,
      });
    }

    // Get full identities for the resolved wallet
    const identities = await getHolderIdentities(wallet, c.env);

    return noCacheJsonResponse({
      found: true,
      protocol,
      identity,
      wallet,
      allIdentities: identities,
    });
  } catch (err) {
    console.warn('[cross-protocol-identity] Resolve failed:', String(err));
    return jsonResponse({ error: 'Failed to resolve identity' }, 500);
  }
});

// ─── GET /api/identity/badges/:wallet/:coin ─────────────────────────────
// Get holder badges for a wallet on a specific coin

crossProtocolIdentity.get('/badges/:wallet/:coin', async (c) => {
  const wallet = sanitizeString(c.req.param('wallet'), 64)?.toLowerCase();
  const coinAddress = sanitizeString(c.req.param('coin'), 64)?.toLowerCase();
  if (!wallet || !coinAddress) {
    return jsonResponse({ error: 'wallet and coin are required' }, 400);
  }

  try {
    const badges = await getHolderBadges(wallet, coinAddress, c.env);
    return noCacheJsonResponse({
      wallet,
      coinAddress,
      badges,
      badgeCount: badges.length,
    });
  } catch (err) {
    console.warn('[cross-protocol-identity] Badges failed:', String(err));
    return jsonResponse({ error: 'Failed to fetch badges' }, 500);
  }
});

// ─── GET /api/identity/merge ────────────────────────────────────────────
// Check if two protocol identities belong to the same person

crossProtocolIdentity.get('/merge', async (c) => {
  const protoA = sanitizeString(c.req.query('protoA'), 32);
  const idA = sanitizeString(c.req.query('idA'), 256);
  const protoB = sanitizeString(c.req.query('protoB'), 32);
  const idB = sanitizeString(c.req.query('idB'), 256);

  if (!protoA || !idA || !protoB || !idB) {
    return jsonResponse({ error: 'protoA, idA, protoB, idB are required' }, 400);
  }

  try {
    const commonWallet = await resolveCommonWallet(
      { protocol: protoA, identity: idA },
      { protocol: protoB, identity: idB },
      c.env,
    );

    return noCacheJsonResponse({
      samePerson: commonWallet !== null,
      commonWallet,
      identityA: { protocol: protoA, identity: idA },
      identityB: { protocol: protoB, identity: idB },
    });
  } catch (err) {
    console.warn('[cross-protocol-identity] Merge check failed:', String(err));
    return jsonResponse({ error: 'Failed to check identity merge' }, 500);
  }
});

// ─── GET /api/leaderboard/cross-protocol/:coin ──────────────────────────
// Cross-protocol holder leaderboard

crossProtocolIdentity.get('/leaderboard/cross-protocol/:coin', async (c) => {
  const coinAddress = sanitizeString(c.req.param('coin'), 64)?.toLowerCase();
  if (!coinAddress) {
    return jsonResponse({ error: 'coin address is required' }, 400);
  }

  const limit = Math.min(Number(c.req.query('limit')) || 50, 100);

  try {
    const leaderboard = await getCrossProtocolLeaderboard(coinAddress, c.env, limit);
    return noCacheJsonResponse({
      coinAddress,
      leaderboard,
      total: leaderboard.length,
    });
  } catch (err) {
    console.warn('[cross-protocol-identity] Leaderboard failed:', String(err));
    return jsonResponse({ error: 'Failed to fetch leaderboard' }, 500);
  }
});
