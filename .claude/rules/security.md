# Security

- **Keine Secrets im Repo.** Twitch Client Secret, Extension Secret, OAuth-Tokens, API-Keys und DB-Credentials gehören nur in `.env` oder in die Secret-Verwaltung der Hosting-Plattform. Für jede neue Variable einen Platzhalter in `.env.example` anlegen.
- **Rechte serverseitig prüfen.** Jede schreibende Aktion am Zähler (increment, decrement, reset, set) muss im Backend nachweisen, dass Broadcaster- oder Moderatorrechte vorliegen. Daten aus dem Client (Rolle, User-ID, Channel-ID) gelten nie als vertrauenswürdig, solange sie nicht über ein signiertes Token verifiziert sind.
- **Tokens vollständig verifizieren.** Bei Twitch-Extension-JWTs Signatur, Ablaufzeit (`exp`), `channel_id` und `role` prüfen. Bei OAuth-Tokens über Twitchs Validate-Endpoint die Gültigkeit und den Mod-Status des Users verifizieren.
- **Nur die nötigen Scopes.** Nur die OAuth-Scopes anfordern, die tatsächlich gebraucht werden.
- **Lesen öffentlich, Schreiben authentifiziert.** Endpoints zum Lesen des Zählers dürfen öffentlich sein, Endpoints zum Schreiben nie.
- **Rate-Limiting** gilt für alle schreibenden Endpoints, pro User und pro Channel.
- **CORS** nur für die tatsächlich genutzten Origins freigeben, also kein `*` auf schreibenden Endpoints.
- **Logs ohne Secrets.** Tokens, Secrets und vollständige Auth-Header nie loggen.
- **Audit-Trail:** Jede Zähleränderung wird mit Zeitpunkt, User-ID oder Login, Aktion und neuem Wert protokolliert, damit Fehlklicks nachvollziehbar sind.
