/**
 * @degenfeed/api-worker - Coins route registration
 *
 * Register Coins-related routes on the Hono app instance.
 */

import type { Hono } from 'hono';
import {
  handleCreatorRewards,
  handleCreatorRewardsClaim,
  handleCreatorRewardsCompute,
  handleCreatorRewardsHistory,
  handleCreatorRewardsLeaderboard,
} from '../../lib/creator-rewards';
import { ok, serverError } from '../../response-helpers';
import { coinDiscovery } from '../../routes/coin-discovery';
import {
  handleCoinStatsGainers,
  handleCoinStatsHighestVolume,
  handleCoinStatsLosers,
  handleCoinStatsMostHolders,
  handleCoinStatsNew,
  handleCoinStatsOverview,
  handleCoinStatsTop,
  handleCoinStatsTrending,
} from '../../routes/coin-stats';
import {
  handleCreatorCoinAirdrop,
  handleCreatorCoinBurn,
  handleCreatorCoinGatedPost,
  handleCreatorCoinHolders,
  handleCreatorCoinRevenue,
  handleCreatorCoinStats,
  handleCreatorCoinsList,
  handleCreatorCoinTrades,
} from '../../routes/creator-dashboard';
import { creatorVideos } from '../../routes/creator-videos';
import { crossProtocolCoin } from '../../routes/cross-protocol-coin';
import { crossProtocolIdentity } from '../../routes/cross-protocol-identity';
import {
  handleFarcasterCoinDeploy,
  handleFarcasterCoinGet,
  handleFarcasterCoinTip,
} from '../../routes/farcaster-coin';
import { handleLensCoinDeploy, handleLensCoinGet, handleLensCoinTip } from '../../routes/lens-coin';
import peertubeStreams from '../../routes/peertube-streams';
import { handlePrices } from '../../routes/prices';
import { withSession } from '../../routes/route-registry';
import tokenCommunity from '../../routes/token-community';
import {
  handleTokenGateContent,
  handleTokenGateDelete,
  handleTokenGateGet,
  handleTokenGateResolve,
  handleTokenGateVerify,
  handleTokenGateVerifyMulti,
} from '../../routes/token-gate';
import type { Env } from '../../types';

export function registerCoinsRoutes(app: Hono<{ Bindings: Env }>): void {
  // --- API: Creator Rewards Program ---
  app.get('/api/creator/rewards', async (c) => {
    try {
      return await withSession(c, () => handleCreatorRewards(c.req.raw, c.env));
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/creator/rewards/history', async (c) => {
    try {
      const result = await handleCreatorRewardsHistory(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/creator/rewards/claim', async (c) => {
    try {
      return await withSession(c, () => handleCreatorRewardsClaim(c.req.raw, c.env));
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/creator/rewards/leaderboard', async (c) => {
    try {
      const result = await handleCreatorRewardsLeaderboard(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/creator/rewards/compute', async (c) => {
    try {
      return await withSession(c, () => handleCreatorRewardsCompute(c.req.raw, c.env));
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });

  // --- API: Farcaster Creator Coins ---
  app.post('/api/farcaster/coin/deploy', async (c) => {
    try {
      return await withSession(c, () => handleFarcasterCoinDeploy(c.req.raw, c.env));
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/farcaster/coin/:fid', async (c) => {
    try {
      const result = await handleFarcasterCoinGet(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/farcaster/coin/:fid/tip', async (c) => {
    try {
      return await withSession(c, () => handleFarcasterCoinTip(c.req.raw, c.env));
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });

  // --- API: Lens Protocol Creator Coins ---
  app.post('/api/lens/coin/deploy', async (c) => {
    try {
      return await withSession(c, () => handleLensCoinDeploy(c.req.raw, c.env));
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/lens/coin/:profileId', async (c) => {
    try {
      const result = await handleLensCoinGet(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/lens/coin/:profileId/tip', async (c) => {
    try {
      return await withSession(c, () => handleLensCoinTip(c.req.raw, c.env));
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });

  // --- API: Cross-Protocol Creator Coins ---
  app.route('/api/coin', crossProtocolCoin);

  // --- API: Per-Protocol Coin Discovery ---
  app.route('/api/coin', coinDiscovery);

  // --- API: Cross-Protocol Holder Identity ---
  app.route('/api/identity', crossProtocolIdentity);

  // --- API: Token Gate ---
  app.post('/api/token-gate/verify', async (c) => {
    try {
      const result = await handleTokenGateVerify(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/token-gate/verify-multi', async (c) => {
    try {
      const result = await handleTokenGateVerifyMulti(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/token-gate/gate-content', async (c) => {
    try {
      const result = await handleTokenGateContent(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/token-gate/gate/:contentType/:contentId', async (c) => {
    try {
      const result = await handleTokenGateGet(
        c.req.raw,
        c.env,
        c.req.param('contentType'),
        c.req.param('contentId'),
      );
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.delete('/api/token-gate/gate/:contentType/:contentId', async (c) => {
    try {
      const result = await handleTokenGateDelete(
        c.req.raw,
        c.env,
        c.req.param('contentType'),
        c.req.param('contentId'),
      );
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/token-gate/resolve', async (c) => {
    try {
      const result = await handleTokenGateResolve(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });

  // --- API: Creator Videos (upload, manage, analytics) ---
  app.route('/api/creator/videos', creatorVideos);

  // --- API: Creator Coin Dashboard (TASK 3) ---
  app.get('/api/creator/coins', async (c) => {
    try {
      const result = await handleCreatorCoinsList(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/creator/coin/:address/stats', async (c) => {
    try {
      const result = await handleCreatorCoinStats(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/creator/coin/:address/holders', async (c) => {
    try {
      const result = await handleCreatorCoinHolders(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/creator/coin/:address/trades', async (c) => {
    try {
      const result = await handleCreatorCoinTrades(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/creator/coin/:address/burn', async (c) => {
    try {
      return await withSession(c, () => handleCreatorCoinBurn(c.req.raw, c.env));
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/creator/coin/:address/airdrop', async (c) => {
    try {
      return await withSession(c, () => handleCreatorCoinAirdrop(c.req.raw, c.env));
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/creator/coin/:address/gated-post', async (c) => {
    try {
      return await withSession(c, () => handleCreatorCoinGatedPost(c.req.raw, c.env));
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/creator/coin/:address/revenue', async (c) => {
    try {
      const result = await handleCreatorCoinRevenue(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });

  // --- API: Coin Statistics & Leaderboard (TASK 5) ---
  app.get('/api/coins/stats/overview', async (c) => {
    try {
      const result = await handleCoinStatsOverview(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/coins/stats/top', async (c) => {
    try {
      const result = await handleCoinStatsTop(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/coins/stats/trending', async (c) => {
    try {
      const result = await handleCoinStatsTrending(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/coins/stats/new', async (c) => {
    try {
      const result = await handleCoinStatsNew(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/coins/stats/gainers', async (c) => {
    try {
      const result = await handleCoinStatsGainers(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/coins/stats/losers', async (c) => {
    try {
      const result = await handleCoinStatsLosers(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/coins/stats/most-holders', async (c) => {
    try {
      const result = await handleCoinStatsMostHolders(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/coins/stats/highest-volume', async (c) => {
    try {
      const result = await handleCoinStatsHighestVolume(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });

  // --- API: Token Community (engagement layer) ---
  app.route('/api/token/community', tokenCommunity);

  // --- API: PeerTube Livestreams (creator token streaming) ---
  app.route('/api/token/streams', peertubeStreams);

  // --- API: Prices ---
  app.all('/api/prices', async (c) => {
    try {
      const result = await handlePrices(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
}
