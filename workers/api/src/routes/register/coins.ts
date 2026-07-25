/**
 * @degenfeed/api-worker - Coins route registration
 *
 * Register Coins-related routes on the Hono app instance.
 */

import type { Hono } from 'hono';
import type { Env } from '../../index';

import {
  handleCreatorRewards,
  handleCreatorRewardsClaim,
  handleCreatorRewardsCompute,
  handleCreatorRewardsHistory,
  handleCreatorRewardsLeaderboard,
} from '../../lib/creator-rewards';
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

export function registerCoinsRoutes(app: Hono<{ Bindings: Env }>): void {
  // --- API: Creator Rewards Program ---
  app.get('/api/creator/rewards', async (c) =>
    withSession(c, () => handleCreatorRewards(c.req.raw, c.env)),
  );
  app.get('/api/creator/rewards/history', async (c) =>
    handleCreatorRewardsHistory(c.req.raw, c.env),
  );
  app.post('/api/creator/rewards/claim', async (c) =>
    withSession(c, () => handleCreatorRewardsClaim(c.req.raw, c.env)),
  );
  app.get('/api/creator/rewards/leaderboard', async (c) =>
    handleCreatorRewardsLeaderboard(c.req.raw, c.env),
  );
  app.post('/api/creator/rewards/compute', async (c) =>
    withSession(c, () => handleCreatorRewardsCompute(c.req.raw, c.env)),
  );

  // --- API: Farcaster Creator Coins ---
  app.post('/api/farcaster/coin/deploy', async (c) =>
    withSession(c, () => handleFarcasterCoinDeploy(c.req.raw, c.env)),
  );
  app.get('/api/farcaster/coin/:fid', async (c) => handleFarcasterCoinGet(c.req.raw, c.env));
  app.post('/api/farcaster/coin/:fid/tip', async (c) =>
    withSession(c, () => handleFarcasterCoinTip(c.req.raw, c.env)),
  );

  // --- API: Lens Protocol Creator Coins ---
  app.post('/api/lens/coin/deploy', async (c) =>
    withSession(c, () => handleLensCoinDeploy(c.req.raw, c.env)),
  );
  app.get('/api/lens/coin/:profileId', async (c) => handleLensCoinGet(c.req.raw, c.env));
  app.post('/api/lens/coin/:profileId/tip', async (c) =>
    withSession(c, () => handleLensCoinTip(c.req.raw, c.env)),
  );

  // --- API: Cross-Protocol Creator Coins ---
  app.route('/api/coin', crossProtocolCoin);

  // --- API: Token Gate ---
  app.post('/api/token-gate/verify', async (c) => handleTokenGateVerify(c.req.raw, c.env));
  app.post('/api/token-gate/verify-multi', async (c) =>
    handleTokenGateVerifyMulti(c.req.raw, c.env),
  );
  app.post('/api/token-gate/gate-content', async (c) => handleTokenGateContent(c.req.raw, c.env));
  app.get('/api/token-gate/gate/:contentType/:contentId', async (c) =>
    handleTokenGateGet(c.req.raw, c.env, c.req.param('contentType'), c.req.param('contentId')),
  );
  app.delete('/api/token-gate/gate/:contentType/:contentId', async (c) =>
    handleTokenGateDelete(c.req.raw, c.env, c.req.param('contentType'), c.req.param('contentId')),
  );
  app.post('/api/token-gate/resolve', async (c) => handleTokenGateResolve(c.req.raw, c.env));

  // --- API: Creator Videos (upload, manage, analytics) ---
  app.route('/api/creator/videos', creatorVideos);

  // --- API: Creator Coin Dashboard (TASK 3) ---
  app.get('/api/creator/coins', async (c) => handleCreatorCoinsList(c.req.raw, c.env));
  app.get('/api/creator/coin/:address/stats', async (c) =>
    handleCreatorCoinStats(c.req.raw, c.env),
  );
  app.get('/api/creator/coin/:address/holders', async (c) =>
    handleCreatorCoinHolders(c.req.raw, c.env),
  );
  app.get('/api/creator/coin/:address/trades', async (c) =>
    handleCreatorCoinTrades(c.req.raw, c.env),
  );
  app.post('/api/creator/coin/:address/burn', async (c) => handleCreatorCoinBurn(c.req.raw, c.env));
  app.post('/api/creator/coin/:address/airdrop', async (c) =>
    handleCreatorCoinAirdrop(c.req.raw, c.env),
  );
  app.post('/api/creator/coin/:address/gated-post', async (c) =>
    handleCreatorCoinGatedPost(c.req.raw, c.env),
  );
  app.get('/api/creator/coin/:address/revenue', async (c) =>
    handleCreatorCoinRevenue(c.req.raw, c.env),
  );

  // --- API: Coin Statistics & Leaderboard (TASK 5) ---
  app.get('/api/coins/stats/overview', async (c) => handleCoinStatsOverview(c.req.raw, c.env));
  app.get('/api/coins/stats/top', async (c) => handleCoinStatsTop(c.req.raw, c.env));
  app.get('/api/coins/stats/trending', async (c) => handleCoinStatsTrending(c.req.raw, c.env));
  app.get('/api/coins/stats/new', async (c) => handleCoinStatsNew(c.req.raw, c.env));
  app.get('/api/coins/stats/gainers', async (c) => handleCoinStatsGainers(c.req.raw, c.env));
  app.get('/api/coins/stats/losers', async (c) => handleCoinStatsLosers(c.req.raw, c.env));
  app.get('/api/coins/stats/most-holders', async (c) =>
    handleCoinStatsMostHolders(c.req.raw, c.env),
  );
  app.get('/api/coins/stats/highest-volume', async (c) =>
    handleCoinStatsHighestVolume(c.req.raw, c.env),
  );

  // --- API: Token Community (engagement layer) ---
  app.route('/api/token', tokenCommunity);

  // --- API: PeerTube Livestreams (creator token streaming) ---
  app.route('/api/token', peertubeStreams);

  // --- API: Prices ---
  app.all('/api/prices', async (c) => handlePrices(c.req.raw, c.env));
}
