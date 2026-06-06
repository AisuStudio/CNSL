# CNSL — Mobile-Readiness

Status: **Fundament gelegt + harte Blocker entsperrt** (2026-06-06). Das visuelle Feindesign für Mobil ist die nächste Phase — dieses Dokument ist die Referenz dafür.

Breakpoint: **≤ 768px = „mobile"** (eine Quelle der Wahrheit: `MOBILE_BP` in [lib/useIsMobile.ts](lib/useIsMobile.ts) + die `@media (max-width:768px)`-Blöcke in [app/globals.css](app/globals.css)).

## Konventionen (zum Drauf-Designen)
- **JS-Layoutschalter:** `useIsMobile()` aus `lib/useIsMobile.ts` (SSR-sicher). Nutzen für strukturelle Umschaltungen (Drawer, NotePad-Stack, Task-Karten). Für reines Styling lieber `@media` verwenden.
- **Touch-Ziele:** Token `--touch-min: 44px`; Utility-Klasse `.cnsl-touch` (min 44×44) für Icon-Buttons.
- **Sichtbarkeit:** `.cnsl-only-mobile` / `.cnsl-only-desktop` (über den 768px-Block gesteuert).
- **Safe-Area:** `.cnsl-header` (padding-top) + `.cnsl-footer` (margin-bottom) nutzen `env(safe-area-inset-*)`; `viewportFit:cover` ist in [app/layout.tsx](app/layout.tsx) gesetzt.
- **Drawer-Muster:** Sidebar wird auf Mobil zum Off-Canvas-Drawer — `.cnsl-sidebar[data-mobile-open="true"]` + `.cnsl-nav-backdrop`; Toggle = Hamburger im Header (`onToggleNav`).
- **Karten-Muster:** Auf Mobil rendern Backlog/Project [components/TaskCard.tsx](components/TaskCard.tsx) statt der Tabellen-Zeile; die Spalten-Kopfzeile (`TableHeader`) wird in diesen Views ausgeblendet.

## Was umgesetzt ist
- Sidebar → Drawer + Hamburger (mobil), Desktop-Rail unverändert.
- Edit-Modal/SidePanel: Felder/Pills ≥44px auf Mobil, Project/Epic stapeln, Close-Button als Touch-Ziel, Sheet = volle Breite.
- NotePad: einspaltig auf Mobil (Liste ODER Editor mit „←").
- Tracking-Log-Triage: Inputs/Button gestapelt + ≥44px; Toolbar bricht um.
- Backlog & Project: Task-Karten auf Mobil (Gerüst, bewusst schlicht).
- Tighter Header-Padding + kleinerer Logo-Step auf Mobil; Kanban-Scroll entschärft.

## Offen für die Design-Phase (bewusst dir überlassen)
- **Visuelles Feindesign der TaskCard** (Abstände, Typo, Farben, evtl. Swipe-Aktionen).
- Feinschliff Touch-Größen bei Sekundär-Toolbars (Backlog-Filter-Toggle, Archive-/Log-Toolbar-Buttons sind aktuell ~26–30px).
- Footer auf Mobil (83px hoch) ggf. kompakter/abdockbar.
- Evtl. **Bottom-Tab-Bar** statt/zusätzlich zum Drawer.
- Start-Page (`app/page.tsx`) ist grob responsiv, aber nicht pixelgenau.
- Tablet-Zwischenbreite (768–1024) hat noch keinen eigenen Breakpoint.

## Audit-Kurzfassung (Ausgangslage)
Viewport-Meta & Flex-Shell waren gesund; Hauptprobleme waren: 1366px-Canvas/feste px, nur ein 768px-Breakpoint, kein Mobile-Nav, Touch-Ziele <44px, NotePad 240px-Spalte, Modal/Sidebar full-width ohne Luft, Kanban-720px-Block, enge Log-Triage. Diese sind jetzt entweder gelöst oder oben als „offen" notiert.
