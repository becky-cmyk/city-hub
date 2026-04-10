import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "wouter";
import { usePageMeta } from "@/hooks/use-page-meta";
import { getCityBranding, getBrandForContext } from "@shared/city-branding";
import { DarkPageShell } from "@/components/dark-page-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Palette,
  Camera,
  BookOpen,
  Music,
  Hammer,
  GraduationCap,
  Video,
  Search,
  ArrowRight,
  Users,
  Star,
  ShoppingBag,
} from "lucide-react";

const CREATOR_TYPE_MAP: Record<string, { label: string; icon: typeof Palette; color: string }> = {
  CREATOR: { label: "Creator", icon: Video, color: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
  ARTIST: { label: "Artist", icon: Palette, color: "bg-rose-500/20 text-rose-400 border-rose-500/30" },
  PHOTOGRAPHER: { label: "Photographer", icon: Camera, color: "bg-sky-500/20 text-sky-400 border-sky-500/30" },
  AUTHOR: { label: "Author", icon: BookOpen, color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
  MUSICIAN: { label: "Musician", icon: Music, color: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
  MAKER: { label: "Maker", icon: Hammer, color: "bg-orange-500/20 text-orange-400 border-orange-500/30" },
  INSTRUCTOR: { label: "Instructor", icon: GraduationCap, color: "bg-indigo-500/20 text-indigo-400 border-indigo-500/30" },
};

interface CreatorListing {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  listingTier: string;
  creatorType: string;
  expertCategories: string[];
  acceptingMarketplaceOrders: boolean;
  badges: string[];
  featured: boolean;
}

function CreatorCard({ creator, citySlug }: { creator: CreatorListing; citySlug: string }) {
  const primaryBadge = creator.badges[0] || "CREATOR";
  const typeInfo = CREATOR_TYPE_MAP[primaryBadge] || CREATOR_TYPE_MAP["CREATOR"];
  const TypeIcon = typeInfo.icon;

  return (
    <Card
      data-testid={`card-creator-${creator.id}`}
      className={`bg-gray-900 overflow-hidden ${creator.featured ? "border-amber-500/60 border-2" : "border-gray-800"}`}
    >
      <div className="flex gap-4 p-5">
        <div className="shrink-0">
          {creator.imageUrl ? (
            <img
              src={creator.imageUrl}
              alt={creator.name}
              className="w-20 h-20 rounded-lg object-cover"
            />
          ) : (
            <div className="w-20 h-20 rounded-lg bg-gray-800 flex items-center justify-center">
              <TypeIcon className="w-8 h-8 text-purple-400" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <h3 className="text-lg font-semibold text-white truncate">
              {creator.name}
            </h3>
            <div className="flex items-center gap-1.5 shrink-0">
              {creator.featured && (
                <Badge className="bg-amber-500 text-black text-xs flex items-center gap-1">
                  <Star className="w-3 h-3" />
                  Featured
                </Badge>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {creator.badges.map((badge, i) => {
              const info = CREATOR_TYPE_MAP[badge] || CREATOR_TYPE_MAP["CREATOR"];
              const Icon = info.icon;
              return (
                <Badge key={i} className={`${info.color} text-xs flex items-center gap-1`}>
                  <Icon className="w-3 h-3" />
                  {info.label}
                </Badge>
              );
            })}
            {creator.acceptingMarketplaceOrders && (
              <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs flex items-center gap-1">
                <ShoppingBag className="w-3 h-3" />
                Accepting Orders
              </Badge>
            )}
          </div>
          {creator.description && (
            <p className="text-sm text-gray-400 line-clamp-2 mb-2">
              {creator.description}
            </p>
          )}
          {creator.expertCategories.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {creator.expertCategories.map((cat, i) => (
                <Badge key={i} variant="outline" className="border-gray-700 text-gray-300 text-xs">
                  {cat}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="px-5 pb-4">
        <a
          href={`/${citySlug}/directory/${creator.slug}`}
          data-testid={`link-creator-profile-${creator.id}`}
        >
          <Button variant="ghost" className="text-purple-400 p-0 h-auto text-sm">
            View Full Profile
            <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </a>
      </div>
    </Card>
  );
}

export default function CreatorDirectory() {
  const { citySlug } = useParams<{ citySlug: string }>();
  const [searchTerm, setSearchTerm] = useState("");
  const [activeType, setActiveType] = useState<string | null>(null);

  const cityName = citySlug ? citySlug.charAt(0).toUpperCase() + citySlug.slice(1) : "City";
  const cdBranding = getCityBranding(citySlug);
  const cdBrand = cdBranding ? getBrandForContext(cdBranding, "default") : null;
  usePageMeta({
    title: `Creator Directory | ${cdBrand?.ogSiteName || "CLT Hub"}`,
    description: `Discover local artists, photographers, authors, musicians, makers, and instructors in ${cityName}.`,
    ogSiteName: cdBrand?.ogSiteName,
  });

  const { data: creators = [], isLoading } = useQuery<CreatorListing[]>({
    queryKey: [`/api/cities/${citySlug}/creators`],
  });

  const typeBreakdown = Object.entries(CREATOR_TYPE_MAP).map(([key, val]) => ({
    key,
    label: val.label,
    count: creators.filter(c => c.badges.includes(key)).length,
  })).filter(t => t.count > 0);

  const filtered = creators.filter(c => {
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const nameMatch = c.name.toLowerCase().includes(term);
      const descMatch = (c.description || "").toLowerCase().includes(term);
      const catMatch = c.expertCategories.some(cat => cat.toLowerCase().includes(term));
      if (!nameMatch && !descMatch && !catMatch) return false;
    }
    if (activeType) {
      if (!c.badges.includes(activeType)) return false;
    }
    return true;
  });

  const featuredCreators = filtered.filter(c => c.featured);
  const regularCreators = filtered.filter(c => !c.featured);

  return (
    <DarkPageShell maxWidth="wide" fillHeight>
      <div className="px-4 py-8 mx-auto">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Palette className="w-8 h-8 text-purple-400" />
            <h1 className="text-3xl font-bold text-white" data-testid="text-creators-title">
              Creator Directory
            </h1>
          </div>
          <p className="text-gray-400 text-lg">
            Local artists, photographers, authors, musicians, makers, and instructors in the {cityName} community
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50" />
            <Input
              data-testid="input-creator-search"
              placeholder="Search creators..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-gray-900 border-gray-700 text-white"
            />
          </div>
        </div>

        {typeBreakdown.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-6">
            <Badge
              data-testid="badge-type-all"
              variant={activeType === null ? "default" : "outline"}
              className={`cursor-pointer ${activeType === null ? "bg-purple-500 text-white" : "border-gray-600 text-gray-300"}`}
              onClick={() => setActiveType(null)}
            >
              All ({creators.length})
            </Badge>
            {typeBreakdown.map(t => {
              const info = CREATOR_TYPE_MAP[t.key];
              return (
                <Badge
                  key={t.key}
                  data-testid={`badge-type-${t.key}`}
                  variant={activeType === t.key ? "default" : "outline"}
                  className={`cursor-pointer ${activeType === t.key ? info.color : "border-gray-600 text-gray-300"}`}
                  onClick={() => setActiveType(activeType === t.key ? null : t.key)}
                >
                  {t.label} ({t.count})
                </Badge>
              );
            })}
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
            <Users className="w-16 h-16 text-white/30 mx-auto mb-4" />
            <p className="text-gray-400 text-lg">No creators found</p>
          </div>
        ) : (
          <div className="space-y-6">
            {featuredCreators.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Star className="w-5 h-5 text-amber-400" />
                  <h2 className="text-xl font-semibold text-white" data-testid="text-featured-heading">
                    Featured Creators
                  </h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  {featuredCreators.map(creator => (
                    <CreatorCard key={creator.id} creator={creator} citySlug={citySlug} />
                  ))}
                </div>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {regularCreators.map(creator => (
                <CreatorCard key={creator.id} creator={creator} citySlug={citySlug} />
              ))}
            </div>
          </div>
        )}
      </div>
    </DarkPageShell>
  );
}
