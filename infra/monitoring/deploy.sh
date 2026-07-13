#!/usr/bin/env bash
set -euo pipefail

# DegenFeed Fleet Monitoring Stack — Deploy to Hydra
# Usage: ./deploy.sh

HYDRA_SSH="${HYDRA_SSH:-contabo}"
HYDRA_HOST="${HYDRA_HOST:-100.64.135.3}"
REMOTE_DIR="${REMOTE_DIR:-/srv/degenfeed-monitoring}"
SSH_USER="${SSH_USER:-root}"

if [[ "${HYDRA_SSH}" == "contabo" ]]; then
  HYDRA_TARGET="${SSH_USER}@${HYDRA_HOST}"
else
  HYDRA_TARGET="${HYDRA_SSH}"
fi

echo "==> Deploying DegenFeed monitoring stack to Hydra (${HYDRA_TARGET})"

# Copy infrastructure files
echo "==> Copying compose + config..."
rsync -avz --delete \
  docker-compose.yml \
  prometheus.yml \
  grafana/ \
  "${HYDRA_TARGET}:${REMOTE_DIR}/"

# Start the stack
echo "==> Starting stack via docker compose..."
ssh "${HYDRA_TARGET}" <<-SSH
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
echo "  Grafana:    http://${HYDRA_HOST}:3001"
echo "  Prometheus: http://${HYDRA_HOST}:9090"
echo "  Login:      admin / admin"
echo ""
echo "  Dashboards provisioned automatically."
echo "============================================"
