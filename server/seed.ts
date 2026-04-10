import { storage } from "./storage";
import { db } from "./db";
import { cities, categories, zones, users, publicUsers, transitLines, transitStops, emailTemplates, tags, articles, businesses, interviewQuestionTemplates } from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { seedHubsAndCoverage } from "./seed-hubs-coverage";
import { seedTerritoryPricing } from "./seed-territory-pricing";
import { seedAdPrograms } from "./seed-ad-programs";
import { seedTvContent } from "./seed-tv-content";
import { seedFarmHubs } from "./seed-farm-hubs";
import { seedMetroAndZips } from "./seed-metro-zips";
import { CORE_FEED_TOPICS } from "./feed-routes";

export async function seedDatabase() {
  const existingCities = await db.select().from(cities);
  if (existingCities.length > 0) {
    const charlotte = existingCities.find(c => c.slug === "charlotte");
    const city = charlotte || existingCities[0];
    const cityUpdates: Record<string, any> = {};
    if (city.slug !== "charlotte") {
      console.log(`[SEED] Fixing city slug: "${city.slug}" → "charlotte"`);
      cityUpdates.slug = "charlotte";
    }
    if (!city.isLive) cityUpdates.isLive = true;
    if (!city.siteUrl || city.siteUrl.includes("cltmetrohub")) cityUpdates.siteUrl = "https://cltcityhub.com";
    if (!city.emailDomain || city.emailDomain.includes("cltmetrohub")) cityUpdates.emailDomain = "cltcityhub.com";
    if ((city as any).brandName && (city as any).brandName.includes("City Hub")) cityUpdates.brandName = "CLT Metro Hub";
    if (!(city as any).cityCode || ((city as any).cityCode !== "CLT" && city.slug === "charlotte")) cityUpdates.cityCode = "CLT";
    if (Object.keys(cityUpdates).length > 0) {
      await db.update(cities).set(cityUpdates).where(eq(cities.id, city.id));
      console.log(`[SEED] Updated city fields:`, Object.keys(cityUpdates).join(", "));
    }
    await ensureCategoriesSeeded(city.id);
    await ensureMetroZonesSeeded(city.id);
    await ensureEmailTemplatesSeeded();
    await ensureCoreTopicTagsSeeded();
    try {
      const metroResult = await seedMetroAndZips();
      console.log(`[SEED] Metro/county seed: ${metroResult.counties.filter(c => c.action === "created").length} created, ${metroResult.counties.filter(c => c.action === "skipped").length} skipped`);
    } catch (e: any) {
      console.warn(`[SEED] Metro/county seed error: ${e.message}`);
    }
    try {
      const hubResult = await seedHubsAndCoverage();
      console.log(`[SEED] Hub seed: ${hubResult.hubsCreated.filter(h => h.action === "created").length} created, ${hubResult.hubsCreated.filter(h => h.action === "skipped").length} skipped, ${hubResult.coverageMappings.inserted} coverage mappings`);
    } catch (e: any) {
      console.warn(`[SEED] Hub seed skipped (prerequisites may be missing): ${e.message}`);
    }
    try {
      await seedTerritoryPricing();
    } catch (e: any) {
      console.warn(`[SEED] Territory pricing seed error: ${e.message}`);
    }
    try {
      await seedAdPrograms();
    } catch (e: any) {
      console.warn(`[SEED] Ad programs seed error: ${e.message}`);
    }
    try {
      const { platformAffiliates } = await import("@shared/schema");
      const platforms = ["uber", "lyft", "doordash", "ubereats", "grubhub", "postmates"];
      for (const p of platforms) {
        await db.insert(platformAffiliates).values({ platform: p }).onConflictDoNothing();
      }
    } catch (e: any) {
      console.warn(`[SEED] Platform affiliates seed error: ${e.message}`);
    }
    try {
      await seedTvContent();
    } catch (e: any) {
      console.warn(`[SEED] TV content seed error: ${e.message}`);
    }
    try {
      await seedFarmHubs();
    } catch (e: any) {
      console.warn(`[SEED] Farm hubs seed error: ${e.message}`);
    }
    await ensureLiveFeedOrgsSeeded(city.id);
    try {
      await seedStoryArticles(city.id);
    } catch (e: any) {
      console.warn(`[SEED] Story articles seed error: ${e.message}`);
    }
    try {
      await seedDefaultInterviewQuestions();
    } catch (e: any) {
      console.warn(`[SEED] Interview questions seed error: ${e.message}`);
    }
    try {
      await fixMiscategorizedBeautyBusinesses();
    } catch (e: any) {
      console.warn(`[SEED] Category fix error: ${e.message}`);
    }
    console.log("Database already seeded, skipping...");
    return;
  }

  console.log("Seeding database...");

  // 1. Create CLT city
  const clt = await storage.createCity({
    name: "Charlotte",
    slug: "charlotte",
    isActive: true,
    isLive: true,
    brandName: "CLT Metro Hub",
    cityCode: "CLT",
    primaryColor: "#2563eb",
    siteUrl: "https://cltcityhub.com",
    emailDomain: "cltcityhub.com",
  });

  // 2. Categories (industry-type parent categories)
  const catData = [
    { name: "Restaurant & Dining", slug: "restaurant-dining", icon: "UtensilsCrossed", sortOrder: 1 },
    { name: "Professional Services", slug: "professional-services-cat", icon: "Briefcase", sortOrder: 2 },
    { name: "Health & Wellness", slug: "health-wellness-cat", icon: "HeartPulse", sortOrder: 3 },
    { name: "Home Services", slug: "home-services-cat", icon: "Wrench", sortOrder: 4 },
    { name: "Retail & Shopping", slug: "retail-shopping-cat", icon: "ShoppingBag", sortOrder: 5 },
    { name: "Beauty & Personal Care", slug: "beauty-personal-care", icon: "Sparkles", sortOrder: 6 },
    { name: "Entertainment & Recreation", slug: "entertainment-recreation", icon: "Music", sortOrder: 7 },
    { name: "Nonprofit & Faith", slug: "nonprofit-faith", icon: "HandHeart", sortOrder: 8 },
    { name: "Mobile & Home-Based", slug: "mobile-home-based", icon: "Truck", sortOrder: 9 },
    { name: "Local Farms & Food Sources", slug: "local-farms-food-sources", icon: "Leaf", sortOrder: 10 },
  ];

  const createdCategories: Record<string, string> = {};
  for (const cat of catData) {
    const c = await storage.createCategory(cat);
    createdCategories[cat.slug] = c.id;
  }

  // 2b. Subcategories
  const subCatData = [
    { name: "Fine Dining", slug: "fine-dining", icon: "Wine", parentCategoryId: createdCategories["restaurant-dining"], sortOrder: 1 },
    { name: "Casual Dining", slug: "casual-dining", icon: "Utensils", parentCategoryId: createdCategories["restaurant-dining"], sortOrder: 2 },
    { name: "Fast Casual", slug: "fast-casual", icon: "Sandwich", parentCategoryId: createdCategories["restaurant-dining"], sortOrder: 3 },
    { name: "Coffee & Tea", slug: "coffee-tea", icon: "Coffee", parentCategoryId: createdCategories["restaurant-dining"], sortOrder: 4 },
    { name: "Bars & Breweries", slug: "bars-breweries", icon: "Beer", parentCategoryId: createdCategories["restaurant-dining"], sortOrder: 5 },
    { name: "Bakeries & Desserts", slug: "bakeries-desserts", icon: "CakeSlice", parentCategoryId: createdCategories["restaurant-dining"], sortOrder: 6 },
    { name: "Food Trucks", slug: "food-trucks", icon: "Truck", parentCategoryId: createdCategories["restaurant-dining"], sortOrder: 7 },
    { name: "Catering", slug: "catering", icon: "ChefHat", parentCategoryId: createdCategories["restaurant-dining"], sortOrder: 8 },
    { name: "Food Trucks", slug: "mobile-food-trucks", icon: "Truck", parentCategoryId: createdCategories["mobile-home-based"], sortOrder: 1 },
    { name: "Mobile Services", slug: "mobile-services", icon: "MapPin", parentCategoryId: createdCategories["mobile-home-based"], sortOrder: 2 },
    { name: "Home-Based Business", slug: "home-based-business", icon: "Home", parentCategoryId: createdCategories["mobile-home-based"], sortOrder: 3 },
    { name: "Side Hustle / Freelance", slug: "side-hustle-freelance", icon: "Briefcase", parentCategoryId: createdCategories["mobile-home-based"], sortOrder: 4 },
    { name: "Legal", slug: "legal", icon: "Scale", parentCategoryId: createdCategories["professional-services-cat"], sortOrder: 1 },
    { name: "Accounting & Tax", slug: "accounting-tax", icon: "Calculator", parentCategoryId: createdCategories["professional-services-cat"], sortOrder: 2 },
    { name: "Real Estate", slug: "real-estate", icon: "Home", parentCategoryId: createdCategories["professional-services-cat"], sortOrder: 3 },
    { name: "Insurance", slug: "insurance", icon: "Shield", parentCategoryId: createdCategories["professional-services-cat"], sortOrder: 4 },
    { name: "Financial Services", slug: "financial-services", icon: "DollarSign", parentCategoryId: createdCategories["professional-services-cat"], sortOrder: 5 },
    { name: "Marketing & Advertising", slug: "marketing-advertising", icon: "Megaphone", parentCategoryId: createdCategories["professional-services-cat"], sortOrder: 6 },
    { name: "IT & Technology", slug: "it-technology", icon: "Monitor", parentCategoryId: createdCategories["professional-services-cat"], sortOrder: 7 },
    { name: "Consulting", slug: "consulting", icon: "Users", parentCategoryId: createdCategories["professional-services-cat"], sortOrder: 8 },
    { name: "Barter", slug: "barter", icon: "ArrowLeftRight", parentCategoryId: createdCategories["professional-services-cat"], sortOrder: 9 },
    { name: "Medical & Dental", slug: "medical-dental", icon: "Stethoscope", parentCategoryId: createdCategories["health-wellness-cat"], sortOrder: 1 },
    { name: "Mental Health", slug: "mental-health", icon: "Brain", parentCategoryId: createdCategories["health-wellness-cat"], sortOrder: 2 },
    { name: "Fitness & Gym", slug: "fitness-gym", icon: "Dumbbell", parentCategoryId: createdCategories["health-wellness-cat"], sortOrder: 3 },
    { name: "Yoga & Pilates", slug: "yoga-pilates", icon: "Flower2", parentCategoryId: createdCategories["health-wellness-cat"], sortOrder: 4 },
    { name: "Chiropractic & PT", slug: "chiropractic-pt", icon: "Activity", parentCategoryId: createdCategories["health-wellness-cat"], sortOrder: 5 },
    { name: "Veterinary & Pet Health", slug: "veterinary-pet-health", icon: "PawPrint", parentCategoryId: createdCategories["health-wellness-cat"], sortOrder: 6 },
    { name: "Pharmacy", slug: "pharmacy", icon: "Pill", parentCategoryId: createdCategories["health-wellness-cat"], sortOrder: 7 },
    { name: "Plumbing", slug: "plumbing", icon: "Droplets", parentCategoryId: createdCategories["home-services-cat"], sortOrder: 1 },
    { name: "Electrical", slug: "electrical", icon: "Zap", parentCategoryId: createdCategories["home-services-cat"], sortOrder: 2 },
    { name: "HVAC", slug: "hvac", icon: "Fan", parentCategoryId: createdCategories["home-services-cat"], sortOrder: 3 },
    { name: "Landscaping", slug: "landscaping", icon: "Trees", parentCategoryId: createdCategories["home-services-cat"], sortOrder: 4 },
    { name: "Cleaning", slug: "cleaning", icon: "SprayCan", parentCategoryId: createdCategories["home-services-cat"], sortOrder: 5 },
    { name: "Roofing & Siding", slug: "roofing-siding", icon: "HardHat", parentCategoryId: createdCategories["home-services-cat"], sortOrder: 6 },
    { name: "Moving & Storage", slug: "moving-storage", icon: "Package", parentCategoryId: createdCategories["home-services-cat"], sortOrder: 7 },
    { name: "Pest Control", slug: "pest-control", icon: "Bug", parentCategoryId: createdCategories["home-services-cat"], sortOrder: 8 },
    { name: "Clothing & Apparel", slug: "clothing-apparel", icon: "Shirt", parentCategoryId: createdCategories["retail-shopping-cat"], sortOrder: 1 },
    { name: "Grocery & Market", slug: "grocery-market", icon: "Apple", parentCategoryId: createdCategories["retail-shopping-cat"], sortOrder: 2 },
    { name: "Electronics", slug: "electronics", icon: "Smartphone", parentCategoryId: createdCategories["retail-shopping-cat"], sortOrder: 3 },
    { name: "Furniture & Home Decor", slug: "furniture-home-decor", icon: "Sofa", parentCategoryId: createdCategories["retail-shopping-cat"], sortOrder: 4 },
    { name: "Gifts & Specialty", slug: "gifts-specialty", icon: "Gift", parentCategoryId: createdCategories["retail-shopping-cat"], sortOrder: 5 },
    { name: "Pet Supplies", slug: "pet-supplies", icon: "PawPrint", parentCategoryId: createdCategories["retail-shopping-cat"], sortOrder: 6 },
    { name: "Automotive", slug: "automotive", icon: "Car", parentCategoryId: createdCategories["retail-shopping-cat"], sortOrder: 7 },
    { name: "Hair Salon", slug: "hair-salon", icon: "Scissors", parentCategoryId: createdCategories["beauty-personal-care"], sortOrder: 1 },
    { name: "Barbershop", slug: "barbershop", icon: "Scissors", parentCategoryId: createdCategories["beauty-personal-care"], sortOrder: 2 },
    { name: "Spa & Massage", slug: "spa-massage", icon: "Droplets", parentCategoryId: createdCategories["beauty-personal-care"], sortOrder: 3 },
    { name: "Nail Salon", slug: "nail-salon", icon: "Sparkles", parentCategoryId: createdCategories["beauty-personal-care"], sortOrder: 4 },
    { name: "Skincare & Aesthetics", slug: "skincare-aesthetics", icon: "Flower2", parentCategoryId: createdCategories["beauty-personal-care"], sortOrder: 5 },
    { name: "Arts & Culture", slug: "arts-culture", icon: "Palette", parentCategoryId: createdCategories["entertainment-recreation"], sortOrder: 1 },
    { name: "Sports & Athletics", slug: "sports-athletics", icon: "Trophy", parentCategoryId: createdCategories["entertainment-recreation"], sortOrder: 2 },
    { name: "Music & Nightlife", slug: "music-nightlife", icon: "Music", parentCategoryId: createdCategories["entertainment-recreation"], sortOrder: 3 },
    { name: "Family Fun", slug: "family-fun", icon: "Puzzle", parentCategoryId: createdCategories["entertainment-recreation"], sortOrder: 4 },
    { name: "Parks & Outdoors", slug: "parks-outdoors", icon: "Trees", parentCategoryId: createdCategories["entertainment-recreation"], sortOrder: 5 },
    { name: "Education & Learning", slug: "education-learning", icon: "GraduationCap", parentCategoryId: createdCategories["entertainment-recreation"], sortOrder: 6 },
    { name: "Churches & Places of Worship", slug: "churches-places-of-worship", icon: "Church", parentCategoryId: createdCategories["nonprofit-faith"], sortOrder: 1 },
    { name: "Community Organizations", slug: "community-orgs", icon: "Users", parentCategoryId: createdCategories["nonprofit-faith"], sortOrder: 2 },
    { name: "Youth Programs", slug: "youth-programs", icon: "Sparkles", parentCategoryId: createdCategories["nonprofit-faith"], sortOrder: 3 },
    { name: "Senior Services", slug: "senior-services", icon: "Heart", parentCategoryId: createdCategories["nonprofit-faith"], sortOrder: 4 },
    { name: "Civic & Advocacy", slug: "civic-advocacy", icon: "Scale", parentCategoryId: createdCategories["nonprofit-faith"], sortOrder: 5 },
    { name: "Farms", slug: "farms", icon: "Tractor", parentCategoryId: createdCategories["local-farms-food-sources"], sortOrder: 1 },
    { name: "Meat Producers", slug: "meat-producers", icon: "Beef", parentCategoryId: createdCategories["local-farms-food-sources"], sortOrder: 2 },
    { name: "Egg Producers", slug: "egg-producers", icon: "Egg", parentCategoryId: createdCategories["local-farms-food-sources"], sortOrder: 3 },
    { name: "CSA / Farm Boxes", slug: "csa-farm-boxes", icon: "Package", parentCategoryId: createdCategories["local-farms-food-sources"], sortOrder: 4 },
    { name: "Farm Co-ops / Buying Clubs", slug: "farm-coops-buying-clubs", icon: "Users", parentCategoryId: createdCategories["local-farms-food-sources"], sortOrder: 5 },
    { name: "Pickup Locations", slug: "farm-pickup-locations", icon: "MapPin", parentCategoryId: createdCategories["local-farms-food-sources"], sortOrder: 6 },
    { name: "Farmers Markets", slug: "farmers-markets", icon: "Store", parentCategoryId: createdCategories["local-farms-food-sources"], sortOrder: 7 },
    { name: "Farm Stores / Farm Stands", slug: "farm-stores-stands", icon: "ShoppingBasket", parentCategoryId: createdCategories["local-farms-food-sources"], sortOrder: 8 },
    { name: "Local Food Specialty Sources", slug: "local-food-specialty", icon: "Cherry", parentCategoryId: createdCategories["local-farms-food-sources"], sortOrder: 9 },
    { name: "Homestead / Backyard Food Support", slug: "homestead-backyard-support", icon: "Sprout", parentCategoryId: createdCategories["local-farms-food-sources"], sortOrder: 10 },
  ];

  for (const sub of subCatData) {
    const c = await storage.createCategory(sub);
    createdCategories[sub.slug] = c.id;
  }

  // 2c. Churches & Places of Worship L3 denomination subcategories
  const worshipL3Data = [
    { name: "Baptist", slug: "baptist", icon: "Church", sortOrder: 1 },
    { name: "Catholic", slug: "catholic", icon: "Church", sortOrder: 2 },
    { name: "Methodist", slug: "methodist", icon: "Church", sortOrder: 3 },
    { name: "Presbyterian", slug: "presbyterian", icon: "Church", sortOrder: 4 },
    { name: "Non-Denominational", slug: "non-denominational", icon: "Church", sortOrder: 5 },
    { name: "Pentecostal", slug: "pentecostal", icon: "Church", sortOrder: 6 },
    { name: "Lutheran", slug: "lutheran", icon: "Church", sortOrder: 7 },
    { name: "Episcopal / Anglican", slug: "episcopal-anglican", icon: "Church", sortOrder: 8 },
    { name: "AME / African Methodist", slug: "ame-african-methodist", icon: "Church", sortOrder: 9 },
    { name: "Church of God", slug: "church-of-god", icon: "Church", sortOrder: 10 },
    { name: "Seventh-day Adventist", slug: "seventh-day-adventist", icon: "Church", sortOrder: 11 },
    { name: "Islamic / Mosque", slug: "islamic-mosque", icon: "Church", sortOrder: 12 },
    { name: "Hindu Temple", slug: "hindu-temple", icon: "Church", sortOrder: 13 },
    { name: "Jewish / Synagogue", slug: "jewish-synagogue", icon: "Church", sortOrder: 14 },
    { name: "Buddhist Temple", slug: "buddhist-temple", icon: "Church", sortOrder: 15 },
    { name: "Sikh Gurdwara", slug: "sikh-gurdwara", icon: "Church", sortOrder: 16 },
    { name: "Other Denomination", slug: "other-denomination", icon: "Church", sortOrder: 17 },
  ];

  for (const item of worshipL3Data) {
    const c = await storage.createCategory({
      ...item,
      parentCategoryId: createdCategories["churches-places-of-worship"],
    });
    createdCategories[item.slug] = c.id;
  }

  // 2d. Farm L3 micro-category subtypes
  const farmL3Data = [
    { parent: "farms", items: [
      { name: "Crop Farm", slug: "crop-farm", icon: "Wheat", sortOrder: 1 },
      { name: "Livestock Farm", slug: "livestock-farm", icon: "Fence", sortOrder: 2 },
      { name: "Mixed Farm", slug: "mixed-farm", icon: "Tractor", sortOrder: 3 },
      { name: "U-Pick Farm", slug: "u-pick-farm", icon: "Apple", sortOrder: 4 },
      { name: "Organic Farm", slug: "organic-farm", icon: "Leaf", sortOrder: 5 },
    ]},
    { parent: "meat-producers", items: [
      { name: "Grass-Fed Beef", slug: "grass-fed-beef", icon: "Beef", sortOrder: 1 },
      { name: "Pastured Pork", slug: "pastured-pork", icon: "Drumstick", sortOrder: 2 },
      { name: "Pasture-Raised Poultry", slug: "pasture-raised-poultry", icon: "Bird", sortOrder: 3 },
      { name: "Lamb & Goat", slug: "lamb-goat", icon: "Fence", sortOrder: 4 },
      { name: "Bulk Beef Sales", slug: "bulk-beef-sales", icon: "Package", sortOrder: 5 },
      { name: "Custom Butchering", slug: "custom-butchering", icon: "Scissors", sortOrder: 6 },
    ]},
    { parent: "egg-producers", items: [
      { name: "Pasture-Raised Eggs", slug: "pasture-raised-eggs", icon: "Egg", sortOrder: 1 },
      { name: "Free-Range Eggs", slug: "free-range-eggs", icon: "Egg", sortOrder: 2 },
      { name: "Duck Eggs", slug: "duck-eggs", icon: "Egg", sortOrder: 3 },
      { name: "Quail Eggs", slug: "quail-eggs", icon: "Egg", sortOrder: 4 },
    ]},
    { parent: "csa-farm-boxes", items: [
      { name: "Produce CSA", slug: "produce-csa", icon: "Carrot", sortOrder: 1 },
      { name: "Meat CSA", slug: "meat-csa", icon: "Beef", sortOrder: 2 },
      { name: "Mixed Farm Box", slug: "mixed-farm-box", icon: "Package", sortOrder: 3 },
      { name: "Egg Subscription", slug: "egg-subscription", icon: "Egg", sortOrder: 4 },
      { name: "Dairy Share", slug: "dairy-share", icon: "Milk", sortOrder: 5 },
    ]},
    { parent: "farm-coops-buying-clubs", items: [
      { name: "Buying Club", slug: "buying-club", icon: "Users", sortOrder: 1 },
      { name: "Food Co-op", slug: "food-co-op", icon: "Store", sortOrder: 2 },
      { name: "Bulk Buying Group", slug: "bulk-buying-group", icon: "Package", sortOrder: 3 },
    ]},
    { parent: "farm-pickup-locations", items: [
      { name: "Farm Pickup", slug: "farm-pickup", icon: "MapPin", sortOrder: 1 },
      { name: "Community Pickup", slug: "community-pickup", icon: "MapPin", sortOrder: 2 },
      { name: "Drop-off Point", slug: "drop-off-point", icon: "MapPin", sortOrder: 3 },
    ]},
    { parent: "farmers-markets", items: [
      { name: "Weekly Market", slug: "weekly-market", icon: "Calendar", sortOrder: 1 },
      { name: "Seasonal Market", slug: "seasonal-market", icon: "Sun", sortOrder: 2 },
      { name: "Indoor Market", slug: "indoor-market", icon: "Store", sortOrder: 3 },
      { name: "Specialty Market", slug: "specialty-market", icon: "Cherry", sortOrder: 4 },
    ]},
    { parent: "farm-stores-stands", items: [
      { name: "Farm Store", slug: "farm-store", icon: "Store", sortOrder: 1 },
      { name: "Roadside Stand", slug: "roadside-stand", icon: "Flag", sortOrder: 2 },
      { name: "Honor System Stand", slug: "honor-system-stand", icon: "DollarSign", sortOrder: 3 },
    ]},
    { parent: "local-food-specialty", items: [
      { name: "Local Honey", slug: "local-honey", icon: "Droplet", sortOrder: 1 },
      { name: "Artisan Cheese", slug: "artisan-cheese", icon: "Cheese", sortOrder: 2 },
      { name: "Specialty Meats", slug: "specialty-meats", icon: "Beef", sortOrder: 3 },
      { name: "Fermented Foods", slug: "fermented-foods", icon: "Flask", sortOrder: 4 },
      { name: "Local Preserves", slug: "local-preserves", icon: "Jar", sortOrder: 5 },
    ]},
    { parent: "homestead-backyard-support", items: [
      { name: "Chicken Coop Supplies", slug: "chicken-coop-supplies", icon: "Bird", sortOrder: 1 },
      { name: "Garden Supplies", slug: "garden-supplies", icon: "Shovel", sortOrder: 2 },
      { name: "Seed & Feed", slug: "seed-feed", icon: "Sprout", sortOrder: 3 },
      { name: "Composting", slug: "composting", icon: "Recycle", sortOrder: 4 },
      { name: "Beekeeping Supplies", slug: "beekeeping-supplies", icon: "Bug", sortOrder: 5 },
    ]},
  ];

  for (const group of farmL3Data) {
    const parentId = createdCategories[group.parent];
    if (parentId) {
      for (const item of group.items) {
        await storage.createCategory({ ...item, parentCategoryId: parentId });
      }
    }
  }

  // 3. Zones — Charlotte Metro Region (NC + SC)
  const zoneData: Array<{ name: string; slug: string; type: "NEIGHBORHOOD" | "DISTRICT" | "ZIP" | "MICRO_HUB"; county: string; stateCode: string; zipCodes: string[] }> = [
    // Charlotte Proper Neighborhoods (Mecklenburg County, NC)
    { name: "Uptown", slug: "uptown", type: "DISTRICT", county: "Mecklenburg", stateCode: "NC", zipCodes: ["28202","28203"] },
    { name: "South End", slug: "south-end", type: "NEIGHBORHOOD", county: "Mecklenburg", stateCode: "NC", zipCodes: ["28203"] },
    { name: "NoDa", slug: "noda", type: "NEIGHBORHOOD", county: "Mecklenburg", stateCode: "NC", zipCodes: ["28205","28206"] },
    { name: "Plaza Midwood", slug: "plaza-midwood", type: "NEIGHBORHOOD", county: "Mecklenburg", stateCode: "NC", zipCodes: ["28205"] },
    { name: "Dilworth", slug: "dilworth", type: "NEIGHBORHOOD", county: "Mecklenburg", stateCode: "NC", zipCodes: ["28203","28207"] },
    { name: "Myers Park", slug: "myers-park", type: "NEIGHBORHOOD", county: "Mecklenburg", stateCode: "NC", zipCodes: ["28207","28209"] },
    { name: "SouthPark", slug: "southpark", type: "NEIGHBORHOOD", county: "Mecklenburg", stateCode: "NC", zipCodes: ["28209","28210","28211"] },
    { name: "Elizabeth", slug: "elizabeth", type: "NEIGHBORHOOD", county: "Mecklenburg", stateCode: "NC", zipCodes: ["28204"] },
    { name: "Cotswold", slug: "cotswold", type: "NEIGHBORHOOD", county: "Mecklenburg", stateCode: "NC", zipCodes: ["28211"] },
    { name: "Montford", slug: "montford", type: "NEIGHBORHOOD", county: "Mecklenburg", stateCode: "NC", zipCodes: ["28209"] },
    { name: "Steele Creek", slug: "steele-creek", type: "NEIGHBORHOOD", county: "Mecklenburg", stateCode: "NC", zipCodes: ["28278"] },
    { name: "Providence", slug: "providence", type: "NEIGHBORHOOD", county: "Mecklenburg", stateCode: "NC", zipCodes: ["28226","28270"] },
    { name: "East Forest", slug: "east-forest", type: "NEIGHBORHOOD", county: "Mecklenburg", stateCode: "NC", zipCodes: ["28212"] },
    { name: "Ayrsley", slug: "ayrsley", type: "NEIGHBORHOOD", county: "Mecklenburg", stateCode: "NC", zipCodes: ["28217"] },
    { name: "Eastway", slug: "eastway", type: "NEIGHBORHOOD", county: "Mecklenburg", stateCode: "NC", zipCodes: ["28212","28205"] },
    // Mecklenburg County towns/districts
    { name: "University City", slug: "university-city", type: "DISTRICT", county: "Mecklenburg", stateCode: "NC", zipCodes: ["28213","28262"] },
    { name: "Ballantyne", slug: "ballantyne", type: "DISTRICT", county: "Mecklenburg", stateCode: "NC", zipCodes: ["28277"] },
    { name: "Northlake", slug: "northlake", type: "DISTRICT", county: "Mecklenburg", stateCode: "NC", zipCodes: ["28216"] },
    { name: "Huntersville", slug: "huntersville", type: "DISTRICT", county: "Mecklenburg", stateCode: "NC", zipCodes: ["28078"] },
    { name: "Cornelius", slug: "cornelius", type: "DISTRICT", county: "Mecklenburg", stateCode: "NC", zipCodes: ["28031"] },
    { name: "Davidson", slug: "davidson", type: "DISTRICT", county: "Mecklenburg", stateCode: "NC", zipCodes: ["28035","28036"] },
    { name: "Mint Hill", slug: "mint-hill", type: "DISTRICT", county: "Mecklenburg", stateCode: "NC", zipCodes: ["28227"] },
    { name: "Matthews", slug: "matthews", type: "DISTRICT", county: "Mecklenburg", stateCode: "NC", zipCodes: ["28104","28105"] },
    { name: "Pineville", slug: "pineville", type: "DISTRICT", county: "Mecklenburg", stateCode: "NC", zipCodes: ["28134"] },
    // Iredell County, NC
    { name: "Mooresville", slug: "mooresville", type: "DISTRICT", county: "Iredell", stateCode: "NC", zipCodes: ["28115","28117"] },
    { name: "Troutman", slug: "troutman", type: "DISTRICT", county: "Iredell", stateCode: "NC", zipCodes: ["28166"] },
    { name: "Statesville", slug: "statesville", type: "DISTRICT", county: "Iredell", stateCode: "NC", zipCodes: ["28625","28677","28687"] },
    // Cabarrus County, NC
    { name: "Concord", slug: "concord", type: "DISTRICT", county: "Cabarrus", stateCode: "NC", zipCodes: ["28025","28027"] },
    { name: "Kannapolis", slug: "kannapolis", type: "DISTRICT", county: "Cabarrus", stateCode: "NC", zipCodes: ["28081","28083"] },
    { name: "Harrisburg", slug: "harrisburg", type: "DISTRICT", county: "Cabarrus", stateCode: "NC", zipCodes: ["28075"] },
    { name: "Midland", slug: "midland", type: "DISTRICT", county: "Cabarrus", stateCode: "NC", zipCodes: ["28107"] },
    { name: "Mount Pleasant", slug: "mount-pleasant", type: "DISTRICT", county: "Cabarrus", stateCode: "NC", zipCodes: ["28124"] },
    // Union County, NC
    { name: "Monroe", slug: "monroe", type: "DISTRICT", county: "Union", stateCode: "NC", zipCodes: ["28110","28112"] },
    { name: "Indian Trail", slug: "indian-trail", type: "DISTRICT", county: "Union", stateCode: "NC", zipCodes: ["28079"] },
    { name: "Weddington", slug: "weddington", type: "DISTRICT", county: "Union", stateCode: "NC", zipCodes: ["28104"] },
    { name: "Waxhaw", slug: "waxhaw", type: "DISTRICT", county: "Union", stateCode: "NC", zipCodes: ["28173"] },
    { name: "Wesley Chapel", slug: "wesley-chapel", type: "DISTRICT", county: "Union", stateCode: "NC", zipCodes: ["28104"] },
    { name: "Stallings", slug: "stallings", type: "DISTRICT", county: "Union", stateCode: "NC", zipCodes: ["28104"] },
    { name: "Marvin", slug: "marvin", type: "DISTRICT", county: "Union", stateCode: "NC", zipCodes: ["28173"] },
    // Gaston County, NC
    { name: "Gastonia", slug: "gastonia", type: "DISTRICT", county: "Gaston", stateCode: "NC", zipCodes: ["28052","28054","28056"] },
    { name: "Belmont", slug: "belmont", type: "DISTRICT", county: "Gaston", stateCode: "NC", zipCodes: ["28012"] },
    { name: "Mount Holly", slug: "mount-holly", type: "DISTRICT", county: "Gaston", stateCode: "NC", zipCodes: ["28120"] },
    { name: "Cramerton", slug: "cramerton", type: "DISTRICT", county: "Gaston", stateCode: "NC", zipCodes: ["28032"] },
    { name: "Lowell", slug: "lowell", type: "DISTRICT", county: "Gaston", stateCode: "NC", zipCodes: ["28098"] },
    { name: "McAdenville", slug: "mcadenville", type: "DISTRICT", county: "Gaston", stateCode: "NC", zipCodes: ["28101"] },
    // Lincoln County, NC
    { name: "Denver", slug: "denver", type: "DISTRICT", county: "Lincoln", stateCode: "NC", zipCodes: ["28037"] },
    { name: "Lincolnton", slug: "lincolnton", type: "DISTRICT", county: "Lincoln", stateCode: "NC", zipCodes: ["28092"] },
    // York County, SC
    { name: "Rock Hill", slug: "rock-hill", type: "DISTRICT", county: "York", stateCode: "SC", zipCodes: ["29730","29732","29733"] },
    { name: "Fort Mill", slug: "fort-mill", type: "DISTRICT", county: "York", stateCode: "SC", zipCodes: ["29715","29708"] },
    { name: "Tega Cay", slug: "tega-cay", type: "DISTRICT", county: "York", stateCode: "SC", zipCodes: ["29708"] },
    { name: "Lake Wylie", slug: "lake-wylie", type: "DISTRICT", county: "York", stateCode: "SC", zipCodes: ["29710"] },
    { name: "Clover", slug: "clover", type: "DISTRICT", county: "York", stateCode: "SC", zipCodes: ["29710"] },
    { name: "York", slug: "york-town", type: "DISTRICT", county: "York", stateCode: "SC", zipCodes: ["29745"] },
    // Lancaster County, SC
    { name: "Indian Land", slug: "indian-land", type: "DISTRICT", county: "Lancaster", stateCode: "SC", zipCodes: ["29707"] },
    { name: "Lancaster", slug: "lancaster", type: "DISTRICT", county: "Lancaster", stateCode: "SC", zipCodes: ["29720"] },
  ];

  const createdZones: Record<string, string> = {};
  for (const z of zoneData) {
    const zone = await storage.createZone({ ...z, cityId: clt.id, isActive: true });
    createdZones[z.slug] = zone.id;
  }

  // 4. Admin user (password: admin123)
  const passwordHash = crypto.createHash("sha256").update("admin123").digest("hex");
  await storage.createUser({
    email: "admin@citymetrohub.com",
    password: passwordHash,
    role: "SUPER_ADMIN",
    name: "Super Admin",
  });

  // 4b. Matching public user for unified login
  const publicPasswordHash = await bcrypt.hash("admin123", 10);
  await storage.createPublicUser({
    email: "admin@citymetrohub.com",
    passwordHash: publicPasswordHash,
    displayName: "Super Admin",
    isVerified: true,
  });

  await ensureCoreTopicTagsSeeded();

  try {
    const metroResult = await seedMetroAndZips();
    console.log(`[SEED] Metro/county seed: ${metroResult.counties.filter(c => c.action === "created").length} created, ${metroResult.counties.filter(c => c.action === "skipped").length} skipped`);
  } catch (e: any) {
    console.warn(`[SEED] Metro/county seed error: ${e.message}`);
  }

  try {
    const hubResult = await seedHubsAndCoverage();
    console.log(`[SEED] Hub seed: ${hubResult.hubsCreated.filter(h => h.action === "created").length} created, ${hubResult.hubsCreated.filter(h => h.action === "skipped").length} skipped, ${hubResult.coverageMappings.inserted} coverage mappings`);
  } catch (e: any) {
    console.warn(`[SEED] Hub seed skipped (prerequisites may be missing): ${e.message}`);
  }

  try {
    await seedStoryArticles(clt.id);
  } catch (e: any) {
    console.warn(`[SEED] Story articles seed error: ${e.message}`);
  }

  try {
    await seedFarmHubs();
  } catch (e: any) {
    console.warn(`[SEED] Farm hubs seed error: ${e.message}`);
  }

  console.log("Database seeded successfully (infrastructure only — no sample content).");

  await seedTransitData(clt.id);
  await seedApartmentCategory(createdCategories);
}

