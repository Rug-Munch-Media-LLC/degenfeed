/**
 * @degenfeed/api-worker — Vine routes registration
 *
 * Registers all Vine-like short-form video routes on the Hono app.
 */
import type { Hono } from 'hono';
import type { Env } from '../../types';

import {
