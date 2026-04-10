import { db } from "../server/db";
import { cities, metroSources } from "../shared/schema";
import { eq, and } from "drizzle-orm";

const RSS_SOURCES = [
  {
    name: "Spectrum Local News Charlotte",
    baseUrl: "https://spectrumlocalnews.com/nc/charlotte/rss",
    enabled: true,
    pullFrequency: "HOURLY" as const,
  },
  {
    name: "WCNC Charlotte",
    baseUrl: "https://www.wcnc.com/feeds/syndication/rss/news",
    enabled: true,
    pullFrequency: "HOURLY" as const,
  },
  {
    name: "WFAE Charlotte",
    baseUrl: "https://www.wfae.org/rss.xml",
    enabled: true,
    pullFrequency: "HOURLY" as const,
  },
  {
    name: "Charlotte Observer",
    baseUrl: "https://www.charlotteobserver.com/news/local/index.rss",
    enabled: false,
    pullFrequency: "HOURLY" as const,
  },
  {
    name: "WSOC-TV Charlotte",
    baseUrl: "https://www.wsoctv.com/arc/outboundfeeds/rss/?outputType=xml",
    enabled: true,
    pullFrequency: "HOURLY" as const,
  },
  {
    name: "Charlotte Ledger",
    baseUrl: "https://www.thecharlotteledger.com/feed",
    enabled: true,
    pullFrequency: "HOURLY" as const,
  },
  {
    name: "La Noticia Charlotte (Spanish)",
    baseUrl: "https://lanoticia.com/feed/",
    enabled: true,
    pullFrequency: "HOURLY" as const,
  },
  {
    name: "Enlace Latino NC (Spanish)",
    baseUrl: "https://enlacelatinonc.org/feed/",
    enabled: true,
    pullFrequency: "HOURLY" as const,
  },
  {
    name: "Que Pasa Charlotte (Spanish)",
    baseUrl: "https://quepasamedia.com/feed/",
    enabled: true,
    pullFrequency: "HOURLY" as const,
  },
  {
    name: "Hola Carolina (Bilingual)",
    baseUrl: "https://holacarolina.org/feed/",
    enabled: true,
    pullFrequency: "HOURLY" as const,
  },
  {
    name: "Enlace Charlotte (Latino Network)",
    baseUrl: "https://enlacecharlotte.org/feed/",
    enabled: true,
    pullFrequency: "HOURLY" as const,
  },
  {
    name: "Hickory Record (Catawba/Burke)",
    baseUrl: "https://www.hickoryrecord.com/search/?f=rss&t=article&l=25&s=start_time&sd=desc",
    enabled: true,
    pullFrequency: "HOURLY" as const,
  },
  {
    name: "Independent Tribune (Cabarrus County)",
    baseUrl: "https://www.independenttribune.com/search/?f=rss&t=article&l=50&s=start_time&sd=desc",
    enabled: true,
    pullFrequency: "HOURLY" as const,
  },
  {
    name: "CLT Today (6am City)",
    baseUrl: "https://clttoday.6amcity.com/feed",
    enabled: true,
    pullFrequency: "HOURLY" as const,
  },
  {
    name: "Queen City News (FOX 46)",
    baseUrl: "https://qcnews.com/feed",
    enabled: true,
    pullFrequency: "HOURLY" as const,
  },
  {
    name: "Charlotte Magazine",
    baseUrl: "https://www.charlottemagazine.com/feed/",
    enabled: true,
    pullFrequency: "HOURLY" as const,
  },
  {
    name: "Salisbury Post (Rowan County)",
    baseUrl: "https://www.salisburypost.com/feed/",
    enabled: true,
    pullFrequency: "HOURLY" as const,
  },
  {
    name: "Lincoln Herald (Lincoln County)",
    baseUrl: "https://www.lincolnherald.com/search/?f=rss&t=article&l=25&s=start_time&sd=desc",
    enabled: true,
    pullFrequency: "HOURLY" as const,
  },
  {
    name: "Shelby Star (Cleveland County)",
    baseUrl: "https://www.shelbystar.com/search/?f=rss&t=article&l=25&s=start_time&sd=desc",
    enabled: true,
    pullFrequency: "HOURLY" as const,
  },
  {
    name: "Gaston Gazette (Gaston County)",
    baseUrl: "https://www.gastongazette.com/search/?f=rss&t=article&l=25&s=start_time&sd=desc",
    enabled: true,
    pullFrequency: "HOURLY" as const,
  },
  {
    name: "Axios Charlotte",
    baseUrl: "https://www.axios.com/local/charlotte/feed",
    enabled: true,
    pullFrequency: "HOURLY" as const,
  },
  {
    name: "Mooresville Tribune (Iredell County)",
    baseUrl: "https://mooresvilletribune.com/search/?f=rss&t=article&l=25&s=start_time&sd=desc",
    enabled: true,
    pullFrequency: "HOURLY" as const,
  },
  {
    name: "Statesville Record & Landmark (Iredell County)",
    baseUrl: "https://statesville.com/search/?f=rss&t=article&l=25&s=start_time&sd=desc",
    enabled: true,
    pullFrequency: "HOURLY" as const,
  },
  {
    name: "McDowell News (McDowell County)",
    baseUrl: "https://mcdowellnews.com/search/?f=rss&t=article&l=25&s=start_time&sd=desc",
    enabled: true,
    pullFrequency: "HOURLY" as const,
  },
  {
    name: "Lenoir News-Topic (Caldwell County)",
    baseUrl: "https://www.newstopicnews.com/search/?f=rss&t=article&l=25&s=start_time&sd=desc",
    enabled: true,
    pullFrequency: "HOURLY" as const,
  },
  {
    name: "Anson Record (Anson County)",
    baseUrl: "https://ansonrecord.com/feed/",
    enabled: true,
    pullFrequency: "HOURLY" as const,
  },
  {
    name: "Taylorsville Times (Alexander County)",
    baseUrl: "https://www.taylorsvilletimes.com/feed/",
    enabled: true,
    pullFrequency: "HOURLY" as const,
  },
  {
    name: "The Link (Chesterfield County SC)",
    baseUrl: "https://www.thelinkpaper.com/feed/",
    enabled: true,
    pullFrequency: "HOURLY" as const,
  },
  {
    name: "Stanly News & Press (Stanly County)",
    baseUrl: "https://thesnaponline.com/search/?f=rss&t=article&l=25&s=start_time&sd=desc",
    enabled: true,
    pullFrequency: "HOURLY" as const,
  },
  {
    name: "Charlotte Parent (Family)",
    baseUrl: "https://www.charlotteparent.com/feed/",
    enabled: true,
    pullFrequency: "HOURLY" as const,
  },
  {
    name: "Charlotte Stories (Community)",
    baseUrl: "https://www.charlottestories.com/feed/",
    enabled: true,
    pullFrequency: "HOURLY" as const,
  },
  {
    name: "Unpretentious Palate (Food)",
    baseUrl: "https://unpretentiouspalate.com/feed/",
    enabled: true,
    pullFrequency: "HOURLY" as const,
  },
  {
    name: "Charlotte Five (Food/Drink)",
    baseUrl: "https://www.charlottefive.com/feed/",
    enabled: true,
    pullFrequency: "HOURLY" as const,
  },
  {
    name: "Off the Eaten Path (Food/Travel)",
    baseUrl: "https://www.offtheeatenpathblog.com/feed/",
    enabled: true,
    pullFrequency: "HOURLY" as const,
  },
  {
    name: "Discovery Place (Family/Education)",
    baseUrl: "https://discoveryplace.org/feed/",
    enabled: true,
    pullFrequency: "HOURLY" as const,
  },
  {
    name: "York County Regional Chamber (Business)",
    baseUrl: "https://www.yorkcountychamber.com/feed/",
    enabled: true,
    pullFrequency: "HOURLY" as const,
  },
  {
    name: "Patch Charlotte",
    baseUrl: "https://patch.com/north-carolina/charlotte/rss",
    enabled: true,
    pullFrequency: "HOURLY" as const,
  },
  {
    name: "Patch Fort Mill (York County SC)",
    baseUrl: "https://patch.com/south-carolina/fortmill/rss",
    enabled: true,
    pullFrequency: "HOURLY" as const,
  },
  {
    name: "Patch Rock Hill (York County SC)",
    baseUrl: "https://patch.com/south-carolina/rockhill/rss",
    enabled: true,
    pullFrequency: "HOURLY" as const,
  },
  {
    name: "Patch Huntersville",
    baseUrl: "https://patch.com/north-carolina/huntersville/rss",
    enabled: true,
    pullFrequency: "HOURLY" as const,
  },
  {
    name: "Patch Concord",
    baseUrl: "https://patch.com/north-carolina/concord/rss",
    enabled: true,
    pullFrequency: "HOURLY" as const,
  },
  {
    name: "Patch Matthews-Mint Hill",
    baseUrl: "https://patch.com/north-carolina/matthews-mint-hill/rss",
    enabled: true,
    pullFrequency: "HOURLY" as const,
  },
  {
    name: "Patch Monroe (Union County)",
    baseUrl: "https://patch.com/north-carolina/monroe/rss",
    enabled: true,
    pullFrequency: "HOURLY" as const,
  },
  {
    name: "Patch Cornelius-Davidson",
    baseUrl: "https://patch.com/north-carolina/cornelius-davidson/rss",
    enabled: true,
    pullFrequency: "HOURLY" as const,
  },
  {
    name: "Patch Mooresville",
    baseUrl: "https://patch.com/north-carolina/mooresville/rss",
    enabled: true,
    pullFrequency: "HOURLY" as const,
  },
  {
    name: "Patch Ballantyne",
    baseUrl: "https://patch.com/north-carolina/ballantyne/rss",
    enabled: true,
    pullFrequency: "HOURLY" as const,
  },
  {
    name: "Patch Gastonia",
    baseUrl: "https://patch.com/north-carolina/gastonia/rss",
    enabled: true,
    pullFrequency: "HOURLY" as const,
  },
  {
    name: "Patch Indian Trail (Union County)",
    baseUrl: "https://patch.com/north-carolina/indian-trail/rss",
    enabled: true,
    pullFrequency: "HOURLY" as const,
  },
  {
    name: "Patch Waxhaw (Union County)",
    baseUrl: "https://patch.com/north-carolina/waxhaw/rss",
    enabled: true,
    pullFrequency: "HOURLY" as const,
  },
  {
    name: "Patch Lake Norman",
    baseUrl: "https://patch.com/north-carolina/lake-norman/rss",
    enabled: true,
    pullFrequency: "HOURLY" as const,
  },
  {
    name: "Patch Pineville",
    baseUrl: "https://patch.com/north-carolina/pineville/rss",
    enabled: true,
    pullFrequency: "HOURLY" as const,
  },
  {
    name: "Patch Mint Hill",
    baseUrl: "https://patch.com/north-carolina/mint-hill/rss",
    enabled: true,
    pullFrequency: "HOURLY" as const,
  },
  {
    name: "Cornelius Today (Lake Norman)",
    baseUrl: "https://corneliustoday.com/feed/",
    enabled: true,
    pullFrequency: "HOURLY" as const,
  },
  {
    name: "Davidson News (Lake Norman)",
    baseUrl: "https://www.davidsonnews.net/feed/",
    enabled: true,
    pullFrequency: "HOURLY" as const,
  },
  {
    name: "Lake Norman Citizen",
    baseUrl: "https://lakenormancitizen.com/feed/",
    enabled: true,
    pullFrequency: "HOURLY" as const,
  },
  {
    name: "Fort Mill Times (York County)",
    baseUrl: "https://www.fortmilltimes.com/news/local/?service=rss",
    enabled: true,
    pullFrequency: "HOURLY" as const,
  },
  {
    name: "South Charlotte Weekly",
    baseUrl: "https://www.southcharlotteweekly.com/feed/",
    enabled: true,
    pullFrequency: "HOURLY" as const,
  },
  {
    name: "Matthews Mint Hill Weekly",
    baseUrl: "https://www.matthewsminthillweekly.com/feed/",
    enabled: true,
    pullFrequency: "HOURLY" as const,
  },
  {
    name: "Ballantyne Magazine",
    baseUrl: "https://www.ballantynemagazine.com/feed/",
    enabled: true,
    pullFrequency: "HOURLY" as const,
  },
  {
    name: "Charlotte Is Creative",
    baseUrl: "https://www.charlotteiscreative.com/feed/",
    enabled: true,
    pullFrequency: "HOURLY" as const,
  },
  {
    name: "Charlotte Center City Partners",
    baseUrl: "https://www.charlottecentercity.org/feed/",
    enabled: true,
    pullFrequency: "HOURLY" as const,
  },
];

