# Security Guide

## Security Headers

DegenFeed applies the following security headers via Next.js middleware:

| Header | Value |
|--------|-------|
| Content-Security-Policy | Strict CSP with per-request nonces |
| Strict-Transport-Security | `max-age=63072000; includeSubDomains; preload` |
| X-Content-Type-Options | `nosniff` |
| X-Frame-Options | `DENY` |
| Referrer-Policy | `strict-origin-when-cross-origin` |
| Permissions-Policy | `camera=(), microphone=(), geolocation=()` |

## CSP Strategy

- Per-request random nonce for inline scripts/styles
- `strict-dynamic` for trusted script loading chains
- No `unsafe-eval` (blocks eval, setTimeout strings)
- Nonce passed via `x-csp-nonce` request header

## Rate Limiting

| Endpoint Pattern | Method | Rate |
|-----------------|--------|------|
| `/api/auth/*` | POST | 5 req/60s |
| `/api/tip/create` | POST | 10 req/60s |
| `/api/publish` | POST | 20 req/60s |
| `/api/admin/*` | POST | 20 req/60s |
| POST/PUT/DELETE | Any | 30 req/60s |
| Other `/api/*` | GET | 100 req/60s |

## Input Sanitization

The `@degenfeed/security` package provides:

```typescript
import { sanitizeInput, sanitizeObject } from '@degenfeed/security';

// Sanitize single string
const clean = sanitizeInput(userInput);

// Sanitize entire object
const cleanData = sanitizeObject(requestBody);
```

Strips: script tags, event handlers, javascript: URIs, iframe/object/embed/svg tags
Encodes: `<`, `>`, `&`, `"`, `'`, `/`

## Webhook Signature Verification

```typescript
import { verifyWebhookSignature } from '@degenfeed/security';

const isValid = await verifyWebhookSignature(
  payload,
  request.headers['x-signature-256'],
  WEBHOOK_SECRET,
);
```

## CSRF Protection

```typescript
import { generateCsrfToken, MemoryCsrfStore, validateCsrfToken } from '@degenfeed/security';

const store = new MemoryCsrfStore();
const token = generateCsrfToken();
store.set('session-key', token, 3600000); // 1 hour TTL

// Validate
const valid = validateCsrfToken(store, 'session-key', submittedToken);
```

## Token Bucket Rate Limiter

```typescript
import { TokenBucketRateLimiter } from '@degenfeed/security';

const limiter = new TokenBucketRateLimiter({
  capacity: 100,
  refillRate: 10, // tokens per second
});

const { allowed, remaining } = limiter.check('client-ip');
```

## Scanning Tools

```bash
# Full security scan
bash scripts/security-scan.sh

# Gitleaks only
gitleaks detect --no-git --source .

# NPM audit
npm audit

# Semgrep
semgrep --config=.semgrep/rules/security/
```

## Semgrep Rules

Located in `.semgrep/rules/security/`:

| Rule | Severity | Detects |
|------|----------|---------|
| `no-hardcoded-secrets.yaml` | ERROR | API keys, private keys, connection strings |
| `no-dangerous-eval.yaml` | ERROR | eval(), Function(), string setTimeout |
| `no-sql-injection.yaml` | ERROR | SQL string concatenation, NoSQL injection |

## Authentication

- JWT-based auth from rmi-backend (primary)
- Wallet HMAC session cookies (fallback)
- `__Host-dfid` cookie with HMAC-SHA256 signature
- Session expiry validation on every request
- Admin routes require `ADMIN_WALLETS` env var

## API Security Checklist

- [ ] Rate limiting configured
- [ ] CORS with allowlisted origins
- [ ] CSP with strict-dynamic nonces
- [ ] Input sanitized before processing
- [ ] Webhook signatures verified
- [ ] CSRF tokens for state-changing operations
- [ ] No secrets in source code
- [ ] .env files gitignored
- [ ] Dependencies audited regularly
- [ ] Security headers on all responses
