/**
 * Creator Coin — Solana Client
 *
 * Client for deploying and trading creator coins on Solana via Anchor.
 */

import { type AnchorProvider, BN, Program } from '@coral-xyz/anchor';
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import { PublicKey, SYSVAR_RENT_PUBKEY, SystemProgram } from '@solana/web3.js';
import type {
  BuyInput,
  CreatorCoinConfig,
  DeployResult,
  SellInput,
  TokenInfo,
  TradeResult,
} from '../types';

// ─── Constants ─────────────────────────────────────────────────────────────

export const PROGRAM_ID = new PublicKey('DFCCrTn111111111111111111111111111111111111');

const SEED_TOKEN_STATE = new TextEncoder().encode('token-state');
const SEED_TOKEN_MINT = new TextEncoder().encode('token-mint');
const SEED_MINT_AUTHORITY = new TextEncoder().encode('mint-authority');
const SEED_TOKEN_VAULT = new TextEncoder().encode('token-vault');
const SEED_BUYER_STATE = new TextEncoder().encode('buyer-state');
const SEED_VESTING_VAULT = new TextEncoder().encode('vesting-vault');
const SEED_PLATFORM_FEE = new TextEncoder().encode('platform-fee-vault');

// ─── PDA Derivation ────────────────────────────────────────────────────────

export function deriveTokenState(creator: PublicKey, tokenSeed: bigint): [PublicKey, number] {
  const buf = new Uint8Array(8);
  new DataView(buf.buffer).setBigUint64(0, tokenSeed, true);
  return PublicKey.findProgramAddressSync([SEED_TOKEN_STATE, creator.toBytes(), buf], PROGRAM_ID);
}

export function deriveTokenMint(tokenState: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([SEED_TOKEN_MINT, tokenState.toBytes()], PROGRAM_ID);
}

export function deriveMintAuthority(mint: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([SEED_MINT_AUTHORITY, mint.toBytes()], PROGRAM_ID);
}

export function deriveTokenVault(mint: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([SEED_TOKEN_VAULT, mint.toBytes()], PROGRAM_ID);
}

export function deriveBuyerState(buyer: PublicKey, mint: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [SEED_BUYER_STATE, buyer.toBytes(), mint.toBytes()],
    PROGRAM_ID,
  );
}

export function derivePlatformFeeVault(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([SEED_PLATFORM_FEE], PROGRAM_ID);
}

// ─── SDK Client ────────────────────────────────────────────────────────────

export class CreatorCoinSolanaClient {
  private program: Program;
  private provider: AnchorProvider;

  constructor(provider: AnchorProvider) {
    this.provider = provider;
    this.program = new Program(getIdl(), provider);
  }

  private get methods(): any {
    return this.program.methods;
  }

  // ─── Deploy ──────────────────────────────────────────────────────────────

  async deployCoin(config: CreatorCoinConfig): Promise<DeployResult> {
    const creator = this.provider.wallet.publicKey;
    const tokenSeed = BigInt(Date.now());
    const [tokenState] = deriveTokenState(creator, tokenSeed);
    const [mint] = deriveTokenMint(tokenState);
    const [mintAuthority] = deriveMintAuthority(mint);
    const [tokenVault] = deriveTokenVault(mint);
    const [vestingVault] = deriveVestingVault(mint);
    const vestingVaultTokenAccount = getAssociatedTokenAddressSync(mint, mintAuthority, true);
    const [platformFeeVault] = derivePlatformFeeVault();

    const referrer = config.referrer ? new PublicKey(config.referrer) : null;
    const name = config.name.slice(0, 32);
    const symbol = config.symbol.slice(0, 10);

    const sig = await this.methods
      .createToken(
        new BN(tokenSeed.toString()),
        name,
        symbol,
        config.uri,
        config.creatorAllocationBps,
        config.creatorFeeBps ?? 100,
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
        platformFeeVault,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
      } as any)
      .rpc();

