/**
 * @degenfeed/web — Hardware Wallet 2FA type definitions
 *
 * Shared types for the hardware wallet 2FA challenge-response flow.
 */

/** 2FA status returned by GET /api/auth/hw-wallet/status */
export interface Hw2FAStatus {
  enabled: boolean;
  lastVerifiedAt: number | null;
}

/** Challenge response from POST /api/auth/hw-wallet/challenge */
export interface HwChallengeResponse {
  challenge: string;
  nonce: string;
  expiresIn: number;
}

/** Verification response from POST /api/auth/hw-wallet/verify */
export interface HwVerifyResponse {
  verified: boolean;
}

/** Toggle response from POST /api/auth/hw-wallet/toggle */
export interface HwToggleResponse {
  enabled: boolean;
  message: string;
}

/** Verify-on-login response */
export interface HwVerifyOnLoginResponse {
  verified: boolean;
  skipped?: boolean;
  message?: string;
}
