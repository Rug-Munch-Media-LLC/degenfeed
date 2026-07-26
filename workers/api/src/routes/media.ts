/**
 * @degenfeed/api-worker — Media Storage Route Handlers
 *
 * POST   /api/media/upload/image        — Upload image (multipart)
 * POST   /api/media/upload              — Generic media upload
 * GET    /api/media/image/:cid          — Get image (with size and format params)
 * GET    /api/media/image/:cid/metadata — Image metadata
 * GET    /api/media/gateway/:type/:id   — Unified media gateway
 * GET    /api/media/health              — Media service health check
 * POST   /api/media/make-permanent      — Make media permanent on Arweave
 *
 * All uploads are stored on IPFS first. Optional Arweave permanence.
 * All URLs are CDN-backed via Cloudflare IPFS gateway.
 */

import { log } from '../logger';
import { jsonResponse, noCacheJsonResponse } from '../response-helpers';
import type { Env } from '../types';
import {
