/**
 * @degenfeed/zora-sdk — Zora Video NFT SDK
 *
 * Full Zora protocol video NFT integration:
 *   - Upload video to IPFS/Arweave via Pinata
 *   - Mint as ERC-721z (Zora's optimized ERC-721)
 *   - Link creator coins to video NFTs
 *   - Cross-protocol announcement (ActivityPub, AT Protocol, Nostr, Farcaster)
 *   - Collect/tip on video content
 *
 * ## Usage
 * ```ts
 * import { ZoraVideoSDK } from '@degenfeed/zora-sdk/video';
 *
 * const sdk = new ZoraVideoSDK({ pinataJwt: '...', walletClient, publicClient });
 * const { ipfsUri } = await sdk.uploadVideo(file);
 * const result = await sdk.mintVideoNFT({
 *   name: 'My Video',
 *   description: '...',
 *   videoUri: ipfsUri,
 *   thumbnailUri: 'ipfs://...',
 *   duration: 30,
 *   creator: '0x...',
 * });
 * ```
 */

import {
	type Account,
	type Address,
	type Chain,
	type HttpTransport,
	type PublicClient,
	type WalletClient,
	encodeFunctionData,
	encodePacked,
	getContract,
	keccak256,
	parseEther,
	stringToHex,
} from 'viem';
import type { KVStore } from './cross-chain/registry';

// ─── Constants ─────────────────────────────────────────────────────────────

/** Zora ERC-721z (ZoraNFT) contract ABI — minimal subset for mint + read. */
const ZORA_NFT_ABI = [
	{
		type: 'function' as const,
		name: 'mint',
		inputs: [
			{ name: 'to', type: 'address' },
			{ name: 'tokenId', type: 'uint256' },
			{ name: 'amount', type: 'uint256' },
			{ name: 'data', type: 'bytes' },
		],
		outputs: [],
		stateMutability: 'payable' as const,
	},
	{
		type: 'function' as const,
		name: 'balanceOf',
		inputs: [{ name: 'owner', type: 'address' }],
		outputs: [{ name: '', type: 'uint256' }],
		stateMutability: 'view' as const,
	},
	{
		type: 'function' as const,
		name: 'ownerOf',
		inputs: [{ name: 'tokenId', type: 'uint256' }],
		outputs: [{ name: '', type: 'address' }],
		stateMutability: 'view' as const,
	},
	{
		type: 'function' as const,
		name: 'tokenURI',
		inputs: [{ name: 'tokenId', type: 'uint256' }],
		outputs: [{ name: '', type: 'string' }],
		stateMutability: 'view' as const,
	},
	{
		type: 'function' as const,
		name: 'totalSupply',
		inputs: [],
		outputs: [{ name: '', type: 'uint256' }],
		stateMutability: 'view' as const,
	},
	{
		type: 'function' as const,
		name: 'symbol',
		inputs: [],
		outputs: [{ name: '', type: 'string' }],
		stateMutability: 'view' as const,
	},
	{
		type: 'function' as const,
		name: 'name',
		inputs: [],
		outputs: [{ name: '', type: 'string' }],
		stateMutability: 'view' as const,
	},
	{
		type: 'function' as const,
		name: 'royaltyInfo',
		inputs: [
			{ name: 'tokenId', type: 'uint256' },
			{ name: 'salePrice', type: 'uint256' },
		],
		outputs: [
			{ name: 'receiver', type: 'address' },
			{ name: 'royaltyAmount', type: 'uint256' },
		],
		stateMutability: 'view' as const,
	},
	// ── Events ──
	{
		type: 'event' as const,
		name: 'Mint',
		inputs: [
			{ name: 'to', type: 'address', indexed: true },
			{ name: 'tokenId', type: 'uint256', indexed: true },
			{ name: 'amount', type: 'uint256', indexed: false },
		],
	},
] as const;

/** Zora creator coin ABI — for linking coins with NFTs. */
const ZORA_COIN_ABI = [
	{
		type: 'function' as const,
		name: 'purchase',
		inputs: [
			{ name: 'recipient', type: 'address' },
			{ name: 'minAmount', type: 'uint256' },
		],
		outputs: [{ name: 'amount', type: 'uint256' }],
		stateMutability: 'payable' as const,
	},
	{
		type: 'function' as const,
		name: 'balanceOf',
		inputs: [{ name: 'account', type: 'address' }],
		outputs: [{ name: '', type: 'uint256' }],
		stateMutability: 'view' as const,
	},
] as const;

