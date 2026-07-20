/**
 * /api/permanence — On-chain content permanence API
 *
 * POST /api/permanence/store       — Upload content to Arweave + IPFS, return proof
 * GET  /api/permanence/verify/:hash — Check if content hash exists in permanent storage
 * POST /api/permanence/anchor       — Submit an on-chain anchor tx for EVM users (Base)
 *
 * Stores proofs in KV: `permanence:{contentHash}` → ContentProof JSON
 */

import type { ContentProof } from "@degenfeed/types";
import type { Env } from "../index";
import { jsonResponse, noCacheJsonResponse } from "../index";
import { requireSession } from "../session";

// ─── Irys / Arweave constants ────────────────────────────────────────

const IRYS_GATEWAY = "https://node1.irys.xyz";
const _ARWEAVE_GATEWAY = "https://arweave.net";

// ─── IPFS constants ──────────────────────────────────────────────────

const IPFS_API = "https://api.pinata.cloud/pinning/pinFileToIPFS";
const _WEB3_STORAGE_API = "https://api.web3.storage/upload";

// ─── KV key helpers ──────────────────────────────────────────────────

function kvKey(contentHash: string): string {
	return `permanence:${contentHash.toLowerCase()}`;
}

// ─── SHA-256 hashing ─────────────────────────────────────────────────

async function sha256Hash(content: string): Promise<string> {
	const encoder = new TextEncoder();
	const data = encoder.encode(content);
	const hashBuffer = await crypto.subtle.digest("SHA-256", data);
	const hashArray = Array.from(new Uint8Array(hashBuffer));
	return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ─── Store on Arweave via Irys ───────────────────────────────────────

async function storeOnArweave(
	content: string,
	tags?: { name: string; value: string }[],
): Promise<string | null> {
	const byteSize = new TextEncoder().encode(content).length;
	if (byteSize > 100_000) {
		console.warn(
			`[permanence] Content too large for free tier: ${byteSize} bytes`,
		);
	}

	try {
		const defaultTags = [
			{ name: "App-Name", value: "DegenFeed" },
			{ name: "Content-Type", value: "text/plain" },
			{ name: "Unix-Time", value: String(Math.floor(Date.now() / 1000)) },
			...(tags ?? []),
		];

		const response = await fetch(`${IRYS_GATEWAY}/tx/matic`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				tags: defaultTags.map((t) => ({ name: t.name, value: t.value })),
				data: content,
				currency: "matic",
			}),
		});

		if (!response.ok) {
			const errBody = await response.text().catch(() => "");
			console.error(
				`[permanence] Irys upload failed: ${response.status} ${errBody}`,
			);
			return null;
		}

		const result = (await response.json()) as { id?: string };
		return result.id ?? null;
	} catch (err) {
		console.error("[permanence] Arweave upload error:", err);
		return null;
	}
}

// ─── Store on IPFS ───────────────────────────────────────────────────

async function storeOnIPFS(content: string, env: Env): Promise<string | null> {
	// Try Pinata first
	const pinataKey = env.PINATA_API_KEY;
	const pinataSecret = env.PINATA_SECRET_KEY;

	if (pinataKey && pinataSecret) {
		try {
			const formData = new FormData();
			const blob = new Blob([content], { type: "text/plain" });
			formData.append("file", blob, `post-${Date.now()}.txt`);

			const res = await fetch(IPFS_API, {
				method: "POST",
				headers: {
					pinata_api_key: pinataKey,
					pinata_secret_api_key: pinataSecret,
				},
				body: formData,
			});

			if (res.ok) {
				const data = (await res.json()) as { IpfsHash?: string };
				if (data.IpfsHash) return data.IpfsHash;
			}
		} catch {
			// Fall through
		}
	}

	// Fall back to public IPFS API (no pinning guarantee)
	try {
		const res = await fetch("https://ipfs.infura.io:5001/api/v0/add", {
			method: "POST",
			body: (() => {
				const fd = new FormData();
				fd.append(
					"file",
					new Blob([content], { type: "text/plain" }),
					"post.txt",
				);
				return fd;
			})(),
		});

		if (res.ok) {
			const data = (await res.json()) as { Hash?: string };
			if (data.Hash) return data.Hash;
		}
	} catch {
		// Silent
	}

	return null;
}

// ─── Handlers ────────────────────────────────────────────────────────

interface StoreRequest {
	content?: string;
	tags?: { name: string; value: string }[];
}

/**
 * POST /api/permanence/store
 *
 * Uploads post content to Arweave (via Irys) and IPFS in parallel.
 * Returns a ContentProof with storage references.
 * Requires authentication.
 */
