import type { NextConfig } from "next";

/**
 * Läuft die Seite nicht auf einer eigenen Domain, sondern als Unterseite
 * (z. B. https://verein.de/segelapp), muss das Präfix hier bekannt sein —
 * sonst zeigen alle Verweise auf /_next ins Leere und die Seite kommt ohne
 * Gestaltung an.
 *
 * Der Wert braucht einen führenden, aber keinen abschliessenden Schrägstrich.
 */
const basePath = (process.env.NEXT_PUBLIC_BASE_PATH ?? "").replace(/\/+$/, "");

/**
 * Zeitpunkt des Builds, in der Fusszeile sichtbar.
 *
 * Grund: Bei Docker steckt der Build im Image. Ob nach einem Update wirklich
 * der neue Stand läuft, war sonst nur über Umwege zu erkennen — mit dieser
 * Angabe genügt ein Blick auf die Seite.
 *
 * Die Werte werden beim Bauen fest in den Code eingesetzt, nicht zur Laufzeit
 * gelesen; ein blosser Neustart ändert sie also nicht.
 */
const buildTime = new Date().toISOString();
const commit = (process.env.NEXT_PUBLIC_COMMIT ?? "").trim().slice(0, 7);

const nextConfig: NextConfig = {
  ...(basePath ? { basePath } : {}),
  env: {
    NEXT_PUBLIC_BUILD_TIME: buildTime,
    NEXT_PUBLIC_COMMIT: commit,
  },
};

export default nextConfig;
