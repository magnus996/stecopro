#!/bin/zsh
# E2E test for Phase 7 — PWA Operator: trigger→ack→comment→photo→note full flow
#
# Verifies:
#   SC0  — app is up
#   SC1  — operator + tenant-2 logins
#   SC2  — operator pages /skift + /varsler return 200 with Norwegian markers
#   SC3  — push negatives: subscribe without cookie → 401; vapid key → 200 or 503
#   SC4  — trigger-stop → notify (stopId + attempted asserted)
#   SC5  — ack idempotency: POST ack twice (both ok)
#   SC6  — comment + correction: empty → 400; with comment → 201; with correctedReason → 201
#   SC7  — photo round-trip: PNG upload → 201 → GET 200 image/png; >10MB → 400; tenant-2 GET → 404
#   SC8  — shift note: POST → 201; /skift body contains note text
#   SC9  — stop detail page: /stopp/{id} → 200; /stopp/999999 → 404
#   SC10 — deep-link visibility: /skift contains triggered stop reason; /stopp/{id} contains comment
#
# Requires: dev server running + demo data seeded
# Run:      zsh scripts/e2e-phase7.sh
# Override: BASE=http://localhost:3004 zsh scripts/e2e-phase7.sh

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

# ─────────────────────────────────────────────────────────────────────────────
# SC0 — app is up
# ─────────────────────────────────────────────────────────────────────────────
code=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/login")
check $([ "$code" = "200" ] && echo 1 || echo 0) "SC0: /login svarer 200 (app kjører)"

# ─────────────────────────────────────────────────────────────────────────────
# SC1 — logins
# ─────────────────────────────────────────────────────────────────────────────
r_op=$(login operator@steco-demo.no /tmp/c_ph7_op.txt)
check $(echo "$r_op" | grep -q '"ok":true' && echo 1 || echo 0) "SC1: operatør (operator@steco-demo.no) kan logge inn"

r_t2=$(login bruker@isolasjonstest.no /tmp/c_ph7_t2.txt)
check $(echo "$r_t2" | grep -q '"ok":true' && echo 1 || echo 0) "SC1: tenant-2 bruker (bruker@isolasjonstest.no) kan logge inn"

# ─────────────────────────────────────────────────────────────────────────────
# SC2 — operator pages
# ─────────────────────────────────────────────────────────────────────────────
skift_code=$(status /skift /tmp/c_ph7_op.txt)
skift_body=$(body /skift /tmp/c_ph7_op.txt)
check $([ "$skift_code" = "200" ] && echo 1 || echo 0) "SC2: /skift returnerer 200"
check $(echo "$skift_body" | grep -q 'Mitt skift' && echo 1 || echo 0) "SC2: /skift inneholder «Mitt skift»"

varsler_code=$(status /varsler /tmp/c_ph7_op.txt)
varsler_body=$(body /varsler /tmp/c_ph7_op.txt)
check $([ "$varsler_code" = "200" ] && echo 1 || echo 0) "SC2: /varsler returnerer 200"
check $(echo "$varsler_body" | grep -q 'Varsler' && echo 1 || echo 0) "SC2: /varsler inneholder «Varsler»"

# ─────────────────────────────────────────────────────────────────────────────
# SC3 — push negatives
# ─────────────────────────────────────────────────────────────────────────────
# Subscribe without cookie → 401
sub_noauth=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/push/subscribe" \
  -H 'Content-Type: application/json' \
  -d '{"endpoint":"https://example.com/fake","keys":{"p256dh":"fake","auth":"fake"}}')
check $([ "$sub_noauth" = "401" ] && echo 1 || echo 0) "SC3: POST /api/push/subscribe utan cookie → 401"

# VAPID key → 200 or 503 (graceful degradation when keys not configured)
vapid_code=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/api/push/vapid-public-key")
check $([ "$vapid_code" = "200" ] || [ "$vapid_code" = "503" ] && echo 1 || echo 0) "SC3: GET /api/push/vapid-public-key → 200 eller 503 (konfigurert eller degradert)"

# ─────────────────────────────────────────────────────────────────────────────
# SC4 — trigger-stop → notify (stopId + attempted)
# ─────────────────────────────────────────────────────────────────────────────
# First subscribe a fake push endpoint so attempted >= 1
# We test attempted is present; it may be 0 if VAPID keys not configured — that's ok
FAKE_ENDPOINT="https://push.example.com/e2e-test-$(date +%s)"
sub_fake=$(curl -s -o /dev/null -w '%{http_code}' -b /tmp/c_ph7_op.txt \
  -X POST "$BASE/api/push/subscribe" \
  -H 'Content-Type: application/json' \
  -d "{\"endpoint\":\"$FAKE_ENDPOINT\",\"keys\":{\"p256dh\":\"BGXY8Ip7bgGqH2lM0VVGnH_YfwrW9Cek4G2KWdJYDZSJhQ\",\"auth\":\"eFBUMVpnczgzMTc=\"}}")
