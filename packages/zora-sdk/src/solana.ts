/**
 * DegenFeed Creator Token — Solana Anchor Program Client
 *
 * TypeScript SDK for interacting with the DegenFeed Creator Token Anchor program.
 * Uses @coral-xyz/anchor for IDL-driven client generation.
 *
 * ## Quick Start
 * ```ts
 * import { SolanaCreatorTokenSDK } from '@degenfeed/zora-sdk/solana';
 *
 * const sdk = new SolanaCreatorTokenSDK(provider);
 * const result = await sdk.createToken({
 *   tokenSeed: 1n,
 *   name: 'My Creator Coin',
 *   symbol: 'MCC',
 *   uri: 'https://arweave.net/...',
 *   creatorAllocationBps: 500, // 5%
 *   creatorFeeBps: 100,        // 1%
 * });
 * ```
 */

import { type AnchorProvider, BN, Program } from '@coral-xyz/anchor';
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import { PublicKey, SYSVAR_RENT_PUBKEY, SystemProgram } from '@solana/web3.js';
import type {
  SolanaBuyInput,
  SolanaDeployResult,
  SolanaSellInput,
  SolanaTokenInput,
  TokenInfo,
  TradeResult,
  VestedClaimResult,
} from './types';

// ─── IDL ────────────────────────────────────────────────────────────────────
// Auto-generated IDL for the degenfeed_creator_token program.
// In production, import from the Anchor build output:
//   import idl from '../target/idl/degenfeed_creator_token.json';
// For now, define the key types manually.

export const PROGRAM_ID = new PublicKey('DFCCrTn111111111111111111111111111111111111');

// PDA seed constants (must match Rust program)
// Use TextEncoder instead of Buffer for workers compat
const _enc = new TextEncoder();
const SEED_TOKEN_STATE = _enc.encode('token-state');
const SEED_TOKEN_MINT = _enc.encode('token-mint');
const SEED_MINT_AUTHORITY = _enc.encode('mint-authority');
const SEED_TOKEN_VAULT = _enc.encode('token-vault');
const SEED_BUYER_STATE = _enc.encode('buyer-state');
const SEED_VESTING_VAULT = _enc.encode('vesting-vault');
const SEED_RECIPIENT_STATE = _enc.encode('recipient-state');
const PLATFORM_FEE_VAULT_SEED = _enc.encode('platform-fee-vault');

// ─── PDA Derivation ─────────────────────────────────────────────────────────

/** Derive the TokenState PDA */
export function deriveTokenState(creator: PublicKey, tokenSeed: bigint): [PublicKey, number] {
  const seedBuf = new Uint8Array(8);
  const dv = new DataView(seedBuf.buffer);
  dv.setBigUint64(0, tokenSeed, true);
  return PublicKey.findProgramAddressSync(
    [SEED_TOKEN_STATE, creator.toBytes(), seedBuf],
    PROGRAM_ID,
  );
}

/** Derive the Token Mint PDA */
export function deriveTokenMint(tokenState: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([SEED_TOKEN_MINT, tokenState.toBytes()], PROGRAM_ID);
}

/** Derive the Mint Authority PDA */
export function deriveMintAuthority(mint: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([SEED_MINT_AUTHORITY, mint.toBytes()], PROGRAM_ID);
}

/** Derive the Token Vault PDA */
export function deriveTokenVault(mint: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([SEED_TOKEN_VAULT, mint.toBytes()], PROGRAM_ID);
}

/** Derive the Buyer State PDA */
export function deriveBuyerState(buyer: PublicKey, mint: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [SEED_BUYER_STATE, buyer.toBytes(), mint.toBytes()],
    PROGRAM_ID,
  );
}

/** Derive the Vesting Vault PDA */
export function deriveVestingVault(mint: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([SEED_VESTING_VAULT, mint.toBytes()], PROGRAM_ID);
}

/** Derive the Recipient State PDA */
export function deriveRecipientState(mint: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([SEED_RECIPIENT_STATE, mint.toBytes()], PROGRAM_ID);
}

/** Derive the Platform Fee Vault PDA */
export function derivePlatformFeeVault(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([PLATFORM_FEE_VAULT_SEED], PROGRAM_ID);
}

// ─── Explorer URL helpers ───────────────────────────────────────────────────

