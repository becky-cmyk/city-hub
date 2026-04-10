import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useSmartBack } from "@/hooks/use-smart-back";
import { useRegisterAdminEdit } from "@/hooks/use-admin-edit";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, MapPin, Clock, DollarSign, User, Mail, Phone,
  ChevronLeft, ChevronRight, Send, Check, Image as ImageIcon,
  Briefcase, Home, Wrench, Tag, Heart, Star, ShoppingCart, Sparkles
} from "lucide-react";
import { DarkPageShell } from "@/components/dark-page-shell";
import { JsonLd } from "@/components/json-ld";
import { NeighborhoodContext, useNearbyData, buildNearbyJsonLd } from "@/components/neighborhood-context";
import { usePageMeta } from "@/hooks/use-page-meta";
import type { MarketplaceListing, Review } from "@shared/schema";

const CONDITION_LABELS: Record<string, string> = { NEW: "New", LIKE_NEW: "Like New", GOOD: "Good", FAIR: "Fair" };
const CONDITION_COLORS: Record<string, string> = { NEW: "bg-emerald-500", LIKE_NEW: "bg-blue-500", GOOD: "bg-amber-500", FAIR: "bg-orange-500" };
const TYPE_LABELS: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; color: string }> = {
  SERVICE: { label: "Service", icon: Wrench, color: "bg-purple-600" },
  FOR_SALE: { label: "For Sale", icon: Tag, color: "bg-emerald-600" },
  HOUSING: { label: "Housing", icon: Home, color: "bg-blue-600" },
  HOUSING_SUPPLY: { label: "Housing Supply", icon: Home, color: "bg-teal-600" },
  HOUSING_DEMAND: { label: "Housing Wanted", icon: Home, color: "bg-cyan-600" },
  COMMERCIAL_PROPERTY: { label: "Commercial", icon: Home, color: "bg-indigo-600" },
  JOB: { label: "Job", icon: Briefcase, color: "bg-sky-600" },
  COMMUNITY: { label: "Community", icon: Heart, color: "bg-rose-600" },
  WANTED: { label: "Wanted", icon: Tag, color: "bg-orange-600" },
};

function timeAgo(date: string | Date) {
  const now = new Date();
  const d = new Date(date);
  const diff = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return d.toLocaleDateString();
}

