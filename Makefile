# ── Makefile (TypeScript / pnpm / Turborepo) ───────────────────
# Source of truth: standards/templates/Makefile.typescript.template
# Customized for degenfeed-web monorepo.

.PHONY: help install precommit dev build lint format check typecheck test test-watch test-cov security ci audit clean

help: ## Show this help. Usage: make <target>
	@awk 'BEGIN {FS = ":.*?## "; printf "\nUsage: make <target>\n\nTargets:\n"} /^[a-zA-Z_-]+:.*?## / {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

install: ## Install JS dependencies with pnpm (frozen lockfile)
	pnpm install --frozen-lockfile

precommit: ## Install pre-commit hooks
	pre-commit install
	pre-commit install --hook-type pre-push

dev: ## Run dev servers via Turbo
	pnpm dev

build: ## Build all packages/apps via Turbo
	pnpm build

lint: ## Lint all packages/apps via Turbo (Biome)
	pnpm lint

format: ## Format all files with Biome
	pnpm format

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

security: ## Security audit with gitleaks
	gitleaks detect --source . --no-banner

ci: ## Full CI pipeline (lint + typecheck + test + build)
	pnpm lint
	pnpm typecheck
	pnpm test
	pnpm build

audit: ## Dependency audit with pnpm
	pnpm audit

clean: ## Remove build artifacts + dependencies
	rm -rf dist .next .vite .turbo .biome-cache coverage
	find . -type d -name node_modules -prune -exec rm -rf {} + 2>/dev/null || true
