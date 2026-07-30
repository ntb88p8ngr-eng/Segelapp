export interface WindObservation {
  timestamp: string;
  windSpeedKmh: number | null;
  windDirectionDeg: number | null;
  windGustKmh: number | null;
  temperatureC: number | null;
  condition: string | null;
  precipitationMm: number | null;
  cloudCoverPercent: number | null;
}

export type SailingRating =
  | "top"
  | "gut"
  | "maessig"
  | "wenig_wind"
  | "zu_stark"
  | "schlecht";

/**
 * Unwettergefahr eines Tages. Bewusst unabhängig vom Segel-Score: Ein Tag
 * kann windmäßig brauchbar sein und trotzdem eine Gewitterlage haben.
 */
export interface SevereWeatherRisk {
  hasThunderstorm: boolean;
  hasStormGusts: boolean;
  /** Kurzbegründung für die Anzeige, z. B. "Gewitter · Sturmböen bis 54 kn". */
  reason: string;
}

/** Grobe Einstufung der Bewölkung. */
export type SkyCover = "sonnig" | "wechselnd" | "bedeckt";

/**
 * Die Zeitspanne, in der überhaupt gesegelt wird. Über den Regler auf der
 * Seite einstellbar; Ende ausschliesslich (9/20 heisst 9 bis 20 Uhr).
 */
export interface SailingWindow {
  startHour: number;
  endHour: number;
}

/** Ein zusammenhängendes Zeitfenster eines Tages. */
export interface BestWindow {
  /** Lokale Stunden, Ende exklusiv: 13/16 bedeutet 13–16 Uhr. */
  startHour: number;
  endHour: number;
  windSpeedAvgKmh: number;
  windGustMaxKmh: number;
  windDirectionDeg: number;
  /** Mittlere Temperatur im Fenster. */
  temperatureC: number | null;
  skyCover: SkyCover | null;
  score: number;
}

export interface DailyForecast {
  date: string;
  windSpeedAvgKmh: number;
  windSpeedMaxKmh: number;
  windGustMaxKmh: number;
  windDirectionDeg: number;
  temperatureMaxC: number;
  /** Mittlere Temperatur über die gewählte Segelzeit. */
  temperatureAvgC: number | null;
  skyCover: SkyCover | null;
  precipitationSumMm: number;
  condition: string | null;
  score: number;
  rating: SailingRating;
  bestWindow: BestWindow | null;
  /** Kühlere Ausweichzeit, wenn das beste Fenster zu heiss wird. */
  coolerWindow: BestWindow | null;
  severeRisk: SevereWeatherRisk | null;
  hourly: WindObservation[];
}

/** Ein gemeinsam gepflegter Punkt auf der Karte. */
export interface Waypoint {
  id: string;
  name: string;
  lat: number;
  lon: number;
  createdAt: string;
}

/**
 * Woher die Zahlen kommen. Bright Sky wählt die Station selbst — erst mit
 * Name und Entfernung lässt sich beurteilen, wie gut sie den See abbildet.
 */
export interface WeatherStation {
  name: string;
  distanceKm: number | null;
  /** z. B. "synop", "current", "forecast" — Messung oder Vorhersagemodell. */
  observationType: string | null;
}

/** Messwert einer frei konfigurierten Wassertemperatur-Quelle. */
export interface WaterTemperature {
  celsius: number;
  measuredAt: string | null;
}

export type AlertSeverity = "warnung" | "hinweis";

export type AlertKind = "gewitter" | "boeen";

export interface WeatherAlert {
  id: string;
  kind: AlertKind;
  severity: AlertSeverity;
  title: string;
  description: string;
}

export interface WeatherResponse {
  location: {
    name: string;
    lat: number;
    lon: number;
  };
  source: string;
  current: WindObservation | null;
  forecast: DailyForecast[];
  bestDayIndex: number | null;
  alerts: WeatherAlert[];
  /** Station hinter den aktuellen Werten, sofern Bright Sky sie nennt. */
  station: WeatherStation | null;
  /** Nur gesetzt, wenn eine Quelle konfiguriert ist. */
  waterTemperature: WaterTemperature | null;
  fetchedAt: string;
}

export interface ClubCalendarEvent {
  uid: string;
  summary: string;
  description?: string;
  location?: string;
  start: string;
  end: string;
}

/** "caldav" = voller Zugriff, "public" = öffentlicher Feed (nur lesen). */
export type CalendarSource = "caldav" | "public" | "none";

export interface CalendarApiResponse {
  configured: boolean;
  /** Nur mit CalDAV-Zugangsdaten lassen sich Termine anlegen. */
  canWrite: boolean;
  source: CalendarSource;
  events: ClubCalendarEvent[];
  message?: string;
}

export interface CreateEventInput {
  summary: string;
  description?: string;
  location?: string;
  start: string;
  end: string;
}
