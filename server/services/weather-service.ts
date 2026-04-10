interface WeatherData {
  temperature: number;
  temperatureUnit: string;
  conditions: string;
  conditionsIcon: string;
  high: number | null;
  low: number | null;
  humidity: string | null;
  windSpeed: string;
  windDirection: string;
  locationName: string;
  forecastUrl: string;
  fetchedAt: number;
}

interface CacheEntry {
  data: WeatherData;
  expiresAt: number;
}

const CACHE_TTL_MS = 30 * 60 * 1000;
const cache = new Map<string, CacheEntry>();

const NWS_USER_AGENT = "CityMetroHub/1.0 (contact@citymetrohub.com)";

function getConditionsIcon(shortForecast: string): string {
  const lower = shortForecast.toLowerCase();
  if (lower.includes("sunny") || lower.includes("clear")) return "sun";
  if (lower.includes("partly cloudy") || lower.includes("partly sunny")) return "cloud-sun";
  if (lower.includes("mostly cloudy") || lower.includes("overcast")) return "cloud";
  if (lower.includes("thunderstorm") || lower.includes("thunder")) return "cloud-lightning";
  if (lower.includes("rain") || lower.includes("shower") || lower.includes("drizzle")) return "cloud-rain";
  if (lower.includes("snow") || lower.includes("flurries") || lower.includes("sleet")) return "snowflake";
  if (lower.includes("fog") || lower.includes("haze") || lower.includes("mist")) return "cloud-fog";
  if (lower.includes("wind")) return "wind";
  if (lower.includes("cloud")) return "cloud";
  return "cloud-sun";
}

async function fetchJson(url: string): Promise<any> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": NWS_USER_AGENT,
      Accept: "application/geo+json",
    },
  });
  if (!res.ok) {
    throw new Error(`NWS API error: ${res.status} ${res.statusText} for ${url}`);
  }
  return res.json();
}

export async function getWeather(
  lat: number = 35.2271,
  lon: number = -80.8431,
  locationName: string = "Charlotte, NC"
): Promise<WeatherData> {
  const cacheKey = `${lat.toFixed(4)},${lon.toFixed(4)}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  try {
    const pointsData = await fetchJson(`https://api.weather.gov/points/${lat},${lon}`);
    const forecastUrl: string = pointsData.properties.forecast;
    const forecastHourlyUrl: string = pointsData.properties.forecastHourly;

    const [forecastData, hourlyData] = await Promise.all([
      fetchJson(forecastUrl),
      fetchJson(forecastHourlyUrl),
    ]);

    const periods = forecastData.properties.periods;
    const hourlyPeriods = hourlyData.properties.periods;

    const currentHourly = hourlyPeriods[0];
    const currentTemp = currentHourly.temperature;
    const tempUnit = currentHourly.temperatureUnit === "F" ? "F" : "C";
    const shortForecast = currentHourly.shortForecast;

    let todayHigh: number | null = null;
    let todayLow: number | null = null;
    const humidity = currentHourly.relativeHumidity?.value
      ? `${Math.round(currentHourly.relativeHumidity.value)}%`
      : null;

    for (const p of periods) {
      if (p.isDaytime && todayHigh === null) {
        todayHigh = p.temperature;
      }
      if (!p.isDaytime && todayLow === null) {
        todayLow = p.temperature;
      }
      if (todayHigh !== null && todayLow !== null) break;
    }

    const weatherData: WeatherData = {
      temperature: currentTemp,
      temperatureUnit: tempUnit,
      conditions: shortForecast,
      conditionsIcon: getConditionsIcon(shortForecast),
      high: todayHigh,
      low: todayLow,
      humidity,
      windSpeed: currentHourly.windSpeed || "",
      windDirection: currentHourly.windDirection || "",
      locationName,
      forecastUrl: `https://forecast.weather.gov/MapClick.php?lat=${lat}&lon=${lon}`,
      fetchedAt: Date.now(),
    };

    cache.set(cacheKey, {
      data: weatherData,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });

    return weatherData;
  } catch (error: any) {
    const stale = cache.get(cacheKey);
    if (stale) {
      return stale.data;
    }
    throw new Error(`Failed to fetch weather: ${error.message}`);
  }
}
