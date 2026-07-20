/**
 * @degenfeed/api-worker — Bridge Health & Stats Routes
 *
 * Routes:
 *   GET  /api/bridge/health              — All protocol health status
 *   GET  /api/bridge/health/:protocol    — Single protocol health
 *   POST /api/bridge/circuit/reset       — Reset circuit breaker (admin)
 *   GET  /api/bridge/stats               — Bridge statistics (volume, latency, errors)
 *   GET  /api/bridge/stats/:protocol     — Per-protocol bridge stats
 *
 * Every endpoint returns no-cache JSON for real-time observability.
 * Admin endpoints require a valid session with admin wallet.
 */

import type { Env } from "../index";
import { jsonResponse, noCacheJsonResponse } from "../index";
import { requireAdminFromSession } from "../lib/admin-guard";

// ─── Health Endpoints ──────────────────────────────────────────────────────

/**
 * GET /api/bridge/health
 *
 * Returns health status for ALL bridge protocols.
 * Combines live API reachability checks with circuit breaker state.
 * Cached in KV for 15 seconds to prevent thundering health checks.
 */
export async function handleBridgeHealth(
	request: Request,
	env: Env,
): Promise<Response> {
	if (request.method !== "GET") {
		return jsonResponse({ error: "Method not allowed — use GET" }, 405);
	}

	// Check KV cache (15-second TTL)
	const cacheKey = "bridge:health:v1";
	try {
		if (env.CACHE) {
			const cached = await env.CACHE.get(cacheKey);
			if (cached) {
				const parsed = JSON.parse(cached) as { checkedAt: number };
				if (Date.now() - parsed.checkedAt < 15_000) {
					return noCacheJsonResponse(parsed);
				}
			}
		}
	} catch {
		// Cache miss — proceed
	}

	try {
		const { BridgeHealthMonitor } = await import("../lib/bridge-reliability");
		const monitor = new BridgeHealthMonitor(env);
		const report = await monitor.getOverallHealth(env);

		// Cache for 15 seconds
		if (env.CACHE) {
			(async () => {
				try {
					await env.CACHE.put(cacheKey, JSON.stringify(report), {
						expirationTtl: 30,
					});
				} catch {
					/* ignore */
				}
			})().catch(() => {});
		}

		return noCacheJsonResponse(report);
	} catch (err) {
		return jsonResponse(
			{
				error: `Failed to check bridge health: ${err instanceof Error ? err.message : String(err)}`,
				protocols: {},
				summary: { total: 0, up: 0, degraded: 0, down: 0 },
				checkedAt: Date.now(),
			},
			500,
		);
	}
}

/**
 * GET /api/bridge/health/:protocol
 *
 * Returns health status for a SINGLE protocol.
 */
export async function handleProtocolHealth(
	request: Request,
	env: Env,
): Promise<Response> {
	if (request.method !== "GET") {
		return jsonResponse({ error: "Method not allowed — use GET" }, 405);
	}

	const url = new URL(request.url);
	const protocol = url.pathname.split("/").pop() ?? "";

	if (!protocol || protocol.length === 0 || protocol.includes("..")) {
		return jsonResponse({ error: "Invalid protocol name" }, 400);
	}

	try {
		const { BridgeHealthMonitor } = await import("../lib/bridge-reliability");
		const monitor = new BridgeHealthMonitor(env);
		const health = await monitor.checkProtocolHealth(protocol, env);

		return noCacheJsonResponse({
			ok: true,
			...health,
		});
	} catch (err) {
		return jsonResponse(
			{
				ok: false,
				error: `Failed to check health for ${protocol}: ${err instanceof Error ? err.message : String(err)}`,
			},
			500,
		);
	}
}

// ─── Circuit Breaker Admin Endpoint ────────────────────────────────────────

/**
 * POST /api/bridge/circuit/reset
 *
 * Reset the circuit breaker for a specific protocol, or all protocols.
 * Requires admin authentication.
 *
 * Body:
 *   { "protocol": "nostr" }     — Reset one protocol
 *   { "protocol": "*" }         — Reset ALL protocols
 *   {}                          — Reset ALL protocols
 */
