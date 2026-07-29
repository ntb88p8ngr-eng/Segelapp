/**
 * Demo-Wetterdaten für die lokale Entwicklung.
 *
 * Die Seite bezieht ihre Daten vom DWD über brightsky.dev. Wenn beim
 * Entwickeln kein Netzzugang besteht (oder man Warnungen und Animation
 * gezielt testen will), liefert dieser Fixture-Satz realistische Werte —
 * inklusive eines Gewittertags und starker Böen, damit die Warnhinweise
 * sichtbar werden.
 *
 * Aktivierung: Umgebungsvariable DEMO_WEATHER=1 (siehe .env.example).
 * Niemals in Produktion setzen.
 */

export function isDemoMode(): boolean {
  return process.env.DEMO_WEATHER === "1";
}

export function demoCurrentWeather() {
  return {
    // Feldnamen wie bei /current_weather: Wind und Niederschlag tragen dort
    // das Mittelungsintervall im Namen, nur temperature heisst schlicht.
    weather: {
      timestamp: new Date().toISOString(),
      wind_speed_10: 24,
      wind_direction_10: 250,
      wind_gust_speed_10: 41,
      temperature: 22,
      condition: "dry",
      precipitation_60: 0,
      cloud_cover: 30,
    },
    sources: [
      {
        station_name: "Raisting (Demo)",
        distance: 6400,
        observation_type: "synop",
      },
    ],
  };
}

export function demoForecast() {
  const now = new Date();
  const records = [];

  for (let d = 0; d < 6; d++) {
    for (let hour = 6; hour < 22; hour++) {
      const t = new Date(now);
      t.setDate(t.getDate() + d);
      t.setHours(hour, 0, 0, 0);

      // Tag 2 bringt ein Gewitter, Tag 5 Sturm — beides löst die
      // entsprechenden Warnungen aus.
      //
      // Der Sturmtag ist bewusst so kräftig, dass jedes Zeitfenster auf
      // 0 Punkte gekappt wird, und seine Flaute liegt am Nachmittag statt
      // am Morgen. Beides zusammen prüft, dass dort das ruhigste und nicht
      // einfach das früheste Fenster empfohlen wird.
      const isStormDay = d === 2;
      const isGustyDay = d === 5;
      const base = 9 + d * 3 + Math.sin(hour / 2) * 3;
      const stormWind = 50 + Math.cos((hour - 8) / 2.5) * 8;

      records.push({
        timestamp: t.toISOString(),
        wind_speed: isGustyDay ? stormWind : base,
        wind_direction: 220 + d * 12,
        wind_gust_speed: isGustyDay ? stormWind + 42 : base + 9,
        temperature: 19 + d,
        condition: isStormDay && hour > 14 ? "thunderstorm" : "dry",
        precipitation: isStormDay && hour > 14 ? 3 : 0,
        cloud_cover: isStormDay ? 85 : 30,
      });
    }
  }

  return { weather: records };
}
