# ── Makefile (TypeScript / pnpm / Turborepo) ───────────────────
# Source of truth: standards/templates/Makefile.typescript.template
# Customized for degenfeed monorepo.

.PHONY: help install precommit dev build lint format check typecheck test test-watch test-cov test-e2e test-a11y security links knip dead-code spellcheck ci audit rollback clean

help: ## Show this help. Usage: make <target>
	@awk 'BEGIN {FS = ":.*?## "; printf "\nUsage: make <target>\n\nTargets:\n"} /^[a-zA-Z_-]+:.*?## / {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

install: ## Install JS dependencies with pnpm (frozen lockfile)
	pnpm install --frozen-lockfile

precommit: ## Install pre-commit hooks
	pre-commit install
	pre-commit install --hook-type pre-push

bridge: ## Start local API bridge (replaces Cloudflare Worker)
	@echo "Starting DegenFeed Bridge on port 8787..."
	@WORKER_URL=http://127.0.0.1:8787 scripts/start-bridge.sh

dev: ## Run dev servers via Turbo (starts bridge first)
	@echo "Starting local API bridge..."
	@scripts/start-bridge.sh --daemon
	@echo "Starting Next.js dev server with WORKER_URL=http://127.0.0.1:8787..."
	@cd apps/web && WORKER_URL=http://127.0.0.1:8787 pnpm dev

build: ## Build all packages/apps via Turbo
	pnpm build

lint: ## Lint all packages/apps via Turbo (Biome + Stylelint)
	pnpm lint
	npx stylelint "**/*.css" --allow-empty-input

format: ## Format all files with Biome
	pnpm format
	npx prettier --write --plugin=prettier-plugin-tailwindcss "apps/**/*.{ts,tsx,css}"

check: ## Fast check: lint + typecheck
	pnpm lint
	pnpm typecheck

typecheck: ## TypeScript type check across monorepo
	pnpm typecheck

test: ## Run unit tests via Turbo (vitest)
	pnpm test

test-watch: ## Run tests in watch mode
	pnpm exec vitest

test-cov: ## Run tests with coverage
	pnpm exec vitest run --coverage

test-e2e: ## Playwright E2E tests
	pnpm --filter degenfeed test:e2e

test-a11y: ## Axe-core a11y audit
	pnpm --filter degenfeed test:e2e --project=axe-a11y

security: ## Security audit with gitleaks
	gitleaks detect --source . --no-banner
	pnpm audit

knip: ## Find dead code and unused deps
	npx knip --no-progress

dead-code: knip ## Alias for knip

spellcheck: ## Check spelling with cspell
	npx cspell "**/*.{ts,tsx,js,jsx,md}" --no-progress

links: ## Check all links in markdown/docs
	lychee --no-progress --accept 200,204,301,302,304 '**/*.md' --exclude 'node_modules' --exclude 'dist' --exclude '.next' --exclude '.turbo'

ci: ## Full CI pipeline (lint + typecheck + test + build)
	pnpm lint
	pnpm typecheck
	pnpm test
	pnpm build
	$(MAKE) knip
	$(MAKE) links

audit: ## Dependency audit with pnpm
	pnpm audit

rollback: ## Rollback production web app to the previous git commit (systemd)
	@echo "Rolling back degenfeed-web.service to the previous commit..."
	cd /srv/work/repos/degenfeed-web \
		&& git reset --hard HEAD~1 \
		&& pnpm install --frozen-lockfile \
		&& pnpm --filter degenfeed build \
		&& sudo systemctl restart degenfeed-web
	@echo "Verify: curl -sf http://127.0.0.1:3100/api/health"
	@echo "(Cloudflare Worker/Pages rollback retired 2026-08-04 — see DEPLOYMENT.md)"

clean: ## Remove build artifacts + dependencies
	rm -rf dist .next .vite .turbo .biome-cache coverage
	find . -type d -name node_modules -prune -exec rm -rf {} + 2>/dev/null || true
