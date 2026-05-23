#!/bin/bash
# Double-click to start the Recy Expo dev server.

set -e
cd "$(dirname "$0")"

echo "→ Recy Expo Dev Server"
echo "  $(pwd)"
echo ""

# Ensure npm deps are present
if [ ! -d "node_modules" ]; then
  echo "node_modules mancanti — eseguo npm install…"
  npm install --legacy-peer-deps
  echo ""
fi

echo "Avvio Expo (premi Ctrl+C per fermare)…"
echo ""

npx expo start --clear
