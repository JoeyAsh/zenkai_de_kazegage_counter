# Kazekage Counter MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mods von Twitch-Channel `presarioo` zählen per Web-Panel die Fragen an den Kazekage; ein OBS-Overlay zeigt Session- und Gesamtzähler live.

**Architecture:** Statische Seiten (`overlay.html`, `mod.html`) auf GitHub Pages lesen den Zähler über Supabase (publishable key, RLS read-only, Realtime). Schreibzugriffe gehen ausschließlich an die Edge Function `counter-action`, die das Twitch-Token validiert, Broadcaster/Mod-Status prüft und die Postgres-Funktion `apply_counter_action` (atomar, idempotent, rate-limitiert, Audit-Log) aufruft.

**Tech Stack:** TypeScript (strict), React + MUI (`@mui/material`, `@emotion/react`, `@emotion/styled`), Vite (Multi-Page-Build, `@vitejs/plugin-react`), Vitest + `@testing-library/react` + `jsdom`, `@supabase/supabase-js` v2, Supabase CLI (npm-Paket `supabase`, als devDependency), Postgres + pgTAP, Supabase Edge Functions (Deno), GitHub Actions.

**Spec:** `CLAUDE.md` (Abschnitte „Kernanforderungen“, „Architektur“, „Zählerlogik“) und `.claude/rules/*.md`.

## Global Constraints

- Channel: Login `presarioo` – nie hart im Code, immer über Konfiguration (`VITE_TWITCH_CHANNEL` bzw. Secret `TWITCH_CHANNEL_LOGIN`).
- Supabase-Projekt: `https://jbajgnkroqwmcteggntz.supabase.co`. Neue Keys: `sb_publishable_…` im Frontend, `sb_secret_…` nur in der Edge Function.
- Edge Function `counter-action` mit `verify_jwt = false` in `supabase/config.toml` (Auth macht die Funktion selbst über Twitch).
- Twitch-Login: Implicit Grant Flow, einziger Scope `user:read:moderated_channels`.
- GitHub-Pages-URL: `https://joeyash.github.io/zenkai_de_kazegage_counter/`; Vite `base: "/zenkai_de_kazegage_counter/"`.
- Erlaubte CORS-Origins: `https://joeyash.github.io`, `http://localhost:5173`.
- Code/Commits Englisch, sichtbare Texte Deutsch. Conventional Commits.
- Abhängigkeiten exakt pinnen (`npm install -E`), Lockfile committen.
- Keine Naruto-/Zenkai-Assets (siehe `.claude/rules/design.md`); Schriften nur mit OFL, vermerkt in `THIRD_PARTY.md`.
- Arbeit auf Branch `feat/counter-mvp`; Merge nach `main` erst nach Review.

## Zählerregeln (verbindlich, Quelle: CLAUDE.md + Entscheidungen)

| Aktion | Session | Gesamt | Ablehnung |
|---|---|---|---|
| `increment` | +1 | +1 | `cooldown`, wenn im Channel in den letzten **3 s** schon ein `increment` lief |
| `decrement` | −1 | −1 | `bad_request`, wenn Session = 0 |
| `set_session` (value) | = value | += (value − session) | `bad_request`, wenn value keine Ganzzahl in `0..1000000` |
| `reset_session` | = 0 | unverändert | – |

Für alle Aktionen: max. **10 Aktionen pro Actor in 10 s** → `rate_limited`. Gleiche `requestId` erneut → kein zweites Anwenden, aktueller Stand wird zurückgegeben. Zählerzeile entsteht beim ersten Einsatz mit 0/0. Invariante: `0 <= session <= total`.

## Review Focus

