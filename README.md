This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Fase 7 — PWA-operatørapp

Steco Pro inkluderer en PWA-vennlig operatørflate tilgjengelig på `/skift` og `/varsler`.

### Desktop-demo

```bash
npm run demo:setup   # seed database + simuler historikk
npm run dev          # start dev server på http://localhost:3000
```

1. Logg inn som `operator@steco-demo.no` / `demo123`
2. Åpne `/varsler` → klikk **Aktiver varsler på denne enheten** (localhost = sikker kontekst i Chrome)
3. Klikk **Utløs teststans** (eller POST `/api/dev/trigger-stop`) → OS-notifikasjon dukker opp
4. Klikk notifikasjonen → åpner `/stopp/{id}` → **Kvitter**, legg til kommentar, last opp bilde
5. Gå til `/skift` → se dagens stopp i loggen, skriv skiftnotat

### Mobil / HTTPS

For PWA-installasjon og push på ekte mobil trenger du HTTPS:

```bash
# Alternativ 1 — Next.js experimentell HTTPS (selvsignert sertifikat)
next dev --experimental-https

# Alternativ 2 — Tailscale Serve / ngrok (anbefalt for deling)
tailscale serve http:3000 https:443
```

**iOS-krav:** Safari 16.4+ og «Legg til på Hjem-skjermen» (`Share → Add to Home Screen`) før push-varsler aktiveres. Bruk `/varsler` som fallback uten installasjon.

### Feilsøking mobil (lærdom fra praksis)

Symptomet «siden vises, men ingen knapper virker / varselknappen mangler» har tre kjente årsaker — sjekk i denne rekkefølgen:

1. **Next blokkerer dev-JS for andre enheter.** Next 16 blokkerer cross-origin
   tilgang til `/_next/*` i dev som standard — telefonen får HTML men ingen
   JavaScript. Maskinens LAN-adresser må ligge i `allowedDevOrigins` i
   [next.config.ts](next.config.ts). Ved nytt nett/ny IP: legg til IP-en der.
2. **Sertifikatet dekker ikke adressen telefonen bruker.** Står det
   «Ikke sikkert» i Safari-adressefeltet finnes ikke Push-API-et, og iOS henter
   verken app-ikon eller service worker. Sertifikatet i `certificates/` må ha
   riktig IP/hostnavn i SAN, og mkcert-rot-CA-en
   (`~/Library/Application Support/mkcert/rootCA.pem`) må være installert og
   gitt full tillit på telefonen (Innstillinger → Generelt → Om →
   Tillitsinnstillinger for sertifikater). Tips: bruk
   `https://<maskinnavn>.local:3000` fra telefonen — mDNS-navnet overlever
   nettverksbytte, i motsetning til IP-en.
3. **Turbopack-cachen serverer gammel kode.** Hvis endringer ikke når
   nettleseren selv etter omstart: stopp serveren, `rm -rf .next`, start igjen.
   Installerte iOS-webapper cacher i tillegg aggressivt — tvangslukk appen,
   eller slett og legg til ikonet på nytt.

Diagnoselinjen på `/varsler` (vises når varsler er utilgjengelig) forteller
hvilken brikke som mangler: sikker kontekst, service worker, push-API eller
standalone-modus.

### VAPID-nøkler

Push-varsler krever VAPID-nøkler i `.env.local`:

```bash
npx web-push generate-vapid-keys
```

Legg resultatet i `.env.local`:

```
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:din@epost.no
```

Uten nøkler degraderer appen elegant — varslene vises ikke, men `/varsler` og alle andre sider fungerer normalt.

### Kjør E2E-testen

```bash
# Server må kjøre + demo-data seedes
npm run demo:setup
npm run dev &
zsh scripts/e2e-phase7.sh
# eller med custom port:
BASE=http://localhost:3075 zsh scripts/e2e-phase7.sh
```

Testen dekker: trigger→kvitter→kommentar→bilde→skiftnotat + 401/400/404-negatives og tenant-isolasjon.
