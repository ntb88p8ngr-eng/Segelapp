"use client";

import { useState } from "react";
import { CalendarPlus, CalendarClock, AlertCircle, Loader2 } from "lucide-react";
import type { ClubCalendarEvent, DailyForecast } from "@/lib/types";
import { formatDateTimeLocal, formatTimeRange } from "@/lib/format";
import { useCalendar } from "./CalendarProvider";

interface CalendarSectionProps {
  bestDay: DailyForecast | null;
}

/** Vorbelegung des Formulars: bestes Zeitfenster des empfohlenen Tages. */
function defaultTimes(bestDay: DailyForecast | null) {
  if (!bestDay) return { start: "", end: "" };
  const pad = (n: number) => String(n).padStart(2, "0");
  const startHour = bestDay.bestWindow?.startHour ?? 10;
  const endHour = bestDay.bestWindow?.endHour ?? 15;
  return {
    start: formatDateTimeLocal(`${bestDay.date}T${pad(startHour)}:00:00`),
    end: formatDateTimeLocal(`${bestDay.date}T${pad(endHour)}:00:00`),
  };
}

export default function CalendarSection({ bestDay }: CalendarSectionProps) {
  const { configured, loading, events, message, reload } = useCalendar();

  const [formOpen, setFormOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState<{
    summary: string;
    location: string;
    start: string;
    end: string;
    description: string;
  } | null>(null);

  // Beim Öffnen frisch aus dem aktuell empfohlenen Tag vorbelegen.
  function openForm() {
    const times = defaultTimes(bestDay);
    setForm({
      summary: "Gemeinsamer Segelausflug",
      location: "Ammersee",
      description: "",
      ...times,
    });
    setFormError(null);
    setFormOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setSubmitting(true);
    setFormError(null);
    try {
      const res = await fetch("/api/calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          summary: form.summary,
          location: form.location,
          description: form.description,
          start: new Date(form.start).toISOString(),
          end: new Date(form.end).toISOString(),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Termin konnte nicht angelegt werden.");
      }
      setFormOpen(false);
      await reload();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Unbekannter Fehler.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-2xl border border-line bg-surface p-6 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-ink">
          <CalendarClock className="h-5 w-5 text-accent" />
          Vereinskalender
        </h2>
        {configured && (
          <button
            onClick={() => (formOpen ? setFormOpen(false) : openForm())}
            className="flex items-center gap-1.5 rounded-lg bg-accent px-4 py-1.5 text-sm font-medium text-white transition hover:opacity-90 touch:min-h-11"
          >
            <CalendarPlus className="h-4 w-4" />
            Termin vorschlagen
          </button>
        )}
      </div>

      {loading && (
        <div className="mt-6 flex items-center gap-2 text-ink-muted">
          <Loader2 className="h-4 w-4 animate-spin" />
          Kalender wird geladen…
        </div>
      )}

      {!loading && !configured && (
        <div className="mt-6 flex gap-3 rounded-xl border border-amber-500/50 bg-amber-500/15 p-4 text-sm text-amber-900 dark:text-amber-50">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <div>
            <p>{message}</p>
            <p className="mt-2 text-amber-800 dark:text-amber-200/80">
              Setze <code className="rounded bg-surface-inset px-1">ICLOUD_USERNAME</code> und{" "}
              <code className="rounded bg-surface-inset px-1">ICLOUD_APP_PASSWORD</code> (App-spezifisches
              Passwort von{" "}
              <a
                href="https://appleid.apple.com"
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                appleid.apple.com
              </a>
              ) als Umgebungsvariablen, siehe README.
            </p>
          </div>
        </div>
      )}

      {!loading && configured && (
        <>
          {message && <p className="mt-4 text-sm text-rose-600 dark:text-rose-300">{message}</p>}
          {events.length === 0 ? (
            <p className="mt-6 text-sm text-ink-muted">Keine anstehenden Termine.</p>
          ) : (
            <ul className="mt-6 space-y-3">
              {events.map((ev) => (
                <EventRow key={ev.uid} event={ev} />
              ))}
            </ul>
          )}
        </>
      )}

      {formOpen && form && (
        <form
          onSubmit={handleSubmit}
          className="mt-6 space-y-3 rounded-xl border border-line bg-surface-inset p-4"
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Titel">
              <input
                required
                className="input"
                value={form.summary}
                onChange={(e) => setForm({ ...form, summary: e.target.value })}
              />
            </Field>
            <Field label="Ort">
              <input
                className="input"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
              />
            </Field>
            <Field label="Start">
              <input
                required
                type="datetime-local"
                className="input"
                value={form.start}
                onChange={(e) => setForm({ ...form, start: e.target.value })}
              />
            </Field>
            <Field label="Ende">
              <input
                required
                type="datetime-local"
                className="input"
                value={form.end}
                onChange={(e) => setForm({ ...form, end: e.target.value })}
              />
            </Field>
          </div>
          <Field label="Beschreibung">
            <textarea
              className="input"
              rows={2}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </Field>
          {formError && <p className="text-sm text-rose-600 dark:text-rose-300">{formError}</p>}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              className="rounded-lg px-4 py-1.5 text-sm text-ink-muted hover:bg-surface-inset touch:min-h-11"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-accent px-4 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 touch:min-h-11"
            >
              {submitting ? "Speichern…" : "Im iCloud-Kalender anlegen"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function EventRow({ event }: { event: ClubCalendarEvent }) {
  const start = new Date(event.start);
  return (
    <li className="rounded-xl border border-line bg-surface-inset p-3">
      <p className="font-medium text-ink">{event.summary}</p>
      <p className="text-sm text-ink-muted">
        {start.toLocaleDateString("de-DE", {
          weekday: "short",
          day: "2-digit",
          month: "2-digit",
        })}
        , {formatTimeRange(event.start, event.end)}
        {event.location ? ` · ${event.location}` : ""}
      </p>
    </li>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm text-ink-muted">
      <span className="mb-1 block text-xs uppercase tracking-wide text-ink-muted">
        {label}
      </span>
      {children}
    </label>
  );
}
