/**
 * @degenfeed/api-worker — Error Recovery System
 *
 * CLASSIFIES every error the platform can encounter and produces a
 * recovery strategy. Every route handler MUST go through `withRecovery()`
 * which chains error classification → recovery execution → fallback.
 *
 * Error Categories:
 *   - NETWORK    — DNS failures, timeouts, connection refused, 429/5xx
 *   - WALLET     — User rejected, insufficient funds, wrong network, disconnect
 *   - CONTRACT   — Revert, out of gas, nonce errors, not deployed
 *   - STREAM     — RTMP lost, encoder crash, bandwidth, PeerTube down
 *   - COIN       — Deploy failed, initial buy failed, vesting claim failed
 *
 * ARCHITECTURE:
 *   Classifier → Strategy Selector → Recovery Executor → Fallback Chain
 *
 * Every recovery strategy returns a RecoveryOutcome that the caller
 * can use to surface the right UX (toast, retry button, fallback data).
 */

import { logError } from "../error-logger";
import type { Env } from "../index";

// ─── Error Categories ──────────────────────────────────────────────────────

export type ErrorCategory =
	| "network"
	| "wallet"
	| "contract"
	| "stream"
	| "coin"
	| "unknown";

export type ErrorSeverity = "critical" | "high" | "medium" | "low";

export interface ClassifiedError {
	category: ErrorCategory;
	severity: ErrorSeverity;
	code: string;
	message: string;
	retryable: boolean;
	userActionable: boolean;
	userMessage: string;
	retryAfterMs: number | null;
	/** Underlying cause for debugging */
	cause: Error | null;
	/** Suggested HTTP status for API responses */
	suggestedStatus: number;
}

// ─── Recovery Outcomes ─────────────────────────────────────────────────────

export interface RecoveryOutcome<T = unknown> {
	success: boolean;
	data: T | null;
	fallback: T | null;
	error: ClassifiedError | null;
	/** Human-readable message for toasts or UI */
	userMessage: string;
	/** If true, the caller should surface a retry action */
	shouldRetry: boolean;
	/** If provided, caller should wait this long before retry */
	retryAfterMs: number | null;
	/** Recovery actions taken */
	actions: RecoveryAction[];
}

export type RecoveryAction =
	| { type: "retry"; attempt: number; delayMs: number }
	| { type: "fallback"; source: string }
	| { type: "cache"; key: string }
	| { type: "degraded"; message: string }
	| { type: "circuit_break"; protocol: string }
	| { type: "offline_queue"; queueKey: string }
	| { type: "alert"; severity: ErrorSeverity; message: string }
	| { type: "escalate"; to: "admin" | "support" | "none" };

// ─── Error Pattern Matching ───────────────────────────────────────────────

const NETWORK_PATTERNS = [
	/timeout/i,
	/timed\s*out/i,
	/abort/i,
	/network/i,
	/fetch\s*failed/i,
	/DNS/i,
	/ENOTFOUND/i,
	/ECONNREFUSED/i,
	/ECONNRESET/i,
	/EAI_AGAIN/i,
	/socket/i,
	/connection/i,
	/ETIMEDOUT/i,
	/status\s*429/i,
	/rate\s*limit/i,
	/retry\s*after/i,
	/5\d{2}/,
	/service\s*unavailable/i,
	/bad\s*gateway/i,
	/upstream/i,
];

const WALLET_PATTERNS = [
	/user\s*rejected/i,
	/user\s*denied/i,
	/rejected\s*by\s*user/i,
	/insufficient\s*funds/i,
	/insufficient\s*balance/i,
	/wrong\s*network/i,
	/unsupported\s*chain/i,
	/wallet\s*disconnected/i,
	/wallet\s*not\s*connected/i,
	/no\s*wallet/i,
	/provider\s*not\s*found/i,
	/not\s*found/i, // wallet not found
	/action\s*rejected/i,
];

