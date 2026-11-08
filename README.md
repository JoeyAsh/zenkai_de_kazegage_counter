# Kazekage-Nerv-o-Meter

Twitch-Overlay für **Presarioo**, der auf dem Server **Zenkai DE** als **Kazekage** Roleplay spielt und ständig mit Fragen angesprochen wird. Seine Mods zählen jede Frage per Klick hoch, die Viewer sehen den Stand live im Stream.

- **Overlay** (`overlay.html`): nur lesend, transparenter Hintergrund, aktualisiert sich live.
- **Mod-Panel** (`mod.html`): Twitch-Login, +1 / −1 / Session setzen / Session-Reset.
- **Backend:** Supabase (Postgres + Edge Function `counter-action`). Geschrieben wird nur über die Edge Function, die prüft, ob der User Broadcaster oder Mod ist.

Live: [Overlay](https://joeyash.github.io/zenkai_de_kazegage_counter/overlay.html) · [Mod-Panel](https://joeyash.github.io/zenkai_de_kazegage_counter/mod.html)

## OBS einrichten

1. Quelle hinzufügen: **Browser**.
2. URL: `https://joeyash.github.io/zenkai_de_kazegage_counter/overlay.html`
3. Breite **400**, Höhe **160**.
4. Eigenes CSS leer lassen (der Hintergrund ist bereits transparent).

## Für Mods

1. `https://joeyash.github.io/zenkai_de_kazegage_counter/mod.html` öffnen.
2. Mit Twitch anmelden. Nur Broadcaster und Mods des Channels dürfen zählen, alle anderen bekommen die Meldung „Nur Mods …“.
3. **+1** bei jeder Frage, **−1** zur Korrektur von Fehlklicks (kein Wert fällt unter 0), **Session setzen** für einen neuen Sessionwert, **Session-Reset** zu Beginn eines neuen Streams. Der Gesamtwert wird nie zurückgesetzt.

## Setup-Checkliste (einmalig)

1. **Twitch-App anlegen** (Twitch Developer Console): Client-Typ **Public**, OAuth-Redirect-URLs
   - `https://joeyash.github.io/zenkai_de_kazegage_counter/mod.html`
   - `http://localhost:5173/zenkai_de_kazegage_counter/mod.html`

   Die **Client-ID** notieren.
2. **Supabase verknüpfen und Datenbank migrieren:**
   ```
   npx supabase login
   npx supabase link --project-ref jbajgnkroqwmcteggntz
   npx supabase db push
   ```
3. **Edge-Function-Secrets setzen und deployen** (`SUPABASE_URL` und `SUPABASE_SECRET_KEYS` stellt die Plattform bereit):
   ```
   npx supabase secrets set TWITCH_CLIENT_ID=<client-id> TWITCH_CHANNEL_LOGIN=presarioo ALLOWED_ORIGINS=https://joeyash.github.io,http://localhost:5173
   npx supabase functions deploy counter-action
   ```
4. **GitHub:** Repo öffentlich stellen, Settings → Pages → Source **GitHub Actions**. Unter Settings → Secrets and variables → Actions → **Variables** (nicht Secrets, die Werte sind öffentlich) anlegen:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
   - `VITE_TWITCH_CLIENT_ID`
   - `VITE_TWITCH_CHANNEL` (`presarioo`)
5. **Deploy:** Push auf `main` (oder Workflow „Deploy to GitHub Pages“ manuell starten).
6. **Smoke-Test (Produktion):**
   - Overlay öffnen (zeigt 0/0), im Mod-Panel einloggen, +1 klicken: der Zähler steigt, das Overlay aktualisiert sich live.
   - Das +1 eines zweiten Mods innerhalb von 3 s zeigt „Schon gezählt von <login>“.
   - Ein Nicht-Mod-Account sieht die 403-Meldung „Nur Mods …“.
   - Ein ungültiges oder abgelaufenes Token führt zurück zur Login-Ansicht.
   - Im Supabase-Dashboard steht „Verify JWT“ für `counter-action` auf **aus**.
   - CORS prüfen (in PowerShell `curl.exe` verwenden, nicht `curl`):
     ```
     curl.exe -i -X OPTIONS https://jbajgnkroqwmcteggntz.supabase.co/functions/v1/counter-action -H "Origin: https://joeyash.github.io" -H "Access-Control-Request-Method: POST" -H "Access-Control-Request-Headers: authorization, content-type"
     ```
     Erwartet: `204` und genau ein Header `access-control-allow-origin: https://joeyash.github.io`.
     ```
     curl.exe -i -X OPTIONS https://jbajgnkroqwmcteggntz.supabase.co/functions/v1/counter-action -H "Origin: https://evil.example" -H "Access-Control-Request-Method: POST" -H "Access-Control-Request-Headers: authorization, content-type"
     ```
     Erwartet: kein `access-control-allow-origin`-Header, insbesondere kein `*`.
     ```
     curl.exe -i -X POST https://jbajgnkroqwmcteggntz.supabase.co/functions/v1/counter-action -H "Origin: https://joeyash.github.io"
     ```
     Erwartet: `401` mit JSON-Body (ActionResponse) und gesetztem `access-control-allow-origin`.

## Supabase-Projekt pausiert

Kostenlose Supabase-Projekte werden nach etwa 7 Tagen ohne Aktivität pausiert. Dann zeigt das Overlay 0/0, und Aktionen im Mod-Panel scheitern mit einem Verbindungsfehler. Die Daten bleiben erhalten. Abhilfe: Supabase-Dashboard öffnen, das Projekt wählen und **Restore** klicken. Regelmäßige Streams halten das Projekt wach.

## Lokale Entwicklung

Voraussetzung: Node 24. **Docker Desktop** wird für die lokale Supabase-Instanz und `npm run test:db` benötigt.

```
npm ci
cp .env.example .env     # Werte eintragen
npx supabase start       # lokale Supabase-Instanz
npm run dev              # http://localhost:5173/zenkai_de_kazegage_counter/overlay.html
```

Die Edge Function lokal: `supabase/.env.example` nach `supabase/.env.local` kopieren, `TWITCH_CLIENT_ID` eintragen und `npx supabase functions serve counter-action --env-file supabase/.env.local` starten. Hinweis: Das lokale `supabase functions serve` läuft über ein lokales Gateway, das selbst `Access-Control-Allow-Origin: *` ergänzt. CORS-Prüfungen lokal sind deshalb nicht aussagekräftig, dafür gelten die curl-Tests gegen die Produktion.

## Befehle

| Befehl | Zweck |
| --- | --- |
| `npm run dev` | Vite-Dev-Server |
| `npm test` | Unit-Tests (Vitest) |
| `npm run test:db` | Datenbank-Tests (pgTAP, braucht Docker) |
| `npm run typecheck` | TypeScript-Prüfung |
| `npm run build` | Typecheck und Produktions-Build nach `dist/` |
| `npx supabase db push` | Migrationen auf das Supabase-Projekt anwenden |
| `npx supabase functions deploy counter-action` | Edge Function deployen |
