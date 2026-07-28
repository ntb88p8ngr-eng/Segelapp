# Segelgemeinschaft Ammersee — Wind & Wetter

Next.js-Website für eine Segelgemeinschaft am Ammersee: aktuelle Winddaten
des Deutschen Wetterdienstes (DWD), eine 7-Tage-Vorhersage mit automatischer
Empfehlung für den besten Segeltag, eine interaktive Karte der Segelreviere
und ein Vereinskalender mit Schreibzugriff auf einen iCloud-Kalender.

## Features

- **Live-Winddaten vom DWD** über die offene, kostenlose [Bright Sky
  API](https://brightsky.dev) (kein API-Key nötig) — Windgeschwindigkeit,
  Windrichtung, **Windböen**, Temperatur, Niederschlag.
- **Segeltag-Empfehlung**: Für die nächsten 6 Tage wird ein Score aus
  mittlerer Windstärke, Böigkeit und Niederschlag berechnet (Sweet Spot ca.
  6–15 kn), der beste Tag wird hervorgehoben.
- **Interaktive Karte** (Leaflet/OpenStreetMap) mit den Standorten der
  Segelvereine rund um den Ammersee und der aktuellen Windrichtung.
- **Vereinskalender** mit Lese- und Schreibzugriff auf einen iCloud-Kalender
  via CalDAV (serverseitig, keine Zugangsdaten im Browser).

## Setup

```bash
npm install
npm run dev
```

Die Seite läuft dann unter [http://localhost:3000](http://localhost:3000).
Wetterdaten und Karte funktionieren sofort ohne weitere Konfiguration.

## iCloud-Kalender verbinden (Schreibzugriff)

Der Kalender-Bereich zeigt ohne Konfiguration einen Hinweis "noch nicht
verbunden" an. Um ihn zu aktivieren:

1. Ein **App-spezifisches Passwort** für die Apple-ID erstellen unter
   [appleid.apple.com](https://appleid.apple.com) → *Anmelden & Sicherheit*
   → *App-spezifische Passwörter*. Das normale Apple-ID-Passwort
   funktioniert **nicht** für CalDAV.
2. `.env.example` nach `.env.local` kopieren und ausfüllen:

   ```bash
   cp .env.example .env.local
   ```

   ```
   ICLOUD_USERNAME=deine-apple-id@icloud.com
   ICLOUD_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx
   ICLOUD_CALENDAR_NAME=   # optional, sonst wird der erste beschreibbare Kalender genutzt
   ```
3. Server neu starten. Der Vereinskalender lädt jetzt Termine aus iCloud und
   erlaubt über den Button "Termin vorschlagen" das Anlegen neuer Termine
   (z. B. direkt für den empfohlenen besten Segeltag).

**Sicherheitshinweis:** Die Zugangsdaten werden ausschließlich serverseitig
verwendet (API-Routen unter `src/app/api/calendar`) und niemals an den
Browser ausgeliefert. `.env.local` ist per `.gitignore` von Git ausgeschlossen
— niemals echte Zugangsdaten committen. Für ein Produktions-Deployment (z. B.
Vercel) die Variablen als Umgebungsvariablen im Hosting-Dashboard setzen.

Empfehlung: einen dedizierten iCloud-Account für den Verein anlegen statt ein
privates Apple-Konto zu verwenden, damit der Schreibzugriff auf einen
separaten Kalender beschränkt bleibt.

## Segelrevier anpassen

Standort und Vereine sind in `src/lib/locations.ts` definiert. Für ein
anderes Revier `AMMERSEE_LOCATION` (Koordinaten) und `SAILING_CLUBS`
anpassen — die Wetterdaten und der Kartenausschnitt folgen automatisch.

## Architektur

```
src/
  app/
    page.tsx                 Hauptseite (Server Component, lädt Wetterdaten)
    api/weather/route.ts     Proxy zu Bright Sky + Scoring
    api/calendar/route.ts    CalDAV GET (lesen) / POST (Termin anlegen)
  lib/
    weather.ts                Bright-Sky-Anbindung, Segeltag-Scoring
    caldav.ts                 iCloud-CalDAV-Client (tsdav)
    locations.ts               Ammersee-Koordinaten & Segelvereine
  components/
    WindDashboard.tsx          Aktuelle Werte + Kompassrose
    ForecastList.tsx            7-Tage-Vorhersage + Empfehlung
    SailingMap.tsx (+ Loader)  Leaflet-Karte
    CalendarSection.tsx         Kalenderanzeige & Termin-Formular
```

## Tech-Stack

Next.js (App Router) · TypeScript · Tailwind CSS 4 · react-leaflet ·
tsdav (CalDAV) · ical.js / ical-generator

## Deployment

Für Vercel: Projekt importieren, die iCloud-Umgebungsvariablen im
Vercel-Dashboard setzen, fertig. Bright Sky/DWD und OpenStreetMap benötigen
keine Keys.
