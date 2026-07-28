import { AMMERSEE_LOCATION } from "./locations";
import type {
  DailyForecast,
  SailingRating,
  WeatherResponse,
  WindObservation,
} from "./types";

const BRIGHTSKY_BASE = "https://api.brightsky.dev";

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

async function fetchJson(url: string) {
  if (process.env.MOCK_WEATHER_FOR_SCREENSHOT) {
    if (url.includes("current_weather")) {
      return {
        weather: {
          timestamp: new Date().toISOString(),
          wind_speed: 18,
          wind_direction: 250,
          wind_gust_speed: 29,
          temperature: 22,
          condition: "dry",
          precipitation: 0,
          cloud_cover: 30,
        },
      };
    }
    const now = new Date();
    const records = [];
    for (let d = 0; d < 6; d++) {
      for (let h = 8; h < 20; h++) {
        const t = new Date(now);
        t.setDate(t.getDate() + d);
        t.setHours(h, 0, 0, 0);
        records.push({
          timestamp: t.toISOString(),
          wind_speed: 8 + d * 4 + Math.sin(h) * 3,
          wind_direction: 220 + d * 10,
          wind_gust_speed: 14 + d * 5,
          temperature: 20 + d,
          condition: d === 2 ? "rain" : "dry",
          precipitation: d === 2 ? 2 : 0,
          cloud_cover: 30,
        });
      }
    }
    return { weather: records };
  }
  const res = await fetch(url, { next: { revalidate: 600 } });
  if (!res.ok) {
    throw new Error(`Bright Sky Anfrage fehlgeschlagen (${res.status})`);
  }
  return res.json();
}

export async function fetchCurrentWeather(): Promise<WindObservation | null> {
  const url = `${BRIGHTSKY_BASE}/current_weather?lat=${AMMERSEE_LOCATION.lat}&lon=${AMMERSEE_LOCATION.lon}&units=dwd`;
  const data = await fetchJson(url);
  if (!data?.weather) return null;
  return toObservation(data.weather as BrightSkyRecord);
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Sailing suitability score (0-100) for a set of hourly wind observations
 * covering the "sailing window" of a day. Peaks around 12-28 km/h
 * (~6.5-15 kn) mean wind, penalizes flat calm, gusty/stormy conditions,
 * heavy rain and thunderstorms.
 */
function scoreDay(
  hours: WindObservation[],
): { score: number; rating: SailingRating } {
  const speeds = hours
    .map((h) => h.windSpeedKmh)
    .filter((v): v is number => v != null);
  const gusts = hours
    .map((h) => h.windGustKmh)
    .filter((v): v is number => v != null);
  const precip = hours.reduce((sum, h) => sum + (h.precipitationMm ?? 0), 0);
  const hasThunderstorm = hours.some((h) => h.condition === "thunderstorm");

  if (speeds.length === 0) {
    return { score: 0, rating: "schlecht" };
  }

  const avg = speeds.reduce((a, b) => a + b, 0) / speeds.length;
  const gustMax = gusts.length ? Math.max(...gusts) : avg;

  let score: number;
  if (avg < 5) score = 10;
  else if (avg < 9) score = 10 + ((avg - 5) / 4) * 50;
  else if (avg < 12) score = 60 + ((avg - 9) / 3) * 30;
  else if (avg <= 28) score = 100;
  else if (avg <= 38) score = 100 - ((avg - 28) / 10) * 40;
  else if (avg <= 50) score = 60 - ((avg - 38) / 12) * 40;
  else score = 5;

  if (gustMax - avg > 25) score -= 10;
  if (gustMax > 60) score -= 20;
  score -= Math.min(precip * 4, 30);
  if (hasThunderstorm) score = 0;

  score = Math.max(0, Math.min(100, Math.round(score)));

  let rating: SailingRating;
  if (hasThunderstorm) rating = "schlecht";
  else if (avg < 7) rating = "wenig_wind";
  else if (avg > 40 || gustMax > 65) rating = "zu_stark";
  else if (score >= 80) rating = "top";
  else if (score >= 60) rating = "gut";
  else if (score >= 40) rating = "maessig";
  else rating = "schlecht";

  return { score, rating };
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
      hourly: hours,
    });
  }

  result.sort((a, b) => a.date.localeCompare(b.date));
  return result;
}

export async function getWeatherOverview(): Promise<WeatherResponse> {
  const [current, forecast] = await Promise.all([
    fetchCurrentWeather().catch(() => null),
    fetchForecast(6).catch(() => []),
  ]);

  let bestDayIndex: number | null = null;
  if (forecast.length) {
    let bestIdx = 0;
    for (let i = 1; i < forecast.length; i++) {
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
    fetchedAt: new Date().toISOString(),
  };
}
