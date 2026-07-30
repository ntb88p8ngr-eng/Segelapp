import { NextResponse } from "next/server";
import { removeWaypoint } from "@/lib/waypoints";

export const dynamic = "force-dynamic";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    const removed = await removeWaypoint(id);
    if (!removed) {
      return NextResponse.json(
        { error: "Dieser Wegpunkt existiert nicht (mehr)." },
        { status: 404 },
      );
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Wegpunkt konnte nicht gelöscht werden:", error);
    return NextResponse.json(
      { error: "Wegpunkt konnte nicht gelöscht werden." },
      { status: 500 },
    );
  }
}
