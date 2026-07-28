"use client";

import { useEffect, useState } from "react";
import { CalendarPlus, CalendarClock, AlertCircle, Loader2 } from "lucide-react";
import type { CalendarApiResponse, ClubCalendarEvent, DailyForecast } from "@/lib/types";
import { formatDateTimeLocal } from "@/lib/format";

interface CalendarSectionProps {
  bestDay: DailyForecast | null;
}

export default function CalendarSection({ bestDay }: CalendarSectionProps) {
  const [state, setState] = useState<CalendarApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const defaultStart = bestDay
    ? formatDateTimeLocal(`${bestDay.date}T10:00:00`)
    : "";
  const defaultEnd = bestDay
    ? formatDateTimeLocal(`${bestDay.date}T15:00:00`)
    : "";

  const [form, setForm] = useState({
    summary: "Gemeinsamer Segelausflug",
    location: "Ammersee",
    start: defaultStart,
    end: defaultEnd,
    description: "",
  });

  async function loadEvents() {
    try {
      const res = await fetch("/api/calendar");
      const data: CalendarApiResponse = await res.json();
      setState(data);
    } catch {
      setState({ configured: false, events: [], message: "Kalender konnte nicht geladen werden." });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch on mount
    void loadEvents();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
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
      await loadEvents();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Unbekannter Fehler.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-6 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-100">
          <CalendarClock className="h-5 w-5 text-sky-300" />
          Vereinskalender
        </h2>
        {state?.configured && (
          <button
            onClick={() => setFormOpen((v) => !v)}
            className="flex items-center gap-1.5 rounded-lg bg-sky-500 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-sky-400"
          >
            <CalendarPlus className="h-4 w-4" />
            Termin vorschlagen
          </button>
        )}
      </div>

      {loading && (
        <div className="mt-6 flex items-center gap-2 text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          Kalender wird geladen…
        </div>
      )}

      {!loading && state && !state.configured && (
        <div className="mt-6 flex gap-3 rounded-xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-100">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <div>
            <p>{state.message}</p>
            <p className="mt-2 text-amber-200/80">
              Setze <code className="rounded bg-black/30 px-1">ICLOUD_USERNAME</code> und{" "}
              <code className="rounded bg-black/30 px-1">ICLOUD_APP_PASSWORD</code> (App-spezifisches
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

      {!loading && state && state.configured && (
        <>
          {state.message && (
            <p className="mt-4 text-sm text-rose-300">{state.message}</p>
          )}
          {state.events.length === 0 ? (
            <p className="mt-6 text-sm text-slate-400">Keine anstehenden Termine.</p>
          ) : (
            <ul className="mt-6 space-y-3">
              {state.events.map((ev) => (
                <EventRow key={ev.uid} event={ev} />
              ))}
            </ul>
          )}
        </>
      )}

      {formOpen && (
        <form onSubmit={handleSubmit} className="mt-6 space-y-3 rounded-xl border border-white/10 bg-black/20 p-4">
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
          {formError && <p className="text-sm text-rose-300">{formError}</p>}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              className="rounded-lg px-3 py-1.5 text-sm text-slate-300 hover:bg-white/5"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-sky-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-400 disabled:opacity-50"
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
  const end = new Date(event.end);
  return (
    <li className="rounded-xl border border-white/10 bg-white/5 p-3">
      <p className="font-medium text-slate-100">{event.summary}</p>
      <p className="text-sm text-slate-400">
        {start.toLocaleString("de-DE", {
          weekday: "short",
          day: "2-digit",
          month: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        })}{" "}
        –{" "}
        {end.toLocaleString("de-DE", { hour: "2-digit", minute: "2-digit" })} Uhr
        {event.location ? ` · ${event.location}` : ""}
      </p>
    </li>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm text-slate-300">
      <span className="mb-1 block text-xs uppercase tracking-wide text-slate-400">
        {label}
      </span>
      {children}
    </label>
  );
}
