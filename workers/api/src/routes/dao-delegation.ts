/**
 * @degenfeed/api-worker — DAO Delegation endpoints
 */

import { jsonResponse } from '../response-helpers';
import { requireSession } from '../session';
import type { Env } from '../types';
import {
