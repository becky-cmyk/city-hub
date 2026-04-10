import { Link, useParams } from "wouter";
import { DarkPageShell } from "@/components/dark-page-shell";
import { usePageMeta } from "@/hooks/use-page-meta";
import { JsonLd } from "@/components/json-ld";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronRight, ArrowRight, MapPin } from "lucide-react";

interface FAQ { q: string; a: string; }

interface RelocationArticleProps {
  title: string;
  metaTitle: string;
  metaDescription: string;
  slug: string;
  keywords: string;
  children: React.ReactNode;
  faqs: FAQ[];
}

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

export default function RelocationArticleLayout({ title, metaTitle, metaDescription, slug, keywords, children, faqs }: RelocationArticleProps) {
  const { citySlug } = useParams<{ citySlug: string }>();
  const cs = citySlug || "charlotte";

  usePageMeta({
    title: metaTitle,
    description: metaDescription,
    canonical: `${window.location.origin}/${cs}/${slug}`,
    ogTitle: metaTitle,
    ogDescription: metaDescription,
    ogUrl: `${window.location.origin}/${cs}/${slug}`,
    ogType: "article",
    keywords,
  });

  return (
    <DarkPageShell maxWidth="wide">
      <JsonLd data={{
        "@context": "https://schema.org",
        "@type": "Article",
        headline: metaTitle,
        description: metaDescription,
        author: { "@type": "Organization", name: "CLT Hub" },
        publisher: { "@type": "Organization", name: "CLT Hub" },
        mainEntityOfPage: `${window.location.origin}/${cs}/${slug}`,
      }} />
      {faqs.length > 0 && (
        <JsonLd data={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: faqs.map(f => ({
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
        <Badge className="mb-4 bg-purple-600/20 text-purple-300 border-purple-500/30">RELOCATION GUIDE</Badge>
        <h1 className="text-3xl md:text-4xl font-bold text-white leading-tight tracking-tight mb-8" data-testid="text-article-title">{title}</h1>
        <div className="prose-invert max-w-3xl space-y-6 text-white/60 leading-relaxed [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:text-white [&_h2]:mt-10 [&_h2]:mb-4 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-white [&_h3]:mt-6 [&_h3]:mb-3 [&_ul]:space-y-2 [&_ul]:pl-4 [&_li]:text-white/60 [&_li]:text-sm">
          {children}
        </div>
      </article>

      {faqs.length > 0 && (
        <section className="py-10 border-t border-white/5">
          <h2 className="text-2xl font-bold text-white mb-6">Frequently Asked Questions</h2>
          <div className="max-w-3xl space-y-4">
            {faqs.map((f, i) => (
              <div key={i} className="rounded-xl bg-white/5 border border-white/10 p-5" data-testid={`faq-item-${i}`}>
                <h3 className="font-semibold text-white mb-2">{f.q}</h3>
                <p className="text-sm text-white/60 leading-relaxed">{f.a}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="py-10 border-t border-white/5">
        <h2 className="text-xl font-bold text-white mb-4">Explore Charlotte Neighborhoods</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          {NEIGHBORHOOD_LINKS.map(n => (
            <Link key={n.slug} href={`/${cs}/${n.slug}`}>
              <Card className="p-3 bg-white/5 border-white/10 hover:border-purple-500/40 transition-colors cursor-pointer" data-testid={`card-nav-${n.slug}`}>
                <div className="flex items-center gap-2">
                  <MapPin className="h-3 w-3 text-purple-400 shrink-0" />
                  <span className="text-sm text-white font-medium">{n.name}</span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
        <h3 className="text-sm font-semibold text-white/70 mb-3 mt-6">Neighborhood Hub Pages</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-6">
          {NEIGHBORHOOD_LINKS.map(n => (
            <Link key={n.hubCode} href={`/${cs}/neighborhoods/${n.hubCode}`}>
              <span className="text-xs text-purple-400 hover:underline inline-flex items-center gap-1" data-testid={`link-hub-${n.hubCode}`}>
                {n.name} Hub <ChevronRight className="h-3 w-3" />
              </span>
            </Link>
          ))}
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href={`/${cs}/moving-to-charlotte`}>
            <Button className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white" data-testid="button-back-pillar">
              Moving to Charlotte Guide <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </Link>
          <Link href={`/${cs}/neighborhoods`}>
            <Button variant="outline" className="border-white/20 text-white" data-testid="button-all-neighborhoods">
              All 74+ Neighborhoods <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </Link>
        </div>
      </section>
    </DarkPageShell>
  );
}