async function ensureCoreTopicTagsSeeded() {
  let created = 0;
  for (const topic of CORE_FEED_TOPICS) {
    const existing = await db.select().from(tags).where(eq(tags.slug, topic.slug)).limit(1);
    if (existing.length === 0) {
      await db.insert(tags).values({
        name: topic.name,
        slug: topic.slug,
        type: "topic",
        icon: topic.icon,
        sortOrder: topic.sortOrder,
      });
      created++;
    }
  }
  if (created > 0) {
    console.log(`[SEED] Created ${created} core topic tags`);
  }
}

async function ensureCategoriesSeeded(cityId: string) {
  const existingCats = await db.select().from(categories).limit(1000);
  const l2Cats = existingCats.filter(c => c.parentCategoryId);

  if (l2Cats.length > 0) {
    console.log(`[SEED] L2 categories already exist (${l2Cats.length} L2s, ${existingCats.length} total)`);
    const existingSlugs = new Set(existingCats.map(c => c.slug));
    const missingL1s = [
      { name: "Mobile & Home-Based", slug: "mobile-home-based", icon: "Truck", sortOrder: 12 },
      { name: "Local Farms & Food Sources", slug: "local-farms-food-sources", icon: "Leaf", sortOrder: 10 },
    ].filter(l1 => !existingSlugs.has(l1.slug));

    const backfillL2Map: Record<string, Array<{ name: string; slug: string; icon: string; sortOrder: number }>> = {
      "mobile-home-based": [
        { name: "Food Trucks", slug: "mobile-food-trucks", icon: "Truck", sortOrder: 1 },
        { name: "Mobile Services", slug: "mobile-services", icon: "MapPin", sortOrder: 2 },
        { name: "Home-Based Business", slug: "home-based-business", icon: "Home", sortOrder: 3 },
        { name: "Side Hustle / Freelance", slug: "side-hustle-freelance", icon: "Briefcase", sortOrder: 4 },
      ],
      "local-farms-food-sources": [
        { name: "Farms", slug: "farms", icon: "Tractor", sortOrder: 1 },
        { name: "Meat Producers", slug: "meat-producers", icon: "Beef", sortOrder: 2 },
        { name: "Egg Producers", slug: "egg-producers", icon: "Egg", sortOrder: 3 },
        { name: "CSA / Farm Boxes", slug: "csa-farm-boxes", icon: "Package", sortOrder: 4 },
        { name: "Farm Co-ops / Buying Clubs", slug: "farm-coops-buying-clubs", icon: "Users", sortOrder: 5 },
        { name: "Pickup Locations", slug: "farm-pickup-locations", icon: "MapPin", sortOrder: 6 },
        { name: "Farmers Markets", slug: "farmers-markets", icon: "Store", sortOrder: 7 },
        { name: "Farm Stores / Farm Stands", slug: "farm-stores-stands", icon: "ShoppingBasket", sortOrder: 8 },
        { name: "Local Food Specialty Sources", slug: "local-food-specialty", icon: "Cherry", sortOrder: 9 },
        { name: "Homestead / Backyard Food Support", slug: "homestead-backyard-support", icon: "Sprout", sortOrder: 10 },
      ],
    };

    const backfillL3Map: Record<string, Array<{ name: string; slug: string; icon: string; sortOrder: number }>> = {
      "farms": [
        { name: "Crop Farm", slug: "crop-farm", icon: "Wheat", sortOrder: 1 },
        { name: "Livestock Farm", slug: "livestock-farm", icon: "Fence", sortOrder: 2 },
        { name: "Mixed Farm", slug: "mixed-farm", icon: "Tractor", sortOrder: 3 },
        { name: "U-Pick Farm", slug: "u-pick-farm", icon: "Apple", sortOrder: 4 },
        { name: "Organic Farm", slug: "organic-farm", icon: "Leaf", sortOrder: 5 },
      ],
      "meat-producers": [
        { name: "Grass-Fed Beef", slug: "grass-fed-beef", icon: "Beef", sortOrder: 1 },
        { name: "Pastured Pork", slug: "pastured-pork", icon: "Drumstick", sortOrder: 2 },
        { name: "Pasture-Raised Poultry", slug: "pasture-raised-poultry", icon: "Bird", sortOrder: 3 },
        { name: "Lamb & Goat", slug: "lamb-goat", icon: "Fence", sortOrder: 4 },
        { name: "Bulk Beef Sales", slug: "bulk-beef-sales", icon: "Package", sortOrder: 5 },
        { name: "Custom Butchering", slug: "custom-butchering", icon: "Scissors", sortOrder: 6 },
      ],
      "egg-producers": [
        { name: "Pasture-Raised Eggs", slug: "pasture-raised-eggs", icon: "Egg", sortOrder: 1 },
        { name: "Free-Range Eggs", slug: "free-range-eggs", icon: "Egg", sortOrder: 2 },
        { name: "Duck Eggs", slug: "duck-eggs", icon: "Egg", sortOrder: 3 },
        { name: "Quail Eggs", slug: "quail-eggs", icon: "Egg", sortOrder: 4 },
      ],
      "csa-farm-boxes": [
        { name: "Produce CSA", slug: "produce-csa", icon: "Carrot", sortOrder: 1 },
        { name: "Meat CSA", slug: "meat-csa", icon: "Beef", sortOrder: 2 },
        { name: "Mixed Farm Box", slug: "mixed-farm-box", icon: "Package", sortOrder: 3 },
        { name: "Egg Subscription", slug: "egg-subscription", icon: "Egg", sortOrder: 4 },
        { name: "Dairy Share", slug: "dairy-share", icon: "Milk", sortOrder: 5 },
      ],
      "farm-coops-buying-clubs": [
        { name: "Buying Club", slug: "buying-club", icon: "Users", sortOrder: 1 },
        { name: "Food Co-op", slug: "food-co-op", icon: "Store", sortOrder: 2 },
        { name: "Bulk Buying Group", slug: "bulk-buying-group", icon: "Package", sortOrder: 3 },
      ],
      "farm-pickup-locations": [
        { name: "Farm Pickup", slug: "farm-pickup", icon: "MapPin", sortOrder: 1 },
        { name: "Community Pickup", slug: "community-pickup", icon: "MapPin", sortOrder: 2 },
        { name: "Drop-off Point", slug: "drop-off-point", icon: "MapPin", sortOrder: 3 },
      ],
      "farmers-markets": [
        { name: "Weekly Market", slug: "weekly-market", icon: "Calendar", sortOrder: 1 },
        { name: "Seasonal Market", slug: "seasonal-market", icon: "Sun", sortOrder: 2 },
        { name: "Indoor Market", slug: "indoor-market", icon: "Store", sortOrder: 3 },
        { name: "Specialty Market", slug: "specialty-market", icon: "Cherry", sortOrder: 4 },
      ],
      "farm-stores-stands": [
        { name: "Farm Store", slug: "farm-store", icon: "Store", sortOrder: 1 },
        { name: "Roadside Stand", slug: "roadside-stand", icon: "Flag", sortOrder: 2 },
        { name: "Honor System Stand", slug: "honor-system-stand", icon: "DollarSign", sortOrder: 3 },
      ],
      "local-food-specialty": [
        { name: "Local Honey", slug: "local-honey", icon: "Droplet", sortOrder: 1 },
        { name: "Artisan Cheese", slug: "artisan-cheese", icon: "Cheese", sortOrder: 2 },
        { name: "Specialty Meats", slug: "specialty-meats", icon: "Beef", sortOrder: 3 },
        { name: "Fermented Foods", slug: "fermented-foods", icon: "Flask", sortOrder: 4 },
        { name: "Local Preserves", slug: "local-preserves", icon: "Jar", sortOrder: 5 },
      ],
      "homestead-backyard-support": [
        { name: "Chicken Coop Supplies", slug: "chicken-coop-supplies", icon: "Bird", sortOrder: 1 },
        { name: "Garden Supplies", slug: "garden-supplies", icon: "Shovel", sortOrder: 2 },
        { name: "Seed & Feed", slug: "seed-feed", icon: "Sprout", sortOrder: 3 },
        { name: "Composting", slug: "composting", icon: "Recycle", sortOrder: 4 },
        { name: "Beekeeping Supplies", slug: "beekeeping-supplies", icon: "Bug", sortOrder: 5 },
      ],
    };

    const createdCategorySlugs: Record<string, string> = {};
    for (const cat of existingCats) {
      createdCategorySlugs[cat.slug] = cat.id;
    }

    if (missingL1s.length > 0) {
      for (const l1 of missingL1s) {
        const created = await storage.createCategory(l1);
        createdCategorySlugs[l1.slug] = created.id;
        console.log(`[SEED] Created missing L1 category: ${l1.name}`);
        const l2Defs = backfillL2Map[l1.slug] || [];
        for (const l2 of l2Defs) {
          if (!existingSlugs.has(l2.slug)) {
            const l2Cat = await storage.createCategory({ ...l2, parentCategoryId: created.id });
            createdCategorySlugs[l2.slug] = l2Cat.id;
            existingSlugs.add(l2.slug);
          }
        }
        console.log(`[SEED] Created L2 subcategories for ${l1.name}`);
      }
    }

    for (const [l2Slug, l3Items] of Object.entries(backfillL3Map)) {
      const parentId = createdCategorySlugs[l2Slug];
      if (!parentId) continue;
      for (const l3 of l3Items) {
        if (!existingSlugs.has(l3.slug)) {
          await storage.createCategory({ ...l3, parentCategoryId: parentId });
          existingSlugs.add(l3.slug);
        }
      }
    }
    console.log(`[SEED] Farm L3 micro-categories backfilled`);

    await seedApartmentCategory({});
    return;
  }

  console.log(`[SEED] No L2 categories found (${existingCats.length} L1s exist). Seeding L1s (if missing) + L2 subcategories...`);

  const l1Defs = [
    { name: "Restaurant & Dining", slug: "restaurant-dining", icon: "UtensilsCrossed", sortOrder: 1 },
    { name: "Professional Services", slug: "professional-services-cat", icon: "Briefcase", sortOrder: 2 },
    { name: "Health & Wellness", slug: "health-wellness-cat", icon: "HeartPulse", sortOrder: 3 },
    { name: "Home Services", slug: "home-services-cat", icon: "Wrench", sortOrder: 4 },
    { name: "Retail & Shopping", slug: "retail-shopping-cat", icon: "ShoppingBag", sortOrder: 5 },
    { name: "Beauty & Personal Care", slug: "beauty-personal-care", icon: "Sparkles", sortOrder: 6 },
    { name: "Entertainment & Recreation", slug: "entertainment-recreation", icon: "Music", sortOrder: 7 },
    { name: "Nonprofit & Faith", slug: "nonprofit-faith", icon: "HandHeart", sortOrder: 8 },
    { name: "Automotive & Transportation", slug: "automotive-transportation", icon: "Car", sortOrder: 9 },
    { name: "Education & Childcare", slug: "education-childcare", icon: "GraduationCap", sortOrder: 10 },
    { name: "Real Estate & Property", slug: "real-estate-property", icon: "Building2", sortOrder: 11 },
    { name: "Mobile & Home-Based", slug: "mobile-home-based", icon: "Truck", sortOrder: 12 },
  ];

  const l1Map: Record<string, string> = {};
  for (const existing of existingCats.filter(c => !c.parentCategoryId)) {
    l1Map[existing.slug] = existing.id;
  }

  let l1Created = 0;
  for (const l1 of l1Defs) {
    if (!l1Map[l1.slug]) {
      const created = await storage.createCategory(l1);
      l1Map[l1.slug] = created.id;
      l1Created++;
    }
  }
  if (l1Created > 0) {
    console.log(`[SEED] Created ${l1Created} missing L1 categories`);
  }

  const subCatData = [
    { name: "Fine Dining", slug: "fine-dining", icon: "Wine", parent: "restaurant-dining", sortOrder: 1 },
    { name: "Casual Dining", slug: "casual-dining", icon: "Utensils", parent: "restaurant-dining", sortOrder: 2 },
    { name: "Fast Casual", slug: "fast-casual", icon: "Sandwich", parent: "restaurant-dining", sortOrder: 3 },
    { name: "Coffee & Tea", slug: "coffee-tea", icon: "Coffee", parent: "restaurant-dining", sortOrder: 4 },
    { name: "Bars & Breweries", slug: "bars-breweries", icon: "Beer", parent: "restaurant-dining", sortOrder: 5 },
    { name: "Bakeries & Desserts", slug: "bakeries-desserts", icon: "CakeSlice", parent: "restaurant-dining", sortOrder: 6 },
    { name: "Food Trucks", slug: "food-trucks", icon: "Truck", parent: "restaurant-dining", sortOrder: 7 },
    { name: "Catering", slug: "catering", icon: "ChefHat", parent: "restaurant-dining", sortOrder: 8 },
    { name: "Legal", slug: "legal", icon: "Scale", parent: "professional-services-cat", sortOrder: 1 },
    { name: "Accounting & Tax", slug: "accounting-tax", icon: "Calculator", parent: "professional-services-cat", sortOrder: 2 },
    { name: "Real Estate", slug: "real-estate", icon: "Home", parent: "professional-services-cat", sortOrder: 3 },
    { name: "Insurance", slug: "insurance", icon: "Shield", parent: "professional-services-cat", sortOrder: 4 },
    { name: "Financial Services", slug: "financial-services", icon: "DollarSign", parent: "professional-services-cat", sortOrder: 5 },
    { name: "Marketing & Advertising", slug: "marketing-advertising", icon: "Megaphone", parent: "professional-services-cat", sortOrder: 6 },
    { name: "IT & Technology", slug: "it-technology", icon: "Monitor", parent: "professional-services-cat", sortOrder: 7 },
    { name: "Consulting", slug: "consulting", icon: "Users", parent: "professional-services-cat", sortOrder: 8 },
    { name: "Barter", slug: "barter", icon: "ArrowLeftRight", parent: "professional-services-cat", sortOrder: 9 },
    { name: "Medical & Dental", slug: "medical-dental", icon: "Stethoscope", parent: "health-wellness-cat", sortOrder: 1 },
    { name: "Mental Health", slug: "mental-health", icon: "Brain", parent: "health-wellness-cat", sortOrder: 2 },
    { name: "Fitness & Gym", slug: "fitness-gym", icon: "Dumbbell", parent: "health-wellness-cat", sortOrder: 3 },
    { name: "Yoga & Pilates", slug: "yoga-pilates", icon: "Flower2", parent: "health-wellness-cat", sortOrder: 4 },
    { name: "Chiropractic & PT", slug: "chiropractic-pt", icon: "Activity", parent: "health-wellness-cat", sortOrder: 5 },
    { name: "Veterinary & Pet Health", slug: "veterinary-pet-health", icon: "PawPrint", parent: "health-wellness-cat", sortOrder: 6 },
    { name: "Pharmacy", slug: "pharmacy", icon: "Pill", parent: "health-wellness-cat", sortOrder: 7 },
    { name: "Plumbing", slug: "plumbing", icon: "Droplets", parent: "home-services-cat", sortOrder: 1 },
    { name: "Electrical", slug: "electrical", icon: "Zap", parent: "home-services-cat", sortOrder: 2 },
    { name: "HVAC", slug: "hvac", icon: "Fan", parent: "home-services-cat", sortOrder: 3 },
    { name: "Landscaping", slug: "landscaping", icon: "Trees", parent: "home-services-cat", sortOrder: 4 },
    { name: "Cleaning", slug: "cleaning", icon: "SprayCan", parent: "home-services-cat", sortOrder: 5 },
    { name: "Roofing & Siding", slug: "roofing-siding", icon: "HardHat", parent: "home-services-cat", sortOrder: 6 },
    { name: "Moving & Storage", slug: "moving-storage", icon: "Package", parent: "home-services-cat", sortOrder: 7 },
    { name: "Pest Control", slug: "pest-control", icon: "Bug", parent: "home-services-cat", sortOrder: 8 },
    { name: "Clothing & Apparel", slug: "clothing-apparel", icon: "Shirt", parent: "retail-shopping-cat", sortOrder: 1 },
    { name: "Grocery & Market", slug: "grocery-market", icon: "Apple", parent: "retail-shopping-cat", sortOrder: 2 },
    { name: "Electronics", slug: "electronics", icon: "Smartphone", parent: "retail-shopping-cat", sortOrder: 3 },
    { name: "Furniture & Home Decor", slug: "furniture-home-decor", icon: "Sofa", parent: "retail-shopping-cat", sortOrder: 4 },
    { name: "Gifts & Specialty", slug: "gifts-specialty", icon: "Gift", parent: "retail-shopping-cat", sortOrder: 5 },
    { name: "Pet Supplies", slug: "pet-supplies", icon: "PawPrint", parent: "retail-shopping-cat", sortOrder: 6 },
    { name: "Automotive Parts & Repair", slug: "automotive-parts", icon: "Car", parent: "retail-shopping-cat", sortOrder: 7 },
    { name: "Hair Salon", slug: "hair-salon", icon: "Scissors", parent: "beauty-personal-care", sortOrder: 1 },
    { name: "Barbershop", slug: "barbershop", icon: "Scissors", parent: "beauty-personal-care", sortOrder: 2 },
    { name: "Spa & Massage", slug: "spa-massage", icon: "Droplets", parent: "beauty-personal-care", sortOrder: 3 },
    { name: "Nail Salon", slug: "nail-salon", icon: "Sparkles", parent: "beauty-personal-care", sortOrder: 4 },
    { name: "Skincare & Aesthetics", slug: "skincare-aesthetics", icon: "Flower2", parent: "beauty-personal-care", sortOrder: 5 },
    { name: "Gyms & Studios", slug: "gyms-studios", icon: "Dumbbell", parent: "entertainment-recreation", sortOrder: 1 },
    { name: "Arts & Culture", slug: "arts-culture", icon: "Palette", parent: "entertainment-recreation", sortOrder: 2 },
    { name: "Sports & Outdoor", slug: "sports-outdoor", icon: "Trophy", parent: "entertainment-recreation", sortOrder: 3 },
    { name: "Nightlife", slug: "nightlife", icon: "Moon", parent: "entertainment-recreation", sortOrder: 4 },
    { name: "Gaming & Amusement", slug: "gaming-amusement", icon: "Gamepad2", parent: "entertainment-recreation", sortOrder: 5 },
    { name: "Churches", slug: "churches", icon: "Church", parent: "nonprofit-faith", sortOrder: 1 },
    { name: "Community Organizations", slug: "community-orgs", icon: "Users", parent: "nonprofit-faith", sortOrder: 2 },
    { name: "Charities & Foundations", slug: "charities-foundations", icon: "Heart", parent: "nonprofit-faith", sortOrder: 3 },
    { name: "Auto Repair", slug: "auto-repair", icon: "Wrench", parent: "automotive-transportation", sortOrder: 1 },
    { name: "Car Dealerships", slug: "car-dealerships", icon: "Car", parent: "automotive-transportation", sortOrder: 2 },
    { name: "Car Wash & Detailing", slug: "car-wash-detailing", icon: "Droplets", parent: "automotive-transportation", sortOrder: 3 },
    { name: "Towing & Roadside", slug: "towing-roadside", icon: "Truck", parent: "automotive-transportation", sortOrder: 4 },
    { name: "Tutoring & Test Prep", slug: "tutoring-test-prep", icon: "BookOpen", parent: "education-childcare", sortOrder: 1 },
    { name: "Daycare & Preschool", slug: "daycare-preschool", icon: "Baby", parent: "education-childcare", sortOrder: 2 },
    { name: "Music & Art Lessons", slug: "music-art-lessons", icon: "Music", parent: "education-childcare", sortOrder: 3 },
    { name: "Driving Schools", slug: "driving-schools", icon: "Car", parent: "education-childcare", sortOrder: 4 },
    { name: "Residential Sales", slug: "residential-sales", icon: "Home", parent: "real-estate-property", sortOrder: 1 },
    { name: "Commercial Real Estate", slug: "commercial-real-estate", icon: "Building2", parent: "real-estate-property", sortOrder: 2 },
    { name: "Property Management", slug: "property-management", icon: "Key", parent: "real-estate-property", sortOrder: 3 },
    { name: "Apartment Communities", slug: "apartment-communities", icon: "Building2", parent: "real-estate-property", sortOrder: 4 },
    { name: "Food Trucks", slug: "mobile-food-trucks", icon: "Truck", parent: "mobile-home-based", sortOrder: 1 },
    { name: "Mobile Services", slug: "mobile-services", icon: "MapPin", parent: "mobile-home-based", sortOrder: 2 },
    { name: "Home-Based Business", slug: "home-based-business", icon: "Home", parent: "mobile-home-based", sortOrder: 3 },
    { name: "Side Hustle / Freelance", slug: "side-hustle-freelance", icon: "Briefcase", parent: "mobile-home-based", sortOrder: 4 },
  ];

  const existingSlugs = new Set(existingCats.map(c => c.slug));
  let l2Created = 0;
  for (const sub of subCatData) {
    if (existingSlugs.has(sub.slug)) continue;
    const parentId = l1Map[sub.parent];
    if (!parentId) {
      console.log(`[SEED] Skipping L2 "${sub.name}" — parent "${sub.parent}" not found`);
      continue;
    }
    await storage.createCategory({
      name: sub.name,
      slug: sub.slug,
      icon: sub.icon,
      parentCategoryId: parentId,
      sortOrder: sub.sortOrder,
    });
    l2Created++;
  }

  console.log(`[SEED] Seeded ${l1Created} L1 categories and ${l2Created} L2 subcategories`);
}

