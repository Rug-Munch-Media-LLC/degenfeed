/**
 * @degenfeed/api-worker — Stream Configuration Wizard
 *
 * Step-by-step wizard that guides creators through the "Go Live" setup:
 *
 *   1. "What type of stream?" — Short/Portrait, Full/Landscape
 *   2. "Expected viewers?" — <10 (P2P), 10-50 (Owncast), 50+ (PeerTube)
 *   3. "Where to broadcast?" — Select platforms (simulcast targets)
 *   4. "Monetization?" — Tips on/off, token-gated on/off
 *   5. "Go Live!" — Start streaming with one click
 *
 * The wizard collects preferences, calculates optimal routing,
 * configures simulcast targets, and launches the stream.
 */

import { log } from '../logger';
import type { Env } from '../types';
import { SimulcastEngine, type SimulcastPlatform } from './simulcast';
import {
