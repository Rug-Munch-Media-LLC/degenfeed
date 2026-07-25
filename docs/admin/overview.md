# Admin Dashboard Overview

Access the admin dashboard at `/admin` (requires admin wallet authentication).

## Sections

### Dashboard (`/admin`)
Main overview with key metrics:
- Total users, posts, tips
- Protocol health (online/degraded/offline per protocol)
- Recent activity feed
- System alerts (CPU, disk, latency, error spikes)
- System health gauges
- Quick actions (moderation, sources, system settings)

### Content (`/admin/content`)
View and manage platform content:
- Browse all posts across protocols
- Search and filter
- Moderate flagged content
- Delete or approve pending posts

### Sources (`/admin/sources`)
Manage RSS and data sources:
- View connected sources
- Health check per source
- Add/remove sources
- Trigger manual fetches

### Protocols (`/admin/protocols`)
Monitor protocol connections:
- Status of each protocol (Farcaster, Lens, Nostr, Bluesky, Mastodon, etc.)
- Post counts per protocol
- Restart protocol fetchers
- Protocol health checks

### Users (`/admin/users`)
User management:
- View registered users
- Account details
- Ban/unban users

### Moderation (`/admin/moderation`)
Content moderation queue:
- Flagged posts and reports
- Approve/reject actions
- User ban management

### Revenue (`/admin/revenue`)
Financial metrics:
- Tip volume and counts
- Platform breakdown
- Historical trends

### System (`/admin/system`)
Full system management with tabs:

| Tab | Description |
|-----|-------------|
| Resources | CPU, RAM, Disk usage, network stats |
| Docker | Container status, restart, logs |
| Backups | Backup status, trigger new backups |
| DNS/SSL | Domain health, certificate expiry |
| Versions | Service versions, update tracking |
| Logs | System log viewer |

### Hosts (`/admin/hosts`)
Infrastructure host management:
- Server status
- Service configuration

## API Endpoints

All admin API endpoints are under `/api/admin/` and require:
1. Valid session cookie (`__Host-dfid`)
2. Wallet address in `ADMIN_WALLETS` env var

## Environment Variables

| Variable | Description |
|----------|-------------|
| `ADMIN_WALLETS` | Comma-separated admin wallet addresses |
| `AUTH_SECRET` | Secret for HMAC session signing |
