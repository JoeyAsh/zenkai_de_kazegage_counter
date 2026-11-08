# Kazekage-Nerv-o-Meter

Twitch-Overlay für **Presarioo**, der auf dem Server **Zenkai DE** als **Kazekage** Roleplay spielt und ständig mit Fragen angesprochen wird. Seine Mods zählen jede Frage per Klick hoch, die Viewer sehen den Stand live im Stream.

- **Overlay** (`overlay.html`): nur lesend, transparenter Hintergrund, aktualisiert sich live.
- **Mod-Panel** (`mod.html`): Twitch-Login, +1 / −1 / Session setzen / Session-Reset.
- **Backend:** Supabase (Postgres + Edge Function `counter-action`). Geschrieben wird nur über die Edge Function, die prüft, ob der User Broadcaster oder Mod ist.

Live: https://joeyash.github.io/zenkai_de_kazegage_counter/

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
6. **Smoke-Test:** Overlay öffnen (zeigt 0/0), im Mod-Panel einloggen, +1 klicken, Overlay aktualisiert sich. Login mit einem Nicht-Mod-Account zeigt „Nur Mods …“.

## Lokale Entwicklung

Voraussetzung: Node 24. **Docker Desktop** wird für die lokale Supabase-Instanz und `npm run test:db` benötigt.

```
npm ci
cp .env.example .env     # Werte eintragen
npx supabase start       # lokale Supabase-Instanz
npm run dev              # http://localhost:5173/zenkai_de_kazegage_counter/overlay.html
```

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