async function seedApartmentCategory(createdCategories: Record<string, string>) {
  const existingCats = await db.select().from(categories).limit(1000);
  const hasApartments = existingCats.some(c => c.slug === "apartment-communities");
  if (hasApartments) return;

  let realEstateParentId = createdCategories["real-estate"];
  if (!realEstateParentId) {
    const realEstate = existingCats.find(c => c.slug === "real-estate");
    realEstateParentId = realEstate?.id || "";
  }
  if (!realEstateParentId) {
    console.log("No Real Estate category found, skipping apartment seed");
    return;
  }

  const aptCat = await storage.createCategory({
    name: "Apartment Communities",
    slug: "apartment-communities",
    icon: "Building2",
    parentCategoryId: realEstateParentId,
    sortOrder: 10,
  });
  console.log("Seeded Apartment Communities L2 category");

  const microTags = [
    { name: "Luxury Apartments", slug: "luxury-apartments", icon: "Crown", sortOrder: 1 },
    { name: "Student Housing", slug: "student-housing", icon: "GraduationCap", sortOrder: 2 },
    { name: "Affordable Housing", slug: "affordable-housing", icon: "Home", sortOrder: 3 },
    { name: "Senior Living", slug: "senior-living", icon: "Heart", sortOrder: 4 },
    { name: "Loft & Urban Living", slug: "loft-urban-living", icon: "Building", sortOrder: 5 },
  ];
  for (const tag of microTags) {
    await storage.createCategory({ ...tag, parentCategoryId: aptCat.id });
  }
  console.log("Seeded Apartment L3 micro-tags");
}

async function seedTransitData(cityId: string) {
  const existing = await db.select().from(transitLines).limit(1);
  if (existing.length > 0) {
    console.log("Transit data already seeded, skipping...");
    return;
  }

  console.log("Seeding Charlotte transit data...");

  const blueLine = await storage.createTransitLine({
    name: "LYNX Blue Line",
    lineType: "LIGHT_RAIL",
    color: "#0057B8",
    cityId,
  });

  const goldLine = await storage.createTransitLine({
    name: "CityLYNX Gold Line",
    lineType: "STREETCAR",
    color: "#C5A028",
    cityId,
  });

  const blueLineStops = [
    { name: "I-485/South Blvd", address: "I-485 at South Blvd, Charlotte, NC", sortOrder: 1 },
    { name: "Sharon Road West", address: "Sharon Rd W at South Blvd, Charlotte, NC", sortOrder: 2 },
    { name: "Arrowood", address: "Arrowood Rd at South Blvd, Charlotte, NC", sortOrder: 3 },
    { name: "Archdale", address: "Archdale Dr at South Blvd, Charlotte, NC", sortOrder: 4 },
    { name: "Tyvola", address: "Tyvola Rd at South Blvd, Charlotte, NC", sortOrder: 5 },
    { name: "Woodlawn", address: "Woodlawn Rd at South Blvd, Charlotte, NC", sortOrder: 6 },
    { name: "Scaleybark", address: "Scaleybark Rd, Charlotte, NC", sortOrder: 7 },
    { name: "New Bern", address: "New Bern Station, Charlotte, NC", sortOrder: 8 },
    { name: "East/West Blvd", address: "East/West Blvd at South Blvd, Charlotte, NC", sortOrder: 9 },
    { name: "Bland Street", address: "Bland St, Charlotte, NC", sortOrder: 10 },
    { name: "Carson Blvd", address: "Carson Blvd, Charlotte, NC", sortOrder: 11 },
    { name: "Brooklyn Village", address: "Brooklyn Village, Charlotte, NC", sortOrder: 12 },
    { name: "Charlotte Transportation Center (CTC)", address: "310 E Trade St, Charlotte, NC", sortOrder: 13 },
    { name: "3rd Street/Convention Center", address: "3rd St, Charlotte, NC", sortOrder: 14 },
    { name: "7th Street Station", address: "7th St, Charlotte, NC", sortOrder: 15 },
    { name: "9th Street", address: "9th St, Charlotte, NC", sortOrder: 16 },
    { name: "Parkwood", address: "Parkwood Ave, Charlotte, NC", sortOrder: 17 },
    { name: "25th Street", address: "25th St, Charlotte, NC", sortOrder: 18 },
    { name: "36th Street", address: "36th St, Charlotte, NC", sortOrder: 19 },
    { name: "Sugar Creek", address: "Sugar Creek Rd, Charlotte, NC", sortOrder: 20 },
    { name: "Old Concord Road", address: "Old Concord Rd, Charlotte, NC", sortOrder: 21 },
    { name: "Tom Hunter", address: "Tom Hunter Rd, Charlotte, NC", sortOrder: 22 },
    { name: "University City Blvd", address: "University City Blvd, Charlotte, NC", sortOrder: 23 },
    { name: "McCullough", address: "McCullough Dr, Charlotte, NC", sortOrder: 24 },
    { name: "JW Clay Blvd/UNC Charlotte", address: "JW Clay Blvd, Charlotte, NC", sortOrder: 25 },
    { name: "UNC Charlotte Main", address: "UNC Charlotte Main Campus, Charlotte, NC", sortOrder: 26 },
  ];

  for (const stop of blueLineStops) {
    await storage.createTransitStop({
      transitLineId: blueLine.id,
      name: stop.name,
      address: stop.address,
      sortOrder: stop.sortOrder,
      cityId,
    });
  }

  const goldLineStops = [
    { name: "Rosa Parks Place", address: "Rosa Parks Place, Charlotte, NC", sortOrder: 1 },
    { name: "Johnson C. Smith University", address: "Johnson C. Smith University, Charlotte, NC", sortOrder: 2 },
    { name: "Irwin Avenue", address: "Irwin Ave, Charlotte, NC", sortOrder: 3 },
    { name: "Charlotte Transportation Center (CTC)", address: "310 E Trade St, Charlotte, NC", sortOrder: 4 },
    { name: "Trade/Tryon (The Square)", address: "Trade St & Tryon St, Charlotte, NC", sortOrder: 5 },
    { name: "CTC/Arena", address: "CTC Arena, Charlotte, NC", sortOrder: 6 },
    { name: "Convention Center", address: "Charlotte Convention Center, Charlotte, NC", sortOrder: 7 },
    { name: "Novant Health", address: "Novant Health, Charlotte, NC", sortOrder: 8 },
    { name: "Hawthorne Lane", address: "Hawthorne Ln, Charlotte, NC", sortOrder: 9 },
    { name: "Sunnyside Avenue", address: "Sunnyside Ave, Charlotte, NC", sortOrder: 10 },
  ];

  for (const stop of goldLineStops) {
    await storage.createTransitStop({
      transitLineId: goldLine.id,
      name: stop.name,
      address: stop.address,
      sortOrder: stop.sortOrder,
      cityId,
    });
  }

  console.log("Charlotte transit data seeded (Blue Line: 26 stops, Gold Line: 10 stops)");
}

