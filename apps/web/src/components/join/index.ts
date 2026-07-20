/**
 * @components/join — Barrel exports for the cross-network join experience.
 */

export { useSourcePlatform, detectSourcePlatform } from './useSourcePlatform';
export { PlatformGreeting } from './PlatformGreeting';
export { GuestChat } from './GuestChat';
export { GuestSignUp } from './GuestSignUp';
export { JoinActions } from './JoinActions';
export { StreamJoinView } from './StreamJoinView';
export { SpaceJoinView } from './SpaceJoinView';
export {
  type SourcePlatform,
  type PlatformConfig,
  type GuestIdentity,
  type JoinStreamData,
  type JoinSpaceData,
  type StreamViewAnalytics,
  PLATFORM_CONFIG,
  PLATFORM_IDS,
} from './types';
