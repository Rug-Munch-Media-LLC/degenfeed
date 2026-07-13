# CLAUDE.md — Project Context for Claude Code

## Required Reading (read before any code change)
1. /home/dev/AGENTS.md — fleet-wide contract, product table, server rules
2. /home/dev/GUARDRAILS.md — AI behavior contract (10 prohibitions, verification steps)
3. .agentrules — project-specific guardrails and anti-patterns
4. /home/dev/STANDARDS.md — coding standards (linting, types, API design)
5. /home/dev/CONVENTIONS.md — coding rules, environment vars, common commands

## Before Submitting Any Code
- [ ] Ruff/Biome passes (lefthook pre-commit)
- [ ] Mypy/tsc --noEmit passes
- [ ] Tests pass (pytest/vitest)
- [ ] No hallucinated imports (checker + semgrep)
- [ ] Conventional commit message
- [ ] Verifiable proof of correctness (not just "fixed!")

## Architecture Boundaries
See AGENTS.md §Architecture and .agentrules for layer discipline.
Inner layers NEVER import outer layers. Data flows ONE direction.
