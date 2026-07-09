---
title: AGENTS.md — Server Contract for AI Agents
status: canonical
owner: Rug Munch Media LLC Engineering
last_updated: 2026-07-09 (quality gates overhaul — Biome 30 a11y rules, Stylelint, Lighthouse CI, Axe-core, semgrep fleet-wide, mise, fleet-infra rebuild, multi-agent opencode setup, spec-driven dev)
audience:
  - agents
  - engineers
  - operators
note: Single source of truth. Every AI agent reads this first.
built_with:
  - builder_menu: type `menu` on any machine
  - pre_commit: lefthook + ruff, mypy, biome, dprint, gitleaks, deptry, cspell
  - ai_review: .github/workflows/ai-review.yml (OpenRouter-compatible, PR comments)
  - conventional_commits: commitizen + commitlint
  - ci_cd: GitHub Actions (lint + test + security)
  - makefile: standardized targets (lint, test, check, dev)
  - ide_vscode: Continue.dev + Kilo Code
  - ai_providers: 20 providers, BYOK, Ollama auto-detect
  - dev_env: mise, .editorconfig, mkcert
  - prompts_library: ~/.ai-prompts/ (review, commit, test, security)
---

# AGENTS.md — The Contract

## Fleet

| Machine | Role | Tailscale | Specs |
|---------|------|-----------|-------|
| **Cinnabox** | Builder + Gateway | 100.74.164.114 | i5-6200U, 7.6GB, 230GB SSD (V110) |
| **Talos** (netcup) | **PRODUCTION** | 100.104.130.92 | 12c EPYC, 31GB, 1TB |
| **Hydra** (contabo) | Standby + Observability | 100.64.135.3 | 8c EPYC, 23GB, 193GB |

## Rules

1. **ALL WORK ON NETCUP.** Cinnabox is just a terminal.
2. **NO OLLAMA ON CINNABOX.** Use `http://100.104.130.92:11434` (Talos) or `http://100.64.135.3:11434` (Hydra).
3. **NO LONG-RUNNING SERVICES ON CINNABOX.** No Docker, no cron, no databases.
4. **NO .ENV IN GIT.** Use gopass for secrets.
5. **SSH VIA TAILSCALE.** `ssh netcup` / `ssh contabo`.
6. **NO AI AGENTS LOCALLY.** Except opencode + aider (~200MB each).

## Products (Rug Munch Media LLC)

All products built on Talos under Rug Munch Media LLC. Separate git repos. No monorepo.

| Product | Code repo (Forgejo) | Deploy path | Type | Status |
|---------|----------------------|-------------|------|--------|
| **RMI Backend** | `/srv/work/repos/rmi-backend/` | `/root/backend/` (data+compose) | FastAPI | Production |
| **RMI Frontend** | `/srv/work/repos/rmi-frontend/` | (static build → tunnel) | React 19 | Production |
| **Pry (munchcrawl)** | `/srv/work/repos/pryscraper/` | `/srv/pry/` | Python CLI + API | Active dev |
| **WalletPress** | `/srv/work/repos/walletpress/` | `/srv/walletpress/` | Python + WP plugin | Active dev |
| **DegenFeed** | `/srv/work/repos/degenfeed-web/` | `/srv/degenfeed/` | GotoSocial v0.22.0 + Next.js client | Active dev |

> **CRITICAL — where to edit code vs where it deploys:**
> - **EDIT CODE** in `/srv/work/repos/<product>/` (these are Forgejo git clones — the source of truth).
> - **DEPLOY** from `/root/backend/`, `/srv/pry/`, `/srv/walletpress/` (docker-compose + data volumes).
> - `/root/backend/` is **NOT a git repo** and **NOT where you edit code** — it only holds `.rmi/` data, `.secrets/`, and the deployment compose. The running `rmi-backend` container was built from the Forgejo repo image.
> - Legacy bare repos at `/srv/git/` still exist but **Forgejo (`/srv/work/repos/`) is primary**.