const CONTRACT_PATTERNS = [
	/revert/i,
	/out\s*of\s*gas/i,
	/gas\s*limit/i,
	/intrinsic\s*gas/i,
	/nonce\s*too\s*low/i,
	/replacement.*underpriced/i,
	/already\s*known/i,
	/execution\s*reverted/i,
	/call\s*reverted/i,
	/contract\s*not\s*deployed/i,
	/not\s*deployed/i,
	/invalid\s*opcode/i,
	/stack\s*too\s*deep/i,
	/static\s*call/i,
	/transfer\s*failed/i,
	/ERC20.*transfer/i,
	/underflow/i,
	/overflow/i,
	/max\s*fee/i,
	/max\s*priority\s*fee/i,
];

const STREAM_PATTERNS = [
	/RTMP/i,
	/stream\s*key/i,
	/encoder/i,
	/bandwidth/i,
	/bitrate/i,
	/PeerTube.*down/i,
	/peerTube.*unreachable/i,
	/stream.*not\s*found/i,
	/stream.*offline/i,
	/live.*ended/i,
	/broadcast/i,
	/ingest/i,
	/stream.*error/i,
	/transcoding/i,
	/resolution/i,
	/stream.*timeout/i,
];

const COIN_PATTERNS = [
	/deploy.*fail/i,
	/deployment.*fail/i,
	/initial.*buy/i,
	/vesting.*claim/i,
	/vesting.*fail/i,
	/graduation.*fail/i,
	/migration.*fail/i,
	/wormhole.*down/i,
	/bridge.*down/i,
	/bridge.*unreachable/i,
	/curve.*error/i,
	/bonding.*curve.*fail/i,
	/token.*already.*exists/i,
	/duplicate.*symbol/i,
	/launch.*fail/i,
	/prebonding.*fail/i,
	/insufficient.*liquidity/i,
];

// ─── Error Classification ─────────────────────────────────────────────────

let _codeCounter = 0;
function generateCode(): string {
	_codeCounter += 1;
	const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
	return `ER-${rand}`;
}

/**
 * Classify an error into a category with severity, retryability,
 * and a user-facing message.
 */
