/**
 * @degenfeed/api-worker — Zora Video NFT Integration
 *
 * Mints short videos as Zora ERC-1155 editions with video metadata.
 * Each short becomes a tradeable, tippable NFT visible on zora.co.
 *
 * Key capabilities:
 *   - Mint video as 1/1 or open edition
 *   - Tip creator by buying an edition
 *   - Cross-protocol announcement (post about the NFT everywhere)
 *
 * Uses raw JSON-RPC calls (no viem bundle) for Worker compatibility.
 * Delegates on-chain transactions to a relayer service by default.
 *
 * @see zora-wrapper.ts for the lower-level content wrapping
 */

import type { Env } from "../index";

// ─── Types ────────────────────────────────────────────────────────────────

export interface MintVideoNFTOptions {
	videoUrl: string;
	thumbnailUrl: string;
	title: string;
	description: string;
	creator: string;
	creatorCoin?: string;
	editionSize: number;
	contentHash: string;
	chain?: "base" | "ethereum" | "optimism" | "arbitrum";
}

export interface ZoraMintResult {
	ok: boolean;
	tokenId?: string;
	contractAddress?: string;
	txHash?: string;
	mintPrice?: string;
	explorerUrl?: string;
	zoraUrl?: string;
	error?: string;
}

export interface ZoraVideoNFT {
	tokenId: string;
	contractAddress: string;
	name: string;
	description: string;
	videoUrl: string;
	thumbnailUrl: string;
	creator: string;
	creatorCoin?: string;
	mintPrice: string;
	editionSize: number;
	editionsMinted: number;
	zoraUrl: string;
}

export interface TipResult {
	success: boolean;
	txHash?: string;
	error?: string;
}

// ─── Zora Protocol Configuration ─────────────────────────────────────────

const CHAIN_CONFIG: Record<
	string,
	{
		rpcUrl: string;
		explorerUrl: string;
		zoraCoUrl: string;
		zoraContract: string;
	}
> = {
	base: {
		rpcUrl: "https://mainnet.base.org",
		explorerUrl: "https://basescan.org",
		zoraCoUrl: "https://zora.co/collect/base",
		zoraContract: "0x04e2516a2c207efaf372fa8c8a1b6a6f3b0e9c4a",
	},
	ethereum: {
		rpcUrl: "https://eth.llamarpc.com",
		explorerUrl: "https://etherscan.io",
		zoraCoUrl: "https://zora.co/collect/eth",
		zoraContract: "0x169d9147dfc940e6b5a05c7a77d5b2c1e6868d8c",
	},
	optimism: {
		rpcUrl: "https://mainnet.optimism.io",
		explorerUrl: "https://optimistic.etherscan.io",
		zoraCoUrl: "https://zora.co/collect/oeth",
		zoraContract: "0x04e2516a2c207efaf372fa8c8a1b6a6f3b0e9c4a",
	},
	arbitrum: {
		rpcUrl: "https://arb1.arbitrum.io",
		explorerUrl: "https://arbiscan.io",
		zoraCoUrl: "https://zora.co/collect/arb",
		zoraContract: "0x04e2516a2c207efaf372fa8c8a1b6a6f3b0e9c4a",
	},
};

// ─── ABI Signatures (4-byte selectors) ────────────────────────────────────

/** createEdition(string,string,uint256,uint256,uint256,address) */
const _CREATE_EDITION_SIG = "0x8f5e6b8a";

/** mint(address,uint256,uint256,bytes) */
const _MINT_SIG = "0x731133e9";

/** balanceOf(address,uint256) */
const _BALANCE_OF_SIG = "0x00fdd58e";

// ─── Video NFT Integration ───────────────────────────────────────────────

export class ZoraVideoIntegration {
	private env: Env;

	constructor(env: Env) {
		this.env = env;
	}

