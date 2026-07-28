"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { CalendarApiResponse, ClubCalendarEvent } from "@/lib/types";
import { toLocalDateKey } from "@/lib/format";

interface CalendarContextValue {
  configured: boolean;
  /** Nur ein CalDAV-Zugang erlaubt das Anlegen von Terminen. */
  canWrite: boolean;
  loading: boolean;
  events: ClubCalendarEvent[];
  message?: string;
  /** Termine je Kalendertag (YYYY-MM-DD), inkl. mehrtägiger Einträge. */
  eventsByDate: Map<string, ClubCalendarEvent[]>;
  reload: () => Promise<void>;
}

const CalendarContext = createContext<CalendarContextValue | null>(null);

export function useCalendar(): CalendarContextValue {
  const ctx = useContext(CalendarContext);
  if (!ctx) {
    throw new Error("useCalendar muss innerhalb von <CalendarProvider> genutzt werden.");
  }
  return ctx;
}

/**
 * Ordnet jeden Termin allen Tagen zu, die er berührt — ein Termin von
 * Samstag 18:00 bis Sonntag 11:00 blockiert beide Tage.
 */
function buildEventsByDate(
  events: ClubCalendarEvent[],
): Map<string, ClubCalendarEvent[]> {
  const map = new Map<string, ClubCalendarEvent[]>();

  for (const event of events) {
    const start = new Date(event.start);
    const end = new Date(event.end);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) continue;

    const cursor = new Date(start);
    cursor.setHours(0, 0, 0, 0);

    // Endet ein Termin exakt um Mitternacht, gehört der letzte Tag nicht dazu.
    const lastDay = new Date(end);
    const endsAtMidnight =
      end.getHours() === 0 && end.getMinutes() === 0 && end.getSeconds() === 0;
    if (endsAtMidnight) lastDay.setDate(lastDay.getDate() - 1);
    lastDay.setHours(0, 0, 0, 0);

    // Sicherheitsnetz gegen fehlerhafte Termine mit extremer Dauer.
    let guard = 0;
    while (cursor <= lastDay && guard < 400) {
      const key = toLocalDateKey(cursor);
      const list = map.get(key);
      if (list) list.push(event);
      else map.set(key, [event]);
      cursor.setDate(cursor.getDate() + 1);
      guard++;
    }
  }

  return map;
}

export default function CalendarProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [state, setState] = useState<CalendarApiResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    try {
      const res = await fetch("/api/calendar");
      const data: CalendarApiResponse = await res.json();
      setState(data);
    } catch {
      setState({
        configured: false,
        canWrite: false,
        source: "none",
        events: [],
        message: "Kalender konnte nicht geladen werden.",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initialer Abruf beim Mounten
    void reload();
  }, [reload]);

  const value = useMemo<CalendarContextValue>(() => {
    const events = state?.events ?? [];
    return {
      configured: state?.configured ?? false,
      canWrite: state?.canWrite ?? false,
      loading,
      events,
      message: state?.message,
      eventsByDate: buildEventsByDate(events),
      reload,
    };
  }, [state, loading, reload]);

  return (
    <CalendarContext.Provider value={value}>{children}</CalendarContext.Provider>
  );
}