    return {
      txHash: sig,
      primaryAddress: mint.toBase58(),
      explorerUrl: `https://solscan.io/tx/${sig}`,
      totalSupply: '1000000000000000000',
      chain: 'solana',
    };
  }

  // ─── Buy ─────────────────────────────────────────────────────────────────

  async buy(opts: BuyInput): Promise<TradeResult> {
    const buyer = this.provider.wallet.publicKey;
    const mint = new PublicKey(opts.tokenAddress);

    // Resolve token state
    const { tokenState, creator } = await this.resolveTokenState(mint);
    const [mintAuthority] = deriveMintAuthority(mint);
    const [tokenVault] = deriveTokenVault(mint);
    const [buyerState] = deriveBuyerState(buyer, mint);
    const buyerTokenAccount = getAssociatedTokenAddressSync(mint, buyer);
    const [platformFeeVault] = derivePlatformFeeVault();

    const sig = await this.methods
      .buyTokens(new BN(opts.amountIn.toString()), new BN(opts.minTokensOut.toString()))
      .accounts({
        buyer,
        tokenState,
        mint,
        mintAuthority,
        tokenVault,
        buyerTokenAccount,
        buyerState,
        creator,
        platformFeeVault,
        referrer: null,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
      } as any)
      .rpc();

    return {
      txHash: sig,
      tokensAmount: opts.amountIn.toString(),
      explorerUrl: `https://solscan.io/tx/${sig}`,
    };
  }

  // ─── Sell ────────────────────────────────────────────────────────────────

  async sell(opts: SellInput): Promise<TradeResult> {
    const seller = this.provider.wallet.publicKey;
    const mint = new PublicKey(opts.tokenAddress);
    const { tokenState } = await this.resolveTokenState(mint);
    const [mintAuthority] = deriveMintAuthority(mint);
    const [tokenVault] = deriveTokenVault(mint);
    const sellerTokenAccount = getAssociatedTokenAddressSync(mint, seller);
    const [platformFeeVault] = derivePlatformFeeVault();

    const sig = await this.methods
      .sellTokens(new BN(opts.amountIn.toString()))
      .accounts({
        seller,
        tokenState,
        mint,
        mintAuthority,
        tokenVault,
        sellerTokenAccount,
        platformFeeVault,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
      } as any)
      .rpc();

    return {
      txHash: sig,
      tokensAmount: opts.amountIn.toString(),
      explorerUrl: `https://solscan.io/tx/${sig}`,
    };
  }

  // ─── Query ───────────────────────────────────────────────────────────────

  async getTokenInfo(mint: string): Promise<TokenInfo> {
    const mintPubkey = new PublicKey(mint);
    const accounts = await (this.program.account as any).tokenState.all([
      { memcmp: { offset: 32, bytes: mintPubkey.toBase58() } },
    ]);

    if (accounts.length === 0) throw new Error(`Token not found: ${mint}`);

    const data = accounts[0]?.account as any;
    return {
      address: mint,
      name: data.name as string,
      symbol: data.symbol as string,
      price: '0',
      totalSupply: (data.totalSupplyIssued as BN).toString(),
      totalRaised: (data.totalSolRaised as BN).toString(),
      uniqueBuyers: data.uniqueBuyers as number,
      graduated: data.graduated as boolean,
      decimals: 9,
      chain: 'solana',
      createdAt: Number((data.createdAt as BN).toNumber()),
      creator: (data.creator as PublicKey).toBase58(),
    };
  }

  private async resolveTokenState(
    mint: PublicKey,
  ): Promise<{ tokenState: PublicKey; creator: PublicKey; seed: bigint }> {
    const accounts = await (this.program.account as any).tokenState.all([
      { memcmp: { offset: 32, bytes: mint.toBase58() } },
    ]);
    if (accounts.length === 0) throw new Error(`No token state for mint ${mint.toBase58()}`);
    const a = accounts[0]!;
    return {
      tokenState: a.publicKey,
      creator: (a.account as any).creator as PublicKey,
      seed: ((a.account as any).tokenSeed as BN).toBigInt(),
    };
  }
}

function deriveVestingVault(mint: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([SEED_VESTING_VAULT, mint.toBytes()], PROGRAM_ID);
}

// ─── IDL Stub ──────────────────────────────────────────────────────────────

function getIdl(): any {
  return {
    address: PROGRAM_ID.toBase58(),
    metadata: { name: 'degenfeed_creator_token', version: '0.1.0', spec: '0.1.0' },
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
          { name: 'buyerState', writable: true },
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
    ],
  };
}
