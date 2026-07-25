/**
 * @degenfeed/lens-sdk — Momoka (Gasless) Posting
 *
 * Momoka is Lens Protocol's gasless posting layer. Publications submitted
 * via Momoka are stored on Arweave (or similar decentralized storage)
 * instead of on-chain via Polygon. This means:
 *   - FREE to post (no gas fees)
 *   - No need for MATIC balance
 *   - Same content format as on-chain publications
 *   - Verifiable via Momoka proof (Daemon — Data Availability Proof)
 *
 * Momoka daemon endpoints (public, free):
 *   - Submit:   POST https://momoka.lens.xyz/submit
 *   - Verify:   GET  https://momoka.lens.xyz/da/{daHash}
 *   - Status:   GET  https://momoka.lens.xyz/health
 *
 * References:
 *   - https://docs.lens.xyz/docs/momoka
 *   - https://momoka.lens.xyz
 */

// ─── Momoka Daemon API URL ──────────────────────────────────────────────

// KVNamespace type for Cloudflare Workers (available at runtime)
type KVNamespace = {
  get: (key: string) => Promise<string | null>;
  put: (key: string, value: string, options?: { expirationTtl?: number }) => Promise<void>;
  list: (options?: { prefix?: string }) => Promise<{ keys: { name: string }[] }>;
};

export const MOMOKA_API_URL = 'https://momoka.lens.xyz';

export const MOMOKA_FALLBACK_URLS = ['https://momoka.lens.xyz', 'https://momoka.testnet.lens.dev'];

// ─── Types ───────────────────────────────────────────────────────────────

export interface MomokaSubmitRequest {
  /** The publication content (same format as on-chain Post) */
  content: string;
  /** Profile ID of the author */
  profileId: string;
  /** Optional metadata URI (if using external metadata store) */
  metadataUri?: string;
  /** Optional media attachments */
  media?: Array<{
    url: string;
    mimeType?: string;
  }>;
  /** Optional tags */
  tags?: string[];
  /** Optional attributes */
  attributes?: Array<{ key: string; value: string }>;
  /** Lens API access token for authentication */
  accessToken: string;
}

export interface MomokaSubmitResult {
  /** Momoka submission ID / DA hash */
  daHash: string;
  /** Whether the submission was accepted */
  accepted: boolean;
  /** Transaction ID on Arweave */
  arweaveTxId?: string;
  /** Momoka proof URL */
  proofUrl?: string;
  /** Publication ID (if assigned) */
  publicationId?: string;
  /** Error message if rejected */
  error?: string;
}

export interface MomokaProof {
  /** DA hash of the publication */
  daHash: string;
  /** Whether the proof is valid */
  valid: boolean;
  /** Arweave transaction ID */
  arweaveTxId?: string;
  /** Publication content (reconstructed from DA) */
  content?: string;
  /** Profile ID that submitted */
  profileId?: string;
  /** Timestamp of submission */
  submittedAt?: string;
  /** Number of confirmations */
  confirmations?: number;
}

export interface MomokaHealth {
  status: 'ok' | 'degraded' | 'down';
  totalSubmissions: number;
  lastBlock?: number;
  daemonVersion?: string;
}

// ─── Momoka Client ──────────────────────────────────────────────────────

export class MomokaClient {
  private apiUrl: string;

  constructor(apiUrl: string = MOMOKA_API_URL) {
    this.apiUrl = apiUrl;
  }

  /**
   * Set a fallback URL to use if primary is down.
   */
  withFallback(url: string): MomokaClient {
    return new MomokaClient(url);
  }

