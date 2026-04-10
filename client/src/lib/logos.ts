import cltCityHub from "@assets/CLT_Charlotte_Skyline_Transparent_1772937096782.png";
import cltSkylineBanner from "@assets/CLT_Skyline_Logo_1772937096781.png";
import cltBiz from "@assets/CLT_Biz_1771464301059.png";
import cltFood from "@assets/CLT_food_1771464301060.png";
import cltFamily from "@assets/CLT_Family_1771464301061.png";
import cltEvents from "@assets/CLT_Events_1771464301061.png";
import cltPets from "@assets/CLT_Pets_1771464301060.png";
import cltSeniors from "@assets/CLT_Senior_1771464301061.png";
import cltMarketplace from "@assets/CLT_Marketplace_1771464301060.png";

export const mainLogo = cltCityHub;
export const skylineBanner = cltSkylineBanner;

export const categoryLogos: Record<string, string> = {
  biz: cltBiz,
  food: cltFood,
  family: cltFamily,
  events: cltEvents,
  pets: cltPets,
  seniors: cltSeniors,
  marketplace: cltMarketplace,
};

export function getCategoryLogo(slug: string): string | undefined {
  return categoryLogos[slug];
}