function PhotoGallery({ images, title }: { images: string[]; title: string }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  if (!images.length) return (
    <div className="aspect-video bg-white/5 rounded-xl flex items-center justify-center">
      <ImageIcon className="h-16 w-16 text-white/10" />
    </div>
  );

  return (
    <div className="relative rounded-xl overflow-hidden">
      <div className="aspect-video bg-black">
        <img src={images[currentIndex]} alt={`${title} - Photo ${currentIndex + 1}`} className="w-full h-full object-contain" />
      </div>
      {images.length > 1 && (
        <>
          <button
            onClick={() => setCurrentIndex(i => (i - 1 + images.length) % images.length)}
            className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/80 text-white rounded-full p-2 transition-colors"
            data-testid="button-gallery-prev"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            onClick={() => setCurrentIndex(i => (i + 1) % images.length)}
            className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/80 text-white rounded-full p-2 transition-colors"
            data-testid="button-gallery-next"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
            {images.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentIndex(i)}
                className={`w-2 h-2 rounded-full transition-colors ${i === currentIndex ? "bg-white" : "bg-white/40"}`}
                data-testid={`gallery-dot-${i}`}
              />
            ))}
          </div>
        </>
      )}
      {images.length > 1 && (
        <div className="flex gap-2 mt-2 overflow-x-auto">
          {images.map((img, i) => (
            <button
              key={i}
              onClick={() => setCurrentIndex(i)}
              className={`shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-colors ${i === currentIndex ? "border-amber-500" : "border-transparent opacity-60 hover:opacity-100"}`}
              data-testid={`gallery-thumb-${i}`}
            >
              <img src={img} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function PricingPackagesTable({ packagesJson }: { packagesJson: string }) {
  try {
    const packages = JSON.parse(packagesJson);
    if (!Array.isArray(packages) || !packages.length) return null;
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4" data-testid="pricing-packages">
        {packages.map((pkg: { name?: string; price: number; description?: string; features?: string[] }, i: number) => (
          <div key={i} className={`rounded-xl border p-4 ${i === 1 ? "border-amber-500/50 bg-amber-500/5" : "border-white/10 bg-white/5"}`}>
            <h4 className="text-sm font-bold text-white">{pkg.name || ["Basic", "Standard", "Premium"][i]}</h4>
            <p className="text-2xl font-bold text-amber-400 mt-1">${pkg.price}</p>
            {pkg.description && <p className="text-xs text-white/50 mt-2">{pkg.description}</p>}
            {pkg.features && (
              <ul className="mt-3 space-y-1">
                {(pkg.features as string[]).map((f: string, fi: number) => (
                  <li key={fi} className="text-xs text-white/60 flex items-start gap-1.5">
                    <Check className="h-3 w-3 text-emerald-400 mt-0.5 shrink-0" />{f}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    );
  } catch {
    return null;
  }
}

function ReviewSection({ citySlug, listingId }: { citySlug: string; listingId: string }) {
  const { toast } = useToast();
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState("");

  const { data } = useQuery<{ reviews: (Review & { displayName: string })[]; stats: { avgRating: number; count: number } }>({
    queryKey: ["/api/cities", citySlug, "marketplace/listings", listingId, "reviews"],
    queryFn: async () => {
      const res = await fetch(`/api/cities/${citySlug}/marketplace/listings/${listingId}/reviews`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const submitReview = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/cities/${citySlug}/marketplace/listings/${listingId}/reviews`, { rating, comment });
    },
    onSuccess: () => {
      toast({ title: "Review submitted", description: "Your review is pending approval." });
      setRating(0);
      setComment("");
      queryClient.invalidateQueries({ queryKey: ["/api/cities", citySlug, "marketplace/listings", listingId, "reviews"] });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const reviews = data?.reviews || [];
  const stats = data?.stats || { avgRating: 0, count: 0 };

  return (
    <div className="space-y-4" data-testid="review-section">
      <div className="flex items-center gap-3">
        <h2 className="text-lg font-bold text-white">Reviews</h2>
        {stats.count > 0 && (
          <div className="flex items-center gap-1">
            <Star className="h-4 w-4 text-amber-400 fill-amber-400" />
            <span className="text-sm font-bold text-white">{stats.avgRating.toFixed(1)}</span>
            <span className="text-xs text-white/50">({stats.count})</span>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
        <div className="flex gap-1" data-testid="rating-stars">
          {[1, 2, 3, 4, 5].map(s => (
            <button
              key={s}
              onClick={() => setRating(s)}
              onMouseEnter={() => setHoverRating(s)}
              onMouseLeave={() => setHoverRating(0)}
              className="transition-transform hover:scale-110"
              data-testid={`star-${s}`}
            >
              <Star className={`h-5 w-5 ${(hoverRating || rating) >= s ? "text-amber-400 fill-amber-400" : "text-white/20"}`} />
            </button>
          ))}
        </div>
        <Textarea
          placeholder="Share your experience..."
          value={comment}
          onChange={e => setComment(e.target.value)}
          rows={2}
          className="text-xs bg-white/5 border-white/10 text-white placeholder:text-white/30 resize-none"
          data-testid="input-review-comment"
        />
        <Button
          onClick={() => submitReview.mutate()}
          disabled={rating === 0 || submitReview.isPending}
          className="bg-amber-500 hover:bg-amber-600 text-black font-bold text-xs"
          data-testid="button-submit-review"
        >
          {submitReview.isPending ? "Submitting..." : "Submit Review"}
        </Button>
      </div>

      {reviews.length > 0 && (
        <div className="space-y-3">
          {reviews.map(rev => (
            <div key={rev.id} className="rounded-lg border border-white/10 bg-white/5 p-3" data-testid={`review-${rev.id}`}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-white">{rev.displayName}</span>
                  <div className="flex gap-0.5">
                    {[1, 2, 3, 4, 5].map(s => (
                      <Star key={s} className={`h-3 w-3 ${s <= rev.rating ? "text-amber-400 fill-amber-400" : "text-white/10"}`} />
                    ))}
                  </div>
                </div>
                <span className="text-xs text-white/30">{timeAgo(rev.createdAt)}</span>
              </div>
              {rev.comment && <p className="text-xs text-white/60 mt-1">{rev.comment}</p>}
              {rev.ownerResponse && (
                <div className="mt-2 rounded bg-white/5 p-2 border-l-2 border-amber-500/50">
                  <p className="text-xs text-white/40 font-medium mb-0.5">Seller response</p>
                  <p className="text-xs text-white/60">{rev.ownerResponse}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function MarketplaceDetail({ citySlug, listingId }: { citySlug: string; listingId: string }) {
  const { toast } = useToast();
  const smartBack = useSmartBack(`/${citySlug}/marketplace/browse`);
  const [inquiry, setInquiry] = useState({ name: "", email: "", message: "" });
  const [inquirySubmitted, setInquirySubmitted] = useState(false);

  const { data: listing, isLoading } = useQuery<MarketplaceListing & { relatedListings?: MarketplaceListing[] }>({
    queryKey: ["/api/cities", citySlug, "marketplace/listings", listingId],
    queryFn: async () => {
      const res = await fetch(`/api/cities/${citySlug}/marketplace/listings/${listingId}`);
      if (!res.ok) throw new Error("Listing not found");
      return res.json();
    },
  });

  useRegisterAdminEdit("marketplace-management", listing?.id, "Edit Listing");

  const { data: nearbyData } = useNearbyData(
    citySlug,
    (listing as Record<string, unknown>)?.latitude,
    (listing as Record<string, unknown>)?.longitude,
    "marketplace"
  );

  usePageMeta({
    title: listing ? `${listing.title} — Marketplace` : "Marketplace Listing",
    description: listing?.description?.slice(0, 160) || "",
  });

  const inquiryMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/cities/${citySlug}/marketplace/listings/${listingId}/inquiry`, inquiry);
    },
    onSuccess: () => {
      setInquirySubmitted(true);
      toast({ title: "Inquiry sent!", description: "The seller will receive your message." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to send inquiry", variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <DarkPageShell maxWidth="wide" fillHeight>
        <div className="space-y-4">
          <Skeleton className="h-8 w-48 bg-white/10" />
          <Skeleton className="aspect-video w-full bg-white/10 rounded-xl" />
          <Skeleton className="h-6 w-64 bg-white/10" />
          <Skeleton className="h-20 w-full bg-white/10" />
        </div>
      </DarkPageShell>
    );
  }

  if (!listing) {
    return (
      <DarkPageShell maxWidth="wide" fillHeight>
        <div className="text-center py-16">
          <h2 className="text-xl font-bold text-white">Listing not found</h2>
          <Link href={`/${citySlug}/marketplace/browse`}>
            <Button variant="outline" className="mt-4 border-white/10 text-white/60" data-testid="link-back-browse">
              Back to Marketplace
            </Button>
          </Link>
        </div>
      </DarkPageShell>
    );
  }

  const allImages = [listing.imageUrl, ...(listing.galleryImages || [])].filter(Boolean);
  const typeInfo = TYPE_LABELS[listing.type] || TYPE_LABELS.FOR_SALE;
  const TypeIcon = typeInfo.icon;

  return (
    <DarkPageShell maxWidth="wide" fillHeight>
      {nearbyData && nearbyData.groups.length > 0 && (
        <JsonLd data={{
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: `Nearby points of interest around ${listing.title}`,
          itemListElement: buildNearbyJsonLd(nearbyData).map((item, i) => ({
            "@type": "ListItem",
            position: i + 1,
            item,
          })),
        }} />
      )}
      <div className="space-y-6">
        <button className="flex items-center gap-1 text-sm text-white/50 hover:text-white/80 transition-colors" onClick={smartBack} data-testid="link-back">
          <ArrowLeft className="h-4 w-4" /> Back to Marketplace
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <PhotoGallery images={allImages} title={listing.title} />

            <div>
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <Badge className={`text-xs border-0 text-white ${typeInfo.color}`}>
                  <TypeIcon className="h-3 w-3 mr-1" />{typeInfo.label}
                </Badge>
                {listing.featuredFlag && (
                  <Badge className="text-xs border-0 text-black bg-amber-400" data-testid="badge-featured">
                    <Sparkles className="h-3 w-3 mr-1" />Featured
                  </Badge>
                )}
                {listing.condition && (
                  <Badge className={`text-xs border-0 text-white ${CONDITION_COLORS[listing.condition]}`}>
                    {CONDITION_LABELS[listing.condition]}
                  </Badge>
                )}
                {listing.category && (
                  <Badge variant="outline" className="text-xs border-white/20 text-white/60">{listing.category}</Badge>
                )}
              </div>
              <h1 className="text-2xl md:text-3xl font-bold text-white" data-testid="text-listing-title">{listing.title}</h1>

              <div className="flex items-center gap-4 mt-2 text-sm text-white/50">
                {listing.neighborhood && (
                  <span className="flex items-center gap-1"><MapPin className="h-4 w-4" />{listing.neighborhood}</span>
                )}
                {listing.createdAt && (
                  <span className="flex items-center gap-1"><Clock className="h-4 w-4" />{timeAgo(listing.createdAt)}</span>
                )}
              </div>

              {listing.price != null && (
                <div className="mt-3">
                  <span className="text-3xl font-bold text-amber-400" data-testid="text-price">
                    {listing.pricingType === "FREE" ? "Free" : `$${listing.price.toLocaleString()}`}
                  </span>
                  {listing.pricingType === "HOURLY" && <span className="text-white/50 text-sm ml-1">/hour</span>}
                </div>
              )}
              {listing.pricingType === "CONTACT" && (
                <p className="text-lg font-medium text-amber-400 mt-3">Contact for pricing</p>
              )}
            </div>

            {listing.type === "SERVICE" && listing.pricingPackages && (
              <div>
                <h2 className="text-lg font-bold text-white mb-2">Pricing Packages</h2>
                <PricingPackagesTable packagesJson={listing.pricingPackages} />
              </div>
            )}

            <div>
              <h2 className="text-lg font-bold text-white mb-2">Description</h2>
              <div className="text-sm text-white/70 whitespace-pre-wrap leading-relaxed" data-testid="text-description">
                {listing.description}
              </div>
            </div>

            {(listing.type === "HOUSING" || listing.type === "HOUSING_SUPPLY") && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {listing.propertyType && (
                  <div className="rounded-lg bg-white/5 border border-white/10 p-3">
                    <span className="text-xs text-white/40">Property Type</span>
                    <p className="text-sm font-bold text-white capitalize">{listing.propertyType}</p>
                  </div>
                )}
                {listing.bedrooms != null && (
                  <div className="rounded-lg bg-white/5 border border-white/10 p-3">
                    <span className="text-xs text-white/40">Bedrooms</span>
                    <p className="text-lg font-bold text-white">{listing.bedrooms}</p>
                  </div>
                )}
                {listing.bathrooms != null && (
                  <div className="rounded-lg bg-white/5 border border-white/10 p-3">
                    <span className="text-xs text-white/40">Bathrooms</span>
                    <p className="text-lg font-bold text-white">{listing.bathrooms}</p>
                  </div>
                )}
                {listing.squareFeet != null && (
                  <div className="rounded-lg bg-white/5 border border-white/10 p-3">
                    <span className="text-xs text-white/40">Sq Ft</span>
                    <p className="text-lg font-bold text-white">{listing.squareFeet.toLocaleString()}</p>
                  </div>
                )}
                {listing.petFriendly != null && (
                  <div className="rounded-lg bg-white/5 border border-white/10 p-3">
                    <span className="text-xs text-white/40">Pet Friendly</span>
                    <p className="text-sm font-bold text-white">{listing.petFriendly ? "Yes" : "No"}</p>
                  </div>
                )}
                {listing.furnished != null && (
                  <div className="rounded-lg bg-white/5 border border-white/10 p-3">
                    <span className="text-xs text-white/40">Furnished</span>
                    <p className="text-sm font-bold text-white">{listing.furnished ? "Yes" : "No"}</p>
                  </div>
                )}
                {listing.availableDate && (
                  <div className="rounded-lg bg-white/5 border border-white/10 p-3">
                    <span className="text-xs text-white/40">Available</span>
                    <p className="text-sm font-bold text-white">{new Date(listing.availableDate).toLocaleDateString()}</p>
                  </div>
                )}
                {listing.leaseTerm && (
                  <div className="rounded-lg bg-white/5 border border-white/10 p-3">
                    <span className="text-xs text-white/40">Lease Term</span>
                    <p className="text-sm font-bold text-white">{listing.leaseTerm}</p>
                  </div>
                )}
                {listing.parkingDetails && (
                  <div className="rounded-lg bg-white/5 border border-white/10 p-3">
                    <span className="text-xs text-white/40">Parking</span>
                    <p className="text-sm font-bold text-white">{listing.parkingDetails}</p>
                  </div>
                )}
                {listing.leaseOrSale && (
                  <div className="rounded-lg bg-white/5 border border-white/10 p-3">
                    <span className="text-xs text-white/40">Type</span>
                    <p className="text-sm font-bold text-white">{listing.leaseOrSale === "SALE" ? "For Sale" : listing.leaseOrSale === "LEASE" ? "For Lease" : "Either"}</p>
                  </div>
                )}
              </div>
            )}

            {listing.type === "HOUSING_DEMAND" && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {(listing.desiredBudgetMin != null || listing.desiredBudgetMax != null) && (
                  <div className="rounded-lg bg-white/5 border border-white/10 p-3">
                    <span className="text-xs text-white/40">Budget Range</span>
                    <p className="text-sm font-bold text-white">
                      {listing.desiredBudgetMin ? `$${listing.desiredBudgetMin.toLocaleString()}` : "$0"}
                      {" — "}
                      {listing.desiredBudgetMax ? `$${listing.desiredBudgetMax.toLocaleString()}` : "Any"}
                    </p>
                  </div>
                )}
                {listing.desiredAreaText && (
                  <div className="rounded-lg bg-white/5 border border-white/10 p-3">
                    <span className="text-xs text-white/40">Preferred Area</span>
                    <p className="text-sm font-bold text-white">{listing.desiredAreaText}</p>
                  </div>
                )}
                {listing.moveInTimeframe && (
                  <div className="rounded-lg bg-white/5 border border-white/10 p-3">
                    <span className="text-xs text-white/40">Move-in</span>
                    <p className="text-sm font-bold text-white">{listing.moveInTimeframe}</p>
                  </div>
                )}
                {listing.householdSize != null && (
                  <div className="rounded-lg bg-white/5 border border-white/10 p-3">
                    <span className="text-xs text-white/40">Household</span>
                    <p className="text-sm font-bold text-white">{listing.householdSize} {listing.householdSize === 1 ? "person" : "people"}</p>
                  </div>
                )}
                {listing.demandNotes && (
                  <div className="rounded-lg bg-white/5 border border-white/10 p-3 col-span-2">
                    <span className="text-xs text-white/40">Notes</span>
                    <p className="text-sm text-white/70">{listing.demandNotes}</p>
                  </div>
                )}
              </div>
            )}

            {listing.type === "COMMERCIAL_PROPERTY" && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {listing.commercialType && (
                  <div className="rounded-lg bg-white/5 border border-white/10 p-3">
                    <span className="text-xs text-white/40">Type</span>
                    <p className="text-sm font-bold text-white capitalize">{listing.commercialType}</p>
                  </div>
                )}
                {listing.squareFeet != null && (
                  <div className="rounded-lg bg-white/5 border border-white/10 p-3">
                    <span className="text-xs text-white/40">Sq Ft</span>
                    <p className="text-lg font-bold text-white">{listing.squareFeet.toLocaleString()}</p>
                  </div>
                )}
                {listing.leaseOrSale && (
                  <div className="rounded-lg bg-white/5 border border-white/10 p-3">
                    <span className="text-xs text-white/40">Lease/Sale</span>
                    <p className="text-sm font-bold text-white">{listing.leaseOrSale === "SALE" ? "For Sale" : "For Lease"}</p>
                  </div>
                )}
                {listing.zoningText && (
                  <div className="rounded-lg bg-white/5 border border-white/10 p-3">
                    <span className="text-xs text-white/40">Zoning</span>
                    <p className="text-sm font-bold text-white">{listing.zoningText}</p>
                  </div>
                )}
                {listing.buildoutStatus && (
                  <div className="rounded-lg bg-white/5 border border-white/10 p-3">
                    <span className="text-xs text-white/40">Buildout</span>
                    <p className="text-sm font-bold text-white">{listing.buildoutStatus}</p>
                  </div>
                )}
                {listing.parkingDetails && (
                  <div className="rounded-lg bg-white/5 border border-white/10 p-3">
                    <span className="text-xs text-white/40">Parking</span>
                    <p className="text-sm font-bold text-white">{listing.parkingDetails}</p>
                  </div>
                )}
              </div>
            )}

            {listing.type === "SERVICE" && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3" data-testid="service-details">
                {listing.serviceCategory && (
                  <div className="rounded-lg bg-white/5 border border-white/10 p-3">
                    <span className="text-xs text-white/40">Category</span>
                    <p className="text-sm font-bold text-white capitalize">{listing.serviceCategory}</p>
                  </div>
                )}
                {listing.serviceAreaType && (
                  <div className="rounded-lg bg-white/5 border border-white/10 p-3">
                    <span className="text-xs text-white/40">Service Area</span>
                    <p className="text-sm font-bold text-white">{listing.serviceAreaType}</p>
                  </div>
                )}
                {listing.serviceAreaText && (
                  <div className="rounded-lg bg-white/5 border border-white/10 p-3">
                    <span className="text-xs text-white/40">Area Details</span>
                    <p className="text-sm font-bold text-white">{listing.serviceAreaText}</p>
                  </div>
                )}
                {listing.startingPrice != null && (
                  <div className="rounded-lg bg-white/5 border border-white/10 p-3">
                    <span className="text-xs text-white/40">Starting At</span>
                    <p className="text-lg font-bold text-white">${listing.startingPrice.toLocaleString()}</p>
                  </div>
                )}
                {listing.licenseCertText && (
                  <div className="rounded-lg bg-white/5 border border-white/10 p-3 col-span-2">
                    <span className="text-xs text-white/40">License / Certifications</span>
                    <p className="text-sm text-white/70">{listing.licenseCertText}</p>
                  </div>
                )}
              </div>
            )}

            {listing.type === "FOR_SALE" && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3" data-testid="for-sale-details">
                {listing.itemCondition && (
                  <div className="rounded-lg bg-white/5 border border-white/10 p-3">
                    <span className="text-xs text-white/40">Condition</span>
                    <p className="text-sm font-bold text-white capitalize">{listing.itemCondition.replace(/_/g, " ")}</p>
                  </div>
                )}
                {listing.quantity != null && listing.quantity > 1 && (
                  <div className="rounded-lg bg-white/5 border border-white/10 p-3">
                    <span className="text-xs text-white/40">Quantity</span>
                    <p className="text-lg font-bold text-white">{listing.quantity}</p>
                  </div>
                )}
                {listing.pickupOnly != null && (
                  <div className="rounded-lg bg-white/5 border border-white/10 p-3">
                    <span className="text-xs text-white/40">Pickup</span>
                    <p className="text-sm font-bold text-white">{listing.pickupOnly ? "Pickup Only" : "Delivery Available"}</p>
                  </div>
                )}
                {listing.shippingAvailable != null && listing.shippingAvailable && (
                  <div className="rounded-lg bg-white/5 border border-white/10 p-3">
                    <span className="text-xs text-white/40">Shipping</span>
                    <p className="text-sm font-bold text-white">Available</p>
                  </div>
                )}
              </div>
            )}

            {listing.address && (
              <div className="rounded-lg bg-white/5 border border-white/10 p-3">
                <span className="text-xs text-white/40">Address</span>
                <p className="text-sm font-bold text-white">
                  {listing.address}
                  {listing.addressCity && `, ${listing.addressCity}`}
                  {listing.addressState && `, ${listing.addressState}`}
                  {listing.addressZip && ` ${listing.addressZip}`}
                </p>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="rounded-xl border border-white/10 bg-white/5 p-5" data-testid="seller-card">
              <h3 className="text-sm font-bold text-white/40 uppercase tracking-wider mb-3">
                {listing.type === "SERVICE" ? "Service Provider" : "Seller Info"}
              </h3>
              <div className="flex items-center gap-3 mb-3">
                {listing.sellerImage ? (
                  <img src={listing.sellerImage} alt="" className="w-12 h-12 rounded-full object-cover" />
                ) : (
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold text-white ${listing.type === "SERVICE" ? "bg-gradient-to-br from-purple-500 to-indigo-600" : "bg-white/10"}`}>
                    {listing.type === "SERVICE"
                      ? (listing.sellerName || listing.contactName || "S").charAt(0).toUpperCase()
                      : <User className="h-6 w-6 text-white/30" />}
                  </div>
                )}
                <div>
                  <p className="font-semibold text-white" data-testid="text-seller-name">
                    {listing.sellerName || listing.contactName || "Seller"}
                  </p>
                  {listing.type === "SERVICE" && (listing.startingPrice != null || listing.price != null) && (
                    <p className="text-sm font-bold text-emerald-400" data-testid="text-service-from-price">
                      From ${(listing.startingPrice || listing.price || 0).toLocaleString()}
                    </p>
                  )}
                </div>
              </div>
              {listing.contactEmail && (
                <p className="text-xs text-white/50 flex items-center gap-1.5 mb-1">
                  <Mail className="h-3 w-3" />{listing.contactEmail}
                </p>
              )}
              {listing.contactPhone && (
                <p className="text-xs text-white/50 flex items-center gap-1.5">
                  <Phone className="h-3 w-3" />{listing.contactPhone}
                </p>
              )}
            </div>

            {(listing.type === "SERVICE" || listing.type === "FOR_SALE") && listing.price != null && listing.price > 0 && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-5" data-testid="purchase-card">
                <Button
                  onClick={async () => {
                    try {
                      const res = await apiRequest("POST", `/api/cities/${citySlug}/marketplace/listings/${listingId}/checkout`);
                      const data = await res.json();
                      if (data.url) window.location.href = data.url;
                    } catch (err: unknown) {
                      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to start checkout", variant: "destructive" });
                    }
                  }}
                  className="w-full bg-amber-500 hover:bg-amber-600 text-black font-bold"
                  data-testid="button-buy-now"
                >
                  <ShoppingCart className="h-4 w-4 mr-2" />
                  {listing.type === "SERVICE" ? "Book Service" : "Buy Now"} - ${listing.price.toLocaleString()}
                </Button>
              </div>
            )}

            <div className="rounded-xl border border-white/10 bg-white/5 p-5" data-testid="inquiry-form">
              <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                <Send className="h-4 w-4 text-amber-400" /> Contact Seller
              </h3>
              {inquirySubmitted ? (
                <div className="text-center py-4">
                  <Check className="h-8 w-8 text-emerald-400 mx-auto mb-2" />
                  <p className="text-sm text-white font-medium" data-testid="text-inquiry-sent">Message sent!</p>
                  <p className="text-xs text-white/50 mt-1">The seller will get back to you soon.</p>
                </div>
              ) : (
                <form onSubmit={e => { e.preventDefault(); inquiryMutation.mutate(); }} className="space-y-3">
                  <Input
                    placeholder="Your name"
                    value={inquiry.name}
                    onChange={e => setInquiry(p => ({ ...p, name: e.target.value }))}
                    required
                    className="h-9 text-xs bg-white/5 border-white/10 text-white placeholder:text-white/30"
                    data-testid="input-inquiry-name"
                  />
                  <Input
                    type="email"
                    placeholder="Your email"
                    value={inquiry.email}
                    onChange={e => setInquiry(p => ({ ...p, email: e.target.value }))}
                    required
                    className="h-9 text-xs bg-white/5 border-white/10 text-white placeholder:text-white/30"
                    data-testid="input-inquiry-email"
                  />
                  <Textarea
                    placeholder="Your message..."
                    value={inquiry.message}
                    onChange={e => setInquiry(p => ({ ...p, message: e.target.value }))}
                    rows={3}
                    className="text-xs bg-white/5 border-white/10 text-white placeholder:text-white/30 resize-none"
                    data-testid="input-inquiry-message"
                  />
                  <Button
                    type="submit"
                    className="w-full bg-amber-500 hover:bg-amber-600 text-black font-bold"
                    disabled={inquiryMutation.isPending}
                    data-testid="button-send-inquiry"
                  >
                    {inquiryMutation.isPending ? "Sending..." : "Send Message"}
                  </Button>
                </form>
              )}
            </div>
          </div>
        </div>

        <ReviewSection citySlug={citySlug} listingId={listingId} />

        <NeighborhoodContext
          citySlug={citySlug}
          lat={(listing as Record<string, unknown>).latitude}
          lng={(listing as Record<string, unknown>).longitude}
          sourceType="marketplace"
        />

        {listing.relatedListings?.length > 0 && (
          <div>
            <h2 className="text-lg font-bold text-white mb-3">Related Listings</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {listing.relatedListings.map((rel) => (
                <Link key={rel.id} href={`/${citySlug}/marketplace/${rel.id}`}>
                  <div className="rounded-xl overflow-hidden border border-white/10 bg-white/5 hover:bg-white/10 transition-all cursor-pointer" data-testid={`related-${rel.id}`}>
                    <div className="aspect-[4/3] bg-white/5">
                      {(rel.imageUrl || rel.galleryImages?.[0]) ? (
                        <img src={rel.imageUrl || rel.galleryImages[0]} alt={rel.title} className="w-full h-full object-cover" loading="lazy" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <ImageIcon className="h-8 w-8 text-white/10" />
                        </div>
                      )}
                    </div>
                    <div className="p-2.5">
                      <h4 className="text-xs font-semibold text-white line-clamp-2">{rel.title}</h4>
                      {rel.price != null && <p className="text-xs font-bold text-amber-400 mt-0.5">${rel.price.toLocaleString()}</p>}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </DarkPageShell>
  );
}
