/**
 * @components/join — Barrel exports for the cross-network join experience.
 */

export { GuestChat } from './GuestChat';
export { GuestSignUp } from './GuestSignUp';
export { JoinActions } from './JoinActions';
export { PlatformGreeting } from './PlatformGreeting';
export { SpaceJoinView } from './SpaceJoinView';
export { StreamJoinView } from './StreamJoinView';
export {
  type GuestIdentity,
  type JoinSpaceData,
  type JoinStreamData,
  PLATFORM_CONFIG,
  PLATFORM_IDS,
  type PlatformConfig,
  type SourcePlatform,
  type StreamViewAnalytics,
} from './types';
export { detectSourcePlatform, useSourcePlatform } from './useSourcePlatform';
