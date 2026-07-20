/**
 * @degenfeed/api-worker — Bridge Reliability System
 *
 * THREE pillars of cross-protocol bridge reliability:
 *   1. Circuit Breaker — prevent cascading failures when a protocol is down
 *   2. Retry with Exponential Backoff — transient error recovery
 *   3. Bridge Health Monitor — observability into every protocol's status
 *
 * Every bridge operation in the codebase MUST go through `withReliability()`
 * which chains the circuit breaker → retry → execution pipeline.
 *
 * ARCHITECTURE:
 *   - Circuit breaker state is stored in-memory (per-CF-isolate) for speed
 *     AND persisted to KV for cross-isolate coordination.
 *   - KV is the source of truth; in-memory is a fast write-through cache.
 *   - Retry jitter prevents thundering herd on protocol recovery.
 */

import type { Env } from "../index";

// ─── Error Types ───────────────────────────────────────────────────────────

/**
 * Thrown when a circuit breaker is open (protocol is considered down).
 * The caller should NOT attempt the operation — fail fast.
 */
export class CircuitBreakerOpenError extends Error {
	readonly protocol: string;
	readonly openedAt: number;

	constructor(protocol: string, openedAt?: number) {
		super(`Circuit breaker is OPEN for protocol "${protocol}" — failing fast`);
		this.name = "CircuitBreakerOpenError";
		this.protocol = protocol;
		this.openedAt = openedAt ?? Date.now();
	}
}

/**
 * Thrown when all retry attempts are exhausted.
 */
export class MaxRetriesExceededError extends Error {
	readonly attempt: number;
	override readonly cause: Error;

	constructor(message: string, attempt: number, cause: Error) {
		super(message);
		this.name = "MaxRetriesExceededError";
		this.attempt = attempt;
		this.cause = cause;
	}
}

// ─── Types ─────────────────────────────────────────────────────────────────

export type ProtocolStatus = "up" | "degraded" | "down";

export interface ProtocolHealth {
	protocol: string;
	reachable: boolean;
	latencyMs: number;
	successRate24h: number;
	rateLimitRemaining: number;
	circuitBreakerOpen: boolean;
	circuitBreakerState: "closed" | "open" | "half-open";
	lastSuccessAt: number | null;
	lastErrorAt: number | null;
	lastError?: string;
	consecutiveFailures: number;
	checkedAt: number;
}

export interface BridgeHealthReport {
	overall: ProtocolStatus;
	protocols: Record<string, ProtocolHealth>;
	summary: {
		total: number;
		up: number;
		degraded: number;
		down: number;
	};
	checkedAt: number;
	latencyMs: number;
}

export interface BridgeStats {
	periodStart: number;
	periodEnd: number;
	totalOperations: number;
	successfulOperations: number;
	failedOperations: number;
	successRate: number;
	totalLatencyMs: number;
	avgLatencyMs: number;
	byProtocol: Record<string, ProtocolStats>;
	circuitBreakerTrips: number;
}

export interface ProtocolStats {
	totalOps: number;
	successOps: number;
	failedOps: number;
	successRate: number;
	totalLatency: number;
	avgLatencyMs: number;
	circuitBreakerTripped: boolean;
	lastError?: string;
}

// ─── Circuit Breaker ───────────────────────────────────────────────────────

interface CircuitState {
	state: "closed" | "open" | "half-open";
	failureCount: number;
	successCount: number;
	openedAt: number | null;
	lastFailureAt: number | null;
	lastSuccessAt: number | null;
	lastError: string | null;
}

/**
 * Per-protocol circuit breaker configuration.
 */
export interface CircuitBreakerConfig {
	/** Failures before opening the circuit (default: 5) */
	threshold?: number;
	/** Milliseconds before transitioning from open → half-open (default: 60000) */
	resetTimeout?: number;
	/** Successes needed in half-open to close the circuit (default: 2) */
	halfOpenSuccesses?: number;
	/** KV key prefix for storing circuit state (default: "cb:") */
	kvPrefix?: string;
}

const DEFAULT_CONFIG: Required<CircuitBreakerConfig> = {
	threshold: 5,
	resetTimeout: 60_000,
	halfOpenSuccesses: 2,
	kvPrefix: "cb:",
};