## Where Things Live

**Talos (netcup)** — PRODUCTION:

*Code repos (Forgejo clones — EDIT CODE HERE):*
- `/srv/work/repos/rmi-backend/` — rmi-backend (FastAPI, SQLAlchemy, Redis, Celery)
- `/srv/work/repos/rmi-frontend/` — rmi-frontend (React 19, Vite, Tailwind, Radix)
- `/srv/work/repos/degenfeed-web/` — DegenFeed Next.js aggregator client (Turborepo)
- `/srv/work/repos/pryscraper/` — Pry (Python CLI + API)
- `/srv/work/repos/walletpress/` — WalletPress (Python + WP plugin)
- `/srv/work/repos/fleet-infra/` — infra as code (nginx, systemd, compose, scripts)
- `/srv/work/repos/fleet-template/` — scaffold for new repos
- `/srv/work/repos/standards/` — AGENTS.md, STANDARDS.md, CONVENTIONS.md, TOOLCHAIN.md
- Active: rmi-docs, rmi-local-services, rmi-rag, rmi-mcp-x402
- Archived / vaporware: rugmunchbot, rugcharts, rugmaps, x402-gateway (not deployed or superseded)

*Deploy paths (docker-compose + data — DO NOT EDIT CODE HERE):*
- `/root/backend/` — rmi-backend deploy dir (`.rmi/` data, `.secrets/`, compose) — NOT a git repo
- `/srv/pry/` — Pry deployed (FastAPI + CLI)
- `/srv/walletpress/` — WalletPress deployed
- `/srv/degenfeed/` — DegenFeed GotoSocial (compose + media volume)
- `/srv/rmi-infra/` — infra compose (postgres, redis, qdrant, neo4j, clickhouse)
- `/srv/rmi-local-services/` — Ghost + n8n + RugFeed Poster
- `/srv/opencti/` — OpenCTI + XTM One (ports 8095 / 4001)

*Git + tooling:*
- `/srv/git/` — legacy bare git repos (rmi-backend.git, pry.git, walletpress.git) — Forgejo is primary now
- `/root/scripts/` — server scripts
- `/root/.hermes/` — Hermes config + gateway
- Forgejo web UI: `git.rugmunch.io` (container `rmi-forgejo`)

**Hydra (contabo)** — STANDBY + OBSERVABILITY:
- `/root/docker-compose.yml` — batch jobs, DR replicas, n8n, registry
- `/srv/git-backup/` — git bare repo mirrors (daily cron from Talos)
- n8n on port 5678
- Ollama on port 11434 (free model proxy)

**Local services moved to Talos (July 2026):**
- FlareSolverr on `100.104.130.92:8191` (Cloudflare bypass)
- open-webui on `100.104.130.92:3000`
- freqtrade (dry-run) on Talos
- OpenCTI on `100.104.130.92:8095`
- XTM One on `100.104.130.92:4001`

**Cinnabox** — BUILDER:
- `~/.config/opencode/opencode.jsonc` — 11 providers, 81 models (63 free)
- `~/.aider.conf.yml` — 5 providers, keys inline
- `~/.hermes/` — Hermes config + 76 skills
- `~/bin/` — CLI tools (web-extract, opencode wrapper, etc.)
- `~/TOOLCHAIN.md` — full developer tool inventory

## AI Agent Stack

| Tool | Where | Role |
|------|-------|------|
| **opencode** | Cinnabox | System agent — refactors, CI/CD, infra, security, batch ops |
| **aider** | Cinnabox | Pair programming — bug fixes, small features, unit tests |
| **Hermes** | Cinnabox | Fleet orchestrator — multi-agent, monitoring, alerting |
| **Claude Code** | Talos | Heavy-lift — complex multi-file refactoring, autonomous PRs |
| **Continue.dev** | Cinnabox | IDE autocomplete + chat (VS Code) |
| **Kilo Code** | Cinnabox | Agentic coding via kilo.ai gateway (500+ models) |
| **kimi-code** | Cinnabox | Kimi K2.7 Code CLI agent |