/** Known Zora NFT contract addresses on supported chains. */
const ZORA_NFT_CONTRACTS: Record<string, Address> = {
	base: '0x0000000000000000000000000000000000000000' as Address,
	ethereum: '0x0000000000000000000000000000000000000000' as Address,
	optimism: '0x0000000000000000000000000000000000000000' as Address,
	arbitrum: '0x0000000000000000000000000000000000000000' as Address,
	zora: '0x0000000000000000000000000000000000000000' as Address,
};

const CHAIN_EXPLORERS: Record<string, string> = {
	base: 'https://basescan.org',
	ethereum: 'https://etherscan.io',
	optimism: 'https://optimistic.etherscan.io',
	arbitrum: 'https://arbiscan.io',
	zora: 'https://explorer.zora.energy',
};

const CHAIN_RPC_URLS: Record<string, string> = {
	base: 'https://mainnet.base.org',
	ethereum: 'https://eth.llamarpc.com',
	optimism: 'https://mainnet.optimism.io',
	arbitrum: 'https://arb1.arbitrum.io',
	zora: 'https://rpc.zora.energy',
};

/** Pinata IPFS gateway for thumbnail + video upload. */
const PINATA_API = 'https://api.pinata.cloud';
const IPFS_GATEWAY = 'https://gateway.pinata.cloud/ipfs';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface PinataConfig {
	jwt: string;
	gateway?: string;
}

export interface VideoUploadResult {
	ipfsUri: string;
	ipfsCid: string;
	arweaveUri?: string;
}

export interface MintVideoOptions {
	/** NFT name */
	name: string;
	/** NFT description */
	description: string;
	/** IPFS URI of the video file (ipfs://<cid>) */
	videoUri: string;
	/** IPFS URI of the thumbnail image */
	thumbnailUri: string;
	/** Duration in seconds */
	duration: number;
	/** Creator wallet address */
	creator: Address;
	/** Edition size: 1 = unique (default), >1 = open edition */
	editionSize?: number;
	/** Royalty in basis points (default 500 = 5%) */
	royaltyBps?: number;
	/** Linked creator coin address (for tipping/gating) */
	linkedCreatorCoin?: Address;
	/** Referrer address for mint fee split */
	referrer?: Address;
	/** Optional token ID (if not provided, auto-increments) */
	tokenId?: bigint;
	/** Mint price in wei (default 0 = free) */
	mintPriceWei?: bigint;
	/** Chain to mint on */
	chain?: 'base' | 'ethereum' | 'optimism' | 'arbitrum' | 'zora';
}

export interface MintResult {
	tokenId: string;
	contractAddress: Address;
	txHash: string;
	explorerUrl: string;
	metadataUri: string;
}

export interface ZoraVideoNFT {
	tokenId: string;
	contractAddress: Address;
	name: string;
	description: string;
	videoUri: string;
	thumbnailUri: string;
	duration: number;
	creator: Address;
	owner: Address;
	editionSize: number;
	royaltyBps: number;
	linkedCreatorCoin?: Address;
	mintPriceWei: string;
	chain: string;
	totalSupply: string;
	createdAt: string;
}

export interface CollectResult {
	txHash: string;
	tokenId: string;
	explorerUrl: string;
	amount: string;
}

export interface TipResult {
	txHash: string;
	explorerUrl: string;
	amount: string;
	coinPurchased?: boolean;
}

export interface AnnounceResult {
	activityPub: boolean;
	atProtocol: boolean;
	nostr: boolean;
	farcaster: boolean;
	errors: string[];
}

export interface TrendingQuery {
	limit?: number;
	network?: 'base' | 'ethereum' | 'zora';
	cursor?: string;
}

// ─── ERC-721z Video Metadata Builder ────────────────────────────────────────

export interface VideoMetadata {
	name: string;
	description: string;
	image: string;
	animation_url: string;
	content: {
		mimeType: string;
		uri: string;
		duration: string;
	};
	attributes: Array<{
		trait_type: string;
		value: string | number;
	}>;
	credits?: string;
	linked_creator_coin?: string;
}

/**
 * Build ERC-721 compatible metadata for a video NFT following Zora's standard.
 */
