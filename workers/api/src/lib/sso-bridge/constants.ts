/** Constants for the SSO Bridge module. */
import type { SSOProtocolDef } from './types';
export const ALL_SSO_PROTOCOLS: SSOProtocolDef[] = [];
export const SSO_PROTOCOL_MAP = new Map<string, SSOProtocolDef>();
export const SELF_HOSTED_PROTOCOL_IDS: string[] = [];
export function ssoWalletStateKey(wallet: string): string {
  return `sso:wallet:${wallet}`;
}
export function ssoSessionKey(wallet: string, sessionId: string): string {
  return `sso:session:${wallet}:${sessionId}`;
}
export function ssoRevokedKey(sessionId: string): string {
  return `sso:revoked:${sessionId}`;
}
export function ssoCredsKey(wallet: string, protocol: string): string {
  return `sso:creds:${wallet}:${protocol}`;
}
export function ssoExportKey(wallet: string): string {
  return `sso:export:${wallet}`;
}
export function ssoLastActiveKey(wallet: string): string {
  return `sso:last-active:${wallet}`;
}
export function ssoActivityFeedKey(wallet: string): string {
  return `sso:activity:${wallet}`;
}
export function ssoActivityFeedItemKey(wallet: string, timestamp: number): string {
  return `sso:activity:${wallet}:${timestamp}`;
}
