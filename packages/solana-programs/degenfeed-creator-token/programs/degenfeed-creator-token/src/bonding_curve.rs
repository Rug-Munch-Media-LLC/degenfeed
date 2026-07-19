use crate::constants::*;
use crate::error::CreatorTokenError;
use anchor_lang::prelude::*;

/// Get the current token price based on total supply issued.
///
/// Uses a **linear bonding curve**: price increases linearly from `MIN_PRICE`
/// to `MAX_PRICE` as supply goes from 0 to `GRADUATION_SUPPLY`.
///
/// Price is in lamports per smallest token unit (1e-9 tokens with 9 decimals).
/// At graduation, 1 token = MAX_PRICE lamports.
///
/// # Formula
/// ```text
/// progress = total_supply_issued / GRADUATION_SUPPLY  (0 to 1e9 scale)
/// price    = MIN_PRICE + (MAX_PRICE - MIN_PRICE) × progress
/// ```
pub fn get_current_price(total_supply_issued: u64) -> Result<u64> {
    let supply = total_supply_issued as u128;

    // Clamp to graduation supply for calculation (price stops after graduation)
    let capped_supply = supply.min(GRADUATION_SUPPLY as u128);

    let progress = capped_supply
        .checked_mul(SCALING)
        .ok_or(error!(CreatorTokenError::MathOverflow))?
        .checked_div(GRADUATION_SUPPLY as u128)
        .ok_or(error!(CreatorTokenError::MathOverflow))?;

    let min = MIN_PRICE as u128;
    let max = MAX_PRICE as u128;
    let price_range = max
        .checked_sub(min)
        .ok_or(error!(CreatorTokenError::MathOverflow))?;

    let price = min
        .checked_add(
            price_range
                .checked_mul(progress)
                .ok_or(error!(CreatorTokenError::MathOverflow))?
                .checked_div(SCALING)
                .ok_or(error!(CreatorTokenError::MathOverflow))?,
        )
        .ok_or(error!(CreatorTokenError::MathOverflow))?;

    Ok(price as u64)
}

/// Calculate tokens received for a given SOL amount at a given price.
///
/// Uses the **current price** (not integral) for simplicity. Large buys
/// should use slippage protection via `min_tokens_out`.
///
/// # Formula
/// ```text
/// tokens_out = (amount_sol × SCALING) / price
/// ```
pub fn calculate_tokens_out(amount_sol: u64, price: u64) -> Result<u64> {
    if price == 0 {
        return Err(error!(CreatorTokenError::MathOverflow));
    }

    let tokens = (amount_sol as u128)
        .checked_mul(SCALING)
        .ok_or(error!(CreatorTokenError::MathOverflow))?
        .checked_div(price as u128)
        .ok_or(error!(CreatorTokenError::MathOverflow))?;

    Ok(tokens as u64)
}

/// Calculate SOL returned when selling tokens at current price.
/// Applies a 0.5% platform fee on the SOL returned.
pub fn calculate_sol_out(tokens_in: u64, price: u64) -> Result<(u64, u64)> {
    if price == 0 {
        return Err(error!(CreatorTokenError::MathOverflow));
    }

    let gross_sol = (tokens_in as u128)
        .checked_mul(price as u128)
        .ok_or(error!(CreatorTokenError::MathOverflow))?
        .checked_div(SCALING)
        .ok_or(error!(CreatorTokenError::MathOverflow))? as u64;

    let platform_fee = (gross_sol as u128)
        .checked_mul(PLATFORM_FEE_BPS as u128)
        .ok_or(error!(CreatorTokenError::MathOverflow))?
        .checked_div(10_000u128)
        .ok_or(error!(CreatorTokenError::MathOverflow))? as u64;

    let net_sol = gross_sol
        .checked_sub(platform_fee)
        .ok_or(error!(CreatorTokenError::MathOverflow))?;

    Ok((net_sol, platform_fee))
}

/// Get the anti-snipe phase limit based on elapsed time since creation.
///
/// Returns the maximum purchase size in bps of total supply.
///
/// | Phase | Time Window | Max Buy |
/// |-------|-------------|---------|
/// | 1     | 0-5 min     | 2%      |
/// | 2     | 5-30 min    | 5%      |
/// | 3     | 30 min-24h  | 10%     |
/// | 4     | 24h+        | 15%     |
pub fn get_phase_limit(elapsed_seconds: i64) -> u16 {
    if elapsed_seconds < PHASE_1_DURATION {
        PHASE_1_LIMIT_BPS // 2%
    } else if elapsed_seconds < PHASE_2_DURATION {
        PHASE_2_LIMIT_BPS // 5%
    } else if elapsed_seconds < PHASE_3_DURATION {
        PHASE_3_LIMIT_BPS // 10%
    } else {
        PHASE_4_LIMIT_BPS // 15%
    }
}

