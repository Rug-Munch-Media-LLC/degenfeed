# Tips API

## `POST /tips/send`

Send a cross-protocol tip.

**Body:**
```json
{
  "recipient": "0x... or npub... or fid...",
  "amount": "0.01",
  "token": "SOL" | "ETH" | "USDC" | "BTC (Lightning)" | "LENS",
  "protocol": "solana" | "evm" | "lightning" | "lens" | "farcaster"
}
```

**Response:** `{ "status": "sent", "tx_hash": "0x..." }`
