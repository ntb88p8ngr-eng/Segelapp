import { Anchor, MapPin } from "lucide-react";
import WindDashboard from "@/components/WindDashboard";
import ForecastList from "@/components/ForecastList";
import CalendarSection from "@/components/CalendarSection";
import CalendarProvider from "@/components/CalendarProvider";
import WeatherAlerts from "@/components/WeatherAlerts";
import SailingMap from "@/components/SailingMapLoader";
import ThemeToggle from "@/components/ThemeToggle";
import { getWeatherOverview } from "@/lib/weather";

export const revalidate = 600;

export default async function Home() {
  const overview = await getWeatherOverview();
  const bestDay =
    overview.bestDayIndex != null ? overview.forecast[overview.bestDayIndex] : null;
  const currentDirection =
    overview.current?.windDirectionDeg ?? bestDay?.windDirectionDeg ?? 0;
  const currentSpeed = overview.current?.windSpeedKmh ?? bestDay?.windSpeedAvgKmh ?? 0;
  const currentGust = overview.current?.windGustKmh ?? bestDay?.windGustMaxKmh ?? null;

  return (
    <CalendarProvider>
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-10 px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex justify-end">
          <ThemeToggle />
        </div>

        <header className="-mt-6 flex flex-col items-center gap-3 text-center">
          <div className="flex items-center gap-2 text-accent">
            <Anchor className="h-6 w-6" />
            <span className="text-sm uppercase tracking-[0.2em]">
              Segelgemeinschaft
            </span>
          </div>
          <h1 className="text-3xl font-bold text-ink sm:text-4xl">
            Wind & Wetter am {overview.location.name}
          </h1>
          <p className="flex items-center gap-1.5 text-sm text-ink-muted">
            <MapPin className="h-4 w-4" />
            Live-Daten des Deutschen Wetterdienstes ({overview.source})
          </p>
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
          <ForecastList
            forecast={overview.forecast}
            bestDayIndex={overview.bestDayIndex}
          />
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
          <CalendarSection bestDay={bestDay} />
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
    </CalendarProvider>
  );
}
