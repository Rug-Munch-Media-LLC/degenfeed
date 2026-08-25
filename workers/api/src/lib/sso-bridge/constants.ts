/** Constants for the SSO Bridge module. */
import type { SSOProtocolDef } from './types';
export const ALL_SSO_PROTOCOLS: SSOProtocolDef[] = [
  {
    id: 'nostr',
    label: 'Nostr',
    category: 'social',
    instanceUrl: 'ws://127.0.0.1:8085',
    apiEndpoint: 'http://127.0.0.1:8085/api/v1',
    requiresPremium: false,
    icon: 'nostr',
    color: '#7e5bef',
    healthEndpoint: 'http://127.0.0.1:8085/',
  },
  {
    id: 'mastodon',
    label: 'GoToSocial',
    category: 'social',
    instanceUrl: 'https://social.degenfeed.xyz',
    apiEndpoint: 'https://social.degenfeed.xyz/api/v1',
    healthEndpoint: 'http://127.0.0.1:8082/api/v1/instance',
    requiresPremium: false,
    icon: 'mastodon',
    color: '#00ff41',
  },
  {
    id: 'lemmy',
    label: 'Lemmy',
    category: 'social',
    instanceUrl: 'https://community.degenfeed.xyz',
    apiEndpoint: 'http://127.0.0.1:8536/api/v3',
    healthEndpoint: 'http://127.0.0.1:8536/api/v3/site',
    requiresPremium: false,
    icon: 'lemmy',
    color: '#ff4500',
  },
  {
    id: 'bluesky',
    label: 'Bluesky',
    category: 'social',
    instanceUrl: 'https://pds.degenfeed.xyz',
    apiEndpoint: 'http://127.0.0.1:3012/xrpc',
    healthEndpoint: 'http://127.0.0.1:3012/xrpc/_health',
    requiresPremium: false,
    icon: 'bluesky',
    color: '#0085ff',
  },
  {
    id: 'pixelfed',
    label: 'Pixelfed',
    category: 'social',
    instanceUrl: 'https://photos.degenfeed.xyz',
    apiEndpoint: 'http://127.0.0.1:8087/api/v1',
    healthEndpoint: 'http://127.0.0.1:8087/api/v1/instance',
    requiresPremium: false,
    icon: 'camera',
    color: '#ff5757',
  },
  {
    id: 'peertube',
    label: 'PeerTube',
    category: 'video',
    instanceUrl: 'https://video.degenfeed.xyz',
    apiEndpoint: 'http://127.0.0.1:9011/api/v1',
    healthEndpoint: 'http://127.0.0.1:9011/api/v1/config',
    requiresPremium: false,
    icon: 'video',
    color: '#f1680d',
  },
  {
    id: 'writefreely',
    label: 'WriteFreely',
    category: 'blog',
    instanceUrl: 'https://blog.degenfeed.xyz',
    apiEndpoint: 'https://blog.degenfeed.xyz/api',
    healthEndpoint: 'http://127.0.0.1:8086/',
    requiresPremium: false,
    icon: 'pen',
    color: '#444444',
  },
  {
    id: 'owncast',
    label: 'Owncast',
    category: 'live',
    instanceUrl: 'https://live.degenfeed.xyz',
    apiEndpoint: 'https://live.degenfeed.xyz/api',
    healthEndpoint: 'http://127.0.0.1:8092/',
    requiresPremium: false,
    icon: 'broadcast',
    color: '#ff9900',
  },
  {
    id: 'castopod',
    label: 'Castopod',
    category: 'podcast',
    instanceUrl: 'https://podcast.degenfeed.xyz',
    apiEndpoint: 'https://podcast.degenfeed.xyz/api/v1',
    healthEndpoint: 'http://127.0.0.1:8088/',
    requiresPremium: false,
    icon: 'mic',
    color: '#0098d4',
  },
];
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
