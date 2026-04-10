import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useSmartBack } from "@/hooks/use-smart-back";
import { Link, useLocation, useSearch } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { AuthDialog } from "@/components/auth-dialog";
import {
  ArrowLeft, Plus, X, Upload, Wrench, Tag, Home, Briefcase, Heart,
  DollarSign, Image as ImageIcon, Building2, Search
} from "lucide-react";
import { DarkPageShell } from "@/components/dark-page-shell";
import { usePageMeta } from "@/hooks/use-page-meta";

type ListingType = "SERVICE" | "FOR_SALE" | "HOUSING" | "JOB" | "COMMUNITY" | "WANTED" | "HOUSING_SUPPLY" | "HOUSING_DEMAND" | "COMMERCIAL_PROPERTY";

const TYPE_OPTIONS: { value: ListingType; label: string; icon: React.ComponentType<{ className?: string }>; description: string }[] = [
  { value: "HOUSING_SUPPLY", label: "Housing Supply", icon: Home, description: "Apartments, homes, rooms for rent or sale" },
  { value: "HOUSING_DEMAND", label: "Housing Wanted", icon: Search, description: "Looking for housing, roommates, or relocation" },
  { value: "COMMERCIAL_PROPERTY", label: "Commercial Property", icon: Building2, description: "Office, retail, warehouse, or mixed-use space" },
  { value: "SERVICE", label: "Service", icon: Wrench, description: "Offer professional services" },
  { value: "FOR_SALE", label: "For Sale", icon: Tag, description: "Sell items, goods, or products" },
  { value: "HOUSING", label: "Housing / Rental", icon: Home, description: "List a home, apartment, or room (classic)" },
  { value: "JOB", label: "Job", icon: Briefcase, description: "Post a job opening" },
  { value: "COMMUNITY", label: "Community / Free", icon: Heart, description: "Free items, volunteering, events" },
  { value: "WANTED", label: "Wanted", icon: Tag, description: "Looking to buy, hire, or find something" },
];

const CONDITION_OPTIONS = [
  { value: "NEW", label: "New" },
  { value: "LIKE_NEW", label: "Like New" },
  { value: "GOOD", label: "Good" },
  { value: "FAIR", label: "Fair" },
];

const PRICING_OPTIONS = [
  { value: "FIXED", label: "Fixed Price" },
  { value: "HOURLY", label: "Hourly Rate" },
  { value: "FREE", label: "Free" },
  { value: "CONTACT", label: "Contact for Price" },
];

interface PricingPackage {
  name: string;
  price: string;
  description: string;
  features: string[];
}

