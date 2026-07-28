import ICAL from "ical.js";
import type { ClubCalendarEvent } from "./types";

/**
 * Obergrenze je Serie. Eine unbegrenzte Serie (RRULE ohne UNTIL/COUNT) würde
 * den Iterator sonst bis ans Fenster­ende laufen lassen; die Grenze ist ein
 * Sicherheitsnetz gegen fehlerhafte Regeln.
 */
const MAX_OCCURRENCES_PER_SERIES = 400;

/**
 * Zeitzonen aus dem Kalender bekannt machen. Ohne die VTIMEZONE-Blöcke
 * rechnet ical.js benannte TZIDs wie "Europe/Berlin" nicht korrekt um.
 */
function registerTimezones(root: ICAL.Component): void {
  for (const vtz of root.getAllSubcomponents("vtimezone")) {
    const tzid = vtz.getFirstPropertyValue("tzid");
    if (typeof tzid === "string" && tzid && !ICAL.TimezoneService.has(tzid)) {
      try {
        ICAL.TimezoneService.register(vtz);
      } catch {
        // Defekte Zeitzonendefinition: lieber ohne weitermachen als alles
        // verwerfen — ical.js fällt dann auf UTC zurück.
      }
    }
  }
}

function toClubEvent(
  event: ICAL.Event,
  start: Date,
  end: Date,
  seriesUid: string,
  recurring: boolean,
): ClubCalendarEvent {
  return {
    // Wiederholungen teilen sich eine UID — für stabile, eindeutige Schlüssel
    // wird der Beginn angehängt.
    uid: recurring ? `${seriesUid}#${start.toISOString()}` : seriesUid,
    summary: event.summary || "Ohne Titel",
    description: event.description || undefined,
    location: event.location || undefined,
    start: start.toISOString(),
    end: end.toISOString(),
  };
}

/**
 * Liest einen iCalendar-Text und gibt alle Termine zurück, die das Fenster
 * [from, to] berühren. Serientermine werden dabei in ihre Einzeltermine
 * aufgelöst; abweichende Einzeltermine einer Serie (RECURRENCE-ID) ersetzen
 * automatisch die reguläre Wiederholung.
 */
export function parseIcsEvents(
  icsText: string,
  from: Date,
  to: Date,
): ClubCalendarEvent[] {
  let root: ICAL.Component;
  try {
    root = new ICAL.Component(ICAL.parse(icsText));
  } catch (error) {
    console.error("Kalenderdaten konnten nicht gelesen werden:", error);
    return [];
  }

  registerTimezones(root);

  const vevents = root.getAllSubcomponents("vevent");
  // Ausnahmen gehören zu ihrer Serie und dürfen nicht zusätzlich als
  // eigenständiger Termin auftauchen — ical.js verknüpft sie selbst, weil
  // alle Komponenten dieselbe Eltern-Komponente haben.
  const masters = vevents.filter((ve) => !ve.hasProperty("recurrence-id"));

  const events: ClubCalendarEvent[] = [];

  for (const component of masters) {
    let event: ICAL.Event;
    try {
      event = new ICAL.Event(component);
    } catch {
      continue;
    }
    if (!event.startDate) continue;

    const uid = event.uid || `${event.summary ?? "termin"}-${event.startDate}`;

    if (!event.isRecurring()) {
      const start = event.startDate.toJSDate();
      const end = event.endDate ? event.endDate.toJSDate() : start;
      if (end < from || start > to) continue;
      events.push(toClubEvent(event, start, end, uid, false));
      continue;
    }

    try {
      const iterator = event.iterator();
      let occurrence = iterator.next();
      let guard = 0;

      while (occurrence && guard < MAX_OCCURRENCES_PER_SERIES) {
        guard++;
        const details = event.getOccurrenceDetails(occurrence);
        const start = details.startDate.toJSDate();
        const end = details.endDate.toJSDate();

        // Der Iterator läuft chronologisch — hinter dem Fenster ist Schluss.
        if (start > to) break;
        if (end >= from) {
          events.push(toClubEvent(details.item, start, end, uid, true));
        }
        occurrence = iterator.next();
      }
    } catch (error) {
      console.error("Serientermin konnte nicht aufgelöst werden:", error);
    }
  }

  events.sort((a, b) => a.start.localeCompare(b.start));
  return events;
}