export function classifyError(error: unknown): ClassifiedError {
	const message =
		error instanceof Error ? error.message : String(error ?? "Unknown error");
	const cause = error instanceof Error ? error : null;
	const code = generateCode();

	// Check each category
	const cat = categorizeByPattern(message);

	const base: Omit<
		ClassifiedError,
		"retryable" | "userActionable" | "userMessage" | "suggestedStatus"
	> = {
		category: cat,
		severity: "medium",
		code,
		message,
		retryAfterMs: null,
		cause,
	};

	switch (cat) {
		case "network": {
			const is429 = /429|rate\s*limit|retry\s*after/i.test(message);
			const is5xx = /5\d{2}|service.*unavailable|bad.*gateway|upstream/i.test(
				message,
			);
			const retryAfter = extractRetryAfter(message);
			return {
				...base,
				severity: is429 ? "medium" : is5xx ? "high" : "medium",
				retryable: true,
				userActionable: false,
				userMessage: is429
					? "Rate limited. Please wait a moment and try again."
					: is5xx
						? "Our servers are temporarily unavailable. We're retrying automatically."
						: "A network error occurred. Check your connection and try again.",
				retryAfterMs: retryAfter,
				suggestedStatus: is429 ? 429 : 503,
			};
		}

		case "wallet": {
			const rejected = /rejected|denied|cancelled|canceled/i.test(message);
			const insufficient = /insufficient.*funds|insufficient.*balance/i.test(
				message,
			);
			const wrongNetwork = /wrong.*network|unsupported.*chain/i.test(message);
			const disconnected = /disconnected|not\s*connected|not\s*found/i.test(
				message,
			);
			return {
				...base,
				severity: rejected
					? "low"
					: insufficient
						? "high"
						: wrongNetwork
							? "medium"
							: "medium",
				retryable: !rejected && !disconnected,
				userActionable: true,
				userMessage: rejected
					? "Transaction was cancelled. No changes were made."
					: insufficient
						? "Insufficient funds in your wallet. Add funds and try again."
						: wrongNetwork
							? "Wrong network detected. Please switch to the correct network in your wallet."
							: disconnected
								? "Wallet disconnected. Please reconnect your wallet."
								: "A wallet error occurred. Please try again.",
				suggestedStatus: rejected ? 400 : insufficient ? 402 : 400,
			};
		}

		case "contract": {
			const revert = /revert|execution\s*reverted/i.test(message);
			const gas = /gas|intrinsic/i.test(message);
			const nonce = /nonce/i.test(message);
			const notDeployed = /not\s*deployed/i.test(message);
			return {
				...base,
				severity: gas
					? "high"
					: revert
						? "medium"
						: notDeployed
							? "high"
							: "medium",
				retryable: gas || nonce,
				userActionable: gas || nonce || notDeployed,
				userMessage: revert
					? "The transaction was reverted by the smart contract."
					: gas
						? "Transaction ran out of gas. Increase gas limit and try again."
						: nonce
							? "Nonce conflict detected. Please reset your wallet or try again."
							: notDeployed
								? "This contract is not deployed on the current chain."
								: "A smart contract error occurred.",
				suggestedStatus: 400,
			};
		}

		case "stream": {
			const rtmp = /RTMP|ingest|broadcast/i.test(message);
			const key = /stream\s*key/i.test(message);
			const down = /down|unreachable/i.test(message);
			return {
				...base,
				severity: down ? "high" : key ? "high" : rtmp ? "medium" : "medium",
				retryable: rtmp || down,
				userActionable: key,
				userMessage: rtmp
					? "Stream connection lost. Attempting to reconnect..."
					: key
						? "Invalid stream key. Verify your stream key in OBS settings."
						: down
							? "Streaming server is temporarily unavailable."
							: "A streaming error occurred.",
				suggestedStatus: rtmp ? 502 : 400,
			};
		}

		case "coin": {
			const deploy = /deploy|deployment/i.test(message);
			const vesting = /vesting/i.test(message);
			const graduate = /graduation|migration/i.test(message);
			const bridge = /wormhole|bridge/i.test(message);
			return {
				...base,
				severity: deploy
					? "critical"
					: vesting
						? "high"
						: graduate
							? "high"
							: "medium",
				retryable: bridge || graduate,
				userActionable: true,
				userMessage: deploy
					? "Coin deployment failed. Your gas was not consumed — please try again."
					: vesting
						? "Vesting claim failed. Your tokens are safe — contact support."
						: graduate
							? "Bonding curve graduation encountered an issue. Retrying..."
							: bridge
								? "Cross-chain bridge is temporarily unavailable."
								: "A coin operation failed.",
				suggestedStatus: 500,
			};
		}

		default: {
			return {
				...base,
				category: "unknown",
				severity: "medium",
				retryable: false,
				userActionable: false,
				userMessage: "An unexpected error occurred.",
				suggestedStatus: 500,
			};
		}
	}
}

/**
 * Match an error message against known patterns to determine category.
 */
function categorizeByPattern(message: string): ErrorCategory {
	// Score each category
	const scores: Record<ErrorCategory, number> = {
		network: 0,
		wallet: 0,
		contract: 0,
		stream: 0,
		coin: 0,
		unknown: 0,
	};

	for (const p of NETWORK_PATTERNS) {
		if (p.test(message)) scores.network++;
	}
	for (const p of WALLET_PATTERNS) {
		if (p.test(message)) scores.wallet++;
	}
	for (const p of CONTRACT_PATTERNS) {
		if (p.test(message)) scores.contract++;
	}
	for (const p of STREAM_PATTERNS) {
		if (p.test(message)) scores.stream++;
	}
	for (const p of COIN_PATTERNS) {
		if (p.test(message)) scores.coin++;
	}

	// Also check for HTTP status codes
	if (message.includes("429") || message.includes("rate limit"))
		scores.network = Math.max(scores.network, 3);
	if (/5\d{2}/.test(message)) scores.network++;

	const sorted = (Object.entries(scores) as [ErrorCategory, number][]).sort(
		(a, b) => b[1] - a[1],
	);

	// Return the highest-scoring category, or unknown if nothing matched
	if (sorted[0]?.[1] > 0) return sorted[0][0];

	// Check error instance type as fallback
	if (errorIsNetworkType(message)) return "network";

	return "unknown";
}

