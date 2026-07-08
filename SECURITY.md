# Security Policy

## Reporting a Vulnerability

**Do NOT open a public issue for security bugs.**

Instead, send a detailed report to **security@degenfeed.xyz**.

We take all security reports seriously. Good-faith security researchers are protected under our safe harbor policy.

### What to include

- Description of the vulnerability
- Steps to reproduce
- Affected components and versions
- Any proof-of-concept code (if available)
- Your PGP public key for encrypted follow-up (optional)

### Response SLA

| Severity | Acknowledgment | Patch |
|----------|---------------|-------|
| Critical | 24 hours | 7 days |
| High | 48 hours | 14 days |
| Medium | 5 days | 30 days |
| Low | Next release | Next release |

### Public key

A PGP key for `security@degenfeed.xyz` will be published at `/.well-known/security.txt`.

Currently, report via email without encryption. We will acknowledge within 48 hours.

## Supported Versions

| Version | Supported |
|---------|-----------|
| Latest release | YES |
| All prior versions | NO |

Only the latest deployed version receives security patches.

## Scope

- `degenfeed-web` monorepo (all packages and apps)
- Cloudflare Worker (`degenfeed-api`)
- `social.degenfeed.xyz` (GotoSocial instance)
- `degenfeed.xyz` (Cloudflare Pages)

Out of scope: third-party protocol APIs (Nostr relays, Farcaster hubs, Bluesky PDS, etc.).

## Safe Harbor

We will not pursue legal action against security researchers who:

- Make a good-faith effort to avoid privacy violations and data destruction
- Give us reasonable time to fix the issue before disclosing
- Do not exploit the vulnerability beyond what is necessary to demonstrate it

## Disclosure Policy

We follow coordinated disclosure. After a fix is deployed, we will:

1. Publish an advisory with CVE (if applicable)
2. Credit the researcher (unless they prefer anonymity)
3. Update this document with any new guidance