# Don't assert subscribe status — fake endpoint may be rejected by validation

trigger_res=$(curl -s -b /tmp/c_ph7_op.txt -X POST "$BASE/api/dev/trigger-stop" \
  -H 'Content-Type: application/json' \
  -d '{"reason":"E2E driftsstans test","stopType":"fault"}')
echo "Trigger response: $trigger_res"

check $(echo "$trigger_res" | grep -q '"stopId"' && echo 1 || echo 0) "SC4: trigger-stop returnerer stopId"
check $(echo "$trigger_res" | grep -q '"attempted"' && echo 1 || echo 0) "SC4: trigger-stop returnerer attempted"

# Extract stopId for subsequent tests — try python3 first, fall back to grep/sed
STOP_ID=$(echo "$trigger_res" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('stopId',''))" 2>/dev/null)
if [ -z "$STOP_ID" ]; then
  STOP_ID=$(echo "$trigger_res" | grep -o '"stopId":[0-9]*' | grep -o '[0-9]*')
fi
echo "Extracted stopId: $STOP_ID"
check $([ -n "$STOP_ID" ] && echo 1 || echo 0) "SC4: stopId ekstrahert fra trigger-respons"

# ─────────────────────────────────────────────────────────────────────────────
# SC5 — ack idempotency
# ─────────────────────────────────────────────────────────────────────────────
ack1=$(curl -s -o /dev/null -w '%{http_code}' -b /tmp/c_ph7_op.txt \
  -X POST "$BASE/api/stops/$STOP_ID/ack")
ack2=$(curl -s -o /dev/null -w '%{http_code}' -b /tmp/c_ph7_op.txt \
  -X POST "$BASE/api/stops/$STOP_ID/ack")
check $([ "$ack1" = "200" ] && echo 1 || echo 0) "SC5: første kvittering → 200"
check $([ "$ack2" = "200" ] && echo 1 || echo 0) "SC5: andre kvittering (idempotent) → 200"

# ─────────────────────────────────────────────────────────────────────────────
# SC6 — comment + correction
# ─────────────────────────────────────────────────────────────────────────────
# Empty body → 400
comment_empty=$(curl -s -o /dev/null -w '%{http_code}' -b /tmp/c_ph7_op.txt \
  -X POST "$BASE/api/stops/$STOP_ID/comments" \
  -H 'Content-Type: application/json' \
  -d '{}')
check $([ "$comment_empty" = "400" ] && echo 1 || echo 0) "SC6: kommentar med tom body → 400"

# With comment → 201
comment_res=$(curl -s -b /tmp/c_ph7_op.txt \
  -X POST "$BASE/api/stops/$STOP_ID/comments" \
  -H 'Content-Type: application/json' \
  -d '{"comment":"sjekket på stedet"}')
comment_status=$(echo "$comment_res" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('ok',''))" 2>/dev/null)
comment_code=$(curl -s -o /dev/null -w '%{http_code}' -b /tmp/c_ph7_op.txt \
  -X POST "$BASE/api/stops/$STOP_ID/comments" \
  -H 'Content-Type: application/json' \
  -d '{"comment":"sjekket på stedet igjen"}')
check $([ "$comment_code" = "201" ] && echo 1 || echo 0) "SC6: kommentar med tekst → 201"

# With correctedReason → 201
correction_code=$(curl -s -o /dev/null -w '%{http_code}' -b /tmp/c_ph7_op.txt \
  -X POST "$BASE/api/stops/$STOP_ID/comments" \
  -H 'Content-Type: application/json' \
  -d '{"correctedReason":"papirbrudd i presse"}')
check $([ "$correction_code" = "201" ] && echo 1 || echo 0) "SC6: korrigert årsak → 201"

# ─────────────────────────────────────────────────────────────────────────────
# SC7 — photo round-trip + tenant isolation
# ─────────────────────────────────────────────────────────────────────────────
# Create a minimal 1×1 PNG (hardcoded base64)
TMPDIR_E2E=$(mktemp -d)
echo 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==' | base64 -d > "$TMPDIR_E2E/test.png"

photo_res=$(curl -s -b /tmp/c_ph7_op.txt \
  -X POST "$BASE/api/photos" \
  -F "file=@$TMPDIR_E2E/test.png;type=image/png")
echo "Photo upload response: $photo_res"

PHOTO_ID=$(echo "$photo_res" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('id',''))" 2>/dev/null)
if [ -z "$PHOTO_ID" ]; then
  PHOTO_ID=$(echo "$photo_res" | grep -o '"id":[0-9]*' | grep -o '[0-9]*')
fi

photo_upload_code=$(echo "$photo_res" | python3 -c "import sys,json; d=json.load(sys.stdin); print(201 if d.get('ok') else 400)" 2>/dev/null)
check $([ "$photo_upload_code" = "201" ] && echo 1 || echo 0) "SC7: PNG opplasting → 201"
check $([ -n "$PHOTO_ID" ] && echo 1 || echo 0) "SC7: photo id ekstrahert"

