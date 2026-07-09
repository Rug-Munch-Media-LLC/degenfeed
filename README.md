# Pry — Pry open any website.

> **Web scraping + Cloudflare bypass + browser automation + change monitoring.**  
> Self-hosted. One command. Yours forever. No monthly bills.

```bash
docker run -d -p 8005:8002 pry/pry
curl -X POST http://localhost:8005/v1/scrape \
  -H 'Content-Type: application/json' \
  -d '{"url":"https://example.com"}'
```

---

## Why Pry?

| vs | Firecrawl | ScraperAPI | ScrapingBee | **Pry** |
|---|---|---|---|---|
| Price | $99/mo | $49/mo | $49/mo | **$29 once** |
| Cloudflare bypass | Paid addon | ❌ | ❌ | **✅ Built-in** |
| Browser automation | ❌ | ❌ | ❌ | **✅ Sessions** |
| Change monitoring | $99/mo | ❌ | ❌ | **✅ Free** |
| Local AI extraction | ❌ | ❌ | ❌ | **✅ Via Ollama** |
| Tor proxy | ❌ | ❌ | ❌ | **✅ 1-click** |
| Self-hosted | ❌ | ❌ | ❌ | **✅ Docker** |
| Real-time streaming | ❌ | ❌ | ❌ | **✅ WebSocket** |

---

## Features

### 🛡️ Cloudflare? Never heard of it
Pry's 4-tier engine burns through every protection:
1. **Direct** — rotating UAs, browser-like headers
2. **FlareSolverr** — Cloudflare bypass on-demand  
3. **Playwright stealth** — full browser with fingerprint spoofing
4. **Googlebot fallback** — last resort with search engine trust

### 🤖 Browser automation that persists
Login once. Scrape for hours. Sessions persist via cookies.

```python
# Login, then scrape authenticated pages
steps = [
  {"action": "navigate", "url": "https://site.com/login"},
  {"action": "type", "selector": "#email", "value": "user@x.com"},
  {"action": "click", "selector": "#login-btn"},
  {"action": "screenshot"},
]
```

### 🔍 AI-powered extraction
Point at any page. Local Ollama finds the structure automatically.

```bash
curl -X POST http://localhost:8005/v1/scrape \
  -H 'Content-Type: application/json' \
  -d '{"url":"https://store.com/product","jsonSchema":{"price":"the price","name":"product name"}}'
```

### 👀 Watch pages for changes
Free change monitoring. Get Slack/Discord alerts when pages update.

```bash
curl -X POST http://localhost:8005/v1/watch \
  -H 'Content-Type: application/json' \
  -d '{"url":"https://site.com/page","webhook":"https://hooks.slack.com/..."}'
```

### 📋 One-file config
Define everything in `pry.yml`:

```yaml
jobs:
  - name: prices
    url: https://store.com/products
    schedule: every 1h
    extract:
      title: "h1"
      price: ".price"
    output: csv
    webhook: slack://C012345
```

Run it: `pry run`

---

## Quick Start

### 1. Docker (recommended)
```bash
docker run -d -p 8005:8002 --name pry pry/pry
```

### 2. Compose (with Cloudflare bypass)
```bash
curl -O https://pry.dev/docker-compose.yml
docker compose up -d
```

### 3. pip
```bash
pip install pry
pry serve
```

---

## Pricing

| Tier | Price | What you get |
|------|-------|-------------|
| **Free** (GitHub) | $0 | Source code, Docker, self-host, AGPL |
| **Pro** | **$29 once** | Pre-built image, 30 templates, CLI autocomplete, commercial license, 1yr updates |

**$29. Lifetime. No subscription.**

---

## Docs

Full API reference at [pry.dev/docs](https://pry.dev/docs)

### Core endpoints
| Endpoint | Method | What it does |
|----------|--------|-------------|
| `/v1/scrape` | POST | Scrape any URL |
| `/v1/crawl` | POST | Crawl multiple pages |
| `/v1/automate` | POST | Browser automation |
| `/v1/batch` | POST | Batch scrape 50 URLs |
| `/v1/watch` | POST | Monitor page changes |
| `/v1/stream` | WS | Real-time data stream |
| `/v1/parse` | POST | Parse PDF/DOCX/images |
| `/v1/transform` | POST | Convert data format |
| `/v1/run` | POST | Execute pry.yml jobs |
| `/dashboard` | GET | Health dashboard |

---

## License

- **Community Edition:** AGPL v3 — free for self-hosted use
- **Pro Edition:** Commercial license — $29 one-time

---

*Built for developers who refuse to pay $99/month for a scraper.*
