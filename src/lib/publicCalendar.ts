import { parseIcsEvents } from "./ics";
import type { ClubCalendarEvent } from "./types";

/**
 * Ein öffentlich geteilter iCloud-Kalender ist ein veröffentlichter
 * ICS-Feed, kein CalDAV-Zugang: Er lässt sich lesen, aber nicht beschreiben.
 * Apple gibt die Adresse als "webcal://p??-caldav.icloud.com/published/2/..."
 * heraus.
 */
export function isPublicCalendarConfigured(): boolean {
  return Boolean(process.env.ICLOUD_PUBLIC_CALENDAR_URL?.trim());
}

/**
 * webcal:// ist kein eigenes Protokoll, sondern die Einladung an das
 * Betriebssystem, eine https-Adresse zu abonnieren. Zum Abrufen wird daraus
 * wieder https.
 */
export function normaliseFeedUrl(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.toLowerCase().startsWith("webcal://")) {
    return `https://${trimmed.slice("webcal://".length)}`;
  }
  return trimmed;
}

function feedUrl(): URL {
  const configured = process.env.ICLOUD_PUBLIC_CALENDAR_URL?.trim();
  if (!configured) {
    throw new Error("ICLOUD_PUBLIC_CALENDAR_URL ist nicht gesetzt.");
  }

  let url: URL;
  try {
    url = new URL(normaliseFeedUrl(configured));
  } catch {
    throw new Error(
      "ICLOUD_PUBLIC_CALENDAR_URL ist keine gültige Adresse. Erwartet wird eine webcal:// oder https:// Adresse.",
    );
  }

  // Andere Schemata (file:, data: …) würden den Server dazu bringen, lokale
  // Ressourcen zu lesen.
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error(
      `Nicht unterstütztes Protokoll "${url.protocol}" in ICLOUD_PUBLIC_CALENDAR_URL.`,
    );
  }

  return url;
}

export async function fetchPublicCalendarEvents(
  windowDays = 60,
): Promise<ClubCalendarEvent[]> {
  const url = feedUrl();

  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Accept: "text/calendar, text/plain;q=0.9, */*;q=0.8" },
      // Der Feed ändert sich selten; fünf Minuten reichen und schonen Apples
      // Server bei vielen Besuchern.
      next: { revalidate: 300 },
    });
  } catch (error) {
    // "fetch failed" allein hilft beim Einrichten niemandem — die eigentliche
    // Ursache steckt in cause und gehört in die Meldung.
    const cause = error instanceof Error && error.cause instanceof Error
      ? error.cause.message
      : error instanceof Error
        ? error.message
        : String(error);
    throw new Error(
      `Kalender-Feed ${url.origin} ist nicht erreichbar: ${cause}`,
    );
  }

  if (!response.ok) {
    throw new Error(
      `Kalender-Feed antwortete mit ${response.status}. Ist der Kalender noch öffentlich freigegeben?`,
    );
  }

  const text = await response.text();
  if (!text.includes("BEGIN:VCALENDAR")) {
    throw new Error(
      "Die Adresse liefert keinen Kalender. Bitte die Freigabe-Adresse aus iCloud verwenden.",
    );
  }

  const from = new Date();
  const to = new Date(from);
  to.setDate(to.getDate() + windowDays);

  return parseIcsEvents(text, from, to);
}
