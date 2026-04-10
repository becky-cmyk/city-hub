import type { Connector, ConnectorConfig, PullResult } from "./connectorTypes";

const OVERPASS_API = "https://overpass-api.de/api/interpreter";

const ORG_TAGS: Record<string, string[]> = {
  amenity: [
    "place_of_worship", "community_centre", "social_facility",
    "library", "school", "college", "university", "hospital",
    "clinic", "nursing_home", "fire_station", "police",
    "townhall", "courthouse",
  ],
  office: [
    "ngo", "government", "association", "charity", "foundation",
    "political_party", "religion", "educational_institution",
  ],
};

const OSM_TAG_TO_CATEGORY_SLUG: Record<string, string> = {
  "amenity=restaurant": "restaurant-dining",
  "amenity=cafe": "coffee-tea",
  "amenity=bar": "bars-breweries",
  "amenity=pub": "bars-breweries",
  "amenity=fast_food": "restaurant-dining",
  "amenity=pharmacy": "health-wellness-cat",
  "amenity=bank": "financial-services",
  "amenity=dentist": "health-wellness-cat",
  "amenity=doctors": "health-wellness-cat",
  "amenity=hospital": "health-wellness-cat",
  "amenity=clinic": "health-wellness-cat",
  "amenity=veterinary": "pets",
  "amenity=place_of_worship": "churches-places-of-worship",
  "amenity=library": "education-learning",
  "amenity=school": "education-learning",
  "amenity=college": "education-learning",
  "amenity=university": "education-learning",
  "amenity=community_centre": "community-orgs",
  "amenity=social_facility": "community-orgs",
  "amenity=nursing_home": "senior-services",
  "amenity=fire_station": "civic-advocacy",
  "amenity=police": "civic-advocacy",
  "amenity=townhall": "civic-advocacy",
  "amenity=courthouse": "civic-advocacy",
  "amenity=fuel": "automotive",
  "amenity=car_repair": "automotive",
  "leisure=park": "parks-outdoors",
  "leisure=playground": "parks-outdoors",
  "leisure=sports_centre": "sports-athletics",
  "leisure=swimming_pool": "sports-athletics",
  "leisure=fitness_centre": "sports-athletics",
  "tourism=museum": "arts-culture",
  "tourism=attraction": "arts-culture",
  "tourism=gallery": "arts-culture",
  "shop=supermarket": "grocery-market",
  "shop=convenience": "grocery-market",
  "shop=clothes": "retail-shopping-cat",
  "shop=hairdresser": "beauty-personal-care",
  "shop=beauty": "beauty-personal-care",
  "shop=bakery": "bakeries-desserts",
  "shop=florist": "retail-shopping-cat",
  "shop=hardware": "home-services-cat",
  "shop=electronics": "retail-shopping-cat",
  "shop=furniture": "retail-shopping-cat",
  "shop=books": "retail-shopping-cat",
  "shop=car": "automotive",
  "shop=car_repair": "automotive",
  "office=insurance": "professional-services-cat",
  "office=estate_agent": "real-estate",
  "office=lawyer": "professional-services-cat",
  "office=accountant": "professional-services-cat",
  "office=ngo": "community-orgs",
  "office=government": "civic-advocacy",
  "amenity=bus_station": "transit-transportation",
  "amenity=ferry_terminal": "transit-transportation",
  "amenity=taxi": "transit-transportation",
  "amenity=car_rental": "automotive",
  "amenity=car_wash": "automotive",
  "amenity=car_sharing": "automotive",
  "amenity=bicycle_rental": "retail-shopping-cat",
  "amenity=casino": "entertainment-recreation",
  "amenity=cinema": "arts-culture",
  "amenity=theatre": "arts-culture",
  "amenity=arts_centre": "arts-culture",
  "amenity=post_office": "community-orgs",
  "amenity=childcare": "education-learning",
  "amenity=kindergarten": "education-learning",
  "amenity=driving_school": "education-learning",
  "amenity=funeral_home": "funeral-memorial",
  "railway=station": "transit-transportation",
  "railway=halt": "transit-transportation",
  "railway=tram_stop": "transit-transportation",
  "aeroway=aerodrome": "transit-transportation",
  "landuse=cemetery": "funeral-memorial",
  "tourism=hotel": "travel-lodging",
  "tourism=hostel": "travel-lodging",
  "tourism=motel": "travel-lodging",
  "tourism=camp_site": "travel-lodging",
  "tourism=caravan_site": "travel-lodging",
  "tourism=guest_house": "travel-lodging",
  "tourism=zoo": "parks-outdoors",
  "tourism=aquarium": "parks-outdoors",
  "tourism=theme_park": "family-fun",
  "tourism=picnic_site": "parks-outdoors",
  "shop=pet": "pets",
  "shop=jewelry": "retail-shopping-cat",
  "shop=shoes": "retail-shopping-cat",
  "shop=optician": "health-wellness-cat",
  "shop=chemist": "health-wellness-cat",
  "shop=laundry": "home-services-cat",
  "shop=dry_cleaning": "home-services-cat",
  "shop=bicycle": "retail-shopping-cat",
  "shop=mobile_phone": "retail-shopping-cat",
  "shop=gift": "retail-shopping-cat",
  "shop=stationery": "retail-shopping-cat",
  "shop=department_store": "retail-shopping-cat",
  "shop=mall": "retail-shopping-cat",
  "shop=tattoo": "beauty-personal-care",
  "shop=car_parts": "automotive",
  "shop=tyres": "automotive",
  "leisure=golf_course": "sports-athletics",
  "leisure=stadium": "sports-athletics",
  "leisure=dog_park": "parks-outdoors",
  "leisure=nature_reserve": "parks-outdoors",
  "leisure=garden": "parks-outdoors",
  "leisure=bowling_alley": "family-fun",
  "leisure=miniature_golf": "family-fun",
  "leisure=water_park": "family-fun",
  "leisure=ice_rink": "sports-athletics",
  "office=association": "community-orgs",
  "office=charity": "community-orgs",
  "office=foundation": "community-orgs",
  "office=ngo": "community-orgs",
  "office=it": "professional-services-cat",
  "office=financial": "financial-services",
  "office=tax_advisor": "professional-services-cat",
  "office=company": "professional-services-cat",
};

