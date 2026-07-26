/**
 * @degenfeed/api-worker — Farcaster Coin Frame Handlers
 */
import type { Hono } from 'hono';
import { generateFrameHtml } from '../../lib/farcaster-live';
import { jsonResponse, noCacheJsonResponse } from '../response-helpers';
import type { Env } from '../types';
import { getCreatorCoin } from './utils';

export function registerCoinFrameRoutes(frames: Hono<{ Bindings: Env }>): void {
  // ═══════════════════════════════════════════════════════════════════════════
  // GET /api/farcaster/frames/coin/:symbol — Frame for a creator coin
  // ═══════════════════════════════════════════════════════════════════════════

  frames.get('/coin/:symbol', async (c) => {
    const symbol = c.req.param('symbol').toUpperCase();
    const coin = await getCreatorCoin(c.env, symbol);

    const title = coin
      ? `$${symbol} — ${(coin.name as string) || 'Creator Coin'}`
      : `$${symbol} — DegenFeed Creator Coin`;

    const image = coin
      ? `https://app.degenfeed.xyz/api/badge/${symbol}`
      : 'https://app.degenfeed.xyz/og/coin-default.png';

    const progress = (coin?.progress as number) || 0;
    const holders = (coin?.supporters as number) || 0;
    const coinUrl = `https://app.degenfeed.xyz/launch/${symbol}`;

    const html = generateFrameHtml({
      image,
      imageAspectRatio: '1:1',
      title,
      description: coin
        ? `$${symbol} — ${(coin.description as string) || 'Creator coin on DegenFeed'}`
        : `Create $${symbol} on DegenFeed`,
      buttons: [
        {
          index: 1,
          label: coin ? `🪙 Buy $${symbol}` : `🪙 Launch $${symbol}`,
          action: 'link',
          target: coinUrl,
        },
        ...(coin
          ? [
              {
                index: 2,
                label: `📊 Progress: ${progress}%`,
                action: 'post',
              } as const,
              {
                index: 3,
                label: `👥 ${holders} holders`,
                action: 'post',
              } as const,
            ]
          : []),
      ],
    });

    return c.html(html);
  });

  // POST handler for /coin/:symbol — show coin details
  frames.post('/coin/:symbol', async (c) => {
    const symbol = c.req.param('symbol').toUpperCase();
    const coin = await getCreatorCoin(c.env, symbol);

    if (!coin) {
      return c.html(
        generateFrameHtml({
          image: 'https://app.degenfeed.xyz/og/coin-not-found.png',
          title: `$${symbol} not found`,
          buttons: [
            {
              index: 1,
              label: '← Back',
              action: 'link',
              target: 'https://app.degenfeed.xyz/launch',
            },
          ],
        }),
      );
    }

    const _progress = (coin.progress as number) || 0;
    const holders = (coin.supporters as number) || 0;
    const totalTips = (coin.totalTips as number) || 0;
    const totalTipsUsd = (coin.totalTipsUsd as number) || 0;
    const price = (coin.price as string) || '0';
    const coinUrl = `https://app.degenfeed.xyz/launch/${symbol}`;

    const html = generateFrameHtml({
      image: `https://app.degenfeed.xyz/api/badge/${symbol}`,
      imageAspectRatio: '1:1',
      title: `$${symbol} Details`,
      description: `${holders} holders · ${totalTips} tips · $${totalTipsUsd} total`,
      buttons: [
        {
          index: 1,
          label: `🪙 Buy $${symbol}`,
          action: 'link',
          target: coinUrl,
        },
        {
          index: 2,
          label: `💰 Price: $${price}`,
          action: 'post',
        },
        {
          index: 3,
          label: `↩️ Back`,
          action: 'post',
        },
      ],
    });

    return c.html(html);
  });
}
