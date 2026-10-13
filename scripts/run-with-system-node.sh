#!/usr/bin/env bash
# Démarre GereoTimes avec le Node.js système (LTS 24) plutôt que celui de Hermes.
# L'espace dans « Program Files » empêche de passer le PATH en ligne de commande :
# d'où ce script.

set -e

export PATH="/c/Program Files/nodejs:$PATH"
cd "/c/Users/WINDOWS 11/Documents/Default Project/geston de projet/gereotimes"

PORT="${PORT:-3000}"

echo "node  $(node --version)  ($(command -v node))"
echo "npm   $(npm --version)"
echo "port  $PORT"

exec npx next start -p "$PORT"