1. **Twitch-Token läuft während des Streams ab** → Mod-Panel bekommt `unauthorized`, verwirft das Token und zeigt „Bitte erneut anmelden“, statt stumm zu scheitern. (Test in Task 7: `sendAction` mappt HTTP 401.)
2. **Overlay verliert die Realtime-Verbindung** (OBS läuft stundenlang, Netz-Blip) → zeigt weiter den letzten Wert und lädt den Stand nach jedem (Re-)Subscribe neu. (Test in Task 5: Refetch bei Status `SUBSCRIBED`.)
3. **Zwei Mods klicken für dieselbe Frage** → zweiter Klick bekommt `cooldown` und sieht „Schon gezählt von <login>“. (pgTAP in Task 2, Mapping in Task 7.)
4. **Netzwerk-Retry schickt dieselbe Anfrage doppelt** → `requestId` macht sie idempotent. (pgTAP in Task 2, Retry-Test in Task 7.)
5. **User ist Mod in anderen Channels, aber nicht bei presarioo / Liste > 100 Channels** → `forbidden` bzw. korrektes Paginieren. (Tests in Task 3.)

---

### Task 1: Projektgerüst und gemeinsames Protokoll

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`, `.env.example`, `.github/workflows/ci.yml`
- Create: `supabase/functions/_shared/protocol.ts`
- Test: `tests/protocol.test.ts`

**Interfaces:**
- Produces (`supabase/functions/_shared/protocol.ts`, nur Web-Standard-TS, keine Imports):
  ```ts
  export type CounterAction =
    | { type: "increment" } | { type: "decrement" }
    | { type: "set_session"; value: number } | { type: "reset_session" };
  export interface ActionRequest { requestId: string; action: CounterAction }
  export interface CounterState {
    channelId: string; channelLogin: string; session: number; total: number;
    lastAction: CounterAction["type"] | null; lastActorLogin: string | null; updatedAt: string;
  }
  export type ActionError = "unauthorized" | "forbidden" | "bad_request" | "rate_limited" | "cooldown" | "internal";
  export type ActionResponse = { ok: true; state: CounterState } | { ok: false; error: ActionError; message: string };
  export const MAX_SESSION_VALUE = 1_000_000;
  export function parseActionRequest(body: unknown): ActionRequest | null;
  export function counterRowToState(row: CounterRow): CounterState;
  export interface CounterRow { channel_id: string; channel_login: string; session_count: number; total_count: number; last_action: string | null; last_actor_login: string | null; updated_at: string }
  ```

- [ ] **Step 1: Branch und Tooling anlegen**
  `git switch -c feat/counter-mvp`. `npm init -y`, dann `npm install -E -D typescript vite @vitejs/plugin-react vitest jsdom @testing-library/react @testing-library/dom @types/react @types/react-dom supabase` und `npm install -E react react-dom @mui/material @emotion/react @emotion/styled @supabase/supabase-js`. Scripts: `dev` (`vite`), `build` (`tsc --noEmit && vite build`), `typecheck` (`tsc --noEmit`), `test` (`vitest run`), `test:db` (`supabase test db`). `tsconfig.json`: `strict: true`, `noUncheckedIndexedAccess: true`, `jsx: "react-jsx"`, `module/moduleResolution: "ESNext"/"Bundler"`, `allowImportingTsExtensions: true`, `noEmit: true`, `lib: ["ES2022","DOM","DOM.Iterable"]`, `exclude: ["supabase/functions/*/index.ts", "dist"]` (Deno-Entrypoints nutzen `Deno.*` und `npm:`-Imports). `vite.config.ts`: `plugins: [react()]`, `root: "web"`, `base` wie oben, `build.outDir: "../dist"`, `rollupOptions.input` = `web/overlay.html`, `web/mod.html`, `envDir: ".."`. `vitest.config.ts`: `environment: "node"` als Default; Komponententests setzen per Datei-Kommentar `// @vitest-environment jsdom`. `.env.example` mit `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_TWITCH_CLIENT_ID`, `VITE_TWITCH_CHANNEL=presarioo`.

- [ ] **Step 2: Failing tests schreiben** (`tests/protocol.test.ts`)
  - `parseActionRequest` akzeptiert `{requestId: <uuid v4>, action:{type:"increment"}}` und gibt es unverändert zurück.
  - akzeptiert `set_session` mit `value: 0` und `value: 1000000`.
  - gibt `null` für: fehlende/ungültige `requestId` (`"abc"`), unbekannten `type` (`"reset_total"`), `set_session` mit `value` `-1`, `1000001`, `1.5`, `"5"`, fehlend; `null`; Array; String-Body.
  - `counterRowToState` mappt alle Felder (`session_count`→`session` usw.) und wandelt `total_count` per `Number()` (bigint kommt ggf. als String).

