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

const nextConfig: NextConfig = {
  ...(basePath ? { basePath } : {}),
};

export default nextConfig;
