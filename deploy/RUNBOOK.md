# DegenFeed — Production Deploy Runbook

> **Audience:** the human lead executing production changes. This runbook
> documents LIVE actions; nothing in this repo executes them automatically.
>
> **Deploy model (single source of truth):** production is a **systemd
> standalone service** — nginx → `degenfeed-web.service` (Next.js standalone,
> `127.0.0.1:3100`) → `degenfeed-bridge.service` (feed API, `127.0.0.1:8787`).
> Cloudflare Workers/Pages are **RETIRED** (2026-08-04). Docker Compose is for
> self-hosters only. See [`../DEPLOYMENT.md`](../DEPLOYMENT.md) for the model,
> this file for the exact production steps.
>
> **Conventions:** `<deploy-host>` = the production server hostname (never
> committed — it lives in the password store / Forgejo secrets). `<deploy-user>`
> = the SSH user that owns the checkout. All repo-relative paths are from the
> repo root on `<deploy-host>`.

---

## Step 0 — Preconditions (check before touching anything)

```bash
# On <deploy-host> — services up?
systemctl status degenfeed-web.service degenfeed-bridge.service --no-pager
curl -sf http://127.0.0.1:3100/api/health && echo "web OK"
curl -sf http://127.0.0.1:8787/api/health && echo "bridge OK"

# MeiliSearch reachable? (the unified feed's search index depends on it)
curl -sf http://127.0.0.1:7700/health && echo "meili OK"
```

**[REVIEW] MeiliSearch gap (verified 2026-08-30):** nothing is listening on
`:7700` and **no compose file in this repo defines a meilisearch service**
(the `chore(ci)` commit message claims "meilisearch in compose" but the diff
only added comments). The bridge's indexer fails soft, so the site works but
search is empty. Until a compose service or unit exists, start it manually:

```bash
docker run -d --name degenfeed-meilisearch --restart unless-stopped \
  -p 127.0.0.1:7700:7700 \
  -v /srv/degenfeed/meili_data:/meili_data \
  -e MEILI_MASTER_KEY="$(gopass show -o <store>/degenfeed/meili-master-key)" \
  getmeili/meilisearch:v1.12
```