- [ ] **Step 3: Tests laufen lassen** – `npm test` → FAIL (Modul fehlt).
- [ ] **Step 4: `protocol.ts` implementieren** – UUID-Check per Regex `^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$` (case-insensitive); `reset_total` o. Ä. darf es nie geben.
- [ ] **Step 5: Tests + Typecheck** – `npm test && npm run typecheck` → PASS.
- [ ] **Step 6: CI** – `.github/workflows/ci.yml` auf `push`/`pull_request`: Node 24, `npm ci`, `npm run typecheck`, `npm test`. (DB-Tests kommen in Task 2 dazu.)
- [ ] **Step 7: Commit** – `chore: scaffold project and add shared action protocol`

---

### Task 2: Datenbank – Schema, RLS, Realtime, `apply_counter_action`

**Files:**
- Create: `supabase/config.toml` (via `npx supabase init`, dann anpassen), `supabase/migrations/20261108000000_counter.sql`
- Test: `supabase/tests/database/counter.test.sql`
- Modify: `.github/workflows/ci.yml` (Job `db`)

**Interfaces:**
- Produces: Tabellen `public.counter` (Spalten exakt wie `CounterRow` aus Task 1, `channel_id text primary key`, Checks `session_count >= 0`, `total_count >= session_count`, `last_action` mit Check auf die vier Aktionsnamen) und `public.counter_event` (`id` identity, `request_id uuid unique not null`, `channel_id` FK, `actor_id`, `actor_login`, `action`, `value integer null`, `session_after`, `total_after`, `created_at timestamptz default now()`, Index auf `(actor_id, created_at)` und `(channel_id, action, created_at)`).
- Produces: `public.apply_counter_action(p_request_id uuid, p_channel_id text, p_channel_login text, p_actor_id text, p_actor_login text, p_action text, p_value integer default null) returns public.counter`. Fehler über `raise exception … using errcode =`: `'ZK400'` (bad_request), `'ZK409'` (cooldown, `detail` = Login des letzten Inkrementierers), `'ZK429'` (rate_limited).
- RLS: beide Tabellen RLS an; `counter`: `select` für `anon, authenticated` mit `using (true)`; keine Write-Policies; `counter_event`: keine Policies. `execute` auf die Funktion: `revoke` von `public, anon, authenticated`, `grant` an `service_role`. `alter publication supabase_realtime add table public.counter;`

- [ ] **Step 1: `npx supabase init`**; in `config.toml` ergänzen: `[functions.counter-action]` mit `verify_jwt = false`.
- [ ] **Step 2: Failing pgTAP-Tests schreiben** (`begin; select plan(N); … select * from finish(); rollback;`). Helfer: `perform`-Aufrufe mit fixen UUIDs, Channel `'1'`/`'presarioo'`, Actors `'a'`/`'b'`.
  - erste Aktion legt Zeile an: nach `increment` → session 1, total 1, `last_action='increment'`, `last_actor_login='a'`.
  - `increment` zweimal direkt hintereinander (anderer Actor) → zweiter wirft `ZK409`, `throws_ok(…, 'ZK409')`.
  - nach Backdating des Events um 4 s (`update counter_event set created_at = now() - interval '4 seconds'`) → `increment` erlaubt, session 2.
  - gleiche `request_id` zweimal → Zustand unverändert, nur 1 Event mit dieser ID.
  - `decrement` bei session 0 → `ZK400`; bei session 2/total 2 → 1/1.
  - `set_session` 5 bei session 1/total 3 → 5/7; `set_session` −1 und 1000001 und `null` → `ZK400`.
  - `reset_session` bei 5/7 → 0/7.
  - Rate-Limit: 10 Events des Actors in den letzten 10 s (per Insert vorbereitet) → 11. Aktion `ZK429`.
  - jede erfolgreiche Aktion schreibt genau ein `counter_event` mit korrektem `session_after/total_after`.
  - RLS: `set local role anon;` → `select` auf `counter` funktioniert, `update counter …` betrifft 0 Zeilen bzw. wirft, `select` auf `counter_event` liefert 0 Zeilen, Aufruf von `apply_counter_action` wirft `42501`.
