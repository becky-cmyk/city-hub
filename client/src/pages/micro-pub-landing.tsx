import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { usePageMeta } from "@/hooks/use-page-meta";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapPin, ChevronDown, ChevronUp, ExternalLink, Printer } from "lucide-react";
import type { MicroPublication, MicroPubIssue, MicroPubSection, MicroPubCommunityAd, City } from "@shared/schema";

interface FullIssue extends MicroPubIssue {
  sections: MicroPubSection[];
  communityAds: MicroPubCommunityAd[];
}

interface PublicationData {
  publication: MicroPublication;
  issues: FullIssue[];
  city: City;
}

const SECTION_LABELS: Record<string, string> = {
  pets: "Pets",
  family: "Family",
  senior: "Senior Living",
  events: "Events",
  arts_entertainment: "Arts & Entertainment",
};

function trackSponsorClick(params: Record<string, string | undefined>) {
  const body = JSON.stringify(params);
  if (typeof navigator.sendBeacon === "function") {
    navigator.sendBeacon("/api/micro-pub/sponsor-click", new Blob([body], { type: "application/json" }));
  } else {
    fetch("/api/micro-pub/sponsor-click", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {});
  }
}

export default function MicroPubLanding() {
  const [, params] = useRoute("/:citySlug/pub/:pubSlug");
  const citySlug = params?.citySlug || "";
  const pubSlug = params?.pubSlug || "";
  const [printPreview, setPrintPreview] = useState(false);

  const { data, isLoading, error } = useQuery<PublicationData>({
    queryKey: ["/api/cities", citySlug, "pub", pubSlug],
    queryFn: () => apiRequest("GET", `/api/cities/${citySlug}/pub/${pubSlug}`).then(r => r.json()),
    enabled: !!citySlug && !!pubSlug,
  });

  const publication = data?.publication;
  const latestIssue = data?.issues?.[0];

  const canonicalUrl = publication
    ? `${window.location.origin}/${citySlug}/pub/${pubSlug}`
    : undefined;

  usePageMeta({
    title: publication ? `${publication.name} | CityMetroHub` : "Micro Publication",
    description: publication?.description || "Your local micro-hub community publication.",
    canonical: canonicalUrl,
    ogTitle: publication?.name || "Micro Publication",
    ogDescription: publication?.description || "Your local micro-hub community publication.",
    ogImage: publication?.coverImageUrl || latestIssue?.sections?.[0]?.storyImageUrl || undefined,
    ogUrl: canonicalUrl,
    ogType: "website",
    twitterCard: "summary_large_image",
    twitterTitle: publication?.name || "Micro Publication",
    twitterDescription: publication?.description || "Your local micro-hub community publication.",
    twitterImage: publication?.coverImageUrl || undefined,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center" data-testid="pub-loading">
        <div className="text-muted-foreground">Loading publication...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center" data-testid="pub-not-found">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Publication Not Found</h1>
          <p className="text-muted-foreground">This publication may not exist or is not yet active.</p>
        </div>
      </div>
    );
  }

  const { issues } = data;
  const archiveIssues = issues.slice(1);

  if (printPreview) {
    return (
      <PrintPreviewMode
        publication={publication!}
        issue={latestIssue!}
        onClose={() => setPrintPreview(false)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-white" data-testid="micro-pub-landing">
      <header className="border-b bg-gray-50" data-testid="pub-header">
        <div className="max-w-5xl mx-auto px-4 py-8 text-center">
          {publication!.coverImageUrl && (
            <img
              src={publication!.coverImageUrl}
              alt={publication!.name}
              className="h-16 mx-auto mb-4 object-contain"
              data-testid="img-pub-logo"
            />
          )}
          <h1 className="text-3xl font-bold tracking-tight" data-testid="text-pub-name">
            {publication!.name}
          </h1>
          {publication!.description && (
            <p className="text-muted-foreground mt-2 max-w-xl mx-auto" data-testid="text-pub-desc">
              {publication!.description}
            </p>
          )}
          {latestIssue && (
            <Button
              variant="outline"
              size="sm"
              className="mt-4 gap-1.5"
              onClick={() => setPrintPreview(true)}
              data-testid="button-print-preview"
            >
              <Printer className="h-4 w-4" />
              Print Preview
            </Button>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        {!latestIssue ? (
          <div className="text-center py-16" data-testid="pub-no-issues">
            <p className="text-lg text-muted-foreground">No published issues yet. Check back soon.</p>
          </div>
        ) : (
          <>
            <IssueRenderer issue={latestIssue} isLatest />

            {archiveIssues.length > 0 && (
              <div className="mt-12 border-t pt-8" data-testid="archive-section">
                <h2 className="text-xl font-semibold mb-4">Previous Issues</h2>
                <div className="space-y-3">
                  {archiveIssues.map(issue => (
                    <ArchiveIssueCard key={issue.id} issue={issue} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </main>

      <footer className="border-t bg-gray-50 py-6 text-center text-sm text-muted-foreground" data-testid="pub-footer">
        Powered by CityMetroHub
      </footer>
    </div>
  );
}

function IssueRenderer({ issue, isLatest }: { issue: FullIssue; isLatest?: boolean }) {
  const frontSections = issue.sections.filter(s => s.position.startsWith("front"));
  const backSections = issue.sections.filter(s => s.position.startsWith("back"));
  const pickups = Array.isArray(issue.pickupLocations) ? issue.pickupLocations as Array<{ name: string; address: string }> : [];

  return (
    <div data-testid={`issue-${issue.id}`}>
      <div className="flex items-center justify-between mb-6">
        <div>
          {isLatest && (
            <Badge className="mb-2">Latest Issue</Badge>
          )}
          <h2 className="text-2xl font-bold" data-testid={`text-issue-title-${issue.id}`}>
            {issue.title}
          </h2>
          {issue.publishDate && (
            <p className="text-sm text-muted-foreground mt-1">
              Published {new Date(issue.publishDate).toLocaleDateString("en-US", {
                year: "numeric", month: "long", day: "numeric",
              })}
            </p>
          )}
        </div>
      </div>

      {frontSections.length > 0 && (
        <div className="space-y-6 mb-8" data-testid="front-sections">
          {frontSections.map(section => (
            <SectionDisplay key={section.id} section={section} />
          ))}
        </div>
      )}

      {issue.communityAds.length > 0 && (
        <div className="my-8" data-testid="community-ads-row">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {issue.communityAds.map(ad => (
              <CommunityAdDisplay key={ad.id} ad={ad} />
            ))}
          </div>
        </div>
      )}

      {backSections.length > 0 && (
        <div className="space-y-6 mb-8" data-testid="back-sections">
          {backSections.map(section => (
            <SectionDisplay key={section.id} section={section} />
          ))}
        </div>
      )}

      {pickups.length > 0 && (
        <div className="bg-gray-50 rounded-lg p-4 mt-8" data-testid="pickup-strip">
          <div className="flex items-center gap-2 mb-3">
            <MapPin className="h-4 w-4" />
            <span className="font-medium text-sm">Find Us At</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
            {pickups.map((loc, i) => (
              <div key={i} className="text-sm" data-testid={`pickup-location-${i}`}>
                <span className="font-medium">{loc.name}</span>
                {loc.address && <span className="text-muted-foreground"> &middot; {loc.address}</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SectionDisplay({ section }: { section: MicroPubSection }) {
  if (!section.storyTitle && !section.storyBody && !section.sponsorName) return null;

  const handleSponsorClick = () => {
    trackSponsorClick({
      sectionId: section.id,
      sponsorName: section.sponsorName || undefined,
      sponsorLink: section.sponsorLink || undefined,
    });
  };

  return (
    <div
      className="grid grid-cols-1 md:grid-cols-[1fr_280px] gap-6 border rounded-lg p-5"
      data-testid={`section-display-${section.id}`}
    >
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Badge variant="outline">
            {SECTION_LABELS[section.sectionType] || section.sectionType}
          </Badge>
          {section.nonprofitName && (
            <span className="text-sm text-muted-foreground">
              {section.nonprofitUrl ? (
                <a
                  href={section.nonprofitUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline"
                  data-testid={`link-nonprofit-${section.id}`}
                >
                  {section.nonprofitName}
                </a>
              ) : section.nonprofitName}
            </span>
          )}
        </div>

        {section.storyTitle && (
          <h3 className="text-lg font-semibold mb-2" data-testid={`text-section-title-${section.id}`}>
            {section.storyTitle}
          </h3>
        )}

        {section.storyImageUrl && (
          <img
            src={section.storyImageUrl}
            alt={section.storyTitle || ""}
            className="w-full rounded-md mb-3 max-h-64 object-cover"
            data-testid={`img-section-story-${section.id}`}
          />
        )}

        {section.storyBody && (
          <div
            className="text-sm leading-relaxed text-gray-700 whitespace-pre-line"
            data-testid={`text-section-body-${section.id}`}
          >
            {section.storyBody}
          </div>
        )}
      </div>

      {section.sponsorName && (
        <div className="flex flex-col items-center justify-start border-l pl-4 md:pl-6" data-testid={`sponsor-${section.id}`}>
          {section.sponsorLabel && (
            <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
              {section.sponsorLabel}
            </p>
          )}
          {section.sponsorImageUrl ? (
            <a
              href={section.sponsorLink || "#"}
              target="_blank"
              rel="noopener noreferrer"
              className="block"
              onClick={handleSponsorClick}
              data-testid={`link-sponsor-${section.id}`}
            >
              <img
                src={section.sponsorImageUrl}
                alt={section.sponsorName}
                className="max-w-[240px] rounded-md"
              />
            </a>
          ) : (
            <div className="bg-gray-100 rounded-md p-4 text-center w-full max-w-[240px]">
              <p className="font-medium text-sm">{section.sponsorName}</p>
            </div>
          )}
          <p className="text-xs text-muted-foreground mt-2">{section.sponsorName}</p>
          {section.sponsorLink && (
            <a
              href={section.sponsorLink}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs mt-1 flex items-center gap-1 hover:underline"
              onClick={handleSponsorClick}
              data-testid={`link-sponsor-url-${section.id}`}
            >
              Visit <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      )}
    </div>
  );
}

function CommunityAdDisplay({ ad }: { ad: MicroPubCommunityAd }) {
  const handleAdClick = () => {
    trackSponsorClick({
      adId: ad.id,
      adBusinessName: ad.businessName || undefined,
    });
  };

  const content = (
    <Card className="overflow-hidden" data-testid={`community-ad-${ad.id}`}>
      <CardContent className="p-0">
        {ad.imageUrl ? (
          <img src={ad.imageUrl} alt={ad.businessName || ""} className="w-full h-40 object-cover" />
        ) : (
          <div className="w-full h-40 bg-gray-100 flex items-center justify-center">
            <span className="text-sm text-muted-foreground">{ad.businessName || "Ad Space"}</span>
          </div>
        )}
        {ad.businessName && (
          <div className="px-3 py-2 text-center">
            <p className="text-sm font-medium">{ad.businessName}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );

  if (ad.link) {
    return (
      <a href={ad.link} target="_blank" rel="noopener noreferrer" onClick={handleAdClick} data-testid={`link-ad-${ad.id}`}>
        {content}
      </a>
    );
  }
  return content;
}

function ArchiveIssueCard({ issue }: { issue: FullIssue }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div data-testid={`archive-issue-${issue.id}`}>
      <Card
        className="cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <CardContent className="py-3 flex items-center justify-between">
          <div>
            <span className="font-medium">#{issue.issueNumber}: {issue.title}</span>
            {issue.publishDate && (
              <span className="text-sm text-muted-foreground ml-3">
                {new Date(issue.publishDate).toLocaleDateString("en-US", {
                  year: "numeric", month: "short", day: "numeric",
                })}
              </span>
            )}
          </div>
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </CardContent>
      </Card>
      {expanded && (
        <div className="mt-4 mb-6">
          <IssueRenderer issue={issue} />
        </div>
      )}
    </div>
  );
}

function PrintPreviewMode({ publication, issue, onClose }: {
  publication: MicroPublication;
  issue: FullIssue;
  onClose: () => void;
}) {
  const frontSections = issue.sections.filter(s => s.position.startsWith("front"));
  const backSections = issue.sections.filter(s => s.position.startsWith("back"));
  const pickups = Array.isArray(issue.pickupLocations) ? issue.pickupLocations as Array<{ name: string; address: string }> : [];

  useEffect(() => {
    document.body.style.overflow = "auto";
    return () => { document.body.style.overflow = ""; };
  }, []);

  const pageStyle: React.CSSProperties = {
    width: "8.5in",
    height: "14in",
    margin: "0 auto",
    padding: "0.5in",
    background: "white",
    color: "black",
    fontFamily: "Georgia, 'Times New Roman', serif",
    fontSize: "11pt",
    lineHeight: "1.4",
    boxSizing: "border-box",
    overflow: "hidden",
    position: "relative",
  };

  return (
    <div className="min-h-screen bg-gray-400 py-8 print:bg-white print:py-0" data-testid="print-preview">
      <div className="fixed top-4 right-4 z-50 flex gap-2 print:hidden">
        <Button size="sm" onClick={() => window.print()} data-testid="button-print">
          <Printer className="h-4 w-4 mr-1" /> Print
        </Button>
        <Button variant="outline" size="sm" onClick={onClose} data-testid="button-exit-print-preview">
          Exit Preview
        </Button>
      </div>

      <div style={pageStyle} className="shadow-2xl print:shadow-none" data-testid="print-page-front">
        <div style={{ textAlign: "center", borderBottom: "2pt solid black", paddingBottom: "0.25in", marginBottom: "0.3in" }}>
          {publication.coverImageUrl && (
            <img src={publication.coverImageUrl} alt="" style={{ height: "48px", margin: "0 auto 8px" }} />
          )}
          <h1 style={{ fontSize: "22pt", fontWeight: "bold", margin: 0 }}>{publication.name}</h1>
          {publication.description && (
            <p style={{ fontSize: "9pt", color: "#666", margin: "4px 0 0" }}>{publication.description}</p>
          )}
          <p style={{ fontSize: "8pt", color: "#999", margin: "4px 0 0" }}>
            Issue #{issue.issueNumber}
            {issue.publishDate && ` | ${new Date(issue.publishDate).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`}
          </p>
        </div>

        {frontSections.map(section => (
          <PrintSection key={section.id} section={section} />
        ))}

        {issue.communityAds.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(issue.communityAds.length, 3)}, 1fr)`, gap: "0.15in", margin: "0.3in 0", borderTop: "1px solid #ccc", borderBottom: "1px solid #ccc", padding: "0.15in 0" }}>
            {issue.communityAds.map(ad => (
              <div key={ad.id} style={{ textAlign: "center" }}>
                {ad.imageUrl && <img src={ad.imageUrl} alt="" style={{ width: "100%", height: "80px", objectFit: "cover", borderRadius: "4px" }} />}
                {ad.businessName && <p style={{ fontSize: "8pt", fontWeight: "bold", margin: "4px 0 0" }}>{ad.businessName}</p>}
              </div>
            ))}
          </div>
        )}

        {backSections.map(section => (
          <PrintSection key={section.id} section={section} />
        ))}

        {pickups.length > 0 && (
          <div style={{ marginTop: "0.3in", borderTop: "1px solid #ccc", paddingTop: "0.15in" }}>
            <p style={{ fontSize: "9pt", fontWeight: "bold", marginBottom: "4px" }}>Find Us At:</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "4px" }}>
              {pickups.map((loc, i) => (
                <span key={i} style={{ fontSize: "7pt" }}>{loc.name}{loc.address ? ` - ${loc.address}` : ""}</span>
              ))}
            </div>
          </div>
        )}

        <div style={{ textAlign: "center", marginTop: "0.3in", fontSize: "7pt", color: "#aaa", borderTop: "1px solid #eee", paddingTop: "0.1in" }}>
          Powered by CityMetroHub
        </div>
      </div>
    </div>
  );
}

function PrintSection({ section }: { section: MicroPubSection }) {
  if (!section.storyTitle && !section.storyBody && !section.sponsorName) return null;

  return (
    <div style={{ display: "grid", gridTemplateColumns: section.sponsorName ? "1fr 200px" : "1fr", gap: "0.2in", marginBottom: "0.25in", paddingBottom: "0.2in", borderBottom: "1px solid #eee" }}>
      <div>
        <p style={{ fontSize: "7pt", textTransform: "uppercase", letterSpacing: "1px", color: "#888", marginBottom: "4px" }}>
          {SECTION_LABELS[section.sectionType] || section.sectionType}
          {section.nonprofitName ? ` | ${section.nonprofitName}` : ""}
        </p>
        {section.storyTitle && (
          <h3 style={{ fontSize: "13pt", fontWeight: "bold", margin: "0 0 6px" }}>{section.storyTitle}</h3>
        )}
        {section.storyImageUrl && (
          <img src={section.storyImageUrl} alt="" style={{ width: "100%", maxHeight: "120px", objectFit: "cover", borderRadius: "4px", marginBottom: "6px" }} />
        )}
        {section.storyBody && (
          <p style={{ fontSize: "9pt", color: "#333", whiteSpace: "pre-line" }}>{section.storyBody}</p>
        )}
      </div>
      {section.sponsorName && (
        <div style={{ borderLeft: "1px solid #ddd", paddingLeft: "0.15in", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-start" }}>
          {section.sponsorLabel && (
            <p style={{ fontSize: "6pt", textTransform: "uppercase", letterSpacing: "1px", color: "#aaa", marginBottom: "6px" }}>{section.sponsorLabel}</p>
          )}
          {section.sponsorImageUrl ? (
            <img src={section.sponsorImageUrl} alt={section.sponsorName} style={{ maxWidth: "180px", borderRadius: "4px" }} />
          ) : (
            <div style={{ background: "#f5f5f5", borderRadius: "4px", padding: "12px", textAlign: "center", width: "100%" }}>
              <p style={{ fontSize: "9pt", fontWeight: "bold" }}>{section.sponsorName}</p>
            </div>
          )}
          <p style={{ fontSize: "7pt", color: "#888", marginTop: "4px" }}>{section.sponsorName}</p>
        </div>
      )}
    </div>
  );
}
