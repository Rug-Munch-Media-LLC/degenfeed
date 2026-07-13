#!/bin/bash
set -euo pipefail

echo "=== DegenFeed AI Model Evaluation ==="
echo ""

cd "$(dirname "$0")/.."

# Install deps if needed
if [ ! -d "node_modules" ]; then
  npm install
fi

# Run evaluation
npx promptfoo eval --config promptfooconfig.yaml "$@"

# Open results
echo ""
echo "Results saved to:"
echo "  JSON: results/latest.json"
echo "  HTML: results/latest.html"
echo ""
echo "Run 'npm run view' to see interactive results"