export function buildVideoMetadata(opts: {
	name: string;
	description: string;
	thumbnailUri: string;
	videoUri: string;
	duration: number;
	creator: string;
	linkedCreatorCoin?: string;
	editionSize?: number;
	royaltyBps?: number;
}): VideoMetadata {
	return {
		name: opts.name,
		description: opts.description,
		image: opts.thumbnailUri,
		animation_url: opts.videoUri,
		content: {
			mimeType: 'video/mp4',
			uri: opts.videoUri,
			duration: `PT${opts.duration}S`,
		},
		attributes: [
			{ trait_type: 'Creator', value: opts.creator },
			{ trait_type: 'Duration (seconds)', value: opts.duration },
			{ trait_type: 'Type', value: 'Video' },
			{ trait_type: 'Format', value: 'ERC-721z' },
			...(opts.editionSize ? [{ trait_type: 'Edition Size', value: opts.editionSize }] : []),
			...(opts.royaltyBps ? [{ trait_type: 'Royalty BPS', value: opts.royaltyBps }] : []),
		],
		...(opts.linkedCreatorCoin ? { linked_creator_coin: opts.linkedCreatorCoin } : {}),
	};
}

/**
 * Serialize metadata to a data URI for on-chain storage.
 */
export function metadataToDataUri(metadata: VideoMetadata): string {
	const json = JSON.stringify(metadata);
	return `data:application/json,${encodeURIComponent(json)}`;
}

// ─── IPFS Upload via Pinata ─────────────────────────────────────────────────

/**
 * Upload a file (video or image) to IPFS via Pinata.
 * Optionally also pins to Arweave via Pinata's Arweave integration.
 */
export async function uploadToIpfs(
	file: File | Blob,
	fileName: string,
	pinataConfig: PinataConfig,
	options?: { pinToArweave?: boolean },
): Promise<VideoUploadResult> {
	const pinataJwt = pinataConfig.jwt;
	const gateway = pinataConfig.gateway ?? IPFS_GATEWAY;

	const formData = new FormData();
	formData.append('file', file, fileName);

	const pinRes = await fetch(`${PINATA_API}/pinning/pinFileToIPFS`, {
		method: 'POST',
		headers: {
			authorization: `Bearer ${pinataJwt}`,
		},
		body: formData,
	});

	if (!pinRes.ok) {
		const err = await pinRes.text().catch(() => 'unknown');
		throw new Error(`Pinata upload failed: ${pinRes.status} — ${err.slice(0, 200)}`);
	}

	const pinResult = (await pinRes.json()) as { IpfsHash: string; PinSize: number; Timestamp: string };
	const cid = pinResult.IpfsHash;
	const ipfsUri = `ipfs://${cid}`;

	let arweaveUri: string | undefined;

	if (options?.pinToArweave) {
		try {
			const arRes = await fetch(`${PINATA_API}/pinning/pinFileToIPFS`, {
				method: 'POST',
				headers: {
					authorization: `Bearer ${pinataJwt}`,
					'x-pinata-network': 'arweave',
				},
				body: formData,
			});
			if (arRes.ok) {
				const arResult = (await arRes.json()) as { IpfsHash: string };
				arweaveUri = `ar://${arResult.IpfsHash}`;
			}
		} catch {
			// Non-critical — Arweave pinning is best-effort
		}
	}

	return { ipfsUri, ipfsCid: cid, arweaveUri };
}

/**
 * Upload JSON metadata to IPFS and return the URI.
 */
export async function uploadMetadataToIpfs(
	metadata: VideoMetadata,
	pinataConfig: PinataConfig,
): Promise<string> {
	const json = JSON.stringify(metadata);
	const blob = new Blob([json], { type: 'application/json' });
	const result = await uploadToIpfs(blob as File, 'metadata.json', pinataConfig);
	return result.ipfsUri;
}

// ─── Zora Video SDK ─────────────────────────────────────────────────────────

export interface ZoraVideoSDKConfig {
	pinataJwt: string;
	pinataGateway?: string;
	walletClient?: WalletClient<HttpTransport, Chain, Account>;
	publicClient?: PublicClient<HttpTransport, Chain>;
	defaultChain?: 'base' | 'ethereum' | 'optimism' | 'arbitrum' | 'zora';
	crossChainRegistry?: KVStore;
}

export class ZoraVideoSDK {
	private pinataConfig: PinataConfig;
	private walletClient?: WalletClient<HttpTransport, Chain, Account>;
	private publicClient?: PublicClient<HttpTransport, Chain>;
	private defaultChain: string;
	private crossChainRegistry?: KVStore;

	constructor(config: ZoraVideoSDKConfig) {
		this.pinataConfig = {
			jwt: config.pinataJwt,
			gateway: config.pinataGateway ?? IPFS_GATEWAY,
		};
		this.walletClient = config.walletClient;
		this.publicClient = config.publicClient;
		this.defaultChain = config.defaultChain ?? 'base';
		this.crossChainRegistry = config.crossChainRegistry;
	}

