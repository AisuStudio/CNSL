# CNSL — Security-Protokoll

Verbindliche Regeln für Betrieb, Tests und Datenschutz von CNSL.
Stand: 2026-06-13 · Status: **Closed Beta** · Verantwortlich: Aisu.Studio (Dominik)

Stack: Next.js 15/16 (App Router, TS) · Supabase (Postgres + Auth + Realtime) ·
Prisma · Vercel (`cnsl.aisu.studio`).

---

## 1. Umgebungstrennung & Zugriffsregeln

| Umgebung | Was | Zugriff für Claude/Agenten | Userdaten |
|---|---|---|---|
| **Local / Branch** | `npm run dev`, Demo-Mode (`NEXT_PUBLIC_DEMO=true`), Feature-Branches | **Voll** — entwickeln, white-box testen | Nein (lokal/synthetisch) |
| **Staging** *(aufzusetzen)* | Eigenes Supabase-Projekt + Vercel-Preview, nur Testdaten | **Voll** — authentifizierte Pentests, IDOR-/RLS-Tests | Nein (Testdaten) |
| **Prod** (`cnsl.aisu.studio`) | Vercel-Prod + Prod-Supabase | **Nur black-box von außen** (curl/HTTP) | **Ja — unantastbar** |

**Eiserne Regeln**
- Prod-Interna (DB, Service-Role-Key, Server-Shell) werden von Automatisierung **nie** angefasst. Prod-DB-Zugriff und Push nach `main` bleiben **freigabepflichtig** (durch den Auto-Mode-Classifier erzwungen — beibehalten).
- Secrets (`DATABASE_URL`, `DIRECT_URL`, `SUPABASE_SERVICE_ROLE_KEY`) leben nur in `.env.local` (gitignored) und in der Vercel-Env. Nie in Code, Logs, Commits oder Chat.
- Pentests gegen Prod **nur** mit ausdrücklicher Freigabe und nur die black-box-Klasse aus §2.
- Sicherheitsrelevante Arbeit immer auf einem **Branch**, nie direkt auf `main`.

## 2. Test- & Pentest-Methodik (3 Stufen)

1. **White-box (Local/Branch/Staging):** Code-Review, `npm audit`, `tsc --noEmit`, authentifizierte IDOR-/AuthZ-Tests mit 2 Test-Accounts, RLS-Verifikation.
2. **Authentifizierter Pentest (nur Staging):** OWASP-Top-10-Durchlauf — Auth-Bypass, IDOR/BOLA, Injection, Rate-Limit, Session-Handling.
3. **Black-box (Prod, nur mit Freigabe):** externe HTTP-Checks — Security-Header, TLS, Open-Redirect, unauth-Endpoints, robots. **Kein** Last-/DoS-/Brute-Force gegen Prod.

**Werkzeuge**
- `/security-review` (Claude-Skill) vor jedem Merge sicherheitsrelevanter Änderungen (Auth, API, DB, Sharing).
- `/code-review` / „ultrareview" für tiefere Multi-Agent-Reviews größerer Auth-/API-Änderungen.
- `npm audit` + **Dependabot** + **CodeQL** (in CI, siehe `.github/`).
- Black-box gegen Prod (Freigabe): `curl -I` (Header/Redirects/HSTS), `testssl.sh` (TLS), `nuclei` mit defensiven Templates.
- Authentifizierte Tests (nur Staging): 2 Test-Accounts für IDOR-Skripte gegen `/api/state`, RLS-Check via Supabase-Client mit fremdem JWT, OWASP-ZAP authenticated scan.
- **Guardrail:** jeder aktive Test über reines externes HTTP-Lesen hinaus läuft gegen Local/Staging — **nie** gegen Prod-Interna.

## 3. Secure-Development-Routinen

- Jeder PR: `tsc --noEmit` + `npm audit` grün/triagiert.
- **Dependabot** (wöchentlich) + **CodeQL** (PR + wöchentlich) aktiv.
- Secret-Scanning: kein `.env`/Key jemals committen.
- **Vor Aktivierung von Phase C (Sharing)** zwingend: vollständiger AuthZ-Review (Membership-Checks) + echtes RLS — das Bedrohungsmodell wechselt von „single-owner" zu „multi-tenant".

## 4. Architektur-Sicherheitsmodell (Ist-Stand)

