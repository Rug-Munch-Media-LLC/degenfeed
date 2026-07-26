// ─── Types ──────────────────────────────────────────────────────────────

export type FeddyCategory =
  | 'crypto'
  | 'tech'
  | 'art'
  | 'music'
  | 'gaming'
  | 'sports'
  | 'food'
  | 'travel'
  | 'fashion'
  | 'health'
  | 'education'
  | 'finance'
  | 'science'
  | 'literature'
  | 'film'
  | 'general';

export type FederationStatus = 'active' | 'limited' | 'suspended';

/** Extended member roles */
export type MemberRole = 'owner' | 'moderator' | 'contributor' | 'vip' | 'og' | 'member';

export interface FeddyCommunity {

export interface CommunityMember {

export interface CommunityPost {

export interface CommunityStats {

export interface DirectoryEntry {

export interface DirectoryResult {

// ─── Event Types ────────────────────────────────────────────────────────

export interface CommunityEvent {

export interface EventRSVP {

// ─── Poll Types ─────────────────────────────────────────────────────────

export interface PollOption {

export interface CommunityPoll {

export interface PollVote {

// ─── Wiki Types ─────────────────────────────────────────────────────────

export interface WikiPage {

// ─── Badge Types ────────────────────────────────────────────────────────

export interface BadgeDefinition {

// ─── Treasury Types ─────────────────────────────────────────────────────

export interface TreasuryState {

export interface TreasuryTx {

// ─── Token Types ────────────────────────────────────────────────────────

export interface CommunityTokenConfig {

export interface TokenGate {

// ─── Moderation Types ───────────────────────────────────────────────────

export interface ModLogEntry {

export type ReportCategory =
  | 'spam'
  | 'harassment'
  | 'hate_speech'
  | 'violence'
  | 'nsfw'
  | 'impersonation'
  | 'copyright'
  | 'scam'
  | 'other';

export interface Report {

export interface Appeal {

export interface KeywordFilter {

export interface FedBlocklistEntry {

// ─── Webhook / Bot Types ────────────────────────────────────────────────

export interface WebhookConfig {

export type WebhookEvent =
  | 'post.created'
  | 'post.deleted'
  | 'member.joined'
  | 'member.left'
  | 'member.banned'
  | 'event.created'
  | 'poll.closed'
  | 'treasury.deposit'
  | 'treasury.withdrawal';

export interface BotApiKey {

export type BotScope = 'post:write' | 'post:read' | 'members:read' | 'stats:read';

// ─── Federation Types ───────────────────────────────────────────────────

export interface FederationHealth {

export interface RemoteCommunity {

// ─── Trending / Discovery Types ─────────────────────────────────────────

export interface TrendingScore {

export interface AutocompleteResult {