- [ ] **Step 3: Docker Desktop starten, `npx supabase start`, `npm run test:db`** → FAIL.
- [ ] **Step 4: Migration schreiben.** Ablauf in der Funktion (in dieser Reihenfolge, alles in einer Transaktion):
  1. Idempotenz: existiert `request_id` → aktuelle `counter`-Zeile zurückgeben.
  2. `insert … on conflict do nothing`, dann `select … for update` (serialisiert gleichzeitige Mods).
  3. Rate-Limit-Check, dann Aktions-Validierung, dann Cooldown (nur `increment`).
  4. Update + `counter_event` insert, Zeile zurückgeben.
  `security invoker`, `set search_path = ''`, voll qualifizierte Namen.
- [ ] **Step 5: `npm run test:db`** → PASS.
- [ ] **Step 6: CI-Job `db`** – `npx supabase db start` und `npx supabase test db`.
- [ ] **Step 7: Commit** – `feat(db): add counter schema with atomic apply_counter_action`

---

### Task 3: Twitch-Client (Token, Channel-ID, Mod-Check)

**Files:**
- Create: `supabase/functions/_shared/twitch.ts`
- Test: `tests/twitch.test.ts`

**Interfaces:**
- Produces (Web-Standard, `fetch` injiziert):
  ```ts
  export type FetchFn = typeof fetch;
  export interface TwitchIdentity { userId: string; login: string; clientId: string; scopes: string[] }
  export function validateToken(token: string, fetchFn: FetchFn): Promise<TwitchIdentity | null>;
  export function resolveUserId(login: string, token: string, clientId: string, fetchFn: FetchFn): Promise<string | null>;
  export function isModeratorOf(broadcasterId: string, identity: TwitchIdentity, token: string, fetchFn: FetchFn): Promise<boolean>;
  ```
- Endpoints: `GET https://id.twitch.tv/oauth2/validate` (Header `Authorization: OAuth <token>`); `GET https://api.twitch.tv/helix/users?login=…`; `GET https://api.twitch.tv/helix/moderation/channels?user_id=<identity.userId>&first=100[&after=…]` (Header `Authorization: Bearer <token>`, `Client-Id`).

- [ ] **Step 1: Failing tests** (Fake-`fetch`, der URL + Header prüft und JSON zurückgibt):
  - `validateToken`: 200 mit `{client_id, login, user_id, scopes, expires_in}` → Identity; 401 → `null`; Netzwerkfehler → wirft (wird in Task 4 zu `internal`).
  - `resolveUserId`: liefert `data[0].id`; leeres `data` → `null`.
  - `isModeratorOf`: `identity.userId === broadcasterId` → `true` ohne Helix-Call; Treffer auf Seite 2 (Seite 1 hat `pagination.cursor`) → `true`; Mod nur in anderen Channels → `false`; Helix 401 → `false`.
- [ ] **Step 2: `npm test -- twitch`** → FAIL.
- [ ] **Step 3: Implementieren.** Paginierung bis kein Cursor mehr, max. 20 Seiten.
- [ ] **Step 4: `npm test -- twitch`** → PASS.
- [ ] **Step 5: Commit** – `feat(function): add twitch token validation and moderator check`

---

### Task 4: Edge Function `counter-action`

**Files:**
- Create: `supabase/functions/counter-action/handler.ts`, `supabase/functions/counter-action/index.ts`
- Test: `tests/handler.test.ts`