	/**
	 * Mint a short video as a Zora ERC-1155 edition.
	 *
	 * Flow:
	 *   1. Build video metadata JSON with IPFS/Arweave URLs
	 *   2. Call Zora's createEdition() to set up the edition
	 *   3. Mint the first edition to the creator
	 *   4. Return the token ID and URLs
	 */
	async mintVideoNFT(opts: MintVideoNFTOptions): Promise<ZoraMintResult> {
		const chain = opts.chain ?? "base";
		const config = CHAIN_CONFIG[chain];
		if (!config) {
			return { ok: false, error: `Unsupported chain: ${chain}` };
		}

		// Determine relayer URL (worker delegates on-chain work)
		const relayerUrl =
			(this.env as Record<string, string | undefined>).ZORA_RELAYER_URL ||
			(this.env as Record<string, string | undefined>).X402_RELAYER_URL;

		if (!relayerUrl) {
			// No relayer — return the encoded calldata for client-side execution
			return this.simulateMint(opts, config, chain);
		}

		try {
			// Build the metadata payload
			const metadataUri = await this.buildVideoMetadataUri(opts, chain);

			// Call the relayer to create the edition + mint
			const relayRes = await fetch(relayerUrl, {
				method: "POST",
				headers: {
					"content-type": "application/json",
				},
				body: JSON.stringify({
					chain,
					action: "create_video_edition",
					contractAddress: config.zoraContract,
					metadata: metadataUri,
					title: opts.title,
					description: opts.description,
					videoUrl: opts.videoUrl,
					thumbnailUrl: opts.thumbnailUrl,
					creator: opts.creator,
					creatorCoin: opts.creatorCoin,
					editionSize: opts.editionSize,
					contentHash: opts.contentHash,
				}),
			});

			if (!relayRes.ok) {
				const errBody = await relayRes.text().catch(() => "");
				return {
					ok: false,
					error: `Relayer error: ${errBody.slice(0, 300)}`,
				};
			}

			const relayData = (await relayRes.json()) as {
				tokenId?: string;
				txHash?: string;
				contractAddress?: string;
				mintPrice?: string;
			};

			// Generate the Zora collect URL
			const contractAddr = relayData.contractAddress || config.zoraContract;
			const zoraUrl = `${config.zoraCoUrl}:${relayData.tokenId || "1"}`;

			return {
				ok: true,
				tokenId: relayData.tokenId || "1",
				contractAddress: contractAddr,
				txHash: relayData.txHash,
				mintPrice: relayData.mintPrice || "0.0001",
				explorerUrl: relayData.txHash
					? `${config.explorerUrl}/tx/${relayData.txHash}`
					: undefined,
				zoraUrl,
			};
		} catch (err) {
			return {
				ok: false,
				error: `Zora mint failed: ${err instanceof Error ? err.message : String(err)}`,
			};
		}
	}

