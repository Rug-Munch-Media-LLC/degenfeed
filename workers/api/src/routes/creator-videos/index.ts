/**
 * @degenfeed/api-worker — Creator Video Router
 */
import { Hono } from 'hono';
import type { Env } from '../index';
import { handleUpload, handleUploadShort, handleList, handleGetVideo, handleUpdate, handleDelete, handleVideoAnalytics } from './handlers';

export const creatorVideos = new Hono<{ Bindings: Env }>();

creatorVideos.post('/upload', async (c) => handleUpload(c.req.raw, c.env));
creatorVideos.post('/short', async (c) => handleUploadShort(c.req.raw, c.env));
creatorVideos.get('/', async (c) => handleList(c.req.raw, c.env));
creatorVideos.get('/:id', async (c) => handleGetVideo(c.req.raw, c.env, c.req.param('id')));
creatorVideos.put('/:id', async (c) => handleUpdate(c.req.raw, c.env, c.req.param('id')));
creatorVideos.delete('/:id', async (c) => handleDelete(c.req.raw, c.env, c.req.param('id')));
creatorVideos.get('/:id/analytics', async (c) => handleVideoAnalytics(c.req.raw, c.env, c.req.param('id')));
