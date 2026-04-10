import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "wouter";
import { DarkPageShell } from "@/components/dark-page-shell";
import { usePageMeta } from "@/hooks/use-page-meta";
import { JsonLd } from "@/components/json-ld";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { useState, lazy, Suspense } from "react";
import {
  MapPin, Briefcase, Home, Sun, GraduationCap, Heart, TrendingUp,
  Users, ChevronRight, Train, Plane, TreePine, UtensilsCrossed,
  Calendar, ArrowRight, Building2, Star, Map, Search,
  ChevronDown, ChevronUp, ExternalLink
} from "lucide-react";

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

const RESOURCES = [
  { label: "Charlotte-Mecklenburg Schools (CMS)", url: "https://www.cms.k12.nc.us/" },
  { label: "NC DMV - Driver's License", url: "https://www.ncdot.gov/dmv/" },
  { label: "SC DMV", url: "https://www.scdmvonline.com/" },
  { label: "Duke Energy (Electricity)", url: "https://www.duke-energy.com/" },
  { label: "Charlotte Water", url: "https://charlottenc.gov/water" },
  { label: "Piedmont Natural Gas", url: "https://www.piedmontng.com/" },
  { label: "Atrium Health (Healthcare)", url: "https://atriumhealth.org/" },
  { label: "Novant Health", url: "https://www.novanthealth.org/" },
  { label: "CATS Transit (Bus/Light Rail)", url: "https://charlottenc.gov/cats" },
  { label: "Charlotte Douglas Airport (CLT)", url: "https://www.cltairport.com/" },
];

const CHARLOTTE_CITY_ID = "b0d970f5-cfd6-475b-8739-cfd5352094c4";

const NEIGHBORHOOD_LINKS = [
  { name: "South End", slug: "living-in-south-end-charlotte", hubCode: "southend" },
  { name: "NoDa", slug: "living-in-noda-charlotte", hubCode: "noda" },
  { name: "Plaza Midwood", slug: "living-in-plaza-midwood", hubCode: "plazamidwood" },
  { name: "Dilworth", slug: "living-in-dilworth-charlotte", hubCode: "dilworth" },
  { name: "Ballantyne", slug: "living-in-ballantyne", hubCode: "ballantyne" },
  { name: "Matthews", slug: "living-in-matthews-nc", hubCode: "matthews" },
  { name: "Huntersville", slug: "living-in-huntersville-nc", hubCode: "huntersville" },
  { name: "Cornelius", slug: "living-in-cornelius-nc", hubCode: "cornelius" },
];

const ARTICLE_LINKS = [
  { title: "Relocating to Charlotte", slug: "relocating-to-charlotte" },
  { title: "Cost of Living in Charlotte", slug: "cost-of-living-in-charlotte" },
  { title: "Best Neighborhoods in Charlotte", slug: "best-neighborhoods-in-charlotte" },
  { title: "Living in Charlotte NC", slug: "living-in-charlotte-nc" },
  { title: "Charlotte NC Neighborhood Guide", slug: "charlotte-nc-neighborhood-guide" },
];

const FAQ_DATA = [
  { q: "Is Charlotte expensive to live in?", a: "Charlotte is more affordable than many major U.S. cities. Housing costs, property taxes, and overall cost of living are lower than cities like New York, Boston, Los Angeles, and Washington D.C. The median home price is around $390,000, and there are affordable suburban communities nearby in both North Carolina and South Carolina." },
  { q: "What salary do you need to live in Charlotte?", a: "A household income of $55,000 to $75,000 can support a comfortable lifestyle in Charlotte, depending on the neighborhood and lifestyle choices. Higher salaries are common in finance, tech, and healthcare sectors. Suburban areas like Matthews, Huntersville, and Indian Trail offer lower housing costs." },
  { q: "What are the best neighborhoods in Charlotte?", a: "Popular neighborhoods include South End for young professionals, Dilworth and Myers Park for families, NoDa for arts and culture, Plaza Midwood for eclectic charm, Ballantyne for suburban living, and Uptown for city-center convenience. Each neighborhood has its own personality and price range." },
  { q: "Is Charlotte good for families?", a: "Yes. Charlotte offers excellent school options through Charlotte-Mecklenburg Schools and top-rated charter schools, plus family-friendly suburbs like Ballantyne, Matthews, Huntersville, and Fort Mill. The metro has 200+ parks, greenway trails, museums, and professional sports teams." },
  { q: "Is Charlotte a good city for young professionals?", a: "Charlotte is one of the top cities for young professionals. The city is the second-largest banking center in the U.S. with strong tech, healthcare, and energy sectors. Neighborhoods like South End and NoDa offer walkable urban living with restaurants, breweries, and nightlife." },
  { q: "What is the cost of rent in Charlotte?", a: "Average rent in Charlotte ranges from $1,200 to $1,800 for a one-bedroom apartment depending on the neighborhood. South End and Uptown tend to be higher, while areas like University City, Steele Creek, and surrounding suburbs offer more affordable options." },
  { q: "Why are people moving to Charlotte?", a: "Charlotte attracts new residents with its strong job market, lower cost of living compared to major metros, year-round mild climate, quality of life, and growing cultural scene. The city has experienced over 12% population growth since 2020." },
  { q: "Is Charlotte NC good for retirees?", a: "Charlotte offers retirees a mild climate, excellent healthcare through Atrium Health and Novant Health systems, affordable living options, cultural amenities, and easy access to both mountains and beaches. Lake Norman and Lake Wylie communities are popular retirement destinations." },
];