export async function ensureMetroZonesSeeded(cityId: string) {
  const fullMetroZones: Array<{ name: string; slug: string; type: "NEIGHBORHOOD" | "DISTRICT" | "ZIP" | "MICRO_HUB" | "COUNTY"; county: string; stateCode: string; zipCodes: string[] }> = [
    // Charlotte Proper Neighborhoods (Mecklenburg County, NC)
    { name: "Uptown", slug: "uptown", type: "DISTRICT", county: "Mecklenburg", stateCode: "NC", zipCodes: ["28202","28203"] },
    { name: "South End", slug: "south-end", type: "NEIGHBORHOOD", county: "Mecklenburg", stateCode: "NC", zipCodes: ["28203"] },
    { name: "NoDa", slug: "noda", type: "NEIGHBORHOOD", county: "Mecklenburg", stateCode: "NC", zipCodes: ["28205","28206"] },
    { name: "Plaza Midwood", slug: "plaza-midwood", type: "NEIGHBORHOOD", county: "Mecklenburg", stateCode: "NC", zipCodes: ["28205"] },
    { name: "Dilworth", slug: "dilworth", type: "NEIGHBORHOOD", county: "Mecklenburg", stateCode: "NC", zipCodes: ["28203","28207"] },
    { name: "Myers Park", slug: "myers-park", type: "NEIGHBORHOOD", county: "Mecklenburg", stateCode: "NC", zipCodes: ["28207","28209"] },
    { name: "SouthPark", slug: "southpark", type: "NEIGHBORHOOD", county: "Mecklenburg", stateCode: "NC", zipCodes: ["28209","28210","28211"] },
    { name: "Elizabeth", slug: "elizabeth", type: "NEIGHBORHOOD", county: "Mecklenburg", stateCode: "NC", zipCodes: ["28204"] },
    { name: "Cotswold", slug: "cotswold", type: "NEIGHBORHOOD", county: "Mecklenburg", stateCode: "NC", zipCodes: ["28211"] },
    { name: "Montford", slug: "montford", type: "NEIGHBORHOOD", county: "Mecklenburg", stateCode: "NC", zipCodes: ["28209"] },
    { name: "Steele Creek", slug: "steele-creek", type: "NEIGHBORHOOD", county: "Mecklenburg", stateCode: "NC", zipCodes: ["28278"] },
    { name: "Providence", slug: "providence", type: "NEIGHBORHOOD", county: "Mecklenburg", stateCode: "NC", zipCodes: ["28226","28270"] },
    { name: "East Forest", slug: "east-forest", type: "NEIGHBORHOOD", county: "Mecklenburg", stateCode: "NC", zipCodes: ["28212"] },
    { name: "Ayrsley", slug: "ayrsley", type: "NEIGHBORHOOD", county: "Mecklenburg", stateCode: "NC", zipCodes: ["28217"] },
    { name: "Eastway", slug: "eastway", type: "NEIGHBORHOOD", county: "Mecklenburg", stateCode: "NC", zipCodes: ["28212","28205"] },
    { name: "Optimist Park", slug: "optimist-park", type: "NEIGHBORHOOD", county: "Mecklenburg", stateCode: "NC", zipCodes: ["28206"] },
    { name: "Seversville", slug: "seversville", type: "NEIGHBORHOOD", county: "Mecklenburg", stateCode: "NC", zipCodes: ["28208"] },
    { name: "Wesley Heights", slug: "wesley-heights", type: "NEIGHBORHOOD", county: "Mecklenburg", stateCode: "NC", zipCodes: ["28208"] },
    { name: "Camp North End", slug: "camp-north-end", type: "NEIGHBORHOOD", county: "Mecklenburg", stateCode: "NC", zipCodes: ["28206"] },
    // Mecklenburg County towns/districts
    { name: "University City", slug: "university-city", type: "DISTRICT", county: "Mecklenburg", stateCode: "NC", zipCodes: ["28213","28262"] },
    { name: "Ballantyne", slug: "ballantyne", type: "DISTRICT", county: "Mecklenburg", stateCode: "NC", zipCodes: ["28277"] },
    { name: "Northlake", slug: "northlake", type: "DISTRICT", county: "Mecklenburg", stateCode: "NC", zipCodes: ["28216"] },
    { name: "Huntersville", slug: "huntersville", type: "DISTRICT", county: "Mecklenburg", stateCode: "NC", zipCodes: ["28078"] },
    { name: "Cornelius", slug: "cornelius", type: "DISTRICT", county: "Mecklenburg", stateCode: "NC", zipCodes: ["28031"] },
    { name: "Davidson", slug: "davidson", type: "DISTRICT", county: "Mecklenburg", stateCode: "NC", zipCodes: ["28035","28036"] },
    { name: "Mint Hill", slug: "mint-hill", type: "DISTRICT", county: "Mecklenburg", stateCode: "NC", zipCodes: ["28227"] },
    { name: "Matthews", slug: "matthews", type: "DISTRICT", county: "Mecklenburg", stateCode: "NC", zipCodes: ["28104","28105"] },
    { name: "Pineville", slug: "pineville", type: "DISTRICT", county: "Mecklenburg", stateCode: "NC", zipCodes: ["28134"] },
    // Iredell County, NC
    { name: "Mooresville", slug: "mooresville", type: "DISTRICT", county: "Iredell", stateCode: "NC", zipCodes: ["28115","28117"] },
    { name: "Troutman", slug: "troutman", type: "DISTRICT", county: "Iredell", stateCode: "NC", zipCodes: ["28166"] },
    { name: "Statesville", slug: "statesville", type: "DISTRICT", county: "Iredell", stateCode: "NC", zipCodes: ["28625","28677","28687"] },
    // Cabarrus County, NC
    { name: "Concord", slug: "concord", type: "DISTRICT", county: "Cabarrus", stateCode: "NC", zipCodes: ["28025","28027"] },
    { name: "Kannapolis", slug: "kannapolis", type: "DISTRICT", county: "Cabarrus", stateCode: "NC", zipCodes: ["28081","28083"] },
    { name: "Harrisburg", slug: "harrisburg", type: "DISTRICT", county: "Cabarrus", stateCode: "NC", zipCodes: ["28075"] },
    { name: "Midland", slug: "midland", type: "DISTRICT", county: "Cabarrus", stateCode: "NC", zipCodes: ["28107"] },
    { name: "Mount Pleasant", slug: "mount-pleasant", type: "DISTRICT", county: "Cabarrus", stateCode: "NC", zipCodes: ["28124"] },
    // Union County, NC
    { name: "Monroe", slug: "monroe", type: "DISTRICT", county: "Union", stateCode: "NC", zipCodes: ["28110","28112"] },
    { name: "Indian Trail", slug: "indian-trail", type: "DISTRICT", county: "Union", stateCode: "NC", zipCodes: ["28079"] },
    { name: "Weddington", slug: "weddington", type: "DISTRICT", county: "Union", stateCode: "NC", zipCodes: ["28104"] },
    { name: "Waxhaw", slug: "waxhaw", type: "DISTRICT", county: "Union", stateCode: "NC", zipCodes: ["28173"] },
    { name: "Wesley Chapel", slug: "wesley-chapel", type: "DISTRICT", county: "Union", stateCode: "NC", zipCodes: ["28104"] },
    { name: "Stallings", slug: "stallings", type: "DISTRICT", county: "Union", stateCode: "NC", zipCodes: ["28104"] },
    { name: "Marvin", slug: "marvin", type: "DISTRICT", county: "Union", stateCode: "NC", zipCodes: ["28173"] },
    // Gaston County, NC
    { name: "Gastonia", slug: "gastonia", type: "DISTRICT", county: "Gaston", stateCode: "NC", zipCodes: ["28052","28054","28056"] },
    { name: "Belmont", slug: "belmont", type: "DISTRICT", county: "Gaston", stateCode: "NC", zipCodes: ["28012"] },
    { name: "Mount Holly", slug: "mount-holly", type: "DISTRICT", county: "Gaston", stateCode: "NC", zipCodes: ["28120"] },
    { name: "Cramerton", slug: "cramerton", type: "DISTRICT", county: "Gaston", stateCode: "NC", zipCodes: ["28032"] },
    { name: "Lowell", slug: "lowell", type: "DISTRICT", county: "Gaston", stateCode: "NC", zipCodes: ["28098"] },
    { name: "McAdenville", slug: "mcadenville", type: "DISTRICT", county: "Gaston", stateCode: "NC", zipCodes: ["28101"] },
    { name: "Ranlo", slug: "ranlo", type: "DISTRICT", county: "Gaston", stateCode: "NC", zipCodes: ["28054"] },
    // Lincoln County, NC
    { name: "Denver", slug: "denver", type: "DISTRICT", county: "Lincoln", stateCode: "NC", zipCodes: ["28037"] },
    { name: "Lincolnton", slug: "lincolnton", type: "DISTRICT", county: "Lincoln", stateCode: "NC", zipCodes: ["28092"] },
    // Rowan County, NC
    { name: "Salisbury", slug: "salisbury", type: "DISTRICT", county: "Rowan", stateCode: "NC", zipCodes: ["28144","28146","28147"] },
    { name: "China Grove", slug: "china-grove", type: "DISTRICT", county: "Rowan", stateCode: "NC", zipCodes: ["28023"] },
    // Stanly County, NC
    { name: "Albemarle", slug: "albemarle", type: "DISTRICT", county: "Stanly", stateCode: "NC", zipCodes: ["28001","28002"] },
    { name: "Locust", slug: "locust", type: "DISTRICT", county: "Stanly", stateCode: "NC", zipCodes: ["28097"] },
    // York County, SC
    { name: "Rock Hill", slug: "rock-hill", type: "DISTRICT", county: "York", stateCode: "SC", zipCodes: ["29730","29732","29733"] },
    { name: "Fort Mill", slug: "fort-mill", type: "DISTRICT", county: "York", stateCode: "SC", zipCodes: ["29715","29708"] },
    { name: "Tega Cay", slug: "tega-cay", type: "DISTRICT", county: "York", stateCode: "SC", zipCodes: ["29708"] },
    { name: "Lake Wylie", slug: "lake-wylie", type: "DISTRICT", county: "York", stateCode: "SC", zipCodes: ["29710"] },
    { name: "Clover", slug: "clover", type: "DISTRICT", county: "York", stateCode: "SC", zipCodes: ["29710"] },
    { name: "York", slug: "york-town", type: "DISTRICT", county: "York", stateCode: "SC", zipCodes: ["29745"] },
    // Lancaster County, SC
    { name: "Indian Land", slug: "indian-land", type: "DISTRICT", county: "Lancaster", stateCode: "SC", zipCodes: ["29707"] },
    { name: "Lancaster", slug: "lancaster", type: "DISTRICT", county: "Lancaster", stateCode: "SC", zipCodes: ["29720"] },
    // Chester County, SC
    { name: "Chester", slug: "chester", type: "DISTRICT", county: "Chester", stateCode: "SC", zipCodes: ["29706"] },
    { name: "Great Falls", slug: "great-falls", type: "DISTRICT", county: "Chester", stateCode: "SC", zipCodes: ["29055"] },
    // Anson County, NC
    { name: "Wadesboro", slug: "wadesboro", type: "DISTRICT", county: "Anson", stateCode: "NC", zipCodes: ["28170"] },
    { name: "Polkton", slug: "polkton", type: "DISTRICT", county: "Anson", stateCode: "NC", zipCodes: ["28135"] },
    { name: "Peachland", slug: "peachland", type: "DISTRICT", county: "Anson", stateCode: "NC", zipCodes: ["28133"] },
    { name: "Morven", slug: "morven", type: "DISTRICT", county: "Anson", stateCode: "NC", zipCodes: ["28119"] },
    { name: "Lilesville", slug: "lilesville", type: "DISTRICT", county: "Anson", stateCode: "NC", zipCodes: ["28091"] },
    // Cleveland County, NC
    { name: "Shelby", slug: "shelby", type: "DISTRICT", county: "Cleveland", stateCode: "NC", zipCodes: ["28150","28152"] },
    { name: "Kings Mountain", slug: "kings-mountain", type: "DISTRICT", county: "Cleveland", stateCode: "NC", zipCodes: ["28086"] },
    { name: "Boiling Springs", slug: "boiling-springs", type: "DISTRICT", county: "Cleveland", stateCode: "NC", zipCodes: ["28017"] },
    { name: "Lawndale", slug: "lawndale", type: "DISTRICT", county: "Cleveland", stateCode: "NC", zipCodes: ["28090"] },
    // Catawba County, NC
    { name: "Hickory", slug: "hickory", type: "DISTRICT", county: "Catawba", stateCode: "NC", zipCodes: ["28601","28602"] },
    { name: "Newton", slug: "newton", type: "DISTRICT", county: "Catawba", stateCode: "NC", zipCodes: ["28658"] },
    { name: "Conover", slug: "conover", type: "DISTRICT", county: "Catawba", stateCode: "NC", zipCodes: ["28613"] },
    { name: "Maiden", slug: "maiden", type: "DISTRICT", county: "Catawba", stateCode: "NC", zipCodes: ["28650"] },
    // Alexander County, NC
    { name: "Taylorsville", slug: "taylorsville", type: "DISTRICT", county: "Alexander", stateCode: "NC", zipCodes: ["28681"] },
    { name: "Hiddenite", slug: "hiddenite", type: "DISTRICT", county: "Alexander", stateCode: "NC", zipCodes: ["28636"] },
    // Burke County, NC
    { name: "Morganton", slug: "morganton", type: "DISTRICT", county: "Burke", stateCode: "NC", zipCodes: ["28655"] },
    { name: "Valdese", slug: "valdese", type: "DISTRICT", county: "Burke", stateCode: "NC", zipCodes: ["28690"] },
    { name: "Glen Alpine", slug: "glen-alpine", type: "DISTRICT", county: "Burke", stateCode: "NC", zipCodes: ["28628"] },
    // Caldwell County, NC
    { name: "Lenoir", slug: "lenoir", type: "DISTRICT", county: "Caldwell", stateCode: "NC", zipCodes: ["28645"] },
    { name: "Granite Falls", slug: "granite-falls", type: "DISTRICT", county: "Caldwell", stateCode: "NC", zipCodes: ["28630"] },
    { name: "Hudson", slug: "hudson", type: "DISTRICT", county: "Caldwell", stateCode: "NC", zipCodes: ["28638"] },
    // McDowell County, NC
    { name: "Marion", slug: "marion", type: "DISTRICT", county: "McDowell", stateCode: "NC", zipCodes: ["28752"] },
    { name: "Old Fort", slug: "old-fort", type: "DISTRICT", county: "McDowell", stateCode: "NC", zipCodes: ["28762"] },
    // Chesterfield County, SC
    { name: "Cheraw", slug: "cheraw", type: "DISTRICT", county: "Chesterfield", stateCode: "SC", zipCodes: ["29520"] },
    { name: "Chesterfield", slug: "chesterfield", type: "DISTRICT", county: "Chesterfield", stateCode: "SC", zipCodes: ["29709"] },
    { name: "Pageland", slug: "pageland", type: "DISTRICT", county: "Chesterfield", stateCode: "SC", zipCodes: ["29728"] },
    // Neighborhoods — Huntersville
    { name: "Birkdale", slug: "birkdale", type: "NEIGHBORHOOD", county: "Mecklenburg", stateCode: "NC", zipCodes: ["28078"] },
    { name: "Rosedale", slug: "rosedale", type: "NEIGHBORHOOD", county: "Mecklenburg", stateCode: "NC", zipCodes: ["28078"] },
    { name: "Northcross", slug: "northcross", type: "NEIGHBORHOOD", county: "Mecklenburg", stateCode: "NC", zipCodes: ["28078"] },
    // Neighborhoods — Cornelius
    { name: "Antiquity", slug: "antiquity", type: "NEIGHBORHOOD", county: "Mecklenburg", stateCode: "NC", zipCodes: ["28031"] },
    { name: "Bailey's Glen", slug: "baileys-glen", type: "NEIGHBORHOOD", county: "Mecklenburg", stateCode: "NC", zipCodes: ["28031"] },
    // Neighborhoods — Davidson
    { name: "Downtown Davidson", slug: "downtown-davidson", type: "NEIGHBORHOOD", county: "Mecklenburg", stateCode: "NC", zipCodes: ["28036"] },
    { name: "River Run", slug: "river-run", type: "NEIGHBORHOOD", county: "Mecklenburg", stateCode: "NC", zipCodes: ["28036"] },
    // Neighborhoods — Matthews
    { name: "McKee Glen", slug: "mckee-glen", type: "NEIGHBORHOOD", county: "Mecklenburg", stateCode: "NC", zipCodes: ["28105"] },
    // Neighborhoods — Mint Hill
    { name: "Clear Creek", slug: "clear-creek", type: "NEIGHBORHOOD", county: "Mecklenburg", stateCode: "NC", zipCodes: ["28227"] },
    // Neighborhoods — Mooresville
    { name: "Morrison Plantation", slug: "morrison-plantation", type: "NEIGHBORHOOD", county: "Iredell", stateCode: "NC", zipCodes: ["28115"] },
    { name: "Downtown Mooresville", slug: "downtown-mooresville", type: "NEIGHBORHOOD", county: "Iredell", stateCode: "NC", zipCodes: ["28115"] },
    // Neighborhoods — Statesville
    { name: "Downtown Statesville", slug: "downtown-statesville", type: "NEIGHBORHOOD", county: "Iredell", stateCode: "NC", zipCodes: ["28677"] },
    // Neighborhoods — Concord
    { name: "Downtown Concord", slug: "downtown-concord", type: "NEIGHBORHOOD", county: "Cabarrus", stateCode: "NC", zipCodes: ["28025"] },
    { name: "Afton Village", slug: "afton-village", type: "NEIGHBORHOOD", county: "Cabarrus", stateCode: "NC", zipCodes: ["28027"] },
    { name: "Weddington Trace", slug: "weddington-trace", type: "NEIGHBORHOOD", county: "Cabarrus", stateCode: "NC", zipCodes: ["28027"] },
    // Neighborhoods — Kannapolis
    { name: "Downtown Kannapolis", slug: "downtown-kannapolis", type: "NEIGHBORHOOD", county: "Cabarrus", stateCode: "NC", zipCodes: ["28081"] },
    // Neighborhoods — Harrisburg
    { name: "Rocky River Crossing", slug: "rocky-river-crossing", type: "NEIGHBORHOOD", county: "Cabarrus", stateCode: "NC", zipCodes: ["28075"] },
    // Neighborhoods — Waxhaw
    { name: "Downtown Waxhaw", slug: "downtown-waxhaw", type: "NEIGHBORHOOD", county: "Union", stateCode: "NC", zipCodes: ["28173"] },
    { name: "Cureton", slug: "cureton", type: "NEIGHBORHOOD", county: "Union", stateCode: "NC", zipCodes: ["28173"] },
    // Neighborhoods — Weddington
    { name: "Weddington Chase", slug: "weddington-chase", type: "NEIGHBORHOOD", county: "Union", stateCode: "NC", zipCodes: ["28104"] },
    { name: "Bromley", slug: "bromley", type: "NEIGHBORHOOD", county: "Union", stateCode: "NC", zipCodes: ["28104"] },
    // Neighborhoods — Indian Trail
    { name: "Sun Valley", slug: "sun-valley", type: "NEIGHBORHOOD", county: "Union", stateCode: "NC", zipCodes: ["28079"] },
    { name: "Hemby Bridge", slug: "hemby-bridge", type: "NEIGHBORHOOD", county: "Union", stateCode: "NC", zipCodes: ["28079"] },
    // Neighborhoods — Monroe
    { name: "Downtown Monroe", slug: "downtown-monroe", type: "NEIGHBORHOOD", county: "Union", stateCode: "NC", zipCodes: ["28112"] },
    // Neighborhoods — Gastonia
    { name: "Downtown Gastonia", slug: "downtown-gastonia", type: "NEIGHBORHOOD", county: "Gaston", stateCode: "NC", zipCodes: ["28052"] },
    // Neighborhoods — Belmont
    { name: "Downtown Belmont", slug: "downtown-belmont", type: "NEIGHBORHOOD", county: "Gaston", stateCode: "NC", zipCodes: ["28012"] },
    // Neighborhoods — Mount Holly
    { name: "Downtown Mount Holly", slug: "downtown-mount-holly", type: "NEIGHBORHOOD", county: "Gaston", stateCode: "NC", zipCodes: ["28120"] },
    // Neighborhoods — Indian Land
    { name: "Sun City", slug: "sun-city", type: "NEIGHBORHOOD", county: "Lancaster", stateCode: "SC", zipCodes: ["29707"] },
    { name: "Massey", slug: "massey", type: "NEIGHBORHOOD", county: "Lancaster", stateCode: "SC", zipCodes: ["29707"] },
    // Neighborhoods — Lancaster
    { name: "Downtown Lancaster", slug: "downtown-lancaster", type: "NEIGHBORHOOD", county: "Lancaster", stateCode: "SC", zipCodes: ["29720"] },
    // Neighborhoods — Rock Hill
    { name: "Downtown Rock Hill", slug: "downtown-rock-hill", type: "NEIGHBORHOOD", county: "York", stateCode: "SC", zipCodes: ["29730"] },
    { name: "Riverwalk", slug: "riverwalk", type: "NEIGHBORHOOD", county: "York", stateCode: "SC", zipCodes: ["29730"] },
    { name: "Manchester Village", slug: "manchester-village", type: "NEIGHBORHOOD", county: "York", stateCode: "SC", zipCodes: ["29730"] },
    // Neighborhoods — Fort Mill
    { name: "Baxter", slug: "baxter", type: "NEIGHBORHOOD", county: "York", stateCode: "SC", zipCodes: ["29708"] },
    { name: "Kingsley", slug: "kingsley", type: "NEIGHBORHOOD", county: "York", stateCode: "SC", zipCodes: ["29708"] },
    // Neighborhoods — Clover
    { name: "Downtown Clover", slug: "downtown-clover", type: "NEIGHBORHOOD", county: "York", stateCode: "SC", zipCodes: ["29710"] },
    // Neighborhoods — Ballantyne
    { name: "Piper Glen", slug: "piper-glen", type: "NEIGHBORHOOD", county: "Mecklenburg", stateCode: "NC", zipCodes: ["28277"] },
    { name: "Ballantyne Village", slug: "ballantyne-village", type: "NEIGHBORHOOD", county: "Mecklenburg", stateCode: "NC", zipCodes: ["28277"] },
    // Neighborhoods — Salisbury
    { name: "Downtown Salisbury", slug: "downtown-salisbury", type: "NEIGHBORHOOD", county: "Rowan", stateCode: "NC", zipCodes: ["28144"] },
    // Neighborhoods — Albemarle
    { name: "Downtown Albemarle", slug: "downtown-albemarle", type: "NEIGHBORHOOD", county: "Stanly", stateCode: "NC", zipCodes: ["28001"] },
    // Neighborhoods — Chester
    { name: "Downtown Chester", slug: "downtown-chester", type: "NEIGHBORHOOD", county: "Chester", stateCode: "SC", zipCodes: ["29706"] },
    // Neighborhoods — University City
    { name: "UNCC Area", slug: "uncc-area", type: "NEIGHBORHOOD", county: "Mecklenburg", stateCode: "NC", zipCodes: ["28262"] },
    { name: "University Research Park", slug: "university-research-park", type: "NEIGHBORHOOD", county: "Mecklenburg", stateCode: "NC", zipCodes: ["28213"] },
    // Neighborhoods — Northlake
    { name: "Northlake Mall Area", slug: "northlake-mall-area", type: "NEIGHBORHOOD", county: "Mecklenburg", stateCode: "NC", zipCodes: ["28216"] },
    // Neighborhoods — Pineville
    { name: "Park Crossing", slug: "park-crossing", type: "NEIGHBORHOOD", county: "Mecklenburg", stateCode: "NC", zipCodes: ["28134"] },
    // Neighborhoods — Wadesboro (Anson)
    { name: "Downtown Wadesboro", slug: "downtown-wadesboro", type: "NEIGHBORHOOD", county: "Anson", stateCode: "NC", zipCodes: ["28170"] },
    { name: "Wadesboro Historic District", slug: "wadesboro-historic-district", type: "NEIGHBORHOOD", county: "Anson", stateCode: "NC", zipCodes: ["28170"] },
    { name: "Ansonville Road Area", slug: "ansonville-road-area", type: "NEIGHBORHOOD", county: "Anson", stateCode: "NC", zipCodes: ["28170"] },
    { name: "Morven Road Corridor", slug: "morven-road-corridor", type: "NEIGHBORHOOD", county: "Anson", stateCode: "NC", zipCodes: ["28170"] },
    // Neighborhoods — Polkton (Anson)
    { name: "Downtown Polkton", slug: "downtown-polkton", type: "NEIGHBORHOOD", county: "Anson", stateCode: "NC", zipCodes: ["28135"] },
    { name: "Polkton Historic Area", slug: "polkton-historic-area", type: "NEIGHBORHOOD", county: "Anson", stateCode: "NC", zipCodes: ["28135"] },
    { name: "Brown Creek Area", slug: "brown-creek-area", type: "NEIGHBORHOOD", county: "Anson", stateCode: "NC", zipCodes: ["28135"] },
    // Neighborhoods — Peachland (Anson)
    { name: "Downtown Peachland", slug: "downtown-peachland", type: "NEIGHBORHOOD", county: "Anson", stateCode: "NC", zipCodes: ["28133"] },
    { name: "Peachland Historic District", slug: "peachland-historic-district", type: "NEIGHBORHOOD", county: "Anson", stateCode: "NC", zipCodes: ["28133"] },
    // Neighborhoods — Morven (Anson)
    { name: "Downtown Morven", slug: "downtown-morven", type: "NEIGHBORHOOD", county: "Anson", stateCode: "NC", zipCodes: ["28119"] },
    { name: "Morven Historic Area", slug: "morven-historic-area", type: "NEIGHBORHOOD", county: "Anson", stateCode: "NC", zipCodes: ["28119"] },
    // Neighborhoods — Lilesville (Anson)
    { name: "Downtown Lilesville", slug: "downtown-lilesville", type: "NEIGHBORHOOD", county: "Anson", stateCode: "NC", zipCodes: ["28091"] },
    { name: "Pee Dee River Area", slug: "pee-dee-river-area", type: "NEIGHBORHOOD", county: "Anson", stateCode: "NC", zipCodes: ["28091"] },
    // Neighborhoods — Shelby (Cleveland)
    { name: "Uptown Shelby", slug: "uptown-shelby", type: "NEIGHBORHOOD", county: "Cleveland", stateCode: "NC", zipCodes: ["28150"] },
    { name: "Shelby Historic District", slug: "shelby-historic-district", type: "NEIGHBORHOOD", county: "Cleveland", stateCode: "NC", zipCodes: ["28150"] },
    { name: "Cleveland Country Club", slug: "cleveland-country-club", type: "NEIGHBORHOOD", county: "Cleveland", stateCode: "NC", zipCodes: ["28150"] },
    { name: "West Shelby", slug: "west-shelby", type: "NEIGHBORHOOD", county: "Cleveland", stateCode: "NC", zipCodes: ["28152"] },
    { name: "East Shelby", slug: "east-shelby", type: "NEIGHBORHOOD", county: "Cleveland", stateCode: "NC", zipCodes: ["28150"] },
    // Neighborhoods — Kings Mountain (Cleveland)
    { name: "Downtown Kings Mountain", slug: "downtown-kings-mountain", type: "NEIGHBORHOOD", county: "Cleveland", stateCode: "NC", zipCodes: ["28086"] },
    { name: "Mountain View", slug: "mountain-view-km", type: "NEIGHBORHOOD", county: "Cleveland", stateCode: "NC", zipCodes: ["28086"] },
    { name: "Moss Lake Area", slug: "moss-lake-area", type: "NEIGHBORHOOD", county: "Cleveland", stateCode: "NC", zipCodes: ["28086"] },
    { name: "Dixon School Road Area", slug: "dixon-school-road-area", type: "NEIGHBORHOOD", county: "Cleveland", stateCode: "NC", zipCodes: ["28086"] },
    // Neighborhoods — Boiling Springs (Cleveland)
    { name: "Gardner-Webb University Area", slug: "gardner-webb-university-area", type: "NEIGHBORHOOD", county: "Cleveland", stateCode: "NC", zipCodes: ["28017"] },
    { name: "Boiling Springs Historic District", slug: "boiling-springs-historic-district", type: "NEIGHBORHOOD", county: "Cleveland", stateCode: "NC", zipCodes: ["28017"] },
    { name: "South Main Area", slug: "south-main-area", type: "NEIGHBORHOOD", county: "Cleveland", stateCode: "NC", zipCodes: ["28017"] },
    // Neighborhoods — Lawndale (Cleveland)
    { name: "Downtown Lawndale", slug: "downtown-lawndale", type: "NEIGHBORHOOD", county: "Cleveland", stateCode: "NC", zipCodes: ["28090"] },
    { name: "Lawndale Historic District", slug: "lawndale-historic-district", type: "NEIGHBORHOOD", county: "Cleveland", stateCode: "NC", zipCodes: ["28090"] },
    // Neighborhoods — Hickory (Catawba)
    { name: "Downtown Hickory", slug: "downtown-hickory", type: "NEIGHBORHOOD", county: "Catawba", stateCode: "NC", zipCodes: ["28601"] },
    { name: "Viewmont", slug: "viewmont", type: "NEIGHBORHOOD", county: "Catawba", stateCode: "NC", zipCodes: ["28601"] },
    { name: "Oakwood Historic District", slug: "oakwood-historic-district", type: "NEIGHBORHOOD", county: "Catawba", stateCode: "NC", zipCodes: ["28601"] },
    { name: "Highland", slug: "highland-hickory", type: "NEIGHBORHOOD", county: "Catawba", stateCode: "NC", zipCodes: ["28601"] },
    { name: "Mountain View", slug: "mountain-view-hickory", type: "NEIGHBORHOOD", county: "Catawba", stateCode: "NC", zipCodes: ["28602"] },
    { name: "Kenworth", slug: "kenworth", type: "NEIGHBORHOOD", county: "Catawba", stateCode: "NC", zipCodes: ["28602"] },
    // Neighborhoods — Newton (Catawba)
    { name: "Downtown Newton", slug: "downtown-newton", type: "NEIGHBORHOOD", county: "Catawba", stateCode: "NC", zipCodes: ["28658"] },
    { name: "Newton Historic District", slug: "newton-historic-district", type: "NEIGHBORHOOD", county: "Catawba", stateCode: "NC", zipCodes: ["28658"] },
    { name: "Startown Road Area", slug: "startown-road-area", type: "NEIGHBORHOOD", county: "Catawba", stateCode: "NC", zipCodes: ["28658"] },
    // Neighborhoods — Conover (Catawba)
    { name: "Downtown Conover", slug: "downtown-conover", type: "NEIGHBORHOOD", county: "Catawba", stateCode: "NC", zipCodes: ["28613"] },
    { name: "Rock Barn Area", slug: "rock-barn-area", type: "NEIGHBORHOOD", county: "Catawba", stateCode: "NC", zipCodes: ["28613"] },
    { name: "Northwest Conover", slug: "northwest-conover", type: "NEIGHBORHOOD", county: "Catawba", stateCode: "NC", zipCodes: ["28613"] },
    // Neighborhoods — Maiden (Catawba)
    { name: "Downtown Maiden", slug: "downtown-maiden", type: "NEIGHBORHOOD", county: "Catawba", stateCode: "NC", zipCodes: ["28650"] },
    { name: "Maiden Historic District", slug: "maiden-historic-district", type: "NEIGHBORHOOD", county: "Catawba", stateCode: "NC", zipCodes: ["28650"] },
    { name: "Buffalo Shoals Area", slug: "buffalo-shoals-area", type: "NEIGHBORHOOD", county: "Catawba", stateCode: "NC", zipCodes: ["28650"] },
    // Neighborhoods — Taylorsville (Alexander)
    { name: "Downtown Taylorsville", slug: "downtown-taylorsville", type: "NEIGHBORHOOD", county: "Alexander", stateCode: "NC", zipCodes: ["28681"] },
    { name: "Taylorsville Historic District", slug: "taylorsville-historic-district", type: "NEIGHBORHOOD", county: "Alexander", stateCode: "NC", zipCodes: ["28681"] },
    { name: "Bethlehem Area", slug: "bethlehem-area", type: "NEIGHBORHOOD", county: "Alexander", stateCode: "NC", zipCodes: ["28681"] },
    // Neighborhoods — Hiddenite (Alexander)
    { name: "Downtown Hiddenite", slug: "downtown-hiddenite", type: "NEIGHBORHOOD", county: "Alexander", stateCode: "NC", zipCodes: ["28636"] },
    { name: "Hiddenite Gem District", slug: "hiddenite-gem-district", type: "NEIGHBORHOOD", county: "Alexander", stateCode: "NC", zipCodes: ["28636"] },
    // Neighborhoods — Morganton (Burke)
    { name: "Downtown Morganton", slug: "downtown-morganton", type: "NEIGHBORHOOD", county: "Burke", stateCode: "NC", zipCodes: ["28655"] },
    { name: "Historic Morganton District", slug: "historic-morganton-district", type: "NEIGHBORHOOD", county: "Burke", stateCode: "NC", zipCodes: ["28655"] },
    { name: "Catawba Meadows", slug: "catawba-meadows", type: "NEIGHBORHOOD", county: "Burke", stateCode: "NC", zipCodes: ["28655"] },
    { name: "Drexel Area", slug: "drexel-area", type: "NEIGHBORHOOD", county: "Burke", stateCode: "NC", zipCodes: ["28655"] },
    // Neighborhoods — Valdese (Burke)
    { name: "Downtown Valdese", slug: "downtown-valdese", type: "NEIGHBORHOOD", county: "Burke", stateCode: "NC", zipCodes: ["28690"] },
    { name: "Waldensian Historic District", slug: "waldensian-historic-district", type: "NEIGHBORHOOD", county: "Burke", stateCode: "NC", zipCodes: ["28690"] },
    { name: "Valdese Lakeside Area", slug: "valdese-lakeside-area", type: "NEIGHBORHOOD", county: "Burke", stateCode: "NC", zipCodes: ["28690"] },
    // Neighborhoods — Glen Alpine (Burke)
    { name: "Downtown Glen Alpine", slug: "downtown-glen-alpine", type: "NEIGHBORHOOD", county: "Burke", stateCode: "NC", zipCodes: ["28628"] },
    { name: "Lake James Gateway Area", slug: "lake-james-gateway-area", type: "NEIGHBORHOOD", county: "Burke", stateCode: "NC", zipCodes: ["28628"] },
    // Neighborhoods — Lenoir (Caldwell)
    { name: "Downtown Lenoir", slug: "downtown-lenoir", type: "NEIGHBORHOOD", county: "Caldwell", stateCode: "NC", zipCodes: ["28645"] },
    { name: "Lower Creek", slug: "lower-creek", type: "NEIGHBORHOOD", county: "Caldwell", stateCode: "NC", zipCodes: ["28645"] },
    { name: "Whitnel", slug: "whitnel", type: "NEIGHBORHOOD", county: "Caldwell", stateCode: "NC", zipCodes: ["28645"] },
    { name: "Gamewell", slug: "gamewell", type: "NEIGHBORHOOD", county: "Caldwell", stateCode: "NC", zipCodes: ["28645"] },
    // Neighborhoods — Granite Falls (Caldwell)
    { name: "Downtown Granite Falls", slug: "downtown-granite-falls", type: "NEIGHBORHOOD", county: "Caldwell", stateCode: "NC", zipCodes: ["28630"] },
    { name: "River Bend Park Area", slug: "river-bend-park-area", type: "NEIGHBORHOOD", county: "Caldwell", stateCode: "NC", zipCodes: ["28630"] },
    // Neighborhoods — Hudson (Caldwell)
    { name: "Downtown Hudson", slug: "downtown-hudson", type: "NEIGHBORHOOD", county: "Caldwell", stateCode: "NC", zipCodes: ["28638"] },
    { name: "Gunpowder Creek Area", slug: "gunpowder-creek-area", type: "NEIGHBORHOOD", county: "Caldwell", stateCode: "NC", zipCodes: ["28638"] },
    // Neighborhoods — Marion (McDowell)
    { name: "Downtown Marion", slug: "downtown-marion", type: "NEIGHBORHOOD", county: "McDowell", stateCode: "NC", zipCodes: ["28752"] },
    { name: "Historic Main Street", slug: "historic-main-street-marion", type: "NEIGHBORHOOD", county: "McDowell", stateCode: "NC", zipCodes: ["28752"] },
    { name: "Pleasant Gardens", slug: "pleasant-gardens", type: "NEIGHBORHOOD", county: "McDowell", stateCode: "NC", zipCodes: ["28752"] },
    { name: "Lake James Area", slug: "lake-james-area", type: "NEIGHBORHOOD", county: "McDowell", stateCode: "NC", zipCodes: ["28752"] },
    // Neighborhoods — Old Fort (McDowell)
    { name: "Downtown Old Fort", slug: "downtown-old-fort", type: "NEIGHBORHOOD", county: "McDowell", stateCode: "NC", zipCodes: ["28762"] },
    { name: "Old Fort Historic District", slug: "old-fort-historic-district", type: "NEIGHBORHOOD", county: "McDowell", stateCode: "NC", zipCodes: ["28762"] },
    { name: "Gateway Trails Area", slug: "gateway-trails-area", type: "NEIGHBORHOOD", county: "McDowell", stateCode: "NC", zipCodes: ["28762"] },
    // Neighborhoods — Cheraw (Chesterfield SC)
    { name: "Downtown Cheraw", slug: "downtown-cheraw", type: "NEIGHBORHOOD", county: "Chesterfield", stateCode: "SC", zipCodes: ["29520"] },
    { name: "Cheraw Historic District", slug: "cheraw-historic-district", type: "NEIGHBORHOOD", county: "Chesterfield", stateCode: "SC", zipCodes: ["29520"] },
    { name: "Riverside Park Area", slug: "riverside-park-area", type: "NEIGHBORHOOD", county: "Chesterfield", stateCode: "SC", zipCodes: ["29520"] },
    // Neighborhoods — Chesterfield (Chesterfield SC)
    { name: "Downtown Chesterfield", slug: "downtown-chesterfield", type: "NEIGHBORHOOD", county: "Chesterfield", stateCode: "SC", zipCodes: ["29709"] },
    { name: "Chesterfield Historic District", slug: "chesterfield-historic-district", type: "NEIGHBORHOOD", county: "Chesterfield", stateCode: "SC", zipCodes: ["29709"] },
    // Neighborhoods — Pageland (Chesterfield SC)
    { name: "Downtown Pageland", slug: "downtown-pageland", type: "NEIGHBORHOOD", county: "Chesterfield", stateCode: "SC", zipCodes: ["29728"] },
    { name: "Pageland Historic District", slug: "pageland-historic-district", type: "NEIGHBORHOOD", county: "Chesterfield", stateCode: "SC", zipCodes: ["29728"] },
    // Counties
    { name: "Mecklenburg County", slug: "mecklenburg-county", type: "COUNTY", county: "Mecklenburg", stateCode: "NC", zipCodes: ["28202","28203","28204","28205","28206","28207","28208","28209","28210","28211","28212","28213","28214","28215","28216","28217","28226","28227","28244","28262","28269","28270","28273","28277","28278"] },
    { name: "Cabarrus County", slug: "cabarrus-county", type: "COUNTY", county: "Cabarrus", stateCode: "NC", zipCodes: ["28025","28027","28075","28081","28083","28107","28124"] },
    { name: "Union County", slug: "union-county", type: "COUNTY", county: "Union", stateCode: "NC", zipCodes: ["28079","28104","28110","28112","28173"] },
    { name: "Gaston County", slug: "gaston-county", type: "COUNTY", county: "Gaston", stateCode: "NC", zipCodes: ["28012","28032","28052","28054","28056","28098","28101","28120"] },
    { name: "Iredell County", slug: "iredell-county", type: "COUNTY", county: "Iredell", stateCode: "NC", zipCodes: ["28115","28117","28166","28625","28677","28687"] },
    { name: "Lincoln County", slug: "lincoln-county", type: "COUNTY", county: "Lincoln", stateCode: "NC", zipCodes: ["28037","28092"] },
    { name: "York County", slug: "york-county", type: "COUNTY", county: "York", stateCode: "SC", zipCodes: ["29708","29710","29715","29730","29732","29733","29745"] },
    { name: "Lancaster County", slug: "lancaster-county", type: "COUNTY", county: "Lancaster", stateCode: "SC", zipCodes: ["29707","29720"] },
    { name: "Chester County", slug: "chester-county", type: "COUNTY", county: "Chester", stateCode: "SC", zipCodes: ["29055","29706"] },
    { name: "Rowan County", slug: "rowan-county", type: "COUNTY", county: "Rowan", stateCode: "NC", zipCodes: ["28023","28144","28146","28147"] },
    { name: "Stanly County", slug: "stanly-county", type: "COUNTY", county: "Stanly", stateCode: "NC", zipCodes: ["28001","28002","28097","28128"] },
    { name: "Anson County", slug: "anson-county", type: "COUNTY", county: "Anson", stateCode: "NC", zipCodes: ["28170","28135","28133","28119","28091"] },
    { name: "Cleveland County", slug: "cleveland-county", type: "COUNTY", county: "Cleveland", stateCode: "NC", zipCodes: ["28150","28152","28086","28017","28090"] },
    { name: "Catawba County", slug: "catawba-county", type: "COUNTY", county: "Catawba", stateCode: "NC", zipCodes: ["28601","28602","28658","28613","28650"] },
    { name: "Alexander County", slug: "alexander-county", type: "COUNTY", county: "Alexander", stateCode: "NC", zipCodes: ["28681","28636"] },
    { name: "Burke County", slug: "burke-county", type: "COUNTY", county: "Burke", stateCode: "NC", zipCodes: ["28655","28690","28628"] },
    { name: "Caldwell County", slug: "caldwell-county", type: "COUNTY", county: "Caldwell", stateCode: "NC", zipCodes: ["28645","28630","28638"] },
    { name: "McDowell County", slug: "mcdowell-county", type: "COUNTY", county: "McDowell", stateCode: "NC", zipCodes: ["28752","28762"] },
    { name: "Chesterfield County", slug: "chesterfield-county", type: "COUNTY", county: "Chesterfield", stateCode: "SC", zipCodes: ["29520","29709","29728"] },
    // ZIP codes
    { name: "28012", slug: "zip-28012", type: "ZIP", county: "Gaston", stateCode: "NC", zipCodes: ["28012"] },
    { name: "28025", slug: "zip-28025", type: "ZIP", county: "Cabarrus", stateCode: "NC", zipCodes: ["28025"] },
    { name: "28027", slug: "zip-28027", type: "ZIP", county: "Cabarrus", stateCode: "NC", zipCodes: ["28027"] },
    { name: "28031", slug: "zip-28031", type: "ZIP", county: "Mecklenburg", stateCode: "NC", zipCodes: ["28031"] },
    { name: "28036", slug: "zip-28036", type: "ZIP", county: "Mecklenburg", stateCode: "NC", zipCodes: ["28036"] },
    { name: "28052", slug: "zip-28052", type: "ZIP", county: "Gaston", stateCode: "NC", zipCodes: ["28052"] },
    { name: "28054", slug: "zip-28054", type: "ZIP", county: "Gaston", stateCode: "NC", zipCodes: ["28054"] },
    { name: "28056", slug: "zip-28056", type: "ZIP", county: "Gaston", stateCode: "NC", zipCodes: ["28056"] },
    { name: "28075", slug: "zip-28075", type: "ZIP", county: "Cabarrus", stateCode: "NC", zipCodes: ["28075"] },
    { name: "28078", slug: "zip-28078", type: "ZIP", county: "Mecklenburg", stateCode: "NC", zipCodes: ["28078"] },
    { name: "28079", slug: "zip-28079", type: "ZIP", county: "Union", stateCode: "NC", zipCodes: ["28079"] },
    { name: "28081", slug: "zip-28081", type: "ZIP", county: "Cabarrus", stateCode: "NC", zipCodes: ["28081"] },
    { name: "28083", slug: "zip-28083", type: "ZIP", county: "Cabarrus", stateCode: "NC", zipCodes: ["28083"] },
    { name: "28104", slug: "zip-28104", type: "ZIP", county: "Union", stateCode: "NC", zipCodes: ["28104"] },
    { name: "28105", slug: "zip-28105", type: "ZIP", county: "Mecklenburg", stateCode: "NC", zipCodes: ["28105"] },
    { name: "28110", slug: "zip-28110", type: "ZIP", county: "Union", stateCode: "NC", zipCodes: ["28110"] },
    { name: "28115", slug: "zip-28115", type: "ZIP", county: "Iredell", stateCode: "NC", zipCodes: ["28115"] },
    { name: "28117", slug: "zip-28117", type: "ZIP", county: "Iredell", stateCode: "NC", zipCodes: ["28117"] },
    { name: "28120", slug: "zip-28120", type: "ZIP", county: "Gaston", stateCode: "NC", zipCodes: ["28120"] },
    { name: "28134", slug: "zip-28134", type: "ZIP", county: "Mecklenburg", stateCode: "NC", zipCodes: ["28134"] },
    { name: "28173", slug: "zip-28173", type: "ZIP", county: "Union", stateCode: "NC", zipCodes: ["28173"] },
    { name: "28202", slug: "zip-28202", type: "ZIP", county: "Mecklenburg", stateCode: "NC", zipCodes: ["28202"] },
    { name: "28203", slug: "zip-28203", type: "ZIP", county: "Mecklenburg", stateCode: "NC", zipCodes: ["28203"] },
    { name: "28204", slug: "zip-28204", type: "ZIP", county: "Mecklenburg", stateCode: "NC", zipCodes: ["28204"] },
    { name: "28205", slug: "zip-28205", type: "ZIP", county: "Mecklenburg", stateCode: "NC", zipCodes: ["28205"] },
    { name: "28206", slug: "zip-28206", type: "ZIP", county: "Mecklenburg", stateCode: "NC", zipCodes: ["28206"] },
    { name: "28207", slug: "zip-28207", type: "ZIP", county: "Mecklenburg", stateCode: "NC", zipCodes: ["28207"] },
    { name: "28208", slug: "zip-28208", type: "ZIP", county: "Mecklenburg", stateCode: "NC", zipCodes: ["28208"] },
    { name: "28209", slug: "zip-28209", type: "ZIP", county: "Mecklenburg", stateCode: "NC", zipCodes: ["28209"] },
    { name: "28210", slug: "zip-28210", type: "ZIP", county: "Mecklenburg", stateCode: "NC", zipCodes: ["28210"] },
    { name: "28211", slug: "zip-28211", type: "ZIP", county: "Mecklenburg", stateCode: "NC", zipCodes: ["28211"] },
    { name: "28212", slug: "zip-28212", type: "ZIP", county: "Mecklenburg", stateCode: "NC", zipCodes: ["28212"] },
    { name: "28213", slug: "zip-28213", type: "ZIP", county: "Mecklenburg", stateCode: "NC", zipCodes: ["28213"] },
    { name: "28214", slug: "zip-28214", type: "ZIP", county: "Mecklenburg", stateCode: "NC", zipCodes: ["28214"] },
    { name: "28215", slug: "zip-28215", type: "ZIP", county: "Mecklenburg", stateCode: "NC", zipCodes: ["28215"] },
    { name: "28216", slug: "zip-28216", type: "ZIP", county: "Mecklenburg", stateCode: "NC", zipCodes: ["28216"] },
    { name: "28217", slug: "zip-28217", type: "ZIP", county: "Mecklenburg", stateCode: "NC", zipCodes: ["28217"] },
    { name: "28218", slug: "zip-28218", type: "ZIP", county: "Mecklenburg", stateCode: "NC", zipCodes: ["28218"] },
    { name: "28219", slug: "zip-28219", type: "ZIP", county: "Mecklenburg", stateCode: "NC", zipCodes: ["28219"] },
    { name: "28220", slug: "zip-28220", type: "ZIP", county: "Mecklenburg", stateCode: "NC", zipCodes: ["28220"] },
    { name: "28226", slug: "zip-28226", type: "ZIP", county: "Mecklenburg", stateCode: "NC", zipCodes: ["28226"] },
    { name: "28227", slug: "zip-28227", type: "ZIP", county: "Mecklenburg", stateCode: "NC", zipCodes: ["28227"] },
    { name: "28244", slug: "zip-28244", type: "ZIP", county: "Mecklenburg", stateCode: "NC", zipCodes: ["28244"] },
    { name: "28262", slug: "zip-28262", type: "ZIP", county: "Mecklenburg", stateCode: "NC", zipCodes: ["28262"] },
    { name: "28269", slug: "zip-28269", type: "ZIP", county: "Mecklenburg", stateCode: "NC", zipCodes: ["28269"] },
    { name: "28270", slug: "zip-28270", type: "ZIP", county: "Mecklenburg", stateCode: "NC", zipCodes: ["28270"] },
    { name: "28273", slug: "zip-28273", type: "ZIP", county: "Mecklenburg", stateCode: "NC", zipCodes: ["28273"] },
    { name: "28277", slug: "zip-28277", type: "ZIP", county: "Mecklenburg", stateCode: "NC", zipCodes: ["28277"] },
    { name: "28278", slug: "zip-28278", type: "ZIP", county: "Mecklenburg", stateCode: "NC", zipCodes: ["28278"] },
    { name: "28625", slug: "zip-28625", type: "ZIP", county: "Iredell", stateCode: "NC", zipCodes: ["28625"] },
    { name: "29707", slug: "zip-29707", type: "ZIP", county: "Lancaster", stateCode: "SC", zipCodes: ["29707"] },
    { name: "29708", slug: "zip-29708", type: "ZIP", county: "York", stateCode: "SC", zipCodes: ["29708"] },
    { name: "29715", slug: "zip-29715", type: "ZIP", county: "York", stateCode: "SC", zipCodes: ["29715"] },
    { name: "29720", slug: "zip-29720", type: "ZIP", county: "Lancaster", stateCode: "SC", zipCodes: ["29720"] },
    { name: "29745", slug: "zip-29745", type: "ZIP", county: "York", stateCode: "SC", zipCodes: ["29745"] },
    { name: "28023", slug: "zip-28023", type: "ZIP", county: "Rowan", stateCode: "NC", zipCodes: ["28023"] },
    { name: "28097", slug: "zip-28097", type: "ZIP", county: "Stanly", stateCode: "NC", zipCodes: ["28097"] },
    { name: "28687", slug: "zip-28687", type: "ZIP", county: "Iredell", stateCode: "NC", zipCodes: ["28687"] },
    { name: "29055", slug: "zip-29055", type: "ZIP", county: "Chester", stateCode: "SC", zipCodes: ["29055"] },
    { name: "28170", slug: "zip-28170", type: "ZIP", county: "Anson", stateCode: "NC", zipCodes: ["28170"] },
    { name: "28135", slug: "zip-28135", type: "ZIP", county: "Anson", stateCode: "NC", zipCodes: ["28135"] },
    { name: "28133", slug: "zip-28133", type: "ZIP", county: "Anson", stateCode: "NC", zipCodes: ["28133"] },
    { name: "28119", slug: "zip-28119", type: "ZIP", county: "Anson", stateCode: "NC", zipCodes: ["28119"] },
    { name: "28091", slug: "zip-28091", type: "ZIP", county: "Anson", stateCode: "NC", zipCodes: ["28091"] },
    { name: "28150", slug: "zip-28150", type: "ZIP", county: "Cleveland", stateCode: "NC", zipCodes: ["28150"] },
    { name: "28152", slug: "zip-28152", type: "ZIP", county: "Cleveland", stateCode: "NC", zipCodes: ["28152"] },
    { name: "28086", slug: "zip-28086", type: "ZIP", county: "Cleveland", stateCode: "NC", zipCodes: ["28086"] },
    { name: "28017", slug: "zip-28017", type: "ZIP", county: "Cleveland", stateCode: "NC", zipCodes: ["28017"] },
    { name: "28090", slug: "zip-28090", type: "ZIP", county: "Cleveland", stateCode: "NC", zipCodes: ["28090"] },
    { name: "28601", slug: "zip-28601", type: "ZIP", county: "Catawba", stateCode: "NC", zipCodes: ["28601"] },
    { name: "28602", slug: "zip-28602", type: "ZIP", county: "Catawba", stateCode: "NC", zipCodes: ["28602"] },
    { name: "28658", slug: "zip-28658", type: "ZIP", county: "Catawba", stateCode: "NC", zipCodes: ["28658"] },
    { name: "28613", slug: "zip-28613", type: "ZIP", county: "Catawba", stateCode: "NC", zipCodes: ["28613"] },
    { name: "28650", slug: "zip-28650", type: "ZIP", county: "Catawba", stateCode: "NC", zipCodes: ["28650"] },
    { name: "28681", slug: "zip-28681", type: "ZIP", county: "Alexander", stateCode: "NC", zipCodes: ["28681"] },
    { name: "28636", slug: "zip-28636", type: "ZIP", county: "Alexander", stateCode: "NC", zipCodes: ["28636"] },
    { name: "28655", slug: "zip-28655", type: "ZIP", county: "Burke", stateCode: "NC", zipCodes: ["28655"] },
    { name: "28690", slug: "zip-28690", type: "ZIP", county: "Burke", stateCode: "NC", zipCodes: ["28690"] },
    { name: "28628", slug: "zip-28628", type: "ZIP", county: "Burke", stateCode: "NC", zipCodes: ["28628"] },
    { name: "28645", slug: "zip-28645", type: "ZIP", county: "Caldwell", stateCode: "NC", zipCodes: ["28645"] },
    { name: "28630", slug: "zip-28630", type: "ZIP", county: "Caldwell", stateCode: "NC", zipCodes: ["28630"] },
    { name: "28638", slug: "zip-28638", type: "ZIP", county: "Caldwell", stateCode: "NC", zipCodes: ["28638"] },
    { name: "28752", slug: "zip-28752", type: "ZIP", county: "McDowell", stateCode: "NC", zipCodes: ["28752"] },
    { name: "28762", slug: "zip-28762", type: "ZIP", county: "McDowell", stateCode: "NC", zipCodes: ["28762"] },
    { name: "29520", slug: "zip-29520", type: "ZIP", county: "Chesterfield", stateCode: "SC", zipCodes: ["29520"] },
    { name: "29709", slug: "zip-29709", type: "ZIP", county: "Chesterfield", stateCode: "SC", zipCodes: ["29709"] },
    { name: "29728", slug: "zip-29728", type: "ZIP", county: "Chesterfield", stateCode: "SC", zipCodes: ["29728"] },
  ];

  const existingZones = await db.select().from(zones).where(eq(zones.cityId, cityId));
  const existingSlugs = new Map(existingZones.map(z => [z.slug, z]));
  const existingNames = new Map(existingZones.map(z => [`${z.name}:${z.type}`, z]));

  let created = 0;
  let updated = 0;

  for (const z of fullMetroZones) {
    const existing = existingSlugs.get(z.slug) || existingNames.get(`${z.name}:${z.type}`);
    if (!existing) {
      await storage.createZone({ ...z, cityId, isActive: true });
      created++;
    } else {
      const existingZips = (existing.zipCodes || []).sort().join(",");
      const newZips = (z.zipCodes || []).sort().join(",");
      const needsUpdate =
        !existing.county ||
        !existing.stateCode ||
        !existing.zipCodes ||
        existing.zipCodes.length === 0 ||
        existingZips !== newZips;
      if (needsUpdate) {
        await db.update(zones).set({
          county: z.county,
          stateCode: z.stateCode,
          zipCodes: z.zipCodes,
        }).where(eq(zones.id, existing.id));
        updated++;
      }
    }
  }

  const neighborhoodParents: Record<string, string> = {
    "downtown-waxhaw": "waxhaw",
    "cureton": "waxhaw",
    "weddington-chase": "weddington",
    "bromley": "weddington",
    "baxter": "fort-mill",
    "kingsley": "fort-mill",
    "downtown-clover": "clover",
    "downtown-wadesboro": "wadesboro",
    "wadesboro-historic-district": "wadesboro",
    "ansonville-road-area": "wadesboro",
    "morven-road-corridor": "wadesboro",
    "downtown-polkton": "polkton",
    "polkton-historic-area": "polkton",
    "brown-creek-area": "polkton",
    "downtown-peachland": "peachland",
    "peachland-historic-district": "peachland",
    "downtown-morven": "morven",
    "morven-historic-area": "morven",
    "downtown-lilesville": "lilesville",
    "pee-dee-river-area": "lilesville",
    "uptown-shelby": "shelby",
    "shelby-historic-district": "shelby",
    "cleveland-country-club": "shelby",
    "west-shelby": "shelby",
    "east-shelby": "shelby",
    "downtown-kings-mountain": "kings-mountain",
    "mountain-view-km": "kings-mountain",
    "moss-lake-area": "kings-mountain",
    "dixon-school-road-area": "kings-mountain",
    "gardner-webb-university-area": "boiling-springs",
    "boiling-springs-historic-district": "boiling-springs",
    "south-main-area": "boiling-springs",
    "downtown-lawndale": "lawndale",
    "lawndale-historic-district": "lawndale",
    "downtown-hickory": "hickory",
    "viewmont": "hickory",
    "oakwood-historic-district": "hickory",
    "highland-hickory": "hickory",
    "mountain-view-hickory": "hickory",
    "kenworth": "hickory",
    "downtown-newton": "newton",
    "newton-historic-district": "newton",
    "startown-road-area": "newton",
    "downtown-conover": "conover",
    "rock-barn-area": "conover",
    "northwest-conover": "conover",
    "downtown-maiden": "maiden",
    "maiden-historic-district": "maiden",
    "buffalo-shoals-area": "maiden",
    "downtown-taylorsville": "taylorsville",
    "taylorsville-historic-district": "taylorsville",
    "bethlehem-area": "taylorsville",
    "downtown-hiddenite": "hiddenite",
    "hiddenite-gem-district": "hiddenite",
    "downtown-morganton": "morganton",
    "historic-morganton-district": "morganton",
    "catawba-meadows": "morganton",
    "drexel-area": "morganton",
    "downtown-valdese": "valdese",
    "waldensian-historic-district": "valdese",
    "valdese-lakeside-area": "valdese",
    "downtown-glen-alpine": "glen-alpine",
    "lake-james-gateway-area": "glen-alpine",
    "downtown-lenoir": "lenoir",
    "lower-creek": "lenoir",
    "whitnel": "lenoir",
    "gamewell": "lenoir",
    "downtown-granite-falls": "granite-falls",
    "river-bend-park-area": "granite-falls",
    "downtown-hudson": "hudson",
    "gunpowder-creek-area": "hudson",
    "downtown-marion": "marion",
    "historic-main-street-marion": "marion",
    "pleasant-gardens": "marion",
    "lake-james-area": "marion",
    "downtown-old-fort": "old-fort",
    "old-fort-historic-district": "old-fort",
    "gateway-trails-area": "old-fort",
    "downtown-cheraw": "cheraw",
    "cheraw-historic-district": "cheraw",
    "riverside-park-area": "cheraw",
    "downtown-chesterfield": "chesterfield",
    "chesterfield-historic-district": "chesterfield",
    "downtown-pageland": "pageland",
    "pageland-historic-district": "pageland",
  };

  const allZonesNow = await db.select().from(zones).where(eq(zones.cityId, cityId));
  const slugToId = new Map(allZonesNow.map(z => [z.slug, z.id]));
  const slugToParent = new Map(allZonesNow.map(z => [z.slug, z.parentZoneId]));
  let linked = 0;
  for (const [childSlug, parentSlug] of Object.entries(neighborhoodParents)) {
    const childId = slugToId.get(childSlug);
    const parentId = slugToId.get(parentSlug);
    if (childId && parentId && slugToParent.get(childSlug) !== parentId) {
      await db.update(zones).set({ parentZoneId: parentId }).where(eq(zones.id, childId));
      linked++;
    }
  }

  if (created > 0 || updated > 0 || linked > 0) {
    console.log(`[SEED] Metro zones: created ${created}, backfilled ${updated}${linked > 0 ? `, linked ${linked} neighborhoods` : ""}`);
  } else {
    console.log(`[SEED] All ${fullMetroZones.length} metro zones present`);
  }
}

