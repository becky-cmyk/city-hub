import { db } from "../../db";
import {
  businesses,
  categories,
  sourceRawRows,
  entityContactVerification,
  entityLocationProfile,
  entityAssetTags,
} from "@shared/schema";
import { eq, sql } from "drizzle-orm";

type IndustryTag =
  | "MANUFACTURING" | "FABRICATION" | "INDUSTRIAL_SUPPLY" | "WHOLESALE_DISTRIBUTION"
  | "WAREHOUSE_LOGISTICS" | "CONSTRUCTION_CONTRACTOR" | "ROOFING_CONTRACTOR"
  | "HVAC_CONTRACTOR" | "PLUMBING_CONTRACTOR" | "ELECTRICAL_CONTRACTOR"
  | "GENERAL_CONTRACTOR" | "COMMERCIAL_BUILDOUT_SIGNAL" | "INDUSTRIAL_CORRIDOR_LOCATION"
  | "FOOD_SERVICE" | "RETAIL_STOREFRONT" | "PROFESSIONAL_SERVICES"
  | "HEALTHCARE_MEDICAL" | "AUTOMOTIVE_SERVICE" | "BEAUTY_PERSONAL_CARE"
  | "RELIGIOUS_NONPROFIT"
  | "DENOMINATION_BAPTIST" | "DENOMINATION_CATHOLIC" | "DENOMINATION_METHODIST"
  | "DENOMINATION_PRESBYTERIAN" | "DENOMINATION_NON_DENOMINATIONAL" | "DENOMINATION_PENTECOSTAL"
  | "DENOMINATION_LUTHERAN" | "DENOMINATION_EPISCOPAL" | "DENOMINATION_AME"
  | "DENOMINATION_CHURCH_OF_GOD" | "DENOMINATION_ADVENTIST"
  | "DENOMINATION_ISLAMIC" | "DENOMINATION_HINDU" | "DENOMINATION_JEWISH"
  | "DENOMINATION_BUDDHIST" | "DENOMINATION_SIKH";

interface TagSignal {
  tag: IndustryTag;
  confidence: number;
  source: string;
  reason: string;
}

const FOOD_AMENITIES = new Set([
  "restaurant", "cafe", "bar", "pub", "fast_food", "food_court",
  "ice_cream", "biergarten", "bakery",
]);

const HEALTH_AMENITIES = new Set([
  "dentist", "doctors", "hospital", "clinic", "veterinary", "pharmacy",
]);

const AUTO_AMENITIES = new Set([
  "car_repair", "car_wash", "fuel",
]);

const BEAUTY_SHOPS = new Set([
  "hairdresser", "beauty", "cosmetics", "tattoo", "massage",
]);

