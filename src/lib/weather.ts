import { AMMERSEE_LOCATION } from "./locations";
import { demoCurrentWeather, demoForecast, isDemoMode } from "./demoWeather";
import { formatKnots, formatShortDate, formatWeekday } from "./format";
import {
  DEFAULT_SAILING_WINDOW,
  GUST_STORM_KMH,
  GUST_STRONG_KMH,
  summariseDay,
} from "./scoring";
import type {
  DailyForecast,
  SailingWindow,
  WeatherAlert,
  WeatherResponse,
  WeatherStation,
  WindObservation,
} from "./types";

/** Kennzeichnung des Wetterabrufs, damit er gezielt erneuert werden kann. */
export const WEATHER_CACHE_TAG = "weather";

/**
 * Adresse der Bright-Sky-Instanz. Überschreibbar, damit eine selbst
 * betriebene Instanz genutzt werden kann — bei höherem Verkehr ist das der
 * empfohlene Weg, statt den öffentlichen Dienst zu belasten.
 */
const BRIGHTSKY_BASE = (
  process.env.BRIGHTSKY_BASE_URL || "https://api.brightsky.dev"
).replace(/\/+$/, "");

// Bright Sky (https://brightsky.dev) is an open-source JSON wrapper around
// the raw data published by the Deutscher Wetterdienst (DWD) open data
// server. It resolves the nearest DWD station/grid point for a given
// lat/lon automatically, so no manual station lookup is required.

interface BrightSkyRecord {
  timestamp: string;
  wind_speed: number | null;
  wind_direction: number | null;
  wind_gust_speed: number | null;
  temperature: number | null;
  condition: string | null;
  precipitation: number | null;
  cloud_cover: number | null;
}

function toObservation(r: BrightSkyRecord): WindObservation {
  return {
    timestamp: r.timestamp,
    windSpeedKmh: r.wind_speed,
    windDirectionDeg: r.wind_direction,
    windGustKmh: r.wind_gust_speed,
    temperatureC: r.temperature,
    condition: r.condition,
    precipitationMm: r.precipitation,
    cloudCoverPercent: r.cloud_cover,
  };
}

/**
 * /current_weather benennt Wind und Niederschlag anders als /weather: Dort
 * tragen sie das Mittelungsintervall im Namen (wind_speed_10, _30, _60),
 * während temperature schlicht heisst. Wer die schlichten Namen erwartet,
 * bekommt für Wind, Böen und Niederschlag null — die Temperatur kommt an, der
 * Rest bleibt leer.
 *
 * Gelesen wird das kürzeste verfügbare Intervall, weil es dem "jetzt" am
 * nächsten kommt. Die schlichten Namen bleiben als Rückfallebene drin, falls
 * Bright Sky sie doch mitliefert.
 */
type LooseRecord = Record<string, unknown>;

function firstNumber(record: LooseRecord, keys: string[]): number | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return null;
}

function firstString(record: LooseRecord, keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value) return value;
  }
  return null;
}

function toCurrentObservation(raw: LooseRecord): WindObservation {
  return {
    timestamp:
      firstString(raw, ["timestamp"]) ?? new Date().toISOString(),
    windSpeedKmh: firstNumber(raw, [
      "wind_speed_10",
      "wind_speed_30",
      "wind_speed_60",
      "wind_speed",
    ]),
    windDirectionDeg: firstNumber(raw, [
      "wind_direction_10",
      "wind_direction_30",
      "wind_direction_60",
      "wind_direction",
    ]),
    windGustKmh: firstNumber(raw, [
      "wind_gust_speed_10",
      "wind_gust_speed_30",
      "wind_gust_speed_60",
      "wind_gust_speed",
    ]),
    temperatureC: firstNumber(raw, ["temperature"]),
    condition: firstString(raw, ["condition"]),
    // Beim Niederschlag ist die letzte Stunde die aussagekräftigere Zahl —
    // 10 Minuten sind für "hat es geregnet?" zu kurz.
    precipitationMm: firstNumber(raw, [
      "precipitation_60",
      "precipitation_30",
      "precipitation_10",
      "precipitation",
    ]),
    cloudCoverPercent: firstNumber(raw, ["cloud_cover"]),
  };
}

