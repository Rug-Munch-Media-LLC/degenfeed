/** Type definitions for the video platform wrapper module. */

import type { UnifiedLiveStream } from '../../feed/live-aggregator';
import type { Env } from '../../types';

export type VideoSource =
  | 'farcaster' | 'zora' | 'lens' | 'nostr' | 'dtube' | 'odysee'
  | 'lbry' | 'rumble' | 'bittube' | 'youtube' | 'peertube'
  | 'twitch' | 'ipfs' | 'arweave' | 'direct';

export interface VideoQueryOptions {

export interface ShortsQueryOptions {

export interface PlatformHealth {

export interface UnifiedVideo {

export interface UnifiedCreatorBrief {

export interface AggregatedShort {

export interface VideoPlatformWrapper {

