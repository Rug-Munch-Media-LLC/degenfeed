/**
 * @degenfeed/api-worker — Scheduled post executor (cron worker)
 *
 * Called by the every-minute cron trigger. Scans all scheduled KV entries
 * for posts where scheduledAt ≤ now, publishes each via the existing
 * handlePublish handler, and manages retry/failure lifecycle.
 *
 * Flow per entry:
 *   1. Skip if status !== 'pending' or future-dated
 *   2. Create a short-lived session cookie for the owning wallet
 *   3. Build a synthetic Request with the stored text + targets
 *   4. Call handlePublish → reuses Postiz routing, auth checks, etc.
 *   5. Success → mark published, record in user:published:{wallet}, remove from user index
 *   6. Failure → increment retries; after 3 retries mark as failed
 */

import { type SessionPayload, signSession } from '../session';
import type { Env } from '../types';

const SCHEDULED_PREFIX = 'scheduled:';
const MAX_RETRIES = 3;

type ScheduledEntry = {}
