/**
 * @degenfeed/api-worker — Route Registration Helper
 *
 * Reduces boilerplate in route registration files by providing
 * standard route registration wrappers.
 */

import { ok, serverError } from '../response-helpers';
import type { Env } from '../types';

/**
 * Register a route on the given Hono app with standard error handling.
 * Uses async handler and default error wrapping.
 */
export function registerGet<T extends { Bindings: Env }>(
  app: any,
  path: string,
  handler: (request: Request, env: Env) => Promise<Response>,
): void {
