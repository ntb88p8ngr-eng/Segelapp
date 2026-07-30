"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { refreshWeather } from "@/app/actions";
import { useCalendar } from "./CalendarProvider";
import { SailboatIcon } from "./BoatIcons";

export default function RefreshButton() {
  const router = useRouter();
  const { reload } = useCalendar();
  const [pending, startTransition] = useTransition();
  const [manual, setManual] = useState(false);

  const busy = pending || manual;

  async function handleClick() {
    if (busy) return;
    setManual(true);
    try {
      await refreshWeather();
      await reload();
      startTransition(() => router.refresh());
    } finally {
      // Kurz stehen lassen: Bei schnellem Netz wäre die Runde sonst nur ein
      // Zucken und man wüsste nicht, ob etwas passiert ist.
      setTimeout(() => setManual(false), 900);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      aria-label="Wetterdaten neu laden"
      title="Wetterdaten neu laden"
      className="relative inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line bg-surface text-accent transition hover:border-accent/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-progress"
    >
      {/* Kielwasser: nur während der Fahrt sichtbar. */}
      <span
        aria-hidden="true"
        className={`absolute inset-1.5 rounded-full border border-dashed border-accent/40 transition-opacity ${
          busy ? "opacity-100" : "opacity-0"
        }`}
      />
      <span
        aria-hidden="true"
        className={busy ? "boat-orbit" : ""}
        style={{ display: "inline-flex" }}
      >
        <SailboatIcon className="h-5 w-5" />
      </span>
      <span className="sr-only">{busy ? "Wird geladen" : "Neu laden"}</span>
    </button>
  );
}
