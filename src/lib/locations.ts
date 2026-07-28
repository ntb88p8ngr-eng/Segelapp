import type { SailingClub } from "./types";

export const AMMERSEE_LOCATION = {
  name: "Ammersee",
  lat: 47.9833,
  lon: 11.145,
};

export const SAILING_CLUBS: SailingClub[] = [
  {
    id: "herrsching",
    name: "Yacht-Club Herrsching e.V.",
    lat: 47.9989,
    lon: 11.1699,
    description: "Ostufer, geschützte Bucht mit Steg direkt am Ort.",
  },
  {
    id: "wartaweil",
    name: "Bayerische Seesportschule Wartaweil",
    lat: 47.9754,
    lon: 11.1441,
    description: "Segelschule und Verein am Ostufer, viel Bootsverkehr.",
  },
  {
    id: "diessen",
    name: "Segel-Club Dießen e.V.",
    lat: 47.9494,
    lon: 11.1042,
    description: "Südufer, freier Blick auf den Hauptwindkanal des Sees.",
  },
  {
    id: "utting",
    name: "Segelclub Utting e.V.",
    lat: 47.9927,
    lon: 11.0951,
    description: "Westufer, oft im Lee bei Südwind.",
  },
  {
    id: "schondorf",
    name: "Yacht-Club Schondorf e.V.",
    lat: 48.0132,
    lon: 11.1114,
    description: "Westufer, gute Bedingungen bei nördlichem Wind.",
  },
];
