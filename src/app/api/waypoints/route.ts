import { NextRequest, NextResponse } from "next/server";
import { WaypointError, addWaypoint, listWaypoints } from "@/lib/waypoints";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({ waypoints: await listWaypoints() });
  } catch (error) {
    console.error("Wegpunkte konnten nicht geladen werden:", error);
    return NextResponse.json(
      { error: "Wegpunkte konnten nicht geladen werden." },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  let body: { name?: unknown; lat?: unknown; lon?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger Request-Body." }, { status: 400 });
  }

  try {
    const waypoint = await addWaypoint({
      name: body.name,
      lat: body.lat,
      lon: body.lon,
    });
    return NextResponse.json({ waypoint }, { status: 201 });
  } catch (error) {
    if (error instanceof WaypointError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Wegpunkt konnte nicht angelegt werden:", error);
    return NextResponse.json(
      { error: "Wegpunkt konnte nicht gespeichert werden." },
      { status: 500 },
    );
  }
}