async function ensureEmailTemplatesSeeded() {
  const existing = await db.select().from(emailTemplates).limit(1);
  if (existing.length > 0) return;

  const brandHeader = `<div style="background: #5B1D8F; padding: 24px 32px; text-align: center;">
      <h1 style="color: #ffffff; font-family: sans-serif; margin: 0; font-size: 22px;">CLT Metro Hub</h1>
    </div>`;
  const brandFooter = `<div style="border-top: 1px solid #e5e5e5; padding: 20px 32px; text-align: center; color: #999; font-size: 11px; font-family: sans-serif;">
      <p style="margin: 0 0 8px;">CLT Metro Hub &bull; Charlotte, NC</p>
      <p style="margin: 0 0 8px;"><a href="{{spanishUrl}}" style="color: #999; text-decoration: underline; font-size: 11px;">Ver en Español →</a></p>
      <p style="margin: 0;">Reply to this email to opt out of future communications.</p>
    </div>`;

  const templates: Array<{ templateKey: "claim_invite" | "welcome" | "prospecting" | "weekly_hub" | "weekend_hub"; classification: "transactional" | "marketing"; name: string; subject: string; preheader: string; htmlBody: string; textBody: string }> = [
    {
      templateKey: "claim_invite",
      classification: "transactional",
      name: "Claim Your Listing Invitation",
      subject: 'Your listing "{{businessName}}" is live — claim it!',
      preheader: "Your business is on CLT Metro Hub. Claim it to manage your details.",
      htmlBody: `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e5e5e5; border-radius: 8px; overflow: hidden;">
    ${brandHeader}
    <div style="padding: 32px;">
      <h2 style="color: #1a1a2e; margin: 0 0 16px; font-size: 20px;">Your listing "{{businessName}}" is live!</h2>
      <p style="color: #444; line-height: 1.6; margin: 0 0 16px;">Great news — your business has been added to CLT Metro Hub. Claim your listing to manage your details, add photos, respond to reviews, and boost your visibility to the Charlotte community.</p>
      <p style="margin: 0 0 12px;"><a href="{{viewUrl}}" style="color: #5B1D8F; font-weight: 600;">View your listing &rarr;</a></p>
      <p style="text-align: center; margin: 24px 0;">
        <a href="{{claimUrl}}" style="display: inline-block; padding: 14px 32px; background: #F2C230; color: #1a1a2e; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">Claim Your Listing</a>
      </p>
      <p style="color: #888; font-size: 13px; margin: 24px 0 0;">This link expires in 14 days. If you didn't expect this email, you can safely ignore it.</p>
    </div>
    ${brandFooter}
  </div>`,
      textBody: `Your listing "{{businessName}}" is live on CLT Metro Hub!\n\nClaim your listing to manage your details and boost your visibility.\n\nView your listing: {{viewUrl}}\nClaim your listing: {{claimUrl}}\n\nThis link expires in 14 days.`,
    },
    {
      templateKey: "welcome",
      classification: "transactional",
      name: "Welcome to CLT Metro Hub",
      subject: "Welcome to CLT Metro Hub!",
      preheader: "You're in! Explore local businesses, events, and more.",
      htmlBody: `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e5e5e5; border-radius: 8px; overflow: hidden;">
    ${brandHeader}
    <div style="padding: 32px;">
      <h2 style="color: #1a1a2e; margin: 0 0 16px; font-size: 20px;">Welcome, {{name}}!</h2>
      <p style="color: #444; line-height: 1.6; margin: 0 0 16px;">Thanks for joining CLT Metro Hub — your go-to guide for everything local in the Charlotte metro area.</p>
      <p style="color: #444; line-height: 1.6; margin: 0 0 8px;"><strong>Here's what you can do:</strong></p>
      <ul style="color: #444; line-height: 1.8; margin: 0 0 24px; padding-left: 20px;">
        <li>Discover local businesses and services</li>
        <li>Find upcoming events and happenings</li>
        <li>Save your favorites and write reviews</li>
        <li>Get a weekly digest of what's new</li>
      </ul>
      <p style="text-align: center; margin: 24px 0;">
        <a href="{{siteUrl}}" style="display: inline-block; padding: 14px 32px; background: #F2C230; color: #1a1a2e; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">Explore CLT Metro Hub</a>
      </p>
    </div>
    ${brandFooter}
  </div>`,
      textBody: `Welcome to CLT Metro Hub, {{name}}!\n\nThanks for joining — your go-to guide for everything local in the Charlotte metro area.\n\nDiscover businesses, find events, save favorites, and get a weekly digest.\n\nExplore: {{siteUrl}}`,
    },
    {
      templateKey: "prospecting",
      classification: "marketing",
      name: "Business Prospecting Outreach",
      subject: "{{businessName}} — get discovered by the Charlotte community",
      preheader: "We'd love to feature your business on CLT Metro Hub.",
      htmlBody: `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e5e5e5; border-radius: 8px; overflow: hidden;">
    ${brandHeader}
    <div style="padding: 32px;">
      <h2 style="color: #1a1a2e; margin: 0 0 16px; font-size: 20px;">Get {{businessName}} in front of the Charlotte community</h2>
      <p style="color: #444; line-height: 1.6; margin: 0 0 16px;">Hi there! CLT Metro Hub is the local platform Charlotteans use to find businesses like yours. We'd love to feature {{businessName}} on our directory.</p>
      <p style="color: #444; line-height: 1.6; margin: 0 0 8px;"><strong>What you get — for free:</strong></p>
      <ul style="color: #444; line-height: 1.8; margin: 0 0 24px; padding-left: 20px;">
        <li>A verified business listing visible to the Charlotte community</li>
        <li>Your business on our local directory and maps</li>
        <li>The ability to manage your details and respond to reviews</li>
      </ul>
      <p style="color: #444; line-height: 1.6; margin: 0 0 24px;">Interested in a premium listing with an AI-generated website, photo gallery, and bilingual support? We have affordable plans starting at $99/year.</p>
      <p style="text-align: center; margin: 24px 0;">
        <a href="{{claimUrl}}" style="display: inline-block; padding: 14px 32px; background: #F2C230; color: #1a1a2e; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">Claim Your Free Listing</a>
      </p>
    </div>
    ${brandFooter}
  </div>`,
      textBody: `Get {{businessName}} in front of the Charlotte community!\n\nCLT Metro Hub is the local platform Charlotteans use to find businesses like yours.\n\nWhat you get for free:\n- A verified business listing\n- Directory and map visibility\n- Manage your details and reviews\n\nPremium plans with AI websites start at $99/year.\n\nClaim your listing: {{claimUrl}}`,
    },
    {
      templateKey: "weekly_hub",
      classification: "marketing",
      name: "Weekly Hub Digest",
      subject: "This week in Charlotte — {{weekDate}}",
      preheader: "New businesses, upcoming events, and local stories from your city hub.",
      htmlBody: `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e5e5e5; border-radius: 8px; overflow: hidden;">
    ${brandHeader}
    <div style="padding: 32px;">
      <h2 style="color: #1a1a2e; margin: 0 0 16px; font-size: 20px;">This Week in Charlotte</h2>
      <p style="color: #444; line-height: 1.6; margin: 0 0 24px;">Here's what's new and happening in the Charlotte metro this week.</p>
      <div style="border-left: 3px solid #5B1D8F; padding-left: 16px; margin: 0 0 24px;">
        <h3 style="color: #5B1D8F; margin: 0 0 8px; font-size: 15px;">New Businesses</h3>
        <p style="color: #666; margin: 0; font-size: 14px;">{{newBusinesses}}</p>
      </div>
      <div style="border-left: 3px solid #F2C230; padding-left: 16px; margin: 0 0 24px;">
        <h3 style="color: #b8860b; margin: 0 0 8px; font-size: 15px;">Upcoming Events</h3>
        <p style="color: #666; margin: 0; font-size: 14px;">{{upcomingEvents}}</p>
      </div>
      <div style="border-left: 3px solid #5B1D8F; padding-left: 16px; margin: 0 0 24px;">
        <h3 style="color: #5B1D8F; margin: 0 0 8px; font-size: 15px;">From the Pulse</h3>
        <p style="color: #666; margin: 0; font-size: 14px;">{{articles}}</p>
      </div>
      <p style="text-align: center; margin: 24px 0;">
        <a href="{{siteUrl}}" style="display: inline-block; padding: 14px 32px; background: #F2C230; color: #1a1a2e; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">Explore CLT Metro Hub</a>
      </p>
    </div>
    ${brandFooter}
  </div>`,
      textBody: `This Week in Charlotte — {{weekDate}}\n\nNew Businesses:\n{{newBusinesses}}\n\nUpcoming Events:\n{{upcomingEvents}}\n\nFrom the Pulse:\n{{articles}}\n\nExplore: {{siteUrl}}`,
    },
    {
      templateKey: "weekend_hub",
      classification: "marketing",
      name: "Weekend Edition",
      subject: "Your Charlotte weekend — {{weekendDate}}",
      preheader: "Weekend plans sorted — events, food, and things to do in Charlotte.",
      htmlBody: `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e5e5e5; border-radius: 8px; overflow: hidden;">
    ${brandHeader}
    <div style="padding: 32px;">
      <h2 style="color: #1a1a2e; margin: 0 0 16px; font-size: 20px;">Your Charlotte Weekend</h2>
      <p style="color: #444; line-height: 1.6; margin: 0 0 24px;">The best of what's happening this weekend in the Charlotte metro.</p>
      <div style="border-left: 3px solid #F2C230; padding-left: 16px; margin: 0 0 24px;">
        <h3 style="color: #b8860b; margin: 0 0 8px; font-size: 15px;">Weekend Events</h3>
        <p style="color: #666; margin: 0; font-size: 14px;">{{weekendEvents}}</p>
      </div>
      <div style="border-left: 3px solid #5B1D8F; padding-left: 16px; margin: 0 0 24px;">
        <h3 style="color: #5B1D8F; margin: 0 0 8px; font-size: 15px;">Featured Spots</h3>
        <p style="color: #666; margin: 0; font-size: 14px;">{{featuredBusinesses}}</p>
      </div>
      <p style="text-align: center; margin: 24px 0;">
        <a href="{{siteUrl}}" style="display: inline-block; padding: 14px 32px; background: #F2C230; color: #1a1a2e; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">See More This Weekend</a>
      </p>
    </div>
    ${brandFooter}
  </div>`,
      textBody: `Your Charlotte Weekend — {{weekendDate}}\n\nWeekend Events:\n{{weekendEvents}}\n\nFeatured Spots:\n{{featuredBusinesses}}\n\nExplore: {{siteUrl}}`,
    },
  ];

  let created = 0;
  for (const t of templates) {
    await storage.createEmailTemplate({ ...t, status: "active" });
    created++;
  }
  console.log(`[SEED] Email templates: created ${created} starter templates`);
}

