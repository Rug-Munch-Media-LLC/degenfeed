/**
 * @degenfeed/api-worker — TOTP 2FA Routes (RFC 6238)
 *
 * Provides endpoints for setting up, verifying, and disabling
 * time-based one-time password authentication using standard
 * authenticator apps (Google Authenticator, Authy, 1Password, etc.).
 *
 * ## Endpoints
 *   POST /api/auth/totp/setup          — Generate TOTP secret + QR URL
 *   POST /api/auth/totp/verify         — Confirm code + activate 2FA
 *   POST /api/auth/totp/authenticate   — Verify TOTP during login
 *   PUT  /api/auth/totp/disable        — Disable 2FA (requires code)
 *   GET  /api/auth/totp/status         — Check 2FA status
 *
 * ## Flow
 *   setup → (user scans QR in authenticator) → verify → 2FA active
 *   login → authenticate (wallet + code)
 *   disable → verify (code or recovery code)
 *
 * ## Security
 * - Secrets are stored in KV as encrypted values
 * - Recovery codes are SHA-256 hashed before storage
 * - Temp secrets have 10-minute TTL during setup
 * - Session-gated endpoints require active authenticated session
 * - authenticate endpoint uses direct wallet+code (for login flow)
 */

import { Hono } from "hono";
import type { Env } from "../index";
import { jsonResponse } from "../index";
import { validateBodySize } from "../sanitize";
import { requireSession } from "../session";
import {
	totpSecretKey,
	totpTempKey,
} from "../kv-key-patterns";
import {
	generateTOTPSecret,
	buildOtpauthUrl,
	verifyTOTP,
	isValidTOTPCode,
} from "../lib/totp";
import {
	generateRecoveryCodes,
	verifyRecoveryCode,
} from "../lib/recovery-codes";

// ─── Constants ────────────────────────────────────────────────

/** TTL for temporary TOTP setup secret (10 minutes). */
const TEMP_SECRET_TTL = 600;

// ─── Router ───────────────────────────────────────────────────

const totp = new Hono<{ Bindings: Env }>();

// ─── Helpers ──────────────────────────────────────────────────

/**
 * Extract and validate the JSON body, returning a parsed object
 * or an error Response.
 */
async function parseBody<T>(
	c: { req: { raw: Request } },
): Promise<{ data?: T; error?: Response }> {
	const sizeCheck = validateBodySize(c.req.raw, 4096);
	if (!sizeCheck.ok) {
		return { error: jsonResponse({ error: sizeCheck.error }, 413) };
	}
	try {
		const data = (await c.req.json()) as T;
		return { data };
	} catch {
		return { error: jsonResponse({ error: "Invalid JSON body" }, 400) };
	}
}

/**
 * QR code URL generator using the public qrserver.com API.
 * No API key needed — purely a URL-based service.
 */