/**
 * Check if the error is a native network-like error (TypeError from fetch, etc).
 */
function errorIsNetworkType(message: string): boolean {
	const networkTypePatterns = [
		/TypeError/i,
		/fetch/i,
		/load\s*failed/i,
		/net::/i,
		/ERR_/i,
	];
	return networkTypePatterns.some((p) => p.test(message));
}

/**
 * Extract Retry-After header value from error message (seconds).
 */
function extractRetryAfter(message: string): number | null {
	const match = message.match(/retry\s*after[:\s]+(\d+)/i);
	if (match?.[1]) return Number.parseInt(match[1], 10) * 1000;
	// Also check for rate limit messages with seconds
	const seconds = message.match(/rate\s*limit[^.]*(\d+)\s*second/i);
	if (seconds?.[1]) return Number.parseInt(seconds[1], 10) * 1000;
	return null;
}

// ─── Recovery Strategy ─────────────────────────────────────────────────────

export interface RecoveryOptions<T = unknown> {
	/** Maximum retry attempts for retryable errors */
	maxRetries?: number;
	/** Base delay between retries (ms) */
	baseDelayMs?: number;
	/** Fallback data to return if all recovery fails */
	fallback?: T;
	/** Cache key to try as fallback */
	cacheKey?: string;
	/** Whether to queue the operation for offline replay */
	queueOffline?: boolean;
	/** Operation name for logging */
	operationName?: string;
	/** Protocol name for circuit breaker integration */
	protocol?: string;
	/** Environment for logging */
	env?: Env;
	/** Custom recovery handlers keyed by error category */
	handlers?: Partial<
		Record<
			ErrorCategory,
			(error: ClassifiedError) => Promise<RecoveryOutcome<T>>
		>
	>;
}

const DEFAULT_RECOVERY: Required<
	Pick<RecoveryOptions, "maxRetries" | "baseDelayMs">
> = {
	maxRetries: 3,
	baseDelayMs: 1000,
};

/**
 * Execute an operation with full error recovery.
 *
 * Flow:
 *   1. Attempt the operation
 *   2. On error: classify → select strategy → recover
 *   3. Recovery strategies (in order):
 *      a. Retry with backoff (for retryable errors)
 *      b. Cache fallback (if cacheKey provided)
 *      c. Custom handler (if provided for this category)
 *      d. Fallback data (if fallback provided)
 *      e. Return the classified error with recovery actions
 *
 * NEVER throws — always returns a RecoveryOutcome.
 */