/// Calculate the maximum buy amount in lamports for the current phase
pub fn get_phase_max_buy(elapsed_seconds: i64) -> Result<u64> {
    let limit_bps = get_phase_limit(elapsed_seconds);
    let max_buy = (GRADUATION_SUPPLY as u128)
        .checked_mul(limit_bps as u128)
        .ok_or(error!(CreatorTokenError::MathOverflow))?
        .checked_div(10_000u128)
        .ok_or(error!(CreatorTokenError::MathOverflow))?;
    Ok(max_buy as u64)
}

/// Calculate the maximum tokens a buyer can hold (15% of total supply)
pub fn get_max_holder_amount() -> u64 {
    (TOTAL_SUPPLY as u128)
        .checked_mul(MAX_HOLDER_PCT as u128)
        .unwrap()
        .checked_div(100u128)
        .unwrap() as u64
}

/// Calculate vested amount based on linear vesting schedule
pub fn calculate_vested_amount(
    total_allocated: u64,
    total_claimed: u64,
    vesting_start: i64,
    vesting_end: i64,
    current_time: i64,
) -> Result<u64> {
    if current_time >= vesting_end {
        // Fully vested
        return total_allocated
            .checked_sub(total_claimed)
            .ok_or(error!(CreatorTokenError::NoVestedTokens));
    }

    if current_time <= vesting_start {
        // Not yet started
        return Err(error!(CreatorTokenError::VestingNotElapsed));
    }

    let elapsed = current_time
        .checked_sub(vesting_start)
        .ok_or(error!(CreatorTokenError::MathOverflow))? as u128;
    let total_duration = vesting_end
        .checked_sub(vesting_start)
        .ok_or(error!(CreatorTokenError::MathOverflow))? as u128;

    let vested = (total_allocated as u128)
        .checked_mul(elapsed)
        .ok_or(error!(CreatorTokenError::MathOverflow))?
        .checked_div(total_duration)
        .ok_or(error!(CreatorTokenError::MathOverflow))? as u64;

    vested
        .checked_sub(total_claimed)
        .ok_or(error!(CreatorTokenError::NoVestedTokens))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_price_at_zero_supply() {
        let price = get_current_price(0).unwrap();
        assert_eq!(price, MIN_PRICE);
    }

    #[test]
    fn test_price_at_graduation() {
        let price = get_current_price(GRADUATION_SUPPLY).unwrap();
        assert_eq!(price, MAX_PRICE);
    }

    #[test]
    fn test_price_midpoint() {
        let half = GRADUATION_SUPPLY / 2;
        let price = get_current_price(half).unwrap();
        let expected = MIN_PRICE + (MAX_PRICE - MIN_PRICE) / 2;
        assert_eq!(price, expected as u64);
    }

    #[test]
    fn test_price_beyond_graduation() {
        let price = get_current_price(GRADUATION_SUPPLY + 100_000).unwrap();
        // Price should be capped at MAX_PRICE
        assert_eq!(price, MAX_PRICE);
    }

    #[test]
    fn test_tokens_out_calculation() {
        let amount_sol = 1_000_000_000; // 1 SOL
        let price = 500; // 500 lamports per token unit
        let tokens = calculate_tokens_out(amount_sol, price).unwrap();
        // 1 SOL / 500 lamports per unit * 1e9 = 2,000,000 token units = 0.002 tokens
        assert_eq!(tokens, 2_000_000);
    }

    #[test]
    fn test_phase_limits() {
        assert_eq!(get_phase_limit(0), PHASE_1_LIMIT_BPS);
        assert_eq!(get_phase_limit(150), PHASE_1_LIMIT_BPS);
        assert_eq!(get_phase_limit(301), PHASE_2_LIMIT_BPS);
        assert_eq!(get_phase_limit(1799), PHASE_2_LIMIT_BPS);
        assert_eq!(get_phase_limit(1801), PHASE_3_LIMIT_BPS);
        assert_eq!(get_phase_limit(86_399), PHASE_3_LIMIT_BPS);
        assert_eq!(get_phase_limit(86_401), PHASE_4_LIMIT_BPS);
    }

    #[test]
    fn test_max_holder_amount() {
        let max = get_max_holder_amount();
        assert_eq!(max, (TOTAL_SUPPLY * 15) / 100);
    }

    #[test]
    fn test_vesting_fully_elapsed() {
        let result = calculate_vested_amount(1_000_000, 100_000, 1000, 2000, 3000).unwrap();
        assert_eq!(result, 900_000); // total - claimed
    }

    #[test]
    fn test_vesting_partial() {
        let result = calculate_vested_amount(1_000_000, 0, 0, 1000, 500).unwrap();
        assert_eq!(result, 500_000); // half vested
    }

    #[test]
    fn test_vesting_not_started() {
        let result = calculate_vested_amount(1_000_000, 0, 1000, 2000, 500);
        assert!(result.is_err());
    }

    #[test]
    fn test_sol_out_calculation() {
        let (net, fee) = calculate_sol_out(2_000_000, 500).unwrap();
        // gross = 2_000_000 * 500 / 1e9 = 1 SOL
        // fee = 1 SOL * 50 / 10000 = 0.005 SOL
        // net = 0.995 SOL = 995_000_000 lamports
        assert_eq!(net, 995_000_000);
        assert_eq!(fee, 5_000_000);
    }
}
