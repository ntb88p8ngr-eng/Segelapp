import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Waypoint } from "./types";

/**
 * Ablage der gemeinsamen Wegpunkte als JSON-Datei.
 *
 * Bewusst schlicht gehalten — für einen Verein sind es ein paar Dutzend
 * Einträge. Wichtig: Das setzt einen Server mit dauerhaftem Dateisystem
 * voraus. Auf serverlosen Plattformen (Vercel & Co.) ist das Dateisystem
 * flüchtig; dort gingen die Wegpunkte beim nächsten Kaltstart verloren.
 */
const STORE_PATH =
  process.env.WAYPOINTS_FILE || path.join(process.cwd(), ".data", "waypoints.json");

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
    const raw = await readFile(STORE_PATH, "utf8");
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
  await mkdir(path.dirname(STORE_PATH), { recursive: true });
  // Erst daneben schreiben, dann umbenennen: Ein Absturz mitten im Schreiben
  // hinterlässt so keine halbe Datei.
  const tmp = `${STORE_PATH}.${process.pid}.tmp`;
  await writeFile(tmp, JSON.stringify(waypoints, null, 2), "utf8");
  await rename(tmp, STORE_PATH);
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
