import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "wouter";
import { usePageMeta } from "@/hooks/use-page-meta";
import { DarkPageShell } from "@/components/dark-page-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Award,
  Search,
  MessageCircle,
  ArrowRight,
  Users,
  Star,
} from "lucide-react";

interface ExpertListing {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  categoryIds: string[] | null;
  zoneId: string | null;
  listingTier: string;
  featured: boolean;
  badgeMeta: {
    credentials?: string[];
    topics?: { topic: string; description?: string; quoteReady?: boolean }[];
    headline?: string;
    featured?: boolean;
  };
}

function ExpertCard({ expert, citySlug, isFeatured }: { expert: ExpertListing; citySlug: string; isFeatured?: boolean }) {
  return (
    <Card
      data-testid={`card-expert-${expert.id}`}
      className={`bg-gray-900 overflow-hidden ${isFeatured ? "border-amber-500/60 border-2" : "border-gray-800"}`}
    >
      <div className="flex gap-4 p-5">
        <div className="shrink-0">
          {expert.imageUrl ? (
            <img
              src={expert.imageUrl}
              alt={expert.name}
              className="w-20 h-20 rounded-lg object-cover"
            />
          ) : (
            <div className="w-20 h-20 rounded-lg bg-gray-800 flex items-center justify-center">
              <Award className="w-8 h-8 text-amber-400" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <h3 className="text-lg font-semibold text-white truncate">
              {expert.name}
            </h3>
            <div className="flex items-center gap-1.5 shrink-0">
              {isFeatured && (
                <Badge className="bg-amber-500 text-black text-xs flex items-center gap-1">
                  <Star className="w-3 h-3" />
                  Featured
                </Badge>
              )}
              <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-xs">
                Local Expert
              </Badge>
            </div>
          </div>
          {expert.badgeMeta?.headline && (
            <p className="text-sm text-amber-400 mb-1">{expert.badgeMeta.headline}</p>
          )}
          {expert.description && (
            <p className="text-sm text-gray-400 line-clamp-2 mb-2">
              {expert.description}
            </p>
          )}
          {expert.badgeMeta?.credentials && expert.badgeMeta.credentials.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {expert.badgeMeta.credentials.map((cred, i) => (
                <Badge
                  key={i}
                  variant="outline"
                  className="border-gray-700 text-gray-300 text-xs"
                >
                  {cred}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>
      {expert.badgeMeta?.topics && expert.badgeMeta.topics.length > 0 && (
        <div className="px-5 pb-3">
          <div className="flex flex-wrap gap-2">
            {expert.badgeMeta.topics.map((t, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <Badge
                  variant="outline"
                  className="border-gray-700 text-gray-400 text-xs"
                >
                  {t.topic}
                </Badge>
                {t.quoteReady && (
                  <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs flex items-center gap-1">
                    <MessageCircle className="w-3 h-3" />
                    Available for Quotes
                  </Badge>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="px-5 pb-4">
        <a
          href={`/${citySlug}/directory/${expert.slug}`}
          data-testid={`link-expert-profile-${expert.id}`}
        >
          <Button
            variant="ghost"
            className="text-amber-400 p-0 h-auto text-sm"
          >
            View Full Profile
            <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </a>
      </div>
    </Card>
  );
}

export default function ExpertDirectory() {
  const { citySlug } = useParams<{ citySlug: string }>();
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTopic, setActiveTopic] = useState<string | null>(null);

  usePageMeta({
    title: "Local Experts | Charlotte Hub",
    description: "Find trusted local experts in Charlotte for quotes, consulting, and community guidance.",
  });

  const { data: experts = [], isLoading } = useQuery<ExpertListing[]>({
    queryKey: [`/api/cities/${citySlug}/experts`],
  });

  const allTopics = [...new Set(
    experts.flatMap(e => (e.badgeMeta?.topics || []).map(t => t.topic))
  )].filter(Boolean).sort();

  const filtered = experts.filter(e => {
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const nameMatch = e.name.toLowerCase().includes(term);
      const descMatch = (e.description || "").toLowerCase().includes(term);
      const topicMatch = (e.badgeMeta?.topics || []).some(t =>
        t.topic.toLowerCase().includes(term)
      );
      if (!nameMatch && !descMatch && !topicMatch) return false;
    }
    if (activeTopic) {
      const hasTopicMatch = (e.badgeMeta?.topics || []).some(t => t.topic === activeTopic);
      if (!hasTopicMatch) return false;
    }
    return true;
  });

  const featuredExperts = filtered.filter(e => e.featured);
  const regularExperts = filtered.filter(e => !e.featured);

  return (
    <DarkPageShell maxWidth="wide" fillHeight>
      <div className="px-4 py-8 mx-auto">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Award className="w-8 h-8 text-amber-400" />
            <h1 className="text-3xl font-bold text-white" data-testid="text-experts-title">
              Local Experts
            </h1>
          </div>
          <p className="text-gray-400 text-lg">
            Trusted voices in the Charlotte community — available for quotes, consulting, and guidance
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <Input
              data-testid="input-expert-search"
              placeholder="Search experts by name or topic..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-gray-900 border-gray-700 text-white"
            />
          </div>
        </div>

        {allTopics.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-6">
            <Badge
              data-testid="badge-topic-all"
              variant={activeTopic === null ? "default" : "outline"}
              className={`cursor-pointer ${activeTopic === null ? "bg-amber-500 text-black" : "border-gray-600 text-gray-300"}`}
              onClick={() => setActiveTopic(null)}
            >
              All Topics
            </Badge>
            {allTopics.map(topic => (
              <Badge
                key={topic}
                data-testid={`badge-topic-${topic}`}
                variant={activeTopic === topic ? "default" : "outline"}
                className={`cursor-pointer ${activeTopic === topic ? "bg-amber-500 text-black" : "border-gray-600 text-gray-300"}`}
                onClick={() => setActiveTopic(activeTopic === topic ? null : topic)}
              >
                {topic}
              </Badge>
            ))}
          </div>
        )}

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-48 rounded-lg bg-gray-800" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <Users className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400 text-lg">No experts found</p>
          </div>
        ) : (
          <div className="space-y-6">
            {featuredExperts.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Star className="w-5 h-5 text-amber-400" />
                  <h2 className="text-xl font-semibold text-white" data-testid="text-featured-heading">
                    Featured Experts
                  </h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  {featuredExperts.map(expert => (
                    <ExpertCard key={expert.id} expert={expert} citySlug={citySlug} isFeatured />
                  ))}
                </div>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {regularExperts.map(expert => (
                <ExpertCard key={expert.id} expert={expert} citySlug={citySlug} />
              ))}
            </div>
          </div>
        )}
      </div>
    </DarkPageShell>
  );
}
