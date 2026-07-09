# @degenfeed/feed-core

Cross-protocol post normalization, dedupe, and niche detection.

- `buildUnifiedPost()` — wrap a native post into `UnifiedPost`
- `extractEmbeds()` — extract link/image embeds from text
- `detectNiches()` — keyword-based niche tagging
- `dedupeKey()` — canonical `${protocol}:${id}` key

Pure functions. No I/O. No side effects. Easy to test.