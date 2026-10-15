#!/usr/bin/env bash
# Build and deploy the web app to Firebase Hosting (elderly-3e18c.web.app). Safe to re-run.
# Prereqs: `npx firebase login` once, and the API deployed (elderly-backend/deploy.sh).
set -euo pipefail
cd "$(dirname "$0")"

API_URL="${VITE_API_URL:-$(gcloud run services describe elderly-api --region asia-southeast1 \
  --project elderly-3e18c --format 'value(status.url)')}"
echo "Building against API: $API_URL"
VITE_API_URL="$API_URL" npm run build

# firebase-tools is installed in ./firebase (it pins Firebase 12 for the rules tests).
./firebase/node_modules/.bin/firebase deploy --only hosting --project elderly-3e18c