## Model Providers Configured

| Provider | opencode | aider | Hermes | Models |
|----------|----------|-------|--------|--------|
| OpenRouter | ✅ 12 | ✅ | ✅ | GPT-OSS free, Nemotron 3 (Ultra/Super/Nano), Qwen3 Coder/Next/3.5/3.6, Gemma 4, Cohere, all free |
| DeepSeek | ✅ 4 | ✅ default | ✅ | V4 Flash, V4 Pro, Chat (V3), Reasoner (R1) — all 1M ctx |
| MiniMax | ✅ 8 | ✅ | ✅ | M3 (1M), M2.7 (256K), M2.5, M2.1, M2, highspeed variants |
| Groq | ✅ 5 | ✅ | ✅ | Llama 3.3 70B, 3.1 8B, Qwen3 32B, Llama 4 Scout 17B, GPT-OSS 120B (all free) |
| Gemini | ✅ 2 | ✅ | ✅ | 2.5 Pro, 2.5 Flash — 1M ctx, free tier |
| Kimi | ✅ 4 | ✅ | ✅ | K2.7 Code (coding), K2.7 Code, K2.6 (1M), K2.5 (1M) |
| Cerebras | ✅ 2 | ✅ | — | GPT-OSS 120B, Z.AI GLM 4.7 (fast inference) |
| NVIDIA NIM | ✅ 1 | ✅ | ✅ | Llama 3.1 8B (free tier) |
| Ollama Cloud | ✅ 29 | ✅ | ✅ | V4 Pro/Flash, K2.7 Code, Qwen3 Coder 480B/32B/8B, MiniMax M2.7/M3, GPT-OSS 120B/20B, Nemotron 3 Ultra/Super, Gemma 4, Qwen3.5 397B, V3.2, Mistral Large 3 675B, GLM-5.2, Gemini 3 Flash Preview, Step 2 16K, many more — all free |
| Ollama (Talos) | ✅ 2 | ✅ | ✅ | Qwen3 4B, StarCoder2 3B |
| Ollama (Hydra) | ✅ 3 | ✅ | ✅ | Granite 3.2 8B, Phi-4 Mini 3.8B, Qwen2.5 Coder 0.5B |

Keys baked inline in opencode.jsonc and aider.conf.yml — no Hermes env dependency.
Total: 11 providers, 81 models (63 tagged "free").

### MiniMax in opencode — Preferred Setup (token plan)

opencode auto-registers 4 built-in MiniMax providers from `MINIMAX_API_KEY`. Only **`minimax-coding-plan`** works with a token-plan key (`sk-cp-…`); the other three (built-in Anthropic, CN, CN token-plan) return 404 or `invalid api key`.

**Setup (Cinnabox, 2026-07-02):**
1. `MINIMAX_API_KEY` env var set in `~/.hermes/.env`, sourced by the opencode wrapper.
2. `disabled_providers` in `opencode.jsonc` disables the 3 broken built-ins: `minimax`, `minimax-cn`, `minimax-cn-coding-plan`.
3. Use model IDs like `minimax-coding-plan/MiniMax-M3`.
4. No custom `minimax` provider block needed in config — keep config clean, let the built-in do its job.

Other MiniMax models from non-`minimax.io` providers remain available: `opencode-go/minimax-m3`, `ollama-cloud/minimax-m3`, `openrouter/minimax/minimax-m3`, `nvidia/minimaxai/minimax-m3`, plus Hydra/Talos Ollama.

## Cinnabox Performance Tuning

The V110 is fully optimized:
- CPU: `performance` governor + turbo 2.8GHz (was 2.3GHz locked)
- `mitigations=off` — +12% on Skylake
- Undervolt -50mV core/-25mV GPU (less throttling)
- I/O: `none` scheduler + 4MB readahead
- Tuned: `throughput-performance` profile
- thermald active, TRIM weekly, zram zstd 3.8GB swap
- Display: Inter font, rgba subpixel, 8bpc, full RGB, gamma tuned
- Audio: EasyEffects with EQ/bass/exciter/maximizer (auto-start)
- All persists via systemd services + GRUB