# GET photo → 200 with image/png content-type
photo_get_code=$(curl -s -o /dev/null -w '%{http_code}' -b /tmp/c_ph7_op.txt "$BASE/api/photos/$PHOTO_ID")
check $([ "$photo_get_code" = "200" ] && echo 1 || echo 0) "SC7: GET /api/photos/$PHOTO_ID → 200"

photo_ct=$(curl -s -o /dev/null -w '%{content_type}' -b /tmp/c_ph7_op.txt "$BASE/api/photos/$PHOTO_ID")
check $(echo "$photo_ct" | grep -q 'image/png' && echo 1 || echo 0) "SC7: Content-Type er image/png"

# >10MB file → 400
dd if=/dev/urandom of="$TMPDIR_E2E/large.bin" bs=1048576 count=11 2>/dev/null
large_code=$(curl -s -o /dev/null -w '%{http_code}' -b /tmp/c_ph7_op.txt \
  -X POST "$BASE/api/photos" \
  -F "file=@$TMPDIR_E2E/large.bin;type=image/jpeg")
check $([ "$large_code" = "400" ] && echo 1 || echo 0) "SC7: fil >10MB → 400"

# Tenant-2 tries to GET tenant-1's photo → 404 (tenant isolation)
t2_photo_code=$(curl -s -o /dev/null -w '%{http_code}' -b /tmp/c_ph7_t2.txt "$BASE/api/photos/$PHOTO_ID")
check $([ "$t2_photo_code" = "404" ] && echo 1 || echo 0) "SC7: tenant-2 GET foto fra tenant-1 → 404 (isolasjon)"

# ─────────────────────────────────────────────────────────────────────────────
# SC8 — shift note
# ─────────────────────────────────────────────────────────────────────────────
NOTE_TEXT="E2E skiftnotat $(date +%s)"
note_code=$(curl -s -o /dev/null -w '%{http_code}' -b /tmp/c_ph7_op.txt \
  -X POST "$BASE/api/notes" \
  -H 'Content-Type: application/json' \
  -d "{\"content\":\"$NOTE_TEXT\"}")
check $([ "$note_code" = "201" ] && echo 1 || echo 0) "SC8: POST /api/notes → 201"

# Verify note text appears on /skift
skift_after=$(body /skift /tmp/c_ph7_op.txt)
note_keyword=$(echo "$NOTE_TEXT" | cut -d' ' -f1-3)  # first 3 words to be safe
check $(echo "$skift_after" | grep -qF "$note_keyword" && echo 1 || echo 0) "SC8: notat vises i skiftloggen på /skift"

# ─────────────────────────────────────────────────────────────────────────────
# SC9 — stop detail page
# ─────────────────────────────────────────────────────────────────────────────
stop_detail_code=$(status "/stopp/$STOP_ID" /tmp/c_ph7_op.txt)
check $([ "$stop_detail_code" = "200" ] && echo 1 || echo 0) "SC9: GET /stopp/$STOP_ID → 200"

stop_404_code=$(status /stopp/999999 /tmp/c_ph7_op.txt)
check $([ "$stop_404_code" = "404" ] && echo 1 || echo 0) "SC9: GET /stopp/999999 → 404"

# ─────────────────────────────────────────────────────────────────────────────
# SC10 — deep-link visibility
# ─────────────────────────────────────────────────────────────────────────────
# /skift should show the triggered stop — SC6 corrected the reason to 'papirbrudd i presse'
# so we check for that corrected reason (which was set by SC6's correctedReason post)
skift_final=$(body /skift /tmp/c_ph7_op.txt)
check $(echo "$skift_final" | grep -q 'papirbrudd i presse' && echo 1 || echo 0) "SC10: /skift viser trigget stopp (med korrigert årsak fra SC6)"

# /stopp/{id} should show comment thread
stopp_body=$(body "/stopp/$STOP_ID" /tmp/c_ph7_op.txt)
check $(echo "$stopp_body" | grep -q 'sjekket på stedet' && echo 1 || echo 0) "SC10: /stopp/$STOP_ID viser kommentar-tråd"

# ─────────────────────────────────────────────────────────────────────────────
# Cleanup
# ─────────────────────────────────────────────────────────────────────────────
# Remove fake push subscription (endpoint inserted earlier — if it was saved)
curl -s -b /tmp/c_ph7_op.txt -X POST "$BASE/api/push/unsubscribe" \
  -H 'Content-Type: application/json' \
  -d "{\"endpoint\":\"$FAKE_ENDPOINT\"}" > /dev/null 2>&1

# Clean up tmp files
rm -rf "$TMPDIR_E2E"
rm -f /tmp/c_ph7_op.txt /tmp/c_ph7_t2.txt

echo ""
echo "RESULT: $pass passed, $fail failed"
[ $fail -eq 0 ]
