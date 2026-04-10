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
  Newspaper,
  Search,
  ArrowRight,
  Users,
  Star,
  Mail,
  CheckCircle,
} from "lucide-react";

interface PressListing {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  listingTier: string;
  expertCategories: string[];
  acceptingPressRequests: boolean;
  featured: boolean;
}

function PressCard({ press, citySlug }: { press: PressListing; citySlug: string }) {
  return (
    <Card
      data-testid={`card-press-${press.id}`}
      className={`bg-gray-900 overflow-hidden ${press.featured ? "border-amber-500/60 border-2" : "border-gray-800"}`}
    >
      <div className="flex gap-4 p-5">
        <div className="shrink-0">
          {press.imageUrl ? (
            <img src={press.imageUrl} alt={press.name} className="w-20 h-20 rounded-lg object-cover" />
          ) : (
            <div className="w-20 h-20 rounded-lg bg-gray-800 flex items-center justify-center">
              <Newspaper className="w-8 h-8 text-emerald-400" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <h3 className="text-lg font-semibold text-white truncate">{press.name}</h3>
            <div className="flex items-center gap-1.5 shrink-0">
              {press.featured && (
                <Badge className="bg-amber-500 text-black text-xs flex items-center gap-1">
                  <Star className="w-3 h-3" />
                  Featured
                </Badge>
              )}
              <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs">
                Press Source
              </Badge>
            </div>
          </div>
          {press.description && (
            <p className="text-sm text-gray-400 line-clamp-2 mb-2">{press.description}</p>
          )}
          <div className="flex flex-wrap gap-1.5 mb-2">
            {press.acceptingPressRequests && (
              <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs flex items-center gap-1">
                <CheckCircle className="w-3 h-3" />
                Accepting Press Requests
              </Badge>
            )}
            {press.expertCategories.map((cat, i) => (
              <Badge key={i} variant="outline" className="border-gray-700 text-gray-300 text-xs">
                {cat}
              </Badge>
            ))}
          </div>
        </div>
      </div>
      <div className="px-5 pb-4 flex items-center gap-3">
        <a href={`/${citySlug}/directory/${press.slug}`} data-testid={`link-press-profile-${press.id}`}>
          <Button variant="ghost" className="text-emerald-400 p-0 h-auto text-sm">
            View Full Profile
            <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </a>
        {press.acceptingPressRequests && (
          <a href={`/${citySlug}/directory/${press.slug}`} data-testid={`link-contact-press-${press.id}`}>
            <Button variant="ghost" className="text-gray-400 p-0 h-auto text-sm">
              <Mail className="w-4 h-4 mr-1" />
              Contact
            </Button>
          </a>
        )}
      </div>
    </Card>
  );
}

export default function PressDirectory() {
  const { citySlug } = useParams<{ citySlug: string }>();
  const [searchTerm, setSearchTerm] = useState("");

  usePageMeta({
    title: "Press Contacts | Charlotte Hub",
    description: "Find local press sources and media contacts in Charlotte for quotes, features, and coverage.",
  });

  const { data: contacts = [], isLoading } = useQuery<PressListing[]>({
    queryKey: [`/api/cities/${citySlug}/press-contacts`],
  });

  const filtered = contacts.filter(c => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return c.name.toLowerCase().includes(term) ||
      (c.description || "").toLowerCase().includes(term) ||
      c.expertCategories.some(cat => cat.toLowerCase().includes(term));
  });

  const featured = filtered.filter(c => c.featured);
  const regular = filtered.filter(c => !c.featured);

  return (
    <DarkPageShell maxWidth="wide" fillHeight>
      <div className="px-4 py-8 mx-auto">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Newspaper className="w-8 h-8 text-emerald-400" />
            <h1 className="text-3xl font-bold text-white" data-testid="text-press-title">
              Press Contacts
            </h1>
          </div>
          <p className="text-gray-400 text-lg">
            Local sources available for media inquiries, expert quotes, and press coverage
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <Input
              data-testid="input-press-search"
              placeholder="Search press contacts..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-gray-900 border-gray-700 text-white"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-40 rounded-lg bg-gray-800" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <Users className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400 text-lg">No press contacts found</p>
          </div>
        ) : (
          <div className="space-y-6">
            {featured.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Star className="w-5 h-5 text-amber-400" />
                  <h2 className="text-xl font-semibold text-white" data-testid="text-featured-heading">
                    Featured Press Sources
                  </h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  {featured.map(p => (
                    <PressCard key={p.id} press={p} citySlug={citySlug} />
                  ))}
                </div>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {regular.map(p => (
                <PressCard key={p.id} press={p} citySlug={citySlug} />
              ))}
            </div>
          </div>
        )}
      </div>
    </DarkPageShell>
  );
}
