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
| Hardcoded API key cleanup | All 3 | keys moved to wrappers/env; remaining 4 external keys (Solana Tracker, Arkham WS, Helius webhook, Stripe) scheduled for rotation |
| New-product bootstrap template | Cinnabox | `~/templates/product-bootstrap/` |
| Model router doc | All 3 | `model-router.md` with task → model mapping |
| RMI backend `/health` | Talos | `http://127.0.0.1:8000/health` now `degraded` — Redis, Postgres, Neo4j, Qdrant, ClickHouse, Minio healthy; ETH RPC still needs an endpoint |
| Git backup pipeline | Talos + Hydra | `fleet-backup` via HF CLI; Hydra `git-backup.sh` mirrors all 18 Forgejo repos nightly |
| External mirror parity | Talos | GitLab + Codeberg pushes verified; GitHub deferred (org flag) |
| HF backup consolidation | Talos | single bucket `cryptorugmunch/fleet-state`; unused buckets deleted |

## In Progress

| Item | Owner |
|---|---|
| Hydra exposed services remediation | security |
| Observability baseline | ops |
| AI-forward coding standards review — 10 prioritized wins | fleet-ops |

## Blockers

*(none — resolved 2026-07-02)*

## Gaps — To Do Next

### High Priority

1. **Talos service bind hardening + old Tailscale IP drift**
   - Qdrant fixed: binds current Tailscale IP `100.104.130.92:6333` + `127.0.0.1:6333`; container healthy.
   - `rmi-backend` health `degraded` with Redis, Postgres, Neo4j, Qdrant, ClickHouse, Minio healthy; ETH RPC still needs an endpoint.
   - Bind-hardened batch 1 complete: pgbouncer stopped, presidio bound to 127.0.0.1, cockpit.socket disabled, ad-hoc caddy on :8443 stopped, rmi-lighthouse removed, prometheus exporters bound to Tailscale IP, gitea removed from infra compose.
   - Still need (lower priority): opencti:8095, xtm-one:4001, open-webui:3000, anvil:8549, otterscan:5100, IPFS 58081-58086 review; neo4j/flaresolverr/forgejo/pry already bound to 127.0.0.1.
   - Hydra: bind 8443, 25, 143, 587, 8002, 8888, 9091, 9100.
   - Owner: security. Day 1 batch 1 done.

2. **Hardcoded secrets in `rmi-backend` (40 gitleaks hits)**
   - The five Telegram bot tokens flagged in `data/cryptoscamdb_urls.yaml` are scammer tokens embedded in scam-site descriptions (indicators of compromise), not our secrets. Added `.gitleaksignore` to suppress these false positives.
   - Real keys still present in git history and need provider-side rotation: Solana Tracker `mst_...`, Arkham WS `ws_...`, Stripe `pk_test_...`, Helius webhook secrets. They were removed from the working tree in commit `f932ac4` but remain in history.
   - Stripe + Helius rotations can be automated via their APIs using current `STRIPE_SECRET_KEY` / `HELIUS_API_KEY`.
   - Solana Tracker + Arkham require dashboard login. Solana Tracker docs (`https://docs.solanatracker.io`) have **no documented API or self-service key-rotation flow**; rotation must be done via the account dashboard at `https://www.solanatracker.io/account` or by contacting support.
   - Owner: security. Day 1 in progress.

3. **Observability baseline**
   - Every product should expose `/health`, `/metrics`, structured logs.
   - Add Prometheus/Loki scrape targets on Hydra.

4. **Make CI gates authoritative**
   - rmi-backend `.github/workflows/ci.yml` uses `continue-on-error: true` and `|| true` on every step.
   - Start failing CI on ruff/format/gitleaks; add mypy/tests once green.

5. **Backend standards autofix campaign**
   - 17 `time.sleep()`, 1,713 f-string logs, 399 `print()`, 1 bare `except`, 5 `sqlite3`, 113 `Any`, 8.61% coverage.
   - See `standards/AI-FORWARD-STANDARDS-REVIEW-2026-07-03.md` for full plan.

6. **Frontend type discipline + CI pipeline**
   - rmi-frontend has no GitHub CI, 850 `any`/`@ts-ignore`, 101 KB `MCPDocsPage.tsx`.

7. **MCP schema/registry hardening**
   - No unified tool registry across RMI/Pry/WalletPress; Pry MCP is a JS worker without Pydantic schemas.

8. **Resurrect dead containers and crash loops**
   - `rmi-community` (syntax error), `rmi-dozzle`, `dreamy_noether`, `rmi-qdrant`; Ponder indexers restart every few seconds.

9. **Repo tooling parity**
   - rmi-frontend, standards, degenfeed-web, fleet-infra lack Makefile/pre-commit/CI parity with walletpress.

10. **AI-forward architecture follow-through**
    - Tool-pull contracts, version-stamped cache keys, deterministic tool schemas per ADR-0005/0007.

### Medium Priority

11. **Renovate broken** — token placeholder, `forgejo` platform unrecognized.

12. **Documentation contradictions** — old IPs (100.100.18.18, 100.87.38.106), wrong service locations, missing ADRs, stale file-size claims (Pry `api.py` is 933 lines, not 4,668).

13. **Hermes config bloat** — 11 stale backup files, triple-defined Ollama providers, hardcoded API keys, ollama-remote.env with old IP.

14. **Cinnabox memory pressure** — 6.2/7.6 GB used, 3.1 GB swapped. Docs claim 1.9 GB idle.

15. **DegenFeed `www.degenfeed.xyz` blocked host** — add to ALLOWED_HOSTS.

16. **`requests` library in rmi-backend/requirements.txt** — only one prod import remains (`x402_docs_v2.py`); migrate to `httpx` and remove.

17. **`main.py.bak` 382KB** in rmi-backend git history.

18. **`.openclaw/` legacy dir** — 200+ stale files referencing old IPs.

19. **Cinnabox Docker daemon inactive** — docs claim running.

20. **Hermes daemon state** — docs claim 300MB running, reality unclear.

21. **MINIO_URL / RETH_URL / Temporal / Kestra** — referenced in CONVENTIONS.md env list but not in fleet.

### Low Priority

22. **MCP docs** — sourcify not in AGENTS.md list. fleet-ops agent referenced in FLEET.md but not in opencode.jsonc.

23. **Conventional commits polish** — lowercase `merge:` and `a11y` pseudo-type commits.

24. **Web3 commit signing** — documented but not configured.

25. **Tool inventory drift** — commitlint, mkcert documented but not installed; agent/providers.py reference wrong.

26. **Fleet MCP server for opencode.**

27. **Daily standup automation via Hermes/Telegram.**

28. **Weekly CVE scan cron** — vuln-monitor.sh referenced but no cron entry.

## Today's Recommended Next Step

1. Rotate leaked secrets (Win #3): Solana Tracker, Arkham WS, Helius webhook, Stripe, and 5 Telegram bot tokens in git history.
2. Review remaining lower-priority public binds (opencti, xtm-one, open-webui, anvil, otterscan, IPFS).
3. Provide a real ETH RPC endpoint or remove `eth_rpc` from the critical health path.

## How to Update

When closing a gap: move it to **Works**, run `fleet sync-docs`, commit.
When adding a gap: add to **Gaps** with priority and owner, run `fleet sync-docs`.

*Last updated: 2026-07-03*

## See Also

- `PRODUCTS.md` — product catalog
- `FLEET.md` — machine map
- `BUILDER.md` — daily workflow
