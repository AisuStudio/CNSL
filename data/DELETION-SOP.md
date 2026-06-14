# Lösch-SOP (DSGVO Art. 17 — Recht auf Löschung)

Wie eine Account-/Datenlöschung bei CNSL abläuft und nachgewiesen wird.
Stand: 2026-06-13.

## 1. Auslöser
- **Self-Service:** Nutzer:in → Settings → „Delete account…" → Bestätigung.
- **Per E-Mail:** Anfrage an `CNSL@aisu.studio` (Identität des Absenders prüfen).

## 2. Sofort-Löschung aus der Live-Datenbank (automatisch)
`DELETE /api/account` (`app/api/account/route.ts`) löscht in einer Transaktion **alle** Daten des Users und anschließend die Auth-Identität:

1. User-gebundene Zeilen zuerst: `TimeEntry`, `LogEntry`, `BoardMember` (per `userId`).
2. Alle Inhalte der eigenen Boards (per `boardId`): `Task`, `Note`, `Event`, `Project`, `Schedule`, `Activity`, `Folder`, `BoardMember`.
3. `Board` (per `ownerId`) und `Profile` (per `id`).
4. Supabase **Auth-User** via Admin-API (`auth.admin.deleteUser`, Service-Role-Key, serverseitig).

> Hinweis: Die meisten Inhaltstabellen tragen nur eine `boardId`-**Spalte** ohne FK-Cascade — deshalb wird jeder Typ **explizit** gelöscht, nicht auf Cascade vertraut. User-gebundene Tabellen werden vor `Profile` gelöscht, damit keine Referenz die Löschung blockiert.

**Nachweis Live-Löschung:** nach Ausführung sind in der DB keine Zeilen mehr mit der `userId`/den `boardId`s vorhanden, und der Eintrag in `auth.users` ist weg (Re-Login unmöglich). Bei Bedarf per SQL-Editor stichprobenartig prüfen.

## 3. Löschung aus Backups (Auslauf-Prinzip)
Einzelne Nutzer lassen sich nicht aus einem verschlüsselten Voll-Backup herausschneiden. DSGVO-konformer Weg:
- Live-Daten werden **sofort** gelöscht (Schritt 2).
- Das Backup, das den User noch enthält, **rollt innerhalb der Backup-Retention automatisch aus**.
- **TODO (einmalig):** tatsächliche Supabase-Backup-/PITR-Retention des aktuellen Plans feststellen und hier eintragen:
  - Plan: `__________`
  - Backup-/PITR-Retention: `____ Tage`
  - → Maximale Frist „endgültig aus allen Backups verschwunden": **≤ <Retention> Tage**.
- Diese Frist muss in der Datenschutzerklärung (`app/datenschutz/page.tsx`) benannt sein.

## 4. Fristen & Pflichten
- Live-Löschung: **sofort** mit der Anfrage.
- Vollständige Löschung inkl. Backups: **innerhalb der Backup-Retention** (Ziel ≤ 30 Tage; bei E-Mail-Anfragen DSGVO-Frist „unverzüglich, spätestens 1 Monat").
- Bei E-Mail-Anfragen: Bestätigung der Löschung an die anfragende Adresse senden.

## 5. Edge-Cases
- **Auth-Löschung schlägt fehl:** Inhalte sind bereits weg (DSGVO-Ziel erreicht). Der verwaiste `auth.users`-Eintrag kann manuell im Supabase-Dashboard gelöscht werden.
- **Geteilte Projekte (ab Phase C):** Inhalte, die der User auf **fremden** Boards erstellt hat, tragen nur einen `createdById`-Verweis. Bei aktiviertem Sharing muss die Löschung diese anonymisieren/auf `null` setzen (Schema-Anpassung `onDelete: SetNull` + Migration) — bis dahin nicht relevant (kein Sharing live).
