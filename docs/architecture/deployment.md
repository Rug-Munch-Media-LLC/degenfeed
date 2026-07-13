# Deployment

## Infrastructure

| Component | Platform | Region |
|-----------|----------|--------|
| Landing page | Cloudflare Pages | Global edge |
| Web client | Cloudflare Pages | Global edge |
| Edge API | Cloudflare Worker | Global edge |
| Social server | Talos (bare metal via Docker) | Germany (netcup) |
| DNS | Cloudflare DNS | — |

## CI/CD

- GitHub Actions in `.github/workflows/ci.yml`
- Automatic deploy to Cloudflare Pages on push to `main`
- Worker deploy via `wrangler deploy`
- Release-please for automated versioning and changelog

## Social Server

GotoSocial runs on Talos at `/srv/degenfeed/` with Docker Compose. Backed by Postgres. Daily backups to Cloudflare R2.
