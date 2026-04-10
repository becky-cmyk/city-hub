import { useQuery } from "@tanstack/react-query";
import { useParams } from "wouter";
import { usePageMeta } from "@/hooks/use-page-meta";
import { DarkPageShell } from "@/components/dark-page-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Award,
  Mic,
  Palette,
  Newspaper,
  Headphones,
  Camera as CameraIcon,
  ArrowRight,
  Users,
  Church,
  Vote,
} from "lucide-react";

interface CommunityStats {
  experts: number;
  speakers: number;
  creators: number;
  pressContacts: number;
  podcasts: number;
  sourceRequests: number;
}

const SECTIONS = [
  {
    key: "experts",
    label: "Local Experts",
    description: "Trusted voices available for quotes, consulting, and community guidance",
    icon: Award,
    color: "text-amber-400",
    bgColor: "bg-amber-500/10 border-amber-500/20",
    path: "experts",
  },
  {
    key: "speakers",
    label: "Speakers Bureau",
    description: "Book local speakers for your event, panel, workshop, or webinar",
    icon: Mic,
    color: "text-blue-400",
    bgColor: "bg-blue-500/10 border-blue-500/20",
    path: "speakers",
  },
  {
    key: "creators",
    label: "Creator Directory",
    description: "Artists, photographers, authors, musicians, makers, and instructors",
    icon: Palette,
    color: "text-purple-400",
    bgColor: "bg-purple-500/10 border-purple-500/20",
    path: "creators",
  },
  {
    key: "pressContacts",
    label: "Press Contacts",
    description: "Local sources available for media inquiries and press coverage",
    icon: Newspaper,
    color: "text-emerald-400",
    bgColor: "bg-emerald-500/10 border-emerald-500/20",
    path: "press",
  },
  {
    key: "podcasts",
    label: "Podcast Directory",
    description: "Local podcasts covering Charlotte stories, culture, and community",
    icon: Headphones,
    color: "text-violet-400",
    bgColor: "bg-violet-500/10 border-violet-500/20",
    path: "podcasts",
  },
  {
    key: "sourceRequests",
    label: "Source Request Board",
    description: "Respond to requests from journalists and creators seeking local voices",
    icon: CameraIcon,
    color: "text-rose-400",
    bgColor: "bg-rose-500/10 border-rose-500/20",
    path: "source-requests",
  },
];

export default function CommunityHub() {
  const { citySlug } = useParams<{ citySlug: string }>();

  usePageMeta({
    title: "Community Hub | Charlotte Hub",
    description: "Discover experts, speakers, creators, press contacts, podcasts, and source requests in the Charlotte community.",
  });

  const { data: stats, isLoading } = useQuery<CommunityStats>({
    queryKey: [`/api/cities/${citySlug}/community-stats`],
  });

  return (
    <DarkPageShell maxWidth="wide" fillHeight>
      <div className="px-3 sm:px-4 py-6 sm:py-8 mx-auto">
        <div className="mb-8 sm:mb-10 text-center">
          <div className="flex items-center justify-center gap-2 sm:gap-3 mb-3">
            <Users className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
            <h1 className="text-2xl sm:text-4xl font-bold text-white" data-testid="text-community-title">
              Community Hub
            </h1>
          </div>
          <p className="text-gray-400 text-sm sm:text-lg max-w-2xl mx-auto">
            Connect with Charlotte's network of experts, speakers, creators, and community leaders
          </p>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-48 rounded-lg bg-gray-800" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {SECTIONS.map(section => {
              const Icon = section.icon;
              const count = stats?.[section.key as keyof CommunityStats] || 0;
              return (
                <a
                  key={section.key}
                  href={`/${citySlug}/${section.path}`}
                  data-testid={`link-${section.key}`}
                >
                  <Card className={`bg-gray-900 border ${section.bgColor} hover:border-opacity-60 transition-colors cursor-pointer h-full`}>
                    <CardContent className="p-4 sm:p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className={`w-12 h-12 rounded-lg bg-gray-800 flex items-center justify-center`}>
                          <Icon className={`w-6 h-6 ${section.color}`} />
                        </div>
                        {count > 0 && (
                          <Badge variant="outline" className="border-gray-700 text-gray-300">
                            {count}
                          </Badge>
                        )}
                      </div>
                      <h3 className="text-lg font-semibold text-white mb-2">{section.label}</h3>
                      <p className="text-sm text-gray-400 mb-4">{section.description}</p>
                      <div className="flex items-center gap-1 text-sm font-medium" style={{ color: section.color.replace("text-", "").includes("amber") ? "#fbbf24" : section.color.replace("text-", "").includes("blue") ? "#60a5fa" : section.color.replace("text-", "").includes("purple") ? "#c084fc" : section.color.replace("text-", "").includes("emerald") ? "#34d399" : section.color.replace("text-", "").includes("violet") ? "#a78bfa" : "#fb7185" }}>
                        Explore
                        <ArrowRight className="w-4 h-4" />
                      </div>
                    </CardContent>
                  </Card>
                </a>
              );
            })}
          </div>
        )}

        <div className="mt-6">
          <a href={`/${citySlug}/vote`} data-testid="link-voting">
            <Card className="bg-gray-900 border border-violet-500/20 hover:border-violet-500/40 transition-colors cursor-pointer">
              <CardContent className="p-4 sm:p-6 flex items-center gap-3 sm:gap-4">
                <div className="w-12 h-12 rounded-lg bg-gray-800 flex items-center justify-center shrink-0">
                  <Vote className="w-6 h-6 text-violet-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-semibold text-white">Community Voting</h3>
                  <p className="text-sm text-gray-400">Vote in community campaigns, awards, and Best of Charlotte polls</p>
                </div>
                <ArrowRight className="w-5 h-5 text-violet-400 shrink-0" />
              </CardContent>
            </Card>
          </a>
        </div>

        <div className="mt-6">
          <a href={`/${citySlug}/directory?category=nonprofit-faith`} data-testid="link-churches-faith">
            <Card className="bg-gray-900 border border-indigo-500/20 hover:border-indigo-500/40 transition-colors cursor-pointer">
              <CardContent className="p-4 sm:p-6 flex items-center gap-3 sm:gap-4">
                <div className="w-12 h-12 rounded-lg bg-gray-800 flex items-center justify-center shrink-0">
                  <Church className="w-6 h-6 text-indigo-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-semibold text-white">Churches & Faith</h3>
                  <p className="text-sm text-gray-400">Discover local churches, places of worship, and faith-based organizations in Charlotte</p>
                </div>
                <ArrowRight className="w-5 h-5 text-indigo-400 shrink-0" />
              </CardContent>
            </Card>
          </a>
        </div>

        <div className="mt-6 text-center">
          <a href={`/${citySlug}/gallery`} data-testid="link-gallery">
            <Card className="bg-gray-900 border-gray-800 inline-block hover:border-gray-600 transition-colors cursor-pointer">
              <CardContent className="p-4 sm:p-6 flex items-center gap-3 sm:gap-4">
                <CameraIcon className="w-8 h-8 text-teal-400" />
                <div className="text-left">
                  <h3 className="text-lg font-semibold text-white">Photo Gallery</h3>
                  <p className="text-sm text-gray-400">Browse and license local photography</p>
                </div>
                <ArrowRight className="w-5 h-5 text-teal-400 ml-4" />
              </CardContent>
            </Card>
          </a>
        </div>
      </div>
    </DarkPageShell>
  );
}
