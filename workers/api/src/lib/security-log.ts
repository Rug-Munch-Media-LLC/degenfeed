/**
 * @degenfeed/api-worker — Security event logging
 *
 * Logs all security-related events (logins, 2FA changes, session revocations,
 * password changes, wallet operations) to KV for the Security Log UI.
 *
 * Each event is stored as an individual KV record with a time-ordered key:
 *   security:event:{address}:{timestamp}:{nonce}
 *
 * The user's recent events are also indexed in a sorted set (via a KV
 * list key) for efficient chronological queries.
 *
 * KV key patterns:
 *   security:event:{address}:{ts}:{nonce} → JSON SecurityEvent
 *   security:events:{address}            → JSON array of recent event keys
 */

import type { Env } from '../types';

/* ─── Types ─────────────────────────────────────────────────────────── */

export type SecurityEventType =
  | 'login_success'
  | 'login_failed'
  | 'logout'
  | 'session_revoked'
  | 'sessions_revoked_all'
  | 'passkey_registered'
  | 'passkey_removed'
  | 'totp_enabled'
  | 'totp_disabled'
  | 'hardware_wallet_verified'
  | 'hardware_wallet_removed'
  | 'recovery_codes_generated'
  | 'recovery_code_used'
  | 'password_changed'
  | 'email_changed'
  | 'wallet_connected'
  | 'wallet_disconnected'
  | 'account_deactivated'
  | 'account_exported'
  | 'api_key_created'
  | 'api_key_revoked';

export type SecurityEventSeverity = 'low' | 'medium' | 'high' | 'critical';

export type SecurityEvent = {};
