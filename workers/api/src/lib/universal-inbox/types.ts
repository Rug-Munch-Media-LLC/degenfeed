/**
 * @degenfeed/api-worker — Universal Inbox Types
 *
 * Type definitions for the unified cross-protocol inbox system.
 */

import type { Protocol } from '@degenfeed/types';

export type InboxItemKind =
  | 'dm'
  | 'comment'
  | 'reply'
  | 'mention'
  | 'like'
  | 'repost'
  | 'follow'
  | 'tip';

export interface InboxActor {

export interface InboxItem {

export interface InboxFeed {

export interface InboxReplyRequest {

export interface InboxShareRequest {

export interface NetworkStatus {

export type NetworkCapability =
  | 'post'
  | 'dm'
  | 'reply'
  | 'comment'
  | 'like'
  | 'repost'
  | 'follow'
  | 'upload-media'
  | 'live-stream'
  | 'tip';

export interface UserNetworkStatus {

export interface InboxReadRequest {

export interface CrossNetworkShareResult {

export interface ActivityFeedItem {

