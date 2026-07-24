//! DegenFeed Creator Coin — Solana Anchor Program
//!
//! A bonding curve token program for creator coins on Solana.
//! Features:
//!   - Bonding curve with 5 eras (super-linear pricing)
//!   - Creator vesting with customizable schedule
//!   - Platform + creator fee collection
//!   - Anti-exploit: phase limits, cooldowns, max holdings
//!   - Live stream boost oracle integration
//!   - Cross-chain burn/mint for bridge to Base

use anchor_lang::prelude::*;
use anchor_lang::solana_program::sysvar::instructions as tx_instructions;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{self, Burn, Mint, MintTo, Token, TokenAccount, Transfer};

declare_id!("DFCCrTn111111111111111111111111111111111111");

// ── Constants ──────────────────────────────────────────────────────────────
const TOTAL_SUPPLY: u64 = 1_000_000_000_000_000_000; // 1B * 1e9 (Solana 9 decimals)
const GRADUATION_SUPPLY: u64 = 800_000_000_000_000_000; // 80%
const MIN_PRICE: u64 = 1_000_000_000; // 1 gwei equivalent in lamports
const MAX_PRICE: u64 = 1_000_000_000_000; // 1000 gwei
const MAX_CREATOR_FEE_BPS: u16 = 200;
const MAX_CREATOR_ALLOCATION_BPS: u16 = 1500;
const MAX_TOTAL_FEE_BPS: u16 = 250;
const COOLDOWN_SECONDS: i64 = 60;
const LIVE_BOOST_CAP_BPS: u16 = 500;
const PRICE_DECIMALS: u64 = 1_000_000_000;

// ── Error Codes ────────────────────────────────────────────────────────────
#[error_code]
pub enum CreatorCoinError {
    #[msg("Amount must be greater than zero")]
    ZeroAmount,
    #[msg("Arithmetic overflow")]
    Overflow,
    #[msg("Token has already graduated")]
    AlreadyGraduated,
    #[msg("Buy exceeds phase limit")]
    PhaseLimitExceeded,
    #[msg("Cooldown active, wait before next buy")]
    CooldownActive,
    #[msg("Slippage exceeded")]
    SlippageExceeded,
    #[msg("Buy would exceed maximum holder limit of 15%")]
    MaxHolderExceeded,
    #[msg("Insufficient token balance")]
    InsufficientBalance,
    #[msg("Only creator can perform this action")]
    NotCreator,
    #[msg("Exceeds total supply")]
    ExceedsTotalSupply,
    #[msg("Invalid fee configuration")]
    InvalidFeeConfig,
    #[msg("Name too long (max 32)")]
    NameTooLong,
    #[msg("Symbol too long (max 10)")]
    SymbolTooLong,
}

// ── Account Structs ────────────────────────────────────────────────────────
#[account]
#[derive(InitSpace)]
pub struct TokenState {
    pub creator: Pubkey,
    pub mint: Pubkey,
    pub token_seed: u64,
    #[max_len(32)]
    pub name: String,
    #[max_len(10)]
    pub symbol: String,
    #[max_len(200)]
    pub uri: String,
    pub created_at: i64,
    pub creator_allocation_bps: u16,
    pub creator_fee_bps: u16,
    pub platform_fee_bps: u16,
    pub referrer: Option<Pubkey>,
    pub total_supply_issued: u64,
    pub total_sol_raised: u64,
    pub unique_buyers: u32,
    pub graduated: bool,
    pub bump: u8,
    pub mint_bump: u8,
    pub vault_bump: u8,
    pub authority_bump: u8,
    // Live boost integration
    pub live_oracle: Option<Pubkey>,
    pub creator_key_bytes: [u8; 32],
    // Cross-chain bridge
    pub cross_chain_bridge: Option<Pubkey>,
    pub wrapped_mint: Option<Pubkey>,
}