**Interfaces:**
- Consumes: `parseActionRequest`, `counterRowToState`, `ActionResponse` (Task 1); `validateToken`, `resolveUserId`, `isModeratorOf` (Task 3); SQL-Funktion + Fehlercodes (Task 2).
- Produces:
  ```ts
  export interface ApplyArgs { requestId: string; channelId: string; channelLogin: string; actorId: string; actorLogin: string; action: CounterAction }
  export type ApplyResult = { row: CounterRow } | { errorCode: string; detail?: string };
  export interface HandlerDeps { clientId: string; channelLogin: string; allowedOrigins: string[]; fetchFn: FetchFn; apply(args: ApplyArgs): Promise<ApplyResult> }
  export function createHandler(deps: HandlerDeps): (req: Request) => Promise<Response>;
  ```
- HTTP-Mapping: `unauthorized` 401, `forbidden` 403, `bad_request` 400, `cooldown` 409, `rate_limited` 429, `internal` 500. Body immer `ActionResponse`. Deutsche `message`-Texte; bei `cooldown`: `"Schon gezählt von <detail>"`.
- `index.ts` (Deno, nicht typgeprüft durch `tsc`): liest `TWITCH_CLIENT_ID`, `TWITCH_CHANNEL_LOGIN`, `ALLOWED_ORIGINS` (kommagetrennt), `SUPABASE_URL`, Secret-Key aus `SUPABASE_SECRET_KEYS` (JSON, Key `default`); `createClient` aus `npm:@supabase/supabase-js@2`; `apply` = `rpc("apply_counter_action", …)` mit Mapping `error.code`/`error.details`; `Deno.serve(createHandler(...))`.

- [ ] **Step 1: Failing tests** (Fake-`fetchFn` für Twitch, Fake-`apply`):
  - `OPTIONS` von erlaubter Origin → 204 mit `Access-Control-Allow-Origin` = Origin, `Allow-Headers: authorization, content-type`; von fremder Origin → kein ACAO-Header.
  - `GET` → 405.
  - kein/kaputter `Authorization: Bearer`-Header → 401; Token mit fremder `client_id` → 401.
  - kein Mod → 403, `apply` nicht aufgerufen.
  - ungültiger Body → 400, `apply` nicht aufgerufen.
  - Mod + gültig → 200, `apply` mit `channelId` (aufgelöst aus `presarioo`), `actorId/actorLogin` aus dem Token – nie aus dem Body.
  - `apply` liefert `ZK409` mit detail `"modb"` → 409, `message` enthält `modb`; `ZK429` → 429; `ZK400` → 400; unbekannter Code → 500 ohne interne Details.
  - Channel-ID wird pro Handler-Instanz gecacht (zweiter Request ruft `helix/users` nicht erneut auf).
  - Logs (per injiziertem oder gespyten `console`) enthalten nie das Token.
- [ ] **Step 2: `npm test -- handler`** → FAIL.
- [ ] **Step 3: `handler.ts` + `index.ts` implementieren.**
- [ ] **Step 4: `npm test && npm run typecheck`** → PASS.
- [ ] **Step 5: Lokal smoke-testen** – `npx supabase functions serve counter-action --env-file supabase/.env.local` (Datei gitignored, Werte aus `.env.example`-Schema) und `curl -X OPTIONS` mit `Origin: http://localhost:5173` → 204.
- [ ] **Step 6: Commit** – `feat(function): add counter-action edge function`

---

### Task 5: Frontend-Basis – Konfiguration, Zähler-Client, Hook, Theme

**Files:**
- Create: `web/src/config.ts`, `web/src/counter-client.ts`, `web/src/useCounter.ts`, `web/src/theme.ts`
- Test: `tests/counter-client.test.ts`, `tests/use-counter.test.tsx`

