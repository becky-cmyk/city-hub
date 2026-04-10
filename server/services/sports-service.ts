interface GameData {
  homeTeam: string;
  awayTeam: string;
  homeScore: number | null;
  awayScore: number | null;
  homeLogo: string;
  awayLogo: string;
  homeAbbrev: string;
  awayAbbrev: string;
  status: "pre" | "in" | "post";
  statusDetail: string;
  startTime: string;
  league: string;
  sport: string;
  isLocalTeam: boolean;
}

interface SportsCache {
  data: GameData[];
  fetchedAt: number;
}

const LOCAL_TEAMS = [
  "carolina panthers",
  "charlotte hornets",
  "charlotte fc",
  "charlotte knights",
];

const LEAGUE_CONFIGS = [
  { sport: "football", league: "nfl", label: "NFL" },
  { sport: "basketball", league: "nba", label: "NBA" },
  { sport: "soccer", league: "usa.1", label: "MLS" },
  { sport: "baseball", league: "mlb", label: "MLB" },
];

const CACHE_TTL_MS = 5 * 60 * 1000;
let cache: SportsCache | null = null;

function isLocalTeam(name: string): boolean {
  const lower = name.toLowerCase();
  return LOCAL_TEAMS.some((t) => lower.includes(t));
}

async function fetchLeagueScores(
  sport: string,
  league: string,
  label: string
): Promise<GameData[]> {
  try {
    const url = `https://site.api.espn.com/apis/site/v2/sports/${sport}/${league}/scoreboard`;
    const res = await fetch(url, {
      headers: { "User-Agent": "CityMetroHub/1.0" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const json = (await res.json()) as any;
    const events = json?.events || [];
    return events.map((ev: any) => {
      const comp = ev.competitions?.[0];
      const home = comp?.competitors?.find((c: any) => c.homeAway === "home");
      const away = comp?.competitors?.find((c: any) => c.homeAway === "away");
      const statusObj = comp?.status || ev.status;
      const stateType = statusObj?.type?.state || "pre";
      return {
        homeTeam: home?.team?.displayName || home?.team?.name || "Home",
        awayTeam: away?.team?.displayName || away?.team?.name || "Away",
        homeScore:
          stateType !== "pre" && home?.score != null
            ? parseInt(home.score, 10)
            : null,
        awayScore:
          stateType !== "pre" && away?.score != null
            ? parseInt(away.score, 10)
            : null,
        homeLogo: home?.team?.logo || "",
        awayLogo: away?.team?.logo || "",
        homeAbbrev:
          home?.team?.abbreviation || home?.team?.shortDisplayName || "",
        awayAbbrev:
          away?.team?.abbreviation || away?.team?.shortDisplayName || "",
        status: stateType as "pre" | "in" | "post",
        statusDetail:
          statusObj?.type?.shortDetail || statusObj?.type?.detail || "",
        startTime: ev.date || "",
        league: label,
        sport,
        isLocalTeam:
          isLocalTeam(home?.team?.displayName || "") ||
          isLocalTeam(away?.team?.displayName || ""),
      } as GameData;
    });
  } catch {
    return [];
  }
}

export async function getSportsScores(): Promise<GameData[]> {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.data;
  }
  const results = await Promise.all(
    LEAGUE_CONFIGS.map((c) => fetchLeagueScores(c.sport, c.league, c.label))
  );
  const allGames = results.flat();

  allGames.sort((a, b) => {
    if (a.isLocalTeam && !b.isLocalTeam) return -1;
    if (!a.isLocalTeam && b.isLocalTeam) return 1;
    const statusOrder = { in: 0, pre: 1, post: 2 };
    return (statusOrder[a.status] ?? 1) - (statusOrder[b.status] ?? 1);
  });

  cache = { data: allGames, fetchedAt: Date.now() };
  return allGames;
}

export async function getLocalSportsScores(): Promise<GameData[]> {
  const all = await getSportsScores();
  const local = all.filter((g) => g.isLocalTeam);
  if (local.length > 0) return local.slice(0, 4);
  return all.slice(0, 4);
}
