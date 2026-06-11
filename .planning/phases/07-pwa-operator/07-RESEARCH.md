# Fase 7: PWA-operatørapp med push-varsler («Mitt skift»)

## Kontekst

Operatørene skal kunne få varsler på mobilen når anlegget trenger dem (feilstopp inkl. nødstopp, bunker tom) og rapportere underveis i skiftet: kvittere alarmer, kommentere/korrigere stoppårsak, skrive skiftnotater og laste opp bilder (mobilkamera). Brukerens valg: **PWA i samme Next.js-kodebase** (ikke native app), varsler for **alle feilstopp + bunker tom** (ikke planlagte stopp, ingen skiftoppsummering i v1), bygges **nå som GSD fase 7** med autonom utførelse som tidligere faser.

Bildeopplasting fungerer i PWA: `<input type="file" accept="image/*" capture="environment">` åpner kameraet direkte.

## Arkitekturbeslutninger

1. **PWA-shell:** `src/app/manifest.ts` (typed metadata route, `start_url: '/skift'`, `display: standalone`, mørkt tema `#18181b`). App-ikoner genereres runtime med `ImageResponse`/`next/og` fra `public/logo-hvit.png` på mørk bakgrunn (`src/app/icon-192.png/route.tsx`, `icon-512.png/route.tsx`, `apple-icon.tsx`) — ingen nye deps, ingen binærfiler. Fallback hvis satori krangler: committe statiske PNG-er.
2. **Service worker `public/sw.js`** — kun push + notificationclick (deep-link til `/stopp/{id}`), ingen offline-caching (utdatert «live»-dashboard er villedende). Registreres av `src/components/PwaRegistrar.tsx` montert i den innloggede `(app)/layout.tsx` — aldri på /login.
3. **Push-pipeline:** `web-push` (npm) med VAPID-nøkler i `.env.local` (genereres med `npx web-push generate-vapid-keys`; public key serveres via `GET /api/push/vapid-public-key`, ikke `NEXT_PUBLIC_*`). Ny tabell `push_subscriptions` (tenantId, userId, endpoint UNIQUE, p256dh, auth). Subscribe-API gjør **upsert på endpoint** (re-login på samme enhet). Manglende VAPID-nøkler degraderer pent (notifier no-op + warn, subscribe → 503) så `demo:setup` forblir grønn.
4. **Notifier `src/lib/notifier/notifier.ts`:** ren modul som tar `db` som parameter (kjører både i live-loopens instrumentation-kontekst uten request og i route handlers; kan IKKE bruke `@/db`/`next/headers`). Filter: `stopType === 'fault'` eller (`idle` && reason `'Bunker tom'`), aldri `planned`. Pruner døde abonnementer (404/410). **5-minutters throttle per tenant+årsak er obligatorisk** — live-ticken lukker åpne stopp ved tick-slutt og kan re-åpne samme stopp med ny id neste minutt. Returnerer `{attempted, sent, pruned}` (assertion-hook for E2E). Web-push-feil må aldri kaste inn i live-loopen.
5. **Live-only varsling via decorator:** `NotifyingAdapter` (implementerer `IngestAdapter`, delegerer alt, fyrer notifikasjon etter `reportStop`). **Kritisk:** i `live.ts` får KUN `advanceLiveTick`-intervallet den wrappede adapteren — oppstarts-catchup (`runBackfill`) beholder bar `SqliteIngestAdapter`, ellers varselstorm ved restart. Ingest-grensesnittet forblir koblingspunktet for ekte OPC UA senere.
6. **Skriving via route handlers, ikke server actions** (ack/kommentar/notat/foto): server actions har 1 MB body-grense (foto er opptil 10 MB), og curl-E2E-mønsteret vårt kan ikke snakke RSC-protokollen. Ny helper `src/lib/api-auth.ts` → `getApiSession()` (cookie → decrypt → payload | null, 401) fordi `verifySession()` i dal.ts redirecter — feil for API-er. Lesing til sider skjer fortsatt i `dal.ts` (tenantId fra sesjon).
7. **Foto:** filer under `./uploads/{tenantId}/{uuid}.{ext}` (gitignores), metadata i ny `photos`-tabell, serveres KUN via autentisert `GET /api/photos/[id]` med tenant-sjekk (404 ved fremmed tenant). `POST /api/photos` multipart: maks 10 MB, mime `image/*`.
8. **Sider (responsivt, ingen egen /mobile-tre):**
   - `/skift` «Mitt skift» — mobil-først operatørhjem: status, dagens stopp med Kvitter/kommentar/kamera, skiftlogg med composer. Manifest start_url.
   - `/varsler` — varselhistorikk (fault + Bunker tom, siste 48 t, med kvitteringsstatus) + «Aktiver varsler på denne enheten»-toggle. Fungerer uten push-tillatelse → demo-fallback på iPhone uten installasjon.
   - `/stopp/[id]` — stoppdetalj (deep-link-mål fra varsler): info, kvitteringer, kommentartråd med bilder, korrigeringsskjema.
   - `nav.ts`: «Mitt skift» + «Varsler» for alle roller; `proxy.ts` protectedRoutes += `/skift`, `/varsler`, `/stopp`.
9. **Demo-trigger `POST /api/dev/trigger-stop`** (i prod: admin+; i dev: enhver sesjon): injiserer stopp via ingest-adapteren og kaller notifier — både demoknapp («Utløs teststans» på /varsler i dev) og E2E-probe. Nødvendig fordi simulatoren bare gir en feil ca. hver 3. time.
10. **HTTPS-veier for mobildemo (dokumenteres):** desktop Chrome på `localhost:3000` er secure context (E2E + skjermdemo funker rett ut). Telefon krever HTTPS: `next dev --experimental-https`, eller tailscale serve/ngrok. iOS krever i tillegg 16.4+ og «Legg til på Hjem-skjerm» før push — `/varsler`-siden er fallback.

