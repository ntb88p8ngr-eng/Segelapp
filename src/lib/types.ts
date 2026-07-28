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

/** Das windmäßig beste zusammenhängende Zeitfenster eines Tages. */
export interface BestWindow {
  /** Lokale Stunden, Ende exklusiv: 13/16 bedeutet 13–16 Uhr. */
  startHour: number;
  endHour: number;
  windSpeedAvgKmh: number;
  windGustMaxKmh: number;
  windDirectionDeg: number;
  score: number;
}

export interface DailyForecast {
  date: string;
  windSpeedAvgKmh: number;
  windSpeedMaxKmh: number;
  windGustMaxKmh: number;
  windDirectionDeg: number;
  temperatureMaxC: number;
  precipitationSumMm: number;
  condition: string | null;
  score: number;
  rating: SailingRating;
  bestWindow: BestWindow | null;
  hourly: WindObservation[];
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

export interface CalendarApiResponse {
  configured: boolean;
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
