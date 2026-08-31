---
sidebar_position: 3
title: Self-Host Quickstart
---

# Self-Host Quickstart

Run your own DegenFeed instance. Own everything — your domain, your content,
your creator coin, your data. We just provide the software.

## Prerequisites

- **Node.js >= 20** and **pnpm**
- A Linux server (systemd) with ports 80/443 free
- A domain pointed at your server

## 1. Get the code

```bash
git clone https://git.rugmunch.io/RugMunchMedia/degenfeed-web.git degenfeed
cd degenfeed
pnpm install
```

## 2. Configure

```bash
cp apps/web/.env.example apps/web/.env.local
cp bridge/.env.example bridge/.env 2>/dev/null || true
```

At minimum set:

- `BRIDGE_API_KEY` — shared secret between the app and the bridge (see [API](/docs/api))
- Protocol credentials for anything you want to **write** to
  (`MASTODON_ACCESS_TOKEN`, `BLUESKY_CROSSPOST_JWT`, Nostr nsec,
  `FARCASTER_BOT_FID` + `FARCASTER_BOT_SIGNER_KEY`, …)

## 3. Build the app (standalone)

The production app runs as a **Next.js standalone** server:

```bash
bash deploy/build-standalone.sh
```

This builds `apps/web` and assembles `apps/web/.next/standalone` (copying
`public/` and `.next/static` into it).

## 4. Run under systemd

Two services make up a minimal install:

- `degenfeed-web.service` — Next.js standalone app on `127.0.0.1:3100`
- `degenfeed-bridge.service` — feed API bridge on `127.0.0.1:8787`

```ini
# /etc/systemd/system/degenfeed-web.service
[Unit]
Description=DegenFeed web app
After=network.target

[Service]
WorkingDirectory=/opt/degenfeed/apps/web/.next/standalone
ExecStart=/usr/bin/node server.js
Environment=PORT=3100 HOSTNAME=127.0.0.1
Restart=always

[Install]
WantedBy=multi-user.target
```

```ini
# /etc/systemd/system/degenfeed-bridge.service
[Unit]
Description=DegenFeed protocol bridge (feed API)
After=network.target

[Service]
WorkingDirectory=/opt/degenfeed/bridge
ExecStart=/usr/bin/node dist/server/index.js
Environment=PORT=8787
Restart=always

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now degenfeed-web degenfeed-bridge
```

## 5. Put nginx in front

```
degenfeed.xyz  →  127.0.0.1:3100   (the app)
api.degenfeed.xyz  →  127.0.0.1:8787   (the feed API)
```

Terminate TLS at nginx (Let's Encrypt) and proxy to the loopback services.

## One-command install

Prefer zero setup? The installer does DNS checks, nginx, TLS, and systemd for
you:

```bash
curl -sSL https://degenfeed.xyz/install.sh | bash
```

## Next steps

- [Architecture](/docs/architecture) — how the pieces fit together
- [Feed API](/docs/api) — query your instance's feed
- [Protocols](/docs/protocols) — enable write paths per protocol
