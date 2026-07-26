/**
 * @degenfeed/api-worker — Rights Management & Licensing
 *
 * Manages content rights, licensing, usage tracking, monetization rights,
 * and platform permissions. Every piece of content in the library has a
 * license and rights configuration that governs how it can be used,
 * reposted, and monetized.
 *
 * KV key scheme:
 *   rights:license:{contentId}       → LicenseRecord
 *   rights:usage:{contentId}         → UsageRecord[] (who reposted, attribution)
 *   rights:monetization:{contentId}  → MonetizationConfig
 *   rights:permissions:{wallet}      → DefaultPlatformPermissions
 */

import type { Env } from '../types';

// ─── Types ──────────────────────────────────────────────────────────────────

export type LicenseType = 'all-rights' | 'cc-by' | 'cc-by-sa' | 'cc-by-nc' | 'cc0' | 'custom';

export type LicenseRecord = {};