const NAME_RULES: Array<{ patterns: RegExp[]; tag: IndustryTag; confidence: number }> = [
  { patterns: [/\bmanufactur/i, /\bfabricat/i, /\bmachine\s*shop/i, /\btool\s*(&|and)\s*die/i, /\bcnc\b/i, /\bmetal\s*work/i, /\bfoundry/i, /\bplastics?\b/i, /\binjection\s*mold/i], tag: "MANUFACTURING", confidence: 70 },
  { patterns: [/\bweld/i, /\bsteel\s*fab/i, /\bsheet\s*metal/i], tag: "FABRICATION", confidence: 70 },
  { patterns: [/\broofing/i, /\broof\b/i], tag: "ROOFING_CONTRACTOR", confidence: 75 },
  { patterns: [/\bhvac\b/i, /\bheating\b.*\b(cool|air)/i, /\bair\s*condition/i, /\bmechanical\s*(contractor|service)/i], tag: "HVAC_CONTRACTOR", confidence: 75 },
  { patterns: [/\bplumb(ing|er)\b/i], tag: "PLUMBING_CONTRACTOR", confidence: 75 },
  { patterns: [/\belectric(al)?\s*(contractor|service|company)/i, /\belectrician/i], tag: "ELECTRICAL_CONTRACTOR", confidence: 75 },
  { patterns: [/\bgeneral\s*contract/i, /\bbuilders?\b/i, /\bconstruction\s*(co|company|inc|llc|group|service)/i], tag: "GENERAL_CONTRACTOR", confidence: 70 },
  { patterns: [/\bconstruct(ion|ing)\b/i, /\bcontract(or|ing)\b/i, /\bremodel/i, /\brenovation/i], tag: "CONSTRUCTION_CONTRACTOR", confidence: 65 },
  { patterns: [/\bwholesale/i, /\bdistribut(or|ion)\b/i], tag: "WHOLESALE_DISTRIBUTION", confidence: 70 },
  { patterns: [/\bwarehouse/i, /\blogistics/i, /\bfreight/i, /\bshipping\b/i, /\bsupply\s*chain/i], tag: "WAREHOUSE_LOGISTICS", confidence: 65 },
  { patterns: [/\bindustrial\s*supply/i, /\btool\s*supply/i, /\bfastener/i, /\bbearing/i], tag: "INDUSTRIAL_SUPPLY", confidence: 65 },
  { patterns: [/\bbaptist\b/i], tag: "DENOMINATION_BAPTIST", confidence: 85 },
  { patterns: [/\bcatholic\b/i, /\bparish\b/i], tag: "DENOMINATION_CATHOLIC", confidence: 85 },
  { patterns: [/\bmethodist\b/i, /\bumc\b/i], tag: "DENOMINATION_METHODIST", confidence: 85 },
  { patterns: [/\bpresbyterian\b/i, /\bpcusa\b/i, /\bpca\b/i], tag: "DENOMINATION_PRESBYTERIAN", confidence: 85 },
  { patterns: [/\bnon[\s-]*denominational/i, /\bcommunity\s+church\b/i, /\blife\s+church\b/i], tag: "DENOMINATION_NON_DENOMINATIONAL", confidence: 75 },
  { patterns: [/\bpentecostal\b/i, /\bassembl(y|ies)\s+of\s+god/i, /\bcogic\b/i], tag: "DENOMINATION_PENTECOSTAL", confidence: 85 },
  { patterns: [/\blutheran\b/i, /\belca\b/i], tag: "DENOMINATION_LUTHERAN", confidence: 85 },
  { patterns: [/\bepiscopal\b/i, /\banglican\b/i], tag: "DENOMINATION_EPISCOPAL", confidence: 85 },
  { patterns: [/\bame\b/i, /\bafrican\s+methodist/i], tag: "DENOMINATION_AME", confidence: 85 },
  { patterns: [/\bchurch\s+of\s+god\b/i], tag: "DENOMINATION_CHURCH_OF_GOD", confidence: 85 },
  { patterns: [/\bseventh[\s-]*day\s+adventist/i, /\badventist\b/i, /\bsda\b/i], tag: "DENOMINATION_ADVENTIST", confidence: 85 },
  { patterns: [/\bmosque\b/i, /\bmasjid\b/i, /\bislamic\b/i, /\bmuslim\b/i], tag: "DENOMINATION_ISLAMIC", confidence: 85 },
  { patterns: [/\bhindu\b/i, /\bmandir\b/i], tag: "DENOMINATION_HINDU", confidence: 85 },
  { patterns: [/\bsynagogue\b/i, /\bjewish\b/i, /\btemple\s+beth\b/i, /\bcongregation\b.*\bjewish/i, /\bchabad\b/i], tag: "DENOMINATION_JEWISH", confidence: 85 },
  { patterns: [/\bbuddhist\b/i, /\bzen\s+(center|temple|monastery)/i, /\bvihara\b/i], tag: "DENOMINATION_BUDDHIST", confidence: 85 },
  { patterns: [/\bsikh\b/i, /\bgurdwara\b/i, /\bgurudwara\b/i], tag: "DENOMINATION_SIKH", confidence: 85 },
  { patterns: [/\bchurch\b/i, /\bfellowship\b/i, /\bministry/i, /\btemple\b/i, /\bchapel\b/i], tag: "RELIGIOUS_NONPROFIT", confidence: 75 },
  { patterns: [/\bfoundation\b/i, /\bnon\s*profit/i, /\bnonprofit/i, /\bcommunity\s*trust/i, /\bsociety\b/i], tag: "RELIGIOUS_NONPROFIT", confidence: 65 },
  { patterns: [/\brestaurant\b/i, /\bcafe\b/i, /\bbakery\b/i, /\bbar\b.*\bgrill\b/i, /\bbrew(ing|ery)\b/i, /\bpizza\b/i, /\btacos?\b/i, /\bcoffee\b/i, /\bcatering\b/i, /\broasters?\b/i], tag: "FOOD_SERVICE", confidence: 70 },
  { patterns: [/\bsalon\b/i, /\bspa\b/i, /\bbarbershop\b/i, /\bbarber\b/i, /\bnail\b/i, /\bbeauty\b/i, /\btaper/i, /\bfade[ds]?\b/i, /\bhair\s*(cut|styl)/i, /\bbraids?\b/i, /\blocs?\b/i, /\bwigs?\b/i], tag: "BEAUTY_PERSONAL_CARE", confidence: 70 },
  { patterns: [/\bauto\s*(repair|body|service)/i, /\btire\b/i, /\bmechanic\b/i, /\bcollision\b/i], tag: "AUTOMOTIVE_SERVICE", confidence: 70 },
  { patterns: [/\blaw\s*(firm|office|group)/i, /\battorney/i, /\baccounting\b/i, /\bcpa\b/i, /\bconsult(ing|ant)/i, /\binsurance\b/i, /\bfinancial\b/i, /\breal\s*estate/i], tag: "PROFESSIONAL_SERVICES", confidence: 65 },
  { patterns: [/\bclinic\b/i, /\bdental\b/i, /\bdentist/i, /\bortho/i, /\bpediatric/i, /\bmedical\b/i, /\bpharmacy\b/i, /\bveterinar/i, /\bchiropractic/i, /\brehab/i], tag: "HEALTHCARE_MEDICAL", confidence: 70 },
  { patterns: [/\bpet\b/i, /\bschool\b/i, /\beducation/i, /\blearning\b/i, /\bacademy\b/i, /\binstitute\b/i, /\bresearch\b/i], tag: "PROFESSIONAL_SERVICES", confidence: 55 },
];

