/** Wrapper registry for video platform providers. */

import type { VideoPlatformWrapper, VideoSource } from './types';

const _registeredWrappers = new Map<VideoSource, VideoPlatformWrapper>();

export function registerWrapper(wrapper: VideoPlatformWrapper): void {

export function getWrapper(source: VideoSource): VideoPlatformWrapper | undefined {

export function getAllWrappers(): VideoPlatformWrapper[] {

export function getAllSources(): VideoSource[] {

