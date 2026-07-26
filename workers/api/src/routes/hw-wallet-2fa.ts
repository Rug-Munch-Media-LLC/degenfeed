/**
 * @degenfeed/api-worker — Hardware Wallet 2FA
 *
 * Challenge-response 2FA using hardware wallets (Ledger, Trezor, etc.).
 *
 * HOW IT WORKS:
 *   1. GET /api/auth/hw-wallet/status — Check if HW 2FA is active for the session
 *   2. POST /api/auth/hw-wallet/challenge — Generate a random signing challenge
 *   3. POST /api/auth/hw-wallet/verify — Verify the signed challenge
 *   4. POST /api/auth/hw-wallet/toggle — Enable/disable HW 2FA for the account
 *
 * SECURITY:
 *   - Challenges are single-use, expire after 5 minutes
 *   - The challenge includes the wallet address, timestamp, and random nonce
 *   - Verification recovers the signer's address from the signature
 *   - Phishing-resistant: the message explicitly states "This does not authorize
 *     any transaction" and includes the domain context
 *
 * COMPATIBILITY:
 *   - Ethereum / EVM: uses EIP-191 personal_sign (works with Ledger, Trezor,
 *     MetaMask hardware, Rabby hardware, etc.)
 *   - Solana: uses ed25519 signMessage (works with Phantom, Solflare, Backpack
 *     hardware wallets)
 */

import { rateLimit } from '../index';
import { hwWallet2FAStatusKey, hwWalletChallengeKey } from '../kv-key-patterns';
import { verifyEthereumSignature, verifySolanaSignature } from '../lib/signature-verify';
import { jsonResponse } from '../response-helpers';
import { requireSession } from '../session';
import type { Env } from '../types';

// ─── Types ──────────────────────────────────────────────────────────

export type HwChallenge = {}
