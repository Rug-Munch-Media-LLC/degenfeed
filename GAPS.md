# GAPS — What Remains + Next Steps

> Living document of current priorities. Updated daily. Every builder tool reads this.

## Works — Running in Production

| Capability | Where | Notes |
|---|---|---|
| RMI backend (FastAPI) | Talos | `/root/backend/`, `rmi-staging-backend` docker |
| RMI frontend (React 19) | Talos | `/root/frontend/` |
| Postgres + Redis + Qdrant + Neo4j + ClickHouse | Talos | `/srv/rmi-infra/` |
| Ponder EVM indexers | Talos | ETH, BSC, Arbitrum, Polygon — syncing |
| Telegram bot `@rugmunchbot` | Talos | scanner, portfolio, simulate, chart, watch |
| Git bare repos | Talos `/srv/git/` | daily backup to Hydra |
| FlareSolverr + n8n + Ollama | Hydra | ports 8191, 5678, 11434 |
| Builder toolchain | Cinnabox | opencode, aider, hermes |
| Fleet awareness docs + CLI | Cinnabox | `FLEET.md`, `fleet` CLI |
| Dual OpenCode Go accounts | All 3 | primary + backup with separate keys |
| Unified builder context | All 3 | opencode/aider read canonical docs |
| Hardcoded API key cleanup | All 3 | keys moved to wrappers/env |
| New-product bootstrap template | Cinnabox | `~/templates/product-bootstrap/` |
| Model router doc | All 3 | `model-router.md` with task → model mapping |

## In Progress

| Item | Owner |
|---|---|
| Hydra exposed services remediation | security |
| Observability baseline | ops |

## Blockers

*(none — resolved 2026-07-02)*

## Gaps — To Do Next

### High Priority

1. **Talos service bind hardening** (10+ services on `0.0.0.0` violate ADR-0001)
   - Move pgbouncer:6432, neo4j:7474+7687, rmi-backend:8000, opencti:8095, xtm-one:4001, forgejo:3002, minio:9010, open-webui:3000, flaresolverr:8191, anvil:8549, otterscan:5100, pry's uvicorn:8010, openclaw:8090, IPFS 58081-58086 to 127.0.0.1 or Tailscale.
   - Hydra: bind 8443, 25, 143, 587.
   - Owner: security. Day 1 batch 1 in progress.

2. **Git backup pipeline missing**
   - AGENTS.md says "Hydra pulls from Talos daily at 4 AM via `/root/scripts/git-backup.sh`" — script + cron do not exist. Hydra mirrors are 37h+ stale.
   - Owner: ops. Day 1-2 in progress.

3. **Hardcoded secrets in `rmi-backend` (40 gitleaks hits)**
   - Real keys: Solana Tracker `mst_...`, Arkham WS `ws_...`, Stripe `pk_test_...`, Helius webhook secrets.
   - Default ClickHouse password `LangfUse_ch2026` fallback in `app/routers/status_page.py:123`.
   - Owner: security. Day 1 in progress.

4. **Observability baseline**
   - Every product should expose `/health`, `/metrics`, structured logs.
   - Add Prometheus/Loki scrape targets on Hydra.

### Medium Priority

5. **Standards violations in rmi-backend (CI gates disabled)**
   - 17 `time.sleep()` in prod code (should be `asyncio.sleep`).
   - 1698 f-string logs (should be structured).
   - 34 unpinned deps. 6.7% test coverage.
   - CI jobs all `|| true` — never fails.

6. **Renovate broken** — token placeholder, `forgejo` platform unrecognized.

7. **Crash-looping / dead services on Talos** — rmi-lighthouse (1422 restarts), rmi-community (syntax error), rmi-caddy (never started), rmi-dozzle dead, missing Ponder indexers (BSC/Arbitrum/Polygon), 9 dead containers on Hydra.

8. **Documentation contradictions** — old IPs (100.100.18.18, 100.87.38.106), wrong service locations (FlareSolverr/n8n not on Hydra), missing ADRs.

9. **CI/CD parity** across RMI, Pry, WalletPress. rmi-frontend has no `.github/` at all.

10. **Pre-commit hook gaps** — rmi-backend, rmi-frontend, pryscraper missing hooks that walletpress has.

11. **Hermes config bloat** — 11 stale backup files, triple-defined Ollama providers, hardcoded API keys, ollama-remote.env with old IP.

12. **Cinnabox memory pressure** — 6.2/7.6 GB used, 3.1 GB swapped. Docs claim 1.9 GB idle.

### Low Priority

13. **MCP docs** — sourcify not in AGENTS.md list. fleet-ops agent referenced in FLEET.md but not in opencode.jsonc.
14. **Conventional commits polish** — lowercase `merge:` and `a11y` pseudo-type commits.
15. **Web3 commit signing** — documented but not configured.
16. **Tool inventory drift** — commitlint, mkcert documented but not installed; agent/providers.py reference wrong.
17. **Splits** — `pryscraper/api.py` 4668 lines, `MCPDocsPage.tsx` 2489 lines.
18. **Fleet MCP server for opencode.**
19. **Daily standup automation via Hermes/Telegram.**
20. **Weekly CVE scan cron** — vuln-monitor.sh referenced but no cron entry.
21. **DegenFeed `www.degenfeed.xyz` blocked host** — add to ALLOWED_HOSTS.
22. **`requests` library in rmi-backend/requirements.txt** — unused in prod code.
23. **`main.py.bak` 382KB** in rmi-backend git history.
24. **`.openclaw/` legacy dir** — 200+ stale files referencing old IPs.
25. **Cinnabox Docker daemon inactive** — docs claim running.
26. **Hermes daemon state** — docs claim 300MB running, reality unclear.
27. **MINIO_URL / RETH_URL / Temporal / Kestra** — referenced in CONVENTIONS.md env list but not in fleet.

## Today's Recommended Next Step

1. Run `fleet doctor` on all 3 machines to validate the new setup.
2. Remediate Hydra MySQL + Ghost public binds.
3. Add `/health` and `/metrics` endpoints to the next product feature you ship.
4. Pick a product gap and work it.

## How to Update

When closing a gap: move it to **Works**, run `fleet sync-docs`, commit.
When adding a gap: add to **Gaps** with priority and owner, run `fleet sync-docs`.

*Last updated: 2026-07-01*

## See Also

- `PRODUCTS.md` — product catalog
- `FLEET.md` — machine map
- `BUILDER.md` — daily workflow
