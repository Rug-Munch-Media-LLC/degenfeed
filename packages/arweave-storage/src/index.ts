/**
 * @degenfeed/arweave-storage
 *
 * Decentralized storage connector for DegenFeed posts.
 * Stores content on Arweave (via Irys/Bundlr) and IPFS (via Pinata/web3.storage).
 *
 * Free tier limits:
 *   - Arweave via Irys: <100KB per upload (free), >100KB requires funded node
 *   - IPFS via Pinata: 1GB free tier, requires API key
 *   - IPFS via web3.storage: 5GB free tier, requires API key
 *
 * Pass `ArweaveStorageConfig` to configure API keys at runtime.
 */

import type { ContentProof } from '@degenfeed/types';

// ─── Configuration ───────────────────────────────────────────────────

export interface ArweaveStorageConfig {
  pinataApiKey?: string;
  pinataSecretKey?: string;
  web3StorageToken?: string;
  irysGateway?: string;
  arweaveGateway?: string;
  ipfsGateway?: string;
}

const DEFAULT_CONFIG: ArweaveStorageConfig = {
  irysGateway: 'https://node1.irys.xyz',
  arweaveGateway: 'https://arweave.net',
  ipfsGateway: 'https://ipfs.io/ipfs',
};

// ─── SHA-256 content hashing ─────────────────────────────────────────

export async function sha256Hash(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

// ─── Arweave via Irys Gateway ────────────────────────────────────────

/**
 * Store content on Arweave via the Irys (formerly Bundlr) gateway.
 *
 * Free tier: content under 100KB is free (Irys subsidizes).
 * Larger content requires funding a Irys node with AR tokens.
 *
 * @param content - The text content to store permanently
 * @param config - Optional storage configuration
 * @param tags - Optional metadata tags (e.g. [{ name: 'App-Name', value: 'DegenFeed' }])
 * @returns The Arweave transaction ID, or null if upload failed
 */
export async function storeOnArweave(
  content: string,
  config?: ArweaveStorageConfig,
  tags?: { name: string; value: string }[],
): Promise<string | null> {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const irysGateway = cfg.irysGateway ?? DEFAULT_CONFIG.irysGateway;
  const byteSize = new TextEncoder().encode(content).length;

  if (byteSize > 100_000) {
    console.warn(
      `[arweave-storage] Content too large for free tier: ${byteSize} bytes (max 100KB)`,
    );
  }

  try {
    const defaultTags = [
      { name: 'App-Name', value: 'DegenFeed' },
      { name: 'Content-Type', value: 'text/plain' },
      { name: 'Unix-Time', value: String(Math.floor(Date.now() / 1000)) },
      ...(tags ?? []),
    ];

    const response = await fetch(`${irysGateway}/tx/matic`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tags: defaultTags.map((t) => ({ name: t.name, value: t.value })),
        data: content,
        currency: 'matic',
      }),
    });

    if (!response.ok) {
      const errBody = await response.text().catch(() => '');
      console.error(`[arweave-storage] Irys upload failed: ${response.status} ${errBody}`);
      return null;
    }

    const result = (await response.json()) as { id?: string };
    if (!result.id) {
      console.error('[arweave-storage] Irys returned no transaction ID');
      return null;
    }

    return result.id;
  } catch (err) {
    console.error('[arweave-storage] Arweave upload error:', err);
    return null;
  }
}

// ─── IPFS via Pinata or web3.storage ─────────────────────────────────

/**
 * Store content on IPFS using Pinata or web3.storage.
 *
 * Tries Pinata first (if API keys are configured), then falls back to
 * web3.storage. Returns the IPFS content hash (CID) or null on failure.
 *
 * @param content - The text content to store on IPFS
 * @param config - Optional storage configuration with API keys
 * @returns The IPFS CID (content hash), or null if upload failed
 */
