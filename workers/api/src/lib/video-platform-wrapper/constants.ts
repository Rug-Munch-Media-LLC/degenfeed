/** Wrapper registry for video platform providers. */

import type { VideoSource, VideoPlatformWrapper } from './types';

const _registeredWrappers = new Map<VideoSource, VideoPlatformWrapper>();

export function registerWrapper(wrapper: VideoPlatformWrapper): void {
  _registeredWrappers.set(wrapper.source, wrapper);
}

export function getWrapper(source: VideoSource): VideoPlatformWrapper | undefined {
  return _registeredWrappers.get(source);
}

export function getAllWrappers(): VideoPlatformWrapper[] {
  return Array.from(_registeredWrappers.values());
}

export function getAllSources(): VideoSource[] {
  return Array.from(_registeredWrappers.keys());
}