## Architecture

### RMI — rmi-backend (`/srv/work/repos/rmi-backend/`)
- FastAPI + SQLAlchemy + Celery + Redis
- Telegram bot at `app/domains/telegram/rugmunchbot/bot.py` (@rugmunchbot)
- Scanner at `app/domains/scanners/core/` — token risk scoring, address labeling
- DataBus at `app/domains/databus/` — 52 files, 25K lines, 30+ third-party APIs
- Provider interface: `DataProvider` ABC with `ThirdPartyProvider`, `SelfHostedNodeProvider`, `PonderIndexerProvider`

### RMI — Frontend (`/srv/work/repos/rmi-frontend/`)
- React 19 + Vite + Tailwind + Radix
- Charts: lightweight-charts, echarts, recharts, cytoscape
- OpenAPI types auto-generated at `src/types/api.ts`
- WebSocket alert stream for Helius alerts

### Pry (`/srv/work/repos/pryscraper/` · deploy `/srv/pry/`)
- Multi-source crypto intelligence crawler
- FastAPI + Docker (deployed at `/srv/pry/` on Talos)
- CLI + MCP server + SDK (`munchcrawl_sdk.py`)
- Features: scraper, extractor, parser, automator, job queue
- Referral proxy rotation (proxy_referrals.py, proxy_rotation.py)

### WalletPress (`/srv/work/repos/walletpress/` · deploy `/srv/walletpress/`)
- Python backend (FastAPI) + WordPress plugin
- Backend: wallet engine, x402 service, chain vault, hosting
- WP plugin: API, auth, payment widgets
- CLI tool for wallet management
- Installers: Docker Compose for production deployment

### Infrastructure (Docker on Talos)
- Postgres (primary + ponder per-chain)
- Redis/Dragonfly (cache + queue)
- Qdrant (vector embeddings)
- Neo4j (graph entity resolution)
- ClickHouse (analytics)
- DuckDB (Parquet querying)
- Workflow: Temporal + Kestra + n8n

### DegenFeed (`/srv/degenfeed/`)
- **GotoSocial** v0.22.0 at `social.degenfeed.xyz` (lightweight ActivityPub server).
- **degenfeed-web** repo at `/srv/work/repos/degenfeed-web/` — Next.js multi-protocol aggregator client (NOT deployed yet; see ROADMAP.md).
- Single container: `gotosocial` (port 8082 → nginx). SQLite DB, no Redis/Postgres dependency.
- Admin account: `@cryptorugmunch@degenfeed.xyz`.
- SMTP: Gmail (`cryptorugmuncher@gmail.com`) via `smtp.gmail.com:587`. App password in gopass at `rmi/email/cryptorugmuncher_gmail_app_password`.
- Media storage: local filesystem at `/srv/degenfeed/gotosocial/data/storage`. R2 bucket `degenfeed-media` exists (keys in gopass at `rmi/cloudflare/r2_degenfeed_*`) but not yet wired.
- Backups: daily at 04:00 via `/root/scripts/degenfeed-backup.sh` (SQLite `.backup` + data archive, 7-day retention).
- Nginx: `degenfeed.xyz` serves static landing page at `/var/www/degenfeed.xyz`. `social.degenfeed.xyz` proxies to `127.0.0.1:8082`. `www.degenfeed.xyz` 301 → apex.
- `w3social.xyz` / `www.w3social.xyz` 301 → `degenfeed.xyz`.
- Registration open with admin approval + reason required. Email required.
- Resource limits: 0.5 CPU / 256MB RAM (soft: 0.25 / 128MB).

