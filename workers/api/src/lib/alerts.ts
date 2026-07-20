/**
 * @degenfeed/api-worker — Bridge Alerting System
 *
 * Real-time alerting for bridge failures with:
 *   1. KV-backed failure tracking with counters and rate-limiting
 *   2. Structured logging for Sentry/GlitchTip ingestion
 *   3. Auto-pause bridge routes when circuit breaker opens
 *   4. Configurable notification channels (log, KV, webhook)
 *
 * Every bridge failure should call `alertBridgeFailure()` so the ops
 * team gets visibility within seconds, not days.
 */

import type { Env } from "../index";
import { getCircuitBreaker } from "./bridge-reliability";

// ─── Constants ─────────────────────────────────────────────────────────────

/** KV key prefix for bridge failure records */
const FAILURE_PREFIX = "bridge-failure:";

/** KV key prefix for bridge alert counters */
const ALERT_COUNTER_PREFIX = "bridge-alert-counter:";

/** KV key for the bridge auto-pause record */
const PAUSE_PREFIX = "bridge-pause:";

/** Minimum interval between duplicate alerts for the same protocol (5 min) */
const ALERT_THROTTLE_MS = 5 * 60 * 1000;

/** Alert if failure rate exceeds this threshold (80%) */
const FAILURE_RATE_THRESHOLD = 0.8;

/** Minimum number of operations before failure rate check kicks in */
const MIN_OPS_FOR_RATE_CHECK = 10;

/** Maximum alert counter value before we stop alerting (prevents alert fatigue) */
const MAX_ALERT_COUNT = 50;

// ─── Types ─────────────────────────────────────────────────────────────────

export interface BridgeAlert {
	/** Unique alert ID */
	id: string;
	/** Protocol that failed */
	protocol: string;
	/** Error message */
	error: string;
	/** Severity level */
	severity: "info" | "warning" | "error" | "critical";
	/** When the failure occurred */
	timestamp: number;
	/** Consecutive failures at the time of alert */
	consecutiveFailures: number;
	/** Whether this alert triggered an auto-pause */
	triggeredPause: boolean;
	/** Whether the circuit breaker opened as a result */
	circuitBreakerOpened: boolean;
	/** Operation context (e.g., "publish", "fetch", "reply") */
	context?: string;
}

export interface BridgePauseStatus {
	/** Whether the bridge to this protocol is paused */
	paused: boolean;
	/** When the pause started */
	pausedAt: number | null;
	/** When the pause expires (auto-resume) */
	expiresAt: number | null;
	/** Reason for the pause */
	reason: string | null;
	/** Who/what triggered the pause */
	triggeredBy: "circuit-breaker" | "manual" | "failure-rate";
}

// ─── Alerting Function ─────────────────────────────────────────────────────

/**
 * Alert on a bridge failure.
 *
 * This function:
 *   1. Stores the failure record in KV for the dashboard
 *   2. Logs a structured JSON log for GlitchTip/Sentry
 *   3. If failure rate exceeds threshold, auto-pauses the protocol
 *   4. If circuit breaker opens, logs a critical alert
 *   5. Throttles duplicate alerts (at most one per 5 min per protocol)
 *
 * @returns The created alert, or null if throttled.
 */
