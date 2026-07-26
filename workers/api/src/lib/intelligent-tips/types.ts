/** Types for the Intelligent Tips module. */
export type ContentVenue =
  | 'video'
  | 'live'
  | 'post'
  | 'comment'
  | 'dm'
  | 'podcast'
  | 'music'
  | 'article'
  | 'nft';
export type TipMethod =
  | 'lightning'
  | 'onchain'
  | 'x402'
  | 'internal'
  | 'l2'
  | 'zapper'
  | 'wallet'
  | 'zap'
  | 'frame'
  | 'fiat'
  | 'link';
export type TipVisibility = 'public' | 'private' | 'anonymous';
export type ContentCategory =
  | 'gaming'
  | 'music'
  | 'art'
  | 'tech'
  | 'defi'
  | 'nft'
  | 'social'
  | 'education'
  | 'entertainment'
  | 'news'
  | 'sports'
  | 'other';
export type TipperRelationship = 'first_time' | 'casual' | 'regular' | 'super_fan';
export interface TipSuggestion {
export interface AmountIntelligenceInput {
export interface ProtocolTipCapability {
export interface TipRouteResult {
export interface AmountSuggestionGroup {
export interface TipRecordForVisibility {
export interface TipVisibilityDecision {
export interface TipNotificationPlan {