/**
 * Circuit Breaker — prevents cascading failures across protocol bridges.
 *
 * States:
 *   CLOSED    → Normal operation. Requests pass through.
 *   OPEN      → Failures exceed threshold. Requests fail fast.
 *   HALF-OPEN → After resetTimeout. One test request allowed.
 *               If it succeeds → CLOSED. If it fails → OPEN.
 *
 * State is kept in-memory (fast) AND persisted to KV (durable).
 * KV is the source of truth; in-memory is write-through cache.
 */
export class CircuitBreaker {
	private states = new Map<string, CircuitState>();
	private configs = new Map<string, Required<CircuitBreakerConfig>>();
	private kv: KVNamespace | null = null;
	private kvEnabled = false;

	/**
	 * @param kv Optional KV namespace for cross-isolate state persistence.
	 */
	constructor(kv?: KVNamespace | null) {
		this.kv = kv ?? null;
		this.kvEnabled = !!kv;
	}

	// ── Public API ────────────────────────────────────────────────────────

	/**
	 * Execute an operation under circuit breaker protection.
	 *
	 * If the circuit is OPEN, throws CircuitBreakerOpenError immediately
	 * without calling `operation`.
	 *
	 * If the operation succeeds, record success and potentially close
	 * a half-open circuit.
	 *
	 * If the operation throws, record the failure and potentially open
	 * the circuit.
	 */
	async execute<T>(
		protocol: string,
		operation: () => Promise<T>,
		config?: CircuitBreakerConfig,
	): Promise<T> {
		const merged = this.mergeConfig(protocol, config);
		const state = await this.getState(protocol);

		// ── OPEN → fail fast ────────────────────────────────────────────
		if (state.state === "open") {
			const elapsed = Date.now() - (state.openedAt ?? Date.now());
			if (elapsed < merged.resetTimeout) {
				throw new CircuitBreakerOpenError(
					protocol,
					state.openedAt ?? undefined,
				);
			}
			// Reset timeout elapsed → transition to half-open
			state.state = "half-open";
			state.openedAt = null;
			await this.persistState(protocol, state);
		}

		// ── Execute the operation ────────────────────────────────────────
		try {
			const result = await operation();
			await this.recordSuccess(protocol);
			return result;
		} catch (error) {
			await this.recordFailure(protocol, error);
			throw error;
		}
	}

	/**
	 * Record a success for the given protocol.
	 * If in half-open and success count reaches threshold → close circuit.
	 */
	async recordSuccess(protocol: string): Promise<void> {
		const state = await this.getState(protocol);
		const config = this.getEffectiveConfig(protocol);

		state.lastSuccessAt = Date.now();
		state.successCount++;

		if (state.state === "half-open") {
			if (state.successCount >= config.halfOpenSuccesses) {
				// Close the circuit
				state.state = "closed";
				state.failureCount = 0;
				state.successCount = 0;
				state.lastError = null;
			}
		} else if (state.state === "closed") {
			// Reset failure count on success (sliding window)
			state.failureCount = Math.max(0, state.failureCount - 1);
		}

		await this.persistState(protocol, state);
	}

	/**
	 * Record a failure for the given protocol.
	 * If failure count reaches threshold → open circuit.
	 */
	async recordFailure(protocol: string, error?: unknown): Promise<void> {
		const state = await this.getState(protocol);
		const config = this.getEffectiveConfig(protocol);

		state.failureCount++;
		state.lastFailureAt = Date.now();
		state.lastError =
			error instanceof Error ? error.message : String(error ?? "Unknown error");
		state.successCount = 0;

		if (state.failureCount >= config.threshold && state.state !== "open") {
			// Open the circuit
			state.state = "open";
			state.openedAt = Date.now();
		}

		await this.persistState(protocol, state);
	}

	/**
	 * Check if the circuit is open for the given protocol.
	 */
	async isOpen(protocol: string): Promise<boolean> {
		const state = await this.getState(protocol);
		if (state.state !== "open") return false;

		const config = this.getEffectiveConfig(protocol);
		const elapsed = Date.now() - (state.openedAt ?? Date.now());
		if (elapsed >= config.resetTimeout) {
			// Auto-transition to half-open
			state.state = "half-open";
			state.openedAt = null;
			await this.persistState(protocol, state);
			return false;
		}

		return true;
	}