## Nye tabeller (mønster: tenantId NOT NULL FK, Unix-sekunder-timestamps, drizzle-kit push)

- `push_subscriptions` (tenantId, userId, endpoint UNIQUE, p256dh, auth, userAgent, createdAt)
- `photos` (tenantId, userId, filePath, mimeType, sizeBytes, createdAt)
- `stop_acknowledgements` (tenantId, stopEventId, userId, createdAt; UNIQUE(stopEventId, userId))
- `stop_comments` (tenantId, stopEventId, userId, comment NULL, correctedReason NULL, photoId NULL FK; zod-regel: comment ELLER correctedReason)
- `shift_notes` (tenantId, plantId, userId, content, photoId NULL, createdAt) — ingen shiftId-FK; skift utledes av plantId+createdAt via `src/lib/time.ts`

`src/db/seed.ts` slette-liste utvides FK-trygt: stopAcknowledgements → stopComments → shiftNotes → photos → pushSubscriptions → (eksisterende liste).

Varseltekster (norsk): fault → «⚠ Driftsstans: {årsak}», idle → «Bunker tom — fyll på innmating»; body «{anlegg} — kl. HH:mm», url `/stopp/{id}`.

## Utførelse: GSD fase 7, 5 planer i 3 bølger

Registrer fase 7 i ROADMAP/REQUIREMENTS (nye krav: PWAS-01 shell/manifest/SW, NOTI-01 push-pipeline, NOTI-02 varselhistorikk, REPT-01 kvittering, REPT-02 stoppkommentar/korrigering, REPT-03 skiftnotater, REPT-04 foto). Lagre dette designet som `.planning/phases/07-pwa-operator/07-RESEARCH.md` så gsd-planneren konsumerer det, kjør planner → plan-checker → executors (samme autonome flyt som fase 1–6).

| Bølge | Plan | Innhold | Verifisering (maskinell) |
|------|------|---------|--------------------------|
| 1 | 07-01 Datafundament | 5 tabeller, seed-sletteliste, `api-auth.ts`, `.gitignore` `/uploads`, `.env.example` VAPID | `db:push` + `demo:setup` grønn; insert/select-runde i alle nye tabeller |
| 1 | 07-02 PWA-shell | manifest.ts, ikon-ruter, sw.js, PwaRegistrar, viewport/metadata | curl: manifest 200 m/standalone, ikoner 200 image/png, sw.js har push-handler |
| 2 | 07-03 Push-pipeline | web-push, notifier + vitest (throttle, pruning, filter, feiltoleranse), NotifyingAdapter, live.ts-wiring, subscribe/unsubscribe/vapid-API, PushToggle, dev/trigger-stop | vitest m/injisert fake webpush; curl: subscribe→rad→trigger-stop→attempted≥1→unsubscribe; 401 uten cookie |
| 2 | 07-04 Rapporterings-API + DAL | photos-API (upload+serve), ack-, comments-, notes-ruter, DAL-accessorer (getTodaysStopsWithAcks, getStopDetail, getRecentNotifiableStops, getShiftNotes) | curl: foto-rundtur (inkl. 400 på >10MB/ikke-bilde), idempotent ack, kommentar m/korrigering+foto, notat; 401-sjekker |
| 3 | 07-05 Operatør-UI + E2E | /skift, /varsler, /stopp/[id], nav, proxy, `scripts/e2e-phase7.sh`, README/demo-dokumentasjon | e2e-phase7.sh: sider 200 m/norske markører, full flyt trigger→varsel→ack→kommentar→foto→notat; `npm test` + `demo:setup` grønn |

Ingen filoverlapp innen bølger (07-01/07-02 disjunkte; 07-03/07-04 disjunkte). Faseverifisering med gsd-verifier + regresjon av e2e-phase1/3/5/6 til slutt.

## Fallgruver for executors (innbakes i planene)

1. Backfill skal IKKE varsle — kun interval-ticken får NotifyingAdapter.
2. Notifier kjører utenfor request-kontekst: `db` alltid som parameter, aldri `@/db`/`next/headers`/`verifySession`.
3. Timestamps er Unix-SEKUNDER (rå SQL trenger ×1000 mot Date.now()).
4. 5-min årsaks-throttle er påkrevd pga. per-minutt re-emisjon av stopp.
5. `verifySession()` redirecter — API-ruter bruker `getApiSession()` → 401.
6. Subscribe = upsert på endpoint, ellers 500 ved re-subscribe.
7. `npm install --cache .npm-cache` (sandbox).
8. Manglende VAPID-nøkler → pen degradering, demo:setup forblir grønn.
9. ImageResponse: alle div-er trenger eksplisitt `display:'flex'`; logo via readFileSync+base64. >30 min trøbbel → statiske PNG-er.

## Verifisering ende-til-ende

1. `npm run demo:setup && npm run dev` → logg inn → `/varsler` → «Aktiver varsler» i desktop Chrome (localhost = secure context) → «Utløs teststans» → OS-varsel vises → klikk åpner `/stopp/{id}` → Kvitter + kommenter + last opp bilde → synlig i tråden og på `/skift`.
2. `zsh scripts/e2e-phase7.sh` (hele flyten via curl) + `npm test` + regresjonssuitene fase 1/3/5/6.
3. Mobildemo: `next dev --experimental-https` + telefon på samme nett (Android Chrome; iPhone: installer på Hjem-skjerm først).
