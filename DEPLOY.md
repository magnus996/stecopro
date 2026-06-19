# Deploy — hjemmelab (Docker + Cloudflare Tunnel)

Steco Pro kjører som én Node-prosess: Next.js (standalone) med innebygd
SQLite-fil, lokal bildelagring og en bakgrunns-simulator som tikker hvert 60.
sekund. Alt dette lever fint i en container med to persistente volumer.

Trafikken kommer inn via en **Cloudflare Tunnel** (cloudflared-container), så du
slipper å åpne porter — og du får HTTPS, som push-varsler og PWA-installasjon
krever.

```
 Internett ──HTTPS──▶ Cloudflare ──tunnel──▶ cloudflared ──http──▶ app:3000
                                                                     │
                                                          db (/data) + uploads
```

## Forutsetninger
- Docker + Docker Compose på hjemmelab-serveren
- En Cloudflare-konto med et domene lagt til (for tunnel-hostnavnet)

## 1. Lag Cloudflare-tunnel
1. Cloudflare **Zero Trust** → **Networks → Tunnels → Create a tunnel** (type: *Cloudflared*).
2. Gi den et navn, kopier **install-tokenet** (den lange strengen etter `--token`).
3. Under **Public Hostnames**: legg til hostnavnet du vil bruke
   (f.eks. `stecopro.dittdomene.no`) → **Service: `HTTP`**, **URL: `app:3000`**.
   (`app` er compose-tjenestenavnet — cloudflared når den over compose-nettet.)

## 2. Sett opp miljøvariabler
```bash
cp .env.docker.example .env
```
Fyll inn i `.env`:
- `SESSION_SECRET` — `openssl rand -hex 32`
- `NEXT_PUBLIC_APP_URL` — `https://stecopro.dittdomene.no` (samme som tunnel-hostnavnet)
- `TUNNEL_TOKEN` — tokenet fra steg 1
- VAPID-nøkler (valgfritt) — `npx web-push generate-vapid-keys`. Uten disse
  fungerer alt unntatt push-varsler.

> `NEXT_PUBLIC_APP_URL` bakes inn ved bygging. Endrer du hostnavn må du bygge på
> nytt (`docker compose build app`).

## 3. Seed databasen (én gang)
Lager skjemaet og fyller inn demo-data på `db`-volumet:
```bash
docker compose --profile seed run --rm seed
```
Kjør samme kommando senere for å nullstille demo-dataene.

## 4. Start
```bash
docker compose up -d --build
docker compose logs -f app          # se etter "[simulator] live mode started"
```

Åpne `https://stecopro.dittdomene.no`. Logg inn med demo-bruker
(`operator@steco-demo.no` / `demo123`) og test `/varsler` for push.

## Drift
| Oppgave | Kommando |
|---|---|
| Oppdater kode | `git pull && docker compose up -d --build` |
| Se logger | `docker compose logs -f app` |
| Nullstill demo-data | `docker compose --profile seed run --rm seed` |
| Stopp alt | `docker compose down` |
| Backup | kopier ut Docker-volumene `stecopro_db` og `stecopro_uploads` |

## Merknader
- **Data ligger i Docker-volumer** (`db`, `uploads`), ikke i imaget — de overlever
  `up`/`down` og rebuild. `docker compose down -v` SLETTER dem.
- **Simulatoren** starter automatisk i app-containeren via Next.js instrumentation.
  Den fyller etter et avbrudd opp inntil 24 t med data ved oppstart.
- **Kun HTTPS via tunnelen** gir push/PWA. Vil du også nå appen på LAN, fjern
  kommentaren på `ports:` i `docker-compose.yml` (men det blir HTTP — uten push).
