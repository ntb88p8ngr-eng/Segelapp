import { CloudLightning, Wind, TriangleAlert } from "lucide-react";
import type { WeatherAlert } from "@/lib/types";

interface WeatherAlertsProps {
  alerts: WeatherAlert[];
}

const SEVERITY_STYLES: Record<string, string> = {
  warnung:
    "border-rose-500/60 bg-rose-500/15 text-rose-900 dark:text-rose-50",
  hinweis:
    "border-amber-500/50 bg-amber-500/15 text-amber-900 dark:text-amber-50",
};

const ICON_STYLES: Record<string, string> = {
  warnung: "text-rose-600 dark:text-rose-300",
  hinweis: "text-amber-600 dark:text-amber-300",
};

function AlertIcon({ alert }: { alert: WeatherAlert }) {
  const className = `h-5 w-5 shrink-0 ${ICON_STYLES[alert.severity] ?? ""}`;
  if (alert.kind === "gewitter") return <CloudLightning className={className} />;
  if (alert.kind === "boeen") return <Wind className={className} />;
  return <TriangleAlert className={className} />;
}

export default function WeatherAlerts({ alerts }: WeatherAlertsProps) {
  if (!alerts.length) return null;

  return (
    <section aria-label="Wetterwarnungen" className="space-y-3">
      {alerts.map((alert) => (
        <div
          key={alert.id}
          role={alert.severity === "warnung" ? "alert" : undefined}
          className={`flex items-start gap-3 rounded-2xl border px-5 py-4 ${
            SEVERITY_STYLES[alert.severity] ?? "border-line bg-surface"
          }`}
        >
          <AlertIcon alert={alert} />
          <div>
            <p className="font-semibold">{alert.title}</p>
            <p className="mt-0.5 text-sm opacity-90">{alert.description}</p>
          </div>
        </div>
      ))}
    </section>
  );
}