#[account]
#[derive(InitSpace)]
pub struct BuyerState {
    pub buyer: Pubkey,
    pub token_mint: Pubkey,
    pub total_bought: u64,
    pub total_sol_spent: u64,
    pub last_buy: i64,
    pub buy_count: u32,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct VestingVault {
    pub token_mint: Pubkey,
    pub creator: Pubkey,
    pub total_allocated: u64,
    pub total_claimed: u64,
    pub vesting_start: i64,
    pub cliff_duration: i64,
    pub vesting_duration: i64,
    pub initial_unlock_bps: u16,
    pub bump: u8,
}

// ── Instruction Contexts ────────────────────────────────────────────────────

#[derive(Accounts)]
#[instruction(token_seed: u64, name: String, symbol: String)]
pub struct CreateToken<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,

    #[account(
        init,
        payer = creator,
        space = 8 + TokenState::INIT_SPACE,
        seeds = [b"token-state", creator.key().as_ref(), &token_seed.to_le_bytes()],
        bump
    )]
    pub token_state: Account<'info, TokenState>,

    #[account(
        init,
        payer = creator,
        mint::decimals = 9,
        mint::authority = mint_authority,
        seeds = [b"token-mint", token_state.key().as_ref()],
        bump
    )]
    pub mint: Account<'info, Mint>,

    /// CHECK: PDA for mint authority
    #[account(
        seeds = [b"mint-authority", mint.key().as_ref()],
        bump
    )]
    pub mint_authority: UncheckedAccount<'info>,

    #[account(
        init,
        payer = creator,
        token::mint = mint,
        token::authority = mint_authority,
        seeds = [b"token-vault", mint.key().as_ref()],
        bump
    )]
    pub token_vault: Account<'info, TokenAccount>,

    #[account(
        init,
        payer = creator,
        space = 8 + VestingVault::INIT_SPACE,
        seeds = [b"vesting-vault", mint.key().as_ref()],
        bump
    )]
    pub vesting_vault: Account<'info, VestingVault>,

    /// CHECK: ATA for vesting vault
    #[account(
        init,
        payer = creator,
        associated_token::mint = mint,
        associated_token::authority = mint_authority,
    )]
    pub vesting_vault_token_account: Account<'info, TokenAccount>,

    /// CHECK: Platform fee vault
    #[account(
        mut,
        seeds = [b"platform-fee-vault"],
        bump
    )]
    pub platform_fee_vault: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct BuyTokens<'info> {
    #[account(mut)]
    pub buyer: Signer<'info>,

    #[account(
        mut,
        seeds = [b"token-state", token_state.creator.as_ref(), &token_state.token_seed.to_le_bytes()],
        bump = token_state.bump,
    )]
    pub token_state: Account<'info, TokenState>,

    #[account(
        mut,
        seeds = [b"token-mint", token_state.key().as_ref()],
        bump = token_state.mint_bump,
    )]
    pub mint: Account<'info, Mint>,

    #[account(
        seeds = [b"mint-authority", mint.key().as_ref()],
        bump = token_state.authority_bump,
    )]
    pub mint_authority: UncheckedAccount<'info>,

    #[account(
        mut,
        seeds = [b"token-vault", mint.key().as_ref()],
        bump = token_state.vault_bump,
    )]
    pub token_vault: Account<'info, TokenAccount>,

    #[account(
        init_if_needed,
        payer = buyer,
        associated_token::mint = mint,
        associated_token::authority = buyer,
    )]
    pub buyer_token_account: Account<'info, TokenAccount>,

    #[account(
        init_if_needed,
        payer = buyer,
        space = 8 + BuyerState::INIT_SPACE,
        seeds = [b"buyer-state", buyer.key().as_ref(), mint.key().as_ref()],
        bump
    )]
    pub buyer_state: Account<'info, BuyerState>,

    #[account(mut)]
    pub creator: SystemAccount<'info>,

    /// CHECK: Platform fee vault
    #[account(
        mut,
        seeds = [b"platform-fee-vault"],
        bump
    )]
    pub platform_fee_vault: UncheckedAccount<'info>,

    /// CHECK: Optional referrer
    pub referrer: Option<UncheckedAccount<'info>>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct SellTokens<'info> {
    #[account(mut)]
    pub seller: Signer<'info>,

    #[account(
        mut,
        seeds = [b"token-state", token_state.creator.as_ref(), &token_state.token_seed.to_le_bytes()],
        bump = token_state.bump,
    )]
    pub token_state: Account<'info, TokenState>,

    #[account(
        mut,
        seeds = [b"token-mint", token_state.key().as_ref()],
        bump = token_state.mint_bump,
    )]
    pub mint: Account<'info, Mint>,

    #[account(
        seeds = [b"mint-authority", mint.key().as_ref()],
        bump = token_state.authority_bump,
    )]
    pub mint_authority: UncheckedAccount<'info>,

    #[account(
        mut,
        seeds = [b"token-vault", mint.key().as_ref()],
        bump = token_state.vault_bump,
    )]
    pub token_vault: Account<'info, TokenAccount>,

    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = seller,
    )]
    pub seller_token_account: Account<'info, TokenAccount>,

    /// CHECK: Platform fee vault
    #[account(
        mut,
        seeds = [b"platform-fee-vault"],
        bump
    )]
    pub platform_fee_vault: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct SetLiveOracle<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,

    #[account(
        mut,
        seeds = [b"token-state", creator.key().as_ref(), &token_state.token_seed.to_le_bytes()],
        bump = token_state.bump,
        constraint = token_state.creator == creator.key() @ CreatorCoinError::NotCreator,
    )]
    pub token_state: Account<'info, TokenState>,

    pub mint: Account<'info, Mint>,
}