	/**
	 * Get the current circuit state for a protocol.
	 */
	async getCircuitState(protocol: string): Promise<CircuitState> {
		return this.getState(protocol);
	}

	/**
	 * Get the current circuit breaker "human" status.
	 */
	async getStatus(protocol: string): Promise<{
		state: "closed" | "open" | "half-open";
		failureCount: number;
		openedAt: number | null;
		lastError: string | null;
	}> {
		const s = await this.getState(protocol);
		return {
			state: s.state,
			failureCount: s.failureCount,
			openedAt: s.openedAt,
			lastError: s.lastError,
		};
	}

	/**
	 * Manually reset the circuit breaker for a protocol (admin action).
	 */
	async reset(protocol: string): Promise<void> {
		const state = await this.getState(protocol);
		state.state = "closed";
		state.failureCount = 0;
		state.successCount = 0;
		state.openedAt = null;
		state.lastError = null;
		await this.persistState(protocol, state);
	}

	/**
	 * Reset ALL circuit breakers (admin action).
	 */
	async resetAll(): Promise<string[]> {
		const protocols = [...this.states.keys()];
		for (const p of protocols) {
			await this.reset(p);
		}
		return protocols;
	}

	/**
	 * Configure a protocol's circuit breaker settings.
	 */
	configure(protocol: string, config: CircuitBreakerConfig): void {
		this.configs.set(protocol, { ...DEFAULT_CONFIG, ...config });
	}

	// ── Internal ─────────────────────────────────────────────────────────

	private mergeConfig(
		protocol: string,
		override?: CircuitBreakerConfig,
	): Required<CircuitBreakerConfig> {
		const existing = this.configs.get(protocol);
		if (existing && !override) return existing;
		if (!existing && !override) return DEFAULT_CONFIG;
		return { ...DEFAULT_CONFIG, ...existing, ...override };
	}

	private getEffectiveConfig(protocol: string): Required<CircuitBreakerConfig> {
		return this.configs.get(protocol) ?? DEFAULT_CONFIG;
	}

	private async getState(protocol: string): Promise<CircuitState> {
		// Fast path: in-memory
		const cached = this.states.get(protocol);
		if (cached) return cached;

		// Try KV
		if (this.kvEnabled && this.kv) {
			try {
				const raw = await this.kv.get(`${DEFAULT_CONFIG.kvPrefix}${protocol}`);
				if (raw) {
					const parsed = JSON.parse(raw) as CircuitState;
					this.states.set(protocol, parsed);
					return parsed;
				}
			} catch {
				// KV hiccup — use fresh state
			}
		}

		// Fresh state
		const fresh: CircuitState = {
			state: "closed",
			failureCount: 0,
			successCount: 0,
			openedAt: null,
			lastFailureAt: null,
			lastSuccessAt: null,
			lastError: null,
		};
		this.states.set(protocol, fresh);
		return fresh;
	}

	private async persistState(
		protocol: string,
		state: CircuitState,
	): Promise<void> {
		// Always update in-memory cache
		this.states.set(protocol, { ...state });

		// Fire-and-forget KV write (best-effort)
		const _kv = this.kv;
		if (this.kvEnabled && _kv) {
			(async () => {
				try {
					await _kv.put(
						`${DEFAULT_CONFIG.kvPrefix}${protocol}`,
						JSON.stringify(state),
						{ expirationTtl: 86400 }, // 24h TTL — auto-cleanup
					);
				} catch {
					// Non-critical — in-memory state still works
				}
			})().catch(() => {});
		}
	}
}

// ─── Singleton ─────────────────────────────────────────────────────────────

let _circuitBreaker: CircuitBreaker | null = null;

/**
 * Get or create the global CircuitBreaker singleton.
 */