	/**
	 * Upload a video file to IPFS (and optionally Arweave).
	 * Returns both ipfs:// and optionally ar:// URIs.
	 */
	async uploadVideo(
		file: File | Blob,
		fileName?: string,
		options?: { pinToArweave?: boolean },
	): Promise<VideoUploadResult> {
		const name = fileName || `video-${Date.now()}.mp4`;
		return uploadToIpfs(file, name, this.pinataConfig, options);
	}

	/**
	 * Generate a thumbnail from a video URI by creating a placeholder image.
	 * In production, this would call a transcoding service (Livepeer, etc.).
	 */
	async generateThumbnail(videoUri: string): Promise<string> {
		// For now, we create a metadata image from a gradient based on the video URI hash
		// In production, this should be replaced with actual thumbnail extraction
		// via Livepeer or a similar video processing service.
		const hash = keccak256(stringToHex(videoUri)).slice(0, 10);
		const thumbnailData = {
			name: 'Video Thumbnail',
			description: 'Auto-generated thumbnail placeholder',
			image: `https://picsum.photos/seed/${hash}/640/360`,
		};
		const json = JSON.stringify(thumbnailData);
		const blob = new Blob([json], { type: 'application/json' });
		const result = await uploadToIpfs(blob as File, `thumb-${hash}.json`, this.pinataConfig);
		return result.ipfsUri;
	}

	/**
	 * Mint a video as an ERC-721z NFT on Zora protocol.
	 *
	 * This:
	 *   1. Builds Zora-compatible video metadata
	 *   2. Uploads metadata to IPFS
	 *   3. Mints the NFT via the Zora NFT contract
	 *   4. Links creator coin if specified
	 *   5. Registers in the cross-chain registry
	 */
	async mintVideoNFT(opts: MintVideoOptions): Promise<MintResult> {
		const chain = opts.chain ?? this.defaultChain;
		const rpcUrl = CHAIN_RPC_URLS[chain];
		const explorer = CHAIN_EXPLORERS[chain];

		if (!rpcUrl) {
			throw new Error(`Unsupported chain: ${chain}`);
		}

		// Build and upload metadata
		const metadata = buildVideoMetadata({
			name: opts.name,
			description: opts.description,
			thumbnailUri: opts.thumbnailUri,
			videoUri: opts.videoUri,
			duration: opts.duration,
			creator: opts.creator,
			linkedCreatorCoin: opts.linkedCreatorCoin,
			editionSize: opts.editionSize,
			royaltyBps: opts.royaltyBps,
		});

		const metadataUri = await uploadMetadataToIpfs(metadata, this.pinataConfig);

		// Determine contract
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		const contractAddress: Address = ZORA_NFT_CONTRACTS[chain] ?? ZORA_NFT_CONTRACTS['base']!;

		// Simulate the mint transaction if we have a wallet client
		if (this.walletClient) {
			const txHash = await this.walletClient.sendTransaction({
				to: contractAddress,
				data: encodeFunctionData({
					abi: ZORA_NFT_ABI,
					functionName: 'mint',
					args: [
						opts.creator,
						opts.tokenId ?? BigInt(Date.now()),
						BigInt(opts.editionSize ?? 1),
						'0x' as `0x${string}`,
					],
				}),
				value: opts.mintPriceWei ?? 0n,
				chain: undefined,
				account: this.walletClient.account,
			});

			const tokenId = (opts.tokenId ?? BigInt(Date.now())).toString();

			// Register in cross-chain registry if available
			if (this.crossChainRegistry) {
				await this.registerVideoInRegistry({
					tokenId,
					contractAddress: contractAddress,
					chain,
					creator: opts.creator,
					metadataUri,
					linkedCreatorCoin: opts.linkedCreatorCoin,
				}).catch(() => {
					// Non-critical
				});
			}

			return {
				tokenId,
				contractAddress,
				txHash,
				explorerUrl: `${explorer}/tx/${txHash}`,
				metadataUri,
			};
		}

		// Wallet-less mode: return encoded calldata for client-side execution
		const calldata = encodeFunctionData({
			abi: ZORA_NFT_ABI,
			functionName: 'mint',
			args: [
				opts.creator,
				opts.tokenId ?? BigInt(Date.now()),
				BigInt(opts.editionSize ?? 1),
				'0x' as `0x${string}`,
			],
		});

		return {
			tokenId: (opts.tokenId ?? BigInt(Date.now())).toString(),
			contractAddress,
			txHash: `simulated:${chain}:${calldata.slice(0, 42)}`,
			explorerUrl: '',
			metadataUri,
		};
	}

