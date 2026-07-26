/**
 * @degenfeed/api-worker — Network Participation Rights Registry
 *
 * Permanent, verifiable membership in every network.
 * Rights that CANNOT be taken away, revoked, or modified — only added to.
 *
 * Core principle: EVERY right is an immutable append-only log entry.
 *   - Rights can only be CREATED, never deleted or modified
 *   - Each right has a cryptographic attestation anchor
 *   - Rights persist even if the user leaves a protocol
 *   - "You were a member of this network on this date, and that fact is permanent"
 *
 * KV key scheme:
 *   npr:{wallet}:{protocol}          → ProtocolMembership (latest)
 *   npr:{wallet}:history             → MembershipHistoryEntry[] (append-only)
 *   npr:{wallet}:rights              → NetworkRight[] (all active rights)
 *   npr:{wallet}:manifest            → RightsManifest (complete summary)
 *   npr:immutable:{id}               → ImmutableRight (cryptographic timestamp proof)
 *   npr:index:{network}              → RightsIndexEntry[] (network-wide index)
 *   npr:stats:{network}              → NetworkStats (aggregate)
 */

import type { Env } from '../types';

// ─── Types ─────────────────────────────────────────────────────────────

export type NetworkProtocol =
  | 'nostr'
  | 'farcaster'
  | 'lens'
  | 'bluesky'
  | 'mastodon'
  | 'reddit'
  | 'threads'
  | 'lemmy'
  | 'peertube'
  | 'atproto'
  | 'zora'
  | 'telegram'
  | 'rss'
  | 'ethereum'
  | 'solana';

export type MembershipStatus = 'active' | 'inactive' | 'suspended' | 'exited';
export type RightType =
  | 'membership'
  | 'contribution'
  | 'achievement'
  | 'governance'
  | 'content'
  | 'reputation';

