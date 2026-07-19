#![deny(unused_must_use)]

use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{self, Burn, Mint, MintTo, Token, TokenAccount},
};

mod bonding_curve;
mod constants;
mod error;
mod events;
mod state;

use bonding_curve::*;
pub use constants::*;
pub use error::CreatorTokenError;
pub use events::*;
pub use state::*;

declare_id!("DFCCrTn111111111111111111111111111111111111");

// ─── Program ────────────────────────────────────────────────────────────────

/// DegenFeed Creator Token Program
///
/// A Solana Anchor program for launching creator tokens with a bonding curve,
/// similar to Zora/Base creator coins but native to Solana SPL.
///
/// ## Features
/// - Bonding curve: linear price discovery from MIN_PRICE to MAX_PRICE
/// - Anti-snipe: phased purchase limits (2% → 5% → 10% → 15%)
/// - Anti-bot: 60-second cooldown between buys per wallet
/// - Anti-whale: max 15% holder cap
/// - Creator vested allocation: up to 15%, linear vesting over 180 days
/// - Creator fees: up to 2% on buys
/// - Platform fee: 0.5% on buys and sells
/// - Referral system: 0.05% to referrer
/// - Graduation: automatic when 80% supply + 50 unique buyers
/// - Revenue split: creator can set up to 10 fee recipients
#[program]
pub mod degenfeed_creator_token {
    use super::*;

    /// ── Create Token ───────────────────────────────────────────────────
    ///
    /// Creates a new creator token with bonding curve.
    ///
    /// # Arguments
    /// * `token_seed` - Unique u64 seed for this creator's token (for PDA derivation)
    /// * `name` - Token name (max 32 chars)
    /// * `symbol` - Token symbol (max 10 chars)
    /// * `uri` - Metadata URI (max 200 chars)
    /// * `creator_allocation_bps` - Creator allocation in bps (0-1500 = 0-15%)
    /// * `creator_fee_bps` - Creator fee on buys in bps (0-200 = 0-2%)
    /// * `referrer` - Optional referrer address
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
        // ── Validate inputs ────────────────────────────────────────
        require!(
            name.len() <= MAX_NAME_LENGTH,
            CreatorTokenError::NameTooLong
        );
        require!(
            symbol.len() <= MAX_SYMBOL_LENGTH,
            CreatorTokenError::SymbolTooLong
        );
        require!(uri.len() <= MAX_URI_LENGTH, CreatorTokenError::UriTooLong);
        require!(
            creator_allocation_bps <= MAX_CREATOR_ALLOCATION_BPS,
            CreatorTokenError::CreatorAllocationTooHigh
        );
        require!(
            creator_fee_bps <= MAX_CREATOR_FEE_BPS,
            CreatorTokenError::CreatorFeeTooHigh
        );
        if let Some(ref_addr) = referrer {
            require!(
                ref_addr != ctx.accounts.creator.key(),
                CreatorTokenError::ReferrerIsCreator
            );
        }

        let clock = Clock::get()?;
        let token_state = &mut ctx.accounts.token_state;

        // ── Initialize state ───────────────────────────────────────
        token_state.creator = ctx.accounts.creator.key();
        token_state.mint = ctx.accounts.mint.key();
        token_state.token_seed = token_seed;
        token_state.name = name.clone();
        token_state.symbol = symbol.clone();
        token_state.uri = uri.clone();
        token_state.created_at = clock.unix_timestamp;
        token_state.creator_allocation_bps = creator_allocation_bps;
        token_state.creator_fee_bps = creator_fee_bps;
        token_state.platform_fee_bps = PLATFORM_FEE_BPS;
        token_state.referrer = referrer;
        token_state.total_supply_issued = 0;
        token_state.total_sol_raised = 0;
        token_state.unique_buyers = 0;
        token_state.graduated = false;
        token_state.bump = ctx.bumps.token_state;
        token_state.mint_bump = ctx.bumps.mint;
        token_state.vault_bump = ctx.bumps.token_vault;
        token_state.authority_bump = ctx.bumps.mint_authority;

