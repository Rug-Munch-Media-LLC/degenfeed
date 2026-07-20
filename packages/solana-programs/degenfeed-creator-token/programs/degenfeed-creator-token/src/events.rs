use anchor_lang::prelude::*;

/// Emitted when a new creator token is created
#[event]
pub struct TokenCreated {
    /// The wallet that created the token
    pub creator: Pubkey,
    /// The SPL token mint address
    pub mint: Pubkey,
    /// Token name
    pub name: String,
    /// Token symbol
    pub symbol: String,
    /// Creator allocation in bps (0-1500)
    pub creator_allocation_bps: u16,
    /// Creator fee in bps (0-200)
    pub creator_fee_bps: u16,
    /// Unix timestamp of creation
    pub timestamp: i64,
    /// Vesting initial unlock in bps (0-3000)
    pub vesting_initial_unlock_bps: u16,
    /// Vesting cliff duration in seconds
    pub vesting_cliff_duration: i64,
    /// Vesting duration in seconds
    pub vesting_vesting_duration: i64,
}

/// Emitted when tokens are bought
#[event]
pub struct TokensBought {
    /// The buyer's wallet
    pub buyer: Pubkey,
    /// The token mint
    pub mint: Pubkey,
    /// Amount of SOL spent in lamports (net after fees)
    pub amount_sol_net: u64,
    /// Total SOL amount including fees
    pub amount_sol_gross: u64,
    /// Amount of tokens received (9 decimals)
    pub tokens_out: u64,
    /// Price per token at time of buy (lamports per base unit)
    pub price: u64,
    /// Platform fee collected
    pub platform_fee: u64,
    /// Creator fee collected
    pub creator_fee: u64,
    /// Referral fee collected (if applicable)
    pub referral_fee: u64,
    /// Unix timestamp
    pub timestamp: i64,
}

/// Emitted when tokens are sold back to the curve
#[event]
pub struct TokensSold {
    /// The seller's wallet
    pub seller: Pubkey,
    /// The token mint
    pub mint: Pubkey,
    /// Amount of tokens burned
    pub tokens_in: u64,
    /// Amount of SOL returned to seller
    pub sol_out: u64,
    /// Price per token at time of sell
    pub price: u64,
    /// Platform fee deducted
    pub platform_fee: u64,
    /// Unix timestamp
    pub timestamp: i64,
}

/// Emitted when creator claims vested allocation
#[event]
pub struct VestedTokensClaimed {
    /// The creator's wallet
    pub creator: Pubkey,
    /// The token mint
    pub mint: Pubkey,
    /// Amount of tokens claimed (9 decimals)
    pub amount: u64,
    /// Remaining unclaimed allocation
    pub remaining: u64,
    /// Unix timestamp
    pub timestamp: i64,
}

/// Emitted when token graduates to AMM
#[event]
pub struct TokenGraduated {
    /// The token mint
    pub mint: Pubkey,
    /// Total supply issued at graduation
    pub supply_issued: u64,
    /// Total SOL raised
    pub total_raised: u64,
    /// Number of unique buyers
    pub unique_buyers: u32,
    /// Remaining SOL in vault transferred to creator
    pub vault_sol_remaining: u64,
    /// Unix timestamp
    pub timestamp: i64,
}

/// Emitted when fees are updated
#[event]
pub struct FeesUpdated {
    /// The token mint
    pub mint: Pubkey,
    /// New platform fee in bps
    pub platform_fee_bps: u16,
    /// New creator fee in bps
    pub creator_fee_bps: u16,
    /// Unix timestamp
    pub timestamp: i64,
}

/// Emitted when revenue recipients are updated
#[event]
pub struct RecipientsUpdated {
    /// The token mint
    pub mint: Pubkey,
    /// Number of recipients
    pub count: u16,
    /// Unix timestamp
    pub timestamp: i64,
}