export async function withRecovery<T>(
	operation: () => Promise<T>,
	options?: RecoveryOptions<T>,
): Promise<RecoveryOutcome<T>> {
	const maxRetries = options?.maxRetries ?? DEFAULT_RECOVERY.maxRetries;
	const baseDelayMs = options?.baseDelayMs ?? DEFAULT_RECOVERY.baseDelayMs;
	const actions: RecoveryAction[] = [];

	// Attempt the operation with retry
	for (let attempt = 0; attempt <= maxRetries; attempt++) {
		try {
			const data = await operation();
			return {
				success: true,
				data,
				fallback: null,
				error: null,
				userMessage: "Operation completed successfully.",
				shouldRetry: false,
				retryAfterMs: null,
				actions,
			};
		} catch (err) {
			const classified = classifyError(err);
			actions.push({
				type: "retry",
				attempt,
				delayMs: baseDelayMs * 2 ** attempt,
			});

			// Log the error if env available
			if (options?.env) {
				logError(options.env, err, {
					route: options.operationName ?? "unknown",
					method: "RECOVERY",
					statusCode: classified.suggestedStatus,
				}).catch(() => {});
			}

			// Try custom handler first
			if (options?.handlers?.[classified.category]) {
				const handler = options.handlers[classified.category] as (
					error: ClassifiedError,
				) => Promise<RecoveryOutcome<T>>;
				try {
					const outcome = await handler(classified);
					// If custom handler succeeded, return it
					if (outcome.success || outcome.fallback !== null) {
						return outcome;
					}
				} catch {
					// Handler failed — fall through to default strategy
				}
			}

			// Network errors with circuit breaker support
			if (classified.category === "network" && options?.protocol) {
				actions.push({ type: "circuit_break", protocol: options.protocol });
			}

			// Try cache fallback
			if (options?.cacheKey) {
				try {
					const { getCached } = await import("./offline-queue");
					const cached = await getCached<T>(options.cacheKey);
					if (cached !== null) {
						actions.push({ type: "cache", key: options.cacheKey });
						return {
							success: true,
							data: cached,
							fallback: null,
							error: classified,
							userMessage: "Loaded from cache. Some data may be stale.",
							shouldRetry: true,
							retryAfterMs: null,
							actions,
						};
					}
				} catch {
					// Cache read failed — continue
				}
			}

			// Queue offline if requested
			if (options?.queueOffline && classified.retryable) {
				const queueKey = `${options.operationName ?? "op"}_${Date.now()}`;
				actions.push({ type: "offline_queue", queueKey });
				// Attempt to queue
				try {
					const { enqueueOperation } = await import("./offline-queue");
					await enqueueOperation(
						queueKey,
						{ name: options.operationName ?? "operation", payload: {} },
						options.env,
					);
				} catch {
					// Queue failed — continue
				}
			}

			// On last attempt, try fallback
			if (attempt >= maxRetries) {
				if (options?.fallback !== undefined) {
					actions.push({ type: "fallback", source: "options.fallback" });
					return {
						success: false,
						data: null,
						fallback: options.fallback,
						error: classified,
						userMessage: classified.userMessage,
						shouldRetry: classified.retryable,
						retryAfterMs: classified.retryAfterMs,
						actions,
					};
				}

				// Return the error as final outcome
				return {
					success: false,
					data: null,
					fallback: null,
					error: classified,
					userMessage: classified.userMessage,
					shouldRetry: classified.retryable,
					retryAfterMs: classified.retryAfterMs,
					actions,
				};
			}

			// Wait before retry
			const delay = Math.min(
				baseDelayMs * 2 ** attempt + Math.random() * baseDelayMs,
				30_000,
			);
			await new Promise((resolve) => setTimeout(resolve, delay));
		}
	}

	// Unreachable but satisfies TypeScript
	return {
		success: false,
		data: null,
		fallback: null,
		error: {
			category: "unknown",
			severity: "high",
			code: "ER-0000",
			message: "Unexpected exit from recovery loop",
			retryable: false,
			userActionable: false,
			userMessage: "An unexpected error occurred.",
			retryAfterMs: null,
			cause: null,
			suggestedStatus: 500,
		},
		userMessage: "An unexpected error occurred.",
		shouldRetry: false,
		retryAfterMs: null,
		actions,
	};
}

// ─── Convenience Wrappers ──────────────────────────────────────────────────

/**
 * Classify an HTTP response status into a structured error.
 */