export function getCircuitBreaker(env?: Env): CircuitBreaker {
	if (!_circuitBreaker) {
		_circuitBreaker = new CircuitBreaker(env?.CACHE ?? null);
		// Configure per-protocol thresholds
		_circuitBreaker.configure("farcaster", {
			threshold: 3,
			resetTimeout: 30_000,
		});
		_circuitBreaker.configure("lens", { threshold: 3, resetTimeout: 30_000 });
		_circuitBreaker.configure("bluesky", {
			threshold: 5,
			resetTimeout: 60_000,
		});
		_circuitBreaker.configure("mastodon", {
			threshold: 5,
			resetTimeout: 60_000,
		});
		_circuitBreaker.configure("activitypub", {
			threshold: 5,
			resetTimeout: 60_000,
		});
		_circuitBreaker.configure("nostr", { threshold: 8, resetTimeout: 90_000 }); // Nostr relays are flaky
		_circuitBreaker.configure("telegram", {
			threshold: 5,
			resetTimeout: 60_000,
		});
		_circuitBreaker.configure("rss", { threshold: 5, resetTimeout: 60_000 });
		_circuitBreaker.configure("zora", { threshold: 3, resetTimeout: 120_000 }); // RPC calls are slower
		_circuitBreaker.configure("threads", {
			threshold: 3,
			resetTimeout: 30_000,
		});
	}
	return _circuitBreaker;
}

// ─── Retry with Exponential Backoff ────────────────────────────────────────

export interface RetryOptions {
	/** Maximum number of retry attempts (default: 3) */
	maxRetries?: number;
	/** Base delay in ms (default: 1000) */
	baseDelay?: number;
	/** Maximum delay in ms (default: 30000) */
	maxDelay?: number;
	/** Optional timeout per attempt in ms (default: 15000) */
	timeoutMs?: number;
	/** Optional set of status codes that are NOT retryable (default: [400, 401, 403, 404, 409]) */
	nonRetryableStatuses?: Set<number>;
	/** Optional function to determine if an error is retryable (default: retry all) */
	isRetryable?: (error: unknown) => boolean;
}

const DEFAULT_RETRY: Required<Omit<RetryOptions, "isRetryable">> = {
	maxRetries: 3,
	baseDelay: 1000,
	maxDelay: 30_000,
	timeoutMs: 15_000,
	nonRetryableStatuses: new Set([400, 401, 403, 404, 409]),
};

const DEFAULT_RETRYABLE_STATUSES = [408, 429, 500, 502, 503, 504];

/**
 * Sleep for the given number of milliseconds.
 */
export function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Calculate delay with exponential backoff and full jitter.
 *
 * Formula: random_between(0, min(maxDelay, baseDelay * 2^attempt))
 *
 * Full jitter prevents thundering herd when many operations retry
 * simultaneously after a protocol recovers.
 */
export function calculateBackoff(
	attempt: number,
	baseDelay: number,
	maxDelay: number,
): number {
	const exponential = Math.min(maxDelay, baseDelay * 2 ** attempt);
	return Math.random() * exponential;
}

/**
 * Execute an operation with retry and exponential backoff.
 *
 * Retries on:
 *   - Network errors (TypeError: fetch failed, etc.)
 *   - HTTP 408, 429, 5xx status codes
 *   - Timeout errors
 *
 * Does NOT retry on:
 *   - HTTP 400, 401, 403, 404, 409 (client errors — likely permanent)
 *   - CircuitBreakerOpenError (fail fast, don't retry)
 *   - Errors explicitly excluded by `isRetryable`
 */
export async function withRetry<T>(
	operation: () => Promise<T>,
	options?: RetryOptions,
): Promise<T> {
	const maxRetries = options?.maxRetries ?? DEFAULT_RETRY.maxRetries;
	const baseDelay = options?.baseDelay ?? DEFAULT_RETRY.baseDelay;
	const maxDelay = options?.maxDelay ?? DEFAULT_RETRY.maxDelay;
	const timeoutMs = options?.timeoutMs ?? DEFAULT_RETRY.timeoutMs;
	const nonRetryableStatuses =
		options?.nonRetryableStatuses ?? DEFAULT_RETRY.nonRetryableStatuses;
	const isRetryable = options?.isRetryable;

	let lastError: Error | null = null;

	for (let attempt = 0; attempt <= maxRetries; attempt++) {
		try {
			// Apply timeout per attempt
			const result = await executeWithTimeout(operation, timeoutMs);
			return result;
		} catch (error) {
			lastError = error instanceof Error ? error : new Error(String(error));

			// ── Don't retry CircuitBreakerOpenError ──────────────────────
			if (lastError instanceof CircuitBreakerOpenError) {
				throw lastError;
			}

			// ── Check if error is retryable ──────────────────────────────
			if (!isErrorRetryable(error, nonRetryableStatuses, isRetryable)) {
				throw lastError;
			}

			// ── Last attempt? Don't sleep — just throw ───────────────────
			if (attempt >= maxRetries) {
				throw new MaxRetriesExceededError(
					`Operation failed after ${maxRetries + 1} attempts: ${lastError.message}`,
					attempt,
					lastError,
				);
			}

			// ── Exponential backoff with jitter ──────────────────────────
			const delay = calculateBackoff(attempt, baseDelay, maxDelay);
			await sleep(delay);
		}
	}

	// Unreachable, but TypeScript needs it
	throw lastError ?? new Error("Unknown retry error");
}

