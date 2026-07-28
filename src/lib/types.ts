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
  hourly: WindObservation[];
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
  fetchedAt: string;
}

export interface SailingClub {
  id: string;
  name: string;
  lat: number;
  lon: number;
  description: string;
  website?: string;
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
