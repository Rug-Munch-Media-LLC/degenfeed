# DegenFeed Launch Checklist

> **Owner:** @crmuncher · **Last updated:** 2026-07-20
> **Legend:** ☐ not started · ▷ in progress · ✅ complete · ❌ blocked
> **Readiness score:** See `docs/LAUNCH-CHECKLIST.md` for live QA audit.

---

## Phase 0 — Foundation (Week 1–2)

### Smart Contracts
- [ ] **Deploy DegenFeedFactory to Base Sepolia**
  - Run: `forge create --rpc-url "$BASE_SEPOLIA_RPC" --private-key "$DEPLOYER_KEY" src/DegenFeedFactory.sol:DegenFeedFactory --constructor-args "$IMPLEMENTATION_ADDRESS" "$ZORA_WRAPPER_FACTORY" "$WORMHOLE_BRIDGE"`
  - Verify on BaseScan Sepolia
- [ ] **Deploy DegenFeedCoin implementation**
  - `forge create --rpc-url "$BASE_SEPOLIA_RPC" --private-key "$DEPLOYER_KEY" src/DegenFeedCoin.sol:DegenFeedCoin`
- [ ] **Deploy CrossChainRegistry**
  - `forge create --rpc-url "$BASE_SEPOLIA_RPC" --private-key "$DEPLOYER_KEY" src/CrossChainRegistry.sol:CrossChainRegistry`
- [ ] **Deploy Solana program to devnet**
  - `cd packages/tip-contract/anchor && anchor build && anchor deploy --provider.cluster devnet`
- [ ] **Verify all contracts on block explorers**
  - BaseScan Sepolia for EVM contracts
  - Solana Explorer for Anchor program
- [ ] **Run test transactions on all contracts**
  - Deploy a test creator coin via factory
  - Test buy/sell on bonding curve
  - Test cross-chain registry read/write
- [ ] **Commission third-party security audit**
  - Share `packages/tip-contract/src/` with auditor
  - Remediate findings before mainnet deploy

### Infrastructure — Cloudflare
- [ ] **Deploy Workers API to production**
  - `cd workers/api && wrangler deploy --env production`
  - Verify: `curl https://degenfeed.xyz/api/health`
- [ ] **Deploy Web App to Cloudflare Pages**
  - Push to `main` triggers: `.github/workflows/deploy.yml`
  - Verify: `curl -I https://app.degenfeed.xyz`
- [ ] **Create all KV namespaces**
  - 19 namespaces (see `DEPLOYMENT.md` §2)
  - Update `workers/api/wrangler.toml` with IDs
- [ ] **Set all secrets via `wrangler secret put`**
  - `AUTH_SECRET`, `GTS_CLIENT_SECRET`, `ADMIN_WALLETS`
  - OAuth client secrets (PeerTube, Telegram, Threads, Reddit, Google, GitHub, Discord, Twitter)
  - Creator coin: `PREMIUM_WALLET_KEY`, `NEYNAR_API_KEY`, `NOSTR_PRIVATE_KEY`, `PINATA_API_KEY/SECRET_KEY`
  - Infrastructure: `SENTRY_DSN`, `RMI_API_KEY`, `POSTIZ_API_KEY`
- [ ] **Set all `[vars]` in `wrangler.toml`**
  - Verify `ALLOWED_ORIGINS` includes all production domains
  - Verify all OAuth client IDs, API URLs, RPC URLs
- [ ] **Set GitHub Actions secrets**
  - `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`

### Infrastructure — Self-Hosted
- [ ] **Verify GoToSocial health**
  - `curl -I https://social.degenfeed.xyz/api/v1/instance`
  - Check federation: `.well-known/webfinger`
- [ ] **Verify AT Protocol PDS health**
  - `curl https://pds.degenfeed.xyz/xrpc/_health`
- [ ] **Verify PeerTube health**
  - `curl -I https://video.degenfeed.xyz/api/v1/overviews/videos`
- [ ] **Verify Prosody XMPP health**
  - `curl -I https://chat.degenfeed.xyz`
- [ ] **Verify Redlib proxy**
  - `curl -I https://redlib.degenfeed.xyz`
- [ ] **Verify RSS-Bridge proxy**
  - `curl -I https://rss-bridge.degenfeed.xyz`
- [ ] **Fix Cloudflare tunnel config**
  - Add degenfeed hostnames to tunnel ingress (see `CLOUDFLARE.md`)
  - Regenerate API tokens if expired