function isOrgElement(tags: Record<string, string>): boolean {
  for (const [key, orgValues] of Object.entries(ORG_TAGS)) {
    const val = tags[key];
    if (val && orgValues.includes(val)) return true;
  }
  return false;
}

function mapCategory(tags: Record<string, string>): string | null {
  for (const key of ["amenity", "shop", "office", "leisure", "tourism", "railway", "aeroway", "landuse"]) {
    const val = tags[key];
    if (val) {
      const slug = OSM_TAG_TO_CATEGORY_SLUG[`${key}=${val}`];
      if (slug) return slug;
    }
  }
  return null;
}

function buildOverpassQuery(
  bbox: { south: number; west: number; north: number; east: number },
  tagKeys: string[],
): string {
  const bboxStr = `${bbox.south},${bbox.west},${bbox.north},${bbox.east}`;
  const parts: string[] = [];

  for (const tag of tagKeys) {
    parts.push(`node["${tag}"]["name"](${bboxStr});`);
    parts.push(`way["${tag}"]["name"](${bboxStr});`);
  }

  return `[out:json][timeout:30];(${parts.join("")});out center body;`;
}

function parseAddress(tags: Record<string, string>): {
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
} {
  const street = tags["addr:street"] || "";
  const housenumber = tags["addr:housenumber"] || "";
  const parts = [housenumber, street].filter(Boolean);

  return {
    address: parts.length > 0 ? parts.join(" ") : null,
    city: tags["addr:city"] || null,
    state: tags["addr:state"] || null,
    zip: tags["addr:postcode"] || null,
  };
}

export class OsmOverpassConnector implements Connector {
  async pull(config: ConnectorConfig): Promise<PullResult> {
    const params = config.paramsJson || {};
    const bbox = params.bbox;
    if (!bbox || !bbox.south || !bbox.west || !bbox.north || !bbox.east) {
      throw new Error("OsmOverpassConnector requires bbox in paramsJson with south, west, north, east");
    }

    const tagKeys: string[] = params.tags || ["amenity", "shop", "office"];
    const limit: number = params.limit || 10;

    const query = buildOverpassQuery(bbox, tagKeys);

    const response = await fetch(OVERPASS_API, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `data=${encodeURIComponent(query)}`,
    });

    if (!response.ok) {
      throw new Error(`Overpass API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as {
      elements: Array<{
        type: string;
        id: number;
        lat?: number;
        lon?: number;
        center?: { lat: number; lon: number };
        tags?: Record<string, string>;
      }>;
    };

    const rows: any[] = [];
    const seen = new Set<number>();

    for (const el of data.elements || []) {
      if (rows.length >= limit) break;

      const tags = el.tags || {};
      const name = tags.name;
      if (!name) continue;

      if (seen.has(el.id)) continue;
      seen.add(el.id);

      const lat = el.lat ?? el.center?.lat ?? null;
      const lon = el.lon ?? el.center?.lon ?? null;
      const addr = parseAddress(tags);
      const presenceType = isOrgElement(tags) ? "organization" : "commerce";
      const categorySlug = mapCategory(tags);

      rows.push({
        _externalId: `osm-${el.type}-${el.id}`,
        _name: name,
        _address: addr.address,
        _city: addr.city,
        _state: addr.state,
        _zip: addr.zip,
        _phone: tags.phone || tags["contact:phone"] || null,
        _website: tags.website || tags["contact:website"] || null,
        _latitude: lat,
        _longitude: lon,
        _presenceType: presenceType,
        _isNonprofit: presenceType === "organization",
        _categorySlug: categorySlug,
        _osmType: el.type,
        _osmId: el.id,
        _osmTags: tags,
        _licenseNote: "Data from OpenStreetMap contributors, licensed under ODbL 1.0",
      });
    }

    return {
      rows,
      totalAvailable: data.elements?.length || 0,
    };
  }
}
