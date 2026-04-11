#!/usr/bin/env bash
# 轻量 API 联通性检查（不含部署触发/回滚）。
# 用法：先 export SERVER_URL、E2E_EMAIL、E2E_PASSWORD，或 source .local/agent-test.env
set -euo pipefail
BASE="${SERVER_URL:-http://localhost:3000}/api"
echo "Using BASE=$BASE"

json_login=$(curl -sS -X POST "$BASE/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"${E2E_EMAIL:?}\",\"password\":\"${E2E_PASSWORD:?}\"}")
token=$(echo "$json_login" | node -e "const j=JSON.parse(require('fs').readFileSync(0,'utf8')); process.stdout.write(j.accessToken||'');")
if [[ -z "$token" ]]; then
  echo "Login failed: $json_login" >&2
  exit 1
fi
echo "OK login"

curl -sS -o /dev/null -w "GET /orgs -> %{http_code}\n" "$BASE/orgs" -H "Authorization: Bearer $token"

echo "Smoke done (no deploy POST)."