Then run the reindex once (Step 5). Follow-up for the repo owners: add a real
`meilisearch` service to `docker-compose.yml` (root file — outside this
runbook's edit scope).

---

## Step 1 — Ship the versioned nginx vhosts

The vhosts live in the repo at `deploy/nginx/{app,api,social}.degenfeed.xyz`
(versioned 2026-08-30; previously they only existed on the server). Copy,
symlink, validate, reload — **in this order**:

```bash
# 1a. Copy the three vhosts to the server's nginx staging dir
cp deploy/nginx/app.degenfeed.xyz    /srv/degenfeed/nginx/app.degenfeed.xyz.conf
cp deploy/nginx/api.degenfeed.xyz    /srv/degenfeed/nginx/api.degenfeed.xyz.conf
cp deploy/nginx/social.degenfeed.xyz /srv/degenfeed/nginx/social.degenfeed.xyz.conf

# 1b. Symlink into sites-enabled (app + api: direct; social: via sites-available)
ln -sf /srv/degenfeed/nginx/app.degenfeed.xyz.conf    /etc/nginx/sites-enabled/app.degenfeed.xyz
ln -sf /srv/degenfeed/nginx/api.degenfeed.xyz.conf    /etc/nginx/sites-enabled/api.degenfeed.xyz
ln -sf /srv/degenfeed/nginx/social.degenfeed.xyz.conf /etc/nginx/sites-available/social.degenfeed.xyz
ln -sf /etc/nginx/sites-available/social.degenfeed.xyz /etc/nginx/sites-enabled/social.degenfeed.xyz

# 1c. Validate BEFORE reloading — never reload on a broken config
nginx -t

# 1d. Reload (zero-downtime; workers drain gracefully)
systemctl reload nginx
```

**Preflight gotchas** (these make `nginx -t` fail if missing on the host):
- `social.degenfeed.xyz` includes `/srv/degenfeed/nginx/security-headers.conf`
  and uses the `gts_fed` rate-limit zone — both must already exist in the live
  nginx config (they do on the current host; verify on any new host).
- TLS certs at `/etc/ssl/certs/degenfeed-origin-ca.pem` +
  `/etc/ssl/private/degenfeed-origin.key` (Cloudflare Origin CA).

**Verify:**

```bash
curl -s -o /dev/null -w '%{http_code}\n' https://app.degenfeed.xyz/api/health   # 200
curl -s -o /dev/null -w '%{http_code}\n' "https://app.degenfeed.xyz/api/feed/home?limit=1"  # 200 or 401 (401 = nginx→bridge routing OK, bridge auth gate)
curl -s -o /dev/null -w '%{http_code}\n' https://api.degenfeed.xyz/api/health   # 200
```

---

## Step 2 — Restart `degenfeed-web.service` (activate the `API_PROXY_TARGET` fix)

The repo `.env` now sets `API_PROXY_TARGET=http://localhost:8787` (the bridge)
— previously the app proxied feed routes to the retired `:3101` container.
The env file is read at service start, so a **restart** (not reload) is
required:

```bash
systemctl restart degenfeed-web.service

# Watch it come up
journalctl -u degenfeed-web.service -f        # Ctrl-C when healthy
curl -sf http://127.0.0.1:3100/api/health && echo "web OK"
```

**Verify end-to-end through nginx** (app-level proxy, not just the nginx-level
route from Step 1):

```bash
curl -s "https://app.degenfeed.xyz/api/feed/home?limit=1" | head -c 300
```

If this returns feed JSON (or a 401 JSON error from the bridge — expected
without a bearer token), the `:3101 → :8787` fix is live. A 502 means the
restart didn't pick up the new env — check
`systemctl show degenfeed-web -p EnvironmentFiles` and the `.env` the unit
actually reads.

---

## Step 3 — Forgejo secrets + deploy-user sudoers

CI deploys via `.forgejo/workflows/deploy.yml` (SSH → git pull → build →
`sudo systemctl restart degenfeed-web`). It needs repo secrets and a
passwordless sudo rule.

### 3a. Password-store entries (one-time)

Create these in the password store (see
[`../scripts/forgejo-set-secrets.sh`](../scripts/forgejo-set-secrets.sh) for
exact paths — the mount is resolved at runtime):

```
<store>/forgejo/api_token      # Forgejo API token (repo admin scope)
<store>/degenfeed/deploy-host  # production SSH host
<store>/degenfeed/deploy-user  # SSH user
<store>/degenfeed/deploy-ssh-key  # full PRIVATE key (header/footer included)
<store>/degenfeed/deploy-port  # optional, only if SSH is not on 22
```

### 3b. Set the Forgejo repo secrets

The helper is **dry-run by default** — it prints what it would set (name +
fingerprint, never values) and only sends with `--apply`:

```bash
scripts/forgejo-set-secrets.sh --repo RugMunchMedia/degenfeed-web          # dry-run
scripts/forgejo-set-secrets.sh --repo RugMunchMedia/degenfeed-web --apply  # LIVE
```

Manual alternative: Forgejo UI → repo → Settings → Actions → Secrets → add
`DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY`, (optional) `DEPLOY_PORT`.

### 3c. Passwordless sudo for the restart (on `<deploy-host>`)

```bash
echo "<deploy-user> ALL=(root) NOPASSWD: /usr/bin/systemctl restart degenfeed-web" \
  > /etc/sudoers.d/degenfeed-deploy
chmod 0440 /etc/sudoers.d/degenfeed-deploy
visudo -c                      # MUST report "parsed OK" before moving on
sudo -u <deploy-user> sudo -n systemctl restart degenfeed-web  # should succeed with no password prompt
```

Keep the rule minimal — restart of this one unit only. Do **not** grant
`ALL=(ALL) NOPASSWD:ALL`.

### 3d. First CI deploy

Trigger once manually before trusting push-to-main automation:
Forgejo UI → Actions → **Deploy** workflow → Run workflow
(`workflow_dispatch`). Watch the `systemd-deploy` + `smoke-test` jobs.

---

## Step 4 — (Optional) `ubuntu-latest` runner alias label

CI jobs now target the `docker-x64` runner label, so this is **not required**.
Only add it if third-party/legacy workflows hardcode `ubuntu-latest`:

```bash
# On the runner host — /etc/forgejo-runner/config.yaml, runner.labels:
#   labels:
#     - "docker-x64:docker://node:22-bookworm-slim"
#     - "ubuntu-latest:docker://node:22-bookworm-slim"   # alias, same image
systemctl restart forgejo-runner
```

**[REVIEW]** An `ubuntu-latest` label that actually maps to a shell runner
(would silently run jobs on the host) must never be added — keep it pinned to
a container image or omit it.

---

## Step 5 — MeiliSearch reindex automation

The unified feed's search index (`posts`) is rebuilt by the bridge. Install
the idempotent reindex script + systemd timer:

```bash
# On <deploy-host>, from the repo checkout:
install -m 755 scripts/meilisearch-reindex.sh /usr/local/bin/degenfeed-meili-reindex.sh
cp deploy/systemd/degenfeed-meili-reindex.service /etc/systemd/system/
cp deploy/systemd/degenfeed-meili-reindex.timer   /etc/systemd/system/

# Secrets for the unit (root-owned env file; adjust User= in the unit first).
# NOTE: verify the store entry actually holds the LIVE bridge key — compare
# against the BRIDGE_API_KEY in the service's environment, not just the name.
cat > /etc/default/degenfeed-meili-reindex <<EOF
BRIDGE_API_KEY=$(gopass show -o <store>/degenfeed/bridge-api-key)
MEILI_KEY=$(gopass show -o <store>/degenfeed/meili-master-key)
EOF
chmod 0600 /etc/default/degenfeed-meili-reindex

systemctl daemon-reload
systemctl enable --now degenfeed-meili-reindex.timer
```

Schedule: daily `04:30` + up to 15 min jitter, `Persistent=true` (catches up
after downtime). Manual run / inspection:

```bash
systemctl start degenfeed-meili-reindex.service        # run now
systemctl list-timers degenfeed-meili-reindex.timer
journalctl -u degenfeed-meili-reindex.service -n 50
scripts/meilisearch-reindex.sh --status                # indexer state via bridge
```

The script is safe to run repeatedly (flock-guarded; a second concurrent run
is a no-op) and only mutates through the bridge's own
`POST /api/search/indexer/reindex` endpoint.

---

## Verification checklist (run after Steps 1–5)

| Check | Command | Expected |
|---|---|---|
| nginx config valid | `nginx -t` | `syntax is ok` / `test is successful` |
| App health (via nginx) | `curl -sf https://app.degenfeed.xyz/api/health` | 200 JSON |
| Feed routing (via nginx) | `curl -s -o /dev/null -w '%{http_code}' 'https://app.degenfeed.xyz/api/feed/home?limit=1'` | `200` or `401` |
| Feed routing (app proxy) | `curl -s 'https://app.degenfeed.xyz/api/feed/home?limit=1' \| head -c 200` | feed JSON or 401 JSON — **not** 502 |
| API vhost | `curl -sf https://api.degenfeed.xyz/api/health` | 200 JSON |
| Landing page | `curl -sfL https://degenfeed.xyz/ \| grep -c DegenFeed` | ≥ 1 |
| MeiliSearch | `curl -sf http://127.0.0.1:7700/health` | `{"status":"available"}` |
| Search index populated | `scripts/meilisearch-reindex.sh --status` | `documentCount > 0` after a reindex |
| CI deploy | Forgejo → Actions → Deploy (dispatch) | `systemd-deploy` + `smoke-test` green |

---

## Rollback

- **nginx:** `rm /etc/nginx/sites-enabled/<vhost>` (or restore the previous
  `.conf` in `/srv/degenfeed/nginx/`), `nginx -t && systemctl reload nginx`.
- **web service:** `git -C <checkout> reset --hard <previous-sha> &&
  pnpm install --frozen-lockfile && pnpm --filter degenfeed build &&
  sudo systemctl restart degenfeed-web` — or `git revert` the offending commit
  on main and let the CI deploy run.
- **Reindex:** idempotent — re-running it converges to the same index; there
  is no rollback state to restore.

---

## Docs reconciliation status (2026-08-30)

| Doc | State |
|---|---|
| `DEPLOYMENT.md` (root) | ✅ Canonical — systemd standalone banner, Workers/Pages marked retired; lower sections explicitly historical. |
| `deploy/RUNBOOK.md` (this file) | ✅ Matches the deploy model. |
| `docs/DEPLOYMENT.md` | ✅ Fixed this pass — was still titled "canonical" with the Workers/Pages model; now carries a historical banner pointing to the root doc. |
| `README.md` | ⚠️ **One contradiction remains (lead to fix — root file, outside this pass's edit scope):** the docs table (~line 332) still describes `DEPLOYMENT.md` as *"Cloudflare Pages + Workers deployment guide"*. Change to *"Production deployment guide (systemd standalone)"*. Everything else in README (lines 13, 158–162) already matches. |
