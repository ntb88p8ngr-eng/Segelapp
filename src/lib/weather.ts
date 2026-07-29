import { AMMERSEE_LOCATION } from "./locations";
import { demoCurrentWeather, demoForecast, isDemoMode } from "./demoWeather";
import { formatKnots, formatShortDate, formatWeekday } from "./format";
import type {
  BestWindow,
  DailyForecast,
  SailingRating,
  SevereWeatherRisk,
  WeatherAlert,
  WeatherResponse,
  WeatherStation,
  WindObservation,
} from "./types";

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
  const res = await fetch(url, { next: { revalidate: 600 } });
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

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// Böen-Schwellen nach Beaufort (km/h): ab Bft 6 wird es für kleinere Boote
// unangenehm, ab Bft 8 (Sturmböen) sollte nicht mehr ausgelaufen werden.
// Dieselben Schwellen speisen Bewertung und Warnhinweise.
const GUST_STRONG_KMH = 39;
const GUST_STORM_KMH = 62;

/**
 * Bewertungskurve für die mittlere Windgeschwindigkeit: km/h -> 0..100.
 *
 * Bewusst mit einem einzelnen Hochpunkt bei rund 20 km/h (etwa 11 kn) statt
 * mit einem breiten Plateau. Ein Plateau würde jeden Tag im "guten" Band
 * gleich bewerten — ein Tag mit 12 km/h käme dann auf denselben Score wie
 * einer mit 20 km/h, und bei Gleichstand gewinnt einfach der frühere Tag.
 */
const WIND_SCORE_CURVE: ReadonlyArray<readonly [number, number]> = [
  [0, 0],
  [4, 8],
  [7, 25],
  [9, 40],
  [12, 62],
  [15, 80],
  [17, 91],
  [20, 100],
  [24, 94],
  [28, 84],
  [32, 72],
  [38, 52],
  [45, 28],
  [55, 8],
  [70, 0],
];

/** Lineare Interpolation zwischen den Stützstellen der Kurve. */
function windScore(avgKmh: number): number {
  const first = WIND_SCORE_CURVE[0];
  const last = WIND_SCORE_CURVE[WIND_SCORE_CURVE.length - 1];
  if (avgKmh <= first[0]) return first[1];
  if (avgKmh >= last[0]) return last[1];

  for (let i = 1; i < WIND_SCORE_CURVE.length; i++) {
    const [x1, y1] = WIND_SCORE_CURVE[i];
    if (avgKmh <= x1) {
      const [x0, y0] = WIND_SCORE_CURVE[i - 1];
      return y0 + ((avgKmh - x0) / (x1 - x0)) * (y1 - y0);
    }
  }
  return last[1];
}

/**
 * Segeltauglichkeit (0-100) für eine Reihe stündlicher Beobachtungen.
 * Grundlage ist die Windkurve oben; Böigkeit, Niederschlag und Gewitter
 * ziehen davon ab.
 */
function scoreDay(hours: WindObservation[]): {
  /** Anzeigewert, auf 0..100 begrenzt und gerundet. */
  score: number;
  /**
   * Ungekappter, ungerundeter Wert. Nur zum Vergleichen: An Tagen, die
   * ohnehin unsegelbar sind, laufen alle Anzeigewerte auf 0 zusammen — der
   * Rohwert unterscheidet dort weiter zwischen "kräftig zu viel" und
   * "unmöglich" und lässt so das ruhigste Fenster gewinnen.
   */
  rawScore: number;
  rating: SailingRating;
} {
  const speeds = hours
    .map((h) => h.windSpeedKmh)
    .filter((v): v is number => v != null);
  const gusts = hours
    .map((h) => h.windGustKmh)
    .filter((v): v is number => v != null);
  const precip = hours.reduce((sum, h) => sum + (h.precipitationMm ?? 0), 0);
  const hasThunderstorm = hours.some((h) => h.condition === "thunderstorm");

  if (speeds.length === 0) {
    return {
      score: 0,
      rawScore: Number.NEGATIVE_INFINITY,
      rating: "schlecht",
    };
  }

  const avg = speeds.reduce((a, b) => a + b, 0) / speeds.length;
  const gustMax = gusts.length ? Math.max(...gusts) : avg;

  let raw = windScore(avg);

  // Böigkeit: gleitender Abzug statt Stufe, damit unruhige Tage auch
  // untereinander unterscheidbar bleiben. Normale Spreizungen bis 15 km/h
  // gelten als unauffällig.
  const gustSpread = Math.max(0, gustMax - avg);
  if (gustSpread > 15) raw -= Math.min((gustSpread - 15) * 0.8, 20);
  if (gustMax >= GUST_STORM_KMH) raw -= 25;

  raw -= Math.min(precip * 4, 30);

  // Gewitter ist ein Ausschlusskriterium, kein Abzug: deutlich unter jeden
  // windbedingten Malus, damit gewitterfreie Fenster immer vorgezogen werden.
  if (hasThunderstorm) raw = -1000;

  const score = Math.max(0, Math.min(100, Math.round(raw)));

  let rating: SailingRating;
  if (hasThunderstorm) rating = "schlecht";
  else if (avg < 7) rating = "wenig_wind";
  else if (avg > 40 || gustMax > 65) rating = "zu_stark";
  else if (score >= 80) rating = "top";
  else if (score >= 60) rating = "gut";
  else if (score >= 40) rating = "maessig";
  else rating = "schlecht";

  return { score, rawScore: raw, rating };
}

