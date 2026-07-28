const CARDINALS = [
  "N",
  "NNO",
  "NO",
  "ONO",
  "O",
  "OSO",
  "SO",
  "SSO",
  "S",
  "SSW",
  "SW",
  "WSW",
  "W",
  "WNW",
  "NW",
  "NNW",
];

export function degToCardinal(deg: number): string {
  const idx = Math.round(deg / 22.5) % 16;
  return CARDINALS[idx];
}

export function kmhToKnots(kmh: number): number {
  return kmh / 1.852;
}

export function formatKnots(kmh: number): string {
  return `${kmhToKnots(kmh).toFixed(1)} kn`;
}

export function formatWeekday(dateStr: string): string {
  const date = new Date(dateStr);
  return new Intl.DateTimeFormat("de-DE", { weekday: "long" }).format(date);
}

export function formatShortDate(dateStr: string): string {
  const date = new Date(dateStr);
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
  }).format(date);
}

export function formatDateTimeLocal(dateStr: string): string {
  const date = new Date(dateStr);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const RATING_LABELS: Record<string, string> = {
  top: "Top Segeltag",
  gut: "Gut",
  maessig: "Mäßig",
  wenig_wind: "Wenig Wind",
  zu_stark: "Zu stark",
  schlecht: "Schlecht",
};

export function ratingLabel(rating: string): string {
  return RATING_LABELS[rating] ?? rating;
}
