"use client";

import { useTheme } from "./ThemeProvider";
import { PirateShipIcon, SailboatIcon } from "./BoatIcons";

/**
 * Die Optik hängt allein am data-theme-Attribut (via dark:-Variante), nicht
 * am React-State. Sonst würde der Knopf nach der Hydration sichtbar von der
 * serverseitig angenommenen Position an die tatsächliche springen.
 */
export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label={
        isDark ? "Zum hellen Design wechseln" : "Zum dunklen Design wechseln"
      }
      onClick={toggleTheme}
      className="relative inline-flex h-10 w-[4.75rem] shrink-0 items-center rounded-full border border-line bg-surface p-1 transition hover:border-accent/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      {/* Die jeweils inaktive Option bleibt sichtbar, die aktive verdeckt der Knopf. */}
      <span className="pointer-events-none absolute inset-0 flex items-center justify-between px-2.5">
        <SailboatIcon className="h-4 w-4 text-ink-soft" />
        <PirateShipIcon className="h-4 w-4 text-ink-soft" />
      </span>

      <span className="relative z-10 flex h-8 w-8 translate-x-0 items-center justify-center rounded-full bg-surface-strong shadow-md ring-1 ring-line transition-transform duration-300 ease-out dark:translate-x-[2.35rem]">
        <SailboatIcon className="h-[1.15rem] w-[1.15rem] text-accent dark:hidden" />
        <PirateShipIcon className="hidden h-[1.15rem] w-[1.15rem] text-accent dark:block" />
      </span>
    </button>
  );
}
