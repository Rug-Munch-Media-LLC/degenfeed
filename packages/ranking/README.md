# @degenfeed/ranking

Transparent, explainable feed ranking. No ML. No black box.

- `score(post, ctx)` — single-post score with all components
- `rank(posts, ctx)` — sort a feed
- `recencyDecay()` — half-life based
- `WEIGHTS` — versioned constants, user-overridable in v1.1

Ranking factors:
- Engagement (likes, reposts, replies)
- Engagement rate (likes/views)
- Recency (12h half-life)
- Follow boost
- Niche match
- Source quality (curated lists)
- Diversity penalty (avoid same-author dominance)