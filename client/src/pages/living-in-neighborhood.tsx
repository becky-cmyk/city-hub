import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "wouter";
import { DarkPageShell } from "@/components/dark-page-shell";
import { usePageMeta } from "@/hooks/use-page-meta";
import { JsonLd } from "@/components/json-ld";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  MapPin, ChevronRight, ArrowRight, Calendar, Building2, Users
} from "lucide-react";

const CHARLOTTE_CITY_ID = "b0d970f5-cfd6-475b-8739-cfd5352094c4";

interface NeighborhoodConfig {
  name: string;
  slug: string;
  hubCode: string;
  metaTitle: string;
  metaDescription: string;
  keywords: string;
  intro: string;
  lifestyle: string;
  housing: string;
  dining: string;
  community: string;
  transportation: string;
  idealFor: string[];
  faqs: { q: string; a: string }[];
}

function NeighborhoodBusinesses({ citySlug, hubCode }: { citySlug: string; hubCode: string }) {
  const { data, isLoading } = useQuery<any[]>({
    queryKey: ["/api/cities", citySlug, "businesses", "hub", hubCode],
    queryFn: async () => {
      const res = await fetch(`/api/cities/${citySlug}/businesses?zone=${hubCode}&limit=6`);
      if (!res.ok) return [];
      const json = await res.json();
      return Array.isArray(json) ? json : json.businesses || [];
    },
  });

  if (isLoading) return <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}</div>;
  if (!data || data.length === 0) return null;

  return (
    <div className="grid sm:grid-cols-2 gap-3">
      {data.slice(0, 6).map((biz: any) => (
        <Link key={biz.id} href={`/${citySlug}/directory/${biz.slug}`}>
          <Card className="p-3 bg-white/5 border-white/10 hover:border-purple-500/40 transition-colors cursor-pointer" data-testid={`card-biz-${biz.id}`}>
            <div className="flex items-start gap-3">
              <Building2 className="h-4 w-4 text-purple-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-white line-clamp-1">{biz.name}</p>
                {biz.categoryName && <p className="text-xs text-white/50">{biz.categoryName}</p>}
              </div>
            </div>
          </Card>
        </Link>
      ))}
    </div>
  );
}

