# REMAINING — Day 2+ work after Day 1+2 sweep (2026-07-02)

> Day 1+2 completed: 9 of the 12 critical/high items.
> 3 items still need user action, plus all of Tier 2+3.
> This file is the "rememory" — every open item and its exact unblocker.

---

## STILL OPEN — User action required

### A. Rotate + purge the actual API keys (1.1 partial)

**Status:** Source code references removed; env var stubs added. Actual key values still need setting.

**What to do:**

1. **Rotate each key at the provider** (provider web console, not via SSH):
   - Solana Tracker (`st_ZMzXzdUI54TXQPx5E6JkG`): log in to solanatracker.io, regenerate API key
   - Arkham WS (`ws_Z5x09Rcr_1780418740765322917`): log in to arkhamintelligence.com, regenerate WS key
   - Helius webhook (`helius-rmi-wh-2024` / `rmi_helius_wh_secret_2024`): dashboard.helius.dev → Webhooks → rotate
   - Stripe (`pk_test_51Tn13MA...`): dashboard.stripe.com → Developers → API keys → roll

2. **Set new values in gopass on Cinnabox:**
   ```bash
   gopass insert rmi/prod/solana_tracker
   gopass insert rmi/prod/arkham_ws
   gopass insert rmi/prod/helius_webhook_auth
   gopass insert rmi/prod/helius_webhook_secret
   gopass insert rmi/prod/stripe_publishable
   gopass insert rmi/prod/stripe_secret
   ```

3. **Replace placeholders in /srv/rmi-infra/.env.secrets** on Talos:
   - `SOLANA_TRACKER_API_KEY=<set-in-gopass-rmi/prod/solana_tracker>` → actual value
   - Same for the 5 other lines
   - `gopass show -o rmi/prod/solana_tracker | ssh netcup "cat >> /srv/rmi-infra/.env.secrets"`

4. **Purge keys from git history** (DESTRUCTIVE — coordinate first):
   ```bash
   # On Cinnabox, install: pip install git-filter-repo
   # On Talos, in /srv/work/repos/rmi-backend:
   git filter-repo --invert-paths --path app/caching_shield/solana_tracker.py \
       --path app/databus/arkham_ws.py \
       --path app/routers/webhooks_router.py \
       --path app/routers/stripe_integration.py \
       --force
   # Then force-push: git push origin --force --all
   # And re-clone /srv/work/repos/rmi-backend, /srv/git/rmi-backend.git
   ```
   This rewrites ALL commits. Other clones must re-clone. External remotes will be force-updated.

5. **Restart the backend** so it picks up the new env values:
   ```bash
   ssh netcup "cd /srv/rugmuncher-backend && docker compose up -d rmi-backend"
   ```

### B. Set the Forgejo PAT for Renovate (2.5 partial)

**Status:** Platform mismatch fixed (forgejo → gitea). Token still placeholder.

**What to do:**

1. Log in to `https://git.rugmunch.io` as `cryptorugmunch`
2. Go to Settings → Applications → Generate Token
3. Scopes: `repository`, `write:repository`, `admin:organization`, `admin:org_hook`
4. Edit `/etc/renovate/env` on Talos — replace `PASTE_TOKEN_HERE` with the token
5. Test: `/usr/local/bin/renovate-run.sh` and check `/var/log/renovate/renovate-runtime-*.log`

### C. Add git credentials for external remotes (1.2 partial)

**Status:** External remote URLs added to rmi-backend. Credentials not set.

**What to do:**

1. Generate PATs at each platform (GitHub, GitLab, HuggingFace) with `repo` scope
2. On Talos, create `/root/.git-credentials` (chmod 600):
   ```
   https://cryptorugmunch:<GH_TOKEN>@github.com
   https://cryptorugmunch:<GL_TOKEN>@gitlab.com
   https://cryptorugmunch:<HF_TOKEN>@huggingface.co
   ```
3. `git config --global credential.helper store`
4. Test: `cd /srv/work/repos/rmi-backend && /root/scripts/external-push.sh`

---

## STILL OPEN — More bind hardening (1.3 batch 2)

The 3 services rebound today (neo4j, forgejo, flaresolverr). **9 more services on 0.0.0.0 remain:**

