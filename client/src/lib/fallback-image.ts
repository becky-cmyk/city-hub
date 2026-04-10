import charlotteSkyline from "@assets/Charlotte_skyline_1771524746637.jpg";

const CATEGORY_IMAGE_MAP: Record<string, string> = {
  "bars-breweries": "/images/seed/brewery.png",
  "brewery": "/images/seed/brewery.png",
  "coffee-shop": "/images/seed/coffee-shop.png",
  "coffee-tea": "/images/seed/coffee-shop.png",
  "boba": "/images/seed/coffee-shop.png",
  "food-truck": "/images/seed/food-truck.png",
  "food-trucks": "/images/seed/food-truck.png",
  "coworking": "/images/seed/coworking.png",
  "pet-spa": "/images/seed/pet-spa.png",
  "boarding-daycare-health": "/images/seed/pet-spa.png",
  "senior-center": "/images/seed/senior-center.png",
  "art-walk": "/images/seed/art-walk.png",
  "art-classes": "/images/seed/art-walk.png",
  "arts-culture": "/images/seed/art-walk.png",
  "art-prints": "/images/seed/art-walk.png",
  "parks": "/images/seed/parks.png",
  "bakeries-desserts": "/images/seed/coffee-shop.png",
  "brunch": "/images/seed/coffee-shop.png",
  "bbq-catering": "/images/seed/food-truck.png",
  "boutique": "/images/seed/south-end.png",
  "beauty-personal-care": "/images/seed/south-end.png",
  "family-adventure": "/images/seed/family-adventure.png",
  "birthday-parties": "/images/seed/family-day.png",
  "after-school-programs": "/images/seed/family-day.png",
};

function isValidPublicImage(url: string | null | undefined): boolean {
  if (!url) return false;
  if (url.startsWith("data:")) return false;
  return true;
}

export function getBusinessFallbackImage(
  imageUrl: string | null | undefined,
  categorySlugs: string[]
): string {
  if (isValidPublicImage(imageUrl)) return imageUrl!;

  for (const slug of categorySlugs) {
    if (CATEGORY_IMAGE_MAP[slug]) return CATEGORY_IMAGE_MAP[slug];
  }

  return charlotteSkyline;
}

export function getSmallFallbackImage(
  imageUrl: string | null | undefined,
  categorySlugs: string[]
): string | null {
  if (isValidPublicImage(imageUrl)) return imageUrl!;

  for (const slug of categorySlugs) {
    if (CATEGORY_IMAGE_MAP[slug]) return CATEGORY_IMAGE_MAP[slug];
  }

  return null;
}
