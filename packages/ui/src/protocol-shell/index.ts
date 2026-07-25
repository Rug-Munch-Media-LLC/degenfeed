/**
 * @degenfeed/ui — Protocol Shell
 *
 * A wrapper component system that applies DegenFeed's cyberpunk design
 * to any headless/federated protocol content.
 *
 * Supports: PeerTube, Pixelfed, Lemmy, Mastodon/GTS, BookWyrm,
 *           Mobilizon, WriteFreely, Farcaster, and more.
 */

export { ProtocolShell, PROTOCOL_META } from './ProtocolShell';
export type { ProtocolShellProps } from './ProtocolShell';

export { ProtocolHeader } from './ProtocolHeader';
export type {
  ProtocolHeaderNavItem,
  ProtocolHeaderProps,
  ProtocolHeaderStats,
} from './ProtocolHeader';

export { ProtocolSidebar } from './ProtocolSidebar';
export type {
  ProtocolSidebarLink,
  ProtocolSidebarProps,
  ProtocolSidebarSection,
} from './ProtocolSidebar';

export { ProtocolFrame } from './ProtocolFrame';
export type { ProtocolFrameProps, FrameSize } from './ProtocolFrame';
