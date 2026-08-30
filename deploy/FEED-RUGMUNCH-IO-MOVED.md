# feed.rugmunch.io — MOVED to rmi-frontend

**This directory was removed from degenfeed-web on 2026-08-30.**

The static shell for `feed.rugmunch.io` (`index.html` + `/data/posts.json` at
runtime) now lives in **rmi-frontend**:

```
/srv/work/repos/rmi-frontend/deploy/feed.rugmunch.io/index.html
```

## Why

`feed.rugmunch.io` is a **rugmunch.io subdomain** and must be owned by the
rmi-frontend repo (Rug Munch Intelligence brand), not degenfeed-web
(DegenFeed brand). One site = one frontend repo. See
`/srv/work/repos/standards/SITE_OWNERSHIP.md` for the canonical map.

## For devops (nginx re-point — do NOT edit this repo for feed.rugmunch.io)

`/etc/nginx/sites-enabled/feed.rugmunch.io` currently serves
`root /var/www/feed.rugmunch.io`. When re-deploying, build/copy from
`rmi-frontend/deploy/feed.rugmunch.io/` instead of this repo. The Ghost
Content API proxy (`/api/ghost/` → 127.0.0.1:2368) and `/data/posts.json`
runtime data are unchanged.

Branding note: the old informal tab name was replaced to **"Wall of Shame"** in the
moved copy (canonical brand string, see SITE_OWNERSHIP.md).