function FeaturedBusinesses({ citySlug }: { citySlug: string }) {
  const { data } = useQuery<any[]>({
    queryKey: ["/api/cities", citySlug, "businesses", "relocation-featured"],
    queryFn: async () => {
      const res = await fetch(`/api/cities/${citySlug}/businesses?limit=6`);
      if (!res.ok) return [];
      const json = await res.json();
      return Array.isArray(json) ? json : json.businesses || [];
    },
  });

  if (!data || data.length === 0) return null;

  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {data.slice(0, 6).map((biz: any) => (
        <Link key={biz.id} href={`/${citySlug}/directory/${biz.slug}`}>
          <Card className="p-4 bg-white/5 border-white/10 hover:border-purple-500/40 transition-colors cursor-pointer h-full" data-testid={`card-biz-${biz.id}`}>
            <div className="flex items-start gap-3">
              <Building2 className="h-4 w-4 text-purple-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-white line-clamp-1">{biz.name}</p>
                {biz.categoryName && <p className="text-xs text-white/50 mt-0.5">{biz.categoryName}</p>}
              </div>
            </div>
          </Card>
        </Link>
      ))}
    </div>
  );
}

function LocalExperts({ citySlug }: { citySlug: string }) {
  const { data } = useQuery<any[]>({
    queryKey: ["/api/cities", citySlug, "experts", "relocation"],
    queryFn: async () => {
      const res = await fetch(`/api/cities/${citySlug}/experts?limit=4`);
      if (!res.ok) return [];
      return res.json();
    },
  });

  if (!data || data.length === 0) return null;

  return (
    <div className="grid sm:grid-cols-2 gap-3">
      {data.slice(0, 4).map((expert: any) => (
        <Link key={expert.id} href={`/${citySlug}/directory/${expert.slug}`}>
          <Card className="p-4 bg-white/5 border-white/10 hover:border-purple-500/40 transition-colors cursor-pointer h-full" data-testid={`card-expert-${expert.id}`}>
            <div className="flex items-start gap-3">
              <Users className="h-4 w-4 text-purple-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-white line-clamp-1">{expert.name}</p>
                {(expert.categoryName || expert.expertCategories?.[0]) && (
                  <p className="text-xs text-white/50 mt-0.5">{expert.categoryName || expert.expertCategories?.[0]}</p>
                )}
              </div>
            </div>
          </Card>
        </Link>
      ))}
    </div>
  );
}