const SCHEMAORG_TYPE_MAP: Record<string, IndustryTag> = {
  "GeneralContractor": "GENERAL_CONTRACTOR",
  "RoofingContractor": "ROOFING_CONTRACTOR",
  "Plumber": "PLUMBING_CONTRACTOR",
  "Electrician": "ELECTRICAL_CONTRACTOR",
  "HVACBusiness": "HVAC_CONTRACTOR",
  "AutoRepair": "AUTOMOTIVE_SERVICE",
  "AutoDealer": "AUTOMOTIVE_SERVICE",
  "Restaurant": "FOOD_SERVICE",
  "FoodEstablishment": "FOOD_SERVICE",
  "BarOrPub": "FOOD_SERVICE",
  "CafeOrCoffeeShop": "FOOD_SERVICE",
  "Bakery": "FOOD_SERVICE",
  "MedicalBusiness": "HEALTHCARE_MEDICAL",
  "Dentist": "HEALTHCARE_MEDICAL",
  "Physician": "HEALTHCARE_MEDICAL",
  "Hospital": "HEALTHCARE_MEDICAL",
  "Pharmacy": "HEALTHCARE_MEDICAL",
  "VeterinaryCare": "HEALTHCARE_MEDICAL",
  "BeautySalon": "BEAUTY_PERSONAL_CARE",
  "HairSalon": "BEAUTY_PERSONAL_CARE",
  "DaySpa": "BEAUTY_PERSONAL_CARE",
  "PlaceOfWorship": "RELIGIOUS_NONPROFIT",
  "Church": "RELIGIOUS_NONPROFIT",
};