export async function ensureLiveFeedOrgsSeeded(cityId: string) {
  const uptownZone = await db.select().from(zones).where(and(eq(zones.cityId, cityId), eq(zones.slug, "uptown"))).limit(1);
  if (uptownZone.length === 0) {
    console.log("[SEED] Live feed orgs: Uptown zone not found, skipping");
    return;
  }
  const zoneId = uptownZone[0].id;

  const orgs: Array<{
    slug: string;
    name: string;
    presenceType: "commerce" | "organization";
    isNonprofit?: boolean;
    websiteUrl: string;
    description: string;
    missionStatement?: string;
    category?: string;
  }> = [
    {
      slug: "wbtv-charlotte",
      name: "WBTV Charlotte",
      presenceType: "commerce",
      websiteUrl: "https://www.wbtv.com",
      description: "WBTV is Charlotte's CBS affiliate, providing local news, weather, and live streaming content including the iconic Charlotte skyline tower cam.",
      category: "entertainment-recreation",
    },
    {
      slug: "jordan-lake-state-recreation-area",
      name: "Jordan Lake State Recreation Area",
      presenceType: "organization",
      isNonprofit: true,
      websiteUrl: "https://www.ncparks.gov/jordan-lake-state-recreation-area",
      description: "Jordan Lake State Recreation Area is a 13,900-acre reservoir in Chatham County, NC, popular for boating, fishing, swimming, and wildlife observation.",
      missionStatement: "Preserving and protecting the natural resources of Jordan Lake while providing quality recreational opportunities for visitors.",
    },
    {
      slug: "outer-banks-visitors-bureau",
      name: "Outer Banks Visitors Bureau",
      presenceType: "organization",
      websiteUrl: "https://www.outerbanks.org",
      description: "The official visitors bureau for the Outer Banks of North Carolina, providing tourism information, webcams, and travel guides.",
      missionStatement: "Promoting the Outer Banks as a premier travel destination and supporting the local tourism economy.",
    },
    {
      slug: "surfchex",
      name: "Surfchex",
      presenceType: "commerce",
      websiteUrl: "https://www.surfchex.com",
      description: "Surfchex provides live HD webcams and surf reports for beaches across the Carolinas, helping beachgoers check conditions in real time.",
    },
    {
      slug: "town-of-emerald-isle",
      name: "Town of Emerald Isle",
      presenceType: "organization",
      websiteUrl: "https://www.emeraldisle-nc.org",
      description: "The Town of Emerald Isle is a coastal community on Bogue Banks in Carteret County, NC, known for its beautiful beaches and family-friendly atmosphere.",
      missionStatement: "Providing quality municipal services and preserving the natural beauty of Emerald Isle for residents and visitors.",
    },
    {
      slug: "bryson-city-tourism",
      name: "Bryson City / Swain County Tourism",
      presenceType: "organization",
      websiteUrl: "https://www.explorebrysoncity.com",
      description: "Swain County Tourism Development Authority promotes Bryson City and the Great Smoky Mountains as a destination for outdoor adventure and mountain culture.",
      missionStatement: "Promoting tourism in Bryson City and Swain County to support the local economy and share the beauty of the Smoky Mountains.",
    },
    {
      slug: "wcnc-charlotte",
      name: "WCNC Charlotte",
      presenceType: "commerce",
      websiteUrl: "https://www.wcnc.com",
      description: "WCNC is Charlotte's NBC affiliate, delivering local news, investigative reports, weather forecasts, and live streaming coverage.",
      category: "entertainment-recreation",
    },
    {
      slug: "wsoc-tv-charlotte",
      name: "WSOC-TV Charlotte",
      presenceType: "commerce",
      websiteUrl: "https://www.wsoctv.com",
      description: "WSOC-TV is Charlotte's ABC affiliate, providing breaking news, severe weather coverage, and community reporting across the Charlotte metro.",
      category: "entertainment-recreation",
    },
    {
      slug: "ncdot",
      name: "NCDOT (NC Dept of Transportation)",
      presenceType: "organization",
      websiteUrl: "https://www.ncdot.gov",
      description: "The North Carolina Department of Transportation manages the state's highway system, providing traffic cameras, road conditions, and transportation planning.",
      missionStatement: "Connecting people, products, and places safely and efficiently with customer focus, accountability, and environmental sensitivity.",
    },
    {
      slug: "charlotte-city-council",
      name: "Charlotte City Council",
      presenceType: "organization",
      websiteUrl: "https://www.charlottenc.gov/Government/City-Council",
      description: "The Charlotte City Council is the legislative body of the City of Charlotte, holding public meetings and setting policy for the city.",
      missionStatement: "Governing the City of Charlotte through transparent, accessible, and responsive public service.",
    },
    {
      slug: "charlotte-motor-speedway",
      name: "Charlotte Motor Speedway",
      presenceType: "commerce",
      websiteUrl: "https://www.charlottemotorspeedway.com",
      description: "Charlotte Motor Speedway is a 1.5-mile motorsport venue in Concord, NC, hosting NASCAR races, concerts, and major entertainment events year-round.",
      category: "entertainment-recreation",
    },
    {
      slug: "clt-airport",
      name: "Charlotte Douglas International Airport",
      presenceType: "organization",
      websiteUrl: "https://www.cltairport.com",
      description: "Charlotte Douglas International Airport (CLT) is a major US hub serving 50+ million passengers annually with nonstop flights to 175+ destinations.",
      missionStatement: "Connecting Charlotte to the world through safe, efficient, and customer-focused air travel services.",
    },
    {
      slug: "nws-charlotte",
      name: "National Weather Service — Charlotte",
      presenceType: "organization",
      websiteUrl: "https://www.weather.gov/gsp/",
      description: "The NWS Greenville-Spartanburg office provides weather forecasts, severe weather warnings, and radar data for the Charlotte metro and western Carolinas.",
      missionStatement: "Providing weather, water, and climate data, forecasts and warnings for the protection of life and property.",
    },
  ];

  let created = 0;
  let skipped = 0;

  for (const org of orgs) {
    const existing = await storage.getBusinessBySlug(cityId, org.slug);
    if (existing) {
      skipped++;
      continue;
    }

    await storage.createBusiness({
      cityId,
      zoneId,
      name: org.name,
      slug: org.slug,
      description: org.description,
      websiteUrl: org.websiteUrl,
      presenceType: org.presenceType,
      isNonprofit: org.isNonprofit ?? false,
      missionStatement: org.missionStatement ?? null,
      listingTier: "FREE",
      presenceStatus: "ACTIVE",
      categoryIds: [],
      tagIds: [],
    });
    created++;
  }

  if (created > 0 || skipped > 0) {
    console.log(`[SEED] Live feed orgs: created ${created}, skipped ${skipped} (already exist)`);
  }
}

