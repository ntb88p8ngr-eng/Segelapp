import { DAVClient, type DAVCalendar } from "tsdav";
import ICAL from "ical.js";
import ical from "ical-generator";
import { v4 as uuidv4 } from "uuid";
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

function parseEvent(icsData: string, url: string): ClubCalendarEvent | null {
  try {
    const jcalData = ICAL.parse(icsData);
    const comp = new ICAL.Component(jcalData);
    const vevent = comp.getFirstSubcomponent("vevent");
    if (!vevent) return null;
    const event = new ICAL.Event(vevent);
    return {
      uid: event.uid || url,
      summary: event.summary || "Ohne Titel",
      description: event.description || undefined,
      location: event.location || undefined,
      start: event.startDate.toJSDate().toISOString(),
      end: event.endDate.toJSDate().toISOString(),
    };
  } catch (error) {
    console.error("ICS Event konnte nicht geparst werden:", error);
    return null;
  }
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

  const events = objects
    .map((obj) => (obj.data ? parseEvent(obj.data, obj.url) : null))
    .filter((e): e is ClubCalendarEvent => e !== null)
    .sort((a, b) => a.start.localeCompare(b.start));

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
