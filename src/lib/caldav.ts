import { DAVClient, type DAVCalendar } from "tsdav";
import ical from "ical-generator";
import { v4 as uuidv4 } from "uuid";
import { parseIcsEvents } from "./ics";
import type { ClubCalendarEvent, CreateEventInput } from "./types";

const ICLOUD_SERVER_URL = "https://caldav.icloud.com";

export function isCalDavConfigured(): boolean {
  return Boolean(
    process.env.ICLOUD_USERNAME && process.env.ICLOUD_APP_PASSWORD,
  );
}

async function getClient(): Promise<DAVClient> {
  const client = new DAVClient({
    serverUrl: ICLOUD_SERVER_URL,
    credentials: {
      username: process.env.ICLOUD_USERNAME!,
      password: process.env.ICLOUD_APP_PASSWORD!,
    },
    authMethod: "Basic",
    defaultAccountType: "caldav",
  });
  await client.login();
  return client;
}

async function getTargetCalendar(client: DAVClient): Promise<DAVCalendar> {
  const calendars = await client.fetchCalendars();
  const writable = calendars.filter((c) =>
    c.components?.includes("VEVENT"),
  );
  const configuredName = process.env.ICLOUD_CALENDAR_NAME;
  const target = configuredName
    ? writable.find(
        (c) =>
          typeof c.displayName === "string" &&
          c.displayName.toLowerCase() === configuredName.toLowerCase(),
      )
    : undefined;

  const calendar = target ?? writable[0];
  if (!calendar) {
    throw new Error(
      "Kein beschreibbarer iCloud-Kalender gefunden. Bitte ICLOUD_CALENDAR_NAME prüfen.",
    );
  }
  return calendar;
}

export async function listUpcomingEvents(
  windowDays = 60,
): Promise<ClubCalendarEvent[]> {
  const client = await getClient();
  const calendar = await getTargetCalendar(client);

  const now = new Date();
  const end = new Date(now);
  end.setDate(end.getDate() + windowDays);

  const objects = await client.fetchCalendarObjects({
    calendar,
    timeRange: {
      start: now.toISOString(),
      end: end.toISOString(),
    },
  });

  // Der Server liefert die Serie als Ganzes, nicht die Einzeltermine —
  // aufgelöst wird sie hier, sonst erschiene ein wöchentliches Training nur
  // ein einziges Mal.
  const events = objects.flatMap((obj) =>
    obj.data ? parseIcsEvents(obj.data, now, end) : [],
  );

  events.sort((a, b) => a.start.localeCompare(b.start));
  return events;
}

export async function createClubEvent(
  input: CreateEventInput,
): Promise<ClubCalendarEvent> {
  const client = await getClient();
  const calendar = await getTargetCalendar(client);

  const uid = `${uuidv4()}@segelgemeinschaft-ammersee`;
  const cal = ical({ name: "Segelgemeinschaft Ammersee" });
  cal.createEvent({
    id: uid,
    start: new Date(input.start),
    end: new Date(input.end),
    summary: input.summary,
    description: input.description,
    location: input.location,
  });

  await client.createCalendarObject({
    calendar,
    filename: `${uid}.ics`,
    iCalString: cal.toString(),
  });

  return {
    uid,
    summary: input.summary,
    description: input.description,
    location: input.location,
    start: new Date(input.start).toISOString(),
    end: new Date(input.end).toISOString(),
  };
}