| Container | Port | Compose file | Action |
|---|---|---|---|
| `opencti-opencti-1` | 8095 | `/srv/opencti/docker-compose.yml` | Change `${OPENCTI_PORT}:8080` to `127.0.0.1:${OPENCTI_PORT}:8080` |
| `opencti-xtm-one-1` | 4001 | `/srv/opencti/docker-compose.yml` | Same pattern |
| `opencti-minio-1` | 9010 | `/srv/opencti/docker-compose.yml` | Change `9010:9000` to `127.0.0.1:9010:9000` |
| `open-webui` | 3000 | (find compose) | Bind to 127.0.0.1 |
| `rmi-anvil` | 8549 | (find compose) | Devnet only — can be 127.0.0.1 |
| `rmi-backend` | 8000 | `/srv/rugmuncher-backend/docker-compose.yml` | Bind to 127.0.0.1 (Talos 8004 alias already exists) |
| `rmi-otterscan` | 5100 | `/srv/otterscan/docker-compose.yml` | Bind to 127.0.0.1 |
| `rmi-ipfs*` | 58081-58086 | (find compose) | Bind to 127.0.0.1 (only used internally) |
| Hydra: `8443` | 8443 | (unknown) | Identify service, then bind to 127.0.0.1 |
| Hydra: `25, 143, 587` | mail | (postfix) | Bind to 127.0.0.1 if no external mail |

Verify cloudflared still has ingress rules for any of these that need to be public.

---

## STILL OPEN — Tier 2 (this week)

- **2.1** Replace `time.sleep()` with `asyncio.sleep()` in 17 sites in rmi-backend (`app/free_solcan_client.py` lines 64, 73, 252, 266, 280; `app/oracle_manipulation_detector.py:1287`; `app/analyzer/multi_chain.py:57`; `app/degen_security_scanner.py` 6 calls; `app/routers/x402_enrichment.py:823`; `app/ai_pipeline_v3.py:107`; `app/rmi_dashboard.py` 2 calls)
- **2.2** Convert 1698 f-string logs to structured in rmi-backend, 111 in walletpress. Suggested: regex script first, manual review top 50 events.
- **2.3** Pin all deps with `==` in rmi-backend (34), pryscraper (16), walletpress. `pip freeze > requirements-lock.txt`.
- **2.4** Remove `|| true` and `continue-on-error: true` from rmi-backend CI. Pay down lint debt in batches.
- **2.8** Create real ADR documents (ADR-0001 through ADR-0012) in `/srv/work/repos/standards/ADR-*.md`. Format: status, context, decision, consequences, alternatives.
- **2.9** Sweep docs for IP/port/service-location contradictions. Single edit pass + `fleet sync-docs`.
- **2.10** Add missing pre-commit hooks to rmi-backend (bandit, hallucination-check), rmi-frontend (full set), pryscraper (bandit, detect-private-keys, no-commit-to-branch).
- **2.11** Remove hardcoded API keys from `hermes/config.yaml` (Groq x2, KiloCode, MiniMax, NVIDIA). Use `api_key_env:` pattern.
- **2.12** Cinnabox memory pressure (6.2/7.6GB, 3.1GB swap). Reduce concurrent opencode sessions.

---

## STILL OPEN — Tier 3 (this sprint)

- **3.1** Clean Hermes backup clutter: 11 `config.yaml.bak.*`, 1 `cron/jobs.json.bak*`, 1 `disk-cleanup/tracked.json.bak` — keep only most recent of each.
- **3.2** Consolidate triple-defined Ollama providers in `hermes/config.yaml` (netcup-ollama, fallback_providers[0], custom_providers[slug: netcup-ollama] all duplicate).
- **3.3** Consolidate `ollama-cloud-primary` + `ollama-cloud-backup` (220 lines duplicate, conflicting `max_tokens`).
- **3.4** Remove dead containers: Talos (`rmi-caddy`, `rmi-dozzle`, `dreamy_noether`, `rmi-community`); Hydra (9 dead).
- **3.5** Hydradisk cleanup: `docker image prune -a` (21.87GB reclaimable), prune volumes.
- **3.6** Add CI to rmi-frontend (Biome + TypeScript + Vitest + npm audit).
- **3.7** Implement payment-failed handler `app/routers/subscription_pricing_api.py:682-683` (currently `pass`).
- **3.8** Verify on-chain subscription tx `app/routers/subscription_pricing_api.py:545` before activating.
- **3.9** Add JWT/API-key guards to MCP `analytics_query` (`mcp/server.py:563`) and `supabase_oauth_router.py:386`.
- **3.10** Add coverage threshold to CI (current 6.7%, target 80% on new code).
- **3.11** Update commitlint to reject `merge:` lowercase + `a11y:` pseudo-type.
- **3.13** Configure GPG commit signing per TOOLCHAIN.md.
- **3.14** Update MACHINE.md / BUILDER.md runtime claims: Docker inactive, Hermes state, Mint 22.3, kernel 6.17, memory pressure 6.2/7.6GB.
- **3.15** Add sourcify MCP + `fleet-ops` agent to AGENTS.md (currently listed in FLEET.md but not in opencode.jsonc).
- **3.16** Fix `rmi-community` syntax error or remove container.
- **3.17** Add `www.degenfeed.xyz` to DegenFeed `ALLOWED_HOSTS` (logs show "Blocked hosts: www.degenfeed.xyz").

