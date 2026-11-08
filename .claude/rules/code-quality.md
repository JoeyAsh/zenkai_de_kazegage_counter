# Code-Qualität

- **Möglichst wenig Abhängigkeiten.** Bevor ein neues Paket dazukommt, prüfen, ob die Standardbibliothek oder eine bereits vorhandene Abhängigkeit reicht. Versionen festpinnen und das Lockfile committen.
- **Kernlogik testen.** Für Zählerlogik, Rechteprüfung und Token-Verifikation gibt es automatisierte Tests. Bei Bugfixes zuerst ein Test, der den Fehler reproduziert.
- **Klare Trennung:** Anzeige (Overlay), Steuerung (Mod-UI) und Backend (Zustand, Auth) sind getrennte Module mit klar definierter Schnittstelle.
- **Typisierung:** Bei JavaScript/TypeScript TypeScript im `strict`-Mode verwenden.
- **Konfiguration über Umgebungsvariablen**, nicht über hart codierte Werte.
- **Nichts als „fertig“ melden ohne Nachweis.** Vorher Tests, Build und Lint laufen lassen und die Ergebnisse nennen.
- **Lesbarkeit vor Cleverness.** Das Projekt ist klein und soll klein und wartbar bleiben, also keine Abstraktionen auf Vorrat.
