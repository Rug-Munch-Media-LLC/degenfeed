use crate::constants::*;
use crate::error::CreatorTokenError;
use crate::state::VestingConfig;
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

/// Calculate vested amount based on customizable vesting schedule.
///
/// ## Schedule
/// 1. **Initial unlock**: `config.initial_unlock_bps`% of allocation available at T+0
/// 2. **Cliff**: No additional tokens until `cliff_end = created_at + config.cliff_duration`
/// 3. **Linear vesting**: After cliff, tokens vest linearly over `config.vesting_duration`
///
/// ## Formula
/// ```text
/// initial_unlock = total_allocated * initial_unlock_bps / 10000
/// post_initial   = total_allocated - initial_unlock
///
/// if current_time < cliff_end:
///     vested = min(total_claimed, initial_unlock)  // only initial unlock
/// else:
///     elapsed = min(current_time - cliff_end, vesting_duration)
///     vested = initial_unlock + (post_initial * elapsed / vesting_duration)
///
/// claimable = vested - total_claimed
/// ```
pub fn calculate_vested_amount(
    total_allocated: u64,
    total_claimed: u64,
    created_at: i64,
    config: &VestingConfig,
    current_time: i64,
) -> Result<u64> {
    let initial_unlock = (total_allocated as u128)
        .checked_mul(config.initial_unlock_bps as u128)
        .ok_or(error!(CreatorTokenError::MathOverflow))?
        .checked_div(10_000u128)
        .ok_or(error!(CreatorTokenError::MathOverflow))? as u64;

    let cliff_end = created_at
        .checked_add(config.cliff_duration)
        .ok_or(error!(CreatorTokenError::MathOverflow))?;

    // ── Determine vested amount ─────────────────────────────────────
    let vested: u64;

    if current_time < cliff_end {
        // Still in cliff period — only initial unlock is claimable
        vested = initial_unlock;
    } else {
        // Past cliff — calculate linear vesting
        let elapsed_since_cliff = current_time
            .checked_sub(cliff_end)
            .ok_or(error!(CreatorTokenError::MathOverflow))?;

        if elapsed_since_cliff >= config.vesting_duration {
            // Fully vested
            vested = total_allocated;
        } else {
            // Partial vesting
            let post_initial = (total_allocated as u128)
                .checked_sub(initial_unlock as u128)
                .ok_or(error!(CreatorTokenError::MathOverflow))?;

            let linear_vested = post_initial
                .checked_mul(elapsed_since_cliff as u128)
                .ok_or(error!(CreatorTokenError::MathOverflow))?
                .checked_div(config.vesting_duration as u128)
                .ok_or(error!(CreatorTokenError::MathOverflow))?
                as u64;

            vested = initial_unlock
                .checked_add(linear_vested)
                .ok_or(error!(CreatorTokenError::MathOverflow))?;

            if vested > total_allocated {
                // Safety clamp (shouldn't happen with valid params)
                return Ok(total_allocated
                    .checked_sub(total_claimed)
                    .ok_or(error!(CreatorTokenError::NoVestedTokens))?);
            }
        }
    }

    // ── Compute claimable ───────────────────────────────────────────
    if vested <= total_claimed {
        return Err(error!(CreatorTokenError::NoVestedTokens));
    }

    vested
        .checked_sub(total_claimed)
        .ok_or(error!(CreatorTokenError::NoVestedTokens))
}