async function seedRssSources() {
  console.log("[SEED-RSS] Starting RSS sources seed...");

  const existingCities = await db.select().from(cities);
  const charlotteCity = existingCities.find((c) => c.slug === "charlotte");

  if (!charlotteCity) {
    console.error("[SEED-RSS] Charlotte city not found! Run main seed first.");
    process.exit(1);
  }

  console.log(`[SEED-RSS] Charlotte city ID: ${charlotteCity.id}`);

  for (const src of RSS_SOURCES) {
    const existing = await db
      .select()
      .from(metroSources)
      .where(and(eq(metroSources.cityId, charlotteCity.id), eq(metroSources.baseUrl, src.baseUrl)));

    if (existing.length > 0) {
      console.log(`[SEED-RSS] Already exists: ${src.name}`);
      continue;
    }

    const [created] = await db
      .insert(metroSources)
      .values({
        cityId: charlotteCity.id,
        name: src.name,
        sourceType: "RSS",
        baseUrl: src.baseUrl,
        enabled: src.enabled,
        pullFrequency: src.pullFrequency,
      })
      .returning();

    console.log(`[SEED-RSS] Created: ${created.name} (${created.id}) enabled=${created.enabled}`);
  }

  console.log("[SEED-RSS] Done.");
  process.exit(0);
}

seedRssSources().catch((err) => {
  console.error("[SEED-RSS] Error:", err);
  process.exit(1);
});
