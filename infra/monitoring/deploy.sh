#!/usr/bin/env bash
set -euo pipefail

# DegenFeed Fleet Monitoring Stack — Deploy to [HOST-2]
# Usage: ./deploy.sh

MON_SSH="${MON_SSH:?set MON_SSH}"
MON_HOST="${MON_HOST:-[INTERNAL_HOST]}"
REMOTE_DIR="${REMOTE_DIR:-/path/to/degenfeed-monitoring}"

MON_TARGET="${MON_SSH}"

echo "==> Deploying DegenFeed monitoring stack to [HOST-2] (${MON_TARGET})"

# Copy infrastructure files
echo "==> Copying compose + config..."
rsync -avz --delete \
    docker-compose.yml \
    prometheus.yml \
    grafana/ \
    "${MON_TARGET}:${REMOTE_DIR}/"

# Start the stack
echo "==> Starting stack via docker compose..."
# shellcheck disable=SC2087  # ${REMOTE_DIR} expands client-side, \$(...) server-side
ssh "${MON_TARGET}" <<-SSH
  set -euo pipefail
  cd "${REMOTE_DIR}"
  docker compose pull
  docker compose up -d

  echo "==> Waiting for Prometheus..."
  for i in \$(seq 1 15); do
    if curl -sf http://localhost:9090/-/ready >/dev/null 2>&1; then
      echo "Prometheus ready"
      break
    fi
    sleep 2
  done

  echo "==> Waiting for Grafana..."
  for i in \$(seq 1 15); do
    if curl -sf http://localhost:3001/api/health >/dev/null 2>&1; then
      echo "Grafana ready"
      break
    fi
    sleep 2
  done
SSH

echo ""
echo "============================================"
echo "  DegenFeed Fleet Monitoring"
echo "============================================"
echo ""
echo "  Grafana:    http://${MON_HOST}"
echo "  Prometheus: http://${MON_HOST}"
echo "  Login:      admin / admin"
echo ""
echo "  Dashboards provisioned automatically."
echo "============================================"
