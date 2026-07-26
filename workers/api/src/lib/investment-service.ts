/**
 * @degenfeed/api-worker — Investment Management Service (TASK 4)
 *
 * Tools for DAO treasuries to manage investments across DeFi protocols.
 * Includes portfolio tracking, yield opportunities, investment proposals,
 * risk assessment, and performance tracking.
 *
 * All state persisted in KV under `investment:{namespace}:{daoId}:{id}`.
 */

import type { Address } from 'viem';
import { log } from '../logger';
import type { Env } from '../types';
import {