---

## STILL OPEN — Tier 4 (when convenient)

- Standardize git author emails to `admin@rugmunch.io` across machines. **Done**: all 3 machines, all 16 repos.
- Symlink `bin/ai` → `bin/aider` (one canonical wrapper).
- Remove `main.py.bak` (382KB) from rmi-backend git history.
- Remove unused `requests` from `rmi-backend/requirements.txt`.
- Install `commitlint` + `mkcert` or remove from docs.
- Replace `console.log` (24 in rmi-frontend) with structured logger.
- Split `pryscraper/api.py` (4668 lines), `MCPDocsPage.tsx` (2489), `BotOperatorDashboard.tsx` (1144).
- Archive/remove `.openclaw/` legacy dir (200+ stale files).
- Clean up Hydra port `8443` (unidentified service).
- Remove `requests` from rmi-backend requirements (unused in prod code).

---

## Verified today (Day 1+2)

| ID | Item | Evidence |
|---|---|---|
| 1.4 | GAPS.md false blocker | Removed; GAPS.md now shows "no blockers" with full Day 1+2 work-in-progress items |
| 1.5 | .env SUDO_PASSWORD | `grep -c SUDO_PASSWORD /home/dev/.hermes/.env` → 0 |
| 1.6 | CH_PASSWORD default + 116 REDIS_PASSWORD fallbacks | `sed` replaced; `grep` confirms 0 remaining |
| 1.3 batch 1 | neo4j rebound | `127.0.0.1:7474`, `127.0.0.1:7687`; HTTP 200 from localhost AND from `rmi-backend` container |
| 1.3 batch 1 | forgejo rebound | `127.0.0.1:3002`; HTTP 200; `git.rugmunch.io` still works via cloudflared |
| 1.3 batch 1 | flaresolverr rebound | `127.0.0.1:8191`; HTTP 200 |
| 2.6 | rmi-lighthouse | `RestartCount=0`, `Up About a minute` (was 1422 restarts). New JWT in `/srv/reth/jwtsecret/jwt.hex`. Lighthouse is in degraded mode (no Reth at 8551) but no more crash loop. |
| 2.7 | Ponder indexers | 4 of 4 running: rmi-ponder (ETH), rmi-ponder-bsc, rmi-ponder-polygon, rmi-ponder-arbitrum. Each on 127.0.0.1, indexed events flowing. Compose files at `/srv/ponder-{bsc,polygon,arbitrum}/docker-compose.yml`. (The npm-rollup issue was worked around by removing the bind-mount of node_modules so the Dockerfile's COPY wins.) |
| 2.5 | Renovate platform | `RENOVATE_PLATFORM=forgejo` → `gitea` in `/usr/local/bin/renovate-run.sh`. Token still placeholder — user action needed. |
| 1.1 partial | Secret env migration | `app/caching_shield/solana_tracker.py`, `app/databus/arkham_ws.py`, `app/routers/webhooks_router.py`, `app/routers/stripe_integration.py` all read from env vars now. Placeholder env lines added to `/srv/rmi-infra/.env.secrets`. Actual key rotation at provider = user action. |
| 1.2 | git backup | `/root/scripts/git-backup.sh` on Hydra, `0 4 * * *` cron. Tested: 4 mirrors fresh (gopass fresh-cloned, pry/rmi-backend/walletpress re-pointed + fetched). External remotes added to rmi-backend (4 URLs). External-push script + `0 6 * * 0` cron. Credentials = user action. |
| (bonus) | Hydra SSH config | `100.100.18.18` → `100.104.130.92` and `100.87.38.106` → `100.64.135.3` in `/root/.ssh/config`. |

## What was deployed, NOT tested end-to-end

- **Ponder indexers** (BSC, Polygon, Arbitrum): they are running and indexing events, but no DB query was done to verify the data is landing in `ponder_*` tables. Check with `psql -d ponder_bsc -c 'SELECT count(*) FROM "Transfer"'` after 1h.
- **Lighthouse** is running consensus-only (no execution layer). To restore full functionality, deploy Reth at `127.0.0.1:8551`. Until then, Lighthouse syncs but doesn't validate.
- **External push**: cron is scheduled but will fail until credentials are in `/root/.git-credentials` on Talos.

---

*Last updated: 2026-07-02 23:55 UTC — Day 1+2 closeout*