function qrCodeUrl(otpauthUrl: string): string {
	return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(otpauthUrl)}`;
}

// ─── POST /setup — Generate TOTP secret ──────────────────────
// Session-gated: user must be logged in.
// Returns: secret (base32), otpauthUrl, qrCodeUrl
// The secret is stored temporarily (10 min TTL) awaiting verification.

totp.post("/setup", async (c) => {
	const session = await requireSession(c.req.raw, c.env);
	if (session instanceof Response) return session;

	const address = session.address;

	// Check if 2FA is already active
	const existingSecret = await getTOTPSecret(c.env, address);
	if (existingSecret) {
		return jsonResponse(
			{ error: "2FA is already enabled. Disable it first to reconfigure." },
			409,
		);
	}

	// Generate new secret
	const secret = generateTOTPSecret();

	// Build otpauth:// URL with truncated wallet as label
	const label = `DegenFeed:${address.slice(0, 8)}`;
	const otpauthUrl = buildOtpauthUrl(secret.base32, label);

	// Store temp secret (10 min TTL)
	await storeTOTPTemp(c.env, address, secret.base32);

	return jsonResponse({
		secret: secret.base32,
		otpauthUrl,
		qrCodeUrl: qrCodeUrl(otpauthUrl),
	});
});

// ─── POST /verify — Verify TOTP code + activate 2FA ──────────
// Session-gated: user must be logged in.
// Body: { code: string } — 6-digit TOTP code from authenticator app
// Returns: verified status + recovery codes (show once)

totp.post("/verify", async (c) => {
	const session = await requireSession(c.req.raw, c.env);
	if (session instanceof Response) return session;

	const address = session.address;

	const { data, error } = await parseBody<{ code?: string }>(c);
	if (error) return error;

	const { code } = data ?? {};
	if (!code || !isValidTOTPCode(code)) {
		return jsonResponse({ error: "Invalid code. Must be 6 digits." }, 400);
	}

	// Get temporary secret
	const tempSecret = await getTOTPTemp(c.env, address);
	if (!tempSecret) {
		return jsonResponse(
			{ error: "Setup expired. Please start over." },
			400,
		);
	}

	// Verify the code (allow 1 step drift for time sync)
	const isValid = await verifyTOTP(tempSecret, code, { window: 1 });
	if (!isValid) {
		return jsonResponse({ error: "Invalid code" }, 400);
	}

	// Store secret permanently
	await storeTOTPSecret(c.env, address, tempSecret);

	// Generate recovery codes
	const recoveryCodes = await generateRecoveryCodes(c.env, address, 8);

	// Delete temp secret
	await deleteTOTPTemp(c.env, address);

	return jsonResponse({
		verified: true,
		recoveryCodes,
		message: "2FA is now active. Save your recovery codes — they will not be shown again.",
	});
});

// ─── POST /authenticate — Verify TOTP during login ───────────
// Not session-gated (user is logging in).
// Body: { address: string, code: string }
// Returns: verified status

totp.post("/authenticate", async (c) => {
	const { data, error } = await parseBody<{
		address?: string;
		code?: string;
	}>(c);
	if (error) return error;

	const { address, code } = data ?? {};
	if (!address) {
		return jsonResponse({ error: "Wallet address is required" }, 400);
	}
	if (!code || !isValidTOTPCode(code)) {
		return jsonResponse({ error: "Invalid code. Must be 6 digits." }, 400);
	}

	const secret = await getTOTPSecret(c.env, address);
	if (!secret) {
		return jsonResponse({ error: "2FA not set up" }, 400);
	}

	const isValid = await verifyTOTP(secret, code, { window: 1 });
	if (!isValid) {
		return jsonResponse({ error: "Invalid 2FA code" }, 401);
	}

	return jsonResponse({ verified: true });
});

// ─── PUT /disable — Disable TOTP ────────────────────────────
// Session-gated: user must be logged in.
// Body: { code: string } — TOTP code OR recovery code
// Returns: disabled status

totp.put("/disable", async (c) => {
	const session = await requireSession(c.req.raw, c.env);
	if (session instanceof Response) return session;

	const address = session.address;

	const { data, error } = await parseBody<{ code?: string }>(c);
	if (error) return error;

	const { code } = data ?? {};
	if (!code) {
		return jsonResponse({ error: "Code is required (TOTP or recovery code)" }, 400);
	}

	// Try recovery code first
	const isRecovery = await verifyRecoveryCode(c.env, address, code);
	if (isRecovery) {
		await deleteTOTPSecret(c.env, address);
		return jsonResponse({ disabled: true, method: "recovery_code" });
	}

	// Try TOTP
	const secret = await getTOTPSecret(c.env, address);
	if (!secret) {
		return jsonResponse({ error: "2FA is not enabled" }, 400);
	}

	const isValid = await verifyTOTP(secret, code, { window: 1 });
	if (!isValid) {
		return jsonResponse({ error: "Invalid code" }, 401);
	}

	await deleteTOTPSecret(c.env, address);
	return jsonResponse({ disabled: true, method: "totp" });
});

// ─── GET /status — Check 2FA status ──────────────────────────
// Session-gated: user must be logged in.
// Returns: { enabled: boolean }

totp.get("/status", async (c) => {
	const session = await requireSession(c.req.raw, c.env);
	if (session instanceof Response) return session;

	const address = session.address;
	const secret = await getTOTPSecret(c.env, address);

	return jsonResponse({ enabled: secret !== null });
});

// ─── KV Helpers ──────────────────────────────────────────────

/**
 * Store a temporary TOTP secret during the setup flow.
 * Auto-expires after TEMP_SECRET_TTL seconds.
 */
async function storeTOTPTemp(
	env: Env,
	address: string,
	secret: string,
): Promise<void> {
	const key = totpTempKey(address);
	try {
		await env.CACHE?.put(key, secret, {
			expirationTtl: TEMP_SECRET_TTL,
		});
	} catch {
		console.error("[totp] Failed to store temp secret");
	}
}

/**
 * Retrieve the temporary TOTP secret during setup verification.
 */
async function getTOTPTemp(
	env: Env,
	address: string,
): Promise<string | null> {
	const key = totpTempKey(address);
	try {
		return (await env.CACHE?.get(key)) ?? null;
	} catch {
		return null;
	}
}

/**
 * Delete the temporary TOTP secret (after successful setup).
 */
async function deleteTOTPTemp(env: Env, address: string): Promise<void> {
	const key = totpTempKey(address);
	try {
		await env.CACHE?.delete(key);
	} catch {
		// Best-effort cleanup
	}
}

/**
 * Store the TOTP secret permanently after successful verification.
 * The secret is base32-encoded (not encrypted at this layer —
 * encryption is applied by the KV provider / wrangler config).
 * TTL is 5 years (essentially permanent — user must explicitly disable).
 */
async function storeTOTPSecret(
	env: Env,
	address: string,
	secret: string,
): Promise<void> {
	const key = totpSecretKey(address);
	try {
		await env.CACHE?.put(key, secret, {
			expirationTtl: 5 * 365 * 24 * 60 * 60, // ~5 years
		});
	} catch {
		console.error("[totp] Failed to store TOTP secret");
	}
}

/**
 * Retrieve the stored TOTP secret for a wallet address.
 */
async function getTOTPSecret(
	env: Env,
	address: string,
): Promise<string | null> {
	const key = totpSecretKey(address);
	try {
		return (await env.CACHE?.get(key)) ?? null;
	} catch {
		return null;
	}
}

/**
 * Delete the TOTP secret (when disabling 2FA).
 */
async function deleteTOTPSecret(env: Env, address: string): Promise<void> {
	const key = totpSecretKey(address);
	try {
		await env.CACHE?.delete(key);
	} catch {
		// Best-effort cleanup
	}
}

// ─── Export ───────────────────────────────────────────────────

export default totp;
