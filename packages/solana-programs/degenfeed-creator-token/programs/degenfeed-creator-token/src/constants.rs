/// Total token supply: 1,000,000,000 tokens with 9 decimal places
pub const TOTAL_SUPPLY: u64 = 1_000_000_000_000_000_000;

/// Supply threshold for graduation: 80% of total
pub const GRADUATION_SUPPLY: u64 = 800_000_000_000_000_000;

/// Minimum buyers for graduation
pub const GRADUATION_MIN_BUYERS: u32 = 50;

/// Minimum token price in lamports per base unit (1 lamport = ~1e-9 SOL)
pub const MIN_PRICE: u64 = 1;

/// Maximum token price at graduation (1000 lamports per base unit)
pub const MAX_PRICE: u64 = 1_000;

/// Scaling factor for bonding curve precision (1e9)
pub const SCALING: u128 = 1_000_000_000;

/// Creator allocation maximum: 15%
pub const MAX_CREATOR_ALLOCATION_BPS: u16 = 1_500;

/// Creator fee maximum: 2%
pub const MAX_CREATOR_FEE_BPS: u16 = 200;

/// Platform fee: 0.5%
pub const PLATFORM_FEE_BPS: u16 = 50;

/// Referral fee: 0.05%
pub const REFERRAL_FEE_BPS: u16 = 5;

/// Max holder percentage: 15%
pub const MAX_HOLDER_PCT: u64 = 15;

/// Cooldown between buys: 60 seconds
pub const BUY_COOLDOWN_SECONDS: i64 = 60;

/// Vesting period for creator allocation: 180 days
pub const VESTING_PERIOD_SECONDS: i64 = 15_552_000;

/// Phase 1 limit: 2% — first 5 minutes
pub const PHASE_1_DURATION: i64 = 300;
pub const PHASE_1_LIMIT_BPS: u16 = 200;

/// Phase 2 limit: 5% — 5 to 30 minutes
pub const PHASE_2_DURATION: i64 = 1_800;
pub const PHASE_2_LIMIT_BPS: u16 = 500;

/// Phase 3 limit: 10% — 30 minutes to 24 hours
pub const PHASE_3_DURATION: i64 = 86_400;
pub const PHASE_3_LIMIT_BPS: u16 = 1_000;

/// Phase 4 limit: 15% — after 24 hours
pub const PHASE_4_LIMIT_BPS: u16 = 1_500;

/// Max recipients in revenue split
pub const MAX_RECIPIENTS: usize = 10;

/// Max length for token name
pub const MAX_NAME_LENGTH: usize = 32;

/// Max length for token symbol
pub const MAX_SYMBOL_LENGTH: usize = 10;

/// Max length for token URI
pub const MAX_URI_LENGTH: usize = 200;

/// Max length for recipient label
pub const MAX_LABEL_LENGTH: usize = 32;

/// PDA seed prefixes
pub const SEED_TOKEN_STATE: &[u8] = b"token-state";
pub const SEED_TOKEN_MINT: &[u8] = b"token-mint";
pub const SEED_MINT_AUTHORITY: &[u8] = b"mint-authority";
pub const SEED_TOKEN_VAULT: &[u8] = b"token-vault";
pub const SEED_BUYER_STATE: &[u8] = b"buyer-state";
pub const SEED_VESTING_VAULT: &[u8] = b"vesting-vault";
pub const SEED_RECIPIENT_STATE: &[u8] = b"recipient-state";