// ── Module ──────────────────────────────────────────────────────────────────

declare_id!("DFCCrTn111111111111111111111111111111111111");

#[program]
pub mod degenfeed_creator_token {
    use super::*;

    /// Create a new creator coin with bonding curve.
    pub fn create_token(
        ctx: Context<CreateToken>,
        token_seed: u64,
        name: String,
        symbol: String,
        uri: String,
        creator_allocation_bps: u16,
        creator_fee_bps: u16,
        referrer: Option<Pubkey>,
    ) -> Result<()> {
        require!(name.len() <= 32, CreatorCoinError::NameTooLong);
        require!(symbol.len() <= 10, CreatorCoinError::SymbolTooLong);
        require!(creator_allocation_bps <= MAX_CREATOR_ALLOCATION_BPS, CreatorCoinError::InvalidFeeConfig);
        require!(creator_fee_bps <= MAX_CREATOR_FEE_BPS, CreatorCoinError::InvalidFeeConfig);

        let clock = Clock::get()?;
        let token_state = &mut ctx.accounts.token_state;

        token_state.creator = ctx.accounts.creator.key();
        token_state.mint = ctx.accounts.mint.key();
        token_state.token_seed = token_seed;
        token_state.name = name;
        token_state.symbol = symbol;
        token_state.uri = uri;
        token_state.created_at = clock.unix_timestamp;
        token_state.creator_allocation_bps = creator_allocation_bps;
        token_state.creator_fee_bps = creator_fee_bps;
        token_state.platform_fee_bps = 50; // 0.5%
        token_state.referrer = referrer;
        token_state.total_supply_issued = 0;
        token_state.total_sol_raised = 0;
        token_state.unique_buyers = 0;
        token_state.graduated = false;
        token_state.bump = ctx.bumps.token_state;
        token_state.mint_bump = ctx.bumps.mint;
        token_state.vault_bump = ctx.bumps.token_vault;
        token_state.authority_bump = ctx.bumps.mint_authority;
        token_state.live_oracle = None;
        token_state.cross_chain_bridge = None;
        token_state.wrapped_mint = None;
        token_state.creator_key_bytes = [0u8; 32];

        // Initialize vesting vault
        let vesting = &mut ctx.accounts.vesting_vault;
        vesting.token_mint = ctx.accounts.mint.key();
        vesting.creator = ctx.accounts.creator.key();
        vesting.total_allocated = 0;
        vesting.total_claimed = 0;
        vesting.vesting_start = clock.unix_timestamp;
        vesting.cliff_duration = 30 * 86_400; // 30 days
        vesting.vesting_duration = 365 * 86_400; // 1 year
        vesting.initial_unlock_bps = 1000; // 10% initial
        vesting.bump = ctx.bumps.vesting_vault;

        emit!(TokenCreated {
            creator: ctx.accounts.creator.key(),
            mint: ctx.accounts.mint.key(),
            name: token_state.name.clone(),
            symbol: token_state.symbol.clone(),
            creator_allocation_bps,
            creator_fee_bps,
            timestamp: clock.unix_timestamp,
        });

        Ok(())
    }

