import { NextRequest, NextResponse } from "next/server";
import { createClubEvent, isCalDavConfigured, listUpcomingEvents } from "@/lib/caldav";
import type { CalendarApiResponse, CreateEventInput } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!isCalDavConfigured()) {
    const response: CalendarApiResponse = {
      configured: false,
      events: [],
      message:
        "iCloud-Kalender ist noch nicht verbunden. Bitte ICLOUD_USERNAME und ICLOUD_APP_PASSWORD als Umgebungsvariablen setzen.",
    };
    return NextResponse.json(response);
  }

  try {
    const events = await listUpcomingEvents();
    const response: CalendarApiResponse = { configured: true, events };
    return NextResponse.json(response);
  } catch (error) {
    console.error("iCloud-Kalender konnte nicht geladen werden:", error);
    return NextResponse.json(
      {
        configured: true,
        events: [],
        message: "Kalender-Termine konnten nicht geladen werden.",
      } satisfies CalendarApiResponse,
      { status: 502 },
    );
  }
}

export async function POST(request: NextRequest) {
  if (!isCalDavConfigured()) {
    return NextResponse.json(
      {
        configured: false,
        events: [],
        message:
          "iCloud-Kalender ist noch nicht verbunden. Bitte ICLOUD_USERNAME und ICLOUD_APP_PASSWORD als Umgebungsvariablen setzen.",
      } satisfies CalendarApiResponse,
      { status: 501 },
    );
  }

  let body: CreateEventInput;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger Request-Body." }, { status: 400 });
  }

  if (!body.summary || !body.start || !body.end) {
    return NextResponse.json(
      { error: "summary, start und end sind erforderlich." },
      { status: 400 },
    );
  }

  try {
    const event = await createClubEvent(body);
    return NextResponse.json({ event }, { status: 201 });
  } catch (error) {
    console.error("Termin konnte nicht angelegt werden:", error);
    return NextResponse.json(
      { error: "Termin konnte nicht im iCloud-Kalender angelegt werden." },
      { status: 502 },
    );
  }
}
