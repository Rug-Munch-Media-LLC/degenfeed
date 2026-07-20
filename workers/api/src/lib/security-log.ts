/**
 * @degenfeed/api-worker — Security event logging
 *
 * Logs all security-related events (logins, 2FA changes, session revocations,
 * password changes, wallet operations) to KV for the Security Log UI.
 *
 * Each event is stored as an individual KV record with a time-ordered key:
 *   security:event:{address}:{timestamp}:{nonce}
 *
 * The user's recent events are also indexed in a sorted set (via a KV
 * list key) for efficient chronological queries.
 *
 * KV key patterns:
 *   security:event:{address}:{ts}:{nonce} → JSON SecurityEvent
 *   security:events:{address}            → JSON array of recent event keys
 */

import type { Env } from "../index";

/* ─── Types ─────────────────────────────────────────────────────────── */

export type SecurityEventType =
	| "login_success"
	| "login_failed"
	| "logout"
	| "session_revoked"
	| "sessions_revoked_all"
	| "passkey_registered"
	| "passkey_removed"
	| "totp_enabled"
	| "totp_disabled"
	| "hardware_wallet_verified"
	| "hardware_wallet_removed"
	| "recovery_codes_generated"
	| "recovery_code_used"
	| "password_changed"
	| "email_changed"
	| "wallet_connected"
	| "wallet_disconnected"
	| "account_deactivated"
	| "account_exported"
	| "api_key_created"
	| "api_key_revoked";

export type SecurityEventSeverity = "low" | "medium" | "high" | "critical";

export interface SecurityEvent {
	id: string;
	type: SecurityEventType;
	severity: SecurityEventSeverity;
	description: string;
	address: string;
	ip: string;
	location: string;
	userAgent: string;
	timestamp: number;
	metadata?: Record<string, string>;
}

/* ─── Constants ─────────────────────────────────────────────────────── */

const EVENT_TTL_SECONDS = 90 * 24 * 60 * 60; // 90 days retention
const MAX_EVENTS_PER_USER = 500;
const RECENT_EVENTS_LIMIT = 50;

const EVENT_SEVERITY_MAP: Record<SecurityEventType, SecurityEventSeverity> = {
	login_success: "low",
	login_failed: "medium",
	logout: "low",
	session_revoked: "medium",
	sessions_revoked_all: "high",
	passkey_registered: "medium",
	passkey_removed: "high",
	totp_enabled: "medium",
	totp_disabled: "high",
	hardware_wallet_verified: "medium",
	hardware_wallet_removed: "high",
	recovery_codes_generated: "low",
	recovery_code_used: "high",
	password_changed: "high",
	email_changed: "high",
	wallet_connected: "medium",
	wallet_disconnected: "medium",
	account_deactivated: "critical",
	account_exported: "high",
	api_key_created: "medium",
	api_key_revoked: "high",
};

const EVENT_DESCRIPTIONS: Record<SecurityEventType, string> = {
	login_success: "Successful login",
	login_failed: "Failed login attempt",
	logout: "Logged out",
	session_revoked: "Session revoked",
	sessions_revoked_all: "All other sessions revoked",
	passkey_registered: "Passkey registered",
	passkey_removed: "Passkey removed",
	totp_enabled: "Authenticator app enabled",
	totp_disabled: "Authenticator app disabled",
	hardware_wallet_verified: "Hardware wallet verified",
	hardware_wallet_removed: "Hardware wallet removed",
	recovery_codes_generated: "Recovery codes generated",
	recovery_code_used: "Recovery code used",
	password_changed: "Password changed",
	email_changed: "Email address changed",
	wallet_connected: "Wallet connected",
	wallet_disconnected: "Wallet disconnected",
	account_deactivated: "Account deactivated",
	account_exported: "Account data exported",
	api_key_created: "API key created",
	api_key_revoked: "API key revoked",
};

/* ─── Key helpers ───────────────────────────────────────────────────── */

function eventKey(address: string, timestamp: number, nonce: string): string {
	return `security:event:${address.toLowerCase()}:${timestamp}:${nonce}`;
}

function eventsListKey(address: string): string {
	return `security:events:${address.toLowerCase()}`;
}

/* ─── Log a security event ──────────────────────────────────────────── */

