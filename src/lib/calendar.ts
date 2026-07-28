import { isCalDavConfigured, listUpcomingEvents } from "./caldav";
import { fetchPublicCalendarEvents, isPublicCalendarConfigured } from "./publicCalendar";
import type { CalendarSource, ClubCalendarEvent } from "./types";

/**
 * Welche Kalenderquelle ist eingerichtet?
 *
 * CalDAV hat Vorrang: Sind Zugangsdaten hinterlegt, kann die Seite lesen
 * *und* schreiben. Ein öffentlicher Feed ist die einfachere Alternative, aber
 * nur lesbar — Apple veröffentlicht dabei eine ICS-Datei, die keine neuen
 * Termine annimmt.
 */
export function calendarSource(): CalendarSource {
  if (isCalDavConfigured()) return "caldav";
  if (isPublicCalendarConfigured()) return "public";
  return "none";
}

export function canCreateEvents(): boolean {
  return calendarSource() === "caldav";
}

export async function listEvents(windowDays = 60): Promise<ClubCalendarEvent[]> {
  switch (calendarSource()) {
    case "caldav":
      return listUpcomingEvents(windowDays);
    case "public":
      return fetchPublicCalendarEvents(windowDays);
    default:
      return [];
  }
}

export const NOT_CONFIGURED_MESSAGE =
  "Kalender ist noch nicht verbunden. Entweder ICLOUD_PUBLIC_CALENDAR_URL für einen öffentlich geteilten Kalender setzen (nur lesen) oder ICLOUD_USERNAME und ICLOUD_APP_PASSWORD für vollen Zugriff mit Schreibrechten.";

export const READ_ONLY_MESSAGE =
  "Dieser Kalender ist über eine öffentliche Freigabe eingebunden und damit schreibgeschützt. Für das Anlegen von Terminen werden ICLOUD_USERNAME und ICLOUD_APP_PASSWORD benötigt.";