        // ── Mint creator allocation to vesting vault (if any) ─────
        if creator_allocation_bps > 0 {
            let allocation_amount = token_state.creator_allocation_amount()?;

            let vesting_vault = &mut ctx.accounts.vesting_vault;
            vesting_vault.token_mint = ctx.accounts.mint.key();
            vesting_vault.creator = ctx.accounts.creator.key();
            vesting_vault.total_allocated = allocation_amount;
            vesting_vault.total_claimed = 0;
            vesting_vault.vesting_start = clock.unix_timestamp;
            vesting_vault.vesting_end = clock
                .unix_timestamp
                .checked_add(VESTING_PERIOD_SECONDS)
                .ok_or(error!(CreatorTokenError::MathOverflow))?;
            vesting_vault.bump = ctx.bumps.vesting_vault;

            // Mint allocation to vesting vault token account
            let authority_bump = ctx.bumps.mint_authority;
            let mint_key = ctx.accounts.mint.to_account_info().key;
            let mint_seeds = &[SEED_MINT_AUTHORITY, mint_key.as_ref(), &[authority_bump]];
            let signer_seeds = &[&mint_seeds[..]];

            token::mint_to(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    MintTo {
                        mint: ctx.accounts.mint.to_account_info(),
                        to: ctx.accounts.vesting_vault_token_account.to_account_info(),
                        authority: ctx.accounts.mint_authority.to_account_info(),
                    },
                    signer_seeds,
                ),
                allocation_amount,
            )?;
        }

        // ── Emit event ─────────────────────────────────────────────
        emit!(TokenCreated {
            creator: ctx.accounts.creator.key(),
            mint: ctx.accounts.mint.key(),
            name,
            symbol,
            creator_allocation_bps,
            creator_fee_bps,
            timestamp: clock.unix_timestamp,
        });

        Ok(())
    }

    // ── Buy Tokens ─────────────────────────────────────────────────────
    ///
    /// Buy tokens with SOL via the bonding curve.
    ///
    /// # Arguments
    /// * `amount_sol` - Amount of SOL to spend (in lamports)
    /// * `min_tokens_out` - Minimum tokens to receive (slippage protection)
    pub fn buy_tokens(ctx: Context<BuyTokens>, amount_sol: u64, min_tokens_out: u64) -> Result<()> {
        let clock = Clock::get()?;

        // ── Pre-checks (before mutable borrow) ─────────────────────
        let token_state_data = &ctx.accounts.token_state;
        require!(
            !token_state_data.graduated,
            CreatorTokenError::AlreadyGraduated
        );
        require!(amount_sol > 0, CreatorTokenError::ZeroAmount);
        require!(
            token_state_data.total_supply_issued < GRADUATION_SUPPLY,
            CreatorTokenError::AlreadyGraduated
        );

        let elapsed = clock
            .unix_timestamp
            .checked_sub(token_state_data.created_at)
            .ok_or(error!(CreatorTokenError::MathOverflow))?;
        let phase_max_buy = get_phase_max_buy(elapsed)?;
        require!(
            amount_sol <= phase_max_buy,
            CreatorTokenError::PhaseLimitExceeded
        );

        let current_price = get_current_price(token_state_data.total_supply_issued)?;
        let tokens_out = calculate_tokens_out(amount_sol, current_price)?;
        require!(
            tokens_out >= min_tokens_out,
            CreatorTokenError::SlippageExceeded
        );
        require!(tokens_out > 0, CreatorTokenError::ZeroAmount);

        let max_holder = get_max_holder_amount();
        let new_balance = ctx
            .accounts
            .buyer_token_account
            .amount
            .checked_add(tokens_out)
            .ok_or(error!(CreatorTokenError::MathOverflow))?;
        require!(
            new_balance <= max_holder,
            CreatorTokenError::MaxHolderExceeded
        );

        // Cooldown check
        if ctx.accounts.buyer_state.last_buy > 0 {
            let time_since_last_buy = clock
                .unix_timestamp
                .checked_sub(ctx.accounts.buyer_state.last_buy)
                .ok_or(error!(CreatorTokenError::MathOverflow))?;
            require!(
                time_since_last_buy >= BUY_COOLDOWN_SECONDS,
                CreatorTokenError::CooldownActive
            );
        }

        // ── Fee calculation ────────────────────────────────────────
        let platform_fee_bps = token_state_data.platform_fee_bps;
        let creator_fee_bps = token_state_data.creator_fee_bps;
        let has_referrer = token_state_data.referrer.is_some()
            && ctx.accounts.referrer.key() != Pubkey::default()
            && ctx.accounts.referrer.key() == token_state_data.referrer.unwrap();

        let platform_fee = (amount_sol as u128)
            .checked_mul(platform_fee_bps as u128)
            .ok_or(error!(CreatorTokenError::MathOverflow))?
            .checked_div(10_000u128)
            .ok_or(error!(CreatorTokenError::MathOverflow))? as u64;

        let creator_fee = (amount_sol as u128)
            .checked_mul(creator_fee_bps as u128)
            .ok_or(error!(CreatorTokenError::MathOverflow))?
            .checked_div(10_000u128)
            .ok_or(error!(CreatorTokenError::MathOverflow))? as u64;

        let referral_fee = if has_referrer {
            (amount_sol as u128)
                .checked_mul(REFERRAL_FEE_BPS as u128)
                .ok_or(error!(CreatorTokenError::MathOverflow))?
                .checked_div(10_000u128)
                .ok_or(error!(CreatorTokenError::MathOverflow))? as u64
        } else {
            0
        };

        let total_fees = platform_fee
            .checked_add(creator_fee)
            .ok_or(error!(CreatorTokenError::MathOverflow))?
            .checked_add(referral_fee)
            .ok_or(error!(CreatorTokenError::MathOverflow))?;

        let sol_to_vault = amount_sol
            .checked_sub(total_fees)
            .ok_or(error!(CreatorTokenError::MathOverflow))?;

        // Extract bump values before mutable borrow
        let authority_bump = ctx.accounts.token_state.authority_bump;

        // ── Now do mutable borrows ─────────────────────────────────
        let token_state = &mut ctx.accounts.token_state;

        // Transfer SOL from buyer to vault (net of fees)
        let buyer_info = ctx.accounts.buyer.to_account_info();
        let vault_info = ctx.accounts.token_vault.to_account_info();
        let platform_info = ctx.accounts.platform_fee_vault.to_account_info();
        let creator_info = ctx.accounts.creator.to_account_info();

        **buyer_info.try_borrow_mut_lamports()? = buyer_info
            .lamports()
            .checked_sub(amount_sol)
            .ok_or(error!(CreatorTokenError::MathOverflow))?;
        **vault_info.try_borrow_mut_lamports()? = vault_info
            .lamports()
            .checked_add(sol_to_vault)
            .ok_or(error!(CreatorTokenError::MathOverflow))?;

        if platform_fee > 0 {
            **platform_info.try_borrow_mut_lamports()? = platform_info
                .lamports()
                .checked_add(platform_fee)
                .ok_or(error!(CreatorTokenError::MathOverflow))?;
        }

        if creator_fee > 0 {
            **creator_info.try_borrow_mut_lamports()? = creator_info
                .lamports()
                .checked_add(creator_fee)
                .ok_or(error!(CreatorTokenError::MathOverflow))?;
        }

        if referral_fee > 0 && has_referrer {
            let ref_info = ctx.accounts.referrer.to_account_info();
            **ref_info.try_borrow_mut_lamports()? =
                ref_info
                    .lamports()
                    .checked_add(referral_fee)
                    .ok_or(error!(CreatorTokenError::MathOverflow))?;
        }

        // ── Mint tokens ───────────────────────────────────────────
        let mint_seeds = &[
            SEED_MINT_AUTHORITY,
            ctx.accounts.mint.to_account_info().key.as_ref(),
            &[authority_bump],
        ];
        let signer_seeds = &[&mint_seeds[..]];

        token::mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                MintTo {
                    mint: ctx.accounts.mint.to_account_info(),
                    to: ctx.accounts.buyer_token_account.to_account_info(),
                    authority: ctx.accounts.mint_authority.to_account_info(),
                },
                signer_seeds,
            ),
            tokens_out,
        )?;

        // ── Update state ──────────────────────────────────────────
        token_state.total_supply_issued = token_state
            .total_supply_issued
            .checked_add(tokens_out)
            .ok_or(error!(CreatorTokenError::MathOverflow))?;
        token_state.total_sol_raised = token_state
            .total_sol_raised
            .checked_add(sol_to_vault)
            .ok_or(error!(CreatorTokenError::MathOverflow))?;

        let buyer_state = &mut ctx.accounts.buyer_state;
        if buyer_state.total_bought == 0 {
            token_state.unique_buyers = token_state
                .unique_buyers
                .checked_add(1)
                .ok_or(error!(CreatorTokenError::MathOverflow))?;
        }
        buyer_state.buyer = ctx.accounts.buyer.key();
        buyer_state.token_mint = ctx.accounts.mint.key();
        buyer_state.total_bought = buyer_state
            .total_bought
            .checked_add(tokens_out)
            .ok_or(error!(CreatorTokenError::MathOverflow))?;
        buyer_state.total_sol_spent = buyer_state
            .total_sol_spent
            .checked_add(amount_sol)
            .ok_or(error!(CreatorTokenError::MathOverflow))?;
        buyer_state.last_buy = clock.unix_timestamp;
        buyer_state.buy_count = buyer_state
            .buy_count
            .checked_add(1)
            .ok_or(error!(CreatorTokenError::MathOverflow))?;

        // ── Emit event ────────────────────────────────────────────
        emit!(TokensBought {
            buyer: ctx.accounts.buyer.key(),
            mint: ctx.accounts.mint.key(),
            amount_sol_net: sol_to_vault,
            amount_sol_gross: amount_sol,
            tokens_out,
            price: current_price,
            platform_fee,
            creator_fee,
            referral_fee,
            timestamp: clock.unix_timestamp,
        });

        Ok(())
    }

    // ── Sell Tokens ────────────────────────────────────────────────────
    ///
    /// Sell tokens back to the bonding curve for SOL.
    ///
    /// # Arguments
    /// * `amount_tokens` - Amount of tokens to sell (9 decimal precision)
    pub fn sell_tokens(ctx: Context<SellTokens>, amount_tokens: u64) -> Result<()> {
        let clock = Clock::get()?;

        // ── Pre-checks (before mutable borrow) ─────────────────────
        let token_state_data = &ctx.accounts.token_state;
        require!(
            !token_state_data.graduated,
            CreatorTokenError::AlreadyGraduated
        );
        require!(amount_tokens > 0, CreatorTokenError::ZeroAmount);

        let seller_token_balance = ctx.accounts.seller_token_account.amount;
        require!(
            seller_token_balance >= amount_tokens,
            CreatorTokenError::InsufficientTokens
        );

        // Calculate using data before graduation — use price at supply - 1 for sell side
        let adjusted_supply = token_state_data
            .total_supply_issued
            .checked_sub(1)
            .unwrap_or(0);
        let current_price = get_current_price(adjusted_supply)?;
        let (sol_out, platform_fee) = calculate_sol_out(amount_tokens, current_price)?;

        let vault_lamports = ctx.accounts.token_vault.lamports();
        require!(
            vault_lamports >= sol_out,
            CreatorTokenError::InsufficientVaultBalance
        );

        // Prevent dust: if remaining vault balance < rent exemption, only allow if 0
        let remaining = vault_lamports
            .checked_sub(sol_out)
            .ok_or(error!(CreatorTokenError::MathOverflow))?;
        let min_rent = Rent::get()?.minimum_balance(state::TokenState::LEN);
        require!(
            remaining >= min_rent || remaining == 0,
            CreatorTokenError::DustBalance
        );

        // ── Transfer SOL from vault to seller ──────────────────────
        let vault_info = ctx.accounts.token_vault.to_account_info();
        let seller_info = ctx.accounts.seller.to_account_info();
        let platform_info = ctx.accounts.platform_fee_vault.to_account_info();

        **vault_info.try_borrow_mut_lamports()? = vault_info
            .lamports()
            .checked_sub(sol_out)
            .ok_or(error!(CreatorTokenError::MathOverflow))?
            .checked_sub(platform_fee)
            .ok_or(error!(CreatorTokenError::MathOverflow))?;

        **seller_info.try_borrow_mut_lamports()? = seller_info
            .lamports()
            .checked_add(sol_out)
            .ok_or(error!(CreatorTokenError::MathOverflow))?;

        if platform_fee > 0 {
            **platform_info.try_borrow_mut_lamports()? = platform_info
                .lamports()
                .checked_add(platform_fee)
                .ok_or(error!(CreatorTokenError::MathOverflow))?;
        }

        // ── Burn tokens ────────────────────────────────────────────
        token::burn(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Burn {
                    mint: ctx.accounts.mint.to_account_info(),
                    from: ctx.accounts.seller_token_account.to_account_info(),
                    authority: ctx.accounts.seller.to_account_info(),
                },
            ),
            amount_tokens,
        )?;

        // ── Update state ──────────────────────────────────────────
        let token_state = &mut ctx.accounts.token_state;
        token_state.total_supply_issued = token_state
            .total_supply_issued
            .checked_sub(amount_tokens)
            .ok_or(error!(CreatorTokenError::MathOverflow))?;
        token_state.total_sol_raised = token_state
            .total_sol_raised
            .checked_sub(sol_out)
            .ok_or(error!(CreatorTokenError::MathOverflow))?;

        // ── Emit event ────────────────────────────────────────────
        emit!(TokensSold {
            seller: ctx.accounts.seller.key(),
            mint: ctx.accounts.mint.key(),
            tokens_in: amount_tokens,
            sol_out,
            price: current_price,
            platform_fee,
            timestamp: clock.unix_timestamp,
        });

        Ok(())
    }

    // ── Claim Vested ──────────────────────────────────────────────────
    pub fn claim_vested(ctx: Context<ClaimVested>) -> Result<()> {
        let clock = Clock::get()?;
        let vesting_vault = &mut ctx.accounts.vesting_vault;

        let claimable = calculate_vested_amount(
            vesting_vault.total_allocated,
            vesting_vault.total_claimed,
            vesting_vault.vesting_start,
            vesting_vault.vesting_end,
            clock.unix_timestamp,
        )?;

        require!(claimable > 0, CreatorTokenError::NoVestedTokens);

        let authority_bump = ctx.accounts.token_state.authority_bump;
        let mint_key = ctx.accounts.mint.to_account_info().key;

        let mint_seeds = &[SEED_MINT_AUTHORITY, mint_key.as_ref(), &[authority_bump]];
        let signer_seeds = &[&mint_seeds[..]];

        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                token::Transfer {
                    from: ctx.accounts.vesting_vault_token_account.to_account_info(),
                    to: ctx.accounts.creator_token_account.to_account_info(),
                    authority: ctx.accounts.mint_authority.to_account_info(),
                },
                signer_seeds,
            ),
            claimable,
        )?;

        vesting_vault.total_claimed = vesting_vault
            .total_claimed
            .checked_add(claimable)
            .ok_or(error!(CreatorTokenError::MathOverflow))?;

        emit!(VestedTokensClaimed {
            creator: ctx.accounts.creator.key(),
            mint: ctx.accounts.mint.key(),
            amount: claimable,
            timestamp: clock.unix_timestamp,
        });

        Ok(())
    }

    // ── Set Fees ──────────────────────────────────────────────────────
    pub fn set_fees(
        ctx: Context<SetFees>,
        platform_fee_bps: u16,
        creator_fee_bps: u16,
    ) -> Result<()> {
        require!(platform_fee_bps <= 100, CreatorTokenError::FeeBpsOverflow);
        require!(
            creator_fee_bps <= MAX_CREATOR_FEE_BPS,
            CreatorTokenError::CreatorFeeTooHigh
        );

        let token_state = &mut ctx.accounts.token_state;
        token_state.platform_fee_bps = platform_fee_bps;
        token_state.creator_fee_bps = creator_fee_bps;

        emit!(FeesUpdated {
            mint: ctx.accounts.mint.key(),
            platform_fee_bps,
            creator_fee_bps,
            timestamp: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }

    // ── Set Recipients ────────────────────────────────────────────────
    pub fn set_recipients(ctx: Context<SetRecipients>, recipients: Vec<Recipient>) -> Result<()> {
        require!(
            recipients.len() <= MAX_RECIPIENTS,
            CreatorTokenError::TooManyRecipients
        );

        // Validate shares sum to 10,000 bps
        let total_shares: u32 = recipients.iter().map(|r| r.share_bps as u32).sum();
        require!(
            total_shares == 10_000,
            CreatorTokenError::RecipientSharesMismatch
        );

        let recipient_state = &mut ctx.accounts.recipient_state;
        recipient_state.token_mint = ctx.accounts.mint.key();
        recipient_state.recipients = recipients.clone();

        emit!(RecipientsUpdated {
            mint: ctx.accounts.mint.key(),
            count: recipients.len() as u16,
            timestamp: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }

    // ── Graduate ──────────────────────────────────────────────────────
    pub fn graduate(ctx: Context<GraduateToken>) -> Result<()> {
        let clock = Clock::get()?;

        // Check (before mutable borrow)
        let can_grad = ctx.accounts.token_state.can_graduate();
        require!(can_grad, CreatorTokenError::NotGraduated);

        // ── Transfer remaining vault SOL to creator ────────────────
        let vault_info = ctx.accounts.token_vault.to_account_info();
        let vault_lamports = vault_info.lamports();
        let creator_info = ctx.accounts.creator.to_account_info();

        if vault_lamports > 0 {
            **vault_info.try_borrow_mut_lamports()? = 0;
            **creator_info.try_borrow_mut_lamports()? = creator_info
                .lamports()
                .checked_add(vault_lamports)
                .ok_or(error!(CreatorTokenError::MathOverflow))?;
        }

        // ── Revoke mint authority (set to None) ────────────────────
        let authority_bump = ctx.accounts.token_state.authority_bump;
        let mint_key = ctx.accounts.mint.to_account_info().key;

        let mint_seeds = &[SEED_MINT_AUTHORITY, mint_key.as_ref(), &[authority_bump]];
        let signer_seeds = &[&mint_seeds[..]];

        token::set_authority(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                token::SetAuthority {
                    account_or_mint: ctx.accounts.mint.to_account_info(),
                    current_authority: ctx.accounts.mint_authority.to_account_info(),
                },
                signer_seeds,
            ),
            anchor_spl::token::spl_token::instruction::AuthorityType::MintTokens,
            None,
        )?;

        // ── Mark graduated ─────────────────────────────────────────
        let token_state = &mut ctx.accounts.token_state;
        token_state.graduated = true;

        emit!(TokenGraduated {
            mint: ctx.accounts.mint.key(),
            supply_issued: token_state.total_supply_issued,
            total_raised: token_state.total_sol_raised,
            unique_buyers: token_state.unique_buyers,
            vault_sol_remaining: vault_lamports,
            timestamp: clock.unix_timestamp,
        });

        Ok(())
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// Account Contexts
// ═══════════════════════════════════════════════════════════════════════════

/// ── Create Token Context ──────────────────────────────────────────────
#[derive(Accounts)]
#[instruction(token_seed: u64, name: String, symbol: String)]
pub struct CreateToken<'info> {
    /// Creator wallet paying for initialization and initial rent
    #[account(mut)]
    pub creator: Signer<'info>,

    /// PDA: token state storing all metadata and state
    #[account(
        init,
        payer = creator,
        space = 8 + TokenState::INIT_SPACE,
        seeds = [SEED_TOKEN_STATE, creator.key().as_ref(), &token_seed.to_le_bytes()],
        bump
    )]
    pub token_state: Account<'info, TokenState>,

    /// PDA: the SPL token mint
    #[account(
        init,
        payer = creator,
        mint::decimals = 9,
        mint::authority = mint_authority,
        seeds = [SEED_TOKEN_MINT, token_state.key().as_ref()],
        bump
    )]
    pub mint: Account<'info, Mint>,

    /// PDA: mint authority (controls minting/burning)
    #[account(
        seeds = [SEED_MINT_AUTHORITY, mint.key().as_ref()],
        bump
    )]
    pub mint_authority: SystemAccount<'info>,

    /// PDA: SOL vault that holds buy proceeds
    #[account(
        mut,
        seeds = [SEED_TOKEN_VAULT, mint.key().as_ref()],
        bump
    )]
    pub token_vault: SystemAccount<'info>,

    /// PDA: vesting vault state (tracks creator vesting schedule)
    #[account(
        init,
        payer = creator,
        space = 8 + VestingVault::INIT_SPACE,
        seeds = [SEED_VESTING_VAULT, mint.key().as_ref()],
        bump
    )]
    pub vesting_vault: Account<'info, VestingVault>,

    /// Token account for the vesting vault (holds creator's vested allocation)
    #[account(
        init,
        payer = creator,
        associated_token::mint = mint,
        associated_token::authority = mint_authority,
    )]
    pub vesting_vault_token_account: Account<'info, TokenAccount>,

    /// Platform fee collection vault
    #[account(
        mut,
        seeds = [b"platform-fee-vault"],
        bump
    )]
    pub platform_fee_vault: SystemAccount<'info>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