export default function MarketplacePost({ citySlug }: { citySlug: string }) {
  const { toast } = useToast();
  const { isLoggedIn } = useAuth();
  const smartBack = useSmartBack(`/${citySlug}/marketplace/browse`);
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const editId = new URLSearchParams(searchString).get("edit");
  const isEditMode = !!editId;
  const [authOpen, setAuthOpen] = useState(false);

  const [step, setStep] = useState(1);
  const [listingType, setListingType] = useState<ListingType | "">("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [tagline, setTagline] = useState("");
  const [price, setPrice] = useState("");
  const [pricingType, setPricingType] = useState("FIXED");
  const [condition, setCondition] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [bedrooms, setBedrooms] = useState("");
  const [bathrooms, setBathrooms] = useState("");
  const [squareFeet, setSquareFeet] = useState("");
  const [petFriendly, setPetFriendly] = useState("");
  const [furnished, setFurnished] = useState("");
  const [availableDate, setAvailableDate] = useState("");
  const [leaseTerm, setLeaseTerm] = useState("");
  const [parkingDetails, setParkingDetails] = useState("");
  const [propertyType, setPropertyType] = useState("");
  const [leaseOrSale, setLeaseOrSale] = useState("");
  const [address, setAddress] = useState("");
  const [addressCity, setAddressCity] = useState("");
  const [addressState, setAddressState] = useState("");
  const [addressZip, setAddressZip] = useState("");
  const [desiredBudgetMin, setDesiredBudgetMin] = useState("");
  const [desiredBudgetMax, setDesiredBudgetMax] = useState("");
  const [desiredAreaText, setDesiredAreaText] = useState("");
  const [moveInTimeframe, setMoveInTimeframe] = useState("");
  const [householdSize, setHouseholdSize] = useState("");
  const [demandNotes, setDemandNotes] = useState("");
  const [commercialType, setCommercialType] = useState("");
  const [zoningText, setZoningText] = useState("");
  const [useCaseText, setUseCaseText] = useState("");
  const [buildoutStatus, setBuildoutStatus] = useState("");
  const [serviceCategory, setServiceCategory] = useState("");
  const [serviceAreaText, setServiceAreaText] = useState("");
  const [licenseCertText, setLicenseCertText] = useState("");
  const [itemCondition, setItemCondition] = useState("");
  const [quantity, setQuantity] = useState("");
  const [pickupOnly, setPickupOnly] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [salary, setSalary] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [galleryImages, setGalleryImages] = useState<string[]>([]);
  const [packages, setPackages] = useState<PricingPackage[]>([
    { name: "Basic", price: "", description: "", features: [""] },
    { name: "Standard", price: "", description: "", features: [""] },
    { name: "Premium", price: "", description: "", features: [""] },
  ]);
  const [editLoaded, setEditLoaded] = useState(false);

  const { data: existingListing } = useQuery({
    queryKey: ["/api/auth/my-marketplace-listings", editId],
    queryFn: async () => {
      const res = await fetch(`/api/auth/my-marketplace-listings/${editId}`);
      if (!res.ok) return null;
      return res.json();
    },
    enabled: isEditMode && !editLoaded,
  });

  useEffect(() => {
    if (existingListing && !editLoaded) {
      const e = existingListing;
      setListingType(e.type || "");
      setTitle(e.title || "");
      setDescription(e.description || "");
      setCategory(e.category || "");
      setTagline(e.tagline || "");
      setPrice(e.price ? String(e.price) : "");
      setPricingType(e.pricingType || "FIXED");
      setCondition(e.condition || "");
      setNeighborhood(e.neighborhood || "");
      setBedrooms(e.bedrooms ? String(e.bedrooms) : "");
      setBathrooms(e.bathrooms ? String(e.bathrooms) : "");
      setSquareFeet(e.squareFeet ? String(e.squareFeet) : "");
      setPetFriendly(e.petFriendly === true ? "yes" : e.petFriendly === false ? "no" : "");
      setFurnished(e.furnished === true ? "yes" : e.furnished === false ? "no" : "");
      setAvailableDate(e.availableDate ? new Date(e.availableDate).toISOString().slice(0, 10) : "");
      setLeaseTerm(e.leaseTerm || "");
      setParkingDetails(e.parkingDetails || "");
      setPropertyType(e.propertyType || "");
      setLeaseOrSale(e.leaseOrSale || "");
      setAddress(e.address || "");
      setAddressCity(e.addressCity || "");
      setAddressState(e.addressState || "");
      setAddressZip(e.addressZip || "");
      setDesiredBudgetMin(e.desiredBudgetMin ? String(e.desiredBudgetMin) : "");
      setDesiredBudgetMax(e.desiredBudgetMax ? String(e.desiredBudgetMax) : "");
      setDesiredAreaText(e.desiredAreaText || "");
      setMoveInTimeframe(e.moveInTimeframe || "");
      setHouseholdSize(e.householdSize ? String(e.householdSize) : "");
      setDemandNotes(e.demandNotes || "");
      setCommercialType(e.commercialType || "");
      setZoningText(e.zoningText || "");
      setUseCaseText(e.useCaseText || "");
      setBuildoutStatus(e.buildoutStatus || "");
      setServiceCategory(e.serviceCategory || "");
      setServiceAreaText(e.serviceAreaText || "");
      setLicenseCertText(e.licenseCertText || "");
      setItemCondition(e.itemCondition || "");
      setQuantity(e.quantity ? String(e.quantity) : "");
      setPickupOnly(e.pickupOnly === true ? "yes" : e.pickupOnly === false ? "no" : "");
      setOrganizationName(e.organizationName || "");
      setSalary(e.salary || "");
      setContactName(e.contactName || "");
      setContactEmail(e.contactEmail || "");
      setContactPhone(e.contactPhone || "");
      setImageUrl(e.imageUrl || "");
      setGalleryImages(e.galleryImages || []);
      setStep(2);
      setEditLoaded(true);
    }
  }, [existingListing, editLoaded]);

  usePageMeta({
    title: isEditMode ? "Edit Listing — Marketplace" : "Post a Listing — Marketplace",
    description: isEditMode ? "Edit your marketplace listing" : "Create a new listing on the marketplace",
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const body: Record<string, string | number | boolean | string[] | undefined> = {
        title,
        description,
        category: category || undefined,
        tagline: tagline || undefined,
        pricingType: pricingType || "FIXED",
        neighborhood: neighborhood || undefined,
        contactName: contactName || undefined,
        contactEmail: contactEmail || undefined,
        contactPhone: contactPhone || undefined,
        imageUrl: imageUrl || undefined,
      };
      body.galleryImages = galleryImages.filter(Boolean) as string[];
      if (!isEditMode) {
        body.type = listingType;
      }
      if (pricingType !== "FREE" && pricingType !== "CONTACT" && price) {
        body.price = Number(price);
      }
      if (listingType === "FOR_SALE" && condition) body.condition = condition;
      if (listingType === "JOB" && salary) body.salary = salary;

      if (["HOUSING", "HOUSING_SUPPLY"].includes(listingType)) {
        if (bedrooms) body.bedrooms = Number(bedrooms);
        if (bathrooms) body.bathrooms = Number(bathrooms);
        if (squareFeet) body.squareFeet = Number(squareFeet);
        if (petFriendly) body.petFriendly = petFriendly === "yes";
        if (furnished) body.furnished = furnished === "yes";
        if (availableDate) body.availableDate = availableDate;
        if (leaseTerm) body.leaseTerm = leaseTerm;
        if (parkingDetails) body.parkingDetails = parkingDetails;
        if (propertyType) body.propertyType = propertyType;
        if (leaseOrSale) body.leaseOrSale = leaseOrSale;
      }

      if (listingType === "HOUSING_DEMAND") {
        if (desiredBudgetMin) body.desiredBudgetMin = Number(desiredBudgetMin);
        if (desiredBudgetMax) body.desiredBudgetMax = Number(desiredBudgetMax);
        if (desiredAreaText) body.desiredAreaText = desiredAreaText;
        if (moveInTimeframe) body.moveInTimeframe = moveInTimeframe;
        if (householdSize) body.householdSize = Number(householdSize);
        if (petFriendly) body.petsFlag = petFriendly === "yes";
        if (demandNotes) body.demandNotes = demandNotes;
      }

      if (listingType === "COMMERCIAL_PROPERTY") {
        if (squareFeet) body.squareFeet = Number(squareFeet);
        if (leaseOrSale) body.leaseOrSale = leaseOrSale;
        if (commercialType) body.commercialType = commercialType;
        if (zoningText) body.zoningText = zoningText;
        if (useCaseText) body.useCaseText = useCaseText;
        if (buildoutStatus) body.buildoutStatus = buildoutStatus;
        if (parkingDetails) body.parkingDetails = parkingDetails;
      }

      if (listingType === "SERVICE") {
        if (serviceCategory) body.serviceCategory = serviceCategory;
        if (serviceAreaText) body.serviceAreaText = serviceAreaText;
        if (licenseCertText) body.licenseCertText = licenseCertText;
        const validPackages = packages.filter(p => p.price);
        if (validPackages.length > 0) {
          body.pricingPackages = JSON.stringify(validPackages.map(p => ({
            ...p,
            price: Number(p.price),
            features: p.features.filter(Boolean),
          })));
        }
      }

      if (listingType === "FOR_SALE") {
        if (itemCondition) body.itemCondition = itemCondition;
        if (quantity) body.quantity = Number(quantity);
        if (pickupOnly) body.pickupOnly = pickupOnly === "yes";
      }

      if (listingType === "COMMUNITY") {
        if (organizationName) body.organizationName = organizationName;
      }

      if (address) body.address = address;
      if (addressCity) body.addressCity = addressCity;
      if (addressState) body.addressState = addressState;
      if (addressZip) body.addressZip = addressZip;

      if (isEditMode) {
        return apiRequest("PUT", `/api/cities/${citySlug}/marketplace/listings/${editId}`, body);
      }
      return apiRequest("POST", `/api/cities/${citySlug}/marketplace/listings`, body);
    },
    onSuccess: async (res) => {
      const data = await res.json();
      toast({ title: isEditMode ? "Listing updated!" : "Listing posted!", description: isEditMode ? "Your changes have been saved." : "Your listing is now live." });
      setLocation(`/${citySlug}/marketplace/${data.id}`);
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message || (isEditMode ? "Failed to update listing" : "Failed to create listing"), variant: "destructive" });
    },
  });

  if (!isLoggedIn) {
    return (
      <DarkPageShell maxWidth="narrow" fillHeight>
        <div className="text-center py-16">
          <Plus className="h-12 w-12 text-white/20 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Sign in to post</h2>
          <p className="text-sm text-white/50 mb-4">You need an account to create marketplace listings.</p>
          <Button onClick={() => setAuthOpen(true)} className="bg-amber-500 text-black font-bold" data-testid="button-signin-post">
            Sign In
          </Button>
          <AuthDialog open={authOpen} onOpenChange={setAuthOpen} />
        </div>
      </DarkPageShell>
    );
  }

  const updatePackage = (index: number, field: string, value: string | string[]) => {
    setPackages(prev => prev.map((p, i) => i === index ? { ...p, [field]: value } : p));
  };

  const addFeature = (pkgIndex: number) => {
    setPackages(prev => prev.map((p, i) => i === pkgIndex ? { ...p, features: [...p.features, ""] } : p));
  };

  const updateFeature = (pkgIndex: number, featureIndex: number, value: string) => {
    setPackages(prev => prev.map((p, i) => {
      if (i !== pkgIndex) return p;
      const features = [...p.features];
      features[featureIndex] = value;
      return { ...p, features };
    }));
  };

  const removeFeature = (pkgIndex: number, featureIndex: number) => {
    setPackages(prev => prev.map((p, i) => {
      if (i !== pkgIndex) return p;
      return { ...p, features: p.features.filter((_, fi) => fi !== featureIndex) };
    }));
  };

  const addGalleryImage = () => {
    if (galleryImages.length < 6) setGalleryImages([...galleryImages, ""]);
  };

  const updateGalleryImage = (index: number, value: string) => {
    setGalleryImages(prev => prev.map((img, i) => i === index ? value : img));
  };

  const removeGalleryImage = (index: number) => {
    setGalleryImages(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <DarkPageShell maxWidth="narrow" fillHeight>
      <div className="space-y-6">
        <button className="flex items-center gap-1 text-sm text-white/50 hover:text-white/80 transition-colors" onClick={smartBack} data-testid="link-back">
          <ArrowLeft className="h-4 w-4" /> Back to Marketplace
        </button>

        <h1 className="text-2xl font-bold text-white" data-testid="text-post-title">{isEditMode ? "Edit Listing" : "Post a Listing"}</h1>

        {step === 1 && (
          <div className="space-y-4">
            <p className="text-sm text-white/50">What are you listing?</p>
            <div className="grid grid-cols-1 gap-3">
              {TYPE_OPTIONS.map(opt => {
                const Icon = opt.icon;
                return (
                  <button
                    key={opt.value}
                    onClick={() => { setListingType(opt.value); setStep(2); }}
                    className={`flex items-center gap-4 p-4 rounded-xl border transition-all text-left ${
                      listingType === opt.value
                        ? "border-amber-500 bg-amber-500/10"
                        : "border-white/10 bg-white/5 hover:bg-white/10"
                    }`}
                    data-testid={`type-${opt.value.toLowerCase()}`}
                  >
                    <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
                      <Icon className="h-5 w-5 text-amber-400" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-white text-sm">{opt.label}</h3>
                      <p className="text-xs text-white/50">{opt.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5">
            <div className="flex items-center gap-2 text-xs text-white/40">
              <button onClick={() => setStep(1)} className="hover:text-white/60">Category</button>
              <span>/</span>
              <span className="text-white/60">Details</span>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-white/60 mb-1 block">Title *</label>
                <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="What are you listing?" className="bg-white/5 border-white/10 text-white placeholder:text-white/30" data-testid="input-title" />
              </div>

              <div>
                <label className="text-xs font-medium text-white/60 mb-1 block">Description *</label>
                <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Describe your listing in detail..." rows={5} className="bg-white/5 border-white/10 text-white placeholder:text-white/30 resize-none" data-testid="input-description" />
              </div>

              {listingType === "SERVICE" && (
                <div>
                  <label className="text-xs font-medium text-white/60 mb-1 block">Tagline</label>
                  <Input value={tagline} onChange={e => setTagline(e.target.value)} placeholder="Short tagline for your service" className="bg-white/5 border-white/10 text-white placeholder:text-white/30" data-testid="input-tagline" />
                </div>
              )}

              <div>
                <label className="text-xs font-medium text-white/60 mb-1 block">Category</label>
                <Input value={category} onChange={e => setCategory(e.target.value)} placeholder="e.g., Electronics, Cleaning, 2BR Apartment" className="bg-white/5 border-white/10 text-white placeholder:text-white/30" data-testid="input-category" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-white/60 mb-1 block">Pricing Type</label>
                  <Select value={pricingType} onValueChange={setPricingType}>
                    <SelectTrigger className="bg-white/5 border-white/10 text-white" data-testid="select-pricing-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PRICING_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                {pricingType !== "FREE" && pricingType !== "CONTACT" && (
                  <div>
                    <label className="text-xs font-medium text-white/60 mb-1 block">Price ($)</label>
                    <Input type="number" value={price} onChange={e => setPrice(e.target.value)} placeholder="0" className="bg-white/5 border-white/10 text-white placeholder:text-white/30" data-testid="input-price" />
                  </div>
                )}
              </div>

              {listingType === "FOR_SALE" && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-white/60 mb-1 block">Condition</label>
                      <Select value={condition} onValueChange={setCondition}>
                        <SelectTrigger className="bg-white/5 border-white/10 text-white" data-testid="select-condition">
                          <SelectValue placeholder="Select condition" />
                        </SelectTrigger>
                        <SelectContent>
                          {CONDITION_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-white/60 mb-1 block">Quantity</label>
                      <Input type="number" value={quantity} onChange={e => setQuantity(e.target.value)} placeholder="1" className="bg-white/5 border-white/10 text-white placeholder:text-white/30" data-testid="input-quantity" />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-white/60 mb-1 block">Pickup Only?</label>
                    <Select value={pickupOnly} onValueChange={setPickupOnly}>
                      <SelectTrigger className="bg-white/5 border-white/10 text-white" data-testid="select-pickup-only">
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="yes">Yes, local pickup</SelectItem>
                        <SelectItem value="no">Shipping available</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}

              {(listingType === "HOUSING" || listingType === "HOUSING_SUPPLY") && (
                <>
                  <h3 className="text-sm font-bold text-white pt-2">Property Details</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-white/60 mb-1 block">Property Type</label>
                      <Select value={propertyType} onValueChange={setPropertyType}>
                        <SelectTrigger className="bg-white/5 border-white/10 text-white" data-testid="select-property-type">
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="apartment">Apartment</SelectItem>
                          <SelectItem value="house">House</SelectItem>
                          <SelectItem value="townhome">Townhome</SelectItem>
                          <SelectItem value="condo">Condo</SelectItem>
                          <SelectItem value="room">Room</SelectItem>
                          <SelectItem value="studio">Studio</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-white/60 mb-1 block">Lease or Sale</label>
                      <Select value={leaseOrSale} onValueChange={setLeaseOrSale}>
                        <SelectTrigger className="bg-white/5 border-white/10 text-white" data-testid="select-lease-or-sale">
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="LEASE">For Lease / Rent</SelectItem>
                          <SelectItem value="SALE">For Sale</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="text-xs font-medium text-white/60 mb-1 block">Bedrooms</label>
                      <Input type="number" value={bedrooms} onChange={e => setBedrooms(e.target.value)} placeholder="0" className="bg-white/5 border-white/10 text-white placeholder:text-white/30" data-testid="input-bedrooms" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-white/60 mb-1 block">Bathrooms</label>
                      <Input type="number" value={bathrooms} onChange={e => setBathrooms(e.target.value)} placeholder="0" className="bg-white/5 border-white/10 text-white placeholder:text-white/30" data-testid="input-bathrooms" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-white/60 mb-1 block">Sq Ft</label>
                      <Input type="number" value={squareFeet} onChange={e => setSquareFeet(e.target.value)} placeholder="0" className="bg-white/5 border-white/10 text-white placeholder:text-white/30" data-testid="input-sqft" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-white/60 mb-1 block">Pet Friendly?</label>
                      <Select value={petFriendly} onValueChange={setPetFriendly}>
                        <SelectTrigger className="bg-white/5 border-white/10 text-white" data-testid="select-pet-friendly">
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="yes">Yes</SelectItem>
                          <SelectItem value="no">No</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-white/60 mb-1 block">Furnished?</label>
                      <Select value={furnished} onValueChange={setFurnished}>
                        <SelectTrigger className="bg-white/5 border-white/10 text-white" data-testid="select-furnished">
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="yes">Yes</SelectItem>
                          <SelectItem value="no">No</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-white/60 mb-1 block">Available Date</label>
                      <Input type="date" value={availableDate} onChange={e => setAvailableDate(e.target.value)} className="bg-white/5 border-white/10 text-white" data-testid="input-available-date" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-white/60 mb-1 block">Lease Term</label>
                      <Input value={leaseTerm} onChange={e => setLeaseTerm(e.target.value)} placeholder="e.g., 12 months" className="bg-white/5 border-white/10 text-white placeholder:text-white/30" data-testid="input-lease-term" />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-white/60 mb-1 block">Parking Details</label>
                    <Input value={parkingDetails} onChange={e => setParkingDetails(e.target.value)} placeholder="e.g., 1 covered spot included" className="bg-white/5 border-white/10 text-white placeholder:text-white/30" data-testid="input-parking" />
                  </div>
                </>
              )}

              {listingType === "HOUSING_DEMAND" && (
                <>
                  <h3 className="text-sm font-bold text-white pt-2">What You're Looking For</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-white/60 mb-1 block">Budget Min ($)</label>
                      <Input type="number" value={desiredBudgetMin} onChange={e => setDesiredBudgetMin(e.target.value)} placeholder="0" className="bg-white/5 border-white/10 text-white placeholder:text-white/30" data-testid="input-budget-min" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-white/60 mb-1 block">Budget Max ($)</label>
                      <Input type="number" value={desiredBudgetMax} onChange={e => setDesiredBudgetMax(e.target.value)} placeholder="0" className="bg-white/5 border-white/10 text-white placeholder:text-white/30" data-testid="input-budget-max" />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-white/60 mb-1 block">Preferred Area / Neighborhoods</label>
                    <Input value={desiredAreaText} onChange={e => setDesiredAreaText(e.target.value)} placeholder="e.g., South End, NoDa, Uptown" className="bg-white/5 border-white/10 text-white placeholder:text-white/30" data-testid="input-desired-area" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-white/60 mb-1 block">Move-in Timeframe</label>
                      <Input value={moveInTimeframe} onChange={e => setMoveInTimeframe(e.target.value)} placeholder="e.g., ASAP, 30 days" className="bg-white/5 border-white/10 text-white placeholder:text-white/30" data-testid="input-move-in" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-white/60 mb-1 block">Household Size</label>
                      <Input type="number" value={householdSize} onChange={e => setHouseholdSize(e.target.value)} placeholder="1" className="bg-white/5 border-white/10 text-white placeholder:text-white/30" data-testid="input-household-size" />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-white/60 mb-1 block">Pets?</label>
                    <Select value={petFriendly} onValueChange={setPetFriendly}>
                      <SelectTrigger className="bg-white/5 border-white/10 text-white" data-testid="select-pets">
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="yes">Yes, have pets</SelectItem>
                        <SelectItem value="no">No pets</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-white/60 mb-1 block">Additional Notes</label>
                    <Textarea value={demandNotes} onChange={e => setDemandNotes(e.target.value)} placeholder="Anything else the landlord should know..." rows={3} className="bg-white/5 border-white/10 text-white placeholder:text-white/30 resize-none" data-testid="input-demand-notes" />
                  </div>
                </>
              )}

              {listingType === "COMMERCIAL_PROPERTY" && (
                <>
                  <h3 className="text-sm font-bold text-white pt-2">Commercial Details</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-white/60 mb-1 block">Commercial Type</label>
                      <Select value={commercialType} onValueChange={setCommercialType}>
                        <SelectTrigger className="bg-white/5 border-white/10 text-white" data-testid="select-commercial-type">
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="office">Office</SelectItem>
                          <SelectItem value="retail">Retail</SelectItem>
                          <SelectItem value="warehouse">Warehouse</SelectItem>
                          <SelectItem value="mixed_use">Mixed Use</SelectItem>
                          <SelectItem value="restaurant">Restaurant</SelectItem>
                          <SelectItem value="industrial">Industrial</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-white/60 mb-1 block">Lease or Sale</label>
                      <Select value={leaseOrSale} onValueChange={setLeaseOrSale}>
                        <SelectTrigger className="bg-white/5 border-white/10 text-white" data-testid="select-commercial-lease-sale">
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="LEASE">For Lease</SelectItem>
                          <SelectItem value="SALE">For Sale</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-white/60 mb-1 block">Square Footage</label>
                    <Input type="number" value={squareFeet} onChange={e => setSquareFeet(e.target.value)} placeholder="0" className="bg-white/5 border-white/10 text-white placeholder:text-white/30" data-testid="input-commercial-sqft" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-white/60 mb-1 block">Zoning</label>
                    <Input value={zoningText} onChange={e => setZoningText(e.target.value)} placeholder="e.g., B-2, Mixed-Use" className="bg-white/5 border-white/10 text-white placeholder:text-white/30" data-testid="input-zoning" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-white/60 mb-1 block">Intended Use</label>
                    <Input value={useCaseText} onChange={e => setUseCaseText(e.target.value)} placeholder="e.g., Restaurant, co-working space" className="bg-white/5 border-white/10 text-white placeholder:text-white/30" data-testid="input-use-case" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-white/60 mb-1 block">Buildout Status</label>
                      <Input value={buildoutStatus} onChange={e => setBuildoutStatus(e.target.value)} placeholder="e.g., Shell, Move-in ready" className="bg-white/5 border-white/10 text-white placeholder:text-white/30" data-testid="input-buildout" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-white/60 mb-1 block">Parking</label>
                      <Input value={parkingDetails} onChange={e => setParkingDetails(e.target.value)} placeholder="e.g., 20 spaces" className="bg-white/5 border-white/10 text-white placeholder:text-white/30" data-testid="input-commercial-parking" />
                    </div>
                  </div>
                </>
              )}

              {listingType === "JOB" && (
                <div>
                  <label className="text-xs font-medium text-white/60 mb-1 block">Salary / Compensation</label>
                  <Input value={salary} onChange={e => setSalary(e.target.value)} placeholder="e.g., $50-60K, $18/hr" className="bg-white/5 border-white/10 text-white placeholder:text-white/30" data-testid="input-salary" />
                </div>
              )}

              {listingType === "COMMUNITY" && (
                <div>
                  <label className="text-xs font-medium text-white/60 mb-1 block">Organization Name</label>
                  <Input value={organizationName} onChange={e => setOrganizationName(e.target.value)} placeholder="Your organization or group" className="bg-white/5 border-white/10 text-white placeholder:text-white/30" data-testid="input-org-name" />
                </div>
              )}

              {listingType === "SERVICE" && (
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-white">Pricing Packages (optional)</h3>
                  <p className="text-xs text-white/40">Add up to 3 pricing tiers for your service</p>
                  {packages.map((pkg, pi) => (
                    <div key={pi} className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10px] text-white/40 block mb-0.5">Package Name</label>
                          <Input value={pkg.name} onChange={e => updatePackage(pi, "name", e.target.value)} placeholder={["Basic", "Standard", "Premium"][pi]} className="h-8 text-xs bg-white/5 border-white/10 text-white placeholder:text-white/30" data-testid={`input-pkg-name-${pi}`} />
                        </div>
                        <div>
                          <label className="text-[10px] text-white/40 block mb-0.5">Price ($)</label>
                          <Input type="number" value={pkg.price} onChange={e => updatePackage(pi, "price", e.target.value)} placeholder="0" className="h-8 text-xs bg-white/5 border-white/10 text-white placeholder:text-white/30" data-testid={`input-pkg-price-${pi}`} />
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] text-white/40 block mb-0.5">Description</label>
                        <Input value={pkg.description} onChange={e => updatePackage(pi, "description", e.target.value)} placeholder="What's included" className="h-8 text-xs bg-white/5 border-white/10 text-white placeholder:text-white/30" data-testid={`input-pkg-desc-${pi}`} />
                      </div>
                      <div>
                        <label className="text-[10px] text-white/40 block mb-0.5">Features</label>
                        {pkg.features.map((f, fi) => (
                          <div key={fi} className="flex gap-1.5 mb-1.5">
                            <Input value={f} onChange={e => updateFeature(pi, fi, e.target.value)} placeholder="Feature..." className="h-7 text-xs bg-white/5 border-white/10 text-white placeholder:text-white/30 flex-1" data-testid={`input-pkg-feature-${pi}-${fi}`} />
                            <button onClick={() => removeFeature(pi, fi)} className="text-white/30 hover:text-red-400"><X className="h-3 w-3" /></button>
                          </div>
                        ))}
                        <button onClick={() => addFeature(pi)} className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1">
                          <Plus className="h-3 w-3" /> Add feature
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div>
                <label className="text-xs font-medium text-white/60 mb-1 block">Neighborhood / Location</label>
                <Input value={neighborhood} onChange={e => setNeighborhood(e.target.value)} placeholder="e.g., South End, NoDa, Uptown" className="bg-white/5 border-white/10 text-white placeholder:text-white/30" data-testid="input-neighborhood" />
              </div>

              {["HOUSING_SUPPLY", "HOUSING_DEMAND", "COMMERCIAL_PROPERTY", "HOUSING"].includes(listingType) && (
                <>
                  <h3 className="text-sm font-bold text-white pt-2">Address</h3>
                  <div>
                    <label className="text-xs font-medium text-white/60 mb-1 block">Street Address</label>
                    <Input value={address} onChange={e => setAddress(e.target.value)} placeholder="123 Main St" className="bg-white/5 border-white/10 text-white placeholder:text-white/30" data-testid="input-address" />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="text-xs font-medium text-white/60 mb-1 block">City</label>
                      <Input value={addressCity} onChange={e => setAddressCity(e.target.value)} placeholder="Charlotte" className="bg-white/5 border-white/10 text-white placeholder:text-white/30" data-testid="input-address-city" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-white/60 mb-1 block">State</label>
                      <Input value={addressState} onChange={e => setAddressState(e.target.value)} placeholder="NC" className="bg-white/5 border-white/10 text-white placeholder:text-white/30" data-testid="input-address-state" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-white/60 mb-1 block">ZIP</label>
                      <Input value={addressZip} onChange={e => setAddressZip(e.target.value)} placeholder="28202" className="bg-white/5 border-white/10 text-white placeholder:text-white/30" data-testid="input-address-zip" />
                    </div>
                  </div>
                </>
              )}

              <div>
                <label className="text-xs font-medium text-white/60 mb-1 block">Cover Image URL</label>
                <Input value={imageUrl} onChange={e => setImageUrl(e.target.value)} placeholder="https://..." className="bg-white/5 border-white/10 text-white placeholder:text-white/30" data-testid="input-image-url" />
              </div>

              <div>
                <label className="text-xs font-medium text-white/60 mb-1 block">Additional Photos (up to 6)</label>
                {galleryImages.map((img, i) => (
                  <div key={i} className="flex gap-2 mb-2">
                    <Input value={img} onChange={e => updateGalleryImage(i, e.target.value)} placeholder="Image URL..." className="flex-1 h-8 text-xs bg-white/5 border-white/10 text-white placeholder:text-white/30" data-testid={`input-gallery-${i}`} />
                    <button onClick={() => removeGalleryImage(i)} className="text-white/30 hover:text-red-400"><X className="h-4 w-4" /></button>
                  </div>
                ))}
                {galleryImages.length < 6 && (
                  <button onClick={addGalleryImage} className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1" data-testid="button-add-gallery">
                    <Plus className="h-3 w-3" /> Add photo
                  </button>
                )}
              </div>

              <h3 className="text-sm font-bold text-white pt-2">Contact Info</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-medium text-white/60 mb-1 block">Name</label>
                  <Input value={contactName} onChange={e => setContactName(e.target.value)} placeholder="Your name" className="bg-white/5 border-white/10 text-white placeholder:text-white/30" data-testid="input-contact-name" />
                </div>
                <div>
                  <label className="text-xs font-medium text-white/60 mb-1 block">Email</label>
                  <Input type="email" value={contactEmail} onChange={e => setContactEmail(e.target.value)} placeholder="your@email.com" className="bg-white/5 border-white/10 text-white placeholder:text-white/30" data-testid="input-contact-email" />
                </div>
                <div>
                  <label className="text-xs font-medium text-white/60 mb-1 block">Phone</label>
                  <Input type="tel" value={contactPhone} onChange={e => setContactPhone(e.target.value)} placeholder="(555) 123-4567" className="bg-white/5 border-white/10 text-white placeholder:text-white/30" data-testid="input-contact-phone" />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <Button variant="outline" onClick={() => setStep(1)} className="border-white/10 text-white/60" data-testid="button-back-step">
                  Back
                </Button>
                <Button
                  onClick={() => {
                    if (!title || !description) {
                      toast({ title: "Missing fields", description: "Title and description are required", variant: "destructive" });
                      return;
                    }
                    createMutation.mutate();
                  }}
                  disabled={createMutation.isPending}
                  className="flex-1 bg-amber-500 hover:bg-amber-600 text-black font-bold"
                  data-testid="button-publish"
                >
                  {createMutation.isPending ? (isEditMode ? "Saving..." : "Publishing...") : (isEditMode ? "Save Changes" : "Publish Listing")}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DarkPageShell>
  );
}
