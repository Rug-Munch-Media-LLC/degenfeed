/**
 * Test utilities for CSRF-protected requests.
 *
 * Provides `sessionWithCsrf()` which creates a session and generates a
 * matching CSRF token. See session.ts for the token validation logic
 * (dev-mode fallback: if env.CACHE is undefined, any token passes).
 */
import type { Env } from "../index";
import {
	createSession,
	generateCsrfToken,
	parseSessionCookie,
	storeCsrfToken,
} from "../session";

const TEST_SECRET = "test-secret-must-be-at-least-32-bytes";
const TEST_WALLET = "0xAbCd";

/**
 * Create a session and a CSRF token.
 *
 * Returns `{ cookie }` (the full `__Host-dfid=…` string to use as the
 * `Cookie` header) and `{ token }` (the CSRF token to send as the
 * `x-csrf-token` header).
 *
 * When `env.CACHE` is missing (local-dev / test without mock KV) the
 * token is generated but not stored — `validateCsrfToken` treats a
 * missing CACHE as dev mode and returns true for any non-null token.
 */
export async function sessionWithCsrf(
	env: Env,
): Promise<{ cookie: string; token: string }> {
	const { setCookie } = await createSession(
		TEST_WALLET,
		"ethereum",
		TEST_SECRET,
	);
	const cookieValue = parseSessionCookie(setCookie);
	if (!cookieValue)
		throw new Error("sessionWithCsrf: failed to parse session cookie");
	const token = env.CACHE
		? await storeCsrfToken(cookieValue, env)
		: generateCsrfToken();
	return { cookie: `__Host-dfid=${cookieValue}`, token };
}