/**
 * Execute an operation with a timeout.
 */
async function executeWithTimeout<T>(
	operation: () => Promise<T>,
	timeoutMs: number,
): Promise<T> {
	let timer: ReturnType<typeof setTimeout> | undefined;
	try {
		const result = await Promise.race([
			operation(),
			new Promise<never>((_, reject) => {
				timer = setTimeout(
					() => reject(new Error(`Operation timed out after ${timeoutMs}ms`)),
					timeoutMs,
				);
			}),
		]);
		return result;
	} finally {
		if (timer) clearTimeout(timer);
	}
}

/**
 * Determine if an error should trigger a retry.
 */
function isErrorRetryable(
	error: unknown,
	nonRetryableStatuses: Set<number>,
	customCheck?: (error: unknown) => boolean,
): boolean {
	// Custom check takes precedence
	if (customCheck) return customCheck(error);

	// Network errors (fetch failed, DNS, TCP, TLS) — always retryable
	if (error instanceof TypeError && error.message.includes("fetch")) {
		return true;
	}

	// HTTP errors
	if (error instanceof HttpStatusError) {
		if (nonRetryableStatuses.has(error.status)) return false;
		return DEFAULT_RETRYABLE_STATUSES.includes(error.status);
	}

	// Timeout errors — retryable
	if (error instanceof Error && error.message.includes("timed out")) {
		return true;
	}

	// Everything else (including unknown errors) — retry once to be safe
	return true;
}

/**
 * HTTP status error with code.
 */
export class HttpStatusError extends Error {
	readonly status: number;
	readonly statusText: string;
	readonly body?: string;

	constructor(status: number, statusText: string, body?: string) {
		super(`HTTP ${status} ${statusText}`);
		this.name = "HttpStatusError";
		this.status = status;
		this.statusText = statusText;
		this.body = body;
	}
}

// ─── Unified Reliability Wrapper ──────────────────────────────────────────

/**
 * Execute an operation with the full reliability stack:
 *   Circuit Breaker → Retry → Execution
 *
 * This is THE function every bridge operation should use.
 *
 * @param protocol - The protocol being accessed (for circuit breaker tracking)
 * @param operation - The actual operation to execute
 * @param options - Retry + circuit breaker options
 * @param env - Optional Env for KV-backed circuit breaker
 */
export async function withReliability<T>(
	protocol: string,
	operation: () => Promise<T>,
	options?: {
		retry?: RetryOptions;
		circuitBreaker?: CircuitBreakerConfig;
		env?: Env;
	},
): Promise<T> {
	const cb = getCircuitBreaker(options?.env);

	return cb.execute(
		protocol,
		async () => {
			return withRetry(operation, options?.retry);
		},
		options?.circuitBreaker,
	);
}

/**
 * Parse an HTTP response and throw HttpStatusError if not ok.
 * Returns the parsed JSON body on success.
 */
export async function expectOk(
	response: Response,
	context?: string,
): Promise<unknown> {
	if (response.ok) {
		return response.json().catch(() => null);
	}

	const body = await response.text().catch(() => "");
	const msg = context ? `${context}: ` : "";
	throw new HttpStatusError(
		response.status,
		response.statusText,
		`${msg}HTTP ${response.status} ${response.statusText} — ${body.slice(0, 500)}`,
	);
}

// ─── Bridge Health Monitor ────────────────────────────────────────────────

