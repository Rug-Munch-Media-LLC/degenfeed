/**
 * @degenfeed/api-worker — WebAuthn / Passkey 2FA routes
 *
 * Phishing-resistant biometric authentication using the WebAuthn (FIDO2)
 * standard. Users register a passkey (fingerprint, Face ID, YubiKey, or
 * platform authenticator) and authenticate with it instead of (or in
 * addition to) their wallet signature.
 *
 * The server stores zero secrets — only public keys. Phishing-resistant
 * by design: the browser enforces the origin, so a fake site cannot
 * replay the credential.
 *
 * KV key patterns (all in CACHE namespace):
 *   webauthn:challenge:{wallet}  — registration/authentication challenge, TTL: 5 min
 *   webauthn:credentials:{wallet} — JSON array of stored credentials, TTL: none (persistent)
 */

import {