/// Validate a VestingConfig against constraints.
pub fn validate_vesting_config(config: &VestingConfig) -> Result<()> {
    require!(
        config.initial_unlock_bps <= MAX_INITIAL_UNLOCK_BPS,
        CreatorTokenError::VestingConfigInvalid
    );
    require!(
        config.cliff_duration <= MAX_CLIFF_SECONDS,
        CreatorTokenError::VestingConfigInvalid
    );
    require!(
        config.vesting_duration >= MIN_VESTING_SECONDS,
        CreatorTokenError::VestingConfigInvalid
    );
    require!(
        config.vesting_duration <= MAX_VESTING_SECONDS,
        CreatorTokenError::VestingConfigInvalid
    );
    // Cliff + vesting must not exceed the maximum total lockup
    let total_lockup = config
        .cliff_duration
        .checked_add(config.vesting_duration)
        .ok_or(error!(CreatorTokenError::MathOverflow))?;
    require!(
        total_lockup <= MAX_CLIFF_SECONDS + MAX_VESTING_SECONDS,
        CreatorTokenError::VestingConfigInvalid
    );
    Ok(())
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

    // ── Customizable Vesting Tests ─────────────────────────────────────

    const TEST_CONFIG_BALANCED: VestingConfig = VestingConfig {
        initial_unlock_bps: 500,     // 5%
        cliff_duration: 604_800,     // 7 days
        vesting_duration: 5_184_000, // 60 days
    };

    const TEST_CONFIG_TRUSTLESS: VestingConfig = VestingConfig {
        initial_unlock_bps: 0,       // 0%
        cliff_duration: 2_592_000,   // 30 days
        vesting_duration: 7_776_000, // 90 days
    };

    const TEST_CONFIG_FAST: VestingConfig = VestingConfig {
        initial_unlock_bps: 2_000, // 20%
        cliff_duration: 0,         // no cliff
        vesting_duration: 604_800, // 7 days
    };

    #[test]
    fn test_vesting_fully_elapsed() {
        // Trustless config: 30d cliff + 90d vest, fully elapsed
        let created_at = 1000;
        let fully_elapsed = 1000 + 7_776_000 + 2_592_000 + 1;
        let result = calculate_vested_amount(
            1_000_000,
            100_000,
            created_at,
            &TEST_CONFIG_TRUSTLESS,
            fully_elapsed,
        )
        .unwrap();
        assert_eq!(result, 900_000); // total - claimed
    }

    #[test]
    fn test_vesting_initial_unlock_during_cliff() {
        // Balanced config: 5% initial unlock claimable during cliff
        let created_at = 0;
        let during_cliff = 100; // well before cliff ends
        let result = calculate_vested_amount(
            1_000_000,
            0,
            created_at,
            &TEST_CONFIG_BALANCED,
            during_cliff,
        )
        .unwrap();
        // 5% of 1,000,000 = 50,000
        assert_eq!(result, 50_000);
    }

    #[test]
    fn test_vesting_initial_unlock_already_claimed() {
        // If initial unlock was already claimed, nothing is claimable during cliff
        let created_at = 0;
        let during_cliff = 100;
        let result = calculate_vested_amount(
            1_000_000,
            50_000,
            created_at,
            &TEST_CONFIG_BALANCED,
            during_cliff,
        );
        assert!(result.is_err());
        assert_eq!(
            result.unwrap_err(),
            error!(CreatorTokenError::NoVestedTokens)
        );
    }

    #[test]
    fn test_vesting_partial_after_cliff() {
        // Balanced: 5% initial, 7d cliff, 60d vest
        // At T+7d+30d = 50% of post-initial should be vested
        let created_at = 0;
        let after_cliff = 604_800 + 30 * 86_400; // 7d cliff + 30d
        let result = calculate_vested_amount(
            1_000_000,
            50_000,
            created_at,
            &TEST_CONFIG_BALANCED,
            after_cliff,
        )
        .unwrap();
        // 5% initial + 50% of remaining 95% = 5% + 47.5% = 52.5% = 525,000
        // Already claimed 50k, so claimable = 525k - 50k = 475k
        assert_eq!(result, 475_000);
    }

    #[test]
    fn test_vesting_no_cliff_fast() {
        // Fast config: 20% initial, no cliff, 7d vest
        let created_at = 0;
        let half_way = 3 * 86_400; // 3 days into 7 day vest
        let result =
            calculate_vested_amount(1_000_000, 200_000, created_at, &TEST_CONFIG_FAST, half_way)
                .unwrap();
        // 20% initial + (3/7 * 80%) = 20% + 34.29% = 54.29% = 542,857
        // Already claimed 200k, so claimable = 542,857 - 200,000 = 342,857
        let expected_vested = 200_000 + ((800_000 * 259_200) / 604_800);
        assert_eq!(result, expected_vested - 200_000);
    }

    #[test]
    fn test_vesting_not_started() {
        // With no initial unlock and a cliff, nothing during cliff
        let created_at = 0;
        let during_cliff = 500;
        let result = calculate_vested_amount(
            1_000_000,
            0,
            created_at,
            &TEST_CONFIG_TRUSTLESS,
            during_cliff,
        );
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

    #[test]
    fn test_validate_vesting_config_valid() {
        let config = VestingConfig {
            initial_unlock_bps: 1000,
            cliff_duration: 86_400,
            vesting_duration: 2_592_000,
        };
        assert!(validate_vesting_config(&config).is_ok());
    }

    #[test]
    fn test_validate_vesting_config_invalid_initial() {
        let config = VestingConfig {
            initial_unlock_bps: 5000, // > 30%
            cliff_duration: 0,
            vesting_duration: 604_800,
        };
        assert!(validate_vesting_config(&config).is_err());
    }

    #[test]
    fn test_validate_vesting_config_too_short() {
        let config = VestingConfig {
            initial_unlock_bps: 0,
            cliff_duration: 0,
            vesting_duration: 86_400, // 1 day < 7 days
        };
        assert!(validate_vesting_config(&config).is_err());
    }

    #[test]
    fn test_validate_vesting_config_too_long() {
        let config = VestingConfig {
            initial_unlock_bps: 0,
            cliff_duration: 0,
            vesting_duration: 126_144_000, // 4 years > 2 years
        };
        assert!(validate_vesting_config(&config).is_err());
    }
}
