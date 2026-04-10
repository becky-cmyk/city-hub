import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  MapPin,
  Building2,
  TreePine,
  GraduationCap,
  Heart,
  Sun,
  TrendingUp,
  Users,
  Home,
  ChevronDown,
  ChevronUp,
  Search,
  ExternalLink,
  Map,
  Landmark,
  BookOpen,
  Church,
  Shield,
  Scale,
  Truck,
  Baby,
  School,
} from "lucide-react";
import { useState, lazy, Suspense } from "react";
import { Link } from "wouter";
import { usePageMeta } from "@/hooks/use-page-meta";
import { DarkPageShell } from "@/components/dark-page-shell";

const NeighborhoodMapLazy = lazy(() =>
  import("@/components/neighborhood-map").then(mod => ({ default: mod.NeighborhoodMap }))
);

interface HubInfo {
  name: string;
  code: string;
  slug: string;
  centerLat: string | null;
  centerLng: string | null;
  description: string | null;
  lifestyleTags: string[];
}

interface CountyGroup {
  county: string;
  code: string;
  state: string;
  hubs: HubInfo[];
}

interface RelocationData {
  metro: { name: string; description: string | null } | null;
  counties: CountyGroup[];
  totalHubs: number;
}

const METRO_STATS = [
  { label: "Metro Population", value: "2.7M+", icon: Users },
  { label: "Growth (2020-2025)", value: "+12.4%", icon: TrendingUp },
  { label: "Median Home Price", value: "$390K", icon: Home },
  { label: "Avg. Sunny Days/Year", value: "218", icon: Sun },
];

const WHY_RELOCATE = [
  {
    icon: TrendingUp,
    title: "Strong Job Market",
    desc: "Major employers include Bank of America, Lowe's, Honeywell, Duke Energy, and a thriving tech startup scene. Charlotte is the second-largest banking center in the US.",
  },
  {
    icon: Home,
    title: "Affordable Cost of Living",
    desc: "Housing costs remain below major metro averages. No state income tax in SC border communities. Wide range from urban condos to suburban family homes.",
  },
  {
    icon: Sun,
    title: "Year-Round Climate",
    desc: "Mild winters, warm summers, and vibrant fall foliage. Enjoy outdoor activities nearly every month. Mountains are 2 hours west, beaches 3.5 hours east.",
  },
  {
    icon: GraduationCap,
    title: "Quality Education",
    desc: "Charlotte-Mecklenburg Schools, top-ranked charter options, and nearby universities including UNC Charlotte, Davidson College, Queens University, and Johnson C. Smith.",
  },
  {
    icon: Heart,
    title: "Quality of Life",
    desc: "200+ parks, extensive greenway trails, professional sports (Panthers, Hornets, FC, Checkers), world-class dining, and a welcoming, diverse community.",
  },
  {
    icon: TreePine,
    title: "Nature Access",
    desc: "Lake Norman, Lake Wylie, and Mountain Island Lake for water sports. The Blue Ridge Parkway and Appalachian Trail are a short drive. The US National Whitewater Center is in your backyard.",
  },
];

const QUICK_LINKS = [
  { label: "Charlotte-Mecklenburg Schools (CMS)", url: "https://www.cms.k12.nc.us/" },
  { label: "NC DMV", url: "https://www.ncdot.gov/dmv/" },
  { label: "SC DMV", url: "https://www.scdmvonline.com/" },
  { label: "Duke Energy", url: "https://www.duke-energy.com/" },
  { label: "Charlotte Water", url: "https://charlottenc.gov/water" },
  { label: "Piedmont Natural Gas", url: "https://www.piedmontng.com/" },
  { label: "Atrium Health", url: "https://atriumhealth.org/" },
  { label: "Novant Health", url: "https://www.novanthealth.org/" },
  { label: "CATS Transit", url: "https://charlottenc.gov/cats" },
  { label: "CLT Airport", url: "https://www.cltairport.com/" },
];

interface InfraBusiness {
  id: string;
  name: string;
  slug: string;
  neighborhood: string | null;
}

interface InfraSubcategory {
  id: string;
  name: string;
  slug: string;
  count: number;
  businesses: InfraBusiness[];
}

interface InfraGroup {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  totalCount: number;
  subcategories: InfraSubcategory[];
}

interface InfraData {
  groups: InfraGroup[];
}

const SLUG_ICONS: Record<string, typeof Landmark> = {
  "government-public-services": Landmark,
  "education": GraduationCap,
  "nonprofit-faith": Church,
  "public-schools": School,
  "public-libraries": BookOpen,
  "public-safety": Shield,
  "courts-legal-services": Scale,
  "city-county-government": Building2,
  "public-utilities-infrastructure": Truck,
  "colleges-universities": GraduationCap,
  "early-childhood-preschool": Baby,
  "churches-places-of-worship": Church,
};

