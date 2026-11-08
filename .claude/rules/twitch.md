# Twitch

- **Aktuelle Doku zuerst.** Vor dem Einsatz einer Twitch-API die aktuelle offizielle Doku prüfen (dev.twitch.tv/docs), z. B. über context7 oder eine Websuche. Twitch hat in den letzten Jahren APIs abgekündigt und ersetzt, etwa die alte PubSub-API durch EventSub. Für neue Integrationen keine abgekündigten APIs verwenden.
- **Rate-Limits der Twitch-APIs** stehen in der Doku und sind im Design zu berücksichtigen, z. B. für Extension-PubSub-Broadcasts pro Channel. Updates bei Bedarf bündeln oder drosseln.
- **Falls eine Twitch Extension gebaut wird:**
  - Das Frontend läuft in Twitchs Sandbox. Daraus folgt: kein Inline-Script, keine externen Skripte außer dem Twitch Extension Helper, und alle Assets werden mit der Extension ausgeliefert.
  - Rolle und Identität kommen ausschließlich aus dem von Twitch signierten JWT (`onAuthorized`).
  - Eine Extension im Status „Hosted Test“ ist nur für freigeschaltete Test-Accounts sichtbar. Damit alle Viewer sie sehen, muss die Extension den Review von Twitch durchlaufen und freigegeben werden. Das bei der Zeitplanung berücksichtigen.
  - Die Review-Richtlinien von Twitch (Extension Guidelines) einhalten.
- **Falls ein OBS-Browser-Source-Overlay gebaut wird:** Es läuft ohne Interaktion, hat einen transparenten Hintergrund, verbindet sich bei Verbindungsabbruch automatisch neu und bleibt auch ohne Netz stabil, indem es den letzten bekannten Wert anzeigt.
- **Bezeichner:** Streamer- und Channel-Namen nicht hart im Code verdrahten, sondern konfigurierbar machen, z. B. über die Channel-ID aus Konfiguration oder Token.
