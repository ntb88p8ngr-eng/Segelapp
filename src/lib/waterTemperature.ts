import type { WaterTemperature } from "./types";

/**
 * Wassertemperatur aus einer frei wählbaren Quelle.
 *
 * Anders als beim Wind gibt es dafür keinen fertigen Weg über Bright Sky —
 * die DWD-Daten dahinter enthalten keine Seewassertemperaturen. Für bayerische
 * Seen führt sie der Gewässerkundliche Dienst Bayern (gkd.bayern.de), andere
 * Regionen haben eigene Stellen. Statt eine Adresse fest zu verdrahten, die
 * womöglich nicht passt oder sich ändert, wird sie hier konfiguriert:
 *
 *   WATER_TEMPERATURE_URL=https://…
 *
 * Erwartet wird JSON. Erkannt werden die üblichen Schreibweisen für den
 * Messwert (temperature, value, celsius, wert …) und den Zeitpunkt, sowohl
 * direkt im Objekt als auch im ersten Element einer Liste. Ohne gesetzte
 * Variable bleibt die Anzeige einfach aus.
 */
const VALUE_KEYS = [
  "temperature",
  "waterTemperature",
  "water_temperature",
  "celsius",
  "value",
  "wert",
];

const TIME_KEYS = ["timestamp", "measuredAt", "measured_at", "datum", "date", "time"];

export function isWaterTemperatureConfigured(): boolean {
  return Boolean(process.env.WATER_TEMPERATURE_URL?.trim());
}

function pickNumber(record: Record<string, unknown>): number | null {
  for (const key of VALUE_KEYS) {
    const raw = record[key];
    if (typeof raw === "number" && Number.isFinite(raw)) return raw;
    if (typeof raw === "string") {
      // Deutsche Schreibweise mit Komma zulassen.
      const parsed = Number(raw.replace(",", "."));
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}

function pickTime(record: Record<string, unknown>): string | null {
  for (const key of TIME_KEYS) {
    const raw = record[key];
    if (typeof raw === "string" && raw) return raw;
  }
  return null;
}

export async function fetchWaterTemperature(): Promise<WaterTemperature | null> {
  const url = process.env.WATER_TEMPERATURE_URL?.trim();
  if (!url) return null;

  let parsed: unknown;
  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      // Wassertemperatur ändert sich träge — eine Stunde reicht.
      next: { revalidate: 3600 },
    });
    if (!response.ok) {
      throw new Error(`Antwort ${response.status}`);
    }
    parsed = await response.json();
  } catch (error) {
    console.error("Wassertemperatur konnte nicht geladen werden:", error);
    return null;
  }

  // Viele Messnetze liefern eine Liste von Messpunkten — dann zählt der erste.
  const record = Array.isArray(parsed) ? parsed[0] : parsed;
  if (!record || typeof record !== "object") return null;

  const celsius = pickNumber(record as Record<string, unknown>);
  if (celsius == null) {
    console.error(
      "Wassertemperatur: In der Antwort war kein Messwert zu finden. Erwartet wird eines der Felder: " +
        VALUE_KEYS.join(", "),
    );
    return null;
  }

  return {
    celsius: Math.round(celsius * 10) / 10,
    measuredAt: pickTime(record as Record<string, unknown>),
  };
}
