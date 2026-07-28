import { NextRequest, NextResponse } from "next/server";
import { createClubEvent } from "@/lib/caldav";
import {
  NOT_CONFIGURED_MESSAGE,
  READ_ONLY_MESSAGE,
  calendarSource,
  listEvents,
} from "@/lib/calendar";
import type { CalendarApiResponse, CreateEventInput } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const source = calendarSource();

  if (source === "none") {
    return NextResponse.json({
      configured: false,
      canWrite: false,
      source,
      events: [],
      message: NOT_CONFIGURED_MESSAGE,
    } satisfies CalendarApiResponse);
  }

  try {
    const events = await listEvents();
    return NextResponse.json({
      configured: true,
      canWrite: source === "caldav",
      source,
      events,
    } satisfies CalendarApiResponse);
  } catch (error) {
    console.error("Kalender konnte nicht geladen werden:", error);
    return NextResponse.json(
      {
        configured: true,
        canWrite: source === "caldav",
        source,
        events: [],
        message:
          error instanceof Error
            ? error.message
            : "Kalender-Termine konnten nicht geladen werden.",
      } satisfies CalendarApiResponse,
      { status: 502 },
    );
  }
}

export async function POST(request: NextRequest) {
  const source = calendarSource();

  // Ein öffentlicher Feed ist eine ausgelieferte Datei — er nimmt keine
  // Termine entgegen. Das wird getrennt vom "gar nicht eingerichtet"-Fall
  // gemeldet, damit klar ist, woran es liegt.
  if (source !== "caldav") {
    return NextResponse.json(
      {
        error: source === "public" ? READ_ONLY_MESSAGE : NOT_CONFIGURED_MESSAGE,
      },
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