export async function storeOnIPFS(
  content: string,
  config?: ArweaveStorageConfig,
): Promise<string | null> {
  // Strategy 1: Pinata
  if (config?.pinataApiKey && config?.pinataSecretKey) {
    try {
      const formData = new FormData();
      const blob = new Blob([content], { type: 'text/plain' });
      formData.append('file', blob, `post-${Date.now()}.txt`);

      const response = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
        method: 'POST',
        headers: {
          pinata_api_key: config.pinataApiKey,
          pinata_secret_api_key: config.pinataSecretKey,
        },
        body: formData,
      });

      if (response.ok) {
        const result = (await response.json()) as { IpfsHash?: string };
        if (result.IpfsHash) return result.IpfsHash;
      }
    } catch (err) {
      console.warn('[arweave-storage] Pinata upload failed, trying web3.storage:', err);
    }
  }

  // Strategy 2: web3.storage
  if (config?.web3StorageToken) {
    try {
      const blob = new Blob([content], { type: 'text/plain' });
      const file = new File([blob], `post-${Date.now()}.txt`, { type: 'text/plain' });
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('https://api.web3.storage/upload', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.web3StorageToken}`,
        },
        body: formData,
      });

      if (response.ok) {
        const result = (await response.json()) as { cid?: string };
        if (result.cid) return result.cid;
      }
    } catch (err) {
      console.warn('[arweave-storage] web3.storage upload failed:', err);
    }
  }

  // Strategy 3: Direct upload to IPFS via gateway (public, no pinning)
  try {
    const formData = new FormData();
    formData.append('file', new Blob([content], { type: 'text/plain' }), 'post.txt');
    const response = await fetch('https://ipfs.infura.io:5001/api/v0/add', {
      method: 'POST',
      body: formData,
    });

    if (response.ok) {
      const result = (await response.json()) as { Hash?: string };
      if (result.Hash) return result.Hash;
    }
  } catch {
    // Silent fallthrough
  }

  return null;
}

// ─── Content Retrieval ───────────────────────────────────────────────

/**
 * Retrieve content from Arweave or IPFS using a ContentProof.
 * Tries Arweave first (faster, more reliable), then IPFS.
 *
 * @param proof - The ContentProof containing storage references
 * @param config - Optional storage configuration (gateway URLs)
 * @returns The original content text, or null if unreachable
 */
export async function retrieveContent(
  proof: ContentProof,
  config?: ArweaveStorageConfig,
): Promise<string | null> {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  // Try Arweave first
  if (proof.arweaveTxId) {
    try {
      const arweaveGateway = cfg.arweaveGateway ?? DEFAULT_CONFIG.arweaveGateway;
      const res = await fetch(`${arweaveGateway}/${proof.arweaveTxId}`);
      if (res.ok) {
        return await res.text();
      }
    } catch (err) {
      console.warn('[arweave-storage] Arweave retrieval failed:', err);
    }
  }

  // Fall back to IPFS
  if (proof.ipfsCid) {
    try {
      const ipfsGateway = cfg.ipfsGateway ?? DEFAULT_CONFIG.ipfsGateway;
      const res = await fetch(`${ipfsGateway}/${proof.ipfsCid}`);
      if (res.ok) {
        return await res.text();
      }
    } catch (err) {
      console.warn('[arweave-storage] IPFS retrieval failed:', err);
    }
  }

  return null;
}

// ─── Utility: create ContentProof ────────────────────────────────────

/**
 * Store content on both Arweave and IPFS, returning a unified ContentProof.
 *
 * @param content - The post content to store
 * @param config - Optional storage configuration
 * @param tags - Optional Arweave metadata tags
 * @returns A ContentProof with any successful storage references
 */
export async function storePermanent(
  content: string,
  config?: ArweaveStorageConfig,
  tags?: { name: string; value: string }[],
): Promise<ContentProof> {
  const contentHash = await sha256Hash(content);
  const timestamp = Date.now();

  // Run both uploads in parallel
  const [arweaveTxId, ipfsCid] = await Promise.all([
    storeOnArweave(content, config, tags).catch(() => null as string | null),
    storeOnIPFS(content, config).catch(() => null as string | null),
  ]);

  const permanent = !!arweaveTxId || !!ipfsCid;

  return {
    arweaveTxId: arweaveTxId ?? undefined,
    ipfsCid: ipfsCid ?? undefined,
    contentHash,
    timestamp,
    permanent,
  };
}

// ─── Utility: verify content integrity ───────────────────────────────

/**
 * Verify that a ContentProof matches the given content.
 * Re-hashes the content and compares against the proof.
 *
 * @param content - The content to verify
 * @param proof - The ContentProof to verify against
 * @returns True if the content hash matches the proof
 */
export async function verifyContent(
  content: string,
  proof: ContentProof,
): Promise<boolean> {
  const hash = await sha256Hash(content);
  return hash === proof.contentHash;
}