/**
 * Prüft den ganzen Tag (nicht nur das Segelfenster) auf Unwetterlagen.
 * Gewitter und Sturmböen sind für die Planung auch dann relevant, wenn sie
 * ausserhalb der üblichen Segelstunden auftreten.
 */
function buildSevereRisk(
  hours: WindObservation[],
  dayGustMaxKmh: number,
): SevereWeatherRisk | null {
  const hasThunderstorm = hours.some((h) => h.condition === "thunderstorm");
  const hasStormGusts = dayGustMaxKmh >= GUST_STORM_KMH;
  if (!hasThunderstorm && !hasStormGusts) return null;

  const parts: string[] = [];
  if (hasThunderstorm) parts.push("Gewitter");
  if (hasStormGusts) parts.push(`Sturmböen bis ${formatKnots(dayGustMaxKmh)}`);

  return { hasThunderstorm, hasStormGusts, reason: parts.join(" · ") };
}

/** Länge des empfohlenen Zeitfensters in Stunden. */
const WINDOW_HOURS = 3;

/**
 * Sucht das beste zusammenhängende Zeitfenster eines Tages, indem ein
 * gleitendes Fenster über die Segelstunden geschoben und mit derselben
 * Bewertung wie der Gesamttag gescort wird.
 *
 * Verglichen wird über den ungekappten Rohwert. An zu windigen Tagen fallen
 * sonst alle Fenster auf 0 und das früheste gewönne willkürlich; über den
 * Rohwert setzt sich dort das ruhigste Fenster durch — genau das, was an
 * einem Starkwindtag gesucht ist.
 */
function findBestWindow(hours: WindObservation[]): BestWindow | null {
  const usable = hours
    .map((h) => ({ obs: h, hour: new Date(h.timestamp).getHours() }))
    .filter((entry) => entry.obs.windSpeedKmh != null)
    .sort((a, b) => a.hour - b.hour);

  if (usable.length < WINDOW_HOURS) return null;

  let best: BestWindow | null = null;
  let bestRaw = Number.NEGATIVE_INFINITY;
  let bestGustMax = Number.POSITIVE_INFINITY;

  for (let i = 0; i + WINDOW_HOURS <= usable.length; i++) {
    const slice = usable.slice(i, i + WINDOW_HOURS);

    // Nur echte Blöcke aufeinanderfolgender Stunden bewerten.
    const contiguous = slice.every(
      (entry, idx) => idx === 0 || entry.hour === slice[idx - 1].hour + 1,
    );
    if (!contiguous) continue;

    const observations = slice.map((entry) => entry.obs);
    const { score, rawScore } = scoreDay(observations);

    const speeds = observations
      .map((o) => o.windSpeedKmh)
      .filter((v): v is number => v != null);
    const gusts = observations
      .map((o) => o.windGustKmh)
      .filter((v): v is number => v != null);
    const gustMax = gusts.length ? Math.max(...gusts) : 0;

    if (best) {
      if (rawScore < bestRaw) continue;
      // Bei echtem Gleichstand entscheidet die ruhigere Böenspitze.
      if (rawScore === bestRaw && gustMax >= bestGustMax) continue;
    }

    bestRaw = rawScore;
    bestGustMax = gustMax;
    best = {
      startHour: slice[0].hour,
      endHour: slice[slice.length - 1].hour + 1,
      windSpeedAvgKmh:
        Math.round((speeds.reduce((a, b) => a + b, 0) / speeds.length) * 10) / 10,
      windGustMaxKmh: Math.round(gustMax * 10) / 10,
      windDirectionDeg: Math.round(dominantDirection(observations)),
      score,
    };
  }

  return best;
}

