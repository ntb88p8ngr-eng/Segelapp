import { NextResponse } from "next/server";
import { getWeatherOverview } from "@/lib/weather";

export const revalidate = 600;

export async function GET() {
  try {
    const overview = await getWeatherOverview();
    return NextResponse.json(overview);
  } catch (error) {
    console.error("Wetterdaten konnten nicht geladen werden:", error);
    return NextResponse.json(
      { error: "Wetterdaten konnten nicht geladen werden." },
      { status: 502 },
    );
  }
}
