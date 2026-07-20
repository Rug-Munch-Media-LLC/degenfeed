use anchor_lang::prelude::*;

use crate::constants::*;
use crate::error::CreatorTokenError;

/// Core state for a DegenFeed creator token.
/// One TokenState per token mint.
#[account]
#[derive(InitSpace)]
pub struct TokenState {
    /// Creator wallet — controls fees, recipients, and can claim vested supply
    pub creator: Pubkey,

    /// The SPL token mint address for this creator token
    pub mint: Pubkey,

    /// Unique seed provided by creator to derive PDAs
    pub token_seed: u64,

    /// Human-readable token name (e.g., "DegenFeed Creator Coin")
    #[max_len(MAX_NAME_LENGTH)]
    pub name: String,

    /// Ticker symbol (e.g., "DFCC")
    #[max_len(MAX_SYMBOL_LENGTH)]
    pub symbol: String,

    /// Metadata URI (Arweave/IPFS) for off-chain metadata
    #[max_len(MAX_URI_LENGTH)]
    pub uri: String,

    /// Unix timestamp of token creation
    pub created_at: i64,

    /// Creator's reserved allocation in bps (0-1500 = 0%-15%)
    pub creator_allocation_bps: u16,

    /// Fee charged to buyers in bps (0-200 = 0%-2%)
    pub creator_fee_bps: u16,

    /// Platform fee in bps (hardcoded to 50 = 0.5%)
    pub platform_fee_bps: u16,

    /// Optional referrer address — gets 0.05% of buys
    pub referrer: Option<Pubkey>,

    /// Total tokens issued to buyers so far (9 decimal precision)
    pub total_supply_issued: u64,

    /// Total SOL raised in lamports (net after fees)
    pub total_sol_raised: u64,

    /// Number of unique buyer wallets
    pub unique_buyers: u32,

    /// Whether the token has graduated to an external AMM
    pub graduated: bool,

    /// PDA bump
    pub bump: u8,

    /// Mint PDA bump
    pub mint_bump: u8,

    /// Vault PDA bump
    pub vault_bump: u8,

    /// Mint authority PDA bump
    pub authority_bump: u8,
}

impl TokenState {
    /// Calculate the creator's vested allocation at full vesting
    pub fn creator_allocation_amount(&self) -> Result<u64> {
        (TOTAL_SUPPLY as u128)
            .checked_mul(self.creator_allocation_bps as u128)
            .ok_or(error!(CreatorTokenError::MathOverflow))?
            .checked_div(10_000u128)
            .ok_or(error!(CreatorTokenError::MathOverflow))
            .map(|v| v as u64)
    }

    /// Check if graduation conditions are met
    pub fn can_graduate(&self) -> bool {
        self.total_supply_issued >= GRADUATION_SUPPLY
            && self.unique_buyers >= GRADUATION_MIN_BUYERS
            && !self.graduated
    }

    /// Space required for the account (manual calc as anchor_lang 0.30 fallback)
    pub const LEN: usize = 32  // creator
        + 32  // mint
        + 8   // token_seed
        + 4 + MAX_NAME_LENGTH  // name (4 byte len prefix)
        + 4 + MAX_SYMBOL_LENGTH // symbol
        + 4 + MAX_URI_LENGTH   // uri
        + 8   // created_at
        + 2   // creator_allocation_bps
        + 2   // creator_fee_bps
        + 2   // platform_fee_bps
        + 1 + 32 // referrer (Option<Pubkey>)
        + 8   // total_supply_issued
        + 8   // total_sol_raised
        + 4   // unique_buyers
        + 1   // graduated
        + 1   // bump
        + 1   // mint_bump
        + 1   // vault_bump
        + 1; // authority_bump
}

/// Per-buyer state for a specific token.
/// Enforces cooldowns, max holder caps, and tracks cumulative buys.
#[account]
#[derive(InitSpace)]
pub struct BuyerState {
    /// The buyer wallet
    pub buyer: Pubkey,

    /// The token mint this state is for
    pub token_mint: Pubkey,

    /// Total tokens bought by this buyer (9 decimals)
    pub total_bought: u64,

    /// Total SOL spent by this buyer (lamports)
    pub total_sol_spent: u64,

    /// Unix timestamp of last buy
    pub last_buy: i64,

    /// Number of buy transactions
    pub buy_count: u32,

    /// PDA bump
    pub bump: u8,
}

/// Revenue split configuration.
/// Creator can set up to 10 recipients to share ongoing fees.
#[account]
#[derive(InitSpace)]
pub struct RecipientState {
    /// The token mint this config is for
    pub token_mint: Pubkey,

    /// List of revenue recipients
    #[max_len(MAX_RECIPIENTS)]
    pub recipients: Vec<Recipient>,

    /// PDA bump
    pub bump: u8,
}

/// A single revenue recipient with share allocation
#[derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace)]
pub struct Recipient {
    /// Wallet address receiving the share
    pub address: Pubkey,

    /// Share in bps (0-10000). Must sum to 10000 across all recipients.
    pub share_bps: u16,

    /// Human-readable label (e.g., "Marketing Wallet")
    #[max_len(MAX_LABEL_LENGTH)]
    pub label: String,
}

/// Customizable vesting configuration for creator token allocation.
/// Mirrors the EVM VestingConfig struct — transparent and on-chain.
///
/// ## Schedule
/// 1. `initial_unlock_bps`% of allocation is unlocked immediately at launch
/// 2. No additional tokens unlock during the `cliff_duration` period
/// 3. After cliff, remaining tokens vest linearly over `vesting_duration`
#[derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace)]
pub struct VestingConfig {
    /// Basis points unlocked immediately at launch (0-3000 = 0-30%)
    pub initial_unlock_bps: u16,

    /// Cliff duration in seconds before linear vesting begins (0 = no cliff, max 90 days)
    pub cliff_duration: i64,

    /// Total vesting duration in seconds after cliff (min 7 days, max 2 years)
    pub vesting_duration: i64,
}

/// Vested tokens that the creator can claim over time.
/// Supports customizable vesting per VestingConfig.
#[account]
#[derive(InitSpace)]
pub struct VestingVault {
    /// The token mint
    pub token_mint: Pubkey,

    /// The creator wallet
    pub creator: Pubkey,

    /// Total tokens allocated for vesting
    pub total_allocated: u64,

    /// Total tokens claimed so far
    pub total_claimed: u64,

    /// Vesting start timestamp (token creation time)
    pub vesting_start: i64,

    /// Vesting end timestamp (cliff_end + vesting_duration)
    pub vesting_end: i64,

    /// Customizable vesting config — set once at creation, immutable
    pub vesting_config: VestingConfig,

    /// PDA bump
    pub bump: u8,
}
