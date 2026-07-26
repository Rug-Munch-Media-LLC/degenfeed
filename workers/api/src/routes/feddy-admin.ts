/**
 * @degenfeed/api-worker — Feddy Communities: Admin Actions
 *
 * Moderator/owner actions: add moderator, ban member, unban member.
 */

import { Hono } from 'hono';
import { jsonResponse } from '../response-helpers';
import type { Env } from '../types';
import {