    /// Buy tokens from the bonding curve.
    pub fn buy_tokens(ctx: Context<BuyTokens>, amount_sol: u64, min_tokens_out: u64) -> Result<()> {
        require!(amount_sol > 0, CreatorCoinError::ZeroAmount);
        require!(!ctx.accounts.token_state.graduated, CreatorCoinError::AlreadyGraduated);

        let token_state = &mut ctx.accounts.token_state;
        let clock = Clock::get()?;

        // Phase limit check
        let elapsed = clock.unix_timestamp - token_state.created_at;
        let max_bps = if elapsed < 60 { 100 }
            else if elapsed < 300 { 200 }
            else if elapsed < 1800 { 500 }
            else if elapsed < 86400 { 1000 }
            else { 1500 };

        let price = get_dynamic_price(token_state.total_supply_issued);
        let implied_tokens = amount_sol
            .checked_mul(PRICE_DECIMALS)
            .ok_or(CreatorCoinError::Overflow)?
            .checked_div(price)
            .ok_or(CreatorCoinError::Overflow)?;

        require!(
            implied_tokens <= (GRADUATION_SUPPLY as u128)
                .checked_mul(max_bps as u128)
                .ok_or(CreatorCoinError::Overflow)?
                .checked_div(10000)
                .ok_or(CreatorCoinError::Overflow)? as u64,
            CreatorCoinError::PhaseLimitExceeded
        );

        // Cooldown
        let cooldown = if elapsed < 3600 { 60 } else if elapsed < 86400 { 30 } else { 0 };
        let buyer_state = &mut ctx.accounts.buyer_state;
        if cooldown > 0 && clock.unix_timestamp < buyer_state.last_buy + cooldown {
            return Err(CreatorCoinError::CooldownActive.into());
        }

        // Calculate tokens out
        let tokens_out = implied_tokens;
        require!(tokens_out >= min_tokens_out, CreatorCoinError::SlippageExceeded);

        // Max holder check (15%)
        let buyer_balance = ctx.accounts.buyer_token_account.amount;
        let max_hold = (TOTAL_SUPPLY as u128)
            .checked_mul(1500)
            .ok_or(CreatorCoinError::Overflow)?
            .checked_div(10000)
            .ok_or(CreatorCoinError::Overflow)? as u64;

        require!(
            buyer_balance.checked_add(tokens_out).ok_or(CreatorCoinError::Overflow)? <= max_hold,
            CreatorCoinError::MaxHolderExceeded
        );

        // Total supply check
        let new_supply = token_state.total_supply_issued
            .checked_add(tokens_out)
            .ok_or(CreatorCoinError::Overflow)?;
        require!(new_supply <= GRADUATION_SUPPLY, CreatorCoinError::ExceedsTotalSupply);

        // Fee calculation
        let platform_fee = (amount_sol as u128)
            .checked_mul(token_state.platform_fee_bps as u128)
            .ok_or(CreatorCoinError::Overflow)?
            .checked_div(10000)
            .ok_or(CreatorCoinError::Overflow)? as u64;

        let creator_fee = (amount_sol as u128)
            .checked_mul(token_state.creator_fee_bps as u128)
            .ok_or(CreatorCoinError::Overflow)?
            .checked_div(10000)
            .ok_or(CreatorCoinError::Overflow)? as u64;

        let total_fees = platform_fee.checked_add(creator_fee).ok_or(CreatorCoinError::Overflow)?;
        let net_proceeds = amount_sol.checked_sub(total_fees).ok_or(CreatorCoinError::Overflow)?;

        // ── CPI Calls ──────────────────────────────────────────────────

        // Mint tokens to buyer
        let mint_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            MintTo {
                mint: ctx.accounts.mint.to_account_info(),
                to: ctx.accounts.buyer_token_account.to_account_info(),
                authority: ctx.accounts.mint_authority.to_account_info(),
            },
            &[&[
                b"mint-authority",
                ctx.accounts.mint.key().as_ref(),
                &[ctx.accounts.token_state.authority_bump],
            ]],
        );
        token::mint(mint_ctx, tokens_out)?;