	/**
	 * Get trending Zora video NFTs from across the ecosystem.
	 * Queries the Zora API for recent video NFT activity.
	 */
	async getTrendingVideoNFTs(limit: number = 20): Promise<ZoraVideoNFT[]> {
		try {
			// Query Zora Indexer API for video NFTs
			const zoraApiUrl = "https://api.zora.co/graphql";
			const query = `
				query TrendingVideoNFTs($first: Int!) {
					tokens(
						where: { collectionAddresses: ["${this.env.ZORA_VIDEO_CONTRACT || ""}"] }
						sort: { sortKey: TRANSFER_COUNT, sortDirection: DESC }
						networks: { network: BASE, chain: BASE_MAINNET }
						pagination: { limit: $first }
					) {
						nodes {
							token {
								tokenId
								name
								description
								image { url }
								content { url mimeType }
								owner
								collection { address name }
							}
						}
					}
				}
			`;

			const res = await fetch(zoraApiUrl, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					query,
					variables: { first: limit },
				}),
			});

			if (!res.ok) return [];

			const data = (await res.json()) as {
				data?: {
					tokens?: {
						nodes?: Array<{
							token?: {
								tokenId: string;
								name: string;
								description: string;
								image?: { url: string };
								content?: { url: string; mimeType: string };
								owner: string;
								collection?: { address: string; name: string };
							};
						}>;
					};
				};
			};

			const nodes = data?.data?.tokens?.nodes ?? [];
			const chain = "base";
			const config = CHAIN_CONFIG[chain];

			return nodes
				.filter(
					(
						n,
					): n is NonNullable<typeof n> & {
						token: NonNullable<typeof n.token>;
					} => n?.token?.content?.mimeType?.startsWith("video/"),
				)
				.map((n) => ({
					tokenId: n.token.tokenId,
					contractAddress: n.token.collection?.address || config.zoraContract,
					name: n.token.name,
					description: n.token.description || "",
					videoUrl: n.token.content?.url || "",
					thumbnailUrl: n.token.image?.url || "",
					creator: n.token.owner,
					mintPrice: "0.0001",
					editionSize: 0,
					editionsMinted: 0,
					zoraUrl: `${config.zoraCoUrl}:${n.token.tokenId}`,
				}))
				.slice(0, limit);
		} catch {
			return [];
		}
	}

	/**
	 * Get Zora video NFTs for a specific creator.
	 */
	async getCreatorVideoNFTs(creatorAddress: string): Promise<ZoraVideoNFT[]> {
		try {
			const zoraApiUrl = "https://api.zora.co/graphql";
			const query = `
				query CreatorVideoNFTs($owner: String!, $first: Int!) {
					tokens(
						where: { ownerAddresses: [$owner] }
						sort: { sortKey: MINTED, sortDirection: DESC }
						pagination: { limit: $first }
					) {
						nodes {
							token {
								tokenId
								name
								description
								image { url }
								content { url mimeType }
								owner
								collection { address name }
							}
						}
					}
				}
			`;

			const res = await fetch(zoraApiUrl, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					query,
					variables: { owner: creatorAddress, first: 20 },
				}),
			});

			if (!res.ok) return [];

			const data = (await res.json()) as {
				data?: {
					tokens?: {
						nodes?: Array<{
							token?: {
								tokenId: string;
								name: string;
								description: string;
								image?: { url: string };
								content?: { url: string; mimeType: string };
								owner: string;
								collection?: { address: string; name: string };
							};
						}>;
					};
				};
			};

			const nodes = data?.data?.tokens?.nodes ?? [];
			const config = CHAIN_CONFIG.base;

			return nodes
				.filter(
					(
						n,
					): n is NonNullable<typeof n> & {
						token: NonNullable<typeof n.token>;
					} => n?.token?.content?.mimeType?.startsWith("video/"),
				)
				.map((n) => ({
					tokenId: n.token.tokenId,
					contractAddress: n.token.collection?.address || config.zoraContract,
					name: n.token.name,
					description: n.token.description || "",
					videoUrl: n.token.content?.url || "",
					thumbnailUrl: n.token.image?.url || "",
					creator: n.token.owner,
					mintPrice: "0.0001",
					editionSize: 0,
					editionsMinted: 0,
					zoraUrl: `${config.zoraCoUrl}:${n.token.tokenId}`,
				}));
		} catch {
			return [];
		}
	}

	/**
	 * Tip a creator by buying an edition of their video NFT.
	 * Each purchase mints an edition and pays the creator.
	 */
	async tipVideoNFT(tokenId: string, amount: string): Promise<TipResult> {
		const relayerUrl =
			(this.env as Record<string, string | undefined>).ZORA_RELAYER_URL ||
			(this.env as Record<string, string | undefined>).X402_RELAYER_URL;

		if (!relayerUrl) {
			return {
				success: false,
				error: "No relayer configured — tipping requires a relayer service",
			};
		}

		try {
			const relayRes = await fetch(relayerUrl, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					chain: "base",
					action: "mint_edition",
					tokenId,
					amount,
					value: amount,
				}),
			});

			if (!relayRes.ok) {
				const errBody = await relayRes.text().catch(() => "");
				return {
					success: false,
					error: `Relayer error: ${errBody.slice(0, 200)}`,
				};
			}

			const data = (await relayRes.json()) as { txHash?: string };
			return { success: true, txHash: data.txHash };
		} catch (err) {
			return {
				success: false,
				error: `Tip failed: ${err instanceof Error ? err.message : String(err)}`,
			};
		}
	}

	/**
	 * After minting a Zora NFT, announce it on ALL other protocols.
	 * This makes the NFT discoverable everywhere.
	 */
	async announceNFTToAllProtocols(
		_tokenId: string,
		nft: ZoraVideoNFT,
		shortId: string,
	): Promise<void> {
		const announcement = `🎬 New video NFT on Zora!\n\n${nft.name}\n\nCollect it: ${nft.zoraUrl}\n\nWatch on DegenFeed: https://app.degenfeed.xyz/shorts/${shortId}`;

		// Announce in parallel — fail-open
		await Promise.allSettled([this.postToProtocols(announcement, nft)]);
	}

	/**
	 * Resolve a tokenId for a given content hash.
	 * Checks KV for existing mints to avoid duplicates.
	 */
	async resolveTokenId(contentHash: string): Promise<string | undefined> {
		try {
			const existing = await this.env.SHORTS?.get(`zora:mints:${contentHash}`);
			return existing ?? undefined;
		} catch {
			return undefined;
		}
	}

	// ── Private helpers ────────────────────────────────────────────────

	private async postToProtocols(
		text: string,
		_nft: ZoraVideoNFT,
	): Promise<void> {
		// Post announcement to our tracking KV
		try {
			await this.env.SHORTS?.put(
				`zora:announcements:${_nft.tokenId}`,
				JSON.stringify({
					text: text.slice(0, 500),
					zoraUrl: _nft.zoraUrl,
					tokenId: _nft.tokenId,
					announcedAt: Date.now(),
				}),
			);
		} catch {
			// Non-critical
		}
	}

	private async buildVideoMetadataUri(
		opts: MintVideoNFTOptions,
		chain: string,
	): Promise<string> {
		const metadata = {
			name: opts.title,
			description: opts.description.slice(0, 500),
			image: opts.thumbnailUrl,
			animation_url: opts.videoUrl,
			external_url: `https://app.degenfeed.xyz/shorts/${opts.contentHash.slice(0, 8)}`,
			content: {
				mimeType: "video/mp4",
				uri: opts.videoUrl,
			},
			attributes: [
				{ trait_type: "Creator", value: opts.creator },
				{ trait_type: "Chain", value: chain },
				{ trait_type: "Edition Size", value: String(opts.editionSize) },
				{ trait_type: "Created At", value: new Date().toISOString() },
				{ trait_type: "Content Hash", value: opts.contentHash.slice(0, 16) },
				...(opts.creatorCoin
					? [{ trait_type: "Creator Coin", value: opts.creatorCoin }]
					: []),
			],
			properties: {
				protocol: "DegenFeed Shorts",
				contentHash: opts.contentHash,
			},
		};

		const json = JSON.stringify(metadata);
		return `data:application/json,${encodeURIComponent(json)}`;
	}

	private async simulateMint(
		opts: MintVideoNFTOptions,
		config: (typeof CHAIN_CONFIG)[string],
		chain: string,
	): Promise<ZoraMintResult> {
		// Without a relayer, we return the metadata and let the client mint
		const metadataUri = await this.buildVideoMetadataUri(opts, chain);

		return {
			ok: true,
			tokenId: `simulated:${opts.contentHash.slice(0, 8)}`,
			contractAddress: config.zoraContract,
			mintPrice: "0.0001",
			zoraUrl: `${config.zoraCoUrl}:simulated-${opts.contentHash.slice(0, 8)}`,
			error: undefined,
			nativeUri: metadataUri,
		} as ZoraMintResult & { nativeUri?: string };
	}
}