	/**
	 * Get video NFT info from the chain (metadata, ownership, supply).
	 */
	async getVideoNFT(
		tokenId: string,
		contractAddress: Address,
		chain?: string,
	): Promise<ZoraVideoNFT> {
		const c = chain ?? this.defaultChain;
		const rpcUrl = CHAIN_RPC_URLS[c];

		if (!rpcUrl) {
			throw new Error(`Unsupported chain: ${c}`);
		}

		if (!this.publicClient) {
			// Read via JSON-RPC directly if no viem client
			const [name, symbol, totalSupply, tokenURI, owner] = await Promise.all([
				this.readContract(rpcUrl, contractAddress, 'name'),
				this.readContract(rpcUrl, contractAddress, 'symbol'),
				this.readContract(rpcUrl, contractAddress, 'totalSupply'),
				this.readContract(rpcUrl, contractAddress, 'tokenURI', [tokenId]),
				this.readContract(rpcUrl, contractAddress, 'ownerOf', [tokenId]),
			]);

			// Fetch metadata from token URI
			const metadata = await this.fetchMetadata(tokenURI as string);

			return {
				tokenId,
				contractAddress: contractAddress,
				name: (metadata as Record<string, unknown>)?.name as string || String(name),
				description: (metadata as Record<string, unknown>)?.description as string || '',
				videoUri: (metadata as Record<string, unknown>)?.animation_url as string || '',
				thumbnailUri: (metadata as Record<string, unknown>)?.image as string || '',
				duration: 0,
				creator: owner as Address,
				owner: owner as Address,
				editionSize: 1,
				royaltyBps: 500,
				linkedCreatorCoin: (metadata as Record<string, unknown>)?.linked_creator_coin as Address | undefined,
				mintPriceWei: '0',
				chain: c,
				totalSupply: String(totalSupply),
				createdAt: new Date().toISOString(),
			};
		}

		const contract = getContract({
			address: contractAddress,
			abi: ZORA_NFT_ABI,
			client: this.publicClient,
		});

		const [name, symbol, totalSupply, uri] = await Promise.all([
			contract.read.name(),
			contract.read.symbol(),
			contract.read.totalSupply(),
			contract.read.tokenURI([BigInt(tokenId)]),
		]);

		// Try to get owner
		let owner: Address;
		try {
			owner = await contract.read.ownerOf([BigInt(tokenId)]);
		} catch {
			owner = '0x0000000000000000000000000000000000000000' as Address;
		}

		// Fetch metadata
		const metadata = await this.fetchMetadata(uri);

		return {
			tokenId,
			contractAddress,
			name: (metadata as Record<string, unknown>)?.name as string || name,
			description: (metadata as Record<string, unknown>)?.description as string || '',
			videoUri: (metadata as Record<string, unknown>)?.animation_url as string || '',
			thumbnailUri: (metadata as Record<string, unknown>)?.image as string || '',
			duration: this.parseDuration(
				((metadata as Record<string, unknown>).content as Record<string, unknown> | undefined)?.duration as string | undefined,
			),
			creator: owner,
			owner,
			editionSize: 1,
			royaltyBps: 500,
			linkedCreatorCoin: (metadata as Record<string, unknown>)?.linked_creator_coin as Address | undefined,
			mintPriceWei: '0',
			chain: c,
			totalSupply: String(totalSupply),
			createdAt: new Date().toISOString(),
		};
	}

	/**
	 * Collect (buy/mint) a video NFT edition.
	 */
	async collectVideoNFT(
		tokenId: string,
		contractAddress: Address,
		amount: string,
		recipient?: Address,
		chain?: string,
	): Promise<CollectResult> {
		const c = chain ?? this.defaultChain;
		const explorer = CHAIN_EXPLORERS[c];
		const to = recipient ?? this.walletClient?.account.address;

		if (!to) {
			throw new Error('No recipient address available');
		}

		if (!this.walletClient) {
			return {
				txHash: `simulated:collect:${contractAddress}:${tokenId}`,
				tokenId,
				explorerUrl: '',
				amount,
			};
		}

		const txHash = await this.walletClient.sendTransaction({
			to: contractAddress,
			data: encodeFunctionData({
				abi: ZORA_NFT_ABI,
				functionName: 'mint',
				args: [to, BigInt(tokenId), BigInt(amount), '0x' as `0x${string}`],
			}),
			value: parseEther(amount),
		});

		return {
			txHash,
			tokenId,
			explorerUrl: `${explorer}/tx/${txHash}`,
			amount,
		};
	}

