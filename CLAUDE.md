# Zenkai Kazekage Counter

Twitch-Overlay mit einem Zähler für den Streamer **Presarioo**. Er spielt Roleplay auf dem Server **Zenkai DE** als **Kazekage** und wird ständig von Spielern mit Fragen angesprochen. Seine **Moderatoren** zählen jede dieser Fragen per Klick hoch, und die **Viewer** sehen den aktuellen Stand live als Overlay im Stream.

## Status

Die Architektur ist entschieden (siehe unten). Ein detaillierter Umsetzungsplan steht noch aus.

## Architektur

```
 GitHub Pages (statisch)                  Supabase (https://jbajgnkroqwmcteggntz.supabase.co)
 ┌──────────────────────────┐            ┌──────────────────────────────────────────────┐
 │ overlay.html             │◄─Realtime──┤ Postgres: counter (session, total)           │
 │  OBS Browser-Source,     │            │           counter_event (Audit-Log)          │
 │  read-only, anon key     │            │ RLS: public SELECT, keine Writes für anon    │
 │                          │            │                                              │
 │ mod.html                 ├──HTTPS────►│ Edge Function: counter-action                │
 │  Twitch-Login (OAuth),   │◄─Realtime──┤  1. Twitch-Token validieren                  │
 │  +1 / −1 / setzen /      │            │  2. User = Broadcaster oder Mod?             │
 │  Session-Reset           │            │  3. Postgres-Funktion atomar ausführen       │
 └──────────────────────────┘            └──────────────────┬───────────────────────────┘
                                                            ▼
                                                     Twitch Helix API
```

- **Frontend:** Statische Seiten auf GitHub Pages, TypeScript ohne Framework. `overlay.html` ist rein lesend, hat einen transparenten Hintergrund und abonniert Änderungen über Supabase Realtime. `mod.html` meldet die Mods per Twitch-OAuth an und schickt jede Aktion an die Edge Function.
- **Backend:** Supabase.
  - Schreibzugriffe laufen **ausschließlich** über die Edge Function `counter-action`. Sie validiert das Twitch-Token, prüft, ob der User Broadcaster oder Mod des Channels ist, und ruft dann eine Postgres-Funktion auf, die die Änderung atomar durchführt und im Audit-Log festhält.
  - Der `anon`-Key darf nur lesen. Der Service-Role-Key existiert nur in der Edge Function.
- **Phase 2 (später):** Chat-Befehl `!frage` per Bot.

## Zählerlogik

- Es gibt zwei Werte: **Session** (aktueller Stream) und **Gesamt** (seit dem ersten Einsatz, Startwert 0).
- **+1:** Session +1 und Gesamt +1.
- **−1:** Session −1 und Gesamt −1, aber keiner der beiden Werte fällt unter 0. Das dient zur Korrektur von Fehlklicks.
- **Session setzen:** Die Session bekommt einen neuen Wert, und der Gesamtwert ändert sich um dieselbe Differenz.
- **Session-Reset:** Ein Mod startet manuell eine neue Session. Die Session wird auf 0 gesetzt, der Gesamtwert bleibt unverändert.
- **Der Gesamtwert wird nie zurückgesetzt.** Dafür gibt es bewusst keine Aktion.
- Alle Aktionen sind Broadcaster und Mods vorbehalten.

## Kernanforderungen

- **Hochzählen nur durch Berechtigte:** Nur der Broadcaster und seine Moderatoren dürfen den Zähler verändern (hochzählen, ggf. korrigieren oder zurücksetzen). Das wird **serverseitig** geprüft, eine Prüfung nur im Frontend reicht nicht.
- **Anzeige für alle:** Alle Viewer sehen den Zählerstand ohne Login und ohne eigenes Zutun.
- **Live:** Änderungen erscheinen nach wenigen Sekunden bei den Viewern, ohne dass jemand neu laden muss.
- **Persistenz:** Der Zählerstand übersteht Neustarts von Server, Browser-Source oder Stream.
- **Missbrauchsschutz:** Spam-Klicks (z. B. mehrere Mods gleichzeitig oder Doppelklicks) dürfen den Zähler nicht ungewollt aufblähen. Dafür braucht es Debounce, Rate-Limits und/oder Idempotenz.
- **Optik:** Das Overlay bleibt klein und unaufdringlich, passt thematisch zu „Kazekage“ und lässt das Spielbild frei.

## Sprache und Konventionen

- Mit dem User wird **auf Deutsch** kommuniziert.
- Code, Bezeichner, Commit-Messages und Code-Kommentare sind **auf Englisch**.
- Texte, die Viewer sehen (Overlay, Mod-UI), sind **auf Deutsch**.
- Commits folgen dem Conventional-Commits-Format (`feat:`, `fix:`, `chore:` …).
- Commits und Pushes nur, wenn der User es ausdrücklich verlangt.

## Befehle

_Noch keine vorhanden. Werden nach der Architektur-Entscheidung ergänzt (install, dev, test, build, deploy)._

## Weitere Regeln

Detaillierte Regeln liegen in `.claude/rules/`:

- `security.md`: Secrets, Twitch-Auth, Rechteprüfung
- `twitch.md`: Twitch-spezifische Vorgaben und Fallstricke
- `code-quality.md`: Tests, Struktur, Abhängigkeiten
- `design.md`: Optik und Urheberrecht
