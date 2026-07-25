/**
 * @degenfeed/api-worker — Route Registration Helper
 *
 * Reduces boilerplate in route registration files by providing
 * standard route registration wrappers.
 */

import type { Env } from '../index';
import { ok, serverError } from '../response-helpers';

/**
 * Register a route on the given Hono app with standard error handling.
 * Uses async handler and default error wrapping.
 */
export function registerGet<T extends { Bindings: Env }>(
  app: any,
  path: string,
  handler: (request: Request, env: Env) => Promise<Response>,
): void {
  app.get(path, async (c: any) => {
    try {
      const result = await handler(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
}

export function registerPost<T extends { Bindings: Env }>(
  app: any,
  path: string,
  handler: (request: Request, env: Env) => Promise<Response>,
): void {
  app.post(path, async (c: any) => {
    try {
      const result = await handler(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
}

export function registerAll<T extends { Bindings: Env }>(
  app: any,
  path: string,
  handler: (request: Request, env: Env) => Promise<Response>,
): void {
  app.all(path, async (c: any) => {
    try {
      const result = await handler(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
}

export function registerDelete<T extends { Bindings: Env }>(
  app: any,
  path: string,
  handler: (request: Request, env: Env) => Promise<Response>,
): void {
  app.delete(path, async (c: any) => {
    try {
      const result = await handler(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
}

export function registerPut<T extends { Bindings: Env }>(
  app: any,
  path: string,
  handler: (request: Request, env: Env) => Promise<Response>,
): void {
  app.put(path, async (c: any) => {
    try {
      const result = await handler(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
}
