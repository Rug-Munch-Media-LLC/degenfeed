# @degenfeed/web

Next.js 14 app — DegenFeed client.

Routes:
- `/` — landing page (public, no sign-in)
- `/home` — For You feed (requires sign-in)
- `/following` — chronological from followed identities
- `/discover` — trending + niches + curated accounts
- `/compose` — compose modal (global, also triggered by `c` keyboard)
- `/[protocol]/[handle]` — unified profile
- `/post/[id]` — post detail with threaded replies
- `/settings` — identity, sign-in methods, ranking weights (advanced)
- `/docs` — documentation

Stack:
- Next.js 14 App Router, RSC where possible
- Tailwind, Radix Primitives, shadcn-style components
- Zustand for client state, TanStack Query for server cache
- All feed data via `/api/feed/*` worker endpoints