/// ── Buy Tokens Context ────────────────────────────────────────────────
#[derive(Accounts)]
pub struct BuyTokens<'info> {
    /// Buyer wallet (pays SOL)
    #[account(mut)]
    pub buyer: Signer<'info>,

    /// Token state — must be a valid, non-graduated token
    #[account(
        mut,
        seeds = [SEED_TOKEN_STATE, token_state.creator.as_ref(), &token_state.token_seed.to_le_bytes()],
        bump = token_state.bump
    )]
    pub token_state: Account<'info, TokenState>,

    /// Token mint
    #[account(
        mut,
        address = token_state.mint
    )]
    pub mint: Account<'info, Mint>,

    /// Mint authority PDA
    #[account(
        mut,
        seeds = [SEED_MINT_AUTHORITY, mint.key().as_ref()],
        bump = token_state.authority_bump
    )]
    pub mint_authority: SystemAccount<'info>,

    /// SOL vault
    #[account(
        mut,
        seeds = [SEED_TOKEN_VAULT, mint.key().as_ref()],
        bump = token_state.vault_bump
    )]
    pub token_vault: SystemAccount<'info>,

    /// Buyer's token account (must hold tokens for this mint)
    #[account(
        mut,
        token::mint = mint,
        token::authority = buyer,
    )]
    pub buyer_token_account: Account<'info, TokenAccount>,

    /// Per-buyer state for this token (init if not exists)
    #[account(
        init_if_needed,
        payer = buyer,
        space = 8 + BuyerState::INIT_SPACE,
        seeds = [SEED_BUYER_STATE, buyer.key().as_ref(), mint.key().as_ref()],
        bump
    )]
    pub buyer_state: Account<'info, BuyerState>,

    /// Creator wallet (receives creator fee)
    #[account(mut, address = token_state.creator)]
    pub creator: SystemAccount<'info>,

    /// Platform fee vault
    #[account(
        mut,
        seeds = [b"platform-fee-vault"],
        bump
    )]
    pub platform_fee_vault: SystemAccount<'info>,

    /// Referrer wallet (receives referral fee).
    /// Pass Pubkey::default() if no referrer.
    /// CHECK: validated against token_state.referrer inside instruction
    pub referrer: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

