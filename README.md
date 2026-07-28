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
  mittlerer Windstärke, Böigkeit und Niederschlag berechnet. Die Windkurve
  hat einen einzelnen Hochpunkt bei rund 11 kn und fällt zu beiden Seiten ab,
  damit Tage im guten Band nach Qualität sortierbar bleiben statt gleichauf
  zu liegen. Bei gleichem Score gewinnt der frühere Tag.
- **Beste Tageszeit je Tag**: Ein gleitendes 3-Stunden-Fenster wird über die
  Segelstunden geschoben; das bestbewertete Fenster steht auf jeder Tageskarte
  und belegt das Kalenderformular vor. An zu windigen Tagen wird das ruhigste
  Fenster empfohlen und entsprechend als "Ruhigste Zeit" ausgewiesen.
- **Warnungen** für Gewitter und starke Böen — aktuell (rot) und für die
  kommenden Tage (gelb). Schwellen orientieren sich an Beaufort: ab 39 km/h
  Böen ein Hinweis, ab 62 km/h (Sturmböen) eine Warnung.
- **Unwettergefahr pro Tag**: Tage mit Gewitter oder Sturmböen werden in der
  Vorhersage grundsätzlich rot markiert und tragen einen Hinweis mit dem
  Grund. Geprüft wird der gesamte Tag, nicht nur die Segelstunden. Alle
  übrigen Angaben des Tages bleiben sichtbar.
- **Animierte Windkarte** (Leaflet/OpenStreetMap): eine Partikelströmung im
  Stil der iOS-Wetter-App zeigt die Windrichtung über dem See; Geschwindigkeit
  und Strichlänge folgen Wind und Böen.
- **Vereinskalender** mit Lese- und Schreibzugriff auf einen iCloud-Kalender
  via CalDAV (serverseitig, keine Zugangsdaten im Browser). Tage, an denen
  bereits ein Termin liegt, werden in der Vorhersage rot markiert.
- **Heller und dunkler Modus**, umschaltbar über einen Toggle, der von einem
  Segelboot auf ein Piratenschiff wechselt. Die Wahl wird gespeichert;
  ohne gespeicherte Wahl gilt die Systemeinstellung.
- **Für Telefone ausgelegt**: zweispaltige Vorhersage statt endloser
  Scrollstrecke, Bedienelemente ab 44 px (an den Zeigertyp gekoppelt, nicht
  an die Bildschirmbreite) und eine Karte, die sich mit einem Finger nicht
  vor den Seitenscroll drängt — verschoben wird sie dort mit zwei Fingern.

## Setup

```bash
npm install
npm run dev
```

Die Seite läuft dann unter [http://localhost:3000](http://localhost:3000).
Wetterdaten und Karte funktionieren sofort ohne weitere Konfiguration.

Ohne Netzzugang (oder um die Warnungen gezielt zu testen) liefert
`DEMO_WEATHER=1 npm run dev` feste Demo-Wetterdaten inklusive Gewittertag
und Sturmböen — siehe `src/lib/demoWeather.ts`.

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

Der Standort ist in `src/lib/locations.ts` definiert. Für ein anderes Revier
`AMMERSEE_LOCATION` (Koordinaten) anpassen — Wetterdaten und Kartenausschnitt
folgen automatisch.

## Architektur

```
src/
  app/
    page.tsx                  Hauptseite (Server Component, lädt Wetterdaten)
    layout.tsx                Theme-Init ohne Flackern
    api/weather/route.ts      Proxy zu Bright Sky + Scoring
    api/calendar/route.ts     CalDAV GET (lesen) / POST (Termin anlegen)
  lib/
    weather.ts                Bright-Sky-Anbindung, Scoring, Zeitfenster, Warnungen
    caldav.ts                 iCloud-CalDAV-Client (tsdav)
    demoWeather.ts            Demo-Fixture für die Entwicklung
    locations.ts              Ammersee-Koordinaten
  components/
    ThemeProvider.tsx         data-theme als externer Store
    ThemeToggle.tsx           Segelboot-/Piratenschiff-Umschalter
    WeatherAlerts.tsx         Gewitter- und Böen-Warnungen
    WindDashboard.tsx         Aktuelle Werte + Kompassrose
    ForecastList.tsx          Tageskarten, beste Zeit, Belegung
    WindParticles.tsx         Canvas-Strömungsanimation
    SailingMap.tsx (+ Loader) Leaflet-Karte mit Animations-Overlay
    CalendarProvider.tsx      Termine für Vorhersage und Kalender
    CalendarSection.tsx       Kalenderanzeige & Termin-Formular
```

## Tech-Stack

Next.js (App Router) · TypeScript · Tailwind CSS 4 · react-leaflet ·
tsdav (CalDAV) · ical.js / ical-generator

## Deployment

Für Vercel: Projekt importieren, die iCloud-Umgebungsvariablen im
Vercel-Dashboard setzen, fertig. Bright Sky/DWD und OpenStreetMap benötigen
keine Keys.
