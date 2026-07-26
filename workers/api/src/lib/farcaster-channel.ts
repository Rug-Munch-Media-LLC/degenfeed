/**
 * @degenfeed/api-worker — Farcaster Channel Announcement Integration
 *
 * Posts stream/space announcements to relevant Farcaster channels
 * via our self-hosted Hubble. No external API dependency.
 *
 * Channel discovery maps stream categories/tags to known Farcaster channels.
 * Announcements are cast with the stream URL embedded so the frame renders
 * inline in the channel feed.
 */

import type { Env } from '../types';
import { publishCastToFarcaster } from './hubble-publisher';

// ─── Types ──────────────────────────────────────────────────────────────────

export type FarcasterChannel = {};
