import {
  type Account,
  type Address,
  type Chain,
  encodeFunctionData,
  getContract,
  type HttpTransport,
  keccak256,
  type PublicClient,
  parseEther,
  stringToHex,
  type WalletClient,
} from 'viem';
import type { KVStore } from '../cross-chain/registry';
import {
  CHAIN_EXPLORERS,
  CHAIN_RPC_URLS,
  IPFS_GATEWAY,
  ZORA_COIN_ABI,
  ZORA_NFT_ABI,
  ZORA_NFT_CONTRACTS,
} from './constants';
import { buildVideoMetadata } from './metadata';
import type {
  AnnounceResult,
  CollectResult,
  MintResult,
  MintVideoOptions,
  PinataConfig,
  TipResult,
  TrendingQuery,
  VideoUploadResult,
  ZoraVideoNFT,
  ZoraVideoSDKConfig,
} from './types';
import { uploadMetadataToIpfs, uploadToIpfs } from './upload';

export { buildVideoMetadata, metadataToDataUri } from './metadata';
export { uploadMetadataToIpfs, uploadToIpfs } from './upload';
export type {
  AnnounceResult,
  CollectResult,
  MintResult,
  MintVideoOptions,
  PinataConfig,
  TipResult,
  TrendingQuery,
  VideoUploadResult,
  ZoraVideoNFT,
  ZoraVideoSDKConfig,
};
export { CHAIN_EXPLORERS, CHAIN_RPC_URLS, ZORA_COIN_ABI, ZORA_NFT_ABI, ZORA_NFT_CONTRACTS };

export class ZoraVideoSDK {
  private pinataConfig: PinataConfig;
  private walletClient?: WalletClient<HttpTransport, Chain, Account>;
  private publicClient?: PublicClient<HttpTransport, Chain>;
  private defaultChain: string;
  private crossChainRegistry?: KVStore;

  constructor(config: ZoraVideoSDKConfig) {
    this.pinataConfig = { jwt: config.pinataJwt, gateway: config.pinataGateway ?? IPFS_GATEWAY };
    this.walletClient = config.walletClient;
    this.publicClient = config.publicClient;
    this.defaultChain = config.defaultChain ?? 'base';
    this.crossChainRegistry = config.crossChainRegistry;
  }

  async uploadVideo(
    file: File | Blob,
    fileName?: string,
    options?: { pinToArweave?: boolean },
  ): Promise<VideoUploadResult> {
    return uploadToIpfs(file, fileName || `video-${Date.now()}.mp4`, this.pinataConfig, options);
  }

  async generateThumbnail(videoUri: string): Promise<string> {
    const hash = keccak256(stringToHex(videoUri)).slice(0, 10);
    const thumbnailData = {
      name: 'Video Thumbnail',
      description: 'Auto-generated thumbnail placeholder',
      image: `https://picsum.photos/seed/${hash}/640/360`,
    };
    const blob = new Blob([JSON.stringify(thumbnailData)], { type: 'application/json' });
    const result = await uploadToIpfs(blob as File, `thumb-${hash}.json`, this.pinataConfig);
    return result.ipfsUri;
  }

