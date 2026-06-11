#!/bin/zsh
# E2E test for Phase 4 – Shift Reports (list + detail + tenant isolation)
# Requires: dev server running on http://localhost:3000 with the simulator active
# Run: ./scripts/e2e-phase4-shifts.sh
# Override base URL: BASE=http://localhost:3004 ./scripts/e2e-phase4-shifts.sh
BASE=${BASE:-http://localhost:3000}
pass=0; fail=0
check() { if [ "$1" = "1" ]; then pass=$((pass+1)); echo "✓ $2"; else fail=$((fail+1)); echo "✗ $2"; fi }

login() { # $1 email $2 cookie-jar
  curl -s -c "$2" -X POST $BASE/api/auth/login \
    -H 'Content-Type: application/json' \
    -d "{\"email\":\"$1\",\"password\":\"demo123\"}"
}

# SC0: app is up
code=$(curl -s -o /dev/null -w '%{http_code}' $BASE/login)
check $([ "$code" = "200" ] && echo 1 || echo 0) "SC0: /login svarer 200 (app kjører)"

# SC1: operator login
r=$(login operator@steco-demo.no /tmp/c_ph4sh_op.txt)
check $(echo "$r" | grep -q '"ok":true' && echo 1 || echo 0) "SC1: operatør kan logge inn"

# SC2: shift list returns 200 and contains the heading
code=$(curl -s -o /dev/null -w '%{http_code}' -b /tmp/c_ph4sh_op.txt $BASE/reports/shifts)
list=$(curl -s -b /tmp/c_ph4sh_op.txt $BASE/reports/shifts)
check $([ "$code" = "200" ] && echo 1 || echo 0) "SC2: /reports/shifts returnerer 200"
check $(echo "$list" | grep -q 'Skiftrapporter' && echo 1 || echo 0) "SC2: HTML inneholder 'Skiftrapporter'"

# SC3: list contains shift-detail links and at least one OEE percentage
check $(echo "$list" | grep -q 'href="/reports/shifts/' && echo 1 || echo 0) "SC3: radene lenker til skiftdetaljer (href=/reports/shifts/<id>)"
check $(echo "$list" | grep -q ' %' && echo 1 || echo 0) "SC3: minst ett OEE-prosenttall vises"

# SC4: extract first shiftId from list and fetch detail page
id=$(echo "$list" | grep -oE '/reports/shifts/[0-9]+' | head -1 | grep -oE '[0-9]+')
if [ -z "$id" ]; then
  check 0 "SC4: kunne ikke hente shiftId fra listesiden"
else
  dcode=$(curl -s -o /dev/null -w '%{http_code}' -b /tmp/c_ph4sh_op.txt $BASE/reports/shifts/$id)
  detail=$(curl -s -b /tmp/c_ph4sh_op.txt $BASE/reports/shifts/$id)
  check $([ "$dcode" = "200" ] && echo 1 || echo 0) "SC4: /reports/shifts/$id returnerer 200"
  check $(echo "$detail" | grep -q 'Skiftrapport' && echo 1 || echo 0) "SC4: detaljside inneholder 'Skiftrapport'"
  check $(echo "$detail" | grep -q 'Tilgjengelighet' && echo 1 || echo 0) "SC4: OEE-nedbryting viser 'Tilgjengelighet'"
  check $(echo "$detail" | grep -q 'Doseringsbunker' && echo 1 || echo 0) "SC4: energiindikasjon inneholder 'Doseringsbunker'"
fi

# SC5: tenant isolation — bruker@isolasjonstest.no must NOT see Steco-demo shifts
r=$(login bruker@isolasjonstest.no /tmp/c_ph4sh_iso.txt)
check $(echo "$r" | grep -q '"ok":true' && echo 1 || echo 0) "SC5: isolasjonsbruker kan logge inn"

if [ -n "$id" ]; then
  icode=$(curl -s -o /dev/null -w '%{http_code}' -b /tmp/c_ph4sh_iso.txt $BASE/reports/shifts/$id)
  idetail=$(curl -s -b /tmp/c_ph4sh_iso.txt $BASE/reports/shifts/$id)
  # Accept either non-200 status or absence of the detail heading as pass
  iso_ok=0
  [ "$icode" != "200" ] && iso_ok=1
  echo "$idetail" | grep -q 'Skiftrapport —' || iso_ok=1
  check $iso_ok "SC5: iso-tenant kan IKKE se Steco-demo-skift (got HTTP $icode)"
fi

echo ""
echo "RESULT: $pass passed, $fail failed"
[ $fail -eq 0 ]