export async function alertBridgeFailure(
	env: Env,
	protocol: string,
	error: Error | string,
	context?: string,
): Promise<BridgeAlert | null> {
	const errorMessage = typeof error === "string" ? error : error.message;
	const now = Date.now();
	const alertId = `bf-${now.toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

	// ── 1. Check throttle — don't spam for the same protocol ────────────
	if (await isAlertThrottled(env, protocol, now)) {
		// Still record the failure, but don't create a new alert
		await recordFailureCount(env, protocol);
		logBridgeFailure(protocol, errorMessage, "info", context);
		return null;
	}

	// ── 2. Get circuit breaker state ───────────────────────────────────
	const cb = getCircuitBreaker(env);
	const circuitStatus = await cb.getStatus(protocol);
	const circuitBreakerOpened = circuitStatus.state === "open";

	// ── 3. Check if we need to auto-pause ──────────────────────────────
	let triggeredPause = false;
	if (circuitBreakerOpened) {
		triggeredPause = true;
		await autoPauseProtocol(env, protocol, "circuit-breaker", errorMessage);
	} else {
		// Check failure rate
		const failureRate = await getFailureRate(env, protocol);
		if (failureRate >= FAILURE_RATE_THRESHOLD) {
			triggeredPause = true;
			await autoPauseProtocol(
				env,
				protocol,
				"failure-rate",
				`Failure rate ${(failureRate * 100).toFixed(0)}% exceeds threshold`,
			);
		}
	}

	// ── 4. Determine severity ─────────────────────────────────────────
	let severity: BridgeAlert["severity"];
	if (circuitBreakerOpened) {
		severity = "critical";
	} else if (triggeredPause) {
		severity = "error";
	} else {
		severity = "warning";
	}

	// ── 5. Build and store the alert ──────────────────────────────────
	const alert: BridgeAlert = {
		id: alertId,
		protocol,
		error: errorMessage,
		severity,
		timestamp: now,
		consecutiveFailures: circuitStatus.failureCount,
		triggeredPause,
		circuitBreakerOpened,
		context,
	};

	// Store in KV for dashboard
	await storeAlert(env, alert);

	// Update alert counter
	await incrementAlertCounter(env, protocol);

	// Update throttle
	await setAlertThrottle(env, protocol, now);

	// ── 6. Structured log for GlitchTip/Sentry ────────────────────────
	const logEntry = {
		event: "bridge_failure",
		alertId,
		protocol,
		error: errorMessage,
		severity,
		consecutiveFailures: circuitStatus.failureCount,
		circuitBreakerOpened,
		triggeredPause,
		context,
		timestamp: now,
	};
	console.error(JSON.stringify(logEntry));

	// ── 7. Log to the console with level matching severity ────────────
	const logFn =
		severity === "critical"
			? console.error
			: severity === "error"
				? console.error
				: severity === "warning"
					? console.warn
					: console.info;
	logFn(
		`[bridge-alert] [${severity.toUpperCase()}] ${protocol}: ${errorMessage}${context ? ` (${context})` : ""}${circuitBreakerOpened ? " [CIRCUIT OPEN]" : ""}${triggeredPause ? " [PAUSED]" : ""}`,
	);

	return alert;
}

/**
 * Log a bridge failure at info level (for throttled alerts).
 */
function logBridgeFailure(
	protocol: string,
	error: string,
	severity: string,
	context?: string,
): void {
	console.log(
		JSON.stringify({
			event: "bridge_failure_throttled",
			protocol,
			error,
			severity,
			context,
			timestamp: Date.now(),
		}),
	);
}

// ─── KV Operations ─────────────────────────────────────────────────────────

/**
 * Store a bridge alert in KV for the dashboard.
 */
async function storeAlert(env: Env, alert: BridgeAlert): Promise<void> {
	if (!env.CACHE) return;

	try {
		const key = `${FAILURE_PREFIX}${alert.id}`;
		await env.CACHE.put(key, JSON.stringify(alert), {
			expirationTtl: 86400 * 30,
		}); // 30 days

		// Also store in a recent-alerts list (last 100)
		const listKey = `${FAILURE_PREFIX}recent`;
		const raw = await env.CACHE.get(listKey);
		const list: BridgeAlert[] = raw ? JSON.parse(raw) : [];
		list.unshift(alert);
		const trimmed = list.slice(0, 100);
		await env.CACHE.put(listKey, JSON.stringify(trimmed), {
			expirationTtl: 86400 * 7,
		}); // 7 days
	} catch {
		// Non-critical
	}
}

/**
 * Get recent bridge alerts for the dashboard.
 */
export async function getRecentAlerts(
	env: Env,
	limit = 50,
): Promise<BridgeAlert[]> {
	if (!env.CACHE) return [];

	try {
		const raw = await env.CACHE.get(`${FAILURE_PREFIX}recent`);
		if (!raw) return [];
		const list: BridgeAlert[] = JSON.parse(raw);
		return list.slice(0, limit);
	} catch {
		return [];
	}
}

// ─── Throttling ────────────────────────────────────────────────────────────

/**
 * Check if alerts for this protocol are currently throttled.
 */
async function isAlertThrottled(
	env: Env,
	protocol: string,
	now: number,
): Promise<boolean> {
	if (!env.CACHE) return false;

	try {
		const key = `${ALERT_COUNTER_PREFIX}throttle:${protocol}`;
		const raw = await env.CACHE.get(key);
		if (!raw) return false;

		const lastAlert = parseInt(raw, 10);
		return now - lastAlert < ALERT_THROTTLE_MS;
	} catch {
		return false;
	}
}

/**
 * Set the alert throttle timestamp for a protocol.
 */
async function setAlertThrottle(
	env: Env,
	protocol: string,
	now: number,
): Promise<void> {
	if (!env.CACHE) return;

	try {
		const key = `${ALERT_COUNTER_PREFIX}throttle:${protocol}`;
		await env.CACHE.put(key, String(now), { expirationTtl: 600 }); // 10 min
	} catch {
		// Non-critical
	}
}

/**
 * Increment the alert counter for a protocol.
 */
async function incrementAlertCounter(
	env: Env,
	protocol: string,
): Promise<void> {
	if (!env.CACHE) return;

	try {
		const key = `${ALERT_COUNTER_PREFIX}count:${protocol}`;
		const raw = await env.CACHE.get(key);
		const count = raw ? parseInt(raw, 10) + 1 : 1;
		if (count <= MAX_ALERT_COUNT) {
			await env.CACHE.put(key, String(count), { expirationTtl: 86400 * 30 });
		}
	} catch {
		// Non-critical
	}
}

/**
 * Record a failure count (for rate calculation).
 */
async function recordFailureCount(env: Env, protocol: string): Promise<void> {
	if (!env.CACHE) return;

	const hour = new Date().toISOString().slice(0, 13); // "2026-07-20T14"
	const key = `${FAILURE_PREFIX}counts:${protocol}:${hour}`;

	try {
		const raw = await env.CACHE.get(key);
		const data = raw
			? (JSON.parse(raw) as { ops: number; failures: number })
			: { ops: 0, failures: 0 };
		data.ops = (data.ops ?? 0) + 1;
		data.failures = (data.failures ?? 0) + 1;
		await env.CACHE.put(key, JSON.stringify(data), {
			expirationTtl: 86400 * 2,
		});
	} catch {
		// Non-critical
	}
}

/**
 * Record a successful bridge operation (for rate calculation).
 */
export async function recordBridgeSuccess(
	env: Env,
	protocol: string,
): Promise<void> {
	if (!env.CACHE) return;

	const hour = new Date().toISOString().slice(0, 13);
	const key = `${FAILURE_PREFIX}counts:${protocol}:${hour}`;

	try {
		const raw = await env.CACHE.get(key);
		const data = raw
			? (JSON.parse(raw) as { ops: number; failures: number })
			: { ops: 0, failures: 0 };
		data.ops = (data.ops ?? 0) + 1;
		await env.CACHE.put(key, JSON.stringify(data), {
			expirationTtl: 86400 * 2,
		});
	} catch {
		// Non-critical
	}
}

/**
 * Get the failure rate for a protocol over the last hour.
 */
async function getFailureRate(env: Env, protocol: string): Promise<number> {
	if (!env.CACHE) return 0;

	const hour = new Date().toISOString().slice(0, 13);
	const key = `${FAILURE_PREFIX}counts:${protocol}:${hour}`;

	try {
		const raw = await env.CACHE.get(key);
		if (!raw) return 0;
		const data = JSON.parse(raw) as { ops: number; failures: number };
		if (data.ops < MIN_OPS_FOR_RATE_CHECK) return 0;
		return data.failures / data.ops;
	} catch {
		return 0;
	}
}

// ─── Auto-Pause ────────────────────────────────────────────────────────────

/**
 * Auto-pause bridge operations to a failing protocol.
 * The pause expires after the circuit breaker's reset timeout.
 */
async function autoPauseProtocol(
	env: Env,
	protocol: string,
	triggeredBy: BridgePauseStatus["triggeredBy"],
	reason: string,
): Promise<void> {
	if (!env.CACHE) return;

	const now = Date.now();
	const pauseDuration = 5 * 60 * 1000; // 5 minutes default
	const pause: BridgePauseStatus = {
		paused: true,
		pausedAt: now,
		expiresAt: now + pauseDuration,
		reason,
		triggeredBy,
	};

	try {
		await env.CACHE.put(`${PAUSE_PREFIX}${protocol}`, JSON.stringify(pause), {
			expirationTtl: Math.ceil(pauseDuration / 1000),
		});
		console.warn(`[bridge-alert] Auto-paused bridge to ${protocol}: ${reason}`);
	} catch {
		// Non-critical
	}
}

/**
 * Check if a protocol's bridge is currently paused.
 */
export async function isBridgePaused(
	env: Env,
	protocol: string,
): Promise<boolean> {
	if (!env.CACHE) return false;

	try {
		const raw = await env.CACHE.get(`${PAUSE_PREFIX}${protocol}`);
		if (!raw) return false;

		const pause = JSON.parse(raw) as BridgePauseStatus;
		if (!pause.paused) return false;

		// Check expiration
		if (pause.expiresAt && Date.now() > pause.expiresAt) {
			// Auto-resume — clear the pause
			await env.CACHE.delete(`${PAUSE_PREFIX}${protocol}`);
			return false;
		}

		return true;
	} catch {
		return false;
	}
}

/**
 * Manually pause a protocol's bridge.
 */
export async function manualPauseProtocol(
	env: Env,
	protocol: string,
	reason: string,
	durationMs = 5 * 60 * 1000,
): Promise<void> {
	if (!env.CACHE) return;

	const pause: BridgePauseStatus = {
		paused: true,
		pausedAt: Date.now(),
		expiresAt: Date.now() + durationMs,
		reason,
		triggeredBy: "manual",
	};

	await env.CACHE.put(`${PAUSE_PREFIX}${protocol}`, JSON.stringify(pause), {
		expirationTtl: Math.ceil(durationMs / 1000),
	});
}

/**
 * Manually resume (unpause) a protocol's bridge.
 */
export async function manualResumeProtocol(
	env: Env,
	protocol: string,
): Promise<void> {
	if (!env.CACHE) return;
	try {
		await env.CACHE.delete(`${PAUSE_PREFIX}${protocol}`);
		await getCircuitBreaker(env).reset(protocol);
		console.info(`[bridge-alert] Manually resumed bridge to ${protocol}`);
	} catch {
		// Non-critical
	}
}

/**
 * Get the pause status for a protocol.
 */
export async function getBridgePauseStatus(
	env: Env,
	protocol: string,
): Promise<BridgePauseStatus> {
	if (!env.CACHE) {
		return {
			paused: false,
			pausedAt: null,
			expiresAt: null,
			reason: null,
			triggeredBy: "manual",
		};
	}

	try {
		const raw = await env.CACHE.get(`${PAUSE_PREFIX}${protocol}`);
		if (!raw) {
			return {
				paused: false,
				pausedAt: null,
				expiresAt: null,
				reason: null,
				triggeredBy: "manual",
			};
		}
		return JSON.parse(raw) as BridgePauseStatus;
	} catch {
		return {
			paused: false,
			pausedAt: null,
			expiresAt: null,
			reason: null,
			triggeredBy: "manual",
		};
	}
}
