/**
 * @degenfeed/api-worker — Grant Program Management Service (TASK 3)
 *
 * Community grant programs for DAOs. Manages the full grant lifecycle:
 * program creation → application → review → voting → milestone tracking → distribution.
 *
 * All state persisted in KV under `grant:{namespace}:{daoId}:{id}` namespace.
 */

import type { Address } from 'viem';
import { log } from '../logger';
import type { Env } from '../types';
import {
