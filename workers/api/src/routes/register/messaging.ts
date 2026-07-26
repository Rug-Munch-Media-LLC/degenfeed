/**
 * @degenfeed/api-worker - Messaging route registration
 *
 * Register Messaging-related routes on the Hono app instance.
 */

import type { Hono } from 'hono';
import type { Env } from '../../types';
import {