async function seedStoryArticles(cityId: string) {

  const allZones = await db.select().from(zones).where(eq(zones.cityId, cityId));
  const zoneSlugToId = new Map(allZones.map(z => [z.slug, z.id]));

  const storyArticles: Array<{
    slug: string; title: string; excerpt: string; content: string;
    imageUrl: string; isFeatured: boolean; publishedAt: Date; zoneSlug: string;
  }> = [
    {
      slug: "relocating-to-charlotte",
      title: "Relocating to Charlotte: What You Need to Know Before You Move",
      excerpt: "Everything about relocating to Charlotte NC. Job market, neighborhoods, housing, schools, cost of living, and tips for a smooth move to the Queen City.",
      content: "Relocating to a new city is a major life decision, and Charlotte has become one of the most popular destinations for people making that move. Whether you're coming from the Northeast, West Coast, or another part of the Southeast, Charlotte offers a combination of career opportunities, community, and quality of life that continues to attract new residents.\n\nCharlotte has experienced significant population growth over the past decade, driven by a strong job market, lower cost of living compared to major metropolitan areas, and a lifestyle that balances urban convenience with outdoor recreation. The city is the second-largest banking center in the United States, and its economy has diversified into technology, healthcare, energy, and logistics.\n\nCharlotte's job market is anchored by financial services — Bank of America, Wells Fargo, and Truist all have major operations here. Beyond banking, the city has seen growth in technology, with companies like Microsoft, Honeywell, and numerous startups establishing presence. Healthcare is another major employer, with Atrium Health and Novant Health operating extensive hospital networks across the region.\n\nCharlotte is a city of neighborhoods, and choosing the right one can significantly impact your experience. Urban neighborhoods like South End, NoDa, and Plaza Midwood offer walkable living with dining and nightlife. Family-oriented areas like Ballantyne, Matthews, and Huntersville provide excellent schools and suburban amenities. Historic neighborhoods like Dilworth and Myers Park offer character and proximity to Uptown.\n\nThe median home price is around $390,000, significantly lower than coastal metropolitan areas. Rental prices vary by neighborhood, with one-bedroom apartments ranging from $1,100 in suburban areas to $2,200 in premium urban locations like South End.\n\nThe key to a successful relocation is exploration. Before committing to a neighborhood, spend time visiting different parts of the city. Attend local events, talk to residents, and use community platforms to connect with the people and businesses that make Charlotte unique.",
      imageUrl: "/images/seed/south-end.png",
      isFeatured: false,
      publishedAt: new Date(Date.now() - 3 * 86400000),
      zoneSlug: "south-end",
    },
    {
      slug: "cost-of-living-in-charlotte",
      title: "Cost of Living in Charlotte NC: A Complete Breakdown",
      excerpt: "Detailed cost of living in Charlotte NC. Housing, rent, groceries, transportation, utilities, taxes, and how Charlotte compares to other major U.S. cities.",
      content: "One of the biggest reasons people choose Charlotte is its cost of living. Compared to major metropolitan areas on the East and West Coasts, Charlotte offers significantly more affordable housing, lower taxes, and a reasonable cost for everyday expenses.\n\nHousing is typically the largest expense for Charlotte residents. The median home price is approximately $390,000, which is well below cities like New York ($700,000+), San Francisco ($1.3M+), or Washington D.C. ($600,000+). Historic areas like Dilworth and Myers Park command premium prices ($500,000-$1.5M), while suburban communities like Matthews, Huntersville, and Indian Trail offer family homes in the $300,000-$500,000 range.\n\nRental prices vary by location and building quality. Typical ranges for one-bedroom apartments include: South End ($1,400-$2,200), Uptown ($1,500-$2,300), NoDa ($1,200-$1,700), University City ($1,000-$1,400), and suburban areas ($1,000-$1,500).\n\nNorth Carolina has a flat state income tax rate of approximately 4.75%. Property taxes in Mecklenburg County average about 1.05% of assessed value. There is no state tax on Social Security benefits. Sales tax in Charlotte is 7.25%.\n\nCompared to states like New York, New Jersey, California, and Connecticut, North Carolina's tax burden is significantly lower, which is a major factor driving relocation to Charlotte.",
      imageUrl: "/images/seed/south-end.png",
      isFeatured: false,
      publishedAt: new Date(Date.now() - 7 * 86400000),
      zoneSlug: "dilworth",
    },
    {
      slug: "best-neighborhoods-in-charlotte",
      title: "Best Neighborhoods in Charlotte NC: Where to Live in the Queen City",
      excerpt: "Find the best neighborhoods in Charlotte NC. From urban South End to family-friendly Ballantyne, discover where to live based on your lifestyle and budget.",
      content: "Charlotte is a city of neighborhoods — each with its own character, advantages, and community. Whether you're a young professional looking for urban energy, a family seeking great schools and safe streets, or a retiree wanting a relaxed lakeside lifestyle, Charlotte has a neighborhood that fits.\n\nSouth End is Charlotte's most active urban neighborhood. Known for breweries, restaurants, the Rail Trail, and light rail access. Ideal for young professionals and anyone who values walkability. Rent for a one-bedroom averages $1,400-$2,200.\n\nNoDa (North Davidson) is Charlotte's arts district. Galleries, live music venues, creative businesses, and an eclectic restaurant scene. Best for creative professionals and those who appreciate independent culture.\n\nPlaza Midwood offers historic charm meets vibrant nightlife. Independent shops, diverse dining along Central Avenue, and some of Charlotte's most character-rich homes.\n\nDilworth is one of Charlotte's oldest neighborhoods. Tree-lined streets, Craftsman bungalows, Latta Park, and a walkable restaurant row on East Boulevard. Perfect for families and homebuyers who value character.\n\nBallantyne is a master-planned community in south Charlotte with corporate campuses, modern homes, golf, and family amenities. Popular with professionals and families relocating from out of state.\n\nThe best approach is to visit multiple neighborhoods, attend local events, and spend time understanding the rhythm of each area.",
      imageUrl: "/images/seed/noda-art.png",
      isFeatured: false,
      publishedAt: new Date(Date.now() - 14 * 86400000),
      zoneSlug: "plaza-midwood",
    },
    {
      slug: "living-in-charlotte-nc",
      title: "Living in Charlotte NC: What It's Really Like",
      excerpt: "What is it really like living in Charlotte NC? Lifestyle, food scene, outdoor recreation, community events, sports, and daily life in the Queen City.",
      content: "If you're considering a move to Charlotte, you probably want to know what daily life actually looks like. Beyond the statistics and rankings, Charlotte is a city with its own personality — a blend of Southern hospitality, urban ambition, and neighborhood-level community that creates a unique living experience.\n\nCharlotte is a city that works hard and plays well. Weekday mornings see professionals heading to Uptown's banking towers, South End's tech offices, and corporate campuses in Ballantyne. Evenings bring residents to neighborhood restaurants, brewery patios, and greenway trails. Weekends revolve around farmers markets, sports events, outdoor activities, and neighborhood-hopping for brunch.\n\nCharlotte's food scene has matured significantly. From James Beard-recognized restaurants to neighborhood taco trucks, the city offers diverse culinary experiences. The craft brewery scene is particularly strong, with over 50 breweries scattered across neighborhoods.\n\nCharlotte is a professional sports city — home to the Carolina Panthers (NFL), Charlotte Hornets (NBA), Charlotte FC (MLS), and the Charlotte Knights (minor league baseball).\n\nOne of Charlotte's biggest advantages is outdoor access. The U.S. National Whitewater Center offers kayaking, mountain biking, and zip-lining minutes from the city. Lake Norman and Lake Wylie provide boating and waterfront recreation. The Blue Ridge Mountains are a two-hour drive west, and beaches are about three and a half hours east.\n\nCharlotte is a city of transplants. A significant percentage of residents came from somewhere else, which creates an unusually welcoming atmosphere for newcomers. Living in Charlotte means having access to big-city opportunities with a manageable pace of life.",
      imageUrl: "/images/seed/food-truck.png",
      isFeatured: false,
      publishedAt: new Date(Date.now() - 21 * 86400000),
      zoneSlug: "uptown",
    },
    {
      slug: "charlotte-nc-neighborhood-guide",
      title: "Charlotte NC Neighborhood Guide: Find Your Perfect Community",
      excerpt: "Complete Charlotte NC neighborhood guide. Urban, suburban, historic, and lakefront areas explained with costs, lifestyle, and commute details for each.",
      content: "Charlotte's identity is built on its neighborhoods. Unlike cities where downtown dominates, Charlotte is a collection of distinct communities, each offering its own lifestyle, culture, and amenities.\n\nUrban core neighborhoods offer the most walkable, transit-connected living. Uptown is Charlotte's central business district with high-rises, sports venues, and museums. South End is the city's trendiest urban neighborhood with breweries, restaurants, and light rail access. NoDa is the arts district with galleries and live music. Plaza Midwood has eclectic charm with diverse dining and historic homes.\n\nHistoric residential neighborhoods offer character and proximity to Uptown. Dilworth is Charlotte's first streetcar suburb with Craftsman bungalows and Latta Park. Myers Park has grand estates, tree-lined boulevards, and top-rated schools.\n\nSouth Charlotte suburbs offer modern suburban living. Ballantyne is a master-planned community with corporate campuses. Steele Creek is rapidly growing with new developments.\n\nLake Norman communities north of Charlotte offer waterfront living. Huntersville is family-friendly with Birkdale Village and lake access. Cornelius is a lakefront community on Lake Norman's southern shore. Davidson is a college town with a walkable downtown.\n\nThe CLT Hub platform tracks 74+ neighborhood hubs, each with filtered local businesses, events, and community activity. Exploring these hubs is one of the best ways to understand what daily life looks like in each area before you visit or move.",
      imageUrl: "/images/seed/noda-art.png",
      isFeatured: false,
      publishedAt: new Date(Date.now() - 28 * 86400000),
      zoneSlug: "ballantyne",
    },
    {
      slug: "10-hidden-gems-south-end",
      title: "10 Hidden Gems in South End You Need to Visit This Season",
      excerpt: "Beyond the bustling breweries and well-known brunch spots, South End harbors a treasure trove of under-the-radar destinations that reward the curious explorer.",
      content: "South End has become one of Charlotte's most dynamic neighborhoods, but even locals who frequent the area regularly might be surprised by what's tucked away in its less-traveled corners. We spent a week tracking down the best-kept secrets along the Rail Trail corridor — and the results might surprise even lifelong Charlotteans.\n\nFrom a speakeasy tucked behind a barbershop on South Boulevard to a tiny gallery showcasing only Charlotte-born artists in a converted shipping container, these spots represent the creative underbelly of a neighborhood that's often reduced to its brewery scene. One standout is a family-run empanada shop that's been quietly serving the best pastries in the city for over a decade — no signage, no social media, just word of mouth and a line out the door every Saturday morning.\n\nWhat makes South End special isn't just the big-name developments and the Rail Trail — it's the people who've been here long before the cranes arrived. The neighborhood's hidden gems are a testament to the resilience and creativity of small business owners who've carved out their own corners of Charlotte's most rapidly changing zip code. Whether you're a weekend visitor or a daily commuter, take a detour from your usual route — you might just discover your new favorite spot.",
      imageUrl: "/images/seed/south-end.png",
      isFeatured: false,
      publishedAt: new Date(Date.now() - 35 * 86400000),
      zoneSlug: "south-end",
    },
    {
      slug: "noda-charlottes-creative-capital",
      title: "How NoDa Became Charlotte's Creative Capital",
      excerpt: "The North Davidson arts district's transformation from a forgotten mill village to one of the South's most vibrant cultural hubs is a story of grassroots creativity, community resilience, and a little bit of luck.",
      content: "In the early 1990s, North Davidson Street was a forgotten stretch of crumbling mill houses and empty storefronts. The textile industry that had sustained the neighborhood for decades was gone, and what remained was a quiet pocket of Charlotte that most residents drove past without a second glance. But a handful of artists saw something different — affordable space, good bones, and a community that was ready for reinvention.\n\nThe first wave of creatives moved into abandoned warehouses along 36th Street, converting loading docks into studios and break rooms into galleries. NoDa Brewing Company was among the early anchors, transforming a forgotten industrial space into what would become one of Charlotte's most beloved taprooms. Meanwhile, the Charlotte Arts Foundation began running grant programs specifically targeting NoDa-based artists, funding everything from public murals to experimental theater productions in parking lots.\n\nToday, NoDa is home to more than 50 working artist studios, a dozen galleries, multiple live music venues, and a thriving maker economy. The monthly First Friday Art Walk draws thousands of visitors, and the neighborhood has become a model for how grassroots creative placemaking can transform a community without erasing its character. The key, longtime residents say, was that artists didn't just move in — they invested in the neighborhood, supported each other, and built institutions that could weather the inevitable pressures of gentrification.",
      imageUrl: "/images/seed/noda-art.png",
      isFeatured: false,
      publishedAt: new Date(Date.now() - 42 * 86400000),
      zoneSlug: "noda",
    },
    {
      slug: "myers-park-historic-charm",
      title: "Myers Park: Where Historic Charm Meets Modern Living",
      excerpt: "Myers Park remains one of Charlotte's most sought-after neighborhoods, blending grand tree-lined boulevards with vibrant community life and top-rated schools.",
      content: "Myers Park is one of Charlotte's most prestigious residential neighborhoods, known for its grand estates, mature tree canopy, and proximity to Uptown. Developed in the early 1900s, the neighborhood was designed by landscape architect John Nolen and features wide, curving boulevards lined with towering oaks and historic homes ranging from Tudor Revival to Colonial.\n\nThe neighborhood is home to some of Charlotte's best schools, including Myers Park High School, and is anchored by institutions like the Mint Museum and Freedom Park. Queens University adds a college-town atmosphere to the area. Dining options along Providence Road and Selwyn Avenue range from upscale restaurants to neighborhood cafes.\n\nHome prices in Myers Park are among the highest in the city, typically ranging from $600,000 for smaller bungalows to well over $2 million for estate homes. Despite the premium, demand remains strong due to the combination of walkability, schools, and character that few other Charlotte neighborhoods can match.",
      imageUrl: "/images/seed/south-end.png",
      isFeatured: false,
      publishedAt: new Date(Date.now() - 5 * 86400000),
      zoneSlug: "myers-park",
    },
    {
      slug: "southpark-shopping-dining-guide",
      title: "SouthPark: Charlotte's Premier Shopping & Dining Destination",
      excerpt: "From SouthPark Mall to boutique restaurants, SouthPark has evolved from a suburban shopping center into a vibrant mixed-use neighborhood with something for everyone.",
      content: "SouthPark has long been known as Charlotte's premier shopping destination, anchored by SouthPark Mall — the largest mall in the Carolinas. But in recent years, the neighborhood has evolved into much more than a retail hub. Mixed-use developments, upscale dining, and luxury residential towers have transformed SouthPark into a self-contained urban village.\n\nThe dining scene in SouthPark rivals Uptown and South End, with restaurants ranging from fine dining at Dressler's to casual favorites like Cowfish and Superica. The neighborhood's proximity to Ballantyne and Myers Park makes it a central hub for south Charlotte residents.\n\nResidential options include luxury condos at The Meridian, townhomes along Fairview Road, and established single-family neighborhoods nearby. With excellent schools, low crime, and easy access to I-485, SouthPark is particularly popular with families and professionals who want suburban convenience without sacrificing urban amenities.",
      imageUrl: "/images/seed/food-truck.png",
      isFeatured: false,
      publishedAt: new Date(Date.now() - 10 * 86400000),
      zoneSlug: "southpark",
    },
    {
      slug: "elizabeth-neighborhood-guide",
      title: "Elizabeth: Charlotte's Walkable Urban Village",
      excerpt: "Tucked between Uptown and Plaza Midwood, Elizabeth offers a rare combination of walkability, healthcare access, and neighborhood character in the heart of Charlotte.",
      content: "Elizabeth is one of Charlotte's most walkable neighborhoods, sitting just east of Uptown between Independence Boulevard and Randolph Road. The neighborhood is anchored by Novant Health Presbyterian Medical Center, which makes it a hub for healthcare professionals, but Elizabeth's appeal extends far beyond the hospital.\n\nThe Elizabeth neighborhood features a charming mix of historic bungalows, mid-century ranches, and newer infill construction. Elizabeth Avenue and Hawthorne Lane are lined with local restaurants, coffee shops, and boutiques. Independence Park, one of Charlotte's oldest parks, provides green space and walking trails.\n\nWith median home prices around $400,000-$600,000, Elizabeth offers relatively affordable urban living compared to adjacent neighborhoods like Myers Park and Dilworth. Its central location means residents are within walking or biking distance of Uptown, NoDa, and Plaza Midwood.",
      imageUrl: "/images/seed/noda-art.png",
      isFeatured: false,
      publishedAt: new Date(Date.now() - 12 * 86400000),
      zoneSlug: "elizabeth",
    },
    {
      slug: "steele-creek-growth-story",
      title: "Steele Creek: Charlotte's Fastest-Growing Neighborhood",
      excerpt: "Once a quiet corner of south Charlotte, Steele Creek has exploded with new homes, retail, and restaurants — becoming one of the city's most dynamic growth areas.",
      content: "Steele Creek has undergone a remarkable transformation over the past decade. What was once a largely rural area of south Charlotte is now one of the city's fastest-growing neighborhoods, driven by major retail development at Rivergate and a steady stream of new residential construction.\n\nThe opening of the TopGolf complex, a relocated Carowinds entrance area, and numerous chain and local restaurants along Steele Creek Road have given the neighborhood a commercial identity. New subdivisions and apartment complexes continue to fill in the gaps, attracting young families and professionals who want modern homes at more affordable prices than inner-city neighborhoods.\n\nSteele Creek's proximity to the South Carolina border and I-77 provides easy access to Lake Wylie and Fort Mill. The neighborhood is also home to the Anne Springs Close Greenway, a 2,100-acre nature preserve offering hiking, biking, horseback riding, and canoeing just minutes from suburban development.",
      imageUrl: "/images/seed/south-end.png",
      isFeatured: false,
      publishedAt: new Date(Date.now() - 16 * 86400000),
      zoneSlug: "steele-creek",
    },
    {
      slug: "huntersville-family-living",
      title: "Huntersville: Family-Friendly Living on Lake Norman's Doorstep",
      excerpt: "Top-rated schools, Birkdale Village, and easy lake access make Huntersville one of the Charlotte metro's most popular suburbs for families and outdoor enthusiasts.",
      content: "Huntersville sits along I-77 north of Charlotte, offering a suburban lifestyle with easy access to both Uptown Charlotte and Lake Norman. The town has grown significantly over the past two decades, but has managed to maintain a family-friendly atmosphere with excellent schools, well-planned neighborhoods, and community amenities.\n\nBirkdale Village is Huntersville's social hub — a walkable mixed-use development with shops, restaurants, a movie theater, and a man-made lake. The town also offers Latta Plantation Nature Preserve, Rural Hill, and the Carolina Raptor Center for outdoor recreation and family activities.\n\nHuntersville's housing market offers a range of options, from starter homes in the $300,000 range to lakefront properties exceeding $1 million. The Cabarrus-Rowan Utilities system provides water, and the area is served by Charlotte-Mecklenburg Schools with several top-performing elementary and middle schools.",
      imageUrl: "/images/seed/food-truck.png",
      isFeatured: false,
      publishedAt: new Date(Date.now() - 18 * 86400000),
      zoneSlug: "huntersville",
    },
    {
      slug: "dilworth-east-boulevard-dining",
      title: "A Food Lover's Guide to Dilworth's East Boulevard",
      excerpt: "East Boulevard in Dilworth has quietly become one of Charlotte's best dining corridors, with everything from farm-to-table fare to neighborhood pizza joints.",
      content: "Dilworth's East Boulevard has evolved into one of Charlotte's most walkable dining streets. From the intersection at Scott Avenue down to South Boulevard, the corridor is lined with restaurants that span cuisines, price points, and vibes.\n\nLong-standing favorites like Latta Arcade staples share the street with newer concepts bringing global flavors to the neighborhood. The walkability factor sets East Boulevard apart from Charlotte's car-dependent restaurant clusters — residents can easily hit two or three spots in an evening without moving their car.\n\nThe restaurant scene reflects Dilworth's residential character: upscale enough to attract foodies from across the city, but relaxed enough that families with strollers feel welcome. Weekend brunch is a Dilworth tradition, with lines forming early at the most popular spots. The neighborhood's tree-lined streets and proximity to Latta Park make a post-dinner walk an easy extension of any meal.",
      imageUrl: "/images/seed/food-truck.png",
      isFeatured: false,
      publishedAt: new Date(Date.now() - 24 * 86400000),
      zoneSlug: "dilworth",
    },
    {
      slug: "plaza-midwood-central-avenue-scene",
      title: "Central Avenue: The Beating Heart of Plaza Midwood",
      excerpt: "Central Avenue is where Plaza Midwood's independent spirit comes alive — a stretch of diverse restaurants, vintage shops, and community gathering spots unlike anywhere else in Charlotte.",
      content: "Central Avenue through Plaza Midwood is arguably Charlotte's most eclectic commercial corridor. The stretch from The Plaza to Eastway Drive packs in an astonishing variety of dining, shopping, and nightlife options that reflect the neighborhood's diverse, independent-minded character.\n\nThe avenue is home to Charlotte's best international food scene, with Vietnamese pho shops, Mexican taquerias, Ethiopian restaurants, and Greek diners sitting alongside craft cocktail bars and farm-to-table restaurants. Vintage and thrift stores dot the corridor, and murals by local artists add color to nearly every block.\n\nPlaza Midwood's Central Avenue corridor has become a model for what urban Charlotte can look like when independent businesses thrive. The neighborhood's character comes from its mix — long-time residents and newcomers, dive bars and wine bars, tacos and tasting menus. It's this diversity that makes Plaza Midwood one of Charlotte's most authentic and resilient neighborhoods.",
      imageUrl: "/images/seed/noda-art.png",
      isFeatured: false,
      publishedAt: new Date(Date.now() - 30 * 86400000),
      zoneSlug: "plaza-midwood",
    },
    {
      slug: "uptown-charlotte-weekend-guide",
      title: "A Weekend in Uptown Charlotte: Museums, Sports & Nightlife",
      excerpt: "From the Mint Museum to Spectrum Center, Uptown Charlotte packs world-class entertainment, dining, and culture into a walkable urban core.",
      content: "Uptown Charlotte is the city's central business district, but on weekends it transforms into an entertainment and cultural destination. The area is anchored by major venues — Spectrum Center (Charlotte Hornets), Bank of America Stadium (Carolina Panthers), and the Belk Theater at Blumenthal Performing Arts Center.\n\nMuseum lovers can explore the Mint Museum Uptown, the Bechtler Museum of Modern Art, the Harvey B. Gantt Center for African-American Arts + Culture, and Discovery Place Science — all within walking distance of each other. Romare Bearden Park provides green space with a skyline backdrop, while The Green is Charlotte's urban park hosting food trucks and seasonal events.\n\nUptown's nightlife centers on EpiCentre and the surrounding blocks, with rooftop bars, live music venues, and late-night restaurants. The LYNX Blue Line light rail connects Uptown to South End and UNC Charlotte, making it easy to explore multiple neighborhoods in a single evening.",
      imageUrl: "/images/seed/south-end.png",
      isFeatured: false,
      publishedAt: new Date(Date.now() - 33 * 86400000),
      zoneSlug: "uptown",
    },
    {
      slug: "ballantyne-corporate-community",
      title: "Ballantyne: Where Corporate Charlotte Meets Community Living",
      excerpt: "Ballantyne has grown from a golf course development into one of Charlotte's most complete suburban communities, with corporate campuses, top schools, and resort-style amenities.",
      content: "Ballantyne started as a master-planned community centered around the Ballantyne Hotel and Golf Club, but has evolved into one of south Charlotte's most vibrant suburban hubs. The Ballantyne Corporate Park is home to major employers including MetLife, SPX, and numerous financial services firms, making it a true live-work community.\n\nBallantyne Village provides walkable shopping and dining, while Ballantyne Commons Parkway is lined with national retailers and local restaurants. The community features miles of greenway trails, community pools, and recreation centers. Schools in the Ballantyne area are consistently among the top-rated in Charlotte-Mecklenburg Schools.\n\nResidential options range from townhomes in the $350,000 range to estate homes exceeding $1.5 million. The area is especially popular with families relocating from out of state who want a turnkey suburban lifestyle with modern amenities, good schools, and a short commute to south Charlotte corporate offices.",
      imageUrl: "/images/seed/south-end.png",
      isFeatured: false,
      publishedAt: new Date(Date.now() - 38 * 86400000),
      zoneSlug: "ballantyne",
    },
  ];

  let created = 0;
  let skipped = 0;

  const existingArticles = await db.select({ slug: articles.slug, id: articles.id, zoneId: articles.zoneId }).from(articles).where(eq(articles.cityId, cityId));
  const existingBySlug = new Map(existingArticles.map(a => [a.slug, a]));

  let updated = 0;

  for (const story of storyArticles) {
    const zoneId = zoneSlugToId.get(story.zoneSlug) || null;
    const existingArticle = existingBySlug.get(story.slug);

    if (existingArticle) {
      if (!existingArticle.zoneId && zoneId) {
        await storage.updateArticle(existingArticle.id, { zoneId, isFeatured: false });
        updated++;
      }
      skipped++;
      continue;
    }

    await storage.createArticle({
      cityId,
      title: story.title,
      slug: story.slug,
      excerpt: story.excerpt,
      content: story.content,
      imageUrl: story.imageUrl,
      isFeatured: story.isFeatured,
      publishedAt: story.publishedAt,
      isEvergreen: true,
      mentionedBusinessIds: [],
      zoneId,
    });
    created++;
  }

  if (created > 0 || skipped > 0 || updated > 0) {
    console.log(`[SEED] Story articles: created ${created}, updated ${updated}, skipped ${skipped} (already exist)`);
  }
}

