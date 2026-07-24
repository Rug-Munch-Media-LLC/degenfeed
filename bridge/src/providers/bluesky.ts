// ── God code split: moved to bluesky/ directory ────────────────────────
// types.ts    — BskyAuthor, BskyPostView, BskyFeedResponse
// helpers.ts  — guessNiches, extractMediaFromPost
// mapper.ts   — postToUnified
// fetchers.ts — PDS + public API fetchers, main export + schema

export {
  fetch,
  fetchBlueskyImageFeed,
  fetchBlueskyPosts,
  fetchBlueskyTrending,
  fetchBlueskyVideoFeed,
  schema,
} from './bluesky/fetchers';
export { extractMediaFromPost, guessNiches } from './bluesky/helpers';
export { postToUnified } from './bluesky/mapper';
