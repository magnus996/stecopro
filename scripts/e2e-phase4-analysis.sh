#!/bin/zsh
# E2E test for Phase 4 Plan 03 – Analysis page (/reports) + CSV export
# Requires: dev server running on http://localhost:3000 with the simulator active
# Run: ./scripts/e2e-phase4-analysis.sh
BASE=${BASE:-http://localhost:3000}
pass=0; fail=0
check() { if [ "$1" = "1" ]; then pass=$((pass+1)); echo "✓ $2"; else fail=$((fail+1)); echo "✗ $2"; fi }

login() { # $1 email $2 cookie-jar
  curl -s -c "$2" -X POST $BASE/api/auth/login \
    -H 'Content-Type: application/json' \
    -d "{\"email\":\"$1\",\"password\":\"demo123\"}"
}

# Compute 14-day default range (same logic as the page)
TO=$(date +%Y-%m-%d)
FROM=$(date -v-14d +%Y-%m-%d 2>/dev/null || date -d '14 days ago' +%Y-%m-%d)

# SC0: app is up
code=$(curl -s -o /dev/null -w '%{http_code}' $BASE/login)
check $([ "$code" = "200" ] && echo 1 || echo 0) "SC0: /login svarer 200 (app kjører)"

# SC1: produksjonsleder login
r=$(login leder@steco-demo.no /tmp/c_ph4a_leder.txt)
check $(echo "$r" | grep -q '"ok":true' && echo 1 || echo 0) "SC1: produksjonsleder kan logge inn"

# SC2: GET /reports → 200 with "Analyser" heading
reports=$(curl -s -b /tmp/c_ph4a_leder.txt $BASE/reports)
code_reports=$(curl -s -o /dev/null -w '%{http_code}' -b /tmp/c_ph4a_leder.txt $BASE/reports)
check $([ "$code_reports" = "200" ] && echo 1 || echo 0) "SC2: /reports svarer 200 for produksjonsleder"
check $(echo "$reports" | grep -q 'Analyser' && echo 1 || echo 0) "SC2: HTML inneholder 'Analyser'"

# SC3: page contains chart/section markers
check $(echo "$reports" | grep -q 'Pareto' && echo 1 || echo 0)         "SC3a: HTML inneholder 'Pareto'"
check $(echo "$reports" | grep -q 'OEE-trend' && echo 1 || echo 0)      "SC3b: HTML inneholder 'OEE-trend'"
check $(echo "$reports" | grep -q 'per fraksjon' && echo 1 || echo 0)   "SC3c: HTML inneholder 'per fraksjon'"

# SC4: page contains CSV download link
check $(echo "$reports" | grep -q '/api/reports/export' && echo 1 || echo 0) "SC4: HTML inneholder CSV-lenke (/api/reports/export)"

# SC5: CSV download assertions
# SC5a: Content-Type contains text/csv
csv_headers=$(curl -s -D - -o /dev/null -b /tmp/c_ph4a_leder.txt \
  "$BASE/api/reports/export?from=$FROM&to=$TO")
check $(echo "$csv_headers" | grep -qi 'text/csv' && echo 1 || echo 0) "SC5a: Content-Type er text/csv"

# SC5b: BOM bytes (UTF-8 BOM = EF BB BF = efbbbf in xxd)
csv_body=$(curl -s -b /tmp/c_ph4a_leder.txt "$BASE/api/reports/export?from=$FROM&to=$TO")
bom_hex=$(printf '%s' "$csv_body" | head -c 3 | xxd -p | tr -d '\n')
check $(echo "$bom_hex" | grep -qi 'efbbbf' && echo 1 || echo 0) "SC5b: CSV starter med UTF-8 BOM (efbbbf)"

# SC5c: semicolon separators and correct header
check $(echo "$csv_body" | grep -q 'Dato;Skift' && echo 1 || echo 0) "SC5c: CSV inneholder 'Dato;Skift' (semikolon-separator)"
check $(echo "$csv_body" | grep -q 'OEE %' && echo 1 || echo 0) "SC5d: CSV inneholder 'OEE %' kolonne"

# SC6: operator role gate
r2=$(login operator@steco-demo.no /tmp/c_ph4a_op.txt)
check $(echo "$r2" | grep -q '"ok":true' && echo 1 || echo 0) "SC6: operatør kan logge inn"

# SC6a: operator GET /reports — should NOT contain "Analyser" (redirected to /reports/shifts)
op_reports=$(curl -s -L -b /tmp/c_ph4a_op.txt $BASE/reports)
check $(echo "$op_reports" | grep -q 'Analyser' && echo 0 || echo 1) "SC6a: operatør ser IKKE 'Analyser' på /reports (redirected)"

# SC6b: operator GET /api/reports/export → 403
op_csv_code=$(curl -s -o /dev/null -w '%{http_code}' -b /tmp/c_ph4a_op.txt \
  "$BASE/api/reports/export?from=$FROM&to=$TO")
check $([ "$op_csv_code" = "403" ] && echo 1 || echo 0) "SC6b: operatør får 403 på CSV-eksport"

echo ""
echo "RESULT: $pass passed, $fail failed"
[ $fail -eq 0 ]