/// ── Sell Tokens Context ───────────────────────────────────────────────
#[derive(Accounts)]
pub struct SellTokens<'info> {
    /// Seller wallet
    #[account(mut)]
    pub seller: Signer<'info>,

    /// Token state
    #[account(
        mut,
        seeds = [SEED_TOKEN_STATE, token_state.creator.as_ref(), &token_state.token_seed.to_le_bytes()],
        bump = token_state.bump
    )]
    pub token_state: Account<'info, TokenState>,

    /// Token mint
    #[account(
        mut,
        address = token_state.mint
    )]
    pub mint: Account<'info, Mint>,

    /// Mint authority PDA
    #[account(
        seeds = [SEED_MINT_AUTHORITY, mint.key().as_ref()],
        bump = token_state.authority_bump
    )]
    pub mint_authority: SystemAccount<'info>,

    /// SOL vault (pays out SOL to seller)
    #[account(
        mut,
        seeds = [SEED_TOKEN_VAULT, mint.key().as_ref()],
        bump = token_state.vault_bump
    )]
    pub token_vault: SystemAccount<'info>,

    /// Seller's token account (tokens to burn)
    #[account(
        mut,
        token::mint = mint,
        token::authority = seller,
    )]
    pub seller_token_account: Account<'info, TokenAccount>,

    /// Platform fee vault
    #[account(
        mut,
        seeds = [b"platform-fee-vault"],
        bump
    )]
    pub platform_fee_vault: SystemAccount<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

