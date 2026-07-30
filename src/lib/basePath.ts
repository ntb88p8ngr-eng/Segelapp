/**
 * Präfix, unter dem die App ausgeliefert wird — etwa "/segelapp", wenn sie
 * nicht auf einer eigenen Domain, sondern als Unterseite läuft.
 *
 * Next.js setzt `basePath` von sich aus vor Links, Bilder und die Dateien
 * unter /_next. Aufrufe mit `fetch()` präfixt es dagegen **nicht** — die
 * müssen den Pfad selbst mitbringen, sonst landen sie auf der Wurzel der
 * Domain und laufen ins Leere.
 */
export const BASE_PATH = (process.env.NEXT_PUBLIC_BASE_PATH ?? "").replace(
  /\/+$/,
  "",
);

/** Pfad einer eigenen API-Route, passend zum konfigurierten Präfix. */
export function apiUrl(path: string): string {
  return `${BASE_PATH}${path}`;
}
