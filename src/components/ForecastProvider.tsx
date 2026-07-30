"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
} from "react";
import { DEFAULT_SAILING_WINDOW, summariseDay } from "@/lib/scoring";
import { AMMERSEE_LOCATION } from "@/lib/locations";
import { daylightHours } from "@/lib/sun";
import type { DailyForecast, SailingWindow } from "@/lib/types";

const STORAGE_KEY = "segelapp-sailing-window";

/** Äusserste zulässige Werte einer gespeicherten Auswahl. */
export const WINDOW_BOUNDS = { min: 0, max: 24 };
/** Kürzeste sinnvolle Spanne — darunter gibt es kein 3-Stunden-Fenster. */
export const MIN_WINDOW_HOURS = 3;

interface ForecastContextValue {
  window: SailingWindow;
  setWindow: (window: SailingWindow) => void;
  resetWindow: () => void;
  isCustomWindow: boolean;
  forecast: DailyForecast[];
  bestDayIndex: number | null;
  bestDay: DailyForecast | null;
}

const ForecastContext = createContext<ForecastContextValue | null>(null);

export function useForecast(): ForecastContextValue {
  const ctx = useContext(ForecastContext);
  if (!ctx) {
    throw new Error("useForecast muss innerhalb von <ForecastProvider> genutzt werden.");
  }
  return ctx;
}

function isValid(value: unknown): value is SailingWindow {
  if (!value || typeof value !== "object") return false;
  const w = value as Partial<SailingWindow>;
  return (
    typeof w.startHour === "number" &&
    typeof w.endHour === "number" &&
    w.startHour >= WINDOW_BOUNDS.min &&
    w.endHour <= WINDOW_BOUNDS.max &&
    w.endHour - w.startHour >= MIN_WINDOW_HOURS
  );
}

/*
 * Die Auswahl liegt im localStorage und wird als externer Speicher gelesen.
 * Ein Umweg über React-State müsste sie in einem Effect nachladen — das
 * erzeugt einen zusätzlichen Renderdurchgang und kurz die falsche Anzeige.
 *
 * useSyncExternalStore verlangt, dass der Schnappschuss bei unveränderten
 * Daten identisch bleibt, sonst rendert es endlos. Deshalb der Zwischenspeicher.
 */
let cachedRaw: string | null = null;
let cachedWindow: SailingWindow = DEFAULT_SAILING_WINDOW;

function getSnapshot(): SailingWindow {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    return cachedWindow;
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    let parsed: unknown = null;
    try {
      parsed = raw ? JSON.parse(raw) : null;
    } catch {
      parsed = null;
    }
    cachedWindow = isValid(parsed) ? parsed : DEFAULT_SAILING_WINDOW;
  }
  return cachedWindow;
}

const CHANGE_EVENT = "segelapp:sailing-window";

function subscribe(onChange: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export default function ForecastProvider({
  initialForecast,
  children,
}: {
  /** Vom Server mit der Vorgabezeit berechnet. */
  initialForecast: DailyForecast[];
  children: React.ReactNode;
}) {
  const sailingWindow = useSyncExternalStore<SailingWindow>(
    subscribe,
    getSnapshot,
    () => DEFAULT_SAILING_WINDOW,
  );

  const setWindow = useCallback((next: SailingWindow) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Privater Modus: Auswahl gilt dann nur für diese Sitzung.
      cachedRaw = "__memory__";
      cachedWindow = next;
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);

  const resetWindow = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      cachedRaw = null;
      cachedWindow = DEFAULT_SAILING_WINDOW;
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);

  /**
   * Auf das Tageslicht begrenzen. Eine im Sommer gespeicherte Auswahl von
   * 9 bis 20 Uhr wäre im Winter zur Hälfte Nacht — dann würde die Bewertung
   * Stunden einbeziehen, in denen niemand segelt.
   */
  const effectiveWindow = useMemo<SailingWindow>(() => {
    const day = initialForecast[0]?.date;
    const { firstHour, lastHour } = daylightHours(
      day ? new Date(day) : new Date(),
      AMMERSEE_LOCATION.lat,
      AMMERSEE_LOCATION.lon,
    );
    const min = Math.max(WINDOW_BOUNDS.min, firstHour);
    const max = Math.min(WINDOW_BOUNDS.max, lastHour);
    if (max - min < MIN_WINDOW_HOURS) return { startHour: min, endHour: max };

    const start = Math.min(Math.max(sailingWindow.startHour, min), max - MIN_WINDOW_HOURS);
    const end = Math.max(Math.min(sailingWindow.endHour, max), start + MIN_WINDOW_HOURS);
    return { startHour: start, endHour: end };
  }, [initialForecast, sailingWindow]);

  const isCustomWindow =
    effectiveWindow.startHour !== DEFAULT_SAILING_WINDOW.startHour ||
    effectiveWindow.endHour !== DEFAULT_SAILING_WINDOW.endHour;

  const forecast = useMemo(() => {
    // Ohne Abweichung von der Vorgabe bleibt die Server-Berechnung stehen.
    if (!isCustomWindow) return initialForecast;
    return initialForecast
      .map((day) => summariseDay(day.date, day.hourly, effectiveWindow))
      .filter((day): day is DailyForecast => day !== null);
  }, [initialForecast, effectiveWindow, isCustomWindow]);

  const bestDayIndex = useMemo(() => {
    if (!forecast.length) return null;
    let best = 0;
    for (let i = 1; i < forecast.length; i++) {
      // Strikt größer: Bei gleichem Score bleibt der frühere Tag vorn.
      if (forecast[i].score > forecast[best].score) best = i;
    }
    return forecast[best].score > 0 ? best : null;
  }, [forecast]);

  const value = useMemo<ForecastContextValue>(
    () => ({
      window: effectiveWindow,
      setWindow,
      resetWindow,
      isCustomWindow,
      forecast,
      bestDayIndex,
      bestDay: bestDayIndex != null ? forecast[bestDayIndex] : null,
    }),
    [effectiveWindow, setWindow, resetWindow, isCustomWindow, forecast, bestDayIndex],
  );

  return (
    <ForecastContext.Provider value={value}>{children}</ForecastContext.Provider>
  );
}