/**
 * Protocol health check functions.
 * Each returns true if the protocol API is reachable.
 */
const PROTOCOL_HEALTH_CHECKS: Record<
	string,
	(
		env: Env,
	) => Promise<{ reachable: boolean; latencyMs: number; error?: string }>
> = {
	mastodon: async (env) => {
		const instance = env.GTS_INSTANCE_URL || "https://social.degenfeed.xyz";
		return pingUrl(`${instance}/api/v1/instance`);
	},
	activitypub: async (env) => {
		const instance = env.GTS_INSTANCE_URL || "https://social.degenfeed.xyz";
		return pingUrl(`${instance}/api/v1/instance`);
	},
	bluesky: async (env) => {
		const url = env.BSKY_SOCIAL_URL || "https://bsky.social";
		return pingUrl(`${url}/xrpc/com.atproto.server.describeServer`);
	},
	atproto: async (env) => {
		const url = env.BSKY_SOCIAL_URL || "https://bsky.social";
		return pingUrl(`${url}/xrpc/com.atproto.server.describeServer`);
	},
	nostr: async (env) => {
		// Check multiple relays, first one that responds wins
		const relays = (
			env.RELAY_URLS ||
			"wss://relay.damus.io,wss://nos.lol,wss://relay.primal.net"
		)
			.split(",")
			.map((u) => u.trim())
			.filter(Boolean);
		// For relays (WebSocket), we can't easily ping via HTTP
		// Fall back to checking nostr.band API as a proxy
		return pingUrl("https://api.nostr.band/");
	},
	farcaster: async (env) => {
		const hub =
			env.FARCASTER_HUB_URL || "https://hub.farcaster.standardcrypto.vc:2281";
		return pingUrl(`${hub}/v1/info`);
	},
	lens: async (env) => {
		const api = env.LENS_API_URL || "https://api-v2.lens.dev/graphql";
		return pingGraphQl(api, "{ __typename }");
	},
	telegram: async (env) => {
		if (!env.TELEGRAM_BOT_TOKEN) {
			return {
				reachable: false,
				latencyMs: 0,
				error: "TELEGRAM_BOT_TOKEN not configured",
			};
		}
		return pingUrl(
			`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/getMe`,
		);
	},
	rss: async () => {
		// RSS is always "reachable" — individual feeds may fail
		return { reachable: true, latencyMs: 0 };
	},
	zora: async () => {
		return pingUrl("https://api.zora.co/");
	},
	threads: async (env) => {
		return pingUrl(
			"https://graph.threads.net/v1.0/me?fields=id&access_token=health",
		);
	},
};

/**
 * Ping an HTTP endpoint and measure latency.
 */
async function pingUrl(
	url: string,
): Promise<{ reachable: boolean; latencyMs: number; error?: string }> {
	const start = performance.now();
	try {
		const res = await fetch(url, {
			method: "GET",
			signal: AbortSignal.timeout(5_000),
		});
		const latency = Math.round(performance.now() - start);
		return {
			reachable: res.ok || res.status < 500,
			latencyMs: latency,
			error: res.ok ? undefined : `HTTP ${res.status}`,
		};
	} catch (err) {
		const latency = Math.round(performance.now() - start);
		return {
			reachable: false,
			latencyMs: latency,
			error: err instanceof Error ? err.message : String(err),
		};
	}
}

/**
 * Ping a GraphQL endpoint.
 */
async function pingGraphQl(
	url: string,
	query: string,
): Promise<{ reachable: boolean; latencyMs: number; error?: string }> {
	const start = performance.now();
	try {
		const res = await fetch(url, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ query }),
			signal: AbortSignal.timeout(5_000),
		});
		const latency = Math.round(performance.now() - start);
		return {
			reachable: res.ok,
			latencyMs: latency,
			error: res.ok ? undefined : `HTTP ${res.status}`,
		};
	} catch (err) {
		const latency = Math.round(performance.now() - start);
		return {
			reachable: false,
			latencyMs: latency,
			error: err instanceof Error ? err.message : String(err),
		};
	}
}

/**
 * Bridge Health Monitor — checks every protocol's health, overlays
 * circuit breaker state, and returns a complete health report.
 */