  /**
   * Submit a gasless publication via Momoka.
   *
   * The content is stored on Arweave and a DA hash is returned.
   * The publication behaves identically to an on-chain post on Lens
   * but costs nothing to submit.
   */
  async submit(request: MomokaSubmitRequest): Promise<MomokaSubmitResult> {
    const urls = [this.apiUrl, ...MOMOKA_FALLBACK_URLS.filter((u) => u !== this.apiUrl)];

    for (const url of urls) {
      try {
        const res = await fetch(`${url}/submit`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${request.accessToken}`,
            'user-agent': 'DegenFeed/0.1',
          },
          body: JSON.stringify({
            content: request.content,
            profileId: request.profileId,
            ...(request.metadataUri ? { metadataUri: request.metadataUri } : {}),
            ...(request.media?.length ? { media: request.media } : {}),
            ...(request.tags?.length ? { tags: request.tags } : {}),
            ...(request.attributes?.length ? { attributes: request.attributes } : {}),
          }),
          signal: AbortSignal.timeout(15000),
        });

        if (!res.ok) {
          const errText = await res.text().catch(() => 'Unknown error');
          // 409 = already exists (idempotent), not an error
          if (res.status === 409) {
            const body = (await res.json().catch(() => ({}))) as Partial<MomokaSubmitResult>;
            return {
              daHash: body.daHash || 'already_submitted',
              accepted: true,
              error: undefined,
            };
          }
          // Try next URL on 5xx
          if (res.status >= 500) continue;
          return {
            daHash: '',
            accepted: false,
            error: `Momoka submit failed: ${res.status} ${errText.slice(0, 200)}`,
          };
        }

        const data = (await res.json()) as MomokaSubmitResult;
        return {
          ...data,
          accepted: data.accepted ?? true,
          proofUrl: data.daHash ? `${url}/da/${data.daHash}` : undefined,
        };
      } catch (err) {
        const lastErr = err instanceof Error ? err.message : 'Momoka submit failed';
        // Fall through to next URL
        if (url === urls[urls.length - 1]) {
          return {
            daHash: '',
            accepted: false,
            error: lastErr,
          };
        }
      }
    }

    return {
      daHash: '',
      accepted: false,
      error: 'All Momoka endpoints unavailable',
    };
  }

  /**
   * Verify a Momoka publication by its DA hash.
   * Returns the proof including Arweave transaction ID and content.
   */
  async verify(daHash: string): Promise<MomokaProof | null> {
    const urls = [this.apiUrl, ...MOMOKA_FALLBACK_URLS.filter((u) => u !== this.apiUrl)];

    for (const url of urls) {
      try {
        const res = await fetch(`${url}/da/${daHash}`, {
          headers: { 'user-agent': 'DegenFeed/0.1' },
          signal: AbortSignal.timeout(8000),
        });

        if (res.status === 404) return null;
        if (!res.ok) continue;

        return (await res.json()) as MomokaProof;
      } catch {}
    }

    return null;
  }

  /**
   * Check Momoka daemon health.
   */
  async health(): Promise<MomokaHealth> {
    try {
      const res = await fetch(`${this.apiUrl}/health`, {
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) {
        return { status: 'degraded', totalSubmissions: 0 };
      }
      return (await res.json()) as MomokaHealth;
    } catch {
      return { status: 'down', totalSubmissions: 0 };
    }
  }

  /**
   * Store Momoka proof in KV for later verification.
   * The proof object includes the DA hash, Arweave tx ID, and content.
   * Users can retrieve this later to prove their content exists.
   */
  async storeProof(
    env: { CACHE?: KVNamespace },
    walletAddress: string,
    proof: MomokaSubmitResult,
  ): Promise<void> {
    if (!env.CACHE || !proof.daHash) return;
    const key = `momoka:proof:${walletAddress.toLowerCase()}:${proof.daHash}`;
    try {
      await env.CACHE.put(key, JSON.stringify(proof), {
        expirationTtl: 365 * 86400, // 1 year
      });
    } catch {
      // Non-critical — Momoka proofs are also on Arweave
    }
  }

  /**
   * Retrieve stored Momoka proofs for a wallet.
   */
  async getStoredProofs(
    env: { CACHE?: KVNamespace },
    walletAddress: string,
  ): Promise<MomokaSubmitResult[]> {
    if (!env.CACHE) return [];
    const prefix = `momoka:proof:${walletAddress.toLowerCase()}:`;
    try {
      const list = await env.CACHE.list({ prefix });
      const proofs: MomokaSubmitResult[] = [];
      for (const key of list.keys) {
        const raw = await env.CACHE.get(key.name);
        if (raw) {
          try {
            proofs.push(JSON.parse(raw) as MomokaSubmitResult);
          } catch {
            // skip corrupted entries
          }
        }
      }
      return proofs;
    } catch {
      return [];
    }
  }
}
