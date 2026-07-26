/**
 * @degenfeed/api-worker - Media route registration
 *
 * Register Media-related routes on the Hono app instance.
 */

import type { Hono } from 'hono';
import { handleContentResolve } from '../../routes/content';
import type { Env } from '../../types';
import {
