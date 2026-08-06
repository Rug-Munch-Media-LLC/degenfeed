'use client';

/**
 * @degenfeed/web — Better Auth client
 *
 * Single source of truth for the frontend's Better Auth client. The api-server
 * mounts Better Auth at `/api/auth/better/*`; the browser talks to it
 * same-origin (Next.js rewrites /api/* to the self-hosted API).
 *
 * NOTE 1: we import from `better-auth/react` (not `better-auth/client`) because
 * the React entry wraps the vanilla client and exposes `useSession` as a real
 * React hook. The vanilla `better-auth/client` exposes `useSession` as a
 * nanostores Atom, which is not usable in a component the way AuthProvider
 * needs. Everything else (`signIn`, `signUp`, `signOut`) is identical.
 *
 * NOTE 2: we configure `basePath` (not `baseURL`) so Better Auth resolves the
 * endpoint against `window.location.origin` in the browser. A relative
 * `baseURL` like `/api/auth/better` is rejected by Better Auth's URL
 * validation (`new URL()` requires an absolute http(s) URL), and a hardcoded
 * absolute URL would break in local dev / preview environments.
 */

import { createAuthClient } from 'better-auth/react';

export const authClient = createAuthClient({
  basePath: '/api/auth/better',
});

export const { signIn, signUp, signOut, useSession } = authClient;

export default authClient;