export async function handleCircuitReset(
	request: Request,
	env: Env,
): Promise<Response> {
	if (request.method !== "POST") {
		return jsonResponse({ error: "Method not allowed — use POST" }, 405);
	}

	// Require admin
	const admin = await requireAdminFromSession(request, env);
	if (admin instanceof Response) return admin;

	let body: { protocol?: string };
	try {
		body = (await request.json()) as { protocol?: string };
	} catch {
		// Default to reset all
		body = {};
	}

	const { getCircuitBreaker } = await import("../lib/bridge-reliability");
	const cb = getCircuitBreaker(env);

	try {
		if (body.protocol && body.protocol !== "*") {
			// Reset single protocol
			await cb.reset(body.protocol);

			// Also resume if paused
			const { manualResumeProtocol } = await import("../lib/alerts");
			await manualResumeProtocol(env, body.protocol);

			return noCacheJsonResponse({
				ok: true,
				message: `Circuit breaker reset for ${body.protocol}`,
				protocol: body.protocol,
			});
		}

		// Reset all
		const protocols = await cb.resetAll();
		return noCacheJsonResponse({
			ok: true,
			message: `Circuit breaker reset for ${protocols.length} protocols`,
			protocols,
		});
	} catch (err) {
		return jsonResponse(
			{
				ok: false,
				error: `Failed to reset circuit breaker: ${err instanceof Error ? err.message : String(err)}`,
			},
			500,
		);
	}
}

// ─── Stats Endpoints ───────────────────────────────────────────────────────

/**
 * GET /api/bridge/stats
 *
 * Returns aggregate bridge statistics for all protocols:
 *   - Operation counts (total, success, failure)
 *   - Success rates
 *   - Average latencies
 *   - Circuit breaker trips
 *   - Per-protocol breakdown
 */
export async function handleBridgeStats(
	request: Request,
	env: Env,
): Promise<Response> {
	if (request.method !== "GET") {
		return jsonResponse({ error: "Method not allowed — use GET" }, 405);
	}

	try {
		const { getAllBridgeStats } = await import("../lib/bridge-reliability");
		const stats = await getAllBridgeStats(env);

		return noCacheJsonResponse({
			ok: true,
			...stats,
		});
	} catch (err) {
		return jsonResponse(
			{
				ok: false,
				error: `Failed to get bridge stats: ${err instanceof Error ? err.message : String(err)}`,
			},
			500,
		);
	}
}

/**
 * GET /api/bridge/stats/:protocol
 *
 * Returns bridge statistics for a SINGLE protocol.
 */
export async function handleProtocolStats(
	request: Request,
	env: Env,
): Promise<Response> {
	if (request.method !== "GET") {
		return jsonResponse({ error: "Method not allowed — use GET" }, 405);
	}

	const url = new URL(request.url);
	const path = url.pathname;
	// Extract protocol from /api/bridge/stats/:protocol
	const parts = path.split("/");
	const protocol = parts[parts.length - 1] ?? "";

	if (!protocol || protocol.includes("..")) {
		return jsonResponse({ error: "Invalid protocol name" }, 400);
	}

	try {
		const { getProtocolStats, getCircuitBreaker } = await import(
			"../lib/bridge-reliability"
		);
		const { getBridgePauseStatus, getRecentAlerts } = await import(
			"../lib/alerts"
		);

		const [stats, circuitStatus, pauseStatus, alerts] = await Promise.all([
			getProtocolStats(env, protocol),
			getCircuitBreaker(env).getStatus(protocol),
			getBridgePauseStatus(env, protocol),
			getRecentAlerts(env, 5),
		]);

		return noCacheJsonResponse({
			ok: true,
			protocol,
			stats,
			circuitBreaker: circuitStatus,
			pause: pauseStatus,
			recentAlerts: alerts.filter((a) => a.protocol === protocol),
		});
	} catch (err) {
		return jsonResponse(
			{
				ok: false,
				error: `Failed to get stats for ${protocol}: ${err instanceof Error ? err.message : String(err)}`,
			},
			500,
		);
	}
}
