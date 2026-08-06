/**
 * @degenfeed/api-worker — Cross-Protocol Tipping route registration
 *
 * Registers the unified /api/tipping/* gateway:
 *   GET  /api/tipping/options  — currencies/methods per protocol
 *   GET  /api/tipping/detect   — does this author accept tips?
 *   POST /api/tipping/send     — create a cross-protocol tip
 *   GET  /api/tipping/history  — tips this user has sent
 *   GET  /api/tipping/received — tips a creator has received
 */

import type { Hono } from 'hono';
import { serverError } from '../../response-helpers';
import type { Env } from '../../types';
import {
  handleTippingDetect,
  handleTippingHistory,
  handleTippingOptions,
  handleTippingReceived,
  handleTippingSend,
} from '../tipping';

export function registerTippingRoutes(app: Hono<{ Bindings: Env }>): void {
  app.get('/api/tipping/options', async (c) => {
    try {
      return handleTippingOptions(c.req.raw);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });

  app.get('/api/tipping/detect', async (c) => {
    try {
      return handleTippingDetect(c.req.raw, c.env);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });

  app.post('/api/tipping/send', async (c) => {
    try {
      return handleTippingSend(c.req.raw, c.env);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });

  app.get('/api/tipping/history', async (c) => {
    try {
      return handleTippingHistory(c.req.raw, c.env);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });

  app.get('/api/tipping/received', async (c) => {
    try {
      return handleTippingReceived(c.req.raw, c.env);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
}
