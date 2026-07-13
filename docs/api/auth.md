# Authentication API

## `POST /auth/challenge`

Request a sign-in challenge.

**Body:** `{ "address": "0x...", "chain": "solana" | "evm" }`

**Response:** `{ "challenge": "Sign this message...", "issued_at": "..." }`

## `POST /auth/session`

Submit a signed challenge to create a session.

**Body:** `{ "address": "...", "signature": "0x...", "chain": "..." }`

**Response:** `{ "token": "bearer-...", "expires_at": "..." }`