**Interfaces:**
- Consumes: `CounterState`, `CounterRow`, `counterRowToState` (Task 1).
- Produces:
  ```ts
  // config.ts
  export const config: { supabaseUrl: string; supabasePublishableKey: string; twitchClientId: string; channelLogin: string; functionUrl: string };
  // counter-client.ts – minimaler Ausschnitt des Supabase-Clients als Interface, damit Tests einen Fake nutzen können
  export interface CounterSource { fetchByLogin(login: string): Promise<CounterRow | null>; onRowChange(login: string, cb: (row: CounterRow) => void, onStatus: (s: string) => void): () => void }
  export function createSupabaseSource(url: string, key: string): CounterSource;
  export function watchCounter(source: CounterSource, login: string, onState: (s: CounterState | null) => void): () => void;
  // useCounter.ts
  export function useCounter(source: CounterSource, login: string): { state: CounterState | null; loaded: boolean };
  // theme.ts – MUI-Theme (Palette Sand/Ocker/Terrakotta, Tinte/Indigo, Akzent Windtürkis; Typografie mit OFL-Schrift)
  export const kazekageTheme: Theme;
  ```
- `functionUrl` = `${supabaseUrl}/functions/v1/counter-action`. `config.ts` wirft beim Laden mit klarer Meldung, wenn eine `VITE_*`-Variable fehlt.

- [ ] **Step 1: Failing tests** für `watchCounter` mit Fake-`CounterSource`:
  - initial wird `fetchByLogin` aufgerufen und `onState` mit dem gemappten Zustand.
  - noch keine Zeile → `onState(null)` (Overlay zeigt 0/0).
  - Row-Change-Event → `onState` mit neuem Zustand.
  - Status `SUBSCRIBED` (auch ein zweites Mal nach Reconnect) → erneutes `fetchByLogin`.
  - `fetchByLogin` wirft → `onState` wird **nicht** mit `null` aufgerufen (letzter Wert bleibt), erneuter Versuch nach dem nächsten `SUBSCRIBED`.
  - zurückgegebene Unsubscribe-Funktion beendet das Abo.
  - `useCounter` (jsdom, `renderHook`): `loaded` erst nach erstem `onState` true; Unmount ruft Unsubscribe auf.
- [ ] **Step 2: `npm test -- counter-client use-counter`** → FAIL.
- [ ] **Step 3: Implementieren.** `theme.ts` anlegen (Farben siehe `.claude/rules/design.md`; die finale Feinabstimmung erfolgt in Task 6). `createSupabaseSource`: `from("counter").select("*").eq("channel_login", login).maybeSingle()` und `channel(...).on("postgres_changes", { event: "*", schema: "public", table: "counter", filter: \`channel_login=eq.${login}\` }, …).subscribe(onStatus)`.
- [ ] **Step 4: `npm test && npm run typecheck`** → PASS.
- [ ] **Step 5: Commit** – `feat(web): add config and realtime counter client`

---

### Task 6: Overlay (`overlay.html`)

**Files:**
- Create: `web/overlay.html`, `web/src/overlay/main.tsx`, `web/src/overlay/Overlay.tsx`, `web/src/overlay/format.ts`, ggf. `web/src/overlay/assets/*.svg`, `THIRD_PARTY.md`
- Modify: `web/src/theme.ts`
- Test: `tests/overlay-format.test.ts`, `tests/overlay.test.tsx`

**Interfaces:**
- Consumes: `config`, `createSupabaseSource`, `useCounter`, `kazekageTheme` (Task 5).
- Produces: `<Overlay state={CounterState | null} />` (präsentational, ohne Datenzugriff; `main.tsx` verdrahtet `useCounter`).
- Produces: `formatCount(n: number): string` (de-DE, Tausenderpunkt), `diffKind(prev: CounterState | null, next: CounterState): "up" | "down" | "reset" | "none"`.

- [ ] **Step 1: Skill `frontend-design:frontend-design` laden** und Design gemäß `.claude/rules/design.md` festlegen (Sand/Wind, Tinte/Indigo, Windtürkis-Akzent; eigenes SVG, Kanji 風 erlaubt).
- [ ] **Step 2: Failing tests** – `formatCount(0) === "0"`, `formatCount(1234) === "1.234"`; `diffKind`: null→state `"none"`, session 3→4 `"up"`, 4→3 `"down"`, 7→0 bei gleichem total `"reset"`.
  `Overlay` (jsdom): mit `state = null` zeigt es „0“ für beide Werte; mit session 12/total 1234 zeigt es „12“ und „1.234“ sowie die Texte „Fragen an den Kazekage“, „Dieser Stream“, „Insgesamt“.
