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
    weather: {
      timestamp: new Date().toISOString(),
      wind_speed: 24,
      wind_direction: 250,
      wind_gust_speed: 41,
      temperature: 22,
      condition: "dry",
      precipitation: 0,
      cloud_cover: 30,
    },
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

      // Tag 2 bringt ein Gewitter, Tag 5 kräftige Böen — beides löst
      // die entsprechenden Warnungen in der UI aus.
      const isStormDay = d === 2;
      const isGustyDay = d === 5;
      const base = 9 + d * 3 + Math.sin(hour / 2) * 3;

      records.push({
        timestamp: t.toISOString(),
        wind_speed: isGustyDay ? base + 14 : base,
        wind_direction: 220 + d * 12,
        wind_gust_speed: isGustyDay ? base + 48 : base + 9,
        temperature: 19 + d,
        condition: isStormDay && hour > 14 ? "thunderstorm" : "dry",
        precipitation: isStormDay && hour > 14 ? 3 : 0,
        cloud_cover: isStormDay ? 85 : 30,
      });
    }
  }

  return { weather: records };
}
