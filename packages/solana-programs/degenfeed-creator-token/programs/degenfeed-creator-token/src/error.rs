use anchor_lang::prelude::*;

#[error_code]
pub enum CreatorTokenError {
    // ── General errors ────────────────────────────────────────────────
    #[msg("Amount must be greater than zero")]
    ZeroAmount,
    #[msg("Arithmetic overflow or underflow")]
    MathOverflow,
    #[msg("Invalid program authority")]
    InvalidAuthority,
    #[msg("Account not initialized")]
    UninitializedAccount,

    // ── Token creation errors ─────────────────────────────────────────
    #[msg("Name exceeds maximum length")]
    NameTooLong,
    #[msg("Symbol exceeds maximum length")]
    SymbolTooLong,
    #[msg("URI exceeds maximum length")]
    UriTooLong,
    #[msg("Creator allocation exceeds maximum of 15%")]
    CreatorAllocationTooHigh,
    #[msg("Creator fee exceeds maximum of 2%")]
    CreatorFeeTooHigh,

    // ── Buy errors ────────────────────────────────────────────────────
    #[msg("Token has already graduated to AMM")]
    AlreadyGraduated,
    #[msg("Buy exceeds phase limit")]
    PhaseLimitExceeded,
    #[msg("Must wait 60 seconds between buys")]
    CooldownActive,
    #[msg("Slippage exceeded — fewer tokens received than minimum")]
    SlippageExceeded,
    #[msg("Buy would exceed maximum holder limit of 15%")]
    MaxHolderExceeded,
    #[msg("Token is not yet graduated")]
    NotGraduated,

    // ── Sell errors ───────────────────────────────────────────────────
    #[msg("Seller doesn't have enough tokens")]
    InsufficientTokens,
    #[msg("Token vault has insufficient SOL for sell")]
    InsufficientVaultBalance,
    #[msg("Sell would leave dust balance")]
    DustBalance,

    // ── Vesting errors ────────────────────────────────────────────────
    #[msg("No vested tokens to claim")]
    NoVestedTokens,
    #[msg("Vesting period has not elapsed")]
    VestingNotElapsed,

    // ── Fee errors ────────────────────────────────────────────────────
    #[msg("Total fee bps must not exceed 10,000")]
    FeeBpsOverflow,
    #[msg("Only the token creator can perform this action")]
    NotCreator,
    #[msg("Recipient shares must sum to exactly 10,000 bps")]
    RecipientSharesMismatch,
    #[msg("Too many recipients")]
    TooManyRecipients,

    // ── Account errors ────────────────────────────────────────────────
    #[msg("Token account mismatch")]
    TokenAccountMismatch,
    #[msg("Mint account mismatch")]
    MintMismatch,
    #[msg("Buyer state already initialized for this token")]
    BuyerStateAlreadyExists,
    #[msg("Buyer state not found")]
    BuyerStateNotFound,
    #[msg("Referrer cannot be the creator")]
    ReferrerIsCreator,
    #[msg("Referrer cannot be the buyer")]
    ReferrerIsBuyer,
}
