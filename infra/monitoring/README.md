# DegenFeed Fleet Monitoring Stack

Grafana + Prometheus + Node Exporter for the DegenFeed fleet, deployed on Hydra (Contabo).

## Architecture

```
                  ┌──────────────┐
                  │  Prometheus   │
                  │  :9090        │
                  └──────┬───────┘
          ┌──────────────┼──────────────┐
          ▼              ▼              ▼
   ┌──────────┐   ┌──────────┐   ┌──────────┐
   │ Node Exp │   │ Worker   │   │ Social   │
   │ :9100    │   │ degenfeed│   │ social.  │
   │ Hydra    │   │ .xyz     │   │ degenfeed│
   │          │   │ /api/    │   │ .xyz     │
   │          │   │ health   │   │ /api/v1/ │
   │          │   │          │   │ instance │
   └──────────┘   └──────────┘   └──────────┘

   ┌──────────┐
   │ Node Exp │
   │ Talos    │
   │ 100.104. │
   │ 130.92   │
   └──────────┘

   ┌──────────────┐
   │   Grafana    │◄── you are here
   │  :3001       │
   └──────────────┘
```

## Services

| Service | Port | Purpose |
|---------|------|---------|
| Grafana | 3001 | Dashboards & alerts |
| Prometheus | 9090 | Metrics storage & query |
| Node Exporter | - | Host metrics (CPU/mem/disk) on Hydra |

## Scraped Targets

| Target | Endpoint | Description |
|--------|----------|-------------|
| `degenfeed-worker` | `https://degenfeed.xyz/api/health` | Edge worker relay health |
| `degenfeed-social` | `https://social.degenfeed.xyz/api/v1/instance` | GotoSocial instance info |
| `talos-node` | `[INTERNAL_HOST]:9100` | Talos host metrics |
| `hydra-node` | `localhost:9100` | Hydra host metrics |

## Dashboards

The **DegenFeed Fleet Health** dashboard (provisioned automatically) has:

1. **Fleet Status** — UP/DOWN stat panels for every target
2. **Worker Response Times** — HTTP duration phases (DNS, connect, TLS, transfer)
3. **Error Rates** — HTTP status codes + probe error ratio
4. **Node Resources** — CPU, memory, and disk for Hydra and Talos

## Quick Start

```bash
# Deploy to Hydra
./deploy.sh

# Or manually:
docker compose up -d

# Check health
curl http://localhost:3001/api/health   # Grafana
curl http://localhost:9090/-/ready      # Prometheus
```

## Access

| Service | URL |
|---------|-----|
| Grafana | `http://[INTERNAL_HOST]:3001` |
| Prometheus | `http://[INTERNAL_HOST]:9090` |

Default login: `admin` / `admin`

## Adding Node Exporters

To add a new node exporter to the fleet:

1. Deploy `quay.io/prometheus/node-exporter:latest` on the target host
2. Ensure port 9100 is accessible from Hydra
3. Add the target to `prometheus.yml` under `scrape_configs`
4. Restart Prometheus: `docker compose restart prometheus`

## Adding Blackbox Exporter (optional)

For deeper HTTP/S probing (TLS cert expiry, status codes, latency):

1. Add a `blackbox_exporter` service to `docker-compose.yml`
2. Configure probe modules in `blackbox.yml`
3. Add `blackbox` job to `prometheus.yml`

## Maintenance

```bash
# View logs
docker compose logs -f prometheus
docker compose logs -f grafana

# Restart services
docker compose restart prometheus
docker compose restart grafana

# Backup Grafana data
docker run --rm -v fleet-grafana_data:/data -v $(pwd):/backup alpine tar czf /backup/grafana-backup-$(date +%Y%m%d).tar.gz -C /data .

# Update images
docker compose pull
docker compose up -d
```

## Resources

- [Prometheus docs](https://prometheus.io/docs/)
- [Grafana docs](https://grafana.com/docs/)
- [Node Exporter](https://github.com/prometheus/node_exporter)
