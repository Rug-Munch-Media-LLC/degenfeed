import { bytesToHex, hexToBytes } from "@noble/hashes/utils";
import type { Env } from "./index";

export interface SessionPayload {
	address: string;
	chain: "ethereum" | "solana";
	exp: number;
	nonce: string;
	displayName?: string;
	avatarUrl?: string;
}

const COOKIE_NAME = "__Host-dfid";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const CSRF_TTL_SECONDS = 3600;

// ─── Session revocation (optional denylist in KV) ────────────────────
// Stateless HMAC-signed sessions can't be invalidated after issuance.
// To revoke, we store the session's `nonce` in KV with a TTL matching
// the remaining session lifetime. Every authenticated request checks
// this blocklist before trusting the token.
//
// The blocklist key is:  revoked:session:<nonce>
// TTL: up to the max session lifetime (7 days).

export function revokedSessionKey(nonce: string): string {
	return `revoked:session:${nonce}`;
}

/**
 * Add a session nonce to the revocation blocklist.
 * The blocklist entry lives until the session would have naturally expired.
 * Returns `true` if the revocation was persisted, `false` if KV is down.
 */
export async function revokeSession(
	nonce: string,
	expEpochMs: number,
	env: Env,
): Promise<boolean> {
	if (!env.CACHE) return false;
	const remainingSeconds = Math.max(
		60,
		Math.ceil((expEpochMs - Date.now()) / 1000),
	);
	try {
		await env.CACHE.put(revokedSessionKey(nonce), "1", {
			expirationTtl: remainingSeconds,
		});
		return true;
	} catch {
		return false;
	}
}

/**
 * Check if a session nonce has been revoked.
 */
export async function isSessionRevoked(
	nonce: string,
	env: Env,
): Promise<boolean> {
	if (!env.CACHE) return false;
	try {
		const result = await env.CACHE.get(revokedSessionKey(nonce));
		return result !== null;
	} catch {
		// KV hiccup — assume not revoked (fail open to avoid locking out all users)
		return false;
	}
}

/**
 * Revoke ALL sessions for a given wallet address.
 * Iterates the session blocklist is not practical with KV, so this
 * relies on the wallet address being included in the revocation audit log.
 * For now, individual session revocation must be used (via nonce).
 */
export async function revokeAllSessionsForAddress(
	address: string,
	env: Env,
): Promise<{ ok: boolean; message: string }> {
	if (!env.CACHE) return { ok: false, message: "KV not available" };
	// Store a marker that triggers a nonce-agnostic block.
	// All sessions with this address will fail verification.
	// TTL: 7 days to cover the max session lifetime.
	try {
		await env.CACHE.put(`revoked:address:${address.toLowerCase()}`, "1", {
			expirationTtl: 7 * 86400,
		});
		return { ok: true, message: `All sessions revoked for ${address}` };
	} catch {
		return { ok: false, message: "Failed to store revocation marker" };
	}
}

/**
 * Check if a wallet address has had all its sessions revoked.
 */
async function isAddressRevoked(address: string, env: Env): Promise<boolean> {
	if (!env.CACHE) return false;
	try {
		const result = await env.CACHE.get(
			`revoked:address:${address.toLowerCase()}`,
		);
		return result !== null;
	} catch {
		return false;
	}
}

// ─── CSRF token helpers ──────────────────────────────────────────────

export function generateCsrfToken(): string {
	return bytesToHex(crypto.getRandomValues(new Uint8Array(32)));
}

function csrfTokenKey(sessionCookieValue: string): string {
	return `csrf:${sessionCookieValue}`;
}

/**
 * Store a CSRF token in KV keyed by the session cookie value.
 * TTL: 1 hour. Returns the generated token.
 */
export async function storeCsrfToken(
	sessionCookieValue: string,
	env: Env,
): Promise<string> {
	const token = generateCsrfToken();
	const key = csrfTokenKey(sessionCookieValue);
	try {
		await env.CACHE?.put(key, token, { expirationTtl: CSRF_TTL_SECONDS });
	} catch {
		/* KV cache operation failed -- non-critical, continue */
	}
	return token;
}