- [ ] **Step 3: `npm test -- overlay`** → FAIL; dann `format.ts` und `Overlay.tsx` implementieren → PASS.
- [ ] **Step 4: Overlay bauen** mit MUI (`ThemeProvider` + `kazekageTheme`, `CssBaseline` so konfiguriert, dass `body` transparent bleibt). Feste Texte: Titel „Fragen an den Kazekage“, Zeilen „Dieser Stream“ und „Insgesamt“. Hintergrund transparent, Zielgröße ca. 400×160 px, lesbar auf hellem und dunklem Spielbild (Kontur/Schatten). Animation nur bei `up`/`down`/`reset`, deaktiviert bei `prefers-reduced-motion`. Kein Login, keine Interaktion.
- [ ] **Step 5: Sichtprüfung** – `npm run dev`, `http://localhost:5173/zenkai_de_kazegage_counter/overlay.html` mit Playwright auf hellem und dunklem Hintergrund screenshotten; Wert in der lokalen DB per SQL ändern → Overlay aktualisiert sich ohne Reload.
- [ ] **Step 6: Commit** – `feat(web): add kazekage counter overlay`

---

### Task 7: Mod-Panel (`mod.html`)

**Files:**
- Create: `web/mod.html`, `web/src/mod/main.tsx`, `web/src/mod/ModApp.tsx`, `web/src/mod/LoginView.tsx`, `web/src/mod/ControlPanel.tsx`, `web/src/mod/auth.ts`, `web/src/mod/api.ts`, `web/src/mod/messages.ts`
- Test: `tests/mod-auth.test.ts`, `tests/mod-api.test.ts`, `tests/control-panel.test.tsx`

**Interfaces:**
- Consumes: `config`, `useCounter`, `createSupabaseSource`, `kazekageTheme` (Task 5); `ActionRequest`, `ActionResponse`, `CounterAction` (Task 1); HTTP-Mapping (Task 4).
- Produces:
  ```ts
  // auth.ts
  export function buildAuthorizeUrl(clientId: string, redirectUri: string, state: string): string;
  export function parseAuthCallback(hash: string, expectedState: string | null): { token: string } | { error: string } | null;
  // api.ts
  export function sendAction(token: string, action: CounterAction, opts: { functionUrl: string; fetchFn?: typeof fetch; requestId?: string }): Promise<ActionResponse>;
  // messages.ts
  export function errorMessage(res: Extract<ActionResponse, { ok: false }>): string;
  // ControlPanel.tsx – präsentational
  export function ControlPanel(props: { state: CounterState | null; busy: boolean; feedback: string | null; onAction(a: CounterAction): void; onLogout(): void }): JSX.Element;
  ```

- [ ] **Step 1: Failing tests**
  - `buildAuthorizeUrl` → `https://id.twitch.tv/oauth2/authorize` mit `response_type=token`, `client_id`, `redirect_uri`, `scope=user:read:moderated_channels`, `state`.
  - `parseAuthCallback`: `#access_token=x&state=s` mit `expectedState "s"` → `{token:"x"}`; falscher State → `{error}`; `#error=access_denied` → `{error}`; leerer Hash → `null`.
  - `sendAction`: sendet `POST` mit `Authorization: Bearer <token>` und Body `{requestId, action}`; 200 → Response-Body; 401/403/409/429 → `{ok:false, error}` aus Body; Netzwerkfehler → genau **ein** Retry mit **derselben** `requestId`, danach `{ok:false, error:"internal"}`.
  - `errorMessage`: `unauthorized` → „Sitzung abgelaufen – bitte erneut anmelden“; `forbidden` → „Nur Mods von presarioo dürfen zählen“ (Channel-Name aus `config`, nicht hart codiert); `cooldown` → Server-`message`.
  - `ControlPanel` (jsdom): Klick auf „+1 Frage“ ruft `onAction({type:"increment"})`; bei `busy` sind alle Aktions-Buttons `disabled`; „Neue Session starten“ öffnet einen MUI-`Dialog` und ruft `onAction({type:"reset_session"})` erst nach „Bestätigen“; „Session setzen“ mit Eingabe `-1` oder leer ist deaktiviert, mit `7` ruft es `onAction({type:"set_session", value:7})`; `feedback` wird angezeigt.