async function fetchJson(url: string) {
  if (isDemoMode()) {
    return url.includes("current_weather") ? demoCurrentWeather() : demoForecast();
  }
  const res = await fetch(url, {
    next: { revalidate: 600, tags: [WEATHER_CACHE_TAG] },
  });
  if (!res.ok) {
    throw new Error(`Bright Sky Anfrage fehlgeschlagen (${res.status})`);
  }
  return res.json();
}

/** Liest die von Bright Sky mitgelieferte Stationsangabe. */
function toStation(sources: unknown): WeatherStation | null {
  if (!Array.isArray(sources) || !sources.length) return null;
  const first = sources[0] as LooseRecord;
  const name = firstString(first, ["station_name"]);
  if (!name) return null;

  const distanceMeters = firstNumber(first, ["distance"]);
  return {
    name,
    distanceKm:
      distanceMeters != null ? Math.round(distanceMeters / 100) / 10 : null,
    observationType: firstString(first, ["observation_type"]),
  };
}

export async function fetchCurrentWeather(): Promise<{
  observation: WindObservation | null;
  station: WeatherStation | null;
}> {
  const url = `${BRIGHTSKY_BASE}/current_weather?lat=${AMMERSEE_LOCATION.lat}&lon=${AMMERSEE_LOCATION.lon}&units=dwd`;
  const data = await fetchJson(url);
  return {
    observation: data?.weather
      ? toCurrentObservation(data.weather as LooseRecord)
      : null,
    station: toStation(data?.sources),
  };
}

/** Die Messung, die dem Jetzt am nächsten liegt. */
function nearestObservation(
  observations: WindObservation[],
): WindObservation | null {
  const now = Date.now();
  let best: WindObservation | null = null;
  let bestGap = Infinity;

  for (const obs of observations) {
    if (obs.windSpeedKmh == null) continue;
    const gap = Math.abs(new Date(obs.timestamp).getTime() - now);
    if (gap < bestGap) {
      bestGap = gap;
      best = obs;
    }
  }
  return best;
}

function ageMinutes(observation: WindObservation): number {
  return Math.abs(Date.now() - new Date(observation.timestamp).getTime()) / 60000;
}

/**
 * Ab diesem Vorsprung wird die Stundenreihe der Direktmeldung vorgezogen.
 *
 * Eine echte Stationsmeldung ist einer modellierten Stunde grundsätzlich
 * überlegen, deshalb nicht schon bei wenigen Minuten wechseln. Meldet die
 * Station aber seit zwei Stunden nichts Neues, ist der Wert für "aktuell"
 * unbrauchbar — dann zählt Aktualität mehr als Herkunft.
 */
const STALE_REPORT_MINUTES = 90;

/**
 * Wählt zwischen der Direktmeldung der Station und der zeitlich nächsten
 * Stunde aus der Vorhersagereihe.
 */