- [ ] **Verify all Docker containers healthy**
  - `docker ps --format "table {{.Names}}\t{{.Status}}" | grep -E "(unhealthy|Exited)"`
  - Fix healthcheck commands for lemmy, peertube containers
- [ ] **Fix restart policies**
  - `docker update --restart unless-stopped rmi-backend rmi-anvil` (or any non-restarting containers)

### Infrastructure — Monitoring
- [ ] **Set up GlitchTip (error tracking)**
  - `docker compose -f infra/monitoring/glitchtip.yml up -d`
  - Create projects for `degenfeed-api` and `degenfeed-web`
  - Set `SENTRY_DSN` in worker secrets
  - Verify: send a test error, confirm it appears in GlitchTip
- [ ] **Set up Grafana + Prometheus**
  - `docker compose -f infra/monitoring/docker-compose.yml up -d`
  - Verify: `curl http://localhost:3001/api/health` (Grafana)
  - Verify: `curl http://localhost:9090/-/ready` (Prometheus)
- [ ] **Fix Prometheus scrape targets**
  - `talos-node` (Tailscale route), `hydra-node` (port 9100 path)
  - `degenfeed-worker` (`/api/health`), `degenfeed-social` (`/api/v1/instance`)
- [ ] **Configure alert rules**
  - Rules: disk >85%, target down, backup age >26h, cert expiry <14d, swap >90%
  - Deploy Alertmanager or route via Kuma/n8n
- [ ] **Wire Healthchecks.io**
  - Source `fleet-infra/.env` in `dead-mans-switch.sh`
  - Verify: "Pinged healthchecks.io" in cron logs
- [ ] **Configure dead man's switch**
  - Verify: `/backups/.dead-mans-switch` updated <30 min ago

### Infrastructure — CI/CD
- [ ] **CI pipeline green on `main`**
  - `.github/workflows/ci.yml` passes: lint → typecheck → test → build → gitleaks
- [ ] **Release workflow configured**
  - `.github/workflows/release.yml` — conventional commits → release-please
- [ ] **Deploy workflow tested**
  - `.github/workflows/deploy.yml` — preview deploys on PR, production on tag
- [ ] **Rollback script tested**
  - `./scripts/deploy/rollback.sh --dry-run`
  - Verify it can list worker versions + Pages deployments

### Infrastructure — Storage & Backups
- [ ] **Verify all 4 DBs backing up**
  - Postgres ✅, ClickHouse ✅, Redis ✅, Qdrant ✅
  - Neo4j — fix silent hang in `db-backup.sh`
- [ ] **Fix off-site R2 replication** ❌ Blocking
  - Remove plaintext `backups/` dir from `r2:fleet-backup`
  - Re-run `offsite-backup.sh`
  - Verify: `rclone lsf r2-crypt:backups` returns non-empty
- [ ] **Free disk space on Talos (94% → <80%)**
  - Prune docker images/volumes
  - Rotate ClickHouse/Loki retention
  - Move cold backups off-box
- [ ] **Free disk space on Hydra (100% → <80%)** ❌ Blocking
  - Prune old `/backups/hydra` archives
  - `docker system prune`
  - Add retention cap + disk alert at 85%
- [ ] **Fix swap pressure on Talos**
  - Identify top swap consumers, restart leakers
  - Consider raising RAM limits or trimming container count

---

## Phase 1 — Beta Launch (Week 3–4)

### Users
- [ ] **Recruit 50 beta creators**
  - Target: Farcaster power users, Nostr regulars, Bluesky early adopters
  - Reach out via DMs, DegenFeed social accounts, protocol-native channels
- [ ] **Create onboarding guide**
  - Wallet connection (Solana + EVM)
  - Cross-protocol identity linking
  - First post across protocols
  - Creator coin launch walkthrough
- [ ] **Set up Discord/Telegram support**
  - Invite link in app footer and landing page
  - Bot for common questions
  - Dedicated #beta-feedback channel
- [ ] **Prepare feedback collection system**
  - In-app feedback form (via toast/button)
  - Structured feedback template
  - `POST /api/feedback` endpoint

### Content
- [ ] **Seed trending algorithm with initial data**
  - Run `trending-scraper.ts` cron (already configured: `*/30 * * * *`)
  - Verify trending content appears in feed
- [ ] **Prepare announcement posts**
  - Protocol-native posts (Nostr, Farcaster, Lens, Bluesky, Mastodon)
  - Cross-posted via Postiz integration
  - Coordinated timing across all platforms
