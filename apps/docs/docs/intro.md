---
sidebar_position: 1
slug: /
title: What is DegenFeed?
---

# What is DegenFeed?

DegenFeed is a **read-mostly aggregator with a write path that grows per
protocol**. It pulls content from **20+ decentralized protocols** — Mastodon,
Bluesky, Nostr, Farcaster, Lens, Lemmy, PeerTube, Pixelfed, Reddit, RSS,
YouTube, and more — into **one unified feed**, and lets you write back to the
protocols you own.

## The idea

Every decentralized social protocol has its own app, its own timeline, its own
identity. DegenFeed collapses them:

- **One feed** — a single timeline ranked by recency or trending score, built
  from 70+ providers running in the [bridge](architecture).
- **One composer** — write once, publish to Nostr, Farcaster, Bluesky, and
  Mastodon (with background cross-posting to Lens, PeerTube, Pixelfed, and
  WriteFreely).
- **One identity** — connect a wallet, verify your handles, and your creator
  coin, tips, and audience follow you across protocols.

## What you can do with it

| Use case | Where to read |
|---|---|
| Understand which protocols we connect to and how | [Protocols](/docs/protocols) |
| Run your own instance | [Self-Host Quickstart](/docs/quickstart) |
| Understand the monorepo and data flow | [Architecture](/docs/architecture) |
| Build against the feed API | [Feed API](/docs/api) |

## Open source

DegenFeed is **AGPL-3.0** open source. The full source lives at
[git.rugmunch.io/RugMunchMedia/degenfeed-web](https://git.rugmunch.io/RugMunchMedia/degenfeed-web)
(mirrors: GitLab, Codeberg). You can inspect, fork, and self-host every line of
code — we host nothing for you.