export async function handlePermanenceStore(
	request: Request,
	env: Env,
): Promise<Response> {
	if (request.method !== "POST") {
		return jsonResponse({ error: "Method not allowed — use POST" }, 405);
	}

	const session = await requireSession(request, env);
	if (session instanceof Response) return session;

	let body: StoreRequest;
	try {
		body = (await request.json()) as StoreRequest;
	} catch {
		return jsonResponse({ error: "Invalid JSON body" }, 400);
	}

	if (!body.content || body.content.trim().length === 0) {
		return jsonResponse({ error: "Missing required field: content" }, 400);
	}

	const content = body.content.trim();
	const contentHash = await sha256Hash(content);
	const timestamp = Date.now();

	// Check if already stored
	if (env.PERMANENCE) {
		try {
			const existing = await env.PERMANENCE.get(kvKey(contentHash));
			if (existing) {
				const proof = JSON.parse(existing) as ContentProof;
				return jsonResponse({ proof, cached: true });
			}
		} catch {
			// Ignore parse errors, re-upload
		}
	}

	// Upload to Arweave and IPFS in parallel
	const [arweaveTxId, ipfsCid] = await Promise.all([
		storeOnArweave(content, body.tags).catch(() => null),
		storeOnIPFS(content, env).catch(() => null),
	]);

	const permanent = !!arweaveTxId || !!ipfsCid;

	if (!permanent) {
		return jsonResponse(
			{
				error: "Failed to store content on any permanent storage",
				contentHash,
			},
			502,
		);
	}

	const proof: ContentProof = {
		arweaveTxId: arweaveTxId ?? undefined,
		ipfsCid: ipfsCid ?? undefined,
		contentHash,
		timestamp,
		permanent,
	};

	// Store proof in KV
	if (env.PERMANENCE) {
		try {
			await env.PERMANENCE.put(kvKey(contentHash), JSON.stringify(proof), {
				expirationTtl: 0, // never expire
			});
		} catch (err) {
			console.error("[permanence] KV store failed:", err);
		}
	}

	return jsonResponse({ proof, cached: false }, 201);
}

/**
 * GET /api/permanence/verify/:hash
 *
 * Verify a content hash has been stored permanently.
 * Looks up the proof in KV and returns it.
 * Optionally also checks Arweave/IPFS for the content.
 */
export async function handlePermanenceVerify(
	request: Request,
	env: Env,
	contentHash: string,
): Promise<Response> {
	if (request.method !== "GET") {
		return jsonResponse({ error: "Method not allowed — use GET" }, 405);
	}

	if (contentHash?.length !== 64 || !/^[0-9a-f]{64}$/i.test(contentHash)) {
		return jsonResponse(
			{ error: "Invalid content hash — expected SHA-256 hex string" },
			400,
		);
	}

	if (!env.PERMANENCE) {
		return noCacheJsonResponse({
			verified: false,
			error: "Permanence storage not configured",
		});
	}

	const key = kvKey(contentHash);
	const raw = await env.PERMANENCE.get(key);

	if (!raw) {
		return noCacheJsonResponse({
			verified: false,
			error: "Content hash not found in permanent storage",
		});
	}

	let proof: ContentProof;
	try {
		proof = JSON.parse(raw) as ContentProof;
	} catch {
		return jsonResponse({ error: "Failed to parse stored proof" }, 500);
	}

	return noCacheJsonResponse({ verified: true, proof });
}

/**
 * POST /api/permanence/anchor
 *
 * For EVM users with a connected wallet: submit an on-chain anchor
 * transaction recording the content hash on Base (chain ID 8453).
 *
 * Body: { contentHash: string, txHash: string, chainId?: number }
 *
 * This is a verification endpoint — the actual tx is submitted by the
 * client via wagmi/viem. The server records the on-chain proof.
 */
export async function handlePermanenceAnchor(
	request: Request,
	env: Env,
): Promise<Response> {
	if (request.method !== "POST") {
		return jsonResponse({ error: "Method not allowed — use POST" }, 405);
	}

	const session = await requireSession(request, env);
	if (session instanceof Response) return session;

	let body: {
		contentHash?: string;
		txHash?: string;
		chainId?: number;
	};
	try {
		body = (await request.json()) as {
			contentHash?: string;
			txHash?: string;
			chainId?: number;
		};
	} catch {
		return jsonResponse({ error: "Invalid JSON body" }, 400);
	}

	if (!body.contentHash || !body.txHash) {
		return jsonResponse(
			{ error: "Missing required fields: contentHash, txHash" },
			400,
		);
	}

	if (!/^[0-9a-f]{64}$/i.test(body.contentHash)) {
		return jsonResponse({ error: "Invalid content hash format" }, 400);
	}

	const chainId = body.chainId ?? 8453; // Default to Base

	// Look up existing proof
	if (!env.PERMANENCE) {
		return jsonResponse({ error: "Permanence storage not configured" }, 500);
	}

	const key = kvKey(body.contentHash);
	const raw = await env.PERMANENCE.get(key);
	let proof: ContentProof;

	if (raw) {
		try {
			proof = JSON.parse(raw) as ContentProof;
		} catch {
			proof = {
				contentHash: body.contentHash,
				timestamp: Date.now(),
				permanent: true,
			};
		}
	} else {
		// Create a minimal proof if this is an anchor-only submission
		proof = {
			contentHash: body.contentHash,
			timestamp: Date.now(),
			permanent: true,
		};
	}

	// Add on-chain anchor data
	proof.onChainTxHash = body.txHash;
	proof.onChainChainId = chainId;

	// Update KV
	await env.PERMANENCE.put(key, JSON.stringify(proof), { expirationTtl: 0 });

	return jsonResponse({ proof, anchored: true });
}
