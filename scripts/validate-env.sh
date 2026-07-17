#!/bin/bash
set -euo pipefail

REQUIRED_VARS=(
    "MEILI_MASTER_KEY"
    "LEMMY_JWT_SECRET"
    "LEMMY_DB_PASSWORD"
    "LEMMY_ADMIN_PASSWORD"
    "DATABASE_URL"
    "REDIS_URL"
)

missing=0
for var in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!var:-}" ]; then
        echo "MISSING: $var"
        missing=$((missing + 1))
    fi
done

if [ $missing -gt 0 ]; then
    echo "FAIL: $missing required env vars missing"
    exit 1
fi

echo "OK: All required env vars present"
