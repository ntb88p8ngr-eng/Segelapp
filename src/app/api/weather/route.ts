import { NextResponse } from "next/server";
import { getWeatherOverview } from "@/lib/weather";

/**
 * Nicht zur Build-Zeit vorrendern: Sonst liefert die Route nach jedem
 * Deployment erst den Schnappschuss vom Build — im schlechtesten Fall leer,
 * weil die Build-Umgebung Bright Sky nicht erreicht.
 *
 * Bright Sky wird dadurch nicht häufiger belastet: Der Abruf in weather.ts
 * ist mit `next: { revalidate: 600 }` zwischengespeichert, also höchstens
 * alle 10 Minuten, unabhängig von der Zahl der Besucher.
 */
export const dynamic = "force-dynamic";

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
