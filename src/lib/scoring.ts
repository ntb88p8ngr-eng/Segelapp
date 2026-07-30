import type {
  BestWindow,
  DailyForecast,
  SailingRating,
  SailingWindow,
  SevereWeatherRisk,
  SkyCover,
  WindObservation,
} from "./types";
import { formatKnots } from "./format";

/**
 * Reine Rechenlogik ohne Netzzugriff — bewusst getrennt von weather.ts,
 * damit der Browser dieselben Formeln benutzen kann. Verschiebt jemand den
 * Regler für die Segelzeit, wird direkt neu gerechnet statt neu geladen.
 */

// Böen-Schwellen nach Beaufort (km/h): ab Bft 6 wird es für kleinere Boote
// unangenehm, ab Bft 8 (Sturmböen) sollte nicht mehr ausgelaufen werden.
export const GUST_STRONG_KMH = 39;
export const GUST_STORM_KMH = 62;

/** Ab hier wird ein Zeitfenster als unangenehm heiss eingestuft. */
export const HOT_THRESHOLD_C = 28;

/** Länge des empfohlenen Zeitfensters in Stunden. */
export const WINDOW_HOURS = 3;

/** Vorgabe der Segelzeit: 9 bis 20 Uhr, Ende ausschliesslich. */
export const DEFAULT_SAILING_WINDOW: SailingWindow = { startHour: 9, endHour: 20 };

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
export function windScore(avgKmh: number): number {
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

function numbers(
  hours: WindObservation[],
  pick: (h: WindObservation) => number | null,
): number[] {
  const out: number[] = [];
  for (const h of hours) {
    const value = pick(h);
    if (value != null) out.push(value);
  }
  return out;
}

const mean = (values: number[]) =>
  values.reduce((a, b) => a + b, 0) / values.length;

/** Stunde einer Beobachtung in Ortszeit. */
export function hourOf(observation: WindObservation): number {
  return new Date(observation.timestamp).getHours();
}

export function scoreHours(hours: WindObservation[]): {
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
  const speeds = numbers(hours, (h) => h.windSpeedKmh);
  const gusts = numbers(hours, (h) => h.windGustKmh);
  const precip = hours.reduce((sum, h) => sum + (h.precipitationMm ?? 0), 0);
  const hasThunderstorm = hours.some((h) => h.condition === "thunderstorm");

  if (!speeds.length) {
    return { score: 0, rawScore: Number.NEGATIVE_INFINITY, rating: "schlecht" };
  }

  const avg = mean(speeds);
  const gustMax = gusts.length ? Math.max(...gusts) : avg;

  let raw = windScore(avg);

  // Böigkeit: gleitender Abzug statt Stufe, damit unruhige Tage auch
  // untereinander unterscheidbar bleiben.
  const gustSpread = Math.max(0, gustMax - avg);
  if (gustSpread > 15) raw -= Math.min((gustSpread - 15) * 0.8, 20);
  if (gustMax >= GUST_STORM_KMH) raw -= 25;

  raw -= Math.min(precip * 4, 30);

  // Gewitter ist ein Ausschlusskriterium, kein Abzug.
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

export function dominantDirection(hours: WindObservation[]): number {
  const dirs = numbers(hours, (h) => h.windDirectionDeg);
  if (!dirs.length) return 0;
  // Vektorsumme, damit 350° und 10° zu 0° mitteln und nicht zu 180°.
  const rad = dirs.map((d) => (d * Math.PI) / 180);
  const sinSum = rad.reduce((s, r) => s + Math.sin(r), 0);
  const cosSum = rad.reduce((s, r) => s + Math.cos(r), 0);
  return ((Math.atan2(sinSum, cosSum) * 180) / Math.PI + 360) % 360;
}

/** Bewölkung eines Zeitraums in eine grobe Einstufung übersetzen. */
export function skyCover(hours: WindObservation[]): SkyCover | null {
  const cover = numbers(hours, (h) => h.cloudCoverPercent);
  if (!cover.length) return null;
  const avg = mean(cover);
  if (avg < 35) return "sonnig";
  if (avg < 75) return "wechselnd";
  return "bedeckt";
}

function buildWindow(slice: WindObservation[]): BestWindow {
  const speeds = numbers(slice, (h) => h.windSpeedKmh);
  const gusts = numbers(slice, (h) => h.windGustKmh);
  const temps = numbers(slice, (h) => h.temperatureC);
  const gustMax = gusts.length ? Math.max(...gusts) : 0;

  return {
    startHour: hourOf(slice[0]),
    endHour: hourOf(slice[slice.length - 1]) + 1,
    windSpeedAvgKmh: Math.round(mean(speeds) * 10) / 10,
    windGustMaxKmh: Math.round(gustMax * 10) / 10,
    windDirectionDeg: Math.round(dominantDirection(slice)),
    temperatureC: temps.length ? Math.round(mean(temps)) : null,
    skyCover: skyCover(slice),
    score: scoreHours(slice).score,
  };
}

/** Alle zusammenhängenden Blöcke der gewünschten Länge. */
function candidateWindows(hours: WindObservation[]): WindObservation[][] {
  const usable = hours
    .filter((h) => h.windSpeedKmh != null)
    .slice()
    .sort((a, b) => hourOf(a) - hourOf(b));

  const blocks: WindObservation[][] = [];
  for (let i = 0; i + WINDOW_HOURS <= usable.length; i++) {
    const slice = usable.slice(i, i + WINDOW_HOURS);
    const contiguous = slice.every(
      (entry, idx) => idx === 0 || hourOf(entry) === hourOf(slice[idx - 1]) + 1,
    );
    if (contiguous) blocks.push(slice);
  }
  return blocks;
}

/**
 * Bestes zusammenhängendes Zeitfenster. Verglichen wird über den ungekappten
 * Rohwert: An zu windigen Tagen fallen sonst alle Fenster auf 0 und das
 * früheste gewönne willkürlich — über den Rohwert setzt sich dort das
 * ruhigste durch.
 */
export function findBestWindow(hours: WindObservation[]): BestWindow | null {
  let best: BestWindow | null = null;
  let bestRaw = Number.NEGATIVE_INFINITY;
  let bestGust = Number.POSITIVE_INFINITY;

  for (const slice of candidateWindows(hours)) {
    const { rawScore } = scoreHours(slice);
    const gusts = numbers(slice, (h) => h.windGustKmh);
    const gustMax = gusts.length ? Math.max(...gusts) : 0;

    if (best) {
      if (rawScore < bestRaw) continue;
      // Bei echtem Gleichstand entscheidet die ruhigere Böenspitze.
      if (rawScore === bestRaw && gustMax >= bestGust) continue;
    }

    bestRaw = rawScore;
    bestGust = gustMax;
    best = buildWindow(slice);
  }

  return best;
}

/**
 * Kühlere Ausweichzeit für heisse Tage. Gesucht wird das kühlste Fenster, das
 * seglerisch noch brauchbar ist — Hitze soll nicht durch Flaute ersetzt
 * werden. Nur ein spürbarer Unterschied wird vorgeschlagen.
 */
export function findCoolerWindow(
  hours: WindObservation[],
  reference: BestWindow | null,
): BestWindow | null {
  if (!reference?.temperatureC || reference.temperatureC <= HOT_THRESHOLD_C) {
    return null;
  }

  const MIN_USABLE_SCORE = 45;
  const MIN_DIFFERENCE_C = 2;

  let cooler: BestWindow | null = null;

  for (const slice of candidateWindows(hours)) {
    const temps = numbers(slice, (h) => h.temperatureC);
    if (!temps.length) continue;

    const window = buildWindow(slice);
    if (window.temperatureC == null) continue;
    if (window.score < MIN_USABLE_SCORE) continue;
    if (window.startHour === reference.startHour) continue;
    if (reference.temperatureC - window.temperatureC < MIN_DIFFERENCE_C) continue;

    if (
      !cooler ||
      window.temperatureC < cooler.temperatureC! ||
      // Gleich kühl: das windigere Fenster ist das bessere Angebot.
      (window.temperatureC === cooler.temperatureC &&
        window.windSpeedAvgKmh > cooler.windSpeedAvgKmh)
    ) {
      cooler = window;
    }
  }

  return cooler;
}

/**
 * Unwetterlage des ganzen Tages — nicht nur der Segelstunden. Ein Gewitter am
 * Abend ist für die Planung ebenso relevant.
 */
export function buildSevereRisk(
  allHours: WindObservation[],
): SevereWeatherRisk | null {
  const hasThunderstorm = allHours.some((h) => h.condition === "thunderstorm");
  const gusts = numbers(allHours, (h) => h.windGustKmh);
  const dayGustMax = gusts.length ? Math.max(...gusts) : 0;
  const hasStormGusts = dayGustMax >= GUST_STORM_KMH;

  if (!hasThunderstorm && !hasStormGusts) return null;

  const parts: string[] = [];
  if (hasThunderstorm) parts.push("Gewitter");
  if (hasStormGusts) parts.push(`Sturmböen bis ${formatKnots(dayGustMax)}`);

  return { hasThunderstorm, hasStormGusts, reason: parts.join(" · ") };
}

export function hoursWithin(
  allHours: WindObservation[],
  window: SailingWindow,
): WindObservation[] {
  return allHours.filter((h) => {
    const hour = hourOf(h);
    return hour >= window.startHour && hour < window.endHour;
  });
}

/**
 * Fasst einen Tag für die gewählte Segelzeit zusammen. Wird sowohl beim
 * Rendern auf dem Server als auch nach dem Verschieben des Reglers im
 * Browser aufgerufen.
 */
export function summariseDay(
  date: string,
  allHours: WindObservation[],
  window: SailingWindow = DEFAULT_SAILING_WINDOW,
): DailyForecast | null {
  const inWindow = hoursWithin(allHours, window);
  const relevant = inWindow.length ? inWindow : allHours;

  const speeds = numbers(relevant, (h) => h.windSpeedKmh);
  if (!speeds.length) return null;

  const gusts = numbers(relevant, (h) => h.windGustKmh);
  const windowTemps = numbers(relevant, (h) => h.temperatureC);
  const dayTemps = numbers(allHours, (h) => h.temperatureC);
  const precipSum = allHours.reduce((s, h) => s + (h.precipitationMm ?? 0), 0);

  const { score, rating } = scoreHours(relevant);
  const bestWindow = findBestWindow(relevant);

  return {
    date,
    windSpeedAvgKmh: Math.round(mean(speeds) * 10) / 10,
    windSpeedMaxKmh: Math.round(Math.max(...speeds) * 10) / 10,
    windGustMaxKmh: gusts.length ? Math.round(Math.max(...gusts) * 10) / 10 : 0,
    windDirectionDeg: Math.round(dominantDirection(relevant)),
    temperatureMaxC: dayTemps.length ? Math.round(Math.max(...dayTemps)) : 0,
    temperatureAvgC: windowTemps.length ? Math.round(mean(windowTemps)) : null,
    skyCover: skyCover(relevant),
    precipitationSumMm: Math.round(precipSum * 10) / 10,
    condition:
      relevant.find((h) => h.condition)?.condition ?? allHours[0]?.condition ?? null,
    score,
    rating,
    bestWindow,
    coolerWindow: findCoolerWindow(relevant, bestWindow),
    severeRisk: buildSevereRisk(allHours),
    hourly: allHours,
  };
}