function NeighborhoodEvents({ citySlug, hubCode }: { citySlug: string; hubCode: string }) {
  const { data } = useQuery<any[]>({
    queryKey: ["/api/cities", citySlug, "events", "hub", hubCode],
    queryFn: async () => {
      const res = await fetch(`/api/cities/${citySlug}/events?zone=${hubCode}&limit=4`);
      if (!res.ok) return [];
      return res.json();
    },
  });

  if (!data || data.length === 0) return null;

  return (
    <div className="grid sm:grid-cols-2 gap-3">
      {data.slice(0, 4).map((evt: any) => (
        <Link key={evt.id} href={`/${citySlug}/events/${evt.slug}`}>
          <Card className="p-3 bg-white/5 border-white/10 hover:border-purple-500/40 transition-colors cursor-pointer" data-testid={`card-event-${evt.id}`}>
            <div className="flex items-start gap-3">
              <Calendar className="h-4 w-4 text-purple-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-white line-clamp-1">{evt.name || evt.title}</p>
                {evt.startDate && <p className="text-xs text-white/50">{new Date(evt.startDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</p>}
              </div>
            </div>
          </Card>
        </Link>
      ))}
    </div>
  );
}

export default function LivingInNeighborhood({ config }: { config: NeighborhoodConfig }) {
  const { citySlug } = useParams<{ citySlug: string }>();
  const cs = citySlug || "charlotte";

  usePageMeta({
    title: config.metaTitle,
    description: config.metaDescription,
    canonical: `${window.location.origin}/${cs}/${config.slug}`,
    ogTitle: config.metaTitle,
    ogDescription: config.metaDescription,
    ogUrl: `${window.location.origin}/${cs}/${config.slug}`,
    ogType: "article",
    keywords: config.keywords,
  });

  return (
    <DarkPageShell maxWidth="wide">
      <JsonLd data={{
        "@context": "https://schema.org",
        "@type": "Article",
        headline: config.metaTitle,
        description: config.metaDescription,
        author: { "@type": "Organization", name: "CLT Hub" },
        publisher: { "@type": "Organization", name: "CLT Hub" },
        mainEntityOfPage: `${window.location.origin}/${cs}/${config.slug}`,
      }} />
      {config.faqs.length > 0 && (
        <JsonLd data={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: config.faqs.map(f => ({
            "@type": "Question",
            name: f.q,
            acceptedAnswer: { "@type": "Answer", text: f.a },
          })),
        }} />
      )}

      <div className="py-6 border-b border-white/5">
        <Link href={`/${cs}/moving-to-charlotte`}>
          <span className="text-sm text-purple-400 hover:underline inline-flex items-center gap-1" data-testid="link-back-pillar">
            Moving to Charlotte Guide <ChevronRight className="h-3 w-3" />
          </span>
        </Link>
      </div>

      <article className="py-10 md:py-14">
        <Badge className="mb-4 bg-purple-600/20 text-purple-300 border-purple-500/30">NEIGHBORHOOD GUIDE</Badge>
        <h1 className="text-3xl md:text-4xl font-bold text-white leading-tight tracking-tight mb-4" data-testid="text-neighborhood-title">
          Living in {config.name}, Charlotte
        </h1>
        <p className="text-lg text-white/70 leading-relaxed mb-10 max-w-3xl">{config.intro}</p>

        <div className="max-w-3xl space-y-10">
          <div>
            <h2 className="text-2xl font-bold text-white mb-3">Lifestyle in {config.name}</h2>
            <p className="text-white/60 leading-relaxed">{config.lifestyle}</p>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-white mb-3">Housing in {config.name}</h2>
            <p className="text-white/60 leading-relaxed">{config.housing}</p>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-white mb-3">Dining and Local Businesses</h2>
            <p className="text-white/60 leading-relaxed mb-4">{config.dining}</p>
            <NeighborhoodBusinesses citySlug={cs} hubCode={config.hubCode} />
            <div className="mt-3">
              <Link href={`/${cs}/neighborhoods/${config.hubCode}`}>
                <span className="text-purple-400 text-sm inline-flex items-center gap-1 hover:underline">View all businesses in {config.name} <ChevronRight className="h-3 w-3" /></span>
              </Link>
            </div>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-white mb-3">Community and Events</h2>
            <p className="text-white/60 leading-relaxed mb-4">{config.community}</p>
            <NeighborhoodEvents citySlug={cs} hubCode={config.hubCode} />
          </div>

          <div>
            <h2 className="text-2xl font-bold text-white mb-3">Getting Around</h2>
            <p className="text-white/60 leading-relaxed">{config.transportation}</p>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-white mb-3">Who Is {config.name} Ideal For?</h2>
            <ul className="space-y-2">
              {config.idealFor.map((item, i) => (
                <li key={i} className="flex items-start gap-3 text-white/60 text-sm">
                  <ChevronRight className="h-4 w-4 text-purple-400 mt-0.5 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </article>

      {config.faqs.length > 0 && (
        <section className="py-10 border-t border-white/5">
          <h2 className="text-2xl font-bold text-white mb-6">Frequently Asked Questions About {config.name}</h2>
          <div className="max-w-3xl space-y-4">
            {config.faqs.map((f, i) => (
              <div key={i} className="rounded-xl bg-white/5 border border-white/10 p-5" data-testid={`faq-item-${i}`}>
                <h3 className="font-semibold text-white mb-2">{f.q}</h3>
                <p className="text-sm text-white/60 leading-relaxed">{f.a}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="py-10 border-t border-white/5">
        <div className="flex flex-wrap gap-3">
          <Link href={`/${cs}/neighborhoods/${config.hubCode}`}>
            <Button className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white" data-testid="button-hub-page">
              Explore {config.name} Hub <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </Link>
          <Link href={`/${cs}/moving-to-charlotte`}>
            <Button variant="outline" className="border-white/20 text-white" data-testid="button-back-guide">
              Moving to Charlotte Guide <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </Link>
          <Link href={`/${cs}/best-neighborhoods-in-charlotte`}>
            <Button variant="outline" className="border-white/20 text-white" data-testid="button-best-neighborhoods">
              Best Neighborhoods Guide <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </Link>
        </div>
      </section>
    </DarkPageShell>
  );
}