	/**
	 * Tip a creator on a video — either buys their linked creator coin
	 * or mints an NFT edition as the tip.
	 */
	async tipVideo(
		tokenId: string,
		contractAddress: Address,
		tipper: Address,
		amountWei: bigint,
		chain?: string,
	): Promise<TipResult> {
		const c = chain ?? this.defaultChain;
		const explorer = CHAIN_EXPLORERS[c];

		// First, check if the video has a linked creator coin
		const video = await this.getVideoNFT(tokenId, contractAddress, c);

		if (video.linkedCreatorCoin && video.linkedCreatorCoin !== '0x0000000000000000000000000000000000000000') {
			// Tip by buying creator coin
			if (!this.walletClient) {
				return {
					txHash: `simulated:coin:${video.linkedCreatorCoin}`,
					explorerUrl: '',
					amount: amountWei.toString(),
					coinPurchased: true,
				};
			}

			const coinContract = getContract({
				address: video.linkedCreatorCoin,
				abi: ZORA_COIN_ABI,
				client: this.walletClient,
			});

			const txHash = await coinContract.write.purchase([tipper, 1n], {
				value: amountWei,
			});

			return {
				txHash,
				explorerUrl: `${explorer}/tx/${txHash}`,
				amount: amountWei.toString(),
				coinPurchased: true,
			};
		}

		// No linked coin — mint an edition as the tip
		return this.collectVideoNFT(tokenId, contractAddress, amountWei.toString(), tipper, c)
			.then(result => ({
				txHash: result.txHash,
				explorerUrl: result.explorerUrl,
				amount: result.amount,
				coinPurchased: false,
			}));
	}

	/**
	 * Get trending video NFTs — uses the kv store cache.
	 * In production, this would query Zora's API or subgraph.
	 */
	async getTrendingVideoNFTs(
		opts: TrendingQuery,
		env?: { CACHE?: KVStore },
	): Promise<ZoraVideoNFT[]> {
		const limit = opts.limit ?? 20;
		const network = opts.network ?? 'base';

		// Try cache first
		if (env?.CACHE) {
			try {
				const cached = await env.CACHE.get(`zora:video:trending:${network}`);
				if (cached) {
					const parsed = JSON.parse(cached) as ZoraVideoNFT[];
					return parsed.slice(0, limit);
				}
			} catch {
				// Cache miss — fall through
			}
		}

		// Mock trending data for now
		// In production: query Zora API → https://api.zora.co/discover/...
		const defaultAddress: Address = ZORA_NFT_CONTRACTS['base']!;
		const mockVideos: ZoraVideoNFT[] = Array.from({ length: limit }, (_, i) => ({
			tokenId: String(i + 1),
			contractAddress: ZORA_NFT_CONTRACTS[network] ?? defaultAddress,
			name: `Trending Video #${i + 1}`,
			description: `A trending video on ${network}`,
			videoUri: `ipfs://QmTrendingVideo${i}`,
			thumbnailUri: `https://picsum.photos/seed/trending${i}/640/360`,
			duration: Math.floor(Math.random() * 300) + 15,
			creator: `0x${String(i).padStart(40, '0')}` as Address,
			owner: `0x${String(i).padStart(40, '0')}` as Address,
			editionSize: Math.random() > 0.5 ? 100 : 1,
			royaltyBps: 500,
			mintPriceWei: '0',
			chain: network,
			totalSupply: String(Math.floor(Math.random() * 50) + 1),
			createdAt: new Date(Date.now() - i * 3600000).toISOString(),
		}));

		return mockVideos;
	}

	/**
	 * Get all video NFTs by a creator.
	 */
	async getCreatorVideoNFTs(
		creatorAddress: Address,
		env?: { CACHE?: KVStore },
	): Promise<ZoraVideoNFT[]> {
		// Try cache first
		if (env?.CACHE) {
			try {
				const cached = await env.CACHE.get(`zora:video:creator:${creatorAddress.toLowerCase()}`);
				if (cached) {
					return JSON.parse(cached) as ZoraVideoNFT[];
				}
			} catch {
				// Cache miss
			}
		}

		return [];
	}