export interface ProtocolMembership {

export interface StatusChangeEntry {

export interface NetworkRight {

export interface ImmutableRight {

export interface RightsManifest {

export interface MembershipHistoryEntry {

export interface NetworkStats {

export interface RightsIndexEntry {

// ─── Constants ────────────────────────────────────────────────────────

const ALL_NETWORKS: NetworkProtocol[] = [
  'nostr',
  'farcaster',
  'lens',
  'bluesky',
  'mastodon',
  'reddit',
  'threads',
  'lemmy',
  'peertube',
  'atproto',
  'zora',
  'telegram',
  'rss',
  'ethereum',
  'solana',
];

// ─── KV Key Helpers ───────────────────────────────────────────────────

function membershipKey(wallet: string, protocol: string): string {

function historyKey(wallet: string): string {

function rightsKey(wallet: string): string {

function manifestKey(wallet: string): string {

function immutableKey(id: string): string {

function indexKey(protocol: string): string {

function statsKey(protocol: string): string {

// ─── Register Membership ──────────────────────────────────────────────

/**
 * Register a user as a member of a network.
 *
 * This is an IRREVERSIBLE action. Once recorded, the fact that
 * "wallet X was a member of protocol Y on date Z" can NEVER be deleted.
 * Status can change (active → inactive), but the membership record is permanent.
 */
export async function registerMembership(
  wallet: string,
  protocol: NetworkProtocol,
  identifier: string,
  label: string,
  env: Env,
): Promise<ProtocolMembership> {

// ─── Grant Right ──────────────────────────────────────────────────────

/**
 * Grant a permanent, immutable right to a user in a network.
 *
 * Rights are APPEND-ONLY. Once granted, a right can be marked inactive
 * but the record of it having been granted is FOREVER.
 *
 * Each right gets a cryptographic hash for independent verification.
 */
export async function grantRight(
  wallet: string,
  protocol: NetworkProtocol,
  type: RightType,
  name: string,
  description: string,
  reason: string,
  env: Env,
): Promise<NetworkRight> {

// ─── Get Membership ───────────────────────────────────────────────────

/**
 * Get the membership record for a wallet in a protocol.
 * Returns null if the user has never been a member.
 */
export async function getMembership(
  wallet: string,
  protocol: NetworkProtocol,
  env: Env,
): Promise<ProtocolMembership | null> {

// ─── Get All Memberships ──────────────────────────────────────────────

/**
 * Get ALL memberships for a wallet across all networks.
 */
export async function getAllMemberships(wallet: string, env: Env): Promise<ProtocolMembership[]> {

// ─── Get All Rights ───────────────────────────────────────────────────

/**
 * Get ALL rights ever granted to a wallet (across all networks).
 */
export async function getAllRights(wallet: string, env: Env): Promise<NetworkRight[]> {

// ─── Generate Rights Manifest ─────────────────────────────────────────

/**
 * Generate a complete rights manifest for a wallet.
 * This is the canonical document proving all memberships and rights.
 */
export async function generateManifest(wallet: string, env: Env): Promise<RightsManifest> {

// ─── Get Cached Manifest ──────────────────────────────────────────────

/**
 * Get the cached rights manifest for a wallet.
 */
export async function getCachedManifest(wallet: string, env: Env): Promise<RightsManifest | null> {

// ─── Verify Immutable Right ───────────────────────────────────────────

/**
 * Verify that an immutable right record is authentic and unmodified.
 */
export async function verifyRight(
  rightId: string,
  env: Env,
): Promise<{ valid: boolean; right: ImmutableRight | null; errors: string[] }> {

// ─── Status Changes ───────────────────────────────────────────────────

/**
 * Change membership status.
 * The status change is APPENDED to the immutable log — never overwritten.
 */
export async function changeStatus(
  wallet: string,
  protocol: NetworkProtocol,
  newStatus: MembershipStatus,
  reason: string,
  changedBy: 'user' | 'system' | 'admin' | 'protocol',
  env: Env,
): Promise<ProtocolMembership | null> {

/**
 * Reactivate a membership that was inactive.
 */
async function reactivateMembership(
  wallet: string,
  protocol: NetworkProtocol,
  env: Env,
): Promise<ProtocolMembership> {

// ─── Record Exit ──────────────────────────────────────────────────────

/**
 * Record a user's exit from a network.
 * The membership record is NOT deleted — it's marked as 'exited'.
 * The fact that they were a member is permanent.
 */
export async function recordExit(
  wallet: string,
  protocol: NetworkProtocol,
  reason: string,
  env: Env,
): Promise<ProtocolMembership | null> {

// ─── Get Rights by Type ───────────────────────────────────────────────

/**
 * Get all rights of a specific type for a wallet.
 */
export async function getRightsByType(
  wallet: string,
  type: RightType,
  env: Env,
): Promise<NetworkRight[]> {

// ─── Get Rights by Protocol ───────────────────────────────────────────

/**
 * Get all active rights for a wallet in a specific protocol.
 */
export async function getRightsForProtocol(
  wallet: string,
  protocol: NetworkProtocol,
  env: Env,
): Promise<NetworkRight[]> {

// ─── Network Statistics ───────────────────────────────────────────────

/**
 * Get aggregate statistics for a network.
 */
export async function getNetworkStats(
  protocol: NetworkProtocol,
  env: Env,
): Promise<NetworkStats | null> {

/**
 * Get the network index (all members of a network).
 */
export async function getNetworkIndex(
  protocol: NetworkProtocol,
  env: Env,
): Promise<RightsIndexEntry[]> {

/**
 * Compute a sovereignty score for a wallet.
 * Score factors: number of networks, number of rights, membership duration, verification level.
 */
export async function computeSovereigntyScore(
  wallet: string,
  env: Env,
): Promise<{

// ─── Helpers ──────────────────────────────────────────────────────────

/**
 * Append an entry to the immutable history log.
 */
async function appendHistory(
  wallet: string,
  protocol: NetworkProtocol,
  event: MembershipHistoryEntry['event'],
  detail: string,
  env: Env,
): Promise<void> {

/**
 * Update the network index with a new member.
 */
async function updateNetworkIndex(
  protocol: NetworkProtocol,
  wallet: string,
  identifier: string,
  joinedAt: number,
  env: Env,
): Promise<void> {

/**
 * Update aggregate network stats.
 */
async function bumpNetworkStats(
  protocol: NetworkProtocol,
  event: 'join' | 'right_granted' | 'exit',
  env: Env,
): Promise<void> {

/**
 * Hex to bytes helper.
 */
function _hexToBytes(hex: string): Uint8Array {

/**
 * Bytes to hex helper.
 */
function bytesToHex(bytes: Uint8Array): string {