function dominantDirection(hours: WindObservation[]): number {
  const dirs = hours
    .map((h) => h.windDirectionDeg)
    .filter((v): v is number => v != null);
  if (!dirs.length) return 0;
  // average via vector sum so 350deg and 10deg average to 0deg, not 180deg
  const rad = dirs.map((d) => (d * Math.PI) / 180);
  const sinSum = rad.reduce((s, r) => s + Math.sin(r), 0);
  const cosSum = rad.reduce((s, r) => s + Math.cos(r), 0);
  const angle = (Math.atan2(sinSum, cosSum) * 180) / Math.PI;
  return (angle + 360) % 360;
}

export async function fetchForecast(days = 6): Promise<DailyForecast[]> {
  const today = new Date();
  const lastDay = new Date(today);
  lastDay.setDate(lastDay.getDate() + days);

  const url = `${BRIGHTSKY_BASE}/weather?lat=${AMMERSEE_LOCATION.lat}&lon=${AMMERSEE_LOCATION.lon}&date=${isoDate(today)}&last_date=${isoDate(lastDay)}&units=dwd`;
  const data = await fetchJson(url);
  const records: BrightSkyRecord[] = data?.weather ?? [];
  const observations = records.map(toObservation);

  const byDay = new Map<string, WindObservation[]>();
  for (const obs of observations) {
    const day = obs.timestamp.slice(0, 10);
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day)!.push(obs);
  }

  const now = new Date();
  const result: DailyForecast[] = [];

  for (const [day, hours] of byDay) {
    // Focus the score on the typical sailing window (9:00-19:00 local).
    const sailingHours = hours.filter((h) => {
      const hour = new Date(h.timestamp).getHours();
      return hour >= 9 && hour <= 19;
    });
    const relevantHours = sailingHours.length ? sailingHours : hours;

    const speeds = relevantHours
      .map((h) => h.windSpeedKmh)
      .filter((v): v is number => v != null);
    const gusts = relevantHours
      .map((h) => h.windGustKmh)
      .filter((v): v is number => v != null);
    const temps = hours
      .map((h) => h.temperatureC)
      .filter((v): v is number => v != null);
    const precipSum = hours.reduce((s, h) => s + (h.precipitationMm ?? 0), 0);
    const { score, rating } = scoreDay(relevantHours);

    // Für die Gefahreneinschätzung zählt der gesamte Tag, nicht nur das
    // Segelfenster.
    const allGusts = hours
      .map((h) => h.windGustKmh)
      .filter((v): v is number => v != null);
    const dayGustMax = allGusts.length ? Math.max(...allGusts) : 0;

    if (!speeds.length) continue;
    if (new Date(day) < new Date(now.toISOString().slice(0, 10))) continue;

    result.push({
      date: day,
      windSpeedAvgKmh:
        Math.round((speeds.reduce((a, b) => a + b, 0) / speeds.length) * 10) /
        10,
      windSpeedMaxKmh: Math.round(Math.max(...speeds) * 10) / 10,
      windGustMaxKmh: gusts.length
        ? Math.round(Math.max(...gusts) * 10) / 10
        : 0,
      windDirectionDeg: Math.round(dominantDirection(relevantHours)),
      temperatureMaxC: temps.length ? Math.round(Math.max(...temps)) : 0,
      precipitationSumMm: Math.round(precipSum * 10) / 10,
      condition:
        relevantHours.find((h) => h.condition)?.condition ?? hours[0]?.condition ?? null,
      score,
      rating,
      bestWindow: findBestWindow(relevantHours),
      severeRisk: buildSevereRisk(hours, dayGustMax),
      hourly: hours,
    });
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

export async function getWeatherOverview(): Promise<WeatherResponse> {
  const [currentResult, forecast] = await Promise.all([
    fetchCurrentWeather().catch(() => ({ observation: null, station: null })),
    fetchForecast(6).catch(() => []),
  ]);

  const reported = currentResult.observation;

  // Nicht jede Station meldet durchgehend Wind. Fehlt er, ist die zeitlich
  // nächste Stundenmessung besser als ein leeres Dashboard.
  let current = reported;
  if (!current || current.windSpeedKmh == null) {
    const fallback = nearestObservation(forecast.flatMap((day) => day.hourly));
    if (fallback) {
      current = {
        ...fallback,
        // Temperatur und Zustand der Direktmeldung sind aktueller, falls da.
        temperatureC: reported?.temperatureC ?? fallback.temperatureC,
        condition: reported?.condition ?? fallback.condition,
      };
    }
  }

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
