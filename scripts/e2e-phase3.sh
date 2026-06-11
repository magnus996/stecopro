#!/bin/zsh
# E2E test for Phase 3 – Live Dashboard
# Requires: dev server running on http://localhost:3000 with the simulator active
# Run: ./scripts/e2e-phase3.sh
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
r=$(login operator@steco-demo.no /tmp/c_ph3_op.txt)
check $(echo "$r" | grep -q '"ok":true' && echo 1 || echo 0) "SC1: operatør kan logge inn"

# Fetch dashboard HTML once (reused across all widget assertions)
dash=$(curl -s -b /tmp/c_ph3_op.txt $BASE/dashboard)

# SC2: widget markers present in server-rendered HTML
check $(echo "$dash" | grep -q 'Anleggsstatus' && echo 1 || echo 0)                        "SC2a: Anleggsstatus-widget finnes"
check $(echo "$dash" | grep -q 'OEE' && echo 1 || echo 0)                                  "SC2b: OEE-widget finnes"
check $(echo "$dash" | grep -q 'Tilgjengelighet' && echo 1 || echo 0)                      "SC2c: Tilgjengelighet vises"
check $(echo "$dash" | grep -q 'Ytelse' && echo 1 || echo 0)                               "SC2d: Ytelse vises"
check $(echo "$dash" | grep -q 'Kvalitet' && echo 1 || echo 0)                             "SC2e: Kvalitet vises"
check $(echo "$dash" | grep -q 'Tilgjengelighet × Ytelse × Kvalitet' && echo 1 || echo 0) "SC2f: OEE-definisjon synlig"
check $(echo "$dash" | grep -q 'Baler produsert' && echo 1 || echo 0)                      "SC2g: Baler produsert-widget finnes"
check $(echo "$dash" | grep -q 'Gjeldende skift' && echo 1 || echo 0)                      "SC2h: Gjeldende skift-label finnes"
check $(echo "$dash" | grep -q 'I dag' && echo 1 || echo 0)                                "SC2i: I dag-label finnes"
check $(echo "$dash" | grep -q 'Strømtrekk' && echo 1 || echo 0)                           "SC2j: Strømtrekk-seksjon finnes"
check $(echo "$dash" | grep -q 'Doseringsbunker' && echo 1 || echo 0)                      "SC2k: Doseringsbunker-tekst finnes"
check $(echo "$dash" | grep -q 'Siste stopp' && echo 1 || echo 0)                          "SC2l: Siste stopp-widget finnes"
check $(echo "$dash" | grep -q 'Varighet' && echo 1 || echo 0)                             "SC2m: Varighet-kolonne finnes"
check $(echo "$dash" | grep -q 'Kapasitetsutnyttelse' && echo 1 || echo 0)                 "SC2n: Kapasitetsutnyttelse-indikator finnes"

# SC3: at least one plant-state label is present
state_ok=0
for label in 'Kjører' 'Stanset' 'Utenfor skift' 'Ingen data' 'Bunker tom'; do
  echo "$dash" | grep -q "$label" && state_ok=1
done
check $state_ok "SC3: minst én anleggsstatus-label er tilstede"

# SC4: dashboard renders 200 twice (dynamic route works repeatedly)
code1=$(curl -s -o /dev/null -w '%{http_code}' -b /tmp/c_ph3_op.txt $BASE/dashboard)
code2=$(curl -s -o /dev/null -w '%{http_code}' -b /tmp/c_ph3_op.txt $BASE/dashboard)
check $([ "$code1" = "200" -a "$code2" = "200" ] && echo 1 || echo 0) "SC4: dashboard svarer 200 ved gjentatte kall"

# SC5: tenant isolation — bruker@isolasjonstest.no gets no plant (graceful, no 500, no demo plant name)
r=$(login bruker@isolasjonstest.no /tmp/c_ph3_iso.txt)
check $(echo "$r" | grep -q '"ok":true' && echo 1 || echo 0) "SC5: isolasjonsbruker kan logge inn"
iso=$(curl -s -b /tmp/c_ph3_iso.txt $BASE/dashboard)
code_iso=$(curl -s -o /dev/null -w '%{http_code}' -b /tmp/c_ph3_iso.txt $BASE/dashboard)
check $([ "$code_iso" = "200" ] && echo 1 || echo 0)                               "SC5: dashboard returnerer 200 for iso-tenant (ingen 500)"
check $(echo "$iso" | grep -q 'Returpapir Linje 1' && echo 0 || echo 1)            "SC5: iso-tenant ser IKKE demo-anlegget"

echo ""
echo "RESULT: $pass passed, $fail failed"
[ $fail -eq 0 ]