- **Auth:** Supabase (httpOnly-Session-Cookies via `@supabase/ssr`). Middleware schützt alle Routen außer `/`, `/login`, `/auth`, `/api`, Legal-Seiten.
- **Autorisierung:** App-seitig in `app/api/state/route.ts`. Jede Lese-/Schreiboperation ist auf die Boards/`userId` des Session-Users gescoped; Cross-Board-Writes werden verworfen (IDOR-Fix C1).
- **RLS:** aktuell **nur für Realtime-Reads** aktiv. App-Writes laufen über die Prisma-Verbindung (`postgres`-Rolle, BYPASSRLS) → die App-Schicht ist die alleinige Schranke. Akzeptabel für Single-Owner-Beta; **echtes RLS ist Pflicht vor Sharing** (siehe §3).
- **Eingaben:** Payload-Caps (10k Items / 100k Zeichen → 413). Prisma parametrisiert (kein SQLi).
- **Ausgaben:** TipTap-Notizen laufen über Markdown (kein Raw-HTML-Render); RTF-Export escaped. Security-Header gesetzt (`next.config.ts`), CSP zunächst Report-Only.
- **Datenverarbeiter:** nur Supabase + Vercel; keine Analytics/Tracker, Fonts selbst gehostet.

## 5. Befund-Register

Schwere: 🔴 hoch · 🟠 mittel · 🟡 niedrig · ✅ behoben

| ID | Stand | Befund | Ort / Fix |
|---|---|---|---|
| S1 | ✅ | Keine Security-Header/CSP | `next.config.ts` — Header gesetzt, CSP Report-Only |
| S2 | ✅ | Open-Redirect im Magic-Link-Callback (`next` ungeprüft) | `app/auth/callback/route.ts` — `safeNext()` (nur lokale Pfade) |
| S3 | 🟠 | Account-Löschung war nicht implementiert (Art. 17) | `app/api/account/route.ts` (DELETE) + Settings-UI — **gebaut, muss auf Staging E2E-getestet werden, bevor Prod** |
| S4 | 🔴 (offen) | RLS nur für Realtime; Writes über Prisma-Superuser | `data/rls-realtime.sql` — echtes RLS vor Phase-C-Sharing |
| S5 | ✅ | `?hue=`-CSS-Injection | `app/app/page.tsx` + `app/layout.tsx` — Hex-Regex-Validierung |
| S6 | 🟠 (offen) | Beta-Code im Client-Bundle = faktisch offene Registrierung | `lib/auth-config.ts` — echtes Gate via Phase-C-Invites / E-Mail-Verifizierung |
| S7 | ✅/🟠 | Keine CI-Security-Scans / Rate-Limits | Dependabot + CodeQL ergänzt; Supabase-Auth-Rate-Limits noch prüfen |
| S8 | 🟡 (offen) | E-Mail dupliziert in `Profile.displayName` | `lib/board.ts` — bei Phase-C-Identity aufräumen |

## 6. DSGVO-Kurzreferenz

- **Auftragsverarbeiter (AVV/DPA nötig):** Supabase (Auth+DB, EU-Region, US-Konzern → SCC/DPF) · Vercel (Hosting, EU-Region, US-Konzern → SCC/DPF). Beide DPAs abschließen und ablegen.
- **PII:** E-Mail (Supabase `auth.users` + `Profile.displayName`), User-Inhalte (Tasks/Notes/Events/Logs/Schedules/Activities). Keine Zahlungs-/Gesundheitsdaten.
- **Löschung (Art. 17):** Self-Service in Settings → `DELETE /api/account` löscht alle eigenen Daten + den Auth-User. Backup-Auslauf siehe `data/DELETION-SOP.md`.
- **Auskunft/Portabilität (Art. 20):** Settings → „Download my data" → `GET /api/account` (vollständiger JSON-Export).
- **Aufbewahrung:** siehe Datenschutzerklärung (`app/datenschutz/page.tsx`).

## 7. Reaktion auf Vorfälle

Bei Verdacht auf Kompromittierung: (1) betroffene Keys rotieren (Supabase Service-Role + DB-Passwort, Vercel-Env), (2) Supabase-Auth-Logs prüfen, (3) Umfang aus DB/Logs eingrenzen, (4) bei Personenbezug Meldepflichten (Art. 33/34 DSGVO, 72 h) prüfen. Sicherheitsmeldungen an **CNSL@aisu.studio**.
