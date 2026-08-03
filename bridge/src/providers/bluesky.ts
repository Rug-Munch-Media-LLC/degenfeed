// ── God code split: moved to bluesky/ directory ────────────────────────
// types.ts    — BskyAuthor, BskyPostView, BskyFeedResponse
// helpers.ts  — guessNiches, extractMediaFromPost, rich-text facets
// mapper.ts   — postToUnified
// fetchers.ts — PDS + AppView fetchers, trending, custom feeds, main export
// firehose.ts — Jetstream real-time subscriber

export {
  fetch,
  fetchBlueskyImageFeed,
  fetchBlueskyPosts,
  fetchBlueskyTrending,
  fetchBlueskyVideoFeed,
  schema,
} from './bluesky/fetchers';
export { getFirehosePosts, firehoseStatus, startFirehose } from './bluesky/firehose';
export { extractMediaFromPost, guessNiches } from './bluesky/helpers';
export { postToUnified } from './bluesky/mapper';