const COMPARE_NEIGHBORHOODS = [
  { name: "South End", housing: "Apartments & Condos", lifestyle: "Urban, Walkable, Nightlife", popular: "Young Professionals" },
  { name: "Ballantyne", housing: "Single-Family Homes", lifestyle: "Suburban, Shopping, Dining", popular: "Families" },
  { name: "NoDa", housing: "Lofts & Bungalows", lifestyle: "Arts, Music, Breweries", popular: "Creatives & Young Adults" },
  { name: "Myers Park", housing: "Historic Homes", lifestyle: "Tree-Lined Streets, Established", popular: "Families & Professionals" },
  { name: "Lake Wylie", housing: "Lakefront Homes", lifestyle: "Waterfront, Outdoor Recreation", popular: "Families & Retirees" },
  { name: "Davidson", housing: "Charming Downtown Homes", lifestyle: "Walkable, Lake Access, College Town", popular: "Families & Academics" },
  { name: "Fort Mill", housing: "New Construction", lifestyle: "Suburban, No State Income Tax (SC)", popular: "Commuters & Families" },
  { name: "Uptown", housing: "High-Rise Condos", lifestyle: "Urban Core, Sports, Culture", popular: "Young Professionals" },
];

export default function RelocationPage({ citySlug }: { citySlug: string }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedCounties, setExpandedCounties] = useState<Set<string>>(new Set());
  const [expandedInfra, setExpandedInfra] = useState<Set<string>>(new Set());

  usePageMeta({
    title: "Relocation Guide - Moving to the Charlotte Metro Area",
    description: "Your complete guide to relocating to the Charlotte, NC metro area. Explore 74+ neighborhoods and towns across 19 counties in NC and SC.",
    canonical: `${window.location.origin}/${citySlug}/relocation`,
  });

  const { data, isLoading } = useQuery<RelocationData>({
    queryKey: [`/api/cities/${citySlug}/relocation`],
  });

  const { data: infraData, isLoading: infraLoading } = useQuery<InfraData>({
    queryKey: [`/api/cities/${citySlug}/relocation/infrastructure`],
  });

  const toggleCounty = (code: string) => {
    setExpandedCounties(prev => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  const toggleInfra = (slug: string) => {
    setExpandedInfra(prev => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  };

  const filteredCounties = data?.counties
    ?.map(group => ({
      ...group,
      hubs: group.hubs.filter(h =>
        !searchTerm || h.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        group.county.toLowerCase().includes(searchTerm.toLowerCase())
      ),
    }))
    .filter(g => g.hubs.length > 0) || [];

  const allHubs = data?.counties?.flatMap(g => g.hubs) || [];

  return (
    <DarkPageShell maxWidth="wide" className="relocation-page">
      <div data-testid="relocation-page">
        <section className="text-center py-8 sm:py-12">
          <Badge className="mb-4 text-xs tracking-wide bg-emerald-500/20 text-emerald-400 border-emerald-500/30" data-testid="badge-relocation">
            RELOCATION GUIDE
          </Badge>
          <h1 className="text-3xl md:text-5xl font-bold mb-4 text-white" data-testid="heading-relocation">
            Your Guide to Moving to Charlotte
          </h1>
          <p className="text-base md:text-lg text-gray-400 max-w-3xl mx-auto mb-8" data-testid="text-relocation-intro">
            The Charlotte metro spans 19 counties across North Carolina and South Carolina,
            with {data?.totalHubs || "74+"} distinct neighborhoods and towns to call home.
            Find the area that fits your lifestyle.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 max-w-3xl mx-auto">
            {METRO_STATS.map((stat) => (
              <div key={stat.label} className="bg-gray-900 border border-gray-800 rounded-lg p-4" data-testid={`stat-${stat.label.replace(/\s+/g, "-").toLowerCase()}`}>
                <stat.icon className="w-5 h-5 mx-auto mb-2 text-emerald-400" />
                <div className="text-2xl font-bold text-white">{stat.value}</div>
                <div className="text-xs text-gray-500">{stat.label}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="py-8 sm:py-10" data-testid="section-housing-cta">
          <Link href={`/${citySlug}/relocation/housing`}>
            <Card className="p-6 bg-gradient-to-r from-emerald-900/40 to-teal-900/40 border-emerald-500/20 cursor-pointer transition-colors hover:border-emerald-500/40">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-lg bg-emerald-500/10">
                    <Building2 className="w-6 h-6 text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white mb-1">Housing & Real Estate Directory</h3>
                    <p className="text-sm text-gray-400">Apartment communities, realtors, and property managers across the Charlotte metro</p>
                  </div>
                </div>
                <ChevronDown className="w-5 h-5 text-emerald-400 -rotate-90 shrink-0" />
              </div>
            </Card>
          </Link>
        </section>

        <section className="py-8 sm:py-10">
          <h2 className="text-2xl font-bold mb-2 text-white" data-testid="heading-why-charlotte">Why Charlotte?</h2>
          <p className="text-gray-500 mb-6">Top reasons people are choosing the Charlotte metro</p>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {WHY_RELOCATE.map((item) => (
              <Card key={item.title} className="p-5 bg-gray-900 border-gray-800" data-testid={`card-why-${item.title.replace(/\s+/g, "-").toLowerCase()}`}>
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-emerald-500/10">
                    <item.icon className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1 text-white">{item.title}</h3>
                    <p className="text-sm text-gray-400">{item.desc}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </section>

        <section className="py-8 sm:py-10">
          <div className="flex items-center gap-3 mb-2">
            <Map className="w-6 h-6 text-emerald-400" />
            <h2 className="text-2xl font-bold text-white" data-testid="heading-explore-map">Explore Charlotte Neighborhoods</h2>
          </div>
          <p className="text-gray-500 mb-6">Click a pin to preview a neighborhood. Filter by lifestyle to find your match.</p>

          {isLoading ? (
            <Skeleton className="h-[540px] w-full rounded-xl bg-gray-800" />
          ) : (
            <Suspense fallback={<Skeleton className="h-[540px] w-full rounded-xl bg-gray-800" />}>
              <NeighborhoodMapLazy
                hubs={allHubs}
                citySlug={citySlug}
              />
            </Suspense>
          )}
        </section>

        <section className="py-8 sm:py-10">
          <h2 className="text-2xl font-bold mb-2 text-white" data-testid="heading-compare">Compare Charlotte Neighborhoods</h2>
          <p className="text-gray-500 mb-6">Side-by-side comparison of popular areas</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {COMPARE_NEIGHBORHOODS.map((n) => (
              <Card key={n.name} className="p-4 bg-gray-900 border-gray-800" data-testid={`compare-card-${n.name.replace(/\s+/g, "-").toLowerCase()}`}>
                <div className="flex items-center gap-2 mb-3">
                  <MapPin className="w-4 h-4 text-emerald-400 shrink-0" />
                  <h3 className="font-semibold text-sm text-white">{n.name}</h3>
                </div>
                <div className="space-y-2 text-xs">
                  <div>
                    <span className="text-gray-500">Housing</span>
                    <p className="text-gray-300">{n.housing}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Lifestyle</span>
                    <p className="text-gray-300">{n.lifestyle}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Popular With</span>
                    <p className="text-gray-300">{n.popular}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </section>

        <section className="py-8 sm:py-10">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
            <div>
              <h2 className="text-2xl font-bold text-white" data-testid="heading-area-guide">Area Guide by County</h2>
              <p className="text-gray-500">
                {filteredCounties.length} counties, {filteredCounties.reduce((sum, g) => sum + g.hubs.length, 0)} areas
              </p>
            </div>
            <div className="relative w-full md:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <Input
                placeholder="Search areas..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 bg-gray-900 border-gray-700 text-white placeholder:text-gray-500"
                data-testid="input-search-areas"
              />
            </div>
          </div>

          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4].map(i => (
                <Skeleton key={i} className="h-20 w-full rounded-lg bg-gray-800" />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredCounties.map((group) => {
                const isExpanded = expandedCounties.has(group.code) || !!searchTerm;
                return (
                  <Card key={group.code} className="overflow-hidden bg-gray-900 border-gray-800" data-testid={`county-card-${group.code}`}>
                    <button
                      onClick={() => toggleCounty(group.code)}
                      className="w-full flex items-center justify-between p-4 text-left"
                      data-testid={`button-toggle-${group.code}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-gray-800">
                          <Building2 className="w-4 h-4 text-gray-400" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-white">{group.county}</h3>
                          <p className="text-sm text-gray-500">
                            {group.hubs.length} {group.hubs.length === 1 ? "area" : "areas"} · {group.state === "SC" ? "South Carolina" : "North Carolina"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs border-gray-700 text-gray-400">
                          {group.state}
                        </Badge>
                        {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                      </div>
                    </button>
                    {isExpanded && (
                      <div className="border-t border-gray-800 px-4 pb-4">
                        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-4">
                          {group.hubs.map((hub) => (
                            <Link
                              key={hub.code}
                              href={`/${citySlug}/neighborhoods/${hub.slug}`}
                              data-testid={`link-hub-${hub.code}`}
                            >
                              <div className="border border-gray-700 rounded-lg p-3 transition-colors hover:border-emerald-500 hover:bg-emerald-500/5 cursor-pointer">
                                <div className="flex items-center gap-2 mb-1">
                                  <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                                  <span className="font-medium text-sm text-white">{hub.name}</span>
                                </div>
                                {hub.description && (
                                  <p className="text-xs text-gray-500 line-clamp-2">{hub.description}</p>
                                )}
                                {!hub.description && (
                                  <p className="text-xs text-gray-500">Explore local businesses, events, and community</p>
                                )}
                              </div>
                            </Link>
                          ))}
                        </div>
                      </div>
                    )}
                  </Card>
                );
              })}
              {filteredCounties.length === 0 && searchTerm && (
                <div className="text-center py-8 text-gray-500" data-testid="text-no-results">
                  No areas found matching "{searchTerm}"
                </div>
              )}
            </div>
          )}
        </section>

        <section className="py-8 sm:py-10">
          <h2 className="text-2xl font-bold mb-2 text-white" data-testid="heading-infrastructure">Infrastructure & Services</h2>
          <p className="text-gray-500 mb-6">Local government, education, and community services in your directory</p>

          {infraLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-20 w-full rounded-lg bg-gray-800" />
              ))}
            </div>
          ) : infraData?.groups && infraData.groups.length > 0 ? (
            <div className="space-y-3">
              {infraData.groups.map((group) => {
                const GroupIcon = SLUG_ICONS[group.slug] || Landmark;
                const isOpen = expandedInfra.has(group.slug);
                return (
                  <Card key={group.id} className="overflow-hidden bg-gray-900 border-gray-800" data-testid={`infra-group-${group.slug}`}>
                    <button
                      onClick={() => toggleInfra(group.slug)}
                      className="w-full flex items-center justify-between p-4 text-left"
                      data-testid={`button-infra-${group.slug}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-emerald-500/10">
                          <GroupIcon className="w-5 h-5 text-emerald-400" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-white">{group.name}</h3>
                          <p className="text-sm text-gray-500">
                            {group.totalCount} {group.totalCount === 1 ? "listing" : "listings"} across {group.subcategories.length} {group.subcategories.length === 1 ? "category" : "categories"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs border-gray-700 text-gray-400">
                          {group.totalCount}
                        </Badge>
                        {isOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                      </div>
                    </button>
                    {isOpen && (
                      <div className="border-t border-gray-800 px-4 pb-4">
                        <div className="space-y-4 pt-4">
                          {group.subcategories.map((sub) => {
                            const SubIcon = SLUG_ICONS[sub.slug] || GroupIcon;
                            return (
                              <div key={sub.id} data-testid={`infra-sub-${sub.slug}`}>
                                <div className="flex items-center gap-2 mb-2">
                                  <SubIcon className="w-4 h-4 text-gray-400" />
                                  <span className="text-sm font-medium text-gray-300">{sub.name}</span>
                                  <span className="text-xs text-gray-600">({sub.count})</span>
                                </div>
                                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                  {sub.businesses.map((biz) => (
                                    <Link
                                      key={biz.id}
                                      href={`/${citySlug}/biz/${biz.slug}`}
                                      data-testid={`link-infra-biz-${biz.id}`}
                                    >
                                      <div className="border border-gray-700 rounded-lg p-3 transition-colors hover:border-emerald-500 hover:bg-emerald-500/5 cursor-pointer">
                                        <span className="text-sm font-medium text-white block truncate">{biz.name}</span>
                                        {biz.neighborhood && (
                                          <span className="text-xs text-gray-500">{biz.neighborhood}</span>
                                        )}
                                      </div>
                                    </Link>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          ) : null}

          <div className="mt-8">
            <h3 className="text-lg font-semibold mb-3 text-gray-300" data-testid="heading-quick-links">Quick Links</h3>
            <div className="flex flex-wrap gap-2">
              {QUICK_LINKS.map((r) => (
                <a
                  key={r.label}
                  href={r.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 border border-gray-700 rounded-lg px-3 py-2 text-xs font-medium text-gray-400 transition-colors hover:border-emerald-500 hover:text-gray-300 hover:bg-emerald-500/5"
                  data-testid={`link-quicklink-${r.label.replace(/\s+/g, "-").toLowerCase()}`}
                >
                  <ExternalLink className="w-3 h-3 shrink-0" />
                  {r.label}
                </a>
              ))}
            </div>
          </div>
        </section>
      </div>
    </DarkPageShell>
  );
}
