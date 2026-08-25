# Monitoring Guide

## Health Check Endpoints

| Endpoint | Description |
|----------|-------------|
| `/api/feed/health` | Primary health check |
| `/api/sources/health` | Source fetchers health |
| `/api/admin/sources/health-check` | Admin health check |

Usage:

```bash
# Check service health
curl http://localhost:3000/api/feed/health

# From monitoring script
bash scripts/health-check.sh
```

## Structured Logging

The `@degenfeed/monitoring` package provides JSON-structured logging:

```typescript
import { createLogger } from '@degenfeed/monitoring';

const log = createLogger('api');
log.info('Server started', { port: 3000 });
log.error('Database connection failed', err, { db: 'primary' });
```

### Log Levels

| Level | Method | Description |
|-------|--------|-------------|
| debug | `log.debug()` | Detailed debugging |
| info  | `log.info()`  | Normal operations |
| warn  | `log.warn()`  | Warnings |
| error | `log.error()` | Errors (includes stack trace) |

### Child Loggers

```typescript
const requestLog = log.child('request:abc123');
requestLog.info('Processing request');
```

### Timing Measurements

```typescript
import { measureDuration, onMeasure } from '@degenfeed/monitoring';

// Subscribe to timing events
onMeasure((m) => {
  console.log(`${m.name}: ${m.durationMs}ms`);
});

// Measure async functions
const result = await measureDuration('db.query', () => db.query(...));
```

## Prometheus (Optional)

Template config at `deploy/monitoring/prometheus.yml`:

```yaml
scrape_configs:
  - job_name: "degenfeed"
    static_configs:
      - targets: ["localhost:3000"]
    metrics_path: "/api/metrics"
```

## Alertmanager (Optional)

Template config at `deploy/monitoring/alertmanager.yml` for Slack and PagerDuty alert routing.

## Uptime Monitoring

For production, set up a cron job:

```bash
# Check every 5 minutes
*/5 * * * * /path/to/degenfeed/scripts/health-check.sh || curl -X POST https://hooks.slack.com/... 
```

## Adding New Monitoring

1. Add health checks to `packages/monitoring/src/health.ts`
2. Create new API health endpoints in `apps/web/src/app/api/`
3. Add Prometheus scrape targets to `deploy/monitoring/prometheus.yml`
4. Add alert rules to `deploy/monitoring/alertmanager.yml`
