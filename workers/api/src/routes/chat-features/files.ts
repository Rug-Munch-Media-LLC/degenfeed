/**
 * @degenfeed/api-worker — Chat File Upload, Download, Quota
 */

import { jsonResponse, noCacheJsonResponse } from '../../response-helpers';
import { requireSession } from '../../session';
import type { Env } from '../../types';

const _chatFiles: typeof import('../../lib/chat-files') | null = null;
const _enhanced: typeof import('../../lib/chat-files-enhanced') | null = null;

async function getChatFiles() {
