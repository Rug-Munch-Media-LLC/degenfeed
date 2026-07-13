# API Overview

The DegenFeed Edge API (`degenfeed-api`) is a Cloudflare Worker serving as the aggregation, auth, and publishing proxy. Base URL:

```
https://degenfeed.xyz/api/v1
```

All endpoints return JSON. Authentication is via Bearer token (obtained through wallet sign-in).

## Sections

- **Feed** — fetch and filter the unified timeline
- **Authentication** — wallet sign-in and session management
- **Publishing** — create posts across protocols
- **Engagement** — like, repost, reply
- **Notifications** — unify protocol notifications
- **Preferences** — user settings and protocol configuration
- **Tips** — cross-protocol tipping
- **Features** — feature flags and protocol availability