/// ── Claim Vested Context ──────────────────────────────────────────────
#[derive(Accounts)]
pub struct ClaimVested<'info> {
    /// Creator wallet (must be the token creator)
    #[account(mut)]
    pub creator: Signer<'info>,

    /// Token state
    #[account(
        mut,
        seeds = [SEED_TOKEN_STATE, creator.key().as_ref(), &token_state.token_seed.to_le_bytes()],
        bump = token_state.bump,
        constraint = token_state.creator == creator.key() @ CreatorTokenError::NotCreator,
    )]
    pub token_state: Account<'info, TokenState>,

    /// Token mint
    #[account(
        mut,
        address = token_state.mint
    )]
    pub mint: Account<'info, Mint>,

    /// Mint authority PDA (signs the token transfer)
    #[account(
        mut,
        seeds = [SEED_MINT_AUTHORITY, mint.key().as_ref()],
        bump = token_state.authority_bump
    )]
    pub mint_authority: SystemAccount<'info>,

    /// Vesting vault state
    #[account(
        mut,
        seeds = [SEED_VESTING_VAULT, mint.key().as_ref()],
        bump = vesting_vault.bump
    )]
    pub vesting_vault: Account<'info, VestingVault>,

    /// Token account holding the vested tokens (under mint_authority)
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = mint_authority,
    )]
    pub vesting_vault_token_account: Account<'info, TokenAccount>,

    /// Creator's target token account to receive the vested tokens
    #[account(
        mut,
        token::mint = mint,
        token::authority = creator,
    )]
    pub creator_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

