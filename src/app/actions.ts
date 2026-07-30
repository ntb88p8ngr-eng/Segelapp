"use server";

import { updateTag } from "next/cache";
import { WEATHER_CACHE_TAG } from "@/lib/weather";

/**
 * Verwirft den zwischengespeicherten Wetterabruf.
 *
 * Ohne das brächte ein Neuladen nichts: Der Abruf bei Bright Sky ist zehn
 * Minuten gültig, die Seite bekäme also dieselben Zahlen zurück.
 *
 * updateTag statt revalidateTag, weil der nächste Aufruf hier auf frische
 * Daten warten soll — wer auf "Aktualisieren" drückt, will nicht noch einmal
 * den alten Stand sehen.
 */
export async function refreshWeather(): Promise<void> {
  updateTag(WEATHER_CACHE_TAG);
}