        // Transfer SOL fees to platform vault
        if platform_fee > 0 {
            transfer_lamports(
                &ctx.accounts.buyer.to_account_info(),
                &ctx.accounts.platform_fee_vault.to_account_info(),
                platform_fee,
            )?;
        }

        // Transfer creator fee
        if creator_fee > 0 {
            transfer_lamports(
                &ctx.accounts.buyer.to_account_info(),
                &ctx.accounts.creator.to_account_info(),
                creator_fee,
            )?;
        }

        // ── State Updates ──────────────────────────────────────────────
        token_state.total_supply_issued = new_supply;
        token_state.total_sol_raised = token_state.total_sol_raised
            .checked_add(net_proceeds)
            .ok_or(CreatorCoinError::Overflow)?;

        if buyer_balance == 0 {
            token_state.unique_buyers = token_state.unique_buyers.checked_add(1).ok_or(CreatorCoinError::Overflow)?;
        }

        buyer_state.buyer = ctx.accounts.buyer.key();
        buyer_state.token_mint = ctx.accounts.mint.key();
        buyer_state.total_bought = buyer_state.total_bought.checked_add(tokens_out).ok_or(CreatorCoinError::Overflow)?;
        buyer_state.total_sol_spent = buyer_state.total_sol_spent.checked_add(amount_sol).ok_or(CreatorCoinError::Overflow)?;
        buyer_state.last_buy = clock.unix_timestamp;
        buyer_state.buy_count = buyer_state.buy_count.checked_add(1).ok_or(CreatorCoinError::Overflow)?;

        // ── Graduation Check ───────────────────────────────────────────
        if new_supply >= GRADUATION_SUPPLY && token_state.unique_buyers >= 50 {
            token_state.graduated = true;
            msg!("Token graduated! Supply: {}, Unique buyers: {}", new_supply, token_state.unique_buyers);
        }

        emit!(TokensBought {
            buyer: ctx.accounts.buyer.key(),
            mint: ctx.accounts.mint.key(),
            amount_sol_net: net_proceeds,
            amount_sol_gross: amount_sol,
            tokens_out,
            price,
            platform_fee,
            creator_fee,
            referral_fee: 0,
            timestamp: clock.unix_timestamp,
        });

