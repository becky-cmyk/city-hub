import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Search, Loader2, CheckCircle2, Building2, MapPin, Phone, Globe, Clock,
  AlertTriangle, Plus, ExternalLink
} from "lucide-react";

interface LookupResult {
  placeId: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  website: string;
  hours: Record<string, string> | null;
  types: string[];
  lat: string;
  lng: string;
  alreadyExists: boolean;
  existingPresence: { id: string; name: string; slug: string } | null;
}

export default function QuickClaimPanel({ cityId }: { cityId?: string }) {
  const { toast } = useToast();
  const [searchInput, setSearchInput] = useState("");
  const [lookupData, setLookupData] = useState<LookupResult | null>(null);
  const [editName, setEditName] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editCity, setEditCity] = useState("");
  const [editState, setEditState] = useState("");
  const [editZip, setEditZip] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editWebsite, setEditWebsite] = useState("");
  const [editType, setEditType] = useState<"commerce" | "organization">("commerce");
  const [editTier, setEditTier] = useState<"FREE" | "VERIFIED" | "ENHANCED" | "ENTERPRISE">("VERIFIED");
  const [justCreated, setJustCreated] = useState<{ id: string; name: string } | null>(null);

  const lookupMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/claim-lookup", { input: searchInput });
      return res.json();
    },
    onSuccess: (data: LookupResult) => {
      setLookupData(data);
      setEditName(data.name);
      setEditAddress(data.address);
      setEditCity(data.city || "Charlotte");
      setEditState(data.state || "NC");
      setEditZip(data.zip);
      setEditPhone(data.phone);
      setEditWebsite(data.website);
      setJustCreated(null);
    },
    onError: (e: any) => {
      toast({ title: "Lookup failed", description: e.message, variant: "destructive" });
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/claim-create", {
        placeId: lookupData?.placeId,
        name: editName,
        address: editAddress,
        city: editCity,
        state: editState,
        zip: editZip,
        phone: editPhone,
        websiteUrl: editWebsite,
        hours: lookupData?.hours,
        lat: lookupData?.lat || "",
        lng: lookupData?.lng || "",
        presenceType: editType,
        listingTier: editTier,
      });
      return res.json();
    },
    onSuccess: (data: any) => {
      setJustCreated({ id: data.id, name: data.name });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/businesses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/listings-to-claim"] });
      toast({ title: "Listing created!", description: `${data.name} has been added.` });
    },
    onError: (e: any) => {
      toast({ title: "Failed to create listing", description: e.message, variant: "destructive" });
    },
  });

  const handleReset = () => {
    setSearchInput("");
    setLookupData(null);
    setJustCreated(null);
    setEditName("");
    setEditAddress("");
    setEditCity("");
    setEditState("");
    setEditZip("");
    setEditPhone("");
    setEditWebsite("");
    setEditType("commerce");
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="font-semibold text-lg flex items-center gap-2" data-testid="text-quick-claim-title">
          <Plus className="h-5 w-5" />
          Quick Claim
        </h2>
        <p className="text-sm text-muted-foreground">
          Paste a Google Maps URL, Place ID, or business name to auto-populate and create a listing
        </p>
      </div>

      <Card className="p-4 space-y-4" data-testid="claim-search-form">
        <div className="space-y-2">
          <Label>Google Maps URL, Place ID, or Business Name</Label>
          <div className="flex gap-2">
            <Input
              placeholder="e.g. https://maps.google.com/... or 'Amelie's French Bakery Charlotte'"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && searchInput.trim() && lookupMutation.mutate()}
              className="flex-1"
              data-testid="input-claim-search"
            />
            <Button
              onClick={() => lookupMutation.mutate()}
              disabled={!searchInput.trim() || lookupMutation.isPending}
              data-testid="button-claim-lookup"
            >
              {lookupMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Search className="h-4 w-4 mr-2" />
              )}
              Look Up
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Accepts: Google Maps links, Place IDs (ChIJ...), or business names (biased toward Charlotte area)
          </p>
        </div>
      </Card>

      {justCreated && (
        <Card className="p-4 border-green-500/50 bg-green-50 dark:bg-green-950/20" data-testid="card-created-success">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-6 w-6 text-green-600 shrink-0" />
            <div className="flex-1">
              <p className="font-semibold text-sm text-green-800 dark:text-green-300">
                Listing Created: {justCreated.name}
              </p>
              <p className="text-xs text-green-700 dark:text-green-400">
                Added to your listings. You can find it in the Businesses panel.
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={handleReset} data-testid="button-claim-another">
              Claim Another
            </Button>
          </div>
        </Card>
      )}

      {lookupData && !justCreated && (
        <Card className="p-5 space-y-5" data-testid="card-lookup-result">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">Business Details</h3>
            </div>
            <div className="flex items-center gap-2">
              {lookupData.alreadyExists && (
                <Badge variant="destructive" className="gap-1" data-testid="badge-already-exists">
                  <AlertTriangle className="h-3 w-3" />
                  Already Imported
                </Badge>
              )}
              {lookupData.placeId && (
                <Badge variant="outline" className="text-xs gap-1">
                  <ExternalLink className="h-3 w-3" />
                  Google Verified
                </Badge>
              )}
            </div>
          </div>

          {lookupData.alreadyExists && lookupData.existingPresence && (
            <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-md p-3">
              <p className="text-sm text-amber-800 dark:text-amber-300">
                This business already exists as <strong>"{lookupData.existingPresence.name}"</strong>.
                Creating again will make a duplicate.
              </p>
            </div>
          )}

          <Separator />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Business Name</Label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                data-testid="input-edit-name"
              />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={editType} onValueChange={(v) => setEditType(v as any)}>
                <SelectTrigger data-testid="select-edit-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="commerce">Commerce</SelectItem>
                  <SelectItem value="organization">Organization</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Listing Tier</Label>
              <Select value={editTier} onValueChange={(v) => setEditTier(v as any)}>
                <SelectTrigger data-testid="select-edit-tier"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="FREE">Free</SelectItem>
                  <SelectItem value="VERIFIED">Verified ($1)</SelectItem>
                  <SelectItem value="ENHANCED">Enhanced ($99)</SelectItem>
                  <SelectItem value="ENTERPRISE">Enterprise (Custom)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" /> Address
            </Label>
            <Input
              value={editAddress}
              onChange={(e) => setEditAddress(e.target.value)}
              data-testid="input-edit-address"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label>City</Label>
              <Input value={editCity} onChange={(e) => setEditCity(e.target.value)} data-testid="input-edit-city" />
            </div>
            <div className="space-y-2">
              <Label>State</Label>
              <Input value={editState} onChange={(e) => setEditState(e.target.value)} data-testid="input-edit-state" />
            </div>
            <div className="space-y-2">
              <Label>ZIP</Label>
              <Input value={editZip} onChange={(e) => setEditZip(e.target.value)} data-testid="input-edit-zip" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-1">
                <Phone className="h-3.5 w-3.5" /> Phone
              </Label>
              <Input
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
                data-testid="input-edit-phone"
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1">
                <Globe className="h-3.5 w-3.5" /> Website
              </Label>
              <Input
                value={editWebsite}
                onChange={(e) => setEditWebsite(e.target.value)}
                data-testid="input-edit-website"
              />
            </div>
          </div>

          {lookupData.hours && Object.keys(lookupData.hours).length > 0 && (
            <div className="space-y-2">
              <Label className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" /> Hours of Operation
              </Label>
              <div className="bg-muted/50 rounded-md p-3 text-sm space-y-1">
                {Object.entries(lookupData.hours).map(([day, time]) => (
                  <div key={day} className="flex justify-between gap-4">
                    <span className="font-medium text-xs">{day}</span>
                    <span className="text-xs text-muted-foreground">{time}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {lookupData.types && lookupData.types.length > 0 && (
            <div className="space-y-2">
              <Label>Google Categories</Label>
              <div className="flex flex-wrap gap-1">
                {lookupData.types.slice(0, 8).map((t) => (
                  <Badge key={t} variant="outline" className="text-xs">
                    {t.replace(/_/g, " ")}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <Separator />

          <div className="flex items-center justify-between gap-3">
            <Button variant="outline" onClick={handleReset} data-testid="button-cancel-claim">
              Cancel
            </Button>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={!editName.trim() || createMutation.isPending}
              data-testid="button-create-listing"
            >
              {createMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4 mr-2" />
              )}
              Create Listing
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
