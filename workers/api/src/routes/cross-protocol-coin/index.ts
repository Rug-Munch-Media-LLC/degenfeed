/**
 * @degenfeed/api-worker — Cross-Protocol Creator Coin System
 *
 * Barrel that creates and exports the crossProtocolCoin Hono router.
 * Routes are delegated to sub-modules.
 */

import { Hono } from 'hono';
import type { Env } from '../../types';
import {