function PulsePreview({ citySlug }: { citySlug: string }) {
  const { data } = useQuery<any[]>({
    queryKey: ["/api/feed", "relocation-preview"],
    queryFn: async () => {
      const res = await fetch(`/api/feed?cityId=${CHARLOTTE_CITY_ID}&limit=4&offset=0`);
      if (!res.ok) return [];
      const json = await res.json();
      return (json.items || []).slice(0, 4);
    },
  });

  if (!data || data.length === 0) return null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {data.map((item: any) => (
        <Link key={item.id} href={`/${citySlug}/pulse`}>
          <div className="rounded-xl bg-white/5 border border-white/10 overflow-hidden cursor-pointer hover:border-white/20 transition-colors">
            {item.imageUrl && (
              <div className="w-full aspect-[2/1] overflow-hidden">
                <img src={item.imageUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
              </div>
            )}
            <div className="p-3">
              <p className="text-xs text-purple-400 font-medium mb-1">
                {item.type === "rss" ? "Charlotte Hub" : item.type === "event" ? "Event" : "Update"}
              </p>
              <p className="text-sm font-semibold text-white line-clamp-2 leading-snug">{item.title}</p>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}

function UpcomingEvents({ citySlug }: { citySlug: string }) {
  const { data } = useQuery<any[]>({
    queryKey: ["/api/cities", citySlug, "events", "relocation"],
    queryFn: async () => {
      const res = await fetch(`/api/cities/${citySlug}/events?limit=4`);
      if (!res.ok) return [];
      return res.json();
    },
  });

  if (!data || data.length === 0) return null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {data.slice(0, 4).map((evt: any) => (
        <Link key={evt.id} href={`/${citySlug}/events/${evt.slug}`}>
          <Card className="p-4 bg-white/5 border-white/10 hover:border-white/20 transition-colors cursor-pointer" data-testid={`card-event-${evt.id}`}>
            <div className="flex items-start gap-3">
              <Calendar className="h-4 w-4 text-purple-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-white line-clamp-2">{evt.name || evt.title}</p>
                {evt.startDate && (
                  <p className="text-xs text-white/50 mt-1">{new Date(evt.startDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p>
                )}
              </div>
            </div>
          </Card>
        </Link>
      ))}
    </div>
  );
}

function Section({ children, id }: { children: React.ReactNode; id?: string }) {
  return (
    <section id={id} className="py-10 md:py-14 border-b border-white/5 last:border-b-0">
      {children}
    </section>
  );
}

function SectionHeading({ icon: Icon, title }: { icon: any; title: string }) {
  return (
    <div className="flex items-center gap-3 mb-6">
      <div className="w-10 h-10 rounded-full bg-purple-600/20 flex items-center justify-center">
        <Icon className="h-5 w-5 text-purple-400" />
      </div>
      <h2 className="text-2xl font-bold text-white">{title}</h2>
    </div>
  );
}

export default function MovingToCharlotte() {
  const { citySlug } = useParams<{ citySlug: string }>();
  const cs = citySlug || "charlotte";
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedCounties, setExpandedCounties] = useState<Set<string>>(new Set());

  const { data: relocationData, isLoading: relocationLoading } = useQuery<RelocationData>({
    queryKey: ["/api/cities", cs, "relocation"],
    queryFn: async () => {
      const res = await fetch(`/api/cities/${cs}/relocation`);
      if (!res.ok) return { metro: null, counties: [], totalHubs: 0 };
      return res.json();
    },
  });

  const toggleCounty = (code: string) => {
    setExpandedCounties(prev => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  const filteredCounties = relocationData?.counties
    ?.map(group => ({
      ...group,
      hubs: group.hubs.filter(h =>
        !searchTerm || h.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        group.county.toLowerCase().includes(searchTerm.toLowerCase())
      ),
    }))
    .filter(g => g.hubs.length > 0) || [];

  const allHubs = relocationData?.counties?.flatMap(g => g.hubs) || [];

  usePageMeta({
    title: "Moving to Charlotte: The Complete Guide to Living in the Queen City",
    description: "Your complete guide to moving to Charlotte NC. Explore neighborhoods, cost of living, job market, housing, and lifestyle in the Queen City. 74+ neighborhoods across 19 counties.",
    canonical: `${window.location.origin}/${cs}/moving-to-charlotte`,
    ogTitle: "Moving to Charlotte: The Complete Guide",
    ogDescription: "Everything you need to know about relocating to Charlotte, NC — neighborhoods, cost of living, jobs, housing, and community.",
    ogUrl: `${window.location.origin}/${cs}/moving-to-charlotte`,
    ogType: "article",
    keywords: "moving to charlotte, relocating to charlotte, charlotte nc neighborhoods, cost of living charlotte nc, charlotte nc housing, best neighborhoods charlotte, living in charlotte nc",
  });

  return (
    <DarkPageShell maxWidth="wide">
      <JsonLd data={{
        "@context": "https://schema.org",
        "@type": "Article",
        headline: "Moving to Charlotte: The Complete Guide to Living in the Queen City",
        description: "Your complete guide to moving to Charlotte NC. Explore neighborhoods, cost of living, job market, housing, and lifestyle.",
        author: { "@type": "Organization", name: "CLT Hub" },
        publisher: { "@type": "Organization", name: "CLT Hub" },
        mainEntityOfPage: `${window.location.origin}/${cs}/moving-to-charlotte`,
      }} />
      <JsonLd data={{
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: FAQ_DATA.map(f => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      }} />

      <Section id="hero">
        <div className="text-center max-w-3xl mx-auto">
          <Badge className="mb-4 bg-purple-600/20 text-purple-300 border-purple-500/30" data-testid="badge-relocation-guide">RELOCATION GUIDE</Badge>
          <h1 className="text-3xl md:text-5xl font-bold text-white leading-tight tracking-tight mb-6" data-testid="text-pillar-title">
            Moving to Charlotte: The Complete Guide to Living in the Queen City
          </h1>
          <p className="text-lg text-white/70 leading-relaxed mb-4">
            Charlotte has become one of the fastest-growing cities in the United States, attracting new residents from across the country every year. Whether you're relocating for career opportunities, a lower cost of living, or a better quality of life, the Queen City continues to draw families, entrepreneurs, and professionals looking for a place to build their future.
          </p>
          <p className="text-base text-white/50 leading-relaxed mb-8">
            If you're thinking about moving to Charlotte, understanding the neighborhoods, lifestyle, job market, and local community can help you make the transition smoothly. Charlotte is more than just a city — it's a network of neighborhoods and communities, each with its own personality, culture, and opportunities.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link href={`/${cs}/pulse`}>
              <Button className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-8 h-12 text-base font-semibold" data-testid="button-explore-pulse">
                Explore the Pulse <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
            <Link href={`/${cs}/neighborhoods`}>
              <Button variant="outline" className="border-white/20 text-white h-12 px-8 text-base" data-testid="button-explore-neighborhoods">
                Browse Neighborhoods
              </Button>
            </Link>
          </div>
        </div>
      </Section>

      <Section id="why-charlotte">
        <SectionHeading icon={TrendingUp} title="Why So Many People Are Moving to Charlotte" />
        <p className="text-white/60 leading-relaxed mb-8 max-w-3xl">
          Charlotte's population growth has accelerated over the past decade. People are relocating from major metropolitan areas such as New York, California, Florida, and the Northeast because Charlotte offers a balance that many cities struggle to provide. Residents enjoy the advantages of a large city while still experiencing a strong sense of community.
        </p>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Card className="p-5 bg-white/5 border-white/10" data-testid="card-job-market">
            <div className="flex items-start gap-3">
              <Briefcase className="h-5 w-5 text-purple-400 mt-0.5 shrink-0" />
              <div>
                <h3 className="font-semibold text-white mb-2">Strong Job Market</h3>
                <p className="text-sm text-white/60">Charlotte is one of the largest financial centers in the United States. The city has developed strong technology, healthcare, logistics, and energy sectors. Professionals relocating to Charlotte often find a strong job market with room for growth.</p>
              </div>
            </div>
          </Card>
          <Card className="p-5 bg-white/5 border-white/10" data-testid="card-cost-living">
            <div className="flex items-start gap-3">
              <Home className="h-5 w-5 text-purple-400 mt-0.5 shrink-0" />
              <div>
                <h3 className="font-semibold text-white mb-2">Cost of Living Compared to Other Cities</h3>
                <p className="text-sm text-white/60">Charlotte remains more affordable than many major metropolitan areas. Compared to New York, Boston, Los Angeles, or Washington D.C., Charlotte offers lower housing costs, lower property taxes, more space for the price, and affordable suburban communities nearby.</p>
              </div>
            </div>
          </Card>
          <Card className="p-5 bg-white/5 border-white/10" data-testid="card-lifestyle">
            <div className="flex items-start gap-3">
              <Heart className="h-5 w-5 text-purple-400 mt-0.5 shrink-0" />
              <div>
                <h3 className="font-semibold text-white mb-2">Lifestyle and Quality of Life</h3>
                <p className="text-sm text-white/60">Charlotte offers a balance between urban living and outdoor recreation. Residents enjoy a vibrant restaurant and brewery scene, professional sports teams, outdoor recreation, community events, and access to lakes, mountains, and beaches.</p>
              </div>
            </div>
          </Card>
          <Card className="p-5 bg-white/5 border-white/10" data-testid="card-climate">
            <div className="flex items-start gap-3">
              <Sun className="h-5 w-5 text-purple-400 mt-0.5 shrink-0" />
              <div>
                <h3 className="font-semibold text-white mb-2">Year-Round Climate</h3>
                <p className="text-sm text-white/60">Mild winters, warm summers, and vibrant fall foliage. Enjoy outdoor activities nearly every month. Mountains are 2 hours west, beaches 3.5 hours east. Charlotte averages 218 sunny days per year.</p>
              </div>
            </div>
          </Card>
          <Card className="p-5 bg-white/5 border-white/10" data-testid="card-education">
            <div className="flex items-start gap-3">
              <GraduationCap className="h-5 w-5 text-purple-400 mt-0.5 shrink-0" />
              <div>
                <h3 className="font-semibold text-white mb-2">Quality Education</h3>
                <p className="text-sm text-white/60">Charlotte-Mecklenburg Schools, top-ranked charter options, and nearby universities including UNC Charlotte, Davidson College, Queens University, and Johnson C. Smith University.</p>
              </div>
            </div>
          </Card>
          <Card className="p-5 bg-white/5 border-white/10" data-testid="card-nature">
            <div className="flex items-start gap-3">
              <TreePine className="h-5 w-5 text-purple-400 mt-0.5 shrink-0" />
              <div>
                <h3 className="font-semibold text-white mb-2">Nature Access</h3>
                <p className="text-sm text-white/60">Lake Norman, Lake Wylie, the U.S. National Whitewater Center, Charlotte's greenway trail system, and hiking areas in the Blue Ridge Mountains are all within easy reach.</p>
              </div>
            </div>
          </Card>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8 max-w-3xl mx-auto">
          <div className="text-center bg-white/5 rounded-xl p-4 border border-white/10">
            <Users className="h-5 w-5 mx-auto mb-2 text-purple-400" />
            <div className="text-2xl font-bold text-white">2.7M+</div>
            <div className="text-xs text-white/50">Metro Population</div>
          </div>
          <div className="text-center bg-white/5 rounded-xl p-4 border border-white/10">
            <TrendingUp className="h-5 w-5 mx-auto mb-2 text-purple-400" />
            <div className="text-2xl font-bold text-white">+12.4%</div>
            <div className="text-xs text-white/50">Growth Since 2020</div>
          </div>
          <div className="text-center bg-white/5 rounded-xl p-4 border border-white/10">
            <Home className="h-5 w-5 mx-auto mb-2 text-purple-400" />
            <div className="text-2xl font-bold text-white">$390K</div>
            <div className="text-xs text-white/50">Median Home Price</div>
          </div>
          <div className="text-center bg-white/5 rounded-xl p-4 border border-white/10">
            <Sun className="h-5 w-5 mx-auto mb-2 text-purple-400" />
            <div className="text-2xl font-bold text-white">218</div>
            <div className="text-xs text-white/50">Sunny Days/Year</div>
          </div>
        </div>
      </Section>

      <Section id="neighborhoods">
        <SectionHeading icon={MapPin} title="Understanding Charlotte's Neighborhoods" />
        <p className="text-white/60 leading-relaxed mb-6 max-w-3xl">
          One of the most important parts of moving to Charlotte is choosing the neighborhood that fits your lifestyle. The city is made up of dozens of distinct communities, each with its own identity. Exploring neighborhoods helps newcomers discover where they feel most at home.
        </p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          {NEIGHBORHOOD_LINKS.map(n => (
            <Link key={n.slug} href={`/${cs}/${n.slug}`}>
              <Card className="p-4 bg-white/5 border-white/10 hover:border-purple-500/40 transition-colors cursor-pointer h-full" data-testid={`card-neighborhood-${n.hubCode}`}>
                <div className="flex items-center gap-2 mb-2">
                  <MapPin className="h-4 w-4 text-purple-400 shrink-0" />
                  <span className="font-semibold text-white text-sm">{n.name}</span>
                </div>
                <p className="text-xs text-white/50">Explore living in {n.name} <ChevronRight className="h-3 w-3 inline" /></p>
              </Card>
            </Link>
          ))}
        </div>
        <div className="text-center">
          <Link href={`/${cs}/neighborhoods`}>
            <Button variant="outline" className="border-white/20 text-white" data-testid="button-all-neighborhoods">
              View All 74+ Neighborhoods <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </Link>
        </div>
      </Section>

      <Section id="explore-map">
        <SectionHeading icon={Map} title="Explore Charlotte Neighborhoods on the Map" />
        <p className="text-white/60 leading-relaxed mb-6 max-w-3xl">
          Use the interactive map to explore neighborhoods across the Charlotte metro. Click a pin to preview any area, or filter by lifestyle to find neighborhoods that match what you're looking for.
        </p>
        {relocationLoading ? (
          <Skeleton className="h-[540px] w-full rounded-xl bg-white/5" />
        ) : (
          <Suspense fallback={<Skeleton className="h-[540px] w-full rounded-xl bg-white/5" />}>
            <NeighborhoodMapLazy
              hubs={allHubs}
              citySlug={cs}
            />
          </Suspense>
        )}
      </Section>

      <Section id="compare">
        <SectionHeading icon={Home} title="Compare Charlotte Neighborhoods" />
        <p className="text-white/60 leading-relaxed mb-6 max-w-3xl">
          A quick side-by-side look at some of Charlotte's most popular areas to help you narrow down where to focus your search.
        </p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {COMPARE_NEIGHBORHOODS.map((n) => (
            <Card key={n.name} className="p-4 bg-white/5 border-white/10" data-testid={`compare-card-${n.name.replace(/\s+/g, "-").toLowerCase()}`}>
              <div className="flex items-center gap-2 mb-3">
                <MapPin className="w-4 h-4 text-purple-400 shrink-0" />
                <h3 className="font-semibold text-sm text-white">{n.name}</h3>
              </div>
              <div className="space-y-2 text-xs">
                <div>
                  <span className="text-white/40">Housing</span>
                  <p className="text-white/70">{n.housing}</p>
                </div>
                <div>
                  <span className="text-white/40">Lifestyle</span>
                  <p className="text-white/70">{n.lifestyle}</p>
                </div>
                <div>
                  <span className="text-white/40">Popular With</span>
                  <p className="text-white/70">{n.popular}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </Section>

      <Section id="neighborhood-details">
        <div className="space-y-8 max-w-3xl">
          <div>
            <h3 className="text-xl font-bold text-white mb-2">Uptown Charlotte</h3>
            <p className="text-white/60 text-sm leading-relaxed">Uptown is the central business district and the heart of the Charlotte skyline. It is home to major corporate offices, sports arenas, museums, and cultural venues. People who prefer city living, walkability, and proximity to work often choose Uptown.</p>
            <Link href={`/${cs}/neighborhoods/uptown`}><span className="text-purple-400 text-sm inline-flex items-center gap-1 mt-2 hover:underline">Explore Uptown Hub <ChevronRight className="h-3 w-3" /></span></Link>
          </div>
          <div>
            <h3 className="text-xl font-bold text-white mb-2">South End</h3>
            <p className="text-white/60 text-sm leading-relaxed">South End is one of Charlotte's fastest-growing neighborhoods. The area is known for its restaurants, breweries, apartments, and access to the Rail Trail. Young professionals and entrepreneurs are often drawn to South End's active urban environment.</p>
            <Link href={`/${cs}/living-in-south-end-charlotte`}><span className="text-purple-400 text-sm inline-flex items-center gap-1 mt-2 hover:underline">Living in South End Guide <ChevronRight className="h-3 w-3" /></span></Link>
          </div>
          <div>
            <h3 className="text-xl font-bold text-white mb-2">NoDa</h3>
            <p className="text-white/60 text-sm leading-relaxed">NoDa, short for North Davidson, is Charlotte's arts district. The neighborhood features galleries, live music venues, creative spaces, and independent restaurants. Residents who enjoy creative culture and community events often gravitate toward NoDa.</p>
            <Link href={`/${cs}/living-in-noda-charlotte`}><span className="text-purple-400 text-sm inline-flex items-center gap-1 mt-2 hover:underline">Living in NoDa Guide <ChevronRight className="h-3 w-3" /></span></Link>
          </div>
          <div>
            <h3 className="text-xl font-bold text-white mb-2">Plaza Midwood</h3>
            <p className="text-white/60 text-sm leading-relaxed">Plaza Midwood combines historic charm with a vibrant local culture. The neighborhood includes vintage homes, local shops, restaurants, and nightlife. Many longtime Charlotte residents consider Plaza Midwood one of the city's most unique neighborhoods.</p>
            <Link href={`/${cs}/living-in-plaza-midwood`}><span className="text-purple-400 text-sm inline-flex items-center gap-1 mt-2 hover:underline">Living in Plaza Midwood Guide <ChevronRight className="h-3 w-3" /></span></Link>
          </div>
          <div>
            <h3 className="text-xl font-bold text-white mb-2">Dilworth</h3>
            <p className="text-white/60 text-sm leading-relaxed">Dilworth is one of Charlotte's oldest neighborhoods and is known for its historic homes, tree-lined streets, and proximity to Uptown. The area offers a quieter residential environment while remaining close to the city center.</p>
            <Link href={`/${cs}/living-in-dilworth-charlotte`}><span className="text-purple-400 text-sm inline-flex items-center gap-1 mt-2 hover:underline">Living in Dilworth Guide <ChevronRight className="h-3 w-3" /></span></Link>
          </div>
          <div>
            <h3 className="text-xl font-bold text-white mb-2">Ballantyne</h3>
            <p className="text-white/60 text-sm leading-relaxed">Ballantyne is a rapidly growing area south of Charlotte with corporate campuses, new housing developments, and family-friendly communities. Many professionals relocating to Charlotte choose Ballantyne because of its modern infrastructure and business presence.</p>
            <Link href={`/${cs}/living-in-ballantyne`}><span className="text-purple-400 text-sm inline-flex items-center gap-1 mt-2 hover:underline">Living in Ballantyne Guide <ChevronRight className="h-3 w-3" /></span></Link>
          </div>
        </div>
      </Section>

      <Section id="housing">
        <SectionHeading icon={Home} title="Finding Housing in Charlotte" />
        <div className="max-w-3xl">
          <p className="text-white/60 leading-relaxed mb-4">Charlotte offers a wide range of housing options depending on your budget and lifestyle. Common options include urban apartments, townhomes, suburban neighborhoods, historic homes, and new residential developments.</p>
          <p className="text-white/60 leading-relaxed mb-4">Many people moving to Charlotte begin by renting while they explore different parts of the city before purchasing a home. Working with local real estate professionals who understand the neighborhoods can make the process easier.</p>
          <Link href={`/${cs}/cost-of-living-in-charlotte`}>
            <span className="text-purple-400 text-sm inline-flex items-center gap-1 hover:underline">Charlotte Cost of Living Guide <ChevronRight className="h-3 w-3" /></span>
          </Link>
        </div>
      </Section>

      <Section id="transportation">
        <SectionHeading icon={Train} title="Transportation and Getting Around" />
        <div className="max-w-3xl space-y-4">
          <p className="text-white/60 leading-relaxed">Charlotte is primarily a driving city, but transportation options continue to expand.</p>
          <div>
            <h3 className="text-lg font-semibold text-white mb-2 flex items-center gap-2"><Train className="h-4 w-4 text-purple-400" /> Light Rail</h3>
            <p className="text-white/60 text-sm leading-relaxed">The Lynx Blue Line connects several major neighborhoods including Uptown, South End, NoDa, and the University area. Many residents choose to live near light rail stations for easier commuting.</p>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white mb-2 flex items-center gap-2"><Plane className="h-4 w-4 text-purple-400" /> Airport Access</h3>
            <p className="text-white/60 text-sm leading-relaxed">Charlotte Douglas International Airport is one of the busiest airports in the country and provides direct flights to many domestic and international destinations, making Charlotte convenient for both business and leisure travel.</p>
          </div>
        </div>
      </Section>

      <Section id="outdoor">
        <SectionHeading icon={TreePine} title="Outdoor Recreation and Nature" />
        <div className="max-w-3xl">
          <p className="text-white/60 leading-relaxed mb-4">Charlotte offers excellent access to outdoor recreation. Popular destinations include Lake Norman, Lake Wylie, the U.S. National Whitewater Center, Charlotte's greenway trail system, and hiking areas in the nearby Blue Ridge Mountains.</p>
          <p className="text-white/60 leading-relaxed">Residents often spend weekends exploring parks, lakes, and outdoor activities throughout the region.</p>
        </div>
      </Section>

      <Section id="food">
        <SectionHeading icon={UtensilsCrossed} title="Charlotte's Food and Local Business Scene" />
        <div className="max-w-3xl mb-6">
          <p className="text-white/60 leading-relaxed mb-4">Charlotte's restaurant scene has expanded dramatically over the past decade. Visitors and residents enjoy chef-driven restaurants, local breweries, international cuisine, neighborhood coffee shops, and local food markets.</p>
          <p className="text-white/60 leading-relaxed mb-4">Supporting local businesses is an important part of Charlotte's community culture.</p>
        </div>
        <FeaturedBusinesses citySlug={cs} />
        <div className="mt-4">
          <Link href={`/${cs}/directory`}>
            <Button variant="outline" className="border-white/20 text-white" data-testid="button-explore-businesses">
              Explore Local Businesses <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </Link>
        </div>
      </Section>

      <Section id="experts">
        <SectionHeading icon={Users} title="Connect with Local Experts" />
        <div className="max-w-3xl mb-6">
          <p className="text-white/60 leading-relaxed mb-4">Charlotte is home to experienced professionals across real estate, finance, healthcare, legal services, and more. Connecting with local experts can help make your transition smoother — whether you need help finding a home, understanding the school system, or navigating the job market.</p>
        </div>
        <LocalExperts citySlug={cs} />
        <div className="mt-4">
          <Link href={`/${cs}/experts`}>
            <Button variant="outline" className="border-white/20 text-white" data-testid="button-explore-experts">
              View Expert Directory <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </Link>
        </div>
      </Section>

      <Section id="events">
        <SectionHeading icon={Calendar} title="Community Events and Local Culture" />
        <div className="max-w-3xl mb-6">
          <p className="text-white/60 leading-relaxed mb-4">Charlotte's neighborhoods frequently host events that bring residents together — farmers markets, neighborhood festivals, food truck gatherings, live music events, and art walks. These events create opportunities for newcomers to connect with the community and experience local culture.</p>
        </div>
        <UpcomingEvents citySlug={cs} />
        <div className="mt-4">
          <Link href={`/${cs}/events`}>
            <Button variant="outline" className="border-white/20 text-white" data-testid="button-all-events">
              View All Events <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </Link>
        </div>
      </Section>

      <Section id="tips">
        <SectionHeading icon={Star} title="Tips for Relocating to Charlotte" />
        <div className="max-w-3xl">
          <ul className="space-y-3 text-white/60 text-sm leading-relaxed">
            <li className="flex items-start gap-3"><ChevronRight className="h-4 w-4 text-purple-400 mt-0.5 shrink-0" /> Explore neighborhoods before committing to a home.</li>
            <li className="flex items-start gap-3"><ChevronRight className="h-4 w-4 text-purple-400 mt-0.5 shrink-0" /> Attend local events to get a feel for different communities.</li>
            <li className="flex items-start gap-3"><ChevronRight className="h-4 w-4 text-purple-400 mt-0.5 shrink-0" /> Research commuting routes and traffic patterns.</li>
            <li className="flex items-start gap-3"><ChevronRight className="h-4 w-4 text-purple-400 mt-0.5 shrink-0" /> Connect with local professionals who understand the area.</li>
            <li className="flex items-start gap-3"><ChevronRight className="h-4 w-4 text-purple-400 mt-0.5 shrink-0" /> Take time to experience Charlotte beyond the downtown skyline. Many of the city's best communities are found in its neighborhoods.</li>
          </ul>
        </div>
      </Section>

      <Section id="area-guide">
        <SectionHeading icon={Building2} title="Area Guide by County" />
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <p className="text-white/60">
            {filteredCounties.length} counties, {filteredCounties.reduce((sum, g) => sum + g.hubs.length, 0)} areas across the Charlotte metro
          </p>
          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
            <Input
              placeholder="Search areas..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-white/40"
              data-testid="input-search-areas"
            />
          </div>
        </div>

        {relocationLoading ? (
          <div className="space-y-4">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-20 w-full rounded-lg bg-white/5" />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredCounties.map((group) => {
              const isExpanded = expandedCounties.has(group.code) || !!searchTerm;
              return (
                <Card key={group.code} className="overflow-hidden bg-white/5 border-white/10" data-testid={`county-card-${group.code}`}>
                  <button
                    onClick={() => toggleCounty(group.code)}
                    className="w-full flex items-center justify-between p-4 text-left"
                    data-testid={`button-toggle-${group.code}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-purple-600/20">
                        <Building2 className="w-4 h-4 text-purple-400" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-white">{group.county}</h3>
                        <p className="text-sm text-white/50">
                          {group.hubs.length} {group.hubs.length === 1 ? "area" : "areas"} · {group.state === "SC" ? "South Carolina" : "North Carolina"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs border-white/20 text-white/50">
                        {group.state}
                      </Badge>
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-white/40" /> : <ChevronDown className="w-4 h-4 text-white/40" />}
                    </div>
                  </button>
                  {isExpanded && (
                    <div className="border-t border-white/10 px-4 pb-4">
                      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-4">
                        {group.hubs.map((hub) => (
                          <Link
                            key={hub.code}
                            href={`/${cs}/neighborhoods/${hub.slug}`}
                            data-testid={`link-hub-${hub.code}`}
                          >
                            <div className="border border-white/10 rounded-lg p-3 transition-colors hover:border-purple-500/40 hover:bg-purple-500/5 cursor-pointer">
                              <div className="flex items-center gap-2 mb-1">
                                <MapPin className="w-3.5 h-3.5 text-purple-400" />
                                <span className="font-medium text-sm text-white">{hub.name}</span>
                              </div>
                              {hub.description ? (
                                <p className="text-xs text-white/50 line-clamp-2">{hub.description}</p>
                              ) : (
                                <p className="text-xs text-white/50">Explore local businesses, events, and community</p>
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
              <div className="text-center py-8 text-white/50" data-testid="text-no-results">
                No areas found matching "{searchTerm}"
              </div>
            )}
          </div>
        )}
      </Section>

      <Section id="resources">
        <SectionHeading icon={ExternalLink} title="Essential Resources for New Residents" />
        <p className="text-white/60 leading-relaxed mb-6 max-w-3xl">
          Key services and organizations you'll need when settling into the Charlotte area.
        </p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {RESOURCES.map((r) => (
            <a
              key={r.label}
              href={r.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 border border-white/10 rounded-lg p-3 transition-colors hover:border-purple-500/40 hover:bg-purple-500/5"
              data-testid={`link-resource-${r.label.replace(/\s+/g, "-").toLowerCase()}`}
            >
              <ExternalLink className="w-4 h-4 text-white/40 shrink-0" />
              <span className="text-sm font-medium text-white/70">{r.label}</span>
            </a>
          ))}
        </div>
      </Section>

      <Section id="pulse">
        <SectionHeading icon={Building2} title="Discover Charlotte Through Local Hubs" />
        <div className="max-w-3xl mb-6">
          <p className="text-white/60 leading-relaxed mb-4">Charlotte is not just a single destination — it's a collection of neighborhoods, communities, businesses, and local experiences. Exploring Charlotte through local hubs helps newcomers discover neighborhoods, restaurants, community events, local experts, and services.</p>
        </div>
        <PulsePreview citySlug={cs} />
      </Section>

      <Section id="articles">
        <h2 className="text-2xl font-bold text-white mb-6">Charlotte Relocation Guides</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {ARTICLE_LINKS.map(a => (
            <Link key={a.slug} href={`/${cs}/${a.slug}`}>
              <Card className="p-4 bg-white/5 border-white/10 hover:border-purple-500/40 transition-colors cursor-pointer h-full" data-testid={`card-article-${a.slug}`}>
                <p className="font-semibold text-white text-sm mb-1">{a.title}</p>
                <p className="text-xs text-purple-400 flex items-center gap-1">Read guide <ChevronRight className="h-3 w-3" /></p>
              </Card>
            </Link>
          ))}
        </div>
      </Section>

      <Section id="faq">
        <h2 className="text-2xl font-bold text-white mb-6">Frequently Asked Questions About Moving to Charlotte</h2>
        <div className="max-w-3xl space-y-4">
          {FAQ_DATA.map((f, i) => (
            <div key={i} className="rounded-xl bg-white/5 border border-white/10 p-5" data-testid={`faq-item-${i}`}>
              <h3 className="font-semibold text-white mb-2">{f.q}</h3>
              <p className="text-sm text-white/60 leading-relaxed">{f.a}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section id="final">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl font-bold text-white mb-4">Final Thoughts on Moving to Charlotte</h2>
          <p className="text-white/60 leading-relaxed mb-4">Charlotte continues to grow because it offers something many cities cannot — opportunity, community, and quality of life all in one place. For people considering a move, Charlotte provides the chance to build a career, raise a family, start a business, or simply enjoy a balanced lifestyle.</p>
          <p className="text-white/60 leading-relaxed mb-8">As you explore the Queen City, take time to discover the neighborhoods, meet the people who call Charlotte home, and experience the local culture that makes this city one of the most exciting places to live in the Southeast.</p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link href={`/${cs}/neighborhoods`}>
              <Button className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-8 h-12 text-base font-semibold" data-testid="button-final-neighborhoods">
                Explore Neighborhoods <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
            <Link href={`/${cs}/activate`}>
              <Button variant="outline" className="border-white/20 text-white h-12 px-8 text-base" data-testid="button-final-activate">
                Check Your Hub Presence
              </Button>
            </Link>
          </div>
        </div>
      </Section>
    </DarkPageShell>
  );
}
