/**
 * @degenfeed/web/lib/solana-spl — Solana SPL token transfer helper
 *
 * Provides a small client-side helper for transferring SPL tokens (USDC,
 * USDT, BONK) from the connected wallet to a recipient address using the
 * classic `getOrCreateAssociatedTokenAccount` + `createTransferCheckedInstruction`
 * flow from @solana/spl-token.
 *
 * The wallet is expected to be a browser wallet adapter (Phantom / Solflare /
 * Backpack style) exposing `publicKey` + `signTransaction` — the transaction is
 * built here, signed by the wallet, and submitted via the Connection.
 *
 * Bundle note: `@solana/web3.js` + `@solana/spl-token` (~228KB) are intentionally
 * NOT imported at module scope. They are loaded lazily via `await import()` only
 * when a Solana transfer is actually executed (wallet connect / tip flow), so the
 * shared first-load chunk stays free of the Solana stack. Only the type imports
 * below (erased at compile time) keep the module self-describing.
 */

import type { Connection, PublicKey, Transaction } from '@solana/web3.js';

// ─── Well-known SPL mints (Solana mainnet) ────────────────────────────────

export const SPL_TOKEN_MINTS = {
  USDC: {
    address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    symbol: 'USDC',
    decimals: 6,
  },
  USDT: {
    address: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
    symbol: 'USDT',
    decimals: 6,
  },
  BONK: {
    address: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
    symbol: 'BONK',
    decimals: 5,
  },
} as const;

export type SplTokenSymbol = keyof typeof SPL_TOKEN_MINTS;

export const SPL_TOKEN_LIST = Object.values(SPL_TOKEN_MINTS) as Array<{
  address: string;
  symbol: string;
  decimals: number;
}>;

/** Resolve a well-known mint config by address (lowercased comparison). */
export function getSplTokenConfig(mintAddress: string) {
  const addr = mintAddress.toLowerCase();
  return SPL_TOKEN_LIST.find((t) => t.address.toLowerCase() === addr) ?? null;
}

/** Default Solana RPC endpoint — mainnet-beta public endpoint unless configured. */
export function getSolanaRpcUrl(): string {
  const configured =
    (typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_SOLANA_RPC_URL : undefined) ??
    (typeof process !== 'undefined' ? process.env.SOLANA_RPC_URL : undefined);
  return configured || 'https://api.mainnet-beta.solana.com';
}

export async function createSolanaConnection(
  commitment: 'confirmed' | 'processed' = 'confirmed',
): Promise<Connection> {
  const { Connection } = await import('@solana/web3.js');
  return new Connection(getSolanaRpcUrl(), commitment);
}

// ─── Wallet adapter interface (subset of the browser wallet API) ──────────

export interface SolanaTransferWallet {
  publicKey: PublicKey | { toString(): string } | null;
  signTransaction: (
    tx: Transaction,
  ) => Promise<{ serialize(): Uint8Array } | Transaction | Uint8Array>;
}

async function toPublicKey(value: PublicKey | { toString(): string } | string): Promise<PublicKey> {
  const { PublicKey } = await import('@solana/web3.js');
  return value instanceof PublicKey ? value : new PublicKey(String(value));
}

/**
 * Serialize a signed transaction returned by a wallet adapter into bytes for
 * `sendRawTransaction`. Handles legacy Transaction and Uint8Array results.
 */
export async function serializeSignedTransaction(
  signed: { serialize(): Uint8Array } | Transaction | Uint8Array,
): Promise<Uint8Array> {
  const { Transaction } = await import('@solana/web3.js');
  if (signed instanceof Uint8Array) return signed;
  if (signed instanceof Transaction) return signed.serialize();
  return signed.serialize();
}

/**
 * Transfer a native SOL balance from the connected wallet to `toAddress`.
 */
export async function transferSol(
  connection: Connection,
  wallet: SolanaTransferWallet,
  toAddress: string,
  amountSol: number,
): Promise<{ signature: string }> {
  const { LAMPORTS_PER_SOL, PublicKey, SystemProgram, Transaction } = await import(
    '@solana/web3.js'
  );
  const fromPubkey = await toPublicKey(wallet.publicKey ?? '');
  const toPubkey = new PublicKey(toAddress);
  const lamports = Math.round(amountSol * LAMPORTS_PER_SOL);

  const { blockhash } = await connection.getLatestBlockhash('confirmed');
  const tx = new Transaction({ feePayer: fromPubkey, recentBlockhash: blockhash }).add(
    SystemProgram.transfer({ fromPubkey, toPubkey, lamports }),
  );

  const signed = await wallet.signTransaction(tx);
  const signature = await connection.sendRawTransaction(await serializeSignedTransaction(signed), {
    preflightCommitment: 'confirmed',
  });
  return { signature };
}

/**
 * Transfer an SPL token from the connected wallet to `toAddress`.
 *
 * Uses the classic SPL token flow:
 *   1. Derive the sender + recipient Associated Token Accounts via
 *      `getAssociatedTokenAddress` (the recipient's ATA is created on-chain
 *      with `createAssociatedTokenAccountInstruction` when missing — same
 *      behaviour as `getOrCreateAssociatedTokenAccount`).
 *   2. Build `createTransferCheckedInstruction` with the mint's decimals.
 *   3. Sign with the wallet and submit.
 *
 * `amount` is in human-readable token units (e.g. 12.5 USDC).
 */
export async function transferSPLToken(
  connection: Connection,
  wallet: SolanaTransferWallet,
  toAddress: string,
  mintAddress: string,
  amount: number,
): Promise<{ signature: string }> {
  const { PublicKey, Transaction } = await import('@solana/web3.js');
  const {
    createAssociatedTokenAccountInstruction,
    createTransferCheckedInstruction,
    getAssociatedTokenAddress,
    getMint,
    TOKEN_PROGRAM_ID,
  } = await import('@solana/spl-token');

  const fromPubkey = await toPublicKey(wallet.publicKey ?? '');
  const mintPubkey = new PublicKey(mintAddress);
  const toPubkey = new PublicKey(toAddress);

  // Decimal count — prefer the well-known registry, else fetch the mint.
  const known = getSplTokenConfig(mintAddress);
  const decimals = known?.decimals ?? (await getMint(connection, mintPubkey, 'confirmed')).decimals;

  const fromAta = await getAssociatedTokenAddress(mintPubkey, fromPubkey);
  const toAta = await getAssociatedTokenAddress(mintPubkey, toPubkey);

  const { blockhash } = await connection.getLatestBlockhash('confirmed');
  const tx = new Transaction({ feePayer: fromPubkey, recentBlockhash: blockhash });

  // Ensure the recipient's ATA exists (create-if-missing — mirrors
  // getOrCreateAssociatedTokenAccount; the sender pays the rent).
  const toAtaInfo = await connection.getAccountInfo(toAta, 'confirmed');
  if (!toAtaInfo) {
    tx.add(
      createAssociatedTokenAccountInstruction(
        fromPubkey, // payer
        toAta,
        toPubkey,
        mintPubkey,
      ),
    );
  }

  const amountRaw = BigInt(Math.round(amount * 10 ** decimals));
  tx.add(
    createTransferCheckedInstruction(
      fromAta,
      mintPubkey,
      toAta,
      fromPubkey,
      amountRaw,
      decimals,
      [],
      TOKEN_PROGRAM_ID,
    ),
  );

  const signed = await wallet.signTransaction(tx);
  const signature = await connection.sendRawTransaction(await serializeSignedTransaction(signed), {
    preflightCommitment: 'confirmed',
  });
  return { signature };
}