function tagFromOsmTags(tags: Record<string, any>): TagSignal[] {
  const signals: TagSignal[] = [];

  if (tags["industrial"] || tags["landuse"] === "industrial") {
    signals.push({ tag: "INDUSTRIAL_CORRIDOR_LOCATION", confidence: 85, source: "osm_tag", reason: `landuse/industrial tag: ${tags["industrial"] || tags["landuse"]}` });
  }

  if (tags["man_made"] === "works" || (tags["craft"] && /metal|weld|machin|carpenter|sawmill/i.test(tags["craft"]))) {
    signals.push({ tag: "FABRICATION", confidence: 75, source: "osm_tag", reason: `craft/man_made: ${tags["craft"] || tags["man_made"]}` });
  }

  const office = tags["office"];
  if (office === "logistics" || office === "warehouse") {
    signals.push({ tag: "WAREHOUSE_LOGISTICS", confidence: 70, source: "osm_tag", reason: `office=${office}` });
  } else if (office === "industrial") {
    signals.push({ tag: "INDUSTRIAL_SUPPLY", confidence: 70, source: "osm_tag", reason: `office=industrial` });
  }

  const shop = tags["shop"];
  if (shop === "trade" || shop === "hardware" || shop === "electrical" || shop === "doityourself") {
    signals.push({ tag: "INDUSTRIAL_SUPPLY", confidence: 65, source: "osm_tag", reason: `shop=${shop}` });
  }

  const amenity = tags["amenity"];
  if (amenity && FOOD_AMENITIES.has(amenity)) {
    signals.push({ tag: "FOOD_SERVICE", confidence: 80, source: "osm_tag", reason: `amenity=${amenity}` });
  }
  if (amenity && HEALTH_AMENITIES.has(amenity)) {
    signals.push({ tag: "HEALTHCARE_MEDICAL", confidence: 80, source: "osm_tag", reason: `amenity=${amenity}` });
  }
  if (amenity && AUTO_AMENITIES.has(amenity)) {
    signals.push({ tag: "AUTOMOTIVE_SERVICE", confidence: 75, source: "osm_tag", reason: `amenity=${amenity}` });
  }
  if (amenity === "place_of_worship") {
    signals.push({ tag: "RELIGIOUS_NONPROFIT", confidence: 80, source: "osm_tag", reason: `amenity=place_of_worship` });
  }

  if (shop && BEAUTY_SHOPS.has(shop)) {
    signals.push({ tag: "BEAUTY_PERSONAL_CARE", confidence: 75, source: "osm_tag", reason: `shop=${shop}` });
  }

  if (shop && !BEAUTY_SHOPS.has(shop) && shop !== "trade" && shop !== "hardware" && shop !== "electrical" && shop !== "doityourself") {
    signals.push({ tag: "RETAIL_STOREFRONT", confidence: 75, source: "osm_tag", reason: `shop=${shop}` });
  }

  if (office && !["logistics", "warehouse", "industrial"].includes(office)) {
    signals.push({ tag: "PROFESSIONAL_SERVICES", confidence: 70, source: "osm_tag", reason: `office=${office}` });
  }

  if (tags["craft"] && !/metal|weld|machin|carpenter|sawmill/i.test(tags["craft"])) {
    signals.push({ tag: "RETAIL_STOREFRONT", confidence: 65, source: "osm_tag", reason: `craft=${tags["craft"]}` });
  }

  if (tags["tourism"]) {
    signals.push({ tag: "RETAIL_STOREFRONT", confidence: 65, source: "osm_tag", reason: `tourism=${tags["tourism"]}` });
  }

  return signals;
}