        Ok(())
    }

    /// Sell tokens back to the bonding curve.
    pub fn sell_tokens(ctx: Context<SellTokens>, amount_tokens: u64) -> Result<()> {
        require!(amount_tokens > 0, CreatorCoinError::ZeroAmount);
        require!(!ctx.accounts.token_state.graduated, CreatorCoinError::AlreadyGraduated);

        let token_state = &mut ctx.accounts.token_state;
        let clock = Clock::get()?;

        // Calculate SOL out from bonding curve
        let price = get_dynamic_price(token_state.total_supply_issued);
        let gross_sol = (amount_tokens as u128)
            .checked_mul(price as u128)
            .ok_or(CreatorCoinError::Overflow)?
            .checked_div(PRICE_DECIMALS as u128)
            .ok_or(CreatorCoinError::Overflow)? as u64;

        let platform_fee = (gross_sol as u128)
            .checked_mul(token_state.platform_fee_bps as u128)
            .ok_or(CreatorCoinError::Overflow)?
            .checked_div(10000)
            .ok_or(CreatorCoinError::Overflow)? as u64;

        let creator_fee = (gross_sol as u128)
            .checked_mul(token_state.creator_fee_bps as u128)
            .ok_or(CreatorCoinError::Overflow)?
            .checked_div(10000)
            .ok_or(CreatorCoinError::Overflow)? as u64;

        let total_fees = platform_fee.checked_add(creator_fee).ok_or(CreatorCoinError::Overflow)?;
        let net_sol = gross_sol.checked_sub(total_fees).ok_or(CreatorCoinError::Overflow)?;

        // ── CPI: Burn tokens ────────────────────────────────────────────
        let burn_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Burn {
                mint: ctx.accounts.mint.to_account_info(),
                from: ctx.accounts.seller_token_account.to_account_info(),
                authority: ctx.accounts.seller.to_account_info(),
            },
        );
        token::burn(burn_ctx, amount_tokens)?;

        // ── Transfer SOL ────────────────────────────────────────────────
        // Transfer from token vault to seller (net)
        transfer_lamports_from_vault(
            &ctx.accounts.token_vault.to_account_info(),
            &ctx.accounts.seller.to_account_info(),
            net_sol,
        )?;

        // Transfer fees
        if platform_fee > 0 {
            transfer_lamports_from_vault(
                &ctx.accounts.token_vault.to_account_info(),
                &ctx.accounts.platform_fee_vault.to_account_info(),
                platform_fee,
            )?;
        }

        // ── State Updates ──────────────────────────────────────────────
        token_state.total_supply_issued = token_state.total_supply_issued
            .checked_sub(amount_tokens)
            .ok_or(CreatorCoinError::Overflow)?;
        token_state.total_sol_raised = token_state.total_sol_raised
            .checked_sub(gross_sol)
            .ok_or(CreatorCoinError::Overflow)?;

        Ok(())
    }

    /// Set live stream oracle for live boost functionality.
    pub fn set_live_oracle(
        ctx: Context<SetLiveOracle>,
        oracle_address: Pubkey,
        creator_key_bytes: [u8; 32],
    ) -> Result<()> {
        let token_state = &mut ctx.accounts.token_state;
        token_state.live_oracle = Some(oracle_address);
        token_state.creator_key_bytes = creator_key_bytes;

        emit!(LiveOracleSet {
            mint: ctx.accounts.mint.key(),
            oracle: oracle_address,
        });

        Ok(())
    }

    /// Cross-chain burn (bridge to Base).
    pub fn burn_for_bridge(ctx: Context<SellTokens>, amount_tokens: u64) -> Result<()> {
        require!(amount_tokens > 0, CreatorCoinError::ZeroAmount);

        // Burn tokens (same as sell but without paying out SOL)
        let burn_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Burn {
                mint: ctx.accounts.mint.to_account_info(),
                from: ctx.accounts.seller_token_account.to_account_info(),
                authority: ctx.accounts.seller.to_account_info(),
            },
        );
        token::burn(burn_ctx, amount_tokens)?;

        emit!(BridgedToEVM {
            mint: ctx.accounts.mint.key(),
            burner: ctx.accounts.seller.key(),
            amount: amount_tokens,
            timestamp: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }
}

// ─── Bonding Curve Math ──────────────────────────────────────────────────────

