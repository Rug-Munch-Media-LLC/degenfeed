import { rateLimit } from '../index';
import { jsonResponse, rateLimitResponse } from '../response-helpers';
import { validateBodySize } from '../sanitize';
import type { Env } from '../types';

const EMAIL_PREFIX = 'email:';
const PW_RESET_PREFIX = 'pwreset:';
const VERIFY_PREFIX = 'verify:';
const PW_RESET_TTL = 3600;
const VERIFY_TTL = 86400;

// ─── Password hashing ──────────────────────────────────────────────

async function hashPassword(password: string): Promise<string> {