  async mintVideoNFT(opts: MintVideoOptions): Promise<MintResult> {
    const chain = opts.chain ?? this.defaultChain;
    const rpcUrl = CHAIN_RPC_URLS[chain];
    const explorer = CHAIN_EXPLORERS[chain];
    if (!rpcUrl) throw new Error(`Unsupported chain: ${chain}`);

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
    const contractAddress: Address =
      ZORA_NFT_CONTRACTS[chain] ?? (ZORA_NFT_CONTRACTS.base as Address);

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
        account: this.walletClient.account,
      });
      const tokenId = (opts.tokenId ?? BigInt(Date.now())).toString();
      if (this.crossChainRegistry) {
        await this.registerVideoInRegistry({
          tokenId,
          contractAddress,
          chain,
          creator: opts.creator,
          metadataUri,
          linkedCreatorCoin: opts.linkedCreatorCoin,
        }).catch(() => {});
      }
      return {
        tokenId,
        contractAddress,
        txHash,
        explorerUrl: `${explorer}/tx/${txHash}`,
        metadataUri,
      };
    }
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

  async getVideoNFT(
    tokenId: string,
    contractAddress: Address,
    chain?: string,
  ): Promise<ZoraVideoNFT> {
    const c = chain ?? this.defaultChain;
    const rpcUrl = CHAIN_RPC_URLS[c];
    if (!rpcUrl) throw new Error(`Unsupported chain: ${c}`);

    if (!this.publicClient) {
      const [name, _symbol, totalSupply, tokenURI, owner] = await Promise.all([
        this.readContract(rpcUrl, contractAddress, 'name'),
        this.readContract(rpcUrl, contractAddress, 'symbol'),
        this.readContract(rpcUrl, contractAddress, 'totalSupply'),
        this.readContract(rpcUrl, contractAddress, 'tokenURI', [tokenId]),
        this.readContract(rpcUrl, contractAddress, 'ownerOf', [tokenId]),
      ]);
      const metadata = await this.fetchMetadata(tokenURI as string);
      return {
        tokenId,
        contractAddress,
        name: ((metadata as Record<string, unknown>)?.name as string) || String(name),
        description: ((metadata as Record<string, unknown>)?.description as string) || '',
        videoUri: ((metadata as Record<string, unknown>)?.animation_url as string) || '',
        thumbnailUri: ((metadata as Record<string, unknown>)?.image as string) || '',
        duration: 0,
        creator: owner as Address,
        owner: owner as Address,
        editionSize: 1,
        royaltyBps: 500,
        linkedCreatorCoin: (metadata as Record<string, unknown>)?.linked_creator_coin as
          | Address
          | undefined,
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
    const [name, _symbol, totalSupply, uri] = await Promise.all([
      contract.read.name(),
      contract.read.symbol(),
      contract.read.totalSupply(),
      contract.read.tokenURI([BigInt(tokenId)]),
    ]);
    let owner: Address;
    try {
      owner = await contract.read.ownerOf([BigInt(tokenId)]);
    } catch {
      owner = '0x0000000000000000000000000000000000000000' as Address;
    }
    const metadata = await this.fetchMetadata(uri);
    return {
      tokenId,
      contractAddress,
      name: ((metadata as Record<string, unknown>)?.name as string) || name,
      description: ((metadata as Record<string, unknown>)?.description as string) || '',
      videoUri: ((metadata as Record<string, unknown>)?.animation_url as string) || '',
      thumbnailUri: ((metadata as Record<string, unknown>)?.image as string) || '',
      duration: this.parseDuration(
        ((metadata as Record<string, unknown>).content as Record<string, unknown> | undefined)
          ?.duration as string | undefined,
      ),
      creator: owner,
      owner,
      editionSize: 1,
      royaltyBps: 500,
      linkedCreatorCoin: (metadata as Record<string, unknown>)?.linked_creator_coin as
        | Address
        | undefined,
      mintPriceWei: '0',
      chain: c,
      totalSupply: String(totalSupply),
      createdAt: new Date().toISOString(),
    };
  }

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
    if (!to) throw new Error('No recipient address available');
    if (!this.walletClient)
      return {
        txHash: `simulated:collect:${contractAddress}:${tokenId}`,
        tokenId,
        explorerUrl: '',
        amount,
      };
    const txHash = await this.walletClient.sendTransaction({
      to: contractAddress,
      data: encodeFunctionData({
        abi: ZORA_NFT_ABI,
        functionName: 'mint',
        args: [to, BigInt(tokenId), BigInt(amount), '0x' as `0x${string}`],
      }),
      value: parseEther(amount),
    });
    return { txHash, tokenId, explorerUrl: `${explorer}/tx/${txHash}`, amount };
  }

  async tipVideo(
    tokenId: string,
    contractAddress: Address,
    tipper: Address,
    amountWei: bigint,
    chain?: string,
  ): Promise<TipResult> {
    const c = chain ?? this.defaultChain;
    const explorer = CHAIN_EXPLORERS[c];
    const video = await this.getVideoNFT(tokenId, contractAddress, c);
    if (
      video.linkedCreatorCoin &&
      video.linkedCreatorCoin !== '0x0000000000000000000000000000000000000000'
    ) {
      if (!this.walletClient)
        return {
          txHash: `simulated:coin:${video.linkedCreatorCoin}`,
          explorerUrl: '',
          amount: amountWei.toString(),
          coinPurchased: true,
        };
      const coinContract = getContract({
        address: video.linkedCreatorCoin,
        abi: ZORA_COIN_ABI,
        client: this.walletClient,
      });
      const txHash = await coinContract.write.purchase([tipper, 1n], { value: amountWei });
      return {
        txHash,
        explorerUrl: `${explorer}/tx/${txHash}`,
        amount: amountWei.toString(),
        coinPurchased: true,
      };
    }
    return this.collectVideoNFT(tokenId, contractAddress, amountWei.toString(), tipper, c).then(
      (r) => ({
        txHash: r.txHash,
        explorerUrl: r.explorerUrl,
        amount: r.amount,
        coinPurchased: false,
      }),
    );
  }

  async getTrendingVideoNFTs(
    opts: TrendingQuery = {},
    env?: { CACHE?: KVStore },
  ): Promise<ZoraVideoNFT[]> {
    const limit = opts.limit ?? 20;
    const network = opts.network ?? 'base';
    if (env?.CACHE) {
      try {
        const cached = await env.CACHE.get(`zora:video:trending:${network}`);
        if (cached) return (JSON.parse(cached) as ZoraVideoNFT[]).slice(0, limit);
      } catch {}
    }
    const defaultAddress: Address = ZORA_NFT_CONTRACTS.base as Address;
    return Array.from({ length: limit }, (_, i) => ({
      tokenId: String(i + 1),
      contractAddress: (ZORA_NFT_CONTRACTS[network] ?? defaultAddress) as Address,
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
  }

  async getCreatorVideoNFTs(
    creatorAddress: Address,
    env?: { CACHE?: KVStore },
  ): Promise<ZoraVideoNFT[]> {
    if (env?.CACHE) {
      try {
        const cached = await env.CACHE.get(`zora:video:creator:${creatorAddress.toLowerCase()}`);
        if (cached) return JSON.parse(cached) as ZoraVideoNFT[];
      } catch {}
    }
    return [];
  }

  async announceToAllProtocols(
    tokenId: string,
    contractAddress: Address,
    chain: string,
    _env: { CACHE?: KVStore },
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
    ]
      .filter(Boolean)
      .join('\n');

    if (opts.activityPub) {
      try {
        const apRes = await fetch(`${opts.activityPub.instanceUrl}/api/v1/statuses`, {
          method: 'POST',
          headers: {
            authorization: `Bearer ${opts.activityPub.accessToken}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({ status: announcement, visibility: 'public' }),
        });
        if (apRes.ok) result.activityPub = true;
        else result.errors.push(`ActivityPub: ${apRes.status}`);
      } catch (e: unknown) {
        result.errors.push(`ActivityPub: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    if (opts.atProtocol) {
      try {
        const sessionRes = await fetch(
          'https://bsky.social/xrpc/com.atproto.server.createSession',
          {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              identifier: opts.atProtocol.did,
              password: opts.atProtocol.appPassword,
            }),
          },
        );
        if (sessionRes.ok) {
          const session = (await sessionRes.json()) as { accessJwt: string; did: string };
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
    if (opts.nostr) {
      try {
        const relays = opts.nostr.relays ?? [
          'wss://relay.damus.io',
          'wss://nos.lol',
          'wss://relay.primal.net',
        ];
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
        for (const relay of relays.slice(0, 3)) {
          try {
            const nrRes = await fetch(`${relay.replace('wss://', 'https://')}/api/v1/events`, {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify(['EVENT', event]),
            });
            if (nrRes.ok || nrRes.status < 500) {
              result.nostr = true;
              break;
            }
          } catch {}
        }
        if (!result.nostr) result.errors.push('Nostr: no relay accepted the event');
      } catch (e: unknown) {
        result.errors.push(`Nostr: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    if (opts.farcaster) {
      try {
        const fcRes = await fetch('https://api.neynar.com/v2/farcaster/cast', {
          method: 'POST',
          headers: { 'content-type': 'application/json', api_key: opts.farcaster.fid.toString() },
          body: JSON.stringify({
            signer_uuid: opts.farcaster.mnemonic,
            text: announcement,
            embeds: [{ url: videoUrl }],
          }),
        });
        if (fcRes.ok) result.farcaster = true;
        else result.errors.push(`Farcaster: ${fcRes.status}`);
      } catch (e: unknown) {
        result.errors.push(`Farcaster: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    return result;
  }

  getShareUrl(tokenId: string, contractAddress: Address, chain: string): string {
    return `https://degenfeed.xyz/zora/video/${chain}/${contractAddress}/${tokenId}`;
  }

  private async registerVideoInRegistry(opts: {
    tokenId: string;
    contractAddress: Address;
    chain: string;
    creator: Address;
    metadataUri: string;
    linkedCreatorCoin?: Address;
  }): Promise<void> {
    if (!this.crossChainRegistry) return;
    const { CrossChainRegistry } = await import('../cross-chain/registry');
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

  private async readContract(
    rpcUrl: string,
    contractAddress: Address,
    method: string,
    args: unknown[] = [],
  ): Promise<unknown> {
    const abi = ZORA_NFT_ABI.find((a) => a.type === 'function' && a.name === method) as
      | { name: string; inputs: Array<{ type: string }> }
      | undefined;
    if (!abi) throw new Error(`Unknown method: ${method}`);
    const data = encodeFunctionData({
      abi: ZORA_NFT_ABI,
      functionName: method as
        | 'name'
        | 'symbol'
        | 'totalSupply'
        | 'tokenURI'
        | 'ownerOf'
        | 'balanceOf',
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
    const json = (await res.json()) as { result?: string; error?: { message: string } };
    if (json.error) throw new Error(`RPC error: ${json.error.message}`);
    return json.result;
  }

  private async fetchMetadata(uri: string): Promise<Record<string, unknown>> {
    try {
      if (uri.startsWith('data:')) {
        const parts = uri.split(',');
        if (!parts[1]) return {};
        return JSON.parse(atob(parts[1]));
      }
      const httpUri = uri.startsWith('ipfs://')
        ? `${this.pinataConfig.gateway ?? IPFS_GATEWAY}/${uri.replace('ipfs://', '')}`
        : uri;
      const res = await fetch(httpUri);
      if (!res.ok) return {};
      return (await res.json()) as Record<string, unknown>;
    } catch {
      return {};
    }
  }

  private parseDuration(duration?: string): number {
    if (!duration) return 0;
    const match = duration.match(/PT(\d+(?:\.\d+)?)S/);
    return match?.[1] ? Math.round(Number.parseFloat(match[1])) : 0;
  }

  private chainNameToId(name: string): number {
    switch (name) {
      case 'base':
        return 8453;
      case 'ethereum':
        return 1;
      case 'optimism':
        return 10;
      case 'arbitrum':
        return 42161;
      case 'zora':
        return 7777777;
      case 'polygon':
        return 137;
      case 'solana':
        return 901;
      default:
        return 0;
    }
  }
}