/// Get the dynamic price using the 5-era super-linear curve.
fn get_dynamic_price(supply: u64) -> u64 {
    if supply >= GRADUATION_SUPPLY {
        return MAX_PRICE;
    }

    // Linear progress (0 to 1e4 fixed-point)
    let progress = (supply as u128)
        .checked_mul(10000)
        .unwrap()
        .checked_div(GRADUATION_SUPPLY as u128)
        .unwrap() as u64;

    // Linear baseline price
    let linear_price = MIN_PRICE as u128
        + ((MAX_PRICE as u128 - MIN_PRICE as u128) * progress as u128) / 10000;

    // Era parameters (simplified on-chain version)
    let (era_start, era_end, era_mul) = get_era(progress);

    if era_mul == 10000 {
        return linear_price as u64;
    }

    let era_range = era_end.saturating_sub(era_start);
    let era_progress = if era_range > 0 {
        ((progress.saturating_sub(era_start)) as u128 * 10000) / era_range as u128
    } else {
        10000
    };

    let era_progress_sq = (era_progress * era_progress) / 10000;
    let boost = 10000u128 + ((era_mul as u128 - 10000) * era_progress_sq) / 10000;
    let dynamic_price = (linear_price * boost) / 10000;

    if dynamic_price > MAX_PRICE as u128 { MAX_PRICE }
    else if dynamic_price < MIN_PRICE as u128 { MIN_PRICE }
    else { dynamic_price as u64 }
}

fn get_era(progress: u64) -> (u64, u64, u64) {
    const ERA_0_END: u64 = 500;
    const ERA_1_END: u64 = 1500;
    const ERA_2_END: u64 = 4000;
    const ERA_3_END: u64 = 7000;
    const ERA_4_END: u64 = 10000;

    if progress <= ERA_0_END { (0, ERA_0_END, 30000) }
    else if progress <= ERA_1_END { (ERA_0_END, ERA_1_END, 18000) }
    else if progress <= ERA_2_END { (ERA_1_END, ERA_2_END, 10000) }
    else if progress <= ERA_3_END { (ERA_2_END, ERA_3_END, 15000) }
    else { (ERA_3_END, ERA_4_END, 22000) }
}

// ─── Helper ──────────────────────────────────────────────────────────────────

/// Transfer lamports from signer to recipient.
fn transfer_lamports(from: &AccountInfo, to: &AccountInfo, amount: u64) -> Result<()> {
    **from.try_borrow_mut_lamports()? = from
        .lamports()
        .checked_sub(amount)
        .ok_or(CreatorCoinError::Overflow)?;
    **to.try_borrow_mut_lamports()? = to
        .lamports()
        .checked_add(amount)
        .ok_or(CreatorCoinError::Overflow)?;
    Ok(())
}

/// Transfer lamports from vault PDA (requires no signature for PDA).
fn transfer_lamports_from_vault(from: &AccountInfo, to: &AccountInfo, amount: u64) -> Result<()> {
    let from_lamports = from.lamports();
    let from_min_balance = Rent::get()?.minimum_balance(0);

    require!(
        from_lamports.saturating_sub(amount) >= from_min_balance,
        CreatorCoinError::InsufficientBalance
    );

    **from.try_borrow_mut_lamports()? = from_lamports
        .checked_sub(amount)
        .ok_or(CreatorCoinError::Overflow)?;
    **to.try_borrow_mut_lamports()? = to
        .lamports()
        .checked_add(amount)
        .ok_or(CreatorCoinError::Overflow)?;
    Ok(())
}

// ── Events ──────────────────────────────────────────────────────────────────

#[event]
pub struct TokenCreated {
    pub creator: Pubkey,
    pub mint: Pubkey,
    pub name: String,
    pub symbol: String,
    pub creator_allocation_bps: u16,
    pub creator_fee_bps: u16,
    pub timestamp: i64,
}

#[event]
pub struct TokensBought {
    pub buyer: Pubkey,
    pub mint: Pubkey,
    pub amount_sol_net: u64,
    pub amount_sol_gross: u64,
    pub tokens_out: u64,
    pub price: u64,
    pub platform_fee: u64,
    pub creator_fee: u64,
    pub referral_fee: u64,
    pub timestamp: i64,
}

#[event]
pub struct LiveOracleSet {
    pub mint: Pubkey,
    pub oracle: Pubkey,
}

#[event]
pub struct BridgedToEVM {
    pub mint: Pubkey,
    pub burner: Pubkey,
    pub amount: u64,
    pub timestamp: i64,
}