export async function fixMiscategorizedBeautyBusinesses() {
  const BARBER_SALON_PATTERNS = /\b(barber|barbershop|salon|hair\s*(cut|styl|care)|taper|fade[ds]?|braids?|locs?|wigs?|beauty\s*supply|nail\s*tech|lash|brow)\b/i;

  const allCats = await db.select().from(categories);
  const healthCat = allCats.find(c => c.slug === "health-wellness-cat");
  const beautyCat = allCats.find(c => c.slug === "beauty-personal-care");
  if (!healthCat || !beautyCat) return;

  const miscategorized = await db
    .select({ id: businesses.id, name: businesses.name, categoryIds: businesses.categoryIds })
    .from(businesses)
    .where(sql`${businesses.categoryIds} @> ARRAY[${healthCat.id}]::text[]`);

  let fixed = 0;
  for (const biz of miscategorized) {
    if (!BARBER_SALON_PATTERNS.test(biz.name)) continue;

    const newCategoryIds = biz.categoryIds
      .filter((id: string) => id !== healthCat.id)
      .concat(beautyCat.id);

    const uniqueIds = [...new Set(newCategoryIds)];
    await db.update(businesses)
      .set({ categoryIds: uniqueIds })
      .where(eq(businesses.id, biz.id));
    fixed++;
    console.log(`[CategoryFix] Recategorized "${biz.name}" from Health & Wellness → Beauty & Personal Care`);
  }

  if (fixed > 0) {
    console.log(`[CategoryFix] Fixed ${fixed} miscategorized beauty/barber businesses`);
  }
}

async function seedDefaultInterviewQuestions() {
  const existing = await db.select().from(interviewQuestionTemplates).limit(1);
  if (existing.length > 0) {
    console.log("[SEED] Interview questions already seeded, skipping");
    return;
  }

  const defaultQuestions = [
    { questionText: "Tell me the origin story of your business — how did it all start?", displayOrder: 0, fieldMapping: "originStory", isCustom: false, isDefault: true },
    { questionText: "What makes your business special or different from others in the area?", displayOrder: 1, fieldMapping: "whatSpecial", isCustom: false, isDefault: true },
    { questionText: "What do you love most about being in Charlotte / this neighborhood?", displayOrder: 2, fieldMapping: "neighborhoodLove", isCustom: false, isDefault: true },
    { questionText: "What's something people might not know about your business — a hidden detail or behind-the-scenes fact?", displayOrder: 3, fieldMapping: null, isCustom: false, isDefault: true },
    { questionText: "What's happening right now at your business? Any new offerings, events, or exciting changes?", displayOrder: 4, fieldMapping: null, isCustom: false, isDefault: true },
    { questionText: "If you could say one thing to the Charlotte community, what would it be?", displayOrder: 5, fieldMapping: null, isCustom: false, isDefault: true },
    { questionText: "What's your favorite moment or memory from running this business?", displayOrder: 6, fieldMapping: null, isCustom: false, isDefault: true },
    { questionText: "What are your hours of operation?", displayOrder: 7, fieldMapping: "hours", isCustom: false, isDefault: true },
    { questionText: "What services or products do you offer?", displayOrder: 8, fieldMapping: "services", isCustom: false, isDefault: true },
  ];

  for (const q of defaultQuestions) {
    await storage.createInterviewQuestion(q);
  }
  console.log(`[SEED] Created ${defaultQuestions.length} default interview questions`);
}