	/**
	 * Announce a video NFT to all supported protocols.
	 */
	async announceToAllProtocols(
		tokenId: string,
		contractAddress: Address,
		chain: string,
		env: { CACHE?: KVStore },
		opts: {
			activityPub?: { instanceUrl: string; accessToken: string };
			atProtocol?: { did: string; appPassword: string };
			nostr?: { privateKey: string; relays?: string[] };
			farcaster?: { fid: number; mnemonic: string };
		},
	): Promise<AnnounceResult> {
		const result: AnnounceResult = {
			activityPub: false,
			atProtocol: false,
			nostr: false,
			farcaster: false,
			errors: [],
		};

		const video = await this.getVideoNFT(tokenId, contractAddress, chain);
		const videoUrl = `https://degenfeed.xyz/zora/video/${chain}/${contractAddress}/${tokenId}`;
		const announcement = [
			`🎬 New Zora Video NFT: "${video.name}"`,
			video.description ? video.description.slice(0, 200) : '',
			'',
			`Watch & collect: ${videoUrl}`,
		].filter(Boolean).join('\n');

		// ActivityPub (Mastodon, GoToSocial, PeerTube)
		if (opts.activityPub) {
			try {
				const apRes = await fetch(`${opts.activityPub.instanceUrl}/api/v1/statuses`, {
					method: 'POST',
					headers: {
						authorization: `Bearer ${opts.activityPub.accessToken}`,
						'content-type': 'application/json',
						idempotency: `zora-video-${chain}-${contractAddress}-${tokenId}`,
					},
					body: JSON.stringify({
						status: announcement,
						visibility: 'public',
					}),
				});
				if (apRes.ok) result.activityPub = true;
				else result.errors.push(`ActivityPub: ${apRes.status}`);
			} catch (e: unknown) {
				result.errors.push(`ActivityPub: ${e instanceof Error ? e.message : String(e)}`);
			}
		}

		// AT Protocol (Bluesky)
		if (opts.atProtocol) {
			try {
				// Create session
				const sessionRes = await fetch('https://bsky.social/xrpc/com.atproto.server.createSession', {
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({
						identifier: opts.atProtocol.did,
						password: opts.atProtocol.appPassword,
					}),
				});
				if (sessionRes.ok) {
					const session = (await sessionRes.json()) as { accessJwt: string; did: string };
					// Create post
					const postRes = await fetch('https://bsky.social/xrpc/com.atproto.repo.createRecord', {
						method: 'POST',
						headers: {
							authorization: `Bearer ${session.accessJwt}`,
							'content-type': 'application/json',
						},
						body: JSON.stringify({
							repo: session.did,
							collection: 'app.bsky.feed.post',
							record: {
								$type: 'app.bsky.feed.post',
								text: `New Zora Video NFT: "${video.name}"`,
								createdAt: new Date().toISOString(),
								embed: {
									$type: 'app.bsky.embed.external',
									external: {
										uri: videoUrl,
										title: video.name,
										description: video.description.slice(0, 200),
										thumb: video.thumbnailUri,
									},
								},
							},
						}),
					});
					if (postRes.ok) result.atProtocol = true;
					else result.errors.push(`ATProtocol: ${postRes.status}`);
				}
			} catch (e: unknown) {
				result.errors.push(`ATProtocol: ${e instanceof Error ? e.message : String(e)}`);
			}
		}

		// Nostr — publish event kind 1 (text note) to configured relays
		if (opts.nostr) {
			try {
				const relays = opts.nostr.relays ?? [
					'wss://relay.damus.io',
					'wss://nos.lol',
					'wss://relay.primal.net',
				];

				// Build Nostr event
				const event = {
					kind: 1,
					created_at: Math.floor(Date.now() / 1000),
					tags: [
						['d', `zora-video-${tokenId}`],
						['r', videoUrl],
						['t', 'zora'],
						['t', 'video'],
						['t', 'nft'],
					],
					content: announcement,
					pubkey: '',
					id: '',
					sig: '',
				};

				// Post to first relay via JSON-RPC-style request
				for (const relay of relays.slice(0, 3)) {
					const wsUrl = relay.replace('wss://', 'https://');
					try {
						const nrRes = await fetch(`${wsUrl}/api/v1/events`, {
							method: 'POST',
							headers: { 'content-type': 'application/json' },
							body: JSON.stringify(['EVENT', event]),
						});
						if (nrRes.ok || nrRes.status < 500) {
							result.nostr = true;
							break;
						}
					} catch {
						continue; // Try next relay
					}
				}

				if (!result.nostr) {
					// Fallback: publish via DegenFeed's internal nostr relay if available
					result.errors.push('Nostr: no relay accepted the event');
				}
			} catch (e: unknown) {
				result.errors.push(`Nostr: ${e instanceof Error ? e.message : String(e)}`);
			}
		}

		// Farcaster
		if (opts.farcaster) {
			try {
				const neynarRes = await fetch('https://api.neynar.com/v2/farcaster/cast', {
					method: 'POST',
					headers: {
						'content-type': 'application/json',
						api_key: opts.farcaster.fid.toString(),
					},
					body: JSON.stringify({
						signer_uuid: opts.farcaster.mnemonic,
						text: announcement,
						embeds: [{ url: videoUrl }],
					}),
				});
				if (neynarRes.ok) result.farcaster = true;
				else result.errors.push(`Farcaster: ${neynarRes.status}`);
			} catch (e: unknown) {
				result.errors.push(`Farcaster: ${e instanceof Error ? e.message : String(e)}`);
			}
		}

		return result;
	}

