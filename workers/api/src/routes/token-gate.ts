/**
 * @degenfeed/api-worker — Token Gate Verification API
 *
 * Endpoints:
 *   POST /api/token-gate/verify   — Verify user holds required token
 *   GET  /api/token-gate/:postId  — Get token gate for a post
 *
 * Uses KV-backed caching (5-min TTL) to avoid hammering RPCs.
 * Falls back to on-chain RPC calls when cache is cold.
 *
 * The server-side verification delegates to the @degenfeed/token-gate
 * package which handles EVM eth_call and Solana getTokenAccountsByOwner.
 */

import {
	checkTokenGate,
	resolveTokenGateSymbol,
	type TokenGate,
} from "@degenfeed/token-gate";
import type { Env } from "../index";
import { jsonResponse, noCacheJsonResponse } from "../index";
import { sanitizeString } from "../sanitize";

// ─── KV cache constants ────────────────────────────────────────────────────

const CACHE_TTL_SEC = 300; // 5 minutes
const CACHE_KV_PREFIX = "token-gate:verify:";

// ─── POST /api/token-gate/verify ─────────────────────────────────────────

interface VerifyRequest {
	gate?: TokenGate;
	walletAddress?: string;
}

export async function handleTokenGateVerify(
	request: Request,
	env: Env,
): Promise<Response> {
	let body: VerifyRequest;
	try {
		body = (await request.json()) as VerifyRequest;
	} catch {
		return jsonResponse({ error: "Invalid JSON body" }, 400);
	}

	const gate = body.gate;
	if (!gate?.chain || !gate.type || !gate.contractAddress) {
		return jsonResponse(
			{ error: "Token gate config required (chain, type, contractAddress)" },
			400,
		);
	}

	// Validate chain
	const validChains = [
		"ethereum",
		"base",
		"polygon",
		"solana",
		"arbitrum",
		"optimism",
	];
	if (!validChains.includes(gate.chain)) {
		return jsonResponse({ error: `Invalid chain: ${gate.chain}` }, 400);
	}

	// Validate type
	const validTypes = ["erc20", "erc721", "erc1155"];
	if (!validTypes.includes(gate.type)) {
		return jsonResponse({ error: `Invalid token type: ${gate.type}` }, 400);
	}

	// Validate contract address
	const contractAddress = sanitizeString(gate.contractAddress, 64);
	if (!contractAddress) {
		return jsonResponse({ error: "Invalid contract address" }, 400);
	}
	gate.contractAddress = contractAddress;

	const walletAddress = sanitizeString(body.walletAddress, 64);
	if (!walletAddress) {
		return jsonResponse({ error: "Wallet address required" }, 400);
	}

	// Validate wallet address format
	if (gate.chain === "solana") {
		if (walletAddress.length < 32 || walletAddress.length > 44) {
			return jsonResponse({ error: "Invalid Solana wallet address" }, 400);
		}
	} else {
		if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
			return jsonResponse({ error: "Invalid EVM wallet address" }, 400);
		}
	}

	// Check cache first
	const cacheKey = buildCacheKey(gate, walletAddress);
	if (env.CACHE) {
		try {
			const cached = await env.CACHE.get(cacheKey);
			if (cached) {
				const parsed = JSON.parse(cached) as { holds: boolean };
				return noCacheJsonResponse(parsed);
			}
		} catch {
			// Cache hiccup — fall through to on-chain check
		}
	}

	// Verify on-chain
	try {
		const holds = await checkTokenGate(gate, walletAddress);

		// Cache the result
		if (env.CACHE) {
			try {
				await env.CACHE.put(cacheKey, JSON.stringify({ holds }), {
					expirationTtl: CACHE_TTL_SEC,
				});
			} catch {
				// Non-fatal cache write failure
			}
		}

		return noCacheJsonResponse({ holds });
	} catch (err) {
		const message = err instanceof Error ? err.message : "Verification failed";
		return jsonResponse({ error: message }, 500);
	}
}

// ─── GET /api/token-gate/resolve — Resolve gate symbol ───────────────────

interface ResolveRequest {
	gate?: TokenGate;
}

export async function handleTokenGateResolve(
	request: Request,
	_env: Env,
): Promise<Response> {
	let body: ResolveRequest;
	try {
		body = (await request.json()) as ResolveRequest;
	} catch {
		return jsonResponse({ error: "Invalid JSON body" }, 400);
	}

	const gate = body.gate;
	if (!gate?.chain || !gate.type || !gate.contractAddress) {
		return jsonResponse({ error: "Token gate config required" }, 400);
	}

	try {
		const symbol = await resolveTokenGateSymbol(gate);
		return noCacheJsonResponse({ symbol });
	} catch {
		return jsonResponse({ error: "Could not resolve token symbol" }, 500);
	}
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function buildCacheKey(gate: TokenGate, walletAddress: string): string {
	const parts = [
		gate.chain,
		gate.contractAddress.toLowerCase(),
		gate.tokenId ?? "",
		gate.type,
		walletAddress.toLowerCase(),
	];
	return `${CACHE_KV_PREFIX}${parts.join(":")}`;
}
