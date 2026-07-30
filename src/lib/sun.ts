/**
 * Sonnenauf- und -untergang nach dem Verfahren der NOAA.
 *
 * Bewusst ohne zusätzliche Abhängigkeit und ohne Netzabruf: Die Rechnung ist
 * kurz, für unsere Breiten auf etwa eine Minute genau und funktioniert damit
 * sowohl auf dem Server als auch im Browser.
 */

const RAD = Math.PI / 180;

/** Mittelpunkt der Sonnenscheibe plus Refraktion — der übliche Horizontwinkel. */
const ZENITH_DEG = -0.833;

/** Julianisches Datum aus einem Zeitpunkt. */
function toJulian(date: Date): number {
  return date.getTime() / 86400000 + 2440587.5;
}

function fromJulian(julian: number): Date {
  return new Date((julian - 2440587.5) * 86400000);
}

export interface SunTimes {
  sunrise: Date;
  sunset: Date;
  /** True, wenn die Sonne an dem Tag nicht auf- oder untergeht (Polartag/-nacht). */
  alwaysUp: boolean;
  alwaysDown: boolean;
}

export function sunTimes(date: Date, lat: number, lon: number): SunTimes {
  // Auf Mittag setzen: So gehört die Rechnung eindeutig zu diesem Kalendertag.
  const noon = new Date(date);
  noon.setHours(12, 0, 0, 0);

  const n = Math.round(toJulian(noon) - 2451545.0 + 0.0008);
  const meanSolarNoon = n - lon / 360;

  const M = (357.5291 + 0.98560028 * meanSolarNoon) % 360;
  const C =
    1.9148 * Math.sin(M * RAD) +
    0.02 * Math.sin(2 * M * RAD) +
    0.0003 * Math.sin(3 * M * RAD);
  const lambda = (M + C + 180 + 102.9372) % 360;

  const transit =
    2451545.0 +
    meanSolarNoon +
    0.0053 * Math.sin(M * RAD) -
    0.0069 * Math.sin(2 * lambda * RAD);

  const sinDecl = Math.sin(lambda * RAD) * Math.sin(23.44 * RAD);
  const cosDecl = Math.cos(Math.asin(sinDecl));

  const cosOmega =
    (Math.sin(ZENITH_DEG * RAD) - Math.sin(lat * RAD) * sinDecl) /
    (Math.cos(lat * RAD) * cosDecl);

  if (cosOmega > 1) {
    // Sonne bleibt unter dem Horizont.
    return {
      sunrise: noon,
      sunset: noon,
      alwaysUp: false,
      alwaysDown: true,
    };
  }
  if (cosOmega < -1) {
    const start = new Date(noon);
    start.setHours(0, 0, 0, 0);
    const end = new Date(noon);
    end.setHours(23, 59, 59, 999);
    return { sunrise: start, sunset: end, alwaysUp: true, alwaysDown: false };
  }

  const omega = Math.acos(cosOmega) / RAD;

  return {
    sunrise: fromJulian(transit - omega / 360),
    sunset: fromJulian(transit + omega / 360),
    alwaysUp: false,
    alwaysDown: false,
  };
}

/**
 * Sonnenzeiten auf volle Stunden für den Regler: Aufgang wird abgerundet,
 * Untergang aufgerundet, damit die Randstunden nicht verlorengehen.
 */
export function daylightHours(
  date: Date,
  lat: number,
  lon: number,
): { firstHour: number; lastHour: number; sunrise: Date; sunset: Date } {
  const times = sunTimes(date, lat, lon);
  const firstHour = Math.floor(
    times.sunrise.getHours() + times.sunrise.getMinutes() / 60,
  );
  const lastHour = Math.ceil(
    times.sunset.getHours() + times.sunset.getMinutes() / 60,
  );
  return {
    firstHour,
    lastHour,
    sunrise: times.sunrise,
    sunset: times.sunset,
  };
}
