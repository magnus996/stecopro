---
phase: 06-calibration-branding-inventory
verified: 2026-06-11T16:55:00Z
status: passed
score: 6/6 must-haves verified
re_verification: false
---

# Phase 6: Calibration, Branding & Inventory — Verification Report

**Phase Goal:** The demo matches the real plant's numbers and look, and tracks bale inventory through production and shipments
**Verified:** 2026-06-11T16:55:00Z
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Steco logo shown in app shell and on login page instead of text wordmark | VERIFIED | `/logo-hvit.png` referenced in layout.tsx (x2: sidebar + mobile) and LoginForm.tsx (x1); no "StecoPro"/"Stecopro" text wordmark remaining in those files |
| 2 | Simulated bunker current draw is 10-15 A loaded / 4-6 A empty; chart threshold at ~8 A | VERIFIED | `CURRENT_BUNKER_FULL_MIN=10/MAX=15`, `CURRENT_BUNKER_EMPTY_MIN=4/MAX=6` in params.ts; engine.ts reads from params (no hardcoded values); CURRENT_BANDS test confirms; chart Y-axis `domain={[0, 20]}`, `ReferenceLine y={8}` |
| 3 | Daily production ~135 bales split ~50/10/8/32 (deink/OCC/tetra/miks); OEE performance plausible | VERIFIED | `BALE_RATES_PER_SHIFT = {deink:40,occ:8,tetra:6,miks:26}` = 80/shift; simulation produces 2036 bales over 14 days (~145/day); split: deink 52%, OCC 10%, tetra 7%, miks 31%; `NOMINAL_BALES_PER_SHIFT=80`; BALE_MIX test green |
| 4 | Dashboard has a bar chart of bales produced today per fraction | VERIFIED | `ProduksjonIDagChart.tsx` exists (65 lines), contains `BarChart`; imported and rendered in `dashboard/page.tsx` with `todayBales` data |
| 5 | Inventory page shows stock per fraction; registering a shipment reduces stock and appears in history | VERIFIED | `inventory/page.tsx` (133 lines) fetches `getStockByFraction` + `getShipmentHistory`; `ShipmentForm.tsx` wired via `useActionState(registerShipment)`; `registerShipment` validates `baleCount > row.stock`; e2e-phase6.sh SC2+SC5 pass: stock drops 53→52 after 1-bale shipment; over-stock (1052 vs 53) correctly rejected |
| 6 | Dashboard widget shows current stock per fraction | VERIFIED | `LagerstatusCard.tsx` exists (42 lines); imported and rendered in `dashboard/page.tsx` with `getStockByFraction` data; e2e-phase6.sh SC3 confirms "Lagerstatus" appears in dashboard HTML |

