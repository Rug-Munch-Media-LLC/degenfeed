/** Podcast routes barrel. */
import { Hono } from 'hono';
import type { Env } from '../../index';
import { jsonResponse } from '../../index';

export {
  CASTOPOD_DEFAULT,
  creatorPodcastsKey,
  DISCOVER_CACHE_KEY,
  episodeKey,
  PODCAST_CATEGORIES,
  podcastEpisodesKey,
  podcastKey,
  TRENDING_CACHE_KEY,
} from './constants';
export type { Podcast, PodcastEpisode } from './types';

const router = new Hono<{ Bindings: Env }>();

// ─── Podcast Routes ───────────────────────────────────────────────────

router.get('/', async (_c) => jsonResponse({ data: [], meta: { total: 0 } }));
router.get('/:id', async (c) => jsonResponse({ data: null, meta: { id: c.req.param('id') } }));
router.get('/:id/episodes', async (c) =>
  jsonResponse({ data: [], meta: { total: 0, id: c.req.param('id') } }),
);
router.get('/categories/:category', async (c) =>
  jsonResponse({ data: [], meta: { total: 0, category: c.req.param('category') } }),
);

export default router;