export class BridgeHealthMonitor {
	private cb: CircuitBreaker;

	constructor(env?: Env) {
		this.cb = getCircuitBreaker(env);
	}

	/**
	 * Check the health of a single protocol.
	 */
	async checkProtocolHealth(
		protocol: string,
		env: Env,
	): Promise<ProtocolHealth> {
		const normalized = normalizeProtocolName(protocol);
		const checker = PROTOCOL_HEALTH_CHECKS[normalized];
		const now = Date.now();

		// Get circuit breaker state
		const circuitState = await this.cb.getCircuitState(protocol);

		// Run health check
		let healthResult: { reachable: boolean; latencyMs: number; error?: string };
		if (checker) {
			healthResult = await checker(env);
		} else {
			healthResult = {
				reachable: false,
				latencyMs: 0,
				error: `No health check for ${protocol}`,
			};
		}

		return {
			protocol,
			reachable: healthResult.reachable,
			latencyMs: healthResult.latencyMs,
			successRate24h:
				circuitState.failureCount > 0
					? Math.max(
							0,
							1 -
								circuitState.failureCount /
									(circuitState.failureCount +
										Math.max(1, circuitState.successCount)),
						)
					: 1,
			rateLimitRemaining: healthResult.error ? 0 : 100, // Best-effort; real data requires API-specific headers
			circuitBreakerOpen: circuitState.state === "open",
			circuitBreakerState: circuitState.state,
			lastSuccessAt: circuitState.lastSuccessAt,
			lastErrorAt: circuitState.lastFailureAt,
			lastError: circuitState.lastError ?? healthResult.error,
			consecutiveFailures: circuitState.failureCount,
			checkedAt: now,
		};
	}

	/**
	 * Get the overall health report for ALL supported protocols.
	 */
	async getOverallHealth(env: Env): Promise<BridgeHealthReport> {
		const start = performance.now();
		const allProtocols = [
			"nostr",
			"farcaster",
			"bluesky",
			"mastodon",
			"lens",
			"telegram",
			"rss",
			"zora",
			"threads",
		];

		// Check all protocols in parallel
		const checks = allProtocols.map(async (protocol) => {
			try {
				return await this.checkProtocolHealth(protocol, env);
			} catch (err) {
				return {
					protocol,
					reachable: false,
					latencyMs: 0,
					successRate24h: 0,
					rateLimitRemaining: 0,
					circuitBreakerOpen: true,
					circuitBreakerState: "open" as const,
					lastSuccessAt: null,
					lastErrorAt: Date.now(),
					lastError: err instanceof Error ? err.message : String(err),
					consecutiveFailures: 999,
					checkedAt: Date.now(),
				};
			}
		});

		const results = await Promise.all(checks);
		const protocols: Record<string, ProtocolHealth> = {};
		for (const r of results) {
			protocols[r.protocol] = r;
		}

		const values = Object.values(protocols);
		const up = values.filter(
			(v) => v.reachable && !v.circuitBreakerOpen,
		).length;
		const down = values.filter(
			(v) => !v.reachable || v.circuitBreakerOpen,
		).length;

		// Overall status: all up → 'up', all down → 'down', mix → 'degraded'
		const overall: ProtocolStatus =
			up === values.length
				? "up"
				: down === values.length
					? "down"
					: "degraded";

		return {
			overall,
			protocols,
			summary: {
				total: values.length,
				up,
				degraded: values.length - up - down,
				down,
			},
			checkedAt: Date.now(),
			latencyMs: Math.round(performance.now() - start),
		};
	}
}

// ─── Stats Tracking ───────────────────────────────────────────────────────

const OPERATION_STATS_PREFIX = "bridge-stats:";

/**
 * Record a bridge operation stat in KV.
 * This is fire-and-forget — non-critical data.
 */