- [ ] **Create demo videos / tutorials**
  - Feed walkthrough (30s)
  - Cross-protocol posting (60s)
  - Creator coin launch (90s)
- [ ] **Seed Lemmy communities**
  - Create 5–8 seed communities (memecoins, defi, nfts, security, general)
  - Seed 3–5 posts each
- [ ] **Seed PeerTube videos**
  - Upload 3–5 launch videos or import via yt-dlp federation
  - Livestream test with OBS + RTMP key

### Feed Quality
- [ ] **Fix home feed latency (B4 blocker)**
  - Profile aggregator: parallelize provider fetches
  - Cap per-provider timeout (~2s)
  - Serve stale-while-revalidate from KV cache
  - Target: <2s P95
- [ ] **Fix RSS provider 403**
  - Set custom User-Agent in rss-bridge/fetcher
  - Or proxy via FlareSolverr
- [ ] **Verify 9/9 feed providers healthy**
  - Nostr, Farcaster, Lens, Bluesky, Mastodon, Threads, RSS, Reddit, PeerTube

### First Creator Coin Launch
- [ ] **Select 1–3 creators for initial coin launches**
  - High-signal creators from beta cohort
  - Verify they have linked wallet + minimum reputation
- [ ] **Prep creators with marketing assets**
  - Coin banner image template
  - Launch post template
  - Vesting schedule explanation (Trustless/Balanced/Community/Fast)
- [ ] **Coordinate cross-platform announcement**
  - Protocol-native posts from creator
  - DegenFeed amplification
  - "First creator coin on DegenFeed" narrative

### Testing & QA
- [ ] **Fix API worker test suite (38 failing → 0)**
  - Priority: cors, session, preferences, identity suites
  - Update fixtures for env-driven CORS refactor
- [ ] **Fix root vitest (jsdom resolution)**
  - `pnpm dedupe && pnpm install`
- [ ] **Run full E2E test suite**
  - Auth flow (wallet sign-in, session, logout)
  - Feed rendering (authenticated + anonymous)
  - Composer (write to all protocols)
  - Creator coin (deploy, buy, sell)
  - Cross-chain tipping
- [ ] **Lighthouse audit (after feed latency fix)**
  - Target: 90+ performance, 90+ accessibility, 100 SEO
- [ ] **Mobile responsive verification**
  - Test all major screens at 375px, 768px, 1440px

---

## Phase 2 — Public Launch (Month 2)

### Marketing
- [ ] **Press release**
  - Wire: Decrypt, CoinDesk, The Block, Blockworks
  - Angle: "The first cross-protocol social aggregator with creator coins"
- [ ] **Crypto Twitter / Farcaster announcement campaign**
  - Coordinated thread from DegenFeed handle
  - Quote posts from beta creators
  - Hashtag strategy: #DegenFeed #Web3Social #CreatorCoins
- [ ] **Influencer outreach**
  - Crypto-native creators (Nostr/Farcaster/Bluesky regulars)
  - DeFi yield farmers (creator coin angle)
  - Fediverse advocates (ActivityPub angle)
- [ ] **Product Hunt launch**
  - Prepare listing with assets, demo video, first comment
  - Coordinate upvote wave with beta community
- [ ] **SEO push**
  - Submit sitemap to Google Search Console
  - Target: rank for "web3 social aggregator", "decentralized social feed", "creator coins"
- [ ] **Directory listings**
  - AlternativeTo, G2, Crunchbase, CryptoSlate

### Reliability
- [ ] **Real-time error tracking live**
  - GlitchTip dashboards showing error rates by route
  - Alerts configured for >1% error rate
- [ ] **Volume dashboard**
  - Grafana: requests/min, active users, feed requests, composer actions
  - Plausible: page views, unique visitors, top pages
- [ ] **User growth tracking**
  - New wallet sign-ins per day
  - Linked identities per user
  - DAU/WAU funnel
- [ ] **Revenue dashboard**
  - Premium subscriptions (Stars-based)
  - Creator coin volume
  - Cross-chain tip volume
- [ ] **Load test**
  - Simulate 1000 concurrent feed requests
  - Verify rate limiting holds
  - Verify KV doesn't throttle under load

### Legal & Compliance
- [ ] **Privacy policy final review**
  - Cover: cookies, wallet data, protocol data, third-party APIs
  - GDPR/ePrivacy: cookie consent decision documented
- [ ] **Terms of service final review**
  - Cover: user-generated content, creator coins (not securities disclaimer), tipping
