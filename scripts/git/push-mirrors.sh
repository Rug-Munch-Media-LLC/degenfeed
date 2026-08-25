#!/bin/bash
# push-mirrors — Push to all remote mirrors (Forgejo origin + GitLab + Codeberg + Radicle)
# Radicle push requires `rad` CLI and a running `radicle-node` (on [HOST-1]/[HOST-2]).
# Usage: ./scripts/git/push-mirrors.sh [branch]

set -euo pipefail

BRANCH="${1:-main}"

echo "=== Pushing to Forgejo (origin) ==="
git push origin "$BRANCH"

echo ""
echo "=== Pushing to GitLab mirror ==="
if git ls-remote --exit-code gitlab "$BRANCH" &>/dev/null; then
  git push gitlab "$BRANCH"
else
  echo "  (skipped — repo may not exist at gitlab.com/cryptorugmuncher/degenfeed)"
fi

echo ""
echo "=== Pushing to Codeberg mirror ==="
if git ls-remote --exit-code codeberg "$BRANCH" &>/dev/null; then
  git push codeberg "$BRANCH"
else
  echo "  (skipped — repo may not exist at codeberg.org/cryptorugmunch/degenfeed)"
fi

echo ""
echo "=== Radicle decentralized backup ==="
if command -v rad &>/dev/null; then
  if git config --get remote.radicle.url &>/dev/null; then
    git push radicle "$BRANCH"
    echo "  Pushed to Radicle node"
  else
    echo "  (radicle remote not configured — run: rad init && rad push)"
  fi
else
  echo "  (rad CLI not available — Radicle sync handled by cron on [HOST-1]/[HOST-2])"
fi

echo ""
echo "=== Done ==="
echo "Forgejo:  https://git.rugmunch.io/RugMunchMedia/degenfeed"
echo "GitLab:   https://gitlab.com/cryptorugmuncher/degenfeed"
echo "Codeberg: https://codeberg.org/cryptorugmunch/degenfeed"
echo "Radicle:  rad:z4HA4VujocEo1b3jTFwNk5qEGgF3V (synced weekly via [HOST-2] cron)"