function pickCurrent(
  reported: WindObservation | null,
  forecast: DailyForecast[],
): WindObservation | null {
  const nearest = nearestObservation(forecast.flatMap((day) => day.hourly));

  // Ohne Wind ist die Direktmeldung für das Dashboard wertlos.
  if (!reported || reported.windSpeedKmh == null) {
    if (!nearest) return reported;
    return {
      ...nearest,
      // Temperatur und Zustand der Direktmeldung sind aktueller, falls da.
      temperatureC: reported?.temperatureC ?? nearest.temperatureC,
      condition: reported?.condition ?? nearest.condition,
    };
  }

  if (!nearest) return reported;

  const reportedAge = ageMinutes(reported);
  const nearestAge = ageMinutes(nearest);
  if (reportedAge - nearestAge > STALE_REPORT_MINUTES) {
    return {
      ...nearest,
      temperatureC: reported.temperatureC ?? nearest.temperatureC,
      condition: reported.condition ?? nearest.condition,
    };
  }

  return reported;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function fetchForecast(
  days = 6,
  window: SailingWindow = DEFAULT_SAILING_WINDOW,
): Promise<DailyForecast[]> {
  const today = new Date();
  const lastDay = new Date(today);
  lastDay.setDate(lastDay.getDate() + days);

  const url = `${BRIGHTSKY_BASE}/weather?lat=${AMMERSEE_LOCATION.lat}&lon=${AMMERSEE_LOCATION.lon}&date=${isoDate(today)}&last_date=${isoDate(lastDay)}&units=dwd`;
  const data = await fetchJson(url);
  const records: BrightSkyRecord[] = data?.weather ?? [];

  const byDay = new Map<string, WindObservation[]>();
  for (const record of records) {
    const obs = toObservation(record);
    const day = obs.timestamp.slice(0, 10);
    const bucket = byDay.get(day);
    if (bucket) bucket.push(obs);
    else byDay.set(day, [obs]);
  }

  const todayKey = new Date().toISOString().slice(0, 10);
  const result: DailyForecast[] = [];

  for (const [day, hours] of byDay) {
    if (day < todayKey) continue;
    const summary = summariseDay(day, hours, window);
    if (summary) result.push(summary);
  }

  result.sort((a, b) => a.date.localeCompare(b.date));
  return result;
}

function buildAlerts(
  current: WindObservation | null,
  forecast: DailyForecast[],
): WeatherAlert[] {
  const alerts: WeatherAlert[] = [];

  if (current?.condition === "thunderstorm") {
    alerts.push({
      id: "gewitter-aktuell",
      kind: "gewitter",
      severity: "warnung",
      title: "Gewitter am See",
      description:
        "Aktuell Gewitter gemeldet. Nicht auslaufen — Blitzschlag und plötzliche Fallböen sind lebensgefährlich.",
    });
  }

  const currentGust = current?.windGustKmh ?? null;
  if (currentGust != null && currentGust >= GUST_STORM_KMH) {
    alerts.push({
      id: "boeen-aktuell-sturm",
      kind: "boeen",
      severity: "warnung",
      title: "Sturmböen",
      description: `Böen bis ${formatKnots(currentGust)} (${Math.round(currentGust)} km/h). Auslaufen wird dringend abgeraten.`,
    });
  } else if (currentGust != null && currentGust >= GUST_STRONG_KMH) {
    alerts.push({
      id: "boeen-aktuell-stark",
      kind: "boeen",
      severity: "hinweis",
      title: "Starke Böen",
      description: `Böen bis ${formatKnots(currentGust)} (${Math.round(currentGust)} km/h). Nur für erfahrene Crews, Reff empfohlen.`,
    });
  }

  // Kommende Tage: nur der jeweils erste betroffene Tag je Kategorie,
  // damit die Warnleiste nicht überläuft.
  const stormDay = forecast.find((day) =>
    day.hourly.some((h) => h.condition === "thunderstorm"),
  );
  if (stormDay && current?.condition !== "thunderstorm") {
    alerts.push({
      id: `gewitter-${stormDay.date}`,
      kind: "gewitter",
      severity: "hinweis",
      title: `Gewitter am ${formatWeekday(stormDay.date)}`,
      description: `Für ${formatWeekday(stormDay.date)}, ${formatShortDate(stormDay.date)} sind Gewitter vorhergesagt. Törnplanung anpassen.`,
    });
  }

  const gustyDay = forecast.find((day) => day.windGustMaxKmh >= GUST_STORM_KMH);
  if (gustyDay && (currentGust == null || currentGust < GUST_STORM_KMH)) {
    alerts.push({
      id: `boeen-${gustyDay.date}`,
      kind: "boeen",
      severity: "hinweis",
      title: `Sturmböen am ${formatWeekday(gustyDay.date)}`,
      description: `Böen bis ${formatKnots(gustyDay.windGustMaxKmh)} erwartet (${formatShortDate(gustyDay.date)}).`,
    });
  }

  return alerts;
}

export async function getWeatherOverview(
  window: SailingWindow = DEFAULT_SAILING_WINDOW,
): Promise<WeatherResponse> {
  const [currentResult, forecast] = await Promise.all([
    fetchCurrentWeather().catch(() => ({ observation: null, station: null })),
    fetchForecast(6, window).catch(() => []),
  ]);

  const current = pickCurrent(currentResult.observation, forecast);

  let bestDayIndex: number | null = null;
  if (forecast.length) {
    let bestIdx = 0;
    for (let i = 1; i < forecast.length; i++) {
      // Strikt größer: Bei gleichem Score bleibt der frühere Tag vorn — ein
      // gleich guter Termin näher an heute ist für die Planung mehr wert.
      if (forecast[i].score > forecast[bestIdx].score) bestIdx = i;
    }
    if (forecast[bestIdx].score > 0) bestDayIndex = bestIdx;
  }

  return {
    location: AMMERSEE_LOCATION,
    source: "Deutscher Wetterdienst (DWD) via brightsky.dev",
    current,
    forecast,
    bestDayIndex,
    alerts: buildAlerts(current, forecast),
    station: currentResult.station,
    fetchedAt: new Date().toISOString(),
  };
}
