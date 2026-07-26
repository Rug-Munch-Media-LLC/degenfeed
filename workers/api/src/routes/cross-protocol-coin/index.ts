/**
 * @degenfeed/api-worker — Cross-Protocol Creator Coin System
 *
 * Barrel that creates and exports the crossProtocolCoin Hono router.
 * Routes are delegated to sub-modules.
 */

import { Hono } from 'hono';
import type { Env } from '../../types';
import {
  handleCrossChainStatus,
  handleDeployMonitor,
  handleDeployStatus,
  handleLaunchCoin,
  handleProtocolCoin,
} from './routes';

export const crossProtocolCoin = new Hono<{ Bindings: Env }>();

crossProtocolCoin.post('/launch', async (c) => handleLaunchCoin(c));
crossProtocolCoin.get('/:symbol/cross-chain', async (c) => handleCrossChainStatus(c));
crossProtocolCoin.get('/deploy/status', async (c) => handleDeployStatus(c));
crossProtocolCoin.get('/deploy/monitor', async (c) => handleDeployMonitor(c));
crossProtocolCoin.get('/protocol/:protocol/:creatorId', async (c) => handleProtocolCoin(c));