### Databases
- **Postgres** (rmi-postgres:5432) — primary + Ponder indexers per chain
- **Redis** (rmi-redis:6379) — cache + Celery queue
- **Qdrant** (rmi-qdrant:6333) — vector embeddings
- **Neo4j** (rmi-neo4j:7687) — wallet label propagation (169K+ labels)
- **ClickHouse** (rmi-clickhouse:8123) — analytics, 39M address labels
- **DuckDB** (embedded) — Parquet querying (offloaded Ponder data)

### Ponder EVM Indexers (NOT DEPLOYED — containers not running as of 2026-07-08)

The table below reflects the planned deployment. No Ponder containers are
currently running on Talos. Stable views (`ponder.token_transfer`, etc.)
are not available. Re-deployment tracked in GAPS.md.

| Chain | Container | RPC | Status |
|-------|-----------|-----|--------|
| Ethereum | `rmi-ponder` | BlastAPI+GatewayFM+Lava | **offline** |
| BSC | `rmi-ponder-bsc` | bsc-dataseed.binance.org | **offline** |
| Arbitrum | `rmi-ponder-arbitrum` | arb1.arbitrum.io/rpc | **offline** |
| Polygon | `rmi-ponder-polygon` | polygon.drpc.org | **offline** |

### Scanner Pipeline
- `POST /scanner/scan` — live risk scoring
- Address labeler (39M labels from ClickHouse)
- Shared utils are provided by modules under `app/domains/scanners/` (e.g., per-detector helpers for helius_rpc, dexscreener_fetch, score_to_risk)
- Telegram `/scan`, `/portfolio`, `/simulate`, `/chart`, `/watch` commands
- Rate limiting: 10 req/s per provider

### DataBus Free Providers
`_goplus_token_security`, `_shyft_solana_data`, `_trongrid_data`, `_covalent_balances`, `_reservoir_nft_data`, `_ox_price`, `_lunarcrush_social`, `_ponder_token_transfers`

### Referral Revenue
| Platform | Cut | Code |
|----------|-----|------|
| Jupiter | 50bps | ✅ |
| Hyperliquid | 50bps | ✅ |
| Banana Gun | 40% | `rugmunch` |
| GMGN | 40% | `rugmunch` |
| Axiom | 30% | `@crmuncher` |
| OdinBot | 40% | `x5pyi0` |
| Padre | 35% | `crm` |

## Ollama CPU-Only Strategy

Both Talos and Hydra run Ollama in documented CPU-only mode (all GPU backends hidden).
Configuration follows current Ollama best practices for shared CPU hosts.

| Setting | Talos (primary) | Hydra (secondary) | Why |
|---------|-----------------|-------------------|-----|
| `OLLAMA_MAX_LOADED_MODELS` | 1 | 1 | Prevents RAM contention on shared hosts |
| `OLLAMA_CONTEXT_LENGTH` | 4096 | 4096 | Fast default; override per-request with `num_ctx` |
| `OLLAMA_KEEP_ALIVE` | 10m | 15m | Keeps the last-used model hot without pinning RAM forever |
| `OLLAMA_FLASH_ATTENTION` | 1 | 1 | Lower KV-cache memory, faster long contexts |
| `OLLAMA_KV_CACHE_TYPE` | q8_0 | q8_0 | ~50% KV memory vs f16 |
| `OLLAMA_NUM_PARALLEL` | 1 | 1 | Required for CPU; higher values multiply memory use |
| CPU quota | 800% | 800% | Uses most cores while protecting co-located services |
| Memory cap | 12 GB | 6 GB | Hard ceiling so Ollama cannot OOM the host |
| Nice priority | 10 | 0 | Talos deprioritizes AI vs production; Hydra runs normally |

### Model tiers

| Tier | Size | Use case | Talos models | Hydra models |
|------|------|----------|--------------|--------------|
| **Fast** | <1B | Chat, quick code, autocomplete | `qwen2.5-coder:0.5b` | `qwen2.5-coder:0.5b`, `smollm2:360m` |
| **Medium** | 3-4B | Better reasoning, coding | `qwen3:4b`, `starcoder2:3b` | `phi4-mini:3.8b` (slow) |
| **Large** | 7B+ | Batch/off-peak only | — | `granite3.2:8b` (not recommended interactively) |

