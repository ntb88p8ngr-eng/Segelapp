import { randomUUID } from "node:crypto";
import path from "node:path";
import type { Waypoint } from "./types";

/**
 * Ablage der gemeinsamen Wegpunkte als JSON-Datei.
 *
 * Bewusst schlicht gehalten — für einen Verein sind es ein paar Dutzend
 * Einträge. Wichtig: Das setzt einen Server mit dauerhaftem Dateisystem
 * voraus. Auf serverlosen Plattformen (Vercel & Co.) ist das Dateisystem
 * flüchtig; dort gingen die Wegpunkte beim nächsten Kaltstart verloren.
 *
 * Der Vorgabepfad ist relativ notiert; Node löst ihn beim Zugriff gegen das
 * Arbeitsverzeichnis auf.
 */
const DEFAULT_STORE_PATH = ".data/waypoints.json";

function storePath(): string {
  return process.env.WAYPOINTS_FILE?.trim() || DEFAULT_STORE_PATH;
}

/**
 * Der Dateizugriff wird erst zur Laufzeit geladen und dabei ausdrücklich von
 * Turbopack ausgenommen.
 *
 * Grund: Der Ablageort steht erst zur Laufzeit fest (Umgebungsvariable). Sieht
 * Turbopack beim Bauen ein `readFile` mit einem Pfad, den es nicht vorhersagen
 * kann, nimmt es an, dieses Modul lese zur Bauzeit beliebige Dateien, und zieht
 * vorsichtshalber das gesamte Projekt in die Ablaufverfolgung. Der Build meldet
 * das als Warnung — und bricht unter Umständen mit einer irreführenden Meldung
 * über ein angeblich fehlendes Modul ganz woanders ab.
 *
 * Die Magic Comments wirken nur auf `import()` und `require()`, nicht auf die
 * Dateioperation selbst; deshalb dieser Umweg statt eines Kommentars am Aufruf.
 */
type FsPromises = typeof import("node:fs/promises");

let fsPromise: Promise<FsPromises> | undefined;

function fs(): Promise<FsPromises> {
  fsPromise ??= import(/* turbopackIgnore: true */ "node:fs/promises");
  return fsPromise;
}

/** Ohne Anmeldung darf jede Person schreiben — deshalb harte Obergrenzen. */
export const MAX_WAYPOINTS = 200;
export const MAX_NAME_LENGTH = 60;

/**
 * Grober Rahmen um den Ammersee. Verhindert, dass die Karte mit Punkten
 * irgendwo auf der Welt gefüllt wird.
 */
const BOUNDS = { minLat: 47.6, maxLat: 48.3, minLon: 10.7, maxLon: 11.6 };

/**
 * Schreibvorgänge in eine Kette hängen. Ohne das könnten zwei gleichzeitige
 * Anfragen dieselbe Ausgangsliste lesen und die Änderung der jeweils anderen
 * überschreiben.
 */
let queue: Promise<unknown> = Promise.resolve();

function serialise<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task);
  queue = run.catch(() => undefined);
  return run;
}

function isWaypoint(value: unknown): value is Waypoint {
  if (!value || typeof value !== "object") return false;
  const w = value as Partial<Waypoint>;
  return (
    typeof w.id === "string" &&
    typeof w.name === "string" &&
    typeof w.lat === "number" &&
    typeof w.lon === "number" &&
    typeof w.createdAt === "string"
  );
}

async function readAll(): Promise<Waypoint[]> {
  try {
    const { readFile } = await fs();
    const raw = await readFile(storePath(), "utf8");
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isWaypoint) : [];
  } catch (error) {
    // Noch nie geschrieben: leere Liste, kein Fehler.
    if ((error as NodeJS.ErrnoException)?.code === "ENOENT") return [];
    console.error("Wegpunkte konnten nicht gelesen werden:", error);
    return [];
  }
}

async function writeAll(waypoints: Waypoint[]): Promise<void> {
  const { mkdir, rename, writeFile } = await fs();
  const target = storePath();
  await mkdir(path.dirname(target), { recursive: true });
  // Erst daneben schreiben, dann umbenennen: Ein Absturz mitten im Schreiben
  // hinterlässt so keine halbe Datei.
  const tmp = `${target}.${process.pid}.tmp`;
  await writeFile(tmp, JSON.stringify(waypoints, null, 2), "utf8");
  await rename(tmp, target);
}

export async function listWaypoints(): Promise<Waypoint[]> {
  const all = await readAll();
  return all.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export class WaypointError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export async function addWaypoint(input: {
  name: unknown;
  lat: unknown;
  lon: unknown;
}): Promise<Waypoint> {
  const name = typeof input.name === "string" ? input.name.trim() : "";
  const lat = typeof input.lat === "number" ? input.lat : Number.NaN;
  const lon = typeof input.lon === "number" ? input.lon : Number.NaN;

  if (!name) {
    throw new WaypointError("Bitte einen Namen angeben.", 400);
  }
  if (name.length > MAX_NAME_LENGTH) {
    throw new WaypointError(
      `Der Name darf höchstens ${MAX_NAME_LENGTH} Zeichen haben.`,
      400,
    );
  }
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    throw new WaypointError("Ungültige Koordinaten.", 400);
  }
  if (
    lat < BOUNDS.minLat ||
    lat > BOUNDS.maxLat ||
    lon < BOUNDS.minLon ||
    lon > BOUNDS.maxLon
  ) {
    throw new WaypointError("Der Punkt liegt ausserhalb der Region.", 400);
  }

  return serialise(async () => {
    const all = await readAll();
    if (all.length >= MAX_WAYPOINTS) {
      throw new WaypointError(
        `Es sind höchstens ${MAX_WAYPOINTS} Wegpunkte möglich. Bitte nicht mehr benötigte löschen.`,
        409,
      );
    }

    const waypoint: Waypoint = {
      id: randomUUID(),
      name,
      lat: Math.round(lat * 1e6) / 1e6,
      lon: Math.round(lon * 1e6) / 1e6,
      createdAt: new Date().toISOString(),
    };

    await writeAll([...all, waypoint]);
    return waypoint;
  });
}

/** Gibt zurück, ob tatsächlich etwas entfernt wurde. */
export async function removeWaypoint(id: string): Promise<boolean> {
  return serialise(async () => {
    const all = await readAll();
    const remaining = all.filter((w) => w.id !== id);
    if (remaining.length === all.length) return false;
    await writeAll(remaining);
    return true;
  });
}
