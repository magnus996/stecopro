#!/bin/zsh
# E2E walkthrough for Phase 5 — Full Role Demo + Role Gates + User CRUD
#
# Verifies:
#   SC0  — app is up
#   SC1  — all 4 role logins succeed
#   SC2  — operator walkthrough: dashboard + shift reports
#   SC3  — operator role gates: blocked from analysis + all /admin routes
#   SC4  — produksjonsleder walkthrough: dashboard + shifts + analysis + plant config + CSV
#   SC5  — produksjonsleder role gates: blocked from /admin/users + /admin/tenants
#   SC6  — admin walkthrough: plant + user management
#   SC7  — admin role gate: blocked from /admin/tenants
#   SC8  — system_admin walkthrough: user mgmt + tenant list (both tenants visible)
#   SC9  — user CRUD: deactivated user cannot log in (401), temp user cleaned up
#
# Requires: dev server running on http://localhost:3000 with demo data seeded
# Run:       ./scripts/e2e-phase5-walkthrough.sh
# Override:  BASE=http://localhost:3004 ./scripts/e2e-phase5-walkthrough.sh

BASE=${BASE:-http://localhost:3000}
pass=0; fail=0

check() { if [ "$1" = "1" ]; then pass=$((pass+1)); echo "✓ $2"; else fail=$((fail+1)); echo "✗ $2"; fi }

# Login: POST JSON to /api/auth/login, write cookies to jar $2
login() {
  curl -s -c "$2" -X POST "$BASE/api/auth/login" \
    -H 'Content-Type: application/json' \
    -d "{\"email\":\"$1\",\"password\":\"demo123\"}"
}

# HTTP status for path $1 using cookie jar $2 (no redirect follow)
status() { curl -s -o /dev/null -w '%{http_code}' -b "$2" "$BASE$1"; }

# Response body for path $1 using cookie jar $2
body() { curl -s -b "$2" "$BASE$1"; }

# blocked(): pass if status != 200 OR body lacks the expected heading $3
# Usage: blocked <path> <cookie-jar> <heading-marker>
blocked() {
  local _path="$1" _jar="$2" _marker="$3"
  local _code
  _code=$(status "$_path" "$_jar")
  if [ "$_code" != "200" ]; then
    echo 1; return
  fi
  local _body
  _body=$(body "$_path" "$_jar")
  if echo "$_body" | grep -qF "$_marker"; then
    echo 0
  else
    echo 1
  fi
}

# ─────────────────────────────────────────────────────────────────────────────
# SC0 — app is up
# ─────────────────────────────────────────────────────────────────────────────
code=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/login")
check $([ "$code" = "200" ] && echo 1 || echo 0) "SC0: /login svarer 200 (app kjører)"

# ─────────────────────────────────────────────────────────────────────────────
# SC1 — all four role logins succeed
# ─────────────────────────────────────────────────────────────────────────────
r_op=$(login operator@steco-demo.no /tmp/c_ph5_op.txt)
check $(echo "$r_op" | grep -q '"ok":true' && echo 1 || echo 0) "SC1: operatør (operator@steco-demo.no) kan logge inn"

r_leder=$(login leder@steco-demo.no /tmp/c_ph5_leder.txt)
check $(echo "$r_leder" | grep -q '"ok":true' && echo 1 || echo 0) "SC1: produksjonsleder (leder@steco-demo.no) kan logge inn"

r_admin=$(login admin@steco-demo.no /tmp/c_ph5_admin.txt)
check $(echo "$r_admin" | grep -q '"ok":true' && echo 1 || echo 0) "SC1: admin (admin@steco-demo.no) kan logge inn"

r_sys=$(login system@steco.no /tmp/c_ph5_sys.txt)
check $(echo "$r_sys" | grep -q '"ok":true' && echo 1 || echo 0) "SC1: system_admin (system@steco.no) kan logge inn"

# ─────────────────────────────────────────────────────────────────────────────
# SC2 — operator walkthrough: dashboard + shift reports
# ─────────────────────────────────────────────────────────────────────────────
op_dash_code=$(status /dashboard /tmp/c_ph5_op.txt)
op_dash_body=$(body /dashboard /tmp/c_ph5_op.txt)
check $([ "$op_dash_code" = "200" ] && echo 1 || echo 0) "SC2: operatør /dashboard returnerer 200"
check $(echo "$op_dash_body" | grep -q 'Dashbord' && echo 1 || echo 0) "SC2: dashboard inneholder 'Dashbord'"

op_shifts_code=$(status /reports/shifts /tmp/c_ph5_op.txt)
op_shifts_body=$(body /reports/shifts /tmp/c_ph5_op.txt)
check $([ "$op_shifts_code" = "200" ] && echo 1 || echo 0) "SC2: operatør /reports/shifts returnerer 200"
check $(echo "$op_shifts_body" | grep -q 'Skiftrapporter' && echo 1 || echo 0) "SC2: skiftrapporter inneholder 'Skiftrapporter'"

# ─────────────────────────────────────────────────────────────────────────────
# SC3 — operator role gates
# ─────────────────────────────────────────────────────────────────────────────
# /reports (analysis) — operator redirected to /reports/shifts; must NOT see 'Analyser'
check $(blocked /reports /tmp/c_ph5_op.txt 'Analyser') "SC3: operatør blokkert fra /reports (analyse)"
# /admin/plant — must NOT see 'Anleggsoppsett'
check $(blocked /admin/plant /tmp/c_ph5_op.txt 'Anleggsoppsett') "SC3: operatør blokkert fra /admin/plant"
# /admin/users — must NOT see 'Brukere'
check $(blocked /admin/users /tmp/c_ph5_op.txt 'Brukere') "SC3: operatør blokkert fra /admin/users"
# /admin/tenants — must NOT see 'Tenants'
check $(blocked /admin/tenants /tmp/c_ph5_op.txt 'Tenants') "SC3: operatør blokkert fra /admin/tenants"

# ─────────────────────────────────────────────────────────────────────────────
# SC4 — produksjonsleder walkthrough
# ─────────────────────────────────────────────────────────────────────────────
leder_dash_code=$(status /dashboard /tmp/c_ph5_leder.txt)
check $([ "$leder_dash_code" = "200" ] && echo 1 || echo 0) "SC4: produksjonsleder /dashboard returnerer 200"

leder_shifts_code=$(status /reports/shifts /tmp/c_ph5_leder.txt)
check $([ "$leder_shifts_code" = "200" ] && echo 1 || echo 0) "SC4: produksjonsleder /reports/shifts returnerer 200"

leder_reports_code=$(status /reports /tmp/c_ph5_leder.txt)
leder_reports_body=$(body /reports /tmp/c_ph5_leder.txt)
check $([ "$leder_reports_code" = "200" ] && echo 1 || echo 0) "SC4: produksjonsleder /reports returnerer 200"
check $(echo "$leder_reports_body" | grep -q 'Analyser' && echo 1 || echo 0) "SC4: analyseside inneholder 'Analyser'"

# CSV export: derive a 14-day range (macOS/zsh date -v)
from_date=$(date -v-14d '+%Y-%m-%d')
to_date=$(date '+%Y-%m-%d')
csv_code=$(curl -s -o /dev/null -w '%{http_code}' -b /tmp/c_ph5_leder.txt "$BASE/api/reports/export?from=${from_date}&to=${to_date}")
check $([ "$csv_code" = "200" ] && echo 1 || echo 0) "SC4: CSV-eksport (from=$from_date to=$to_date) returnerer 200"

leder_plant_code=$(status /admin/plant /tmp/c_ph5_leder.txt)
leder_plant_body=$(body /admin/plant /tmp/c_ph5_leder.txt)
check $([ "$leder_plant_code" = "200" ] && echo 1 || echo 0) "SC4: produksjonsleder /admin/plant returnerer 200"
check $(echo "$leder_plant_body" | grep -q 'Anleggsoppsett' && echo 1 || echo 0) "SC4: anleggsoppsett inneholder 'Anleggsoppsett'"
check $(echo "$leder_plant_body" | grep -q 'Skifttider' && echo 1 || echo 0) "SC4: anleggsoppsett inneholder 'Skifttider'"

# ─────────────────────────────────────────────────────────────────────────────
# SC5 — produksjonsleder role gates
# ─────────────────────────────────────────────────────────────────────────────
check $(blocked /admin/users /tmp/c_ph5_leder.txt 'Brukere') "SC5: produksjonsleder blokkert fra /admin/users"
check $(blocked /admin/tenants /tmp/c_ph5_leder.txt 'Tenants') "SC5: produksjonsleder blokkert fra /admin/tenants"

# ─────────────────────────────────────────────────────────────────────────────
# SC6 — admin walkthrough
# ─────────────────────────────────────────────────────────────────────────────
admin_plant_code=$(status /admin/plant /tmp/c_ph5_admin.txt)
check $([ "$admin_plant_code" = "200" ] && echo 1 || echo 0) "SC6: admin /admin/plant returnerer 200"

admin_users_code=$(status /admin/users /tmp/c_ph5_admin.txt)
admin_users_body=$(body /admin/users /tmp/c_ph5_admin.txt)
check $([ "$admin_users_code" = "200" ] && echo 1 || echo 0) "SC6: admin /admin/users returnerer 200"
check $(echo "$admin_users_body" | grep -q 'Brukere' && echo 1 || echo 0) "SC6: brukersiden inneholder 'Brukere'"

# ─────────────────────────────────────────────────────────────────────────────
# SC7 — admin role gate: blocked from /admin/tenants
# ─────────────────────────────────────────────────────────────────────────────
check $(blocked /admin/tenants /tmp/c_ph5_admin.txt 'Tenants') "SC7: admin blokkert fra /admin/tenants"

# ─────────────────────────────────────────────────────────────────────────────
# SC8 — system_admin walkthrough: user mgmt + tenant list
# ─────────────────────────────────────────────────────────────────────────────
sys_users_code=$(status /admin/users /tmp/c_ph5_sys.txt)
check $([ "$sys_users_code" = "200" ] && echo 1 || echo 0) "SC8: system_admin /admin/users returnerer 200"

sys_tenants_code=$(status /admin/tenants /tmp/c_ph5_sys.txt)
sys_tenants_body=$(body /admin/tenants /tmp/c_ph5_sys.txt)
check $([ "$sys_tenants_code" = "200" ] && echo 1 || echo 0) "SC8: system_admin /admin/tenants returnerer 200"
check $(echo "$sys_tenants_body" | grep -q 'Tenants' && echo 1 || echo 0) "SC8: tenantliste inneholder 'Tenants'"
check $(echo "$sys_tenants_body" | grep -q 'Steco Demo' && echo 1 || echo 0) "SC8: tenantliste viser 'Steco Demo'"
check $(echo "$sys_tenants_body" | grep -q 'Isolasjonstest' && echo 1 || echo 0) "SC8: tenantliste viser 'Isolasjonstest' (ADMN-04 isolasjon bevist)"

# ─────────────────────────────────────────────────────────────────────────────
# SC9 — user CRUD: deactivated user cannot log in
# Uses npx tsx -e inline to insert/update/delete via better-sqlite3 + bcryptjs
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "SC9: Oppretter midlertidig bruker e2e-temp@steco-demo.no …"

# Step 1: Create temp user (active=true)
npx --yes tsx -e "
import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { users, tenants } from './src/db/schema.js';
import { eq } from 'drizzle-orm';

const dbPath = process.env.DB_FILE_NAME ?? './stecopro.db';
const sqlite = new Database(dbPath);
const db = drizzle(sqlite, { schema: { users, tenants } });

async function main() {
  // Find tenant 1 (steco-demo)
  const [tenant] = await db.select().from(tenants).where(eq(tenants.slug, 'steco-demo'));
  if (!tenant) { console.error('tenant steco-demo not found'); process.exit(1); }

  // Delete stale temp user if exists
  await db.delete(users).where(eq(users.email, 'e2e-temp@steco-demo.no'));

  // Insert fresh temp user
  const passwordHash = await bcrypt.hash('demo123', 10);
  await db.insert(users).values({
    tenantId: tenant.id,
    email: 'e2e-temp@steco-demo.no',
    name: 'E2E Temp',
    passwordHash,
    role: 'operator',
    active: true,
    createdAt: new Date(),
  });
  console.log('Temp user created.');
}
main().catch((e) => { console.error(e); process.exit(1); });
" 2>&1

# Step 2: Verify temp user can log in (active=true)
r_temp=$(login e2e-temp@steco-demo.no /tmp/c_ph5_temp.txt)
check $(echo "$r_temp" | grep -q '"ok":true' && echo 1 || echo 0) "SC9: aktiv temp-bruker kan logge inn"

# Step 3: Deactivate temp user
npx tsx -e "
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { users } from './src/db/schema.js';
import { eq } from 'drizzle-orm';

const dbPath = process.env.DB_FILE_NAME ?? './stecopro.db';
const sqlite = new Database(dbPath);
const db = drizzle(sqlite, { schema: { users } });

async function main() {
  await db.update(users).set({ active: false }).where(eq(users.email, 'e2e-temp@steco-demo.no'));
  console.log('Temp user deactivated.');
}
main().catch((e) => { console.error(e); process.exit(1); });
" 2>&1

# Step 4: Verify deactivated user is rejected (401)
deact_code=$(curl -s -o /dev/null -w '%{http_code}' -c /tmp/c_ph5_deact.txt -X POST "$BASE/api/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"e2e-temp@steco-demo.no","password":"demo123"}')
check $([ "$deact_code" = "401" ] && echo 1 || echo 0) "SC9: deaktivert bruker avvises med 401"

# Step 5: Clean up temp user
npx tsx -e "
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { users } from './src/db/schema.js';
import { eq } from 'drizzle-orm';

const dbPath = process.env.DB_FILE_NAME ?? './stecopro.db';
const sqlite = new Database(dbPath);
const db = drizzle(sqlite, { schema: { users } });

async function main() {
  await db.delete(users).where(eq(users.email, 'e2e-temp@steco-demo.no'));
  console.log('Temp user deleted.');
}
main().catch((e) => { console.error(e); process.exit(1); });
" 2>&1

# ─────────────────────────────────────────────────────────────────────────────
# Clean up cookie jars
rm -f /tmp/c_ph5_op.txt /tmp/c_ph5_leder.txt /tmp/c_ph5_admin.txt /tmp/c_ph5_sys.txt /tmp/c_ph5_temp.txt /tmp/c_ph5_deact.txt

echo ""
echo "RESULT: $pass passed, $fail failed"
[ $fail -eq 0 ]