**Score:** 6/6 truths verified

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/simulator/params.ts` | Calibrated current bands and bale rates | VERIFIED | `CURRENT_BUNKER_FULL_MIN=10/MAX=15`, `CURRENT_BUNKER_EMPTY_MIN=4/MAX=6`, `BALE_RATES_PER_SHIFT={deink:40,occ:8,tetra:6,miks:26}` |
| `src/lib/simulator/engine.ts` | Engine reads rates/empty-current from params | VERIFIED | Imports `BALE_RATES_PER_SHIFT`, `CURRENT_BUNKER_EMPTY_MIN/MAX`; no hardcoded `[45,35,25,15]` or `randFloat(rng, 5, 8)` |
| `src/db/seed.ts` | Calibrated seed: capacity 10 t/h, bunker nominal 15 A | VERIFIED | Line 137: `nominalCapacityTph: 10`; line 162: `nominalCurrentA: 15` |
| `src/lib/dal.ts` | `NOMINAL_BALES_PER_SHIFT=80`; `getStockByFraction`; `getShipmentHistory` | VERIFIED | Line 318: `const NOMINAL_BALES_PER_SHIFT = 80`; lines 1301, 1357 export the DAL accessors |
| `src/actions/inventory.ts` | `registerShipment` with zod + stock guard | VERIFIED | 52 lines; exports `registerShipment`; validates `baleCount > row.stock` before insert |
| `scripts/seed-shipments.ts` | Idempotent post-simulate shipment seed (~95% of produced) | VERIFIED | Runs in `demo:setup`; produces realistic stock (Deink 53, OCC 11, Tetra 8, Miks 32) |
| `src/db/schema.ts` | `bale_shipments` table definition | VERIFIED | Table defined with tenant/plant/fraction FKs, baleCount, shippedAt, note, createdById |
| `public/logo-hvit.png` | White Steco wordmark | VERIFIED | Exists (2324 bytes) at public/logo-hvit.png |
| `src/app/(app)/layout.tsx` | Logo in sidebar + mobile header | VERIFIED | References `/logo-hvit.png` twice (sidebar width=150, mobile width=110), both on `bg-zinc-900` dark backing |
| `src/app/(auth)/login/LoginForm.tsx` | Logo on login card | VERIFIED | References `/logo-hvit.png` once (width=170); no "StecoPro" h1 text remaining |
| `src/app/(app)/inventory/page.tsx` | Lager page: stock table + form + history | VERIFIED | 133 lines; fetches `getStockByFraction` + `getShipmentHistory`; renders ShipmentForm |
| `src/app/(app)/inventory/ShipmentForm.tsx` | Client form bound to registerShipment | VERIFIED | 104 lines; uses `useActionState(registerShipment, undefined)` |
| `src/app/(app)/dashboard/components/LagerstatusCard.tsx` | Dashboard stock-per-fraction widget | VERIFIED | 42 lines; renders stock table with total row |
| `src/app/(app)/dashboard/components/ProduksjonIDagChart.tsx` | Recharts BarChart of today's bales | VERIFIED | 65 lines; contains `BarChart` in `ResponsiveContainer`, `isAnimationActive={false}` |
| `scripts/e2e-phase6.sh` | E2E assertions covering all phase 6 deliverables | VERIFIED | 11/11 assertions pass |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `engine.ts` | `params.ts` | imports `BALE_RATES_PER_SHIFT` + `CURRENT_BUNKER_EMPTY_MIN/MAX` | WIRED | Lines 21-27 of engine.ts import both constants; used at lines 151-154 and 207 |
| `dal.ts` | `NOMINAL_BALES_PER_SHIFT = 80` | constant declaration | WIRED | Line 318; consistent with BALE_RATES_PER_SHIFT total (40+8+6+26=80) |
| `layout.tsx` | `/logo-hvit.png` | `next/image src` | WIRED | Referenced twice; `Image` imported from `next/image` |
| `LoginForm.tsx` | `/logo-hvit.png` | `next/image src` | WIRED | Referenced once; `Image` imported from `next/image` |
| `inventory.ts (action)` | `baleShipments` | tenant-scoped insert after stock check | WIRED | `baleCount > row.stock` guard at line 36; db.insert at line 39 |
| `dal.ts` | `baleShipments + bale_events` | `COUNT - SUM per fraction` | WIRED | `getStockByFraction` subtracts shipped from produced; returns `stock: Math.max(0, ...)` |
| `package.json` | `scripts/seed-shipments.ts` | `demo:setup` and `db:reset` pipeline | WIRED | Both scripts include `npm run seed-shipments` as third step |
| `ShipmentForm.tsx` | `registerShipment` | `useActionState(registerShipment, undefined)` | WIRED | Lines 18-19 of ShipmentForm.tsx |
| `inventory/page.tsx` | `getStockByFraction + getShipmentHistory` | server-component data fetch | WIRED | Line 36-37 of inventory/page.tsx |
| `dashboard/page.tsx` | `getStockByFraction + LagerstatusCard + ProduksjonIDagChart` | server fetch + render | WIRED | Lines 6, 13-14, 56, 138, 146 |
| `nav.ts` | `/inventory` | NAV_ITEMS entry for all roles | WIRED | Line 8: all four roles (`operator`, `produksjonsleder`, `admin`, `system_admin`) |

---

## Test Suite Results

| Test | Result |
|------|--------|
| `npm test` (45 tests) | PASS — 3 test files, 45 tests, 0 failures |
| `npx tsc --noEmit` | PASS — no errors |
| `bash scripts/verify-backfill.sh` | PASS — 7/7 assertions |
| `bash scripts/e2e-phase6.sh` | PASS — 11/11 assertions |
| `bash scripts/e2e-phase3.sh` (regression) | PASS — 21/21 assertions |
| `bash scripts/e2e-phase5-walkthrough.sh` (regression) | PASS — 34/34 assertions |

Notable test coverage:
- CURRENT_BANDS test: bunker readings confirmed to be 0, 4-6 A, or 10-15 A only
- BALE_MIX test: deink is dominant fraction; total 70-90 per 8h shift
- E2E SC5: stock arithmetic round-trip — insert 1-bale shipment reduces stock 53→52; over-stock (1052 bales against 53 in stock) correctly rejected

---

## Anti-Pattern Scan

No blockers or stubs found in phase 6 files. The four occurrences of "placeholder" in ShipmentForm.tsx are HTML `placeholder=` attribute text on input fields, not stub patterns.

---

## Production Numbers Validation

From live `demo:setup` run (14-day backfill, availability 90.6%):
- Total bales: 2036 over 14 days = **~145/day** (target ~135; within plausible range given 90.6% availability × 2 shifts × 80 nominal = 144)
- Split: Deink 52% / OCC 10% / Tetra 7% / Miks 31% (target 50/10/8/32 — all within ±3%)
- Remaining stock after demo seed: Deink 53, OCC 11, Tetra 8, Miks 32 (plausible "tens of bales")
- verify-backfill ASSERT7: total_bales=2036 within expected range [1400, 2200]

---

## Human Verification Recommended

These items were verified structurally but benefit from visual confirmation in a browser:

### 1. Logo legibility in sidebar
**Test:** Open the app, look at the sidebar header.
**Expected:** White Steco logo visible on a dark zinc-900 background (not invisible against white).
**Why human:** Visual contrast cannot be verified by grep.

### 2. Logo legibility on login page
**Test:** Open `/login` without authentication.
**Expected:** White Steco logo visible centred on a dark rounded pill above the login form.
**Why human:** Visual layout verification.

### 3. CurrentDrawChart Y-axis readability
**Test:** Open the dashboard and view the current-draw chart.
**Expected:** Y-axis shows 0-20 A range; the 8 A dashed "Bunker tom" threshold line sits between the empty (4-6 A) and loaded (10-15 A) bands, clearly readable.
**Why human:** Chart rendering requires a browser.

### 4. Inventory shipment UX round-trip
**Test:** Log in as operator, navigate to Lager, select a fraction, enter a count under the in-stock number, submit.
**Expected:** Success banner "Utsendelse registrert" appears; stock table refreshes with reduced count; entry appears in history.
**Why human:** Server action revalidatePath behaviour and form UX requires browser interaction.

---

## Summary

All 6 observable goal truths verified. Every artifact exists, is substantive (42-133 lines), and is fully wired. No stubs, orphaned components, or broken links. The automated test suite (45 unit tests + 66 E2E assertions across three scripts + 7/7 backfill assertions) passes clean. The production numbers match the target calibration within acceptable variance. Phase 6 goal is achieved.

---

_Verified: 2026-06-11T16:55:00Z_
_Verifier: Claude (gsd-verifier)_
