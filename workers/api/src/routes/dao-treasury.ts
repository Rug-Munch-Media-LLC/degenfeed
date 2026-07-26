/**
 * @degenfeed/api-worker — DAO Treasury Route Handlers
 *
 * REST API for multi-sig, streaming payments, grants, and investments.
 * Each handler instantiates the appropriate service and delegates.
 *
 * Routes:
 *   /api/dao/:daoId/treasury/multisig/*
 *   /api/dao/:daoId/treasury/stream/*
 *   /api/dao/:daoId/treasury/grant/*
 *   /api/dao/:daoId/treasury/investment/*
 *   /api/dao/:daoId/treasury/analytics
 */

import type { Address } from 'viem';
import { GrantsService } from '../lib/grants-service';
import { InvestmentService } from '../lib/investment-service';
import { formatSignatureProgress, MultiSigService } from '../lib/multisig-service';
import { jsonResponse } from '../response-helpers';
import type { Env } from '../types';
import {