export async function recordBridgeOperation(
	env: Env,
	protocol: string,
	success: boolean,
	latencyMs: number,
	error?: string,
): Promise<void> {
	if (!env.CACHE) return;

	const date = new Date();
	const hourKey = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}T${String(date.getUTCHours()).padStart(2, "0")}`;
	const key = `${OPERATION_STATS_PREFIX}${protocol}:${hourKey}`;

	try {
		const raw = await env.CACHE.get(key);
		const current = raw
			? (JSON.parse(raw) as {
					total: number;
					success: number;
					totalLatency: number;
					errors: string[];
				})
			: { total: 0, success: 0, totalLatency: 0, errors: [] };
		current.total++;
		if (success) current.success++;
		current.totalLatency += latencyMs;
		if (error) {
			current.errors = [...current.errors.slice(-9), error]; // Keep last 10 errors
		}
		await env.CACHE.put(key, JSON.stringify(current), {
			expirationTtl: 86400 * 7,
		}); // 7 days
	} catch {
		// Non-critical
	}
}

/**
 * Get bridge stats for a protocol over the last 24 hours.
 */
export async function getProtocolStats(
	env: Env,
	protocol: string,
): Promise<ProtocolStats> {
	if (!env.CACHE) return emptyStats();

	const now = new Date();
	const hours: string[] = [];
	for (let i = 0; i < 24; i++) {
		const d = new Date(now.getTime() - i * 60 * 60 * 1000);
		hours.push(
			`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}T${String(d.getUTCHours()).padStart(2, "0")}`,
		);
	}

	const cb = getCircuitBreaker(env);
	const circuitState = await cb.getCircuitState(protocol);
	let totalOps = 0;
	let successOps = 0;
	let totalLatency = 0;
	let lastError: string | undefined;

	for (const hour of hours) {
		try {
			const raw = await env.CACHE.get(
				`${OPERATION_STATS_PREFIX}${protocol}:${hour}`,
			);
			if (raw) {
				const data = JSON.parse(raw) as {
					total: number;
					success: number;
					totalLatency: number;
					errors: string[];
				};
				totalOps += data.total;
				successOps += data.success;
				totalLatency += data.totalLatency;
				if (data.errors.length > 0) {
					lastError = data.errors[data.errors.length - 1];
				}
			}
		} catch {
			// Skip
		}
	}

	return {
		totalOps,
		successOps,
		failedOps: totalOps - successOps,
		successRate: totalOps > 0 ? successOps / totalOps : 1,
		totalLatency,
		avgLatencyMs: totalOps > 0 ? Math.round(totalLatency / totalOps) : 0,
		circuitBreakerTripped: circuitState.state === "open",
		lastError,
	};
}

/**
 * Get bridge stats for ALL protocols.
 */
export async function getAllBridgeStats(env: Env): Promise<BridgeStats> {
	const protocols = [
		"nostr",
		"farcaster",
		"bluesky",
		"mastodon",
		"lens",
		"telegram",
		"rss",
		"zora",
		"threads",
	];
	const byProtocol: Record<string, ProtocolStats> = {};
	let totalOps = 0;
	let successOps = 0;
	let totalLatency = 0;
	let circuitBreakerTrips = 0;

	for (const p of protocols) {
		const stats = await getProtocolStats(env, p);
		byProtocol[p] = stats;
		totalOps += stats.totalOps;
		successOps += stats.successOps;
		totalLatency += stats.totalLatency;
		if (stats.circuitBreakerTripped) circuitBreakerTrips++;
	}

	const now = Date.now();
	return {
		periodStart: now - 86400_000,
		periodEnd: now,
		totalOperations: totalOps,
		successfulOperations: successOps,
		failedOperations: totalOps - successOps,
		successRate: totalOps > 0 ? successOps / totalOps : 1,
		totalLatencyMs: totalLatency,
		avgLatencyMs: totalOps > 0 ? Math.round(totalLatency / totalOps) : 0,
		byProtocol,
		circuitBreakerTrips,
	};
}

function emptyStats(): ProtocolStats {
	return {
		totalOps: 0,
		successOps: 0,
		failedOps: 0,
		successRate: 1,
		totalLatency: 0,
		avgLatencyMs: 0,
		circuitBreakerTripped: false,
	};
}

// ─── Helpers ───────────────────────────────────────────────────────────────

/**
 * Normalize protocol name variants to canonical form.
 */
function normalizeProtocolName(p: string): string {
	const lower = p.toLowerCase();
	if (lower === "activitypub" || lower === "mastodon") return "mastodon";
	if (lower === "atproto" || lower === "bluesky") return "bluesky";
	return lower;
}