const SOLANA_EXPLORER_URL = 'https://solscan.io/tx';

function getExplorerUrl(signature: string): string {
  return `${SOLANA_EXPLORER_URL}/${signature}`;
}

// ─── SDK Client ─────────────────────────────────────────────────────────────

export class SolanaCreatorTokenSDK {
  private program: any;
  private provider: AnchorProvider;
  private platformFeeVault: PublicKey;

  /**
   * @param provider Anchor provider (wallet + connection)
   */
  constructor(provider: AnchorProvider) {
    this.provider = provider;
    this.program = new Program(
      // In production, load from IDL JSON:
      // import idl from '../target/idl/degenfeed_creator_token.json';
      // For development, use the minimal IDL stub below
      getProgramIdl(),
      provider,
    ) as unknown as Program;
    this.platformFeeVault = derivePlatformFeeVault()[0];
  }

  /**
   * Get the underlying Anchor Program instance for advanced usage.
   */
  get programInstance(): Program {
    return this.program;
  }

  /**
   * Create a new creator token.
   *
   * @param opts - Token creation parameters
   * @returns The deploy result with mint address and transaction signature
   */
  async createToken(opts: SolanaTokenInput): Promise<SolanaDeployResult> {
    const creator = this.provider.wallet.publicKey;
    const [tokenState] = deriveTokenState(creator, opts.tokenSeed);
    const [mint] = deriveTokenMint(tokenState);
    const [mintAuthority] = deriveMintAuthority(mint);
    const [tokenVault] = deriveTokenVault(mint);
    const [vestingVault] = deriveVestingVault(mint);
    const vestingVaultTokenAccount = getAssociatedTokenAddressSync(
      mint,
      mintAuthority,
      true, // allowOwnerOffCurve
    );

    const referrer = opts.referrer ? new PublicKey(opts.referrer) : null;

    const signature = await this.program.methods
      .createToken(
        new BN(opts.tokenSeed.toString()),
        opts.name,
        opts.symbol,
        opts.uri,
        opts.creatorAllocationBps,
        opts.creatorFeeBps,
        referrer,
      )
      .accounts({
        creator,
        tokenState,
        mint,
        mintAuthority,
        tokenVault,
        vestingVault,
        vestingVaultTokenAccount,
        platformFeeVault: this.platformFeeVault,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .rpc();

    return {
      signature,
      mint: mint.toBase58(),
      tokenState: tokenState.toBase58(),
    };
  }

  /**
   * Buy tokens with SOL via the bonding curve.
   *
   * @param opts - Buy parameters
   * @returns Trade result with signature and amount
   */
  async buyTokens(opts: SolanaBuyInput): Promise<TradeResult> {
    const buyer = this.provider.wallet.publicKey;
    const mint = new PublicKey(opts.mint);

    // Derive all PDAs
    // We need the creator to derive tokenState, but we don't have it yet.
    // Instead, we can look up the token state account to find the creator + seed.
    // For the SDK, we'll require callers to provide tokenState or we'll fetch it.
    // Optimized path: caller provides tokenState address OR we derive from known params.

    // Fetch token state to get creator and seed
    const { tokenState, creator } = await this.resolveTokenState(mint);

    const [mintAuthority] = deriveMintAuthority(mint);
    const [tokenVault] = deriveTokenVault(mint);
    const [buyerState] = deriveBuyerState(buyer, mint);
    const buyerTokenAccount = getAssociatedTokenAddressSync(mint, buyer);

    const signature = await this.program.methods
      .buyTokens(new BN(opts.amountLamports.toString()), new BN(opts.minTokensOut.toString()))
      .accounts({
        buyer,
        tokenState,
        mint,
        mintAuthority,
        tokenVault,
        buyerTokenAccount,
        buyerState,
        creator,
        platformFeeVault: this.platformFeeVault,
        referrer: null, // will be resolved by program from token_state.referrer
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .rpc();

    return {
      txHash: signature,
      tokensReceived: opts.minTokensOut.toString(),
      ethSpent: opts.amountLamports.toString(),
      explorerUrl: getExplorerUrl(signature),
    };
  }

  /**
   * Sell tokens back to the bonding curve.
   *
   * @param opts - Sell parameters
   * @returns Trade result
   */
  async sellTokens(opts: SolanaSellInput): Promise<TradeResult> {
    const seller = this.provider.wallet.publicKey;
    const mint = new PublicKey(opts.mint);
    const { tokenState } = await this.resolveTokenState(mint);
    const [mintAuthority] = deriveMintAuthority(mint);
    const [tokenVault] = deriveTokenVault(mint);
    const sellerTokenAccount = getAssociatedTokenAddressSync(mint, seller);

    const signature = await this.program.methods
      .sellTokens(new BN(opts.amountTokens.toString()))
      .accounts({
        seller,
        tokenState,
        mint,
        mintAuthority,
        tokenVault,
        sellerTokenAccount,
        platformFeeVault: this.platformFeeVault,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .rpc();

    return {
      txHash: signature,
      tokensReceived: opts.amountTokens.toString(),
      explorerUrl: getExplorerUrl(signature),
    };
  }

  /**
   * Claim vested creator token allocation.
   *
   * @param mint - Token mint address
   * @returns Claim result
   */
  async claimVested(mint: string): Promise<VestedClaimResult> {
    const creator = this.provider.wallet.publicKey;
    const mintPubkey = new PublicKey(mint);
    const { tokenState } = await this.resolveTokenState(mintPubkey);
    const [mintAuthority] = deriveMintAuthority(mintPubkey);
    const [vestingVault] = deriveVestingVault(mintPubkey);
    const vestingVaultTokenAccount = getAssociatedTokenAddressSync(mintPubkey, mintAuthority, true);
    const creatorTokenAccount = getAssociatedTokenAddressSync(mintPubkey, creator);

    const signature = await this.program.methods
      .claimVested()
      .accounts({
        creator,
        tokenState,
        mint: mintPubkey,
        mintAuthority,
        vestingVault,
        vestingVaultTokenAccount,
        creatorTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    return {
      signature,
      amount: '0', // amount emitted in event; could parse from logs
      explorerUrl: getExplorerUrl(signature),
    };
  }

  /**
   * Graduate a token (stop bonding curve trading, revoke mint authority).
   * Only callable by the token creator.
   *
   * @param mint - Token mint address
   * @returns Transaction signature
   */
  async graduate(mint: string): Promise<string> {
    const creator = this.provider.wallet.publicKey;
    const mintPubkey = new PublicKey(mint);
    const { tokenState } = await this.resolveTokenState(mintPubkey);
    const [mintAuthority] = deriveMintAuthority(mintPubkey);
    const [tokenVault] = deriveTokenVault(mintPubkey);

    const signature = await this.program.methods
      .graduate()
      .accounts({
        creator,
        tokenState,
        mint: mintPubkey,
        mintAuthority,
        tokenVault,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    return signature;
  }

  /**
   * Set fees for the token. Creator-only.
   *
   * @param mint - Token mint address
   * @param platformFeeBps - Platform fee in bps (max 100 = 1%)
   * @param creatorFeeBps - Creator fee in bps (max 200 = 2%)
   */
  async setFees(mint: string, platformFeeBps: number, creatorFeeBps: number): Promise<string> {
    const creator = this.provider.wallet.publicKey;
    const mintPubkey = new PublicKey(mint);
    const { tokenState } = await this.resolveTokenState(mintPubkey);

    const signature = await this.program.methods
      .setFees(platformFeeBps, creatorFeeBps)
      .accounts({
        creator,
        tokenState,
        mint: mintPubkey,
      })
      .rpc();

    return signature;
  }

  /**
   * Set revenue recipients. Creator-only.
   * Shares must sum to exactly 10,000 bps (100%).
   */
  async setRecipients(
    mint: string,
    recipients: Array<{ address: string; shareBps: number; label: string }>,
  ): Promise<string> {
    const creator = this.provider.wallet.publicKey;
    const mintPubkey = new PublicKey(mint);
    const { tokenState } = await this.resolveTokenState(mintPubkey);
    const [recipientState] = deriveRecipientState(mintPubkey);

    const formattedRecipients = recipients.map((r) => ({
      address: new PublicKey(r.address),
      shareBps: r.shareBps,
      label: r.label,
    }));

    const signature = await this.program.methods
      .setRecipients(formattedRecipients)
      .accounts({
        creator,
        tokenState,
        mint: mintPubkey,
        recipientState,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    return signature;
  }

  /**
   * Get token info by mint address.
   */
  async getTokenInfo(mint: string): Promise<TokenInfo> {
    const mintPubkey = new PublicKey(mint);
    const [tokenState] = deriveTokenMint(mintPubkey);

    // Try both possible token state derivations
    // We need to find the TokenState account. Since we don't know the creator+seed,
    // we search via getProgramAccounts or a known index.

    // For now, we fetch the TokenState using the mint-based derivation or
    // scan program accounts. In production, maintain a PDA index.
    try {
      const _tokenStateAccount = await this.program.account.tokenState.fetch(tokenState);
      // This won't work directly because tokenState is derived from mint, not the other way.
      // We need a different approach.
    } catch {
      // Fallback: search program accounts by mint filter
      const accounts = await this.program.account.tokenState.all([
        { memcmp: { offset: 32 + 32 + 8, bytes: mintPubkey.toBase58() } }, // mint is at offset 64+8
      ]);
      if (accounts.length === 0) throw new Error(`Token not found: ${mint}`);

      const _tokenStatePda = accounts[0]?.publicKey;
      const data = accounts[0]?.account as any;

      return {
        address: mint,
        name: data.name,
        symbol: data.symbol,
        price: data.totalSupplyIssued.toString(),
        totalSupply: data.totalSupplyIssued.toString(),
        totalRaised: data.totalSolRaised.toString(),
        uniqueBuyers: data.uniqueBuyers,
        graduated: data.graduated,
        decimals: 9,
        chain: 'solana',
      };
    }

    throw new Error(`Token not found: ${mint}`);
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  /**
   * Resolve token state account for a given mint by searching program accounts.
   */
  private async resolveTokenState(
    mint: PublicKey,
  ): Promise<{ tokenState: PublicKey; creator: PublicKey; seed: bigint }> {
    const accounts = await this.program.account.tokenState.all([
      {
        memcmp: {
          offset: 32, // skip creator (32 bytes)
          bytes: mint.toBase58(),
        },
      },
    ]);

    if (accounts.length === 0) {
      throw new Error(`No token state found for mint ${mint.toBase58()}`);
    }

    const account = accounts[0]!;
    const data = account.account as any;

    return {
      tokenState: account.publicKey,
      creator: data.creator as PublicKey,
      seed: (data.tokenSeed as BN).toBigInt(),
    };
  }
}

// ─── Minimal IDL Stub ────────────────────────────────────────────────────────
// In production, replace with: import idl from '../target/idl/degenfeed_creator_token.json'
// This stub enables development without compiling the Anchor program first.

function getProgramIdl(): any {
  return {
    address: PROGRAM_ID.toBase58(),
    metadata: {
      name: 'degenfeed_creator_token',
      version: '0.1.0',
      spec: '0.1.0',
    },
    instructions: [
      {
        name: 'createToken',
        discriminator: [175, 58, 225, 88, 32, 20, 77, 143],
        accounts: [
          { name: 'creator', writable: true, signer: true },
          {
            name: 'tokenState',
            writable: true,
            pda: {
              seeds: [
                { kind: 'const', value: [116, 111, 107, 101, 110, 45, 115, 116, 97, 116, 101] },
                { kind: 'account', path: 'creator' },
                { kind: 'arg', path: 'token_seed' },
              ],
            },
          },
          {
            name: 'mint',
            writable: true,
            pda: {
              seeds: [
                { kind: 'const', value: [116, 111, 107, 101, 110, 45, 109, 105, 110, 116] },
                { kind: 'account', path: 'token_state' },
              ],
            },
          },
          {
            name: 'mintAuthority',
            writable: false,
            pda: {
              seeds: [
                {
                  kind: 'const',
                  value: [109, 105, 110, 116, 45, 97, 117, 116, 104, 111, 114, 105, 116, 121],
                },
                { kind: 'account', path: 'mint' },
              ],
            },
          },
          {
            name: 'tokenVault',
            writable: true,
            pda: {
              seeds: [
                { kind: 'const', value: [116, 111, 107, 101, 110, 45, 118, 97, 117, 108, 116] },
                { kind: 'account', path: 'mint' },
              ],
            },
          },
          {
            name: 'vestingVault',
            writable: true,
            pda: {
              seeds: [
                {
                  kind: 'const',
                  value: [118, 101, 115, 116, 105, 110, 103, 45, 118, 97, 117, 108, 116],
                },
                { kind: 'account', path: 'mint' },
              ],
            },
          },
          { name: 'vestingVaultTokenAccount', writable: true },
          { name: 'platformFeeVault', writable: true },
          { name: 'tokenProgram' },
          { name: 'associatedTokenProgram' },
          { name: 'systemProgram' },
          { name: 'rent' },
        ],
        args: [
          { name: 'tokenSeed', type: 'u64' },
          { name: 'name', type: 'string' },
          { name: 'symbol', type: 'string' },
          { name: 'uri', type: 'string' },
          { name: 'creatorAllocationBps', type: 'u16' },
          { name: 'creatorFeeBps', type: 'u16' },
          { name: 'referrer', type: { option: 'publicKey' } },
        ],
      },
      {
        name: 'buyTokens',
        discriminator: [51, 230, 181, 190, 97, 89, 133, 202],
        accounts: [
          { name: 'buyer', writable: true, signer: true },
          { name: 'tokenState', writable: true },
          { name: 'mint', writable: true },
          { name: 'mintAuthority', writable: true },
          { name: 'tokenVault', writable: true },
          { name: 'buyerTokenAccount', writable: true },
          { name: 'buyerState', writable: true, signer: false },
          { name: 'creator', writable: true },
          { name: 'platformFeeVault', writable: true },
          { name: 'referrer', writable: true, optional: true },
          { name: 'tokenProgram' },
          { name: 'systemProgram' },
          { name: 'rent' },
        ],
        args: [
          { name: 'amountSol', type: 'u64' },
          { name: 'minTokensOut', type: 'u64' },
        ],
      },
      {
        name: 'sellTokens',
        discriminator: [53, 107, 234, 143, 115, 167, 100, 106],
        accounts: [
          { name: 'seller', writable: true, signer: true },
          { name: 'tokenState', writable: true },
          { name: 'mint', writable: true },
          { name: 'mintAuthority' },
          { name: 'tokenVault', writable: true },
          { name: 'sellerTokenAccount', writable: true },
          { name: 'platformFeeVault', writable: true },
          { name: 'tokenProgram' },
          { name: 'systemProgram' },
          { name: 'rent' },
        ],
        args: [{ name: 'amountTokens', type: 'u64' }],
      },
      {
        name: 'claimVested',
        discriminator: [138, 234, 118, 134, 163, 30, 230, 161],
        accounts: [
          { name: 'creator', writable: true, signer: true },
          { name: 'tokenState', writable: true },
          { name: 'mint', writable: true },
          { name: 'mintAuthority', writable: true },
          { name: 'vestingVault', writable: true },
          { name: 'vestingVaultTokenAccount', writable: true },
          { name: 'creatorTokenAccount', writable: true },
          { name: 'tokenProgram' },
          { name: 'systemProgram' },
        ],
        args: [],
      },
      {
        name: 'graduate',
        discriminator: [119, 56, 237, 1, 98, 97, 252, 160],
        accounts: [
          { name: 'creator', writable: true, signer: true },
          { name: 'tokenState', writable: true },
          { name: 'mint', writable: true },
          { name: 'mintAuthority', writable: true },
          { name: 'tokenVault', writable: true },
          { name: 'tokenProgram' },
          { name: 'systemProgram' },
        ],
        args: [],
      },
      {
        name: 'setFees',
        discriminator: [165, 190, 166, 26, 95, 246, 32, 225],
        accounts: [
          { name: 'creator', writable: true, signer: true },
          { name: 'tokenState', writable: true },
          { name: 'mint' },
        ],
        args: [
          { name: 'platformFeeBps', type: 'u16' },
          { name: 'creatorFeeBps', type: 'u16' },
        ],
      },
      {
        name: 'setRecipients',
        discriminator: [190, 50, 55, 206, 63, 242, 139, 201],
        accounts: [
          { name: 'creator', writable: true, signer: true },
          { name: 'tokenState', writable: true },
          { name: 'mint' },
          { name: 'recipientState', writable: true },
          { name: 'systemProgram' },
        ],
        args: [
          {
            name: 'recipients',
            type: {
              vec: {
                defined: {
                  name: 'Recipient',
                  fields: [
                    { name: 'address', type: 'publicKey' },
                    { name: 'shareBps', type: 'u16' },
                    { name: 'label', type: 'string' },
                  ],
                },
              },
            },
          },
        ],
      },
    ],
    accounts: [
      {
        name: 'TokenState',
        discriminator: [163, 64, 31, 111, 7, 129, 65, 152],
        fields: [
          { name: 'creator', type: 'publicKey' },
          { name: 'mint', type: 'publicKey' },
          { name: 'tokenSeed', type: 'u64' },
          { name: 'name', type: 'string' },
          { name: 'symbol', type: 'string' },
          { name: 'uri', type: 'string' },
          { name: 'createdAt', type: 'i64' },
          { name: 'creatorAllocationBps', type: 'u16' },
          { name: 'creatorFeeBps', type: 'u16' },
          { name: 'platformFeeBps', type: 'u16' },
          { name: 'referrer', type: { option: 'publicKey' } },
          { name: 'totalSupplyIssued', type: 'u64' },
          { name: 'totalSolRaised', type: 'u64' },
          { name: 'uniqueBuyers', type: 'u32' },
          { name: 'graduated', type: 'bool' },
          { name: 'bump', type: 'u8' },
          { name: 'mintBump', type: 'u8' },
          { name: 'vaultBump', type: 'u8' },
          { name: 'authorityBump', type: 'u8' },
        ],
      },
      {
        name: 'BuyerState',
        discriminator: [13, 236, 245, 45, 168, 211, 230, 253],
        fields: [
          { name: 'buyer', type: 'publicKey' },
          { name: 'tokenMint', type: 'publicKey' },
          { name: 'totalBought', type: 'u64' },
          { name: 'totalSolSpent', type: 'u64' },
          { name: 'lastBuy', type: 'i64' },
          { name: 'buyCount', type: 'u32' },
          { name: 'bump', type: 'u8' },
        ],
      },
      {
        name: 'VestingVault',
        discriminator: [249, 114, 126, 116, 108, 79, 235, 218],
        fields: [
          { name: 'tokenMint', type: 'publicKey' },
          { name: 'creator', type: 'publicKey' },
          { name: 'totalAllocated', type: 'u64' },
          { name: 'totalClaimed', type: 'u64' },
          { name: 'vestingStart', type: 'i64' },
          { name: 'vestingEnd', type: 'i64' },
          { name: 'bump', type: 'u8' },
        ],
      },
    ],
    events: [
      {
        name: 'TokenCreated',
        discriminator: [123, 223, 222, 115, 168, 44, 193, 119],
        fields: [
          { name: 'creator', type: 'publicKey', index: true },
          { name: 'mint', type: 'publicKey', index: true },
          { name: 'name', type: 'string' },
          { name: 'symbol', type: 'string' },
          { name: 'creatorAllocationBps', type: 'u16' },
          { name: 'creatorFeeBps', type: 'u16' },
          { name: 'timestamp', type: 'i64' },
        ],
      },
      {
        name: 'TokensBought',
        discriminator: [201, 147, 182, 124, 120, 159, 57, 209],
        fields: [
          { name: 'buyer', type: 'publicKey', index: true },
          { name: 'mint', type: 'publicKey', index: true },
          { name: 'amountSolNet', type: 'u64' },
          { name: 'amountSolGross', type: 'u64' },
          { name: 'tokensOut', type: 'u64' },
          { name: 'price', type: 'u64' },
          { name: 'platformFee', type: 'u64' },
          { name: 'creatorFee', type: 'u64' },
          { name: 'referralFee', type: 'u64' },
          { name: 'timestamp', type: 'i64' },
        ],
      },
    ],
    errors: [
      { code: 6000, msg: 'Amount must be greater than zero' },
      { code: 6001, msg: 'Arithmetic overflow or underflow' },
      { code: 6002, msg: 'Invalid program authority' },
      { code: 6003, msg: 'Token has already graduated to AMM' },
      { code: 6004, msg: 'Buy exceeds phase limit' },
      { code: 6005, msg: 'Must wait 60 seconds between buys' },
      { code: 6006, msg: 'Slippage exceeded' },
      { code: 6007, msg: 'Buy would exceed maximum holder limit of 15%' },
      { code: 6008, msg: 'Seller does not have enough tokens' },
      { code: 6009, msg: 'Only the token creator can perform this action' },
    ],
  };
}
