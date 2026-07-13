# Feed API

## `GET /feed`

Returns the aggregated timeline.

**Query parameters:**
- `protocols` — comma-separated list of protocol slugs
- `cursor` — pagination cursor
- `limit` — items per page (default 20, max 50)
- `content_type` — `all` | `text` | `media` | `link`

**Response:**
```json
{
  "posts": [ { "id": "...", "protocol": "...", "content": "...", "ranking": {...} } ],
  "next_cursor": "..."
}
```

## `GET /feed/:protocol`

Returns posts from a single protocol. Same parameters as `/feed`.