function tagFromName(name: string): TagSignal[] {
  const signals: TagSignal[] = [];
  for (const rule of NAME_RULES) {
    for (const pattern of rule.patterns) {
      if (pattern.test(name)) {
        signals.push({ tag: rule.tag, confidence: rule.confidence, source: "name_keyword", reason: `Name "${name}" matches ${pattern.source}` });
        break;
      }
    }
  }
  return signals;
}

function tagFromSchemaOrg(schemaOrgJson: any): TagSignal[] {
  if (!schemaOrgJson) return [];
  const signals: TagSignal[] = [];

  const types: string[] = [];
  if (typeof schemaOrgJson === "object") {
    const typeVal = schemaOrgJson["@type"];
    if (Array.isArray(typeVal)) types.push(...typeVal);
    else if (typeof typeVal === "string") types.push(typeVal);
  }

  for (const t of types) {
    const mapped = SCHEMAORG_TYPE_MAP[t];
    if (mapped) {
      signals.push({ tag: mapped, confidence: 20, source: "schema_org", reason: `Schema.org @type: ${t}` });
    }
  }

  return signals;
}

function consolidateSignals(signals: TagSignal[]): Map<IndustryTag, { confidence: number; evidence: any[] }> {
  const tagMap = new Map<IndustryTag, { confidence: number; evidence: any[] }>();

  for (const sig of signals) {
    const existing = tagMap.get(sig.tag);
    if (existing) {
      existing.confidence = Math.min(100, existing.confidence + sig.confidence > 100 ? 100 : Math.max(existing.confidence, sig.confidence) + 10);
      existing.evidence.push({ source: sig.source, reason: sig.reason, rawConfidence: sig.confidence });
    } else {
      tagMap.set(sig.tag, {
        confidence: sig.confidence,
        evidence: [{ source: sig.source, reason: sig.reason, rawConfidence: sig.confidence }],
      });
    }
  }

  return tagMap;
}

export async function tagEntityIndustry(entityId: string): Promise<number> {
  const [biz] = await db
    .select()
    .from(businesses)
    .where(eq(businesses.id, entityId))
    .limit(1);

  if (!biz) return 0;

  const signals: TagSignal[] = [];

  if (biz.seedSourceExternalId) {
    const rawRows = await db
      .select({ payloadJson: sourceRawRows.payloadJson })
      .from(sourceRawRows)
      .where(eq(sourceRawRows.externalId, biz.seedSourceExternalId))
      .limit(1);

    if (rawRows.length > 0 && rawRows[0].payloadJson) {
      const payload = rawRows[0].payloadJson as Record<string, any>;
      const osmTags = payload._osmTags || payload;
      signals.push(...tagFromOsmTags(osmTags));
    }
  }

  if (biz.name) {
    signals.push(...tagFromName(biz.name));
  }

  const [verification] = await db
    .select()
    .from(entityContactVerification)
    .where(eq(entityContactVerification.entityId, entityId))
    .limit(1);

  if (verification?.schemaOrgJson) {
    signals.push(...tagFromSchemaOrg(verification.schemaOrgJson));
  }

  const [locProfile] = await db
    .select()
    .from(entityLocationProfile)
    .where(eq(entityLocationProfile.entityId, entityId))
    .limit(1);

  if (locProfile?.landUseClass === "INDUSTRIAL") {
    signals.push({ tag: "INDUSTRIAL_CORRIDOR_LOCATION", confidence: 20, source: "land_use", reason: "Land use class: INDUSTRIAL" });
  }

  if (signals.length === 0) return 0;

  const consolidated = consolidateSignals(signals);
  const minConfidence = parseInt(process.env.ECON_TAG_MIN_CONFIDENCE || "50", 10);
  let tagsWritten = 0;

  for (const [tag, data] of consolidated) {
    if (data.confidence < minConfidence) continue;

    const existing = await db
      .select({ id: entityAssetTags.id })
      .from(entityAssetTags)
      .where(sql`entity_id = ${entityId} AND tag = ${tag}`)
      .limit(1);

    if (existing.length > 0) {
      await db.update(entityAssetTags)
        .set({
          confidence: data.confidence,
          evidenceJson: data.evidence,
          updatedAt: new Date(),
        })
        .where(eq(entityAssetTags.id, existing[0].id));
    } else {
      await db.insert(entityAssetTags).values({
        metroId: biz.cityId,
        entityId,
        tag: tag as any,
        confidence: data.confidence,
        evidenceJson: data.evidence,
      });
    }
    tagsWritten++;
  }

  const denomSlugsToAssign: string[] = [];
  for (const [tag, data] of consolidated) {
    if (data.confidence < minConfidence) continue;
    const slug = DENOMINATION_TAG_TO_CATEGORY_SLUG[tag];
    if (slug) denomSlugsToAssign.push(slug);
  }

  if (denomSlugsToAssign.length > 0) {
    const allSlugsToAssign = Array.from(new Set([...denomSlugsToAssign, "churches-places-of-worship"]));
    try {
      const matchingCats = await db
        .select({ id: categories.id, slug: categories.slug })
        .from(categories)
        .where(sql`${categories.slug} IN (${sql.join(allSlugsToAssign.map(s => sql`${s}`), sql`, `)})`);

      if (matchingCats.length > 0) {
        const newCatIds = matchingCats.map(c => c.id);
        const existingIds = (biz.categoryIds as string[]) || [];
        const merged = Array.from(new Set([...existingIds, ...newCatIds]));
        if (merged.length > existingIds.length) {
          await db.update(businesses)
            .set({ categoryIds: merged })
            .where(eq(businesses.id, entityId));
        }
      }
    } catch (err: any) {
      console.error(`[IndustryTagger] Denomination category assignment error for ${entityId}:`, err.message);
    }
  }

  return tagsWritten;
}

