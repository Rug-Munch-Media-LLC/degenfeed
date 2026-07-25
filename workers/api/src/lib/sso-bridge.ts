/**
 * @degenfeed/api-worker — Single Sign-On Bridge
 *
 * Split into module at ./sso-bridge/ for maintainability.
 * @see ./sso-bridge/index.ts
 * Re-exports everything from the sub-module.
 */

export {
  ALL_SSO_PROTOCOLS,
  SELF_HOSTED_PROTOCOL_IDS,
  SSO_PROTOCOL_MAP,
  ssoActivityFeedItemKey,
  ssoActivityFeedKey,
  ssoCredsKey,
  ssoExportKey,
  ssoLastActiveKey,
  ssoRevokedKey,
  ssoSessionKey,
  ssoWalletStateKey,
} from './sso-bridge/constants';
export * from './sso-bridge/implementation';
export type {
  SSOAccountState,
  SSOExportBundle,
  SSOProtocolDef,
  SSOProvisioningResult,
  SSOSession,
  SSOSessionPayload,
  SSOWalletState,
} from './sso-bridge/types';