/// ── Set Fees Context ──────────────────────────────────────────────────
#[derive(Accounts)]
pub struct SetFees<'info> {
    /// Creator wallet (must match token_state.creator)
    #[account(mut)]
    pub creator: Signer<'info>,

    /// Token state — validated via creator constraint
    #[account(
        mut,
        seeds = [SEED_TOKEN_STATE, creator.key().as_ref(), &token_state.token_seed.to_le_bytes()],
        bump = token_state.bump,
        constraint = token_state.creator == creator.key() @ CreatorTokenError::NotCreator,
    )]
    pub token_state: Account<'info, TokenState>,

    #[account(address = token_state.mint)]
    pub mint: Account<'info, Mint>,
}

/// ── Set Recipients Context ────────────────────────────────────────────
#[derive(Accounts)]
pub struct SetRecipients<'info> {
    /// Creator wallet
    #[account(mut)]
    pub creator: Signer<'info>,

    /// Token state
    #[account(
        mut,
        seeds = [SEED_TOKEN_STATE, creator.key().as_ref(), &token_state.token_seed.to_le_bytes()],
        bump = token_state.bump,
        constraint = token_state.creator == creator.key() @ CreatorTokenError::NotCreator,
    )]
    pub token_state: Account<'info, TokenState>,

    #[account(address = token_state.mint)]
    pub mint: Account<'info, Mint>,

    /// Recipient state PDA
    #[account(
        init_if_needed,
        payer = creator,
        space = 8 + RecipientState::INIT_SPACE,
        seeds = [SEED_RECIPIENT_STATE, mint.key().as_ref()],
        bump
    )]
    pub recipient_state: Account<'info, RecipientState>,

    pub system_program: Program<'info, System>,
}

/// ── Graduate Token Context ────────────────────────────────────────────
#[derive(Accounts)]
pub struct GraduateToken<'info> {
    /// Creator wallet
    #[account(mut)]
    pub creator: Signer<'info>,

    /// Token state
    #[account(
        mut,
        seeds = [SEED_TOKEN_STATE, creator.key().as_ref(), &token_state.token_seed.to_le_bytes()],
        bump = token_state.bump,
        constraint = token_state.creator == creator.key() @ CreatorTokenError::NotCreator,
    )]
    pub token_state: Account<'info, TokenState>,

    /// Token mint
    #[account(
        mut,
        address = token_state.mint
    )]
    pub mint: Account<'info, Mint>,

    /// Mint authority PDA (will be revoked)
    #[account(
        mut,
        seeds = [SEED_MINT_AUTHORITY, mint.key().as_ref()],
        bump = token_state.authority_bump
    )]
    pub mint_authority: SystemAccount<'info>,

    /// SOL vault (remaining balance returned to creator)
    #[account(
        mut,
        seeds = [SEED_TOKEN_VAULT, mint.key().as_ref()],
        bump = token_state.vault_bump
    )]
    pub token_vault: SystemAccount<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}