/**
 * Create and persist a security event. Returns the generated event.
 * Automatically sets severity and description based on event type.
 */
export async function logSecurityEvent(
	env: Env,
	event: {
		type: SecurityEventType;
		address: string;
		ip?: string;
		location?: string;
		userAgent?: string;
		metadata?: Record<string, string>;
	},
): Promise<SecurityEvent> {
	const timestamp = Date.now();
	const nonce = crypto.randomUUID
		? crypto.randomUUID()
		: `${timestamp}-${Math.random().toString(36).slice(2, 10)}`;

	const fullEvent: SecurityEvent = {
		id: nonce,
		type: event.type,
		severity: EVENT_SEVERITY_MAP[event.type] ?? "low",
		description: EVENT_DESCRIPTIONS[event.type] ?? "Security event",
		address: event.address.toLowerCase(),
		ip: event.ip ?? "",
		location: event.location ?? "",
		userAgent: event.userAgent ?? "",
		timestamp,
		metadata: event.metadata,
	};

	// Store the individual event record with TTL
	const key = eventKey(event.address, timestamp, nonce);
	try {
		await env.CACHE?.put(key, JSON.stringify(fullEvent), {
			expirationTtl: EVENT_TTL_SECONDS,
		});
	} catch {
		// KV hiccup — event is best-effort
	}

	// Append to the user's recent events list (capped)
	try {
		const listKey = eventsListKey(event.address);
		const raw = await env.CACHE?.get(listKey);
		const events: string[] = raw ? (JSON.parse(raw) as string[]) : [];
		events.unshift(key);
		// Keep only the most recent N entries
		if (events.length > MAX_EVENTS_PER_USER) {
			events.length = MAX_EVENTS_PER_USER;
		}
		await env.CACHE?.put(listKey, JSON.stringify(events), {
			expirationTtl: EVENT_TTL_SECONDS,
		});
	} catch {
		// Best-effort
	}

	return fullEvent;
}

/* ─── Query recent events ───────────────────────────────────────────── */

export interface SecurityLogQuery {
	address: string;
	limit?: number;
	before?: number; // Only events before this timestamp
}

/**
 * Fetch recent security events for a wallet address.
 * Returns events in reverse chronological order (newest first).
 */
export async function getSecurityEvents(
	env: Env,
	query: SecurityLogQuery,
): Promise<SecurityEvent[]> {
	const limit = query.limit ?? RECENT_EVENTS_LIMIT;
	if (!env.CACHE) return [];

	try {
		const listKey = eventsListKey(query.address);
		const raw = await env.CACHE.get(listKey);
		if (!raw) return [];

		const keys = JSON.parse(raw) as string[];

		// If `before` filter is set, skip entries newer than it
		const filtered = query.before
			? keys.filter((k) => {
					const parts = k.split(":");
					const ts = Number(parts[parts.length - 2] ?? "0");
					return ts < query.before!;
				})
			: keys;

		const batch = filtered.slice(0, limit);

		// Fetch each event record (KV bulk read not available in CF Workers,
		// so we do concurrent individual gets — fine for up to 50 events)
		const events: SecurityEvent[] = [];
		const fetches = batch.map(async (k) => {
			try {
				const val = await env.CACHE?.get(k);
				if (val) {
					events.push(JSON.parse(val) as SecurityEvent);
				}
			} catch {
				// Skip corrupted entries
			}
		});
		await Promise.all(fetches);

		// Sort by timestamp descending (newest first)
		events.sort((a, b) => b.timestamp - a.timestamp);
		return events;
	} catch {
		return [];
	}
}

/* ─── Security handler for logging from route handlers ──────────────── */

/**
 * Extract IP and User-Agent from a Request for logging purposes.
 */
export function extractRequestMetadata(request: Request): {
	ip: string;
	userAgent: string;
	location: string;
} {
	const ip =
		request.headers.get("cf-connecting-ip") ||
		request.headers.get("x-forwarded-for") ||
		request.headers.get("x-real-ip") ||
		"";
	const userAgent = request.headers.get("user-agent") ?? "";
	// Cloudflare provides a country code in cf-ray or cf-ipcountry
	const country = request.headers.get("cf-ipcountry") ?? "";
	const location = country ? `Country: ${country}` : "";
	return { ip, userAgent, location };
}