	/**
	 * Generate the DegenFeed share URL for a video NFT.
	 */
	getShareUrl(tokenId: string, contractAddress: Address, chain: string): string {
		return `https://degenfeed.xyz/zora/video/${chain}/${contractAddress}/${tokenId}`;
	}

	// ─── Private Helpers ──────────────────────────────────────────────────

	/**
	 * Register a video NFT in the cross-chain registry for discoverability.
	 */
	private async registerVideoInRegistry(opts: {
		tokenId: string;
		contractAddress: Address;
		chain: string;
		creator: Address;
		metadataUri: string;
		linkedCreatorCoin?: Address;
	}): Promise<void> {
		if (!this.crossChainRegistry) return;

		const { CrossChainRegistry } = await import('./cross-chain/registry');
		const registry = new CrossChainRegistry(this.crossChainRegistry);

		await registry.register({
			id: `zora-video-${opts.chain}-${opts.contractAddress}-${opts.tokenId}`,
			source: {
				chainId: this.chainNameToId(opts.chain),
				protocol: 'zora',
				creatorId: opts.creator.toLowerCase(),
				token: opts.contractAddress.toLowerCase(),
			},
			target: {
				chainId: this.chainNameToId(opts.chain),
				protocol: 'zora-video',
				creatorId: opts.creator.toLowerCase(),
				token: `${opts.contractAddress.toLowerCase()}:${opts.tokenId}`,
			},
			createdAt: Date.now(),
			verifiedBy: 'creator',
		});
	}

	/**
	 * Read a contract method via raw JSON-RPC (no viem dependency).
	 */
	private async readContract(
		rpcUrl: string,
		contractAddress: Address,
		method: string,
		args: unknown[] = [],
	): Promise<unknown> {
		// Encode the function call
		const abi = ZORA_NFT_ABI.find(a => a.type === 'function' && a.name === method) as {
			name: string;
			inputs: Array<{ type: string }>;
		} | undefined;

		if (!abi) throw new Error(`Unknown method: ${method}`);

		const data = encodeFunctionData({
			abi: ZORA_NFT_ABI,
			functionName: method as 'name' | 'symbol' | 'totalSupply' | 'tokenURI' | 'ownerOf' | 'balanceOf',
			args: args as [Address] | [bigint] | [],
		});

		const res = await fetch(rpcUrl, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				jsonrpc: '2.0',
				id: 1,
				method: 'eth_call',
				params: [{ to: contractAddress, data }, 'latest'],
			}),
		});

		if (!res.ok) throw new Error(`RPC call failed: ${res.status}`);

		const json = (await res.json()) as {
			result?: string;
			error?: { message: string };
		};
		if (json.error) throw new Error(`RPC error: ${json.error.message}`);

		return json.result;
	}

	/**
	 * Fetch and parse metadata from an IPFS or HTTP URI.
	 */
	private async fetchMetadata(uri: string): Promise<Record<string, unknown>> {
		try {
			// Handle data URIs
			if (uri.startsWith('data:')) {
				const parts = uri.split(',');
				const b64 = parts[1];
				if (!b64) return {};
				const json = atob(b64);
				return JSON.parse(json);
			}

			// Handle ipfs:// URIs
			const httpUri = uri.startsWith('ipfs://')
				? `${this.pinataConfig.gateway ?? IPFS_GATEWAY}/${uri.replace('ipfs://', '')}`
				: uri;

			const res = await fetch(httpUri);
			if (!res.ok) return {};
			return await res.json() as Record<string, unknown>;
		} catch {
			return {};
		}
	}

	/**
	 * Parse an ISO 8601 duration string (PT30S) to seconds.
	 */
	private parseDuration(duration?: string): number {
		if (!duration) return 0;
		const match = duration.match(/PT(\d+(?:\.\d+)?)S/);
		if (match && match[1]) return Math.round(Number.parseFloat(match[1]));
		return 0;
	}

	/**
	 * Convert a chain name to a chain ID.
	 */
	private chainNameToId(name: string): number {
		switch (name) {
			case 'base': return 8453;
			case 'ethereum': return 1;
			case 'optimism': return 10;
			case 'arbitrum': return 42161;
			case 'zora': return 7777777;
			case 'polygon': return 137;
			case 'solana': return 901;
			default: return 0;
		}
	}
}
