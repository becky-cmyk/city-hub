export const PARENT_BRAND = "City Metro Hub";
export const PARENT_DOMAIN = "citymetrohub.com";

export interface CityBranding {
  citySlug: string;
  airportCode: string;
  cityName: string;
  brandShort: string;
  brandLong: string;
  brandVariants: string[];
  domains: string[];
  primaryDomain: string;
  secondaryDomain: string;
  parentBrand: string;
  parentDomain: string;
  emailFrom: string;
  aiGuideName: string;
  hashtags: string[];
}

export type PageBrandContext = "home" | "hub" | "category" | "landing" | "article" | "default";

export function getBrandForContext(branding: CityBranding, context: PageBrandContext): {
  ogSiteName: string;
  titleSuffix: string;
  jsonLdName: string;
  descriptionBrand: string;
  sameAs: string[];
} {
  const sameAs = branding.domains.map(d => `https://${d}`);
  const v = branding.brandVariants;
  const short = v[0] || branding.brandShort;
  const metro = v[1] || branding.brandShort;
  const cityHub = v[2] || `${branding.cityName} City Hub`;
  const codeCity = v[3] || `${branding.airportCode} City Hub`;
  const long = v[4] || branding.brandLong;
  switch (context) {
    case "home":
      return { ogSiteName: short, titleSuffix: `| ${cityHub}`, jsonLdName: long, descriptionBrand: `${short} (${long})`, sameAs };
    case "hub":
      return { ogSiteName: short, titleSuffix: `| ${short}`, jsonLdName: long, descriptionBrand: `${short} and ${metro}`, sameAs };
    case "category":
      return { ogSiteName: short, titleSuffix: `| ${metro}`, jsonLdName: long, descriptionBrand: `${long} and ${short}`, sameAs };
    case "landing":
      return { ogSiteName: short, titleSuffix: `| ${codeCity}`, jsonLdName: long, descriptionBrand: `${short} — ${codeCity}`, sameAs };
    case "article":
      return { ogSiteName: short, titleSuffix: `| ${long}`, jsonLdName: long, descriptionBrand: `${long} and ${short}`, sameAs };
    default:
      return { ogSiteName: short, titleSuffix: `| ${short}`, jsonLdName: long, descriptionBrand: short, sameAs };
  }
}

const CITY_BRANDING: Record<string, CityBranding> = {
  charlotte: {
    citySlug: "charlotte",
    airportCode: "CLT",
    cityName: "Charlotte",
    brandShort: "CLT Metro Hub",
    brandLong: "Charlotte Metro Hub",
    brandVariants: ["CLT Hub", "CLT Metro Hub", "Charlotte City Hub", "CLT City Hub", "Charlotte Metro Hub"],
    domains: ["cltcityhub.com", "charlottecityhub.com", "cltmetrohub.com", "charlottemetrohub.com"],
    primaryDomain: "cltcityhub.com",
    secondaryDomain: "charlottecityhub.com",
    parentBrand: PARENT_BRAND,
    parentDomain: PARENT_DOMAIN,
    emailFrom: "CLT Metro Hub <hello@cltcityhub.com>",
    aiGuideName: "Charlotte",
    hashtags: ["#CLT", "#Charlotte", "#CharlotteNC", "#QueenCity"],
  },
};

export function getCityBranding(slug: string): CityBranding | undefined {
  return CITY_BRANDING[slug];
}

export interface CityRecord {
  name: string;
  slug: string;
  cityCode?: string | null;
  brandName?: string | null;
  aiGuideName?: string | null;
  siteUrl?: string | null;
  emailDomain?: string | null;
}

export function buildCityBranding(city: CityRecord): CityBranding {
  const staticBranding = CITY_BRANDING[city.slug];
  if (staticBranding) return staticBranding;

  const code = city.cityCode || city.name.substring(0, 3).toUpperCase();
  const brandShort = city.brandName || `${code} Metro Hub`;
  const domain = city.emailDomain || city.siteUrl?.replace(/^https?:\/\//, "") || PARENT_DOMAIN;
  const aiName = city.aiGuideName || city.name;

  const brandLong = `${city.name} Metro Hub`;
  return {
    citySlug: city.slug,
    airportCode: code,
    cityName: city.name,
    brandShort,
    brandLong,
    brandVariants: [`${code} Hub`, brandShort, `${city.name} City Hub`, `${code} City Hub`, brandLong],
    domains: [domain],
    primaryDomain: domain,
    secondaryDomain: domain,
    parentBrand: PARENT_BRAND,
    parentDomain: PARENT_DOMAIN,
    emailFrom: `${brandShort} <hello@${domain}>`,
    aiGuideName: aiName,
    hashtags: [`#${code}`, `#${city.name.replace(/\s+/g, "")}`, `#${city.name.replace(/\s+/g, "")}MetroHub`],
  };
}

export const CLT = CITY_BRANDING.charlotte;