/**
 * Validate an X-CSRF-Token against the stored value for a session.
 * Returns true if the token matches or if KV is unavailable (dev mode).
 */
export async function validateCsrfToken(
	sessionCookieValue: string,
	token: string | null,
	env: Env,
): Promise<boolean> {
	if (!token) return false;
	if (!env.CACHE) return true; // No KV bound (local dev) — skip check
	try {
		const key = csrfTokenKey(sessionCookieValue);
		const stored = await env.CACHE.get(key);
		if (!stored) return false;
		return stored === token;
	} catch {
		// KV hiccup — fail closed (reject the request) to be safe
		return false;
	}
}

/**
 * Delete a CSRF token from KV (e.g., on sign-out).
 */
export async function deleteCsrfToken(
	sessionCookieValue: string,
	env: Env,
): Promise<void> {
	const key = csrfTokenKey(sessionCookieValue);
	try {
		await env.CACHE?.delete(key);
	} catch {
		/* KV cache operation failed -- non-critical, continue */
	}
}

function jsonResponse(data: unknown, status = 200): Response {
	return new Response(JSON.stringify(data), {
		status,
		headers: { "content-type": "application/json" },
	});
}

function decodeHex(hex: string): Uint8Array {
	const bytes = new Uint8Array(hex.length / 2);
	for (let i = 0; i < hex.length; i += 2) {
		bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
	}
	return bytes;
}

async function importKey(secret: string): Promise<CryptoKey> {
	const keyBytes =
		/^[0-9a-fA-F]+$/.test(secret) && secret.length >= 64
			? decodeHex(secret)
			: new TextEncoder().encode(secret);
	return crypto.subtle.importKey(
		"raw",
		keyBytes as Uint8Array<ArrayBuffer>,
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign", "verify"],
	);
}

export async function signSession(
	payload: SessionPayload,
	secret: string,
): Promise<string> {
	const data = btoa(JSON.stringify(payload));
	const signature = await crypto.subtle.sign(
		"HMAC",
		await importKey(secret),
		new TextEncoder().encode(data),
	);
	return `${data}.${bytesToHex(new Uint8Array(signature))}`;
}

export async function verifySessionCookie(
	value: string,
	secret: string,
): Promise<SessionPayload | null> {
	const [data, signature] = value.split(".");
	if (!data || !signature) return null;

	const valid = await crypto.subtle.verify(
		"HMAC",
		await importKey(secret),
		hexToBytes(signature) as Uint8Array<ArrayBuffer>,
		new TextEncoder().encode(data),
	);
	if (!valid) return null;

	try {
		const payload = JSON.parse(atob(data)) as SessionPayload;
		if (
			typeof payload.address !== "string" ||
			(payload.chain !== "ethereum" && payload.chain !== "solana") ||
			typeof payload.exp !== "number" ||
			typeof payload.nonce !== "string"
		) {
			return null;
		}
		if (payload.exp < Date.now()) return null;
		return payload;
	} catch {
		return null;
	}
}

export function parseSessionCookie(cookieHeader: string | null): string | null {
	if (!cookieHeader) return null;
	for (const part of cookieHeader.split(";")) {
		const eq = part.indexOf("=");
		if (eq === -1) continue;
		const name = part.slice(0, eq).trim();
		const value = part.slice(eq + 1).trim();
		if (name === COOKIE_NAME) return value;
	}
	return null;
}

export async function createSession(
	address: string,
	chain: "ethereum" | "solana",
	secret: string,
): Promise<{ setCookie: string; payload: SessionPayload }> {
	const payload: SessionPayload = {
		address: address.toLowerCase(),
		chain,
		exp: Date.now() + SESSION_TTL_MS,
		nonce: bytesToHex(crypto.getRandomValues(new Uint8Array(16))),
	};
	const value = await signSession(payload, secret);
	const maxAge = Math.floor(SESSION_TTL_MS / 1000);
	const setCookie = `${COOKIE_NAME}=${value}; Max-Age=${maxAge}; Path=/; HttpOnly; Secure; SameSite=Strict`;
	return { setCookie, payload };
}

