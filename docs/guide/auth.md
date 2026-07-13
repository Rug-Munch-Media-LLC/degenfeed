# Authentication

DegenFeed supports multiple authentication methods depending on the protocol and action.

## Wallet Sign-In (Primary)

- **Solana** via `@solana/wallet-adapter-react`
- **EVM** via Wagmi + Reown AppKit (Ethereum, Polygon, Arbitrum, Base)
- Sign a SIWS / SIWE message to prove ownership
- Session stored client-side, verified at the edge worker

## Protocol Native Auth

- **Nostr:** sign in with nsec (or nip-07 extension)
- **Farcaster:** sign in with FID + signed key
- **Lens:** sign in with Lens profile
- **Bluesky / Mastodon / Threads / Reddit:** OAuth 2.0 flow
