# Selbst hosten

Diese Anleitung beschreibt, wie die Seite auf eigener Infrastruktur läuft und
welche Zugänge dafür nötig sind.

## Voraussetzungen

- **Node.js 20.9 oder neuer** (von Next.js 16 vorausgesetzt)
- **Ein dauerhaft laufender Node-Prozess.** Die Seite lässt sich *nicht*
  statisch ausliefern: `/api/calendar` spricht per CalDAV mit iCloud und
  `/api/weather` holt die DWD-Daten serverseitig. Reine Static-Hoster wie
  GitHub Pages oder ein blosser Webspace genügen deshalb nicht.
- Ein kleiner Server reicht: 1 vCPU und 512–1024 MB RAM sind ausreichend.

## Welche Zugänge werden gebraucht?

| Dienst | Wofür | Zugangsdaten nötig? |
| --- | --- | --- |
| Deutscher Wetterdienst über [brightsky.dev](https://brightsky.dev) | Wind, Böen, Vorhersage | **Nein** — offen, kein Schlüssel, kein Konto |
| [OpenStreetMap](https://www.openstreetmap.org) | Kartenkacheln | **Nein** — keine Anmeldung |
| iCloud, öffentlich geteilter Kalender | Termine **anzeigen** | **Nein** — nur die Freigabe-Adresse |
| iCloud, CalDAV | Termine anzeigen **und anlegen** | **Ja** — Apple-ID + app-spezifisches Passwort |

Wetter und Karte funktionieren nach dem Deployment sofort. Beim Kalender hast
du die Wahl, und nur die zweite Variante verlangt Zugangsdaten.

Ohne jede Kalender-Konfiguration startet die Seite trotzdem: Wetter,
Vorhersage und Karte laufen normal, der Kalenderbereich zeigt einen Hinweis,
dass er noch nicht verbunden ist.

## Variante 1: Öffentlicher Kalender (nur anzeigen)

Der schnellste Weg und ohne Zugangsdaten. In der Kalender-App den Kalender
freigeben, *Öffentlicher Kalender* aktivieren und die Adresse übernehmen:

```
ICLOUD_PUBLIC_CALENDAR_URL=webcal://p01-caldav.icloud.com/published/2/XXXXXXXX
```

`webcal://` und `https://` werden beide akzeptiert — es ist dieselbe Adresse,
`webcal://` ist nur die Einladung ans Betriebssystem, sie zu abonnieren.

Ein öffentlicher Kalender ist eine ausgelieferte Datei und nimmt keine neuen
Termine entgegen. Die Seite blendet den Knopf "Termin vorschlagen" deshalb aus
und kennzeichnet den Kalender als "nur Ansicht"; ein Schreibversuch über die
API wird mit einer erklärenden Meldung abgelehnt.

Bedenke: Wer die Adresse kennt, kann den Kalender abonnieren. Für einen
Vereinsterminkalender ist das in der Regel gewollt.

## Variante 2: CalDAV-Zugang (anzeigen und anlegen)

1. Auf [appleid.apple.com](https://appleid.apple.com) anmelden.
2. Unter *Anmelden & Sicherheit* → *App-spezifische Passwörter* ein neues
   Passwort erzeugen (Format `xxxx-xxxx-xxxx-xxxx`). Es wird nur einmal
   angezeigt.
3. Zwei Umgebungsvariablen setzen:

   ```
   ICLOUD_USERNAME=verein@icloud.com
   ICLOUD_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx
   ICLOUD_CALENDAR_NAME=Segelclub     # optional
   ```

Das **normale Apple-ID-Passwort funktioniert nicht** — CalDAV verlangt ein
app-spezifisches Passwort. Zwei-Faktor-Authentifizierung muss für die Apple-ID
aktiv sein, sonst lassen sich keine app-spezifischen Passwörter erzeugen.

Bleibt `ICLOUD_CALENDAR_NAME` leer, wird der erste beschreibbare Kalender des
Kontos verwendet. Bei mehreren Kalendern besser den Namen angeben.

Sind CalDAV-Zugangsdaten gesetzt, haben sie Vorrang — eine zusätzlich
hinterlegte `ICLOUD_PUBLIC_CALENDAR_URL` wird dann ignoriert.

**Dringende Empfehlung:** eine eigene Apple-ID für den Verein anlegen und dort
nur den Vereinskalender führen. Ein app-spezifisches Passwort gilt für das
gesamte iCloud-Konto — mit einem privaten Konto gäbe die Seite Zugriff auf
sämtliche privaten Kalender. Ein einmal erzeugtes Passwort lässt sich auf
appleid.apple.com jederzeit einzeln widerrufen.

## Variante A: Vercel

Der schnellste Weg, da Next.js von Vercel stammt.

1. Repository auf Vercel importieren — Build-Einstellungen werden erkannt.
2. Unter *Settings → Environment Variables* die drei Kalender-Variablen für
   *Production* eintragen.
3. Deployen. Nach dem Ändern von Variablen ist ein erneutes Deployment nötig.

## Variante B: Eigener Server

```bash
git clone <repo-url> /opt/segelapp
cd /opt/segelapp
npm ci
npm run build
```

Zugangsdaten in eine Datei ausserhalb des Projekts legen, damit sie nicht
versehentlich in Git landen:

```bash
sudo install -m 600 /dev/null /etc/segelapp.env
sudo nano /etc/segelapp.env      # die ICLOUD_-Variablen eintragen
```

Dienst unter `/etc/systemd/system/segelapp.service`:

```ini
[Unit]
Description=Segelgemeinschaft Ammersee
After=network.target

[Service]
Type=simple
User=segelapp
WorkingDirectory=/opt/segelapp
EnvironmentFile=/etc/segelapp.env
Environment=NODE_ENV=production
ExecStart=/usr/bin/npx next start -p 3000
Restart=on-failure
RestartSec=5

# Etwas Absicherung
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
# Next schreibt seinen Cache für die 10-Minuten-Aktualisierung hierhin
ReadWritePaths=/opt/segelapp/.next

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable --now segelapp
```

Davor gehört ein Reverse Proxy mit TLS. Mit Caddy genügt eine Datei, das
Zertifikat besorgt es selbst:

```
segeln.example.de {
    reverse_proxy 127.0.0.1:3000
}
```

Wichtig: Port 3000 nicht direkt ins Internet öffnen — nur der Proxy soll von
aussen erreichbar sein.

## Variante C: Docker

```dockerfile
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/.next ./.next
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/public ./public
COPY --from=build /app/package.json ./
EXPOSE 3000
CMD ["npx", "next", "start"]
```

```yaml
services:
  segelapp:
    build: .
    restart: unless-stopped
    ports: ["127.0.0.1:3000:3000"]
    env_file: ./segelapp.env
```

Für ein deutlich kleineres Image lässt sich in `next.config.ts`
`output: "standalone"` setzen; dann genügt es, `.next/standalone`,
`.next/static` und `public` zu kopieren und mit `node server.js` zu starten.

## Unter einem Unterpfad ausliefern

Läuft die Seite nicht auf einer eigenen (Sub-)Domain, sondern als Unterseite —
etwa `https://verein.de/segelapp` — muss das Präfix beim **Bauen** bekannt
sein:

```
NEXT_PUBLIC_BASE_PATH=/segelapp
```

Der Reverse Proxy muss den Pfad dann **unverändert** durchreichen, nicht das
Präfix abschneiden:

```
verein.de {
    handle_path /segelapp/* {
        # falsch: schneidet /segelapp ab
    }
    handle /segelapp/* {
        reverse_proxy 127.0.0.1:3000   # richtig: Pfad bleibt vollständig
    }
}
```

Ohne die Variable verweist das ausgelieferte HTML auf `/_next/...` statt auf
`/segelapp/_next/...`; die Seite käme dann ohne Gestaltung an.

Auf einer eigenen (Sub-)Domain wird die Variable **nicht** gesetzt — dort
ändert sich nichts.

## Zugangsdaten ändern

Die Variablen werden bei jeder Anfrage aus `process.env` gelesen, nicht in den
Build eingebacken. Ein Neustart des Prozesses genügt also — nur bei Vercel ist
ein erneutes Deployment nötig.

## Beim Betrieb beachten

**Quellenangabe ist Pflicht.** DWD-Daten dürfen frei genutzt werden, verlangen
aber die Nennung der Quelle; für OpenStreetMap gilt dasselbe. Beides steht
bereits in der Fusszeile beziehungsweise an der Karte — bitte drin lassen.

**Fair use.** Bright Sky und die OSM-Kachelserver werden kostenlos
bereitgestellt und sind nicht für hohe Last gedacht. Die Seite fragt Wetterdaten
deshalb nur alle 10 Minuten neu ab, unabhängig von der Besucherzahl — die
Seiten selbst werden pro Aufruf gerendert, aber der Abruf bei Bright Sky ist
zwischengespeichert. Für einen Verein ist das unproblematisch.

Bei deutlich mehr Verkehr lässt sich Bright Sky
[selbst betreiben](https://brightsky.dev/docs/#self-hosting); die eigene
Instanz wird über `BRIGHTSKY_BASE_URL` eingetragen. Für Kartenkacheln gibt es
kostenpflichtige Anbieter.

**Zugangsdaten schützen.** `.env.local` steht in `.gitignore` und darf dort
nicht heraus. Auf dem Server die Datei mit `chmod 600` nur für den Dienstnutzer
lesbar halten. Gerät das app-spezifische Passwort in falsche Hände, auf
appleid.apple.com widerrufen und ein neues erzeugen.

**Aktualisieren.**

```bash
cd /opt/segelapp
git pull
npm ci
npm run build
sudo systemctl restart segelapp
```

## Fehlersuche

| Symptom | Ursache |
| --- | --- |
| Kalenderbereich zeigt „noch nicht verbunden" | Weder `ICLOUD_PUBLIC_CALENDAR_URL` noch die CalDAV-Variablen gesetzt, oder nach dem Setzen nicht neu gestartet |
| „Termin vorschlagen" fehlt, Kalender als „nur Ansicht" markiert | Es ist ein öffentlicher Kalender eingebunden; Schreiben braucht `ICLOUD_USERNAME` und `ICLOUD_APP_PASSWORD` |
| „Die Adresse liefert keinen Kalender" | `ICLOUD_PUBLIC_CALENDAR_URL` zeigt auf eine Web- statt Freigabe-Adresse |
| „Kalender-Feed antwortete mit 404" | Die öffentliche Freigabe wurde in iCloud wieder aufgehoben |
| „Kalender-Feed … ist nicht erreichbar" | Der Server kommt nicht an `*.icloud.com` (Firewall, ausgehender Verkehr gesperrt) |
| „Kalender-Termine konnten nicht geladen werden" | Zugangsdaten falsch, normales statt app-spezifisches Passwort, oder `ICLOUD_CALENDAR_NAME` passt zu keinem Kalender |
| Keine Wetterdaten | Server kommt nicht an `api.brightsky.dev` (Firewall, ausgehender Verkehr gesperrt) |
| Karte bleibt leer | Kacheln von `tile.openstreetmap.org` werden blockiert |

Serverseitige Fehler landen im Log des Dienstes:

```bash
journalctl -u segelapp -f
```