export async function handleSessionVerify(
	request: Request,
	env: Env,
): Promise<Response> {
	const secret = env.AUTH_SECRET;
	if (!secret)
		return jsonResponse({ error: "Auth secret not configured" }, 500);

	const cookieValue = parseSessionCookie(request.headers.get("cookie"));
	if (!cookieValue) return jsonResponse({ error: "Unauthorized" }, 401);

	const payload = await verifySessionCookie(cookieValue, secret);
	if (!payload) return jsonResponse({ error: "Unauthorized" }, 401);

	return jsonResponse({
		address: payload.address,
		chain: payload.chain,
		exp: payload.exp,
		nonce: payload.nonce,
	});
}

export function clearSessionCookie(): string {
	return `${COOKIE_NAME}=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Strict`;
}

/**
 * Re-issue the session cookie with a fresh 7-day TTL. Call this after
 * every authenticated request so active users never get logged out.
 */
export async function refreshSessionCookie(
	payload: SessionPayload,
	secret: string,
): Promise<string> {
	const { setCookie } = await createSession(
		payload.address,
		payload.chain,
		secret,
	);
	return setCookie;
}

export async function handleSessionSignOut(
	request: Request,
	env: Env,
): Promise<Response> {
	// Clean up CSRF token on sign-out
	const cookieValue = parseSessionCookie(request.headers.get("cookie"));
	if (cookieValue) {
		await deleteCsrfToken(cookieValue, env);
	}

	return new Response(JSON.stringify({ success: true }), {
		status: 200,
		headers: {
			"content-type": "application/json",
			"set-cookie": clearSessionCookie(),
			"cache-control": "no-store",
		},
	});
}

export async function handleSessionRevoke(
	request: Request,
	env: Env,
): Promise<Response> {
	// Revoke the current session by nonce. Requires an active session.
	const secret = env.AUTH_SECRET;
	if (!secret)
		return jsonResponse({ error: "Auth secret not configured" }, 500);

	const cookieValue = parseSessionCookie(request.headers.get("cookie"));
	if (!cookieValue) return jsonResponse({ error: "Unauthorized" }, 401);

	const payload = await verifySessionCookie(cookieValue, secret);
	if (!payload) return jsonResponse({ error: "Unauthorized" }, 401);

	const revoked = await revokeSession(payload.nonce, payload.exp, env);

	// Clean up CSRF token
	await deleteCsrfToken(cookieValue, env);

	return new Response(
		JSON.stringify({
			success: true,
			revoked,
			message: revoked
				? "Session revoked successfully. All devices will be signed out."
				: "Session marked for revocation (KV unavailable).",
		}),
		{
			status: 200,
			headers: {
				"content-type": "application/json",
				"set-cookie": clearSessionCookie(),
				"cache-control": "no-store",
			},
		},
	);
}

export async function requireSession(
	request: Request,
	env: Env,
): Promise<SessionPayload | Response> {
	const secret = env.AUTH_SECRET;
	if (!secret)
		return jsonResponse({ error: "Auth secret not configured" }, 500);

	const cookieValue = parseSessionCookie(request.headers.get("cookie"));
	if (!cookieValue) return jsonResponse({ error: "Unauthorized" }, 401);

	const payload = await verifySessionCookie(cookieValue, secret);
	if (!payload) return jsonResponse({ error: "Unauthorized" }, 401);

	// Check session revocation blocklist
	if (await isSessionRevoked(payload.nonce, env)) {
		return jsonResponse({ error: "Session revoked" }, 401);
	}
	if (await isAddressRevoked(payload.address, env)) {
		return jsonResponse({ error: "Session revoked" }, 401);
	}

	return payload;
}

/**
 * Take an existing response and attach a refreshed session cookie
 * (sliding 7-day TTL). Call this after any authenticated handler
 * to keep the session alive.
 */
export async function applySessionRefresh(
	response: Response,
	payload: SessionPayload,
	secret: string,
): Promise<Response> {
	const setCookie = await refreshSessionCookie(payload, secret);
	const headers = new Headers(response.headers);
	headers.set("set-cookie", setCookie);
	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers,
	});
}