export function classifyHttpStatus(
	status: number,
	body?: string,
): ClassifiedError {
	if (status === 429) {
		return {
			category: "network",
			severity: "medium",
			code: generateCode(),
			message: body ?? "Rate limited",
			retryable: true,
			userActionable: false,
			userMessage: "Too many requests. Please wait a moment.",
			retryAfterMs: null,
			cause: null,
			suggestedStatus: 429,
		};
	}
	if (status >= 500) {
		return {
			category: "network",
			severity: "high",
			code: generateCode(),
			message: body ?? `Server error ${status}`,
			retryable: true,
			userActionable: false,
			userMessage: "Our servers are having trouble. Retrying...",
			retryAfterMs: null,
			cause: null,
			suggestedStatus: status,
		};
	}
	if (status === 400 || status === 402) {
		// Likely wallet/contract error
		return {
			category: "wallet",
			severity: "medium",
			code: generateCode(),
			message: body ?? `Client error ${status}`,
			retryable: false,
			userActionable: true,
			userMessage: body ?? "Request could not be processed.",
			retryAfterMs: null,
			cause: null,
			suggestedStatus: status,
		};
	}
	return {
		category: "unknown",
		severity: "medium",
		code: generateCode(),
		message: body ?? `HTTP ${status}`,
		retryable: status === 408 || status === 409,
		userActionable: false,
		userMessage: "An unexpected response was received.",
		retryAfterMs: null,
		cause: null,
		suggestedStatus: status,
	};
}

/**
 * Extract a Retry-After value from Response headers.
 */
export function getRetryAfterMs(response: Response): number | null {
	const header = response.headers.get("retry-after");
	if (!header) return null;
	const seconds = Number.parseInt(header, 10);
	if (!Number.isNaN(seconds)) return seconds * 1000;
	// HTTP-date format (rare but spec-compliant)
	const date = new Date(header);
	if (!Number.isNaN(date.getTime()))
		return Math.max(0, date.getTime() - Date.now());
	return null;
}

/**
 * Attempt to parse JSON from a response safely.
 */
export async function safeParseJson<T>(
	response: Response,
): Promise<{ data: T | null; error: string | null }> {
	try {
		const text = await response.text();
		const data = JSON.parse(text) as T;
		return { data, error: null };
	} catch (err) {
		return {
			data: null,
			error: err instanceof Error ? err.message : "Invalid JSON",
		};
	}
}

/**
 * Build a user-facing recovery message based on the error category.
 * Returns a message and suggested action type.
 */
export function getRecoverySuggestion(classified: ClassifiedError): {
	message: string;
	action:
		| "retry"
		| "connect_wallet"
		| "switch_network"
		| "check_stream_key"
		| "contact_support"
		| "dismiss"
		| "refresh";
} {
	switch (classified.category) {
		case "network":
			return {
				message: "Please check your internet connection and try again.",
				action: "retry",
			};
		case "wallet":
			if (/rejected|denied|cancelled/i.test(classified.message)) {
				return { message: "You cancelled the transaction.", action: "dismiss" };
			}
			if (/insufficient/i.test(classified.message)) {
				return {
					message: "Add funds to your wallet and try again.",
					action: "dismiss",
				};
			}
			if (/wrong\s*network|unsupported.*chain/i.test(classified.message)) {
				return {
					message: "Switch to the correct network in your wallet.",
					action: "switch_network",
				};
			}
			if (/disconnected|not\s*connected/i.test(classified.message)) {
				return {
					message: "Please reconnect your wallet.",
					action: "connect_wallet",
				};
			}
			return {
				message: "Open your wallet and try again.",
				action: "connect_wallet",
			};
		case "contract":
			return {
				message:
					"A smart contract error occurred. If this persists, contact support.",
				action: "retry",
			};
		case "stream":
			if (/stream\s*key/i.test(classified.message)) {
				return {
					message: "Verify your stream key in OBS settings.",
					action: "check_stream_key",
				};
			}
			return {
				message: "Stream connection issue. Attempting to reconnect...",
				action: "retry",
			};
		case "coin":
			return {
				message: "A coin operation failed. Your funds are safe.",
				action: "contact_support",
			};
		default:
			return { message: "Something unexpected happened.", action: "refresh" };
	}
}
