import type { Town } from "@unwatched/engine";

/**
 * The island keeps our time. Its weather is the live weather at a real point on the earth, its seasons are that
 * point's calendar, its clock is that point's clock, its dawn and dusk are that point's sunrise and sunset, and its
 * boat keeps a seasonal timetable. The point is any latitude and longitude; the island itself stays fictional, and
 * calls the place by whatever name it is given. Open-Meteo answers with no key.
 */
export interface RealPlace { id: string; name: string; lat: number; lon: number; tz: string }
/** A few example points, as a convenience. Any "lat,lon" or "lat,lon,Area/City" works the same. */
export const PLACES: Record<string, RealPlace> = {
  hvar: { id: "hvar", name: "the coast", lat: 43.17, lon: 16.44, tz: "Europe/Zagreb" },
  vis: { id: "vis", name: "the coast", lat: 43.06, lon: 16.18, tz: "Europe/Zagreb" },
  korcula: { id: "korcula", name: "the coast", lat: 42.96, lon: 17.13, tz: "Europe/Zagreb" },
};
/** Read UW_REAL_WORLD: a preset id, or "lat,lon" or "lat,lon,Area/City". The time zone, when not given, is learned from the sky on the first fetch. */
export function parsePlace(spec: string, name?: string): RealPlace | null {
  const preset = PLACES[spec.trim().toLowerCase()]; if (preset) return { ...preset, ...(name ? { name } : {}) };
  const m = /^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*(?:,\s*([A-Za-z_]+\/[A-Za-z_\/+-]+))?\s*$/.exec(spec);
  if (!m) return null; const lat = Number(m[1]), lon = Number(m[2]); if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  return { id: `${lat},${lon}`, name: name ?? "the coast", lat, lon, tz: m[3] ?? "auto" };
}
/** When the zone is "auto", ask the sky where it is. Falls back to UTC if the sky does not answer. */
export async function resolveZone(place: RealPlace): Promise<RealPlace> {
  if (place.tz !== "auto") return place;
  try { const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${place.lat}&longitude=${place.lon}&timezone=auto`, { signal: AbortSignal.timeout(8000) }); const d = (await res.json()) as { timezone?: string }; return { ...place, tz: d.timezone && d.timezone !== "GMT" ? d.timezone : "UTC" }; }
  catch { return { ...place, tz: "UTC" }; }
}
/** Boat departures from the mainland, by season, in the island's local hours. Shaped like the Jadrolinija Split to Stari Grad line, not copied from it. */
export const TIMETABLE: Record<string, number[]> = {
  winter: [8, 11, 14, 17, 20],
  spring: [7, 10, 13, 16, 19, 21],
  autumn: [7, 10, 13, 16, 19, 21],
  summer: [6, 8, 10, 12, 14, 16, 18, 20, 22],
};

/** WMO weather codes into the island's words. A dry gale is named by where it blows from, as the coast names it: the bura from the
 * north-east, down off the hills in gusts, and the jugo from the south-east, warm and steady; any other strong wind is just wind. */
export function weatherWord(code: number, windKmh: number, fromDeg: number | null = null, gustKmh: number | null = null): string {
  if (code >= 95) return "storm";
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "snow";
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return windKmh > 45 ? "storm" : "rain";
  if (code === 45 || code === 48) return "fog";
  const gust = gustKmh ?? windKmh;
  if (fromDeg !== null && fromDeg >= 15 && fromDeg <= 100 && (windKmh >= 25 || gust >= 50)) return "bura";
  if (fromDeg !== null && fromDeg > 100 && fromDeg <= 190 && (windKmh >= 22 || gust >= 45)) return "jugo";
  if (windKmh > 35) return "wind";
  return "clear";
}
export function seasonOf(date: Date, tz: string): string {
  const month = Number(new Intl.DateTimeFormat("en-US", { timeZone: tz, month: "numeric" }).format(date));
  return month === 12 || month <= 2 ? "winter" : month <= 5 ? "spring" : month <= 8 ? "summer" : "autumn";
}
export function minuteOfDayIn(tz: string, date = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(date);
  const h = Number(parts.find((x) => x.type === "hour")?.value ?? 0) % 24, m = Number(parts.find((x) => x.type === "minute")?.value ?? 0);
  return h * 60 + m;
}

export interface RealState { place: string; temperatureC: number | null; sunrise: string | null; sunset: string | null; code: number | null; wind: number | null; fetchedAt: number | null; ok: boolean }

export class RealWorld {
  readonly state: RealState;
  private timer: NodeJS.Timeout | null = null;
  /** Called after every fetch, so the clock the clients read carries the new sky at once. */
  onUpdate: (() => void) | null = null;
  constructor(readonly town: Town, readonly place: RealPlace, private log: (l: string) => void) {
    this.state = { place: place.name, temperatureC: null, sunrise: null, sunset: null, code: null, wind: null, fetchedAt: null, ok: false };
    town.weatherSource = "real";
    this.applyCalendar();
  }
  /** Season from the calendar and the boat timetable that goes with it. */
  applyCalendar(): void {
    const season = seasonOf(new Date(), this.place.tz);
    this.town.seasonOverride = season; this.town.boatTimes = TIMETABLE[season] ?? TIMETABLE.spring!;
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: this.place.tz, weekday: "short", day: "numeric", month: "numeric" }).formatToParts(new Date());
    this.town.monthOverride = Number(parts.find((x) => x.type === "month")?.value ?? 1);
    const wd = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(parts.find((x) => x.type === "weekday")?.value ?? "Mon");
    this.town.weekdayOverride = wd >= 0 ? wd : null; this.town.dayOfMonthOverride = Number(parts.find((x) => x.type === "day")?.value ?? 1);
  }
  /** Bring the island's clock to the island's real time of day, forward only, without anyone thinking through the gap. */
  alignClock(): number {
    const target = minuteOfDayIn(this.place.tz);
    const delta = (target - this.town.minuteOfDay + 1440) % 1440;
    // an island a few minutes ahead of the clock (a restart inside the same minute) waits for the clock; it does not skip a day to catch it from behind
    if (delta > 1440 - 90) return 0;
    if (delta > 0) this.town.skip(delta);
    return delta;
  }
  /** How far ahead of the real clock the island is, in minutes, when a restart landed inside the same minute; zero when it is not. */
  ahead(): number { const d = (this.town.minuteOfDay - minuteOfDayIn(this.place.tz) + 1440) % 1440; return d > 0 && d < 90 ? d : 0; }
  /** How far behind the real clock the island is, in minutes, when the ticks have been slow. */
  lag(): number { const d = (minuteOfDayIn(this.place.tz) - this.town.minuteOfDay + 1440) % 1440; return d > 720 ? 0 : d; }
  async fetchOnce(): Promise<void> {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${this.place.lat}&longitude=${this.place.lon}&current=temperature_2m,precipitation,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m&daily=sunrise,sunset&timezone=${encodeURIComponent(this.place.tz)}&forecast_days=1`;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) }); if (!res.ok) throw new Error(`open-meteo ${res.status}`);
      const d = (await res.json()) as { current?: { temperature_2m?: number; weather_code?: number; wind_speed_10m?: number; wind_direction_10m?: number; wind_gusts_10m?: number }; daily?: { sunrise?: string[]; sunset?: string[] } };
      const code = d.current?.weather_code ?? 0, wind = d.current?.wind_speed_10m ?? 0;
      const word = weatherWord(code, wind, d.current?.wind_direction_10m ?? null, d.current?.wind_gusts_10m ?? null);
      this.state.temperatureC = d.current?.temperature_2m ?? null; this.state.code = code; this.state.wind = wind; this.state.fetchedAt = Date.now(); this.state.ok = true;
      this.state.sunrise = d.daily?.sunrise?.[0]?.slice(11, 16) ?? null; this.state.sunset = d.daily?.sunset?.[0]?.slice(11, 16) ?? null;
      this.town.temperatureC = this.state.temperatureC;
      this.town.setWeather(word, `The sky over ${this.place.name} turned to ${word}${this.state.temperatureC !== null ? `, ${Math.round(this.state.temperatureC)} degrees` : ""}.`);
      this.onUpdate?.();
    } catch (err) { this.state.ok = false; this.log(`real world: ${(err as Error).message}; the island keeps the last sky it saw`); }
  }
  start(everyMs = 15 * 60 * 1000): void { void this.fetchOnce(); this.timer = setInterval(() => { this.applyCalendar(); void this.fetchOnce(); }, everyMs); }
  stop(): void { if (this.timer) clearInterval(this.timer); }
}
