import { Anchor, MapPin } from "lucide-react";
import WindDashboard from "@/components/WindDashboard";
import ForecastList from "@/components/ForecastList";
import CalendarSection from "@/components/CalendarSection";
import CalendarProvider from "@/components/CalendarProvider";
import ForecastProvider from "@/components/ForecastProvider";
import SailingWindowSlider from "@/components/SailingWindowSlider";
import RefreshButton from "@/components/RefreshButton";
import WeatherAlerts from "@/components/WeatherAlerts";
import SailingMap from "@/components/SailingMapLoader";
import ThemeToggle from "@/components/ThemeToggle";
import { getWeatherOverview } from "@/lib/weather";

// Wie bei /api/weather: pro Aufruf rendern, damit nach einem Deployment nicht
// der Build-Stand ausgeliefert wird. Der Wetterabruf selbst bleibt 10 Minuten
// zwischengespeichert.
export const dynamic = "force-dynamic";

export default async function Home() {
  const overview = await getWeatherOverview();
  const bestDay =
    overview.bestDayIndex != null
      ? overview.forecast[overview.bestDayIndex]
      : null;
  const currentDirection =
    overview.current?.windDirectionDeg ?? bestDay?.windDirectionDeg ?? 0;
  const currentSpeed =
    overview.current?.windSpeedKmh ?? bestDay?.windSpeedAvgKmh ?? 0;
  const currentGust =
    overview.current?.windGustKmh ?? bestDay?.windGustMaxKmh ?? null;

  return (
    <CalendarProvider>
      <ForecastProvider initialForecast={overview.forecast}>
        <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 py-6 sm:gap-10 sm:px-6 sm:py-10 lg:px-8">
          <header className="flex flex-col gap-5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-accent">
                <Anchor className="h-5 w-5 shrink-0 sm:h-6 sm:w-6" />
                <span className="text-xs uppercase tracking-[0.2em] sm:text-sm">
                  Segelgemeinschaft
                </span>
              </div>
              <div className="flex items-center gap-2">
                <RefreshButton />
                <ThemeToggle />
              </div>
            </div>

            <div className="flex flex-col items-center gap-2 text-center">
              <h1 className="text-2xl font-bold text-balance text-ink sm:text-4xl">
                Wind & Wetter am {overview.location.name}
              </h1>
              <p className="flex flex-wrap items-center justify-center gap-1.5 text-xs text-ink-muted sm:text-sm">
                <MapPin className="h-4 w-4 shrink-0" />
                Live-Daten des Deutschen Wetterdienstes
                {overview.station && (
                  <span className="text-ink-soft">
                    · Station {overview.station.name}
                    {overview.station.distanceKm != null &&
                      ` (${overview.station.distanceKm.toLocaleString("de-DE")} km)`}
                  </span>
                )}
              </p>
            </div>
          </header>

          <WeatherAlerts alerts={overview.alerts} />

          <section>
            <WindDashboard
              current={overview.current}
              locationName={overview.location.name}
            />
          </section>

          <section>
            <h2 className="mb-4 text-lg font-semibold text-ink">
              7-Tage-Vorhersage & Segeltag-Empfehlung
            </h2>
            <div className="mb-4">
              <SailingWindowSlider />
            </div>
            <ForecastList />
          </section>

          <section>
            <h2 className="mb-4 text-lg font-semibold text-ink">
              Windrichtung am See
            </h2>
            <SailingMap
              windDirectionDeg={currentDirection}
              windSpeedKmh={currentSpeed}
              gustKmh={currentGust}
            />
          </section>

          <section>
            <CalendarSection />
          </section>

          <footer className="mt-6 border-t border-line pt-6 text-center text-xs text-ink-soft">
            Wetterdaten: Deutscher Wetterdienst (DWD), bereitgestellt über{" "}
            <a
              href="https://brightsky.dev"
              target="_blank"
              rel="noreferrer"
              className="underline hover:text-ink"
            >
              brightsky.dev
            </a>
            . Kartenmaterial: © OpenStreetMap-Mitwirkende.
          </footer>
        </div>
      </ForecastProvider>
    </CalendarProvider>
  );
}
