#!/bin/zsh
BASE=http://localhost:3000
pass=0; fail=0
check() { if [ "$1" = "1" ]; then pass=$((pass+1)); echo "✓ $2"; else fail=$((fail+1)); echo "✗ $2"; fi }

# SC1: app responds
code=$(curl -s -o /dev/null -w '%{http_code}' $BASE/login)
check $([ "$code" = "200" ] && echo 1 || echo 0) "SC1: /login svarer 200 (app kjører)"

login() { # $1 email -> writes cookies to $2
  curl -s -c "$2" -X POST $BASE/api/auth/login -H 'Content-Type: application/json' -d "{\"email\":\"$1\",\"password\":\"demo123\"}"
}

# SC2 positive: operator logs in, sees own tenant
r=$(login operator@steco-demo.no /tmp/c_op.txt)
check $(echo "$r" | grep -q '"ok":true' && echo 1 || echo 0) "SC2: operatør kan logge inn"
dash=$(curl -s -b /tmp/c_op.txt $BASE/dashboard)
check $(echo "$dash" | grep -q 'Ole Operatør' && echo 1 || echo 0) "SC2: operatør ser egen brukerkontekst"
check $(echo "$dash" | grep -q 'Returpapir Linje 1' && echo 1 || echo 0) "SC2: operatør ser Returpapir Linje 1"

# SC2 negative: isolation tenant user sees own tenant, not Steco Demo's plant
r=$(login bruker@isolasjonstest.no /tmp/c_iso.txt)
check $(echo "$r" | grep -q '"ok":true' && echo 1 || echo 0) "SC2-neg: isolasjonsbruker kan logge inn"
dash=$(curl -s -b /tmp/c_iso.txt $BASE/dashboard)
check $(echo "$dash" | grep -q 'Isolert Bruker' && echo 1 || echo 0) "SC2-neg: ser egen brukerkontekst (Isolasjonstest)"
check $(echo "$dash" | grep -q 'Returpapir Linje 1' && echo 0 || echo 1) "SC2-neg: ser IKKE Steco Demos anlegg"

# Wrong password rejected
r=$(curl -s -X POST $BASE/api/auth/login -H 'Content-Type: application/json' -d '{"email":"operator@steco-demo.no","password":"feil"}')
check $(echo "$r" | grep -q 'Ugyldig' && echo 1 || echo 0) "Auth: feil passord avvises med norsk feilmelding"

# Unauthenticated redirect
code=$(curl -s -o /dev/null -w '%{http_code}' $BASE/dashboard)
check $([ "$code" = "307" -o "$code" = "302" ] && echo 1 || echo 0) "Auth: uinnlogget /dashboard redirecter ($code)"

# SC3: role-based nav
for u in operator@steco-demo.no leder@steco-demo.no admin@steco-demo.no system@steco.no; do
  login $u /tmp/c_role.txt > /dev/null
  curl -s -b /tmp/c_role.txt $BASE/dashboard > /tmp/dash_$u.html
done
check $(grep -q 'Brukere' /tmp/dash_admin@steco-demo.no.html && echo 1 || echo 0) "SC3: admin ser Brukere-nav"
check $(grep -q 'Brukere' /tmp/dash_operator@steco-demo.no.html && echo 0 || echo 1) "SC3: operatør ser IKKE Brukere-nav"
check $(grep -q 'admin/tenants' /tmp/dash_system@steco.no.html && echo 1 || echo 0) "SC3: system-admin ser tenant-nav"
check $(grep -q 'admin/tenants' /tmp/dash_leder@steco-demo.no.html && echo 0 || echo 1) "SC3: leder ser IKKE tenant-nav"

# SC4: schema tables exist
tables=$(node -e "const db=require('better-sqlite3')('./stecopro.db');console.log(db.prepare(\"select name from sqlite_master where type='table'\").all().map(r=>r.name).join(','))")
ok=1; for t in tenants users plants machines fractions shifts bale_events stop_events time_series_readings; do echo "$tables" | grep -q "$t" || ok=0; done
check $ok "SC4: alle 9 tabeller finnes ($tables)"

# SC5: DAL structural — no accessor takes tenantId as parameter
viol=$(grep -nE 'function.*\(.*tenantId|=>.*\(.*tenantId.*\).*=>' src/lib/dal.ts | wc -l | tr -d ' ')
check $([ "$viol" = "0" ] && echo 1 || echo 0) "SC5: ingen DAL-funksjon tar tenantId som parameter"
check $(grep -q 'verifySession' src/lib/dal.ts && echo 1 || echo 0) "SC5: DAL utleder tenant fra verifySession()"

echo ""; echo "RESULT: $pass passed, $fail failed"
[ $fail -eq 0 ]