- [ ] **Step 2: `npm test -- mod control-panel`** → FAIL.
- [ ] **Step 3: Implementieren** mit MUI-Komponenten (`Button`, `TextField`, `Dialog`, `Snackbar`/`Alert`) und `kazekageTheme`. Token + State in `sessionStorage` (alle Zugriffe in try/catch). `ModApp` hält Auth-Zustand und ruft `sendAction`. UI: Login-Button „Mit Twitch anmelden“; danach Live-Stand (über `useCounter`), Buttons „+1 Frage“ (groß), „−1 Korrektur“, Zahlenfeld + „Session setzen“, „Neue Session starten“ (mit Bestätigungsdialog), Abmelden. Während eines Requests sind alle Buttons deaktiviert. Statuszeile zeigt `lastAction` + `lastActorLogin`. Bei `unauthorized` Token löschen und Login-Ansicht zeigen.
- [ ] **Step 4: `npm test && npm run typecheck && npm run build`** → PASS.
- [ ] **Step 5: E2E lokal** – Twitch-App hat Redirect `http://localhost:5173/zenkai_de_kazegage_counter/mod.html`; Login, +1 klicken, Overlay in zweitem Tab zählt mit; Doppelklick → „Schon gezählt von …“.
- [ ] **Step 6: Commit** – `feat(web): add moderator control panel`

---

### Task 8: Deployment und Doku

**Files:**
- Create: `.github/workflows/pages.yml`, `README.md`
- Modify: `CLAUDE.md` (Abschnitte „Status“ und „Befehle“)

- [ ] **Step 1: `pages.yml`** – Trigger `push` auf `main` + `workflow_dispatch`; `npm ci`, `npm run build` mit `VITE_*` aus GitHub-Repo-**Variables** (nicht Secrets, sie sind öffentlich); `actions/upload-pages-artifact` (`dist`) + `actions/deploy-pages`.
- [ ] **Step 2: `README.md`** (Deutsch): Was es ist; OBS-Einrichtung (Browser-Source-URL, Größe 400×160); Mod-Anleitung; Setup-Checkliste aus Step 4; Befehle.
- [ ] **Step 3: `CLAUDE.md`** – Status auf „MVP umgesetzt“, Befehle `npm run dev|test|test:db|typecheck|build`, `npx supabase db push`, `npx supabase functions deploy counter-action`.
- [ ] **Step 4: Manuelle Einrichtung mit dem User** (Claude führt durch, User klickt):
  1. Twitch Developer Console: App anlegen, Client-Typ **Public**, OAuth-Redirect-URLs `https://joeyash.github.io/zenkai_de_kazegage_counter/mod.html` und `http://localhost:5173/zenkai_de_kazegage_counter/mod.html` → Client-ID notieren.
  2. `! npx supabase login`, `npx supabase link --project-ref jbajgnkroqwmcteggntz`, `npx supabase db push`.
  3. `npx supabase secrets set TWITCH_CLIENT_ID=… TWITCH_CHANNEL_LOGIN=presarioo ALLOWED_ORIGINS=https://joeyash.github.io,http://localhost:5173`, dann `npx supabase functions deploy counter-action`.
  4. Repo öffentlich, Settings → Pages → Source „GitHub Actions“; Repo-Variables `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_TWITCH_CLIENT_ID`, `VITE_TWITCH_CHANNEL`.
- [ ] **Step 5: Produktiv-Smoke-Test** – Overlay-URL öffnen (zeigt 0/0), Mod-Login, +1, Overlay aktualisiert sich; Login mit Nicht-Mod-Account → „Nur Mods …“.
- [ ] **Step 6: Commit + PR** – `docs: add deployment workflow and setup guide`; PR `feat/counter-mvp` → `main`.
