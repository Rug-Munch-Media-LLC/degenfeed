/**
 * @degenfeed/api-worker — Encrypted Group Chat
 *
 * Group messaging with sender key distribution:
 *   1. Create group with members
 *   2. Generate a group sender key
 *   3. Distribute sender key to each member (encrypted per-member with their session key)
 *   4. All members use the same sender key to encrypt messages to the group
 *   5. Rotate sender key when members join/leave
 *   6. Group metadata encrypted at rest
 *
 * Security model:
 *   - Sender key encrypted per-member using their E2E session key
 *   - When a member leaves, a new sender key is generated and re-distributed
 *   - Group metadata (name, member list) encrypted in KV
 *   - Message history encrypted with group sender key
 */

import type { Env } from '../types';
import { seal, unseal } from './crypto-seal';

// ─── Types ──────────────────────────────────────────────────────────────────

export type GroupMember = {};