### Performance reality

- **Talos** (EPYC 9645, 31 GB, no swap pressure): fast models ~30 tps, medium ~8-12 tps.
- **Hydra** (older EPYC, 23 GB, 1 GB already swapped, many co-located services): fast models ~6-8 tps, medium ~4 tps.
- Use **Talos for interactive AI**. Use **Hydra only for tiny models or batch jobs**.
- Cinnabox never runs Ollama; route all local tools to `http://100.104.130.92:11434` or `http://100.64.135.3:11434`.

## Git Policy

### Repositories
| Product | Forgejo repo (primary) | Legacy bare repo | External Remotes |
|---------|------------------------|------------------|------------------|
| RMI Backend | `git.rugmunch.io/RugMunchMedia/rmi-backend` | `/srv/git/rmi-backend.git` | GitHub LLC, GitHub personal, GitLab, HuggingFace |
| RMI Frontend | `git.rugmunch.io/RugMunchMedia/rmi-frontend` | — | — |
| Pry | `git.rugmunch.io/RugMunchMedia/pryscraper` | `/srv/git/pry.git` | _(to be added)_ |
| WalletPress | `git.rugmunch.io/RugMunchMedia/walletpress` | `/srv/git/walletpress.git` | _(to be added)_ |
| DegenFeed Web | `git.rugmunch.io/RugMunchMedia/degenfeed-web` | — | — |
| Fleet Infra | `git.rugmunch.io/RugMunchMedia/fleet-infra` | — | — |
| Standards | `git.rugmunch.io/RugMunchMedia/standards` | — | — |

> **Forgejo is the primary remote.** Clone with `git clone https://git.rugmunch.io/RugMunchMedia/<repo>.git`. The `/srv/git/` bare repos are legacy backups.
>
> **Forgejo admin:** `cryptorugmunch` (API token in gopass: `rmi/forgejo/api_token`)
>
> **SSH key:** `/root/.ssh/forgejo-deploy/id_ed25519` on Talos (maps to cryptorugmunch via `ssh://git@git.rugmunch.io:2222`)

### Push Cadence
- **Commit**: daily working changes. Use conventional commits: `feat(scope):`, `fix(scope):`, `docs:`, `ops:`, `chore:`
- **Push to Forgejo**: on every commit via `ssh://git@git.rugmunch.io:2222` (SSH key: `/root/.ssh/forgejo-deploy/id_ed25519`)
- **Push to external**: weekly or on feature completion — GitLab, GitHub (LLC), HuggingFace
- **Backup**: Hydra pulls from Talos daily at 4:00 AM via cron (`/root/scripts/git-backup.sh`)
- **Branch**: `main` is primary. Use `feat/*`, `fix/*` for feature branches.
- **No .env in git**: enforced by .gitignore

### Git Server Backup
- Talos bare repos at `/srv/git/` — primary
- Hydra mirror at `/srv/git-backup/` — daily cron `0 4 * * * /root/scripts/git-backup.sh`
- Git LFS lock verification disabled on Talos pushes

### External Remotes (RMI Backend)
- `github.com/Rug-Munch-Media-LLC/rugmuncher-backend` (push via HTTPS, PAT in gopass: `rmi/github/github_pat_org_rugmunch_llc`)
- `github.com/cryptorugmuncher/rugmuncher-backend` (personal, profile suspended)
- `gitlab.com/cryptorugmuncher/rugmuncher-backend` (credentials in gopass: `rmi/gitlab/pat`)
- `huggingface.co/cryptorugmunch/rugmuncher-backend` (token in gopass: `rmi/infra/huggingface_token`)
>
> External credentials stored in gopass. Run `/root/scripts/external-push.sh` on Talos to push to all remotes.