- [ ] **Community guidelines published**
  - Available at `/guidelines`
  - Moderation process documented

---

## Phase 3 — Post-Launch (Month 3+)

### Product
- [ ] **Mobile app (React Native or PWA enhancement)**
  - Already scaffolded in `mobile/` (Capacitor)
  - Push notifications via Web Push (VAPID keys configured)
  - Test iOS + Android builds
- [ ] **Partnership integrations**
  - Additional protocol support (Telegram as full protocol, not just notification)
  - Zora NFT minting from feed
  - Degen tipping via rmi-backend
- [ ] **DAI / stablecoin tipping**
  - Beyond ETH/SOL: DAI, USDC, USDT
  - Cross-chain via Wormhole
- [ ] **DAO governance for platform fees**
  - `GOVERNANCE` KV already configured
  - Token-based voting on fee splits
  - Creator coin fee allocation proposals

### Growth
- [ ] **Referral program**
  - Each user gets a unique invite link
  - Referral rewards in platform currency
- [ ] **Analytics dashboard for creators**
  - Post reach across protocols
  - Coin holder demographics
  - Tip revenue breakdown
- [ ] **API for third-party developers**
  - Scoped API keys (already implemented)
  - Rate-limited tiers (free/premium)
  - Documentation at `docs.degenfeed.xyz`

### Infrastructure Scaling
- [ ] **KV capacity review**
  - Monitor KV read/write units
  - Consider D1 or DO for high-write workloads
- [ ] **CDN optimization**
  - Verify Cloudflare cache hit ratio >70%
  - Add cache rules for static assets
- [ ] **Database scaling**
  - Monitor Postgres/ClickHouse/Qdrant sizes
  - Plan archival strategy for cold data

---

## Blockers Tracking

| # | Blocker | Phase | Owner | Status |
|---|---------|-------|-------|--------|
| B1 | Hydra disk 100% full | Foundation | DevOps | ❌ |
| B2 | Off-site R2 sync broken (0 bytes) | Foundation | DevOps | ❌ |
| B3 | Neo4j backup silent failure | Foundation | DevOps | ❌ |
| B4 | Home feed latency 10–23s | Beta | Backend | ❌ |
| B5 | Talos disk 94% full | Foundation | DevOps | ❌ |
| B6 | CF API tokens expired | Foundation | Ops | ❌ |
| B7 | Test suite 38 failing | Beta | QA | ❌ |

---

## Rollback Criteria

If any of these trigger during launch, **halt and rollback**:

1. Feed error rate >5% for 5 consecutive minutes
2. Wallet sign-in failure rate >10%
3. Creator coin deploy failures >20%
4. KV write error rate >1%
5. Any security incident (unauthorized access, fund loss)
6. Cloudflare 5xx rate >2% for >10 minutes

Rollback: `make rollback` or `./scripts/deploy/rollback.sh`

---

## Launch Day Runbook

### T-24h
- [ ] Final health check: `./scripts/health-check.sh`
- [ ] Verify all 9 feed providers returning data
- [ ] Verify wallet sign-in (Solana + EVM)
- [ ] Verify creator coin deploy on testnet
- [ ] Verify cross-chain tip flow on testnet
- [ ] Check disk space on Talos + Hydra
- [ ] Verify off-site backups complete
- [ ] Check GlitchTip for recent errors
- [ ] Run `make ci` one last time

### T-1h
- [ ] Deploy any last-minute fixes (with full CI pass)
- [ ] Confirm GlitchTip + Grafana dashboards accessible
- [ ] Set up `wrangler tail` for live log monitoring
- [ ] Notify support team (Discord/Telegram)

### T-0 (Launch)
- [ ] Publish announcement posts across all protocols
- [ ] Flip any feature flags to 100%
- [ ] Watch error rates for 15 minutes
- [ ] Monitor feed latency in Grafana

### T+1h
- [ ] Verify new user sign-ups appearing
- [ ] Check feed quality (no empty returns, no spam)
- [ ] Confirm creator coin transactions work
- [ ] Review GlitchTip for any new error patterns

### T+24h
- [ ] Review first day metrics (users, feed views, coins deployed)
- [ ] Address any P1 feedback from beta users
- [ ] Publish launch retrospective + metrics

---

*See also: `docs/LAUNCH-CHECKLIST.md` (live QA audit), `docs/SEO-CHECKLIST.md`, `DEPLOYMENT.md`, `ARCHITECTURE.md`*