export const DENOMINATION_TAG_TO_CATEGORY_SLUG: Record<string, string> = {
  DENOMINATION_BAPTIST: "baptist",
  DENOMINATION_CATHOLIC: "catholic",
  DENOMINATION_METHODIST: "methodist",
  DENOMINATION_PRESBYTERIAN: "presbyterian",
  DENOMINATION_NON_DENOMINATIONAL: "non-denominational",
  DENOMINATION_PENTECOSTAL: "pentecostal",
  DENOMINATION_LUTHERAN: "lutheran",
  DENOMINATION_EPISCOPAL: "episcopal-anglican",
  DENOMINATION_AME: "ame-african-methodist",
  DENOMINATION_CHURCH_OF_GOD: "church-of-god",
  DENOMINATION_ADVENTIST: "seventh-day-adventist",
  DENOMINATION_ISLAMIC: "islamic-mosque",
  DENOMINATION_HINDU: "hindu-temple",
  DENOMINATION_JEWISH: "jewish-synagogue",
  DENOMINATION_BUDDHIST: "buddhist-temple",
  DENOMINATION_SIKH: "sikh-gurdwara",
};

export async function tagAllEntities(metroId?: string): Promise<{ tagged: number; totalTags: number; errors: number }> {
  let bizIds: { id: string }[];
  if (metroId) {
    bizIds = await db.select({ id: businesses.id }).from(businesses).where(eq(businesses.cityId, metroId));
  } else {
    bizIds = await db.select({ id: businesses.id }).from(businesses);
  }

  let tagged = 0;
  let totalTags = 0;
  let errors = 0;

  for (const { id } of bizIds) {
    try {
      const count = await tagEntityIndustry(id);
      if (count > 0) tagged++;
      totalTags += count;
    } catch (err: any) {
      console.error(`[IndustryTagger] Error for entity ${id}:`, err.message);
      errors++;
    }
  }

  console.log(`[IndustryTagger] Batch complete: ${tagged} entities tagged (${totalTags} total tags), ${errors} errors`);
  return { tagged, totalTags, errors };
}