## MCP Servers (in opencode + Hermes)
- **coingecko** — crypto price data MCP
- **eth-labels** — Ethereum address label resolver (local node)
- **rmi-netcup** — FastMCP server on Talos (SSH tunnel)

## Web Extraction (3-layer, free)
1. `web-extract <url>` — curl + trafilatura
2. FlareSolverr on Talos `100.104.130.92:8191` (Cloudflare bypass)
3. Browser tool — Chromium (JS-heavy pages)

Always prefer layer 1. Fall back only if blocked.

## AI Guardrails (see GUARDRAILS.md for full contract)

Every AI agent (opencode, aider, Claude Code, Hermes) operates under strict guardrails:

| Gate | Enforcement | Tool |
|------|------------|------|
| **No hallucinated imports** | Pre-commit + semgrep | Hallucination checker |
| **No bare except** | Pre-commit | ruff BLE |
| **No sync I/O in async** | Pre-commit | ruff ASYNC |
| **No untyped public APIs** | Pre-commit + CI | mypy strict / tsc |
| **No fake test data** | CI | pytest --strict-markers |
| **No raw fetch() in frontend** | Pre-commit + CI | ESLint + architecture-review |
| **No invented config keys** | CI | semgrep ai-guardrails |
| **No skipped verification** | CI | All gates must pass |
| **Conventional commits** | Commit-msg | lefthook commit-msg hook |

### AI Prompt Library
`~/.ai-prompts/` — 10 guardrail prompts loaded by every AI session:
`code-review` `architecture-review` `type-safety` `error-handling`
`api-contract` `dependency-check` `security-review` `test-amplification`
`test-generation` `commit-message`

### Project Guardrails
Each repo has `.agentrules` defining project-specific AI constraints.
See: `rmi-backend/.agentrules`, `rmi-frontend/.agentrules`

## Builder System (see TOOLCHAIN.md for full reference)

| Feature | Details |
|---------|---------|
| **Fleet Menu** | `menu` — RMI ASCII art, time greeting, @cryptorugmuncher, unified on all machines |
| **Conventional Commits** | `make commit` → commitizen + commitlint; types: feat, fix, docs, refactor, style, test, chore, ops, security, ci, build, perf, revert |
| **Makefile Targets** | Every project has `make lint test check dev commit clean ci` |
| **Testing** | pytest + pytest-xdist (parallel) + pytest-randomly (flaky detection) + mutmut (mutation), vitest, Playwright, axe-core a11y |
| **Pre-commit** | lefthook (parallel, Go-native) + ruff, mypy, biome, dprint, gitleaks, deptry, cspell |
| **Frontend QA** | Biome 2.5.3 (30 a11y rules), Stylelint 17.x, Prettier + Tailwind plugin, Axe-core, Lighthouse CI, dompurify, Playwright, dprint, knip, cspell, openapi-typescript |
| **Static Analysis** | ruff, mypy, bandit, safety, semgrep, gitleaks, shellcheck, hadolint, actionlint, stylelint, knip, deptry, cspell, typos, lychee, vale |
| **CI/CD** | `.github/workflows/ci.yml` — lint + typecheck + test + e2e + a11y + lighthouse + security + knip + links + build; release-please for automated releases |
| **Quality Gates** | stylelint → biome check (30 a11y) → tsc → vitest → playwright → axe-core → knip → gitleaks → semgrep → deptry → cspell → lychee → build |
| **Dev Env** | mise (python/node/bun + mise tasks), direnv (auto-env), .editorconfig, .mise.toml, .mise-tasks.toml, .envrc |
| **Web3 Safety** | Mainnet RPC/addr guard in pre-commit. Blocks mainnet data from codebase. |
| **Local Devnet** | `make devnet` — Solana test validator + Anvil + x402 local mint |
| **AI PR Review** | `.github/workflows/ai-review.yml` — automated AI review on every PR |
| **Web3 Signing** | Sign commits with Ethereum keys from WalletPress vault |
| **Vuln Monitor** | Daily CVE scan of all project dependencies |
