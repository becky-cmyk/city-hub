import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Briefcase, MapPin, DollarSign, ArrowRight, Star, TrendingUp, Sparkles, Building2 } from "lucide-react";
import { usePageMeta } from "@/hooks/use-page-meta";
import { JsonLd } from "@/components/json-ld";
import { LandingPageShell } from "@/components/landing-page-shell";
import { getCityBranding, getBrandForContext } from "@shared/city-branding";

export default function JobsLanding({ citySlug }: { citySlug: string }) {
  const { data, isLoading } = useQuery<{ jobs: any[]; total: number }>({
    queryKey: [`/api/cities/${citySlug}/jobs?page=1&pageSize=6`],
  });

  const cityName = citySlug.charAt(0).toUpperCase() + citySlug.slice(1);
  const jobs = data?.jobs || [];
  const total = data?.total || 0;
  const branding = getCityBranding(citySlug);
  const brand = branding ? getBrandForContext(branding, "landing") : null;

  usePageMeta({
    title: `Jobs in ${cityName} — Local Career Opportunities ${brand?.titleSuffix || "| CLT Hub"}`,
    description: `Browse ${total || ""} job openings in the ${cityName} metro area on ${brand?.descriptionBrand || "CLT Hub"}. Find full-time, part-time, remote, and local career opportunities across all industries.`,
    canonical: `${window.location.origin}/${citySlug}/jobs`,
    ogType: "website",
    ogSiteName: brand?.ogSiteName,
    ogTitle: `Jobs in ${cityName} — Find Local Career Opportunities`,
    ogDescription: `Discover job openings in ${cityName}. Full-time, part-time, remote, and hybrid positions across the metro.`,
    keywords: `${cityName} jobs, CLT Hub jobs, careers ${cityName}, job openings ${cityName}, employment ${cityName}, hiring ${cityName}`,
  });

  return (
    <LandingPageShell citySlug={citySlug}>
      <JsonLd data={{
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: `Jobs in ${cityName}`,
        description: `Job openings and career opportunities in the ${cityName} metro area.`,
        url: `${window.location.origin}/${citySlug}/jobs`,
        isPartOf: { "@type": "WebSite", name: brand?.jsonLdName || "CLT Hub", alternateName: branding?.brandVariants || [], ...(brand?.sameAs && brand.sameAs.length > 0 && { sameAs: brand.sameAs }) },
      }} />
      <JsonLd data={{
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: [
          { "@type": "Question", name: `How do I find jobs on CLT Hub?`, acceptedAnswer: { "@type": "Answer", text: `CLT Hub (also known as CLT Metro Hub, Charlotte City Hub, CLT City Hub, and Charlotte Metro Hub) features local job openings across all industries in the ${cityName} metro area. Browse by category, neighborhood, or use the search to find full-time, part-time, remote, and hybrid positions.` } },
          { "@type": "Question", name: `What types of jobs are listed on CLT Hub?`, acceptedAnswer: { "@type": "Answer", text: `CLT Hub lists career opportunities across healthcare, technology, finance, hospitality, education, construction, and more throughout the ${cityName} metro. Listings include full-time, part-time, contract, and remote positions from local employers.` } },
        ],
      }} />

      <section className="max-w-6xl mx-auto px-4 pt-12 pb-8 text-center" data-testid="section-jobs-hero">
        <Badge className="mb-4 bg-blue-600/20 text-blue-300 border-blue-500/30">LOCAL CAREERS</Badge>
        <h1 className="text-3xl md:text-5xl font-bold text-white mb-4" data-testid="text-jobs-landing-title">
          Jobs in {cityName}
        </h1>
        <p className="text-lg text-white/60 max-w-2xl mx-auto mb-8">
          {total
            ? `${total}+ open positions across the ${cityName} metro. Full-time, part-time, remote, and hybrid opportunities.`
            : `Find local career opportunities across the ${cityName} metro area.`}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link href={`/${citySlug}/jobs/browse`}>
            <Button className="bg-gradient-to-r from-blue-600 to-cyan-600 text-white px-8 h-12 text-base font-semibold" data-testid="button-browse-jobs">
              Browse All Jobs <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </Link>
          <Link href={`/${citySlug}/employer/jobs`}>
            <Button variant="outline" className="border-white/20 text-white h-12 px-6" data-testid="button-post-job">
              <Building2 className="h-4 w-4 mr-2" /> Post a Job
            </Button>
          </Link>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 py-8 grid grid-cols-1 md:grid-cols-3 gap-5" data-testid="section-highlights">
        {[
          { icon: Star, title: "Local Employers", desc: "Positions from Charlotte's top employers — banking, tech, healthcare, hospitality, and more." },
          { icon: TrendingUp, title: "Growing Job Market", desc: "Charlotte is one of the fastest-growing metro areas with strong demand across industries." },
          { icon: Sparkles, title: "Easy Apply", desc: "Submit applications directly through the platform. Save searches and set up job alerts." },
        ].map((h, i) => (
          <Card key={i} className="bg-white/5 border-white/10" data-testid={`card-highlight-${i}`}>
            <CardContent className="p-5">
              <div className="flex items-center gap-2.5 mb-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/20">
                  <h.icon className="h-4 w-4 text-blue-400" />
                </div>
                <h3 className="font-semibold text-white text-sm">{h.title}</h3>
              </div>
              <p className="text-white/60 text-sm leading-relaxed">{h.desc}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      {isLoading ? (
        <div className="max-w-6xl mx-auto px-4 py-8 space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 bg-white/10 rounded-xl" />)}
        </div>
      ) : jobs.length > 0 && (
        <section className="max-w-6xl mx-auto px-4 py-8" data-testid="section-featured-jobs">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Briefcase className="h-5 w-5 text-blue-400" /> Recent Openings
            </h2>
            <Link href={`/${citySlug}/jobs/browse`}>
              <Button variant="ghost" size="sm" className="text-white/60 hover:text-white gap-1" data-testid="link-view-all-jobs">
                View All <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
          <div className="space-y-3">
            {jobs.slice(0, 6).map((job: any) => (
              <Link key={job.id} href={`/${citySlug}/jobs/browse`}>
                <div className="rounded-xl bg-white/5 border border-white/10 p-4 cursor-pointer hover:border-blue-500/30 transition-colors" data-testid={`card-job-${job.id}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-sm text-white">{job.title}</h3>
                      {job.employer && (
                        <div className="flex items-center gap-1.5 text-xs text-white/50 mt-1">
                          <Building2 className="h-3 w-3" /> {job.employer}
                        </div>
                      )}
                      <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                        {job.locationText && (
                          <span className="flex items-center gap-1 text-xs text-white/40">
                            <MapPin className="h-3 w-3" /> {job.locationText}
                          </span>
                        )}
                        {job.employmentType && (
                          <Badge variant="outline" className="text-xs border-white/10 text-white/50">{job.employmentType}</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="max-w-6xl mx-auto px-4 py-12 text-center" data-testid="section-cta">
        <div className="rounded-2xl bg-gradient-to-r from-blue-900/50 to-cyan-900/50 border border-white/10 p-8 md:p-12">
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-3">Find Your Next Opportunity</h2>
          <p className="text-white/60 mb-6 max-w-xl mx-auto">
            Search by keyword, filter by type, location, and industry. Set up alerts to get notified about new openings.
          </p>
          <Link href={`/${citySlug}/jobs/browse`}>
            <Button className="bg-blue-600 hover:bg-blue-700 text-white px-8 h-12 text-base font-semibold" data-testid="button-explore-jobs-cta">
              Search All Jobs <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </Link>
        </div>
      </section>
    </LandingPageShell>
  );
}
