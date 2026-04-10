import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Upload, Search, Image, FileText, Video, X, Camera, Building2, MapPin, Tag, Loader2, DollarSign } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface CmsAsset {
  id: string;
  fileUrl: string;
  fileType: string;
  mimeType: string | null;
  width: number | null;
  height: number | null;
  altTextEn: string | null;
  altTextEs: string | null;
  captionEn: string | null;
  captionEs: string | null;
  uploadedByUserId: string | null;
  creditName: string | null;
  creditUrl: string | null;
  licenseType: string | null;
  linkedBusinessId: string | null;
  linkedCreatorId: string | null;
  categoryIds: string[] | null;
  zoneId: string | null;
  hubSlug: string | null;
  tags: string[] | null;
  status: string | null;
  priceInCents: number | null;
  hubUseApproved: boolean;
  createdAt: string;
}

interface Category {
  id: string;
  name: string;
  parentCategoryId: string | null;
}

interface Zone {
  id: string;
  name: string;
  zoneType: string;
  hubSlug: string | null;
}

interface BusinessOption {
  id: string;
  name: string;
}

const FILE_TYPE_ICONS: Record<string, any> = {
  image: Image,
  video: Video,
  pdf: FileText,
  other: FileText,
};

const LICENSE_OPTIONS = [
  { value: "owned", label: "Owned" },
  { value: "licensed", label: "Licensed" },
  { value: "creative_commons", label: "Creative Commons" },
  { value: "stock", label: "Stock" },
  { value: "user_submitted", label: "User Submitted" },
];

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString();
}

function TagInput({ tags, onChange }: { tags: string[]; onChange: (t: string[]) => void }) {
  const [input, setInput] = useState("");

  function addTag() {
    const val = input.trim().toLowerCase();
    if (val && !tags.includes(val)) {
      onChange([...tags, val]);
    }
    setInput("");
  }

  return (
    <div className="space-y-1.5">
      <div className="flex gap-1.5">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
          placeholder="Add tag and press Enter"
          className="flex-1"
          data-testid="input-tag"
        />
        <Button size="sm" variant="outline" type="button" onClick={addTag} data-testid="button-add-tag">
          <Tag className="h-3 w-3 mr-1" /> Add
        </Button>
      </div>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {tags.map((tag) => (
            <Badge key={tag} variant="secondary" className="text-[11px] gap-1">
              {tag}
              <button
                type="button"
                onClick={() => onChange(tags.filter((t) => t !== tag))}
                data-testid={`button-remove-tag-${tag}`}
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

function BusinessSearch({ value, onChange }: { value: string; onChange: (id: string, name: string) => void }) {
  const [query, setQuery] = useState("");
  const [selectedName, setSelectedName] = useState("");

  const { data: results } = useQuery<BusinessOption[]>({
    queryKey: ["/api/admin/businesses", { search: query }],
    queryFn: async () => {
      if (!query || query.length < 2) return [];
      const params = new URLSearchParams({ search: query, limit: "8" });
      const res = await fetch(`/api/admin/businesses?${params.toString()}`, { credentials: "include" });
      if (!res.ok) return [];
      const data = await res.json();
      return (data.businesses || data || []).map((b: any) => ({ id: b.id, name: b.name }));
    },
    enabled: query.length >= 2,
  });

  useEffect(() => {
    if (!value) setSelectedName("");
  }, [value]);

  if (value && selectedName) {
    return (
      <div className="flex items-center gap-2">
        <Badge variant="secondary" className="text-xs gap-1">
          <Building2 className="h-3 w-3" /> {selectedName}
          <button type="button" onClick={() => { onChange("", ""); setSelectedName(""); }} data-testid="button-clear-business">
            <X className="h-2.5 w-2.5" />
          </button>
        </Badge>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search businesses..."
        data-testid="input-search-business"
      />
      {results && results.length > 0 && (
        <div className="border rounded-md max-h-32 overflow-y-auto">
          {results.map((b) => (
            <button
              key={b.id}
              type="button"
              className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted transition-colors"
              onClick={() => { onChange(b.id, b.name); setSelectedName(b.name); setQuery(""); }}
              data-testid={`option-business-${b.id}`}
            >
              {b.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function CmsMediaLibrary({
  mode = "standalone",
  onSelect,
  cityId,
}: {
  mode?: "standalone" | "picker";
  cityId?: string;
  onSelect?: (asset: CmsAsset) => void;
}) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");
  const [fileType, setFileType] = useState("all");
  const [licenseFilter, setLicenseFilter] = useState("all");
  const [hubFilter, setHubFilter] = useState("all");
  const [editingAsset, setEditingAsset] = useState<CmsAsset | null>(null);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingPreview, setPendingPreview] = useState("");

  const [editAltEn, setEditAltEn] = useState("");
  const [editAltEs, setEditAltEs] = useState("");
  const [editCaptionEn, setEditCaptionEn] = useState("");
  const [editCaptionEs, setEditCaptionEs] = useState("");
  const [editCreditName, setEditCreditName] = useState("");
  const [editCreditUrl, setEditCreditUrl] = useState("");
  const [editLicense, setEditLicense] = useState("owned");
  const [editBusinessId, setEditBusinessId] = useState("");
  const [editBusinessName, setEditBusinessName] = useState("");
  const [editCreatorId, setEditCreatorId] = useState("");
  const [editHubSlug, setEditHubSlug] = useState("");
  const [editZoneId, setEditZoneId] = useState("");
  const [editCategoryIds, setEditCategoryIds] = useState<string[]>([]);
  const [editTags, setEditTags] = useState<string[]>([]);
  const [editPriceDollars, setEditPriceDollars] = useState("");
  const [editHubUseApproved, setEditHubUseApproved] = useState(false);

  const queryParams = new URLSearchParams();
  if (fileType !== "all") queryParams.set("fileType", fileType);
  if (search) queryParams.set("search", search);
  if (licenseFilter !== "all") queryParams.set("licenseType", licenseFilter);
  if (hubFilter !== "all") queryParams.set("hubSlug", hubFilter);
  const url = `/api/admin/cms/assets?${queryParams.toString()}`;

  const { data: assets, isLoading } = useQuery<CmsAsset[]>({
    queryKey: [url],
  });

  const { data: categories } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  const { data: zones } = useQuery<Zone[]>({
    queryKey: ["/api/admin/zones"],
  });

  const uniqueHubs = zones
    ? Array.from(new Set(zones.filter((z) => z.hubSlug).map((z) => z.hubSlug as string)))
    : [];

  const uploadMutation = useMutation({
    mutationFn: async ({ file, metadata }: { file: File; metadata: Record<string, any> }) => {
      const formData = new FormData();
      formData.append("file", file);
      Object.entries(metadata).forEach(([k, v]) => {
        if (v !== null && v !== undefined && v !== "") {
          if (Array.isArray(v)) {
            formData.append(k, JSON.stringify(v));
          } else {
            formData.append(k, String(v));
          }
        }
      });
      const res = await fetch("/api/admin/cms/assets", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) throw new Error("Upload failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (q) => String(q.queryKey[0]).startsWith("/api/admin/cms/assets") });
      toast({ title: "File uploaded" });
      setShowUploadDialog(false);
      resetForm();
    },
    onError: (err: any) => {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      return apiRequest("PATCH", `/api/admin/cms/assets/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (q) => String(q.queryKey[0]).startsWith("/api/admin/cms/assets") });
      setEditingAsset(null);
      toast({ title: "Asset updated" });
    },
  });

  function resetForm() {
    setPendingFile(null);
    setPendingPreview("");
    setEditAltEn("");
    setEditAltEs("");
    setEditCaptionEn("");
    setEditCaptionEs("");
    setEditCreditName("");
    setEditCreditUrl("");
    setEditLicense("owned");
    setEditBusinessId("");
    setEditBusinessName("");
    setEditCreatorId("");
    setEditHubSlug("");
    setEditZoneId("");
    setEditCategoryIds([]);
    setEditTags([]);
    setEditPriceDollars("");
    setEditHubUseApproved(false);
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || !files[0]) return;
    const file = files[0];
    setPendingFile(file);
    setEditAltEn(file.name.replace(/\.[^/.]+$/, ""));
    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = () => setPendingPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
    setShowUploadDialog(true);
    e.target.value = "";
  }

  function handleUploadSubmit() {
    if (!pendingFile) return;
    uploadMutation.mutate({
      file: pendingFile,
      metadata: {
        altTextEn: editAltEn,
        altTextEs: editAltEs,
        captionEn: editCaptionEn,
        captionEs: editCaptionEs,
        creditName: editCreditName,
        creditUrl: editCreditUrl,
        licenseType: editLicense,
        linkedBusinessId: editBusinessId,
        linkedCreatorId: editCreatorId,
        hubSlug: editHubSlug,
        zoneId: editZoneId,
        categoryIds: editCategoryIds,
        tags: editTags,
        priceInCents: editPriceDollars ? Math.round(parseFloat(editPriceDollars) * 100) : null,
        hubUseApproved: editHubUseApproved,
      },
    });
  }

  function openEdit(asset: CmsAsset) {
    setEditingAsset(asset);
    setEditAltEn(asset.altTextEn || "");
    setEditAltEs(asset.altTextEs || "");
    setEditCaptionEn(asset.captionEn || "");
    setEditCaptionEs(asset.captionEs || "");
    setEditCreditName(asset.creditName || "");
    setEditCreditUrl(asset.creditUrl || "");
    setEditLicense(asset.licenseType || "owned");
    setEditBusinessId(asset.linkedBusinessId || "");
    setEditBusinessName("");
    setEditCreatorId(asset.linkedCreatorId || "");
    setEditHubSlug(asset.hubSlug || "");
    setEditZoneId(asset.zoneId || "");
    setEditCategoryIds(asset.categoryIds || []);
    setEditTags(asset.tags || []);
    setEditPriceDollars(asset.priceInCents ? (asset.priceInCents / 100).toFixed(2) : "");
    setEditHubUseApproved(asset.hubUseApproved ?? false);
  }

  function handleEditSave() {
    if (!editingAsset) return;
    updateMutation.mutate({
      id: editingAsset.id,
      data: {
        altTextEn: editAltEn,
        altTextEs: editAltEs,
        captionEn: editCaptionEn,
        captionEs: editCaptionEs,
        creditName: editCreditName || null,
        creditUrl: editCreditUrl || null,
        licenseType: editLicense,
        linkedBusinessId: editBusinessId || null,
        linkedCreatorId: editCreatorId || null,
        hubSlug: editHubSlug || null,
        zoneId: editZoneId || null,
        categoryIds: editCategoryIds,
        tags: editTags,
        priceInCents: editPriceDollars ? Math.round(parseFloat(editPriceDollars) * 100) : null,
        hubUseApproved: editHubUseApproved,
      },
    });
  }

  const l1Categories = categories?.filter((c) => !c.parentCategoryId) || [];

  return (
    <div className="space-y-4" data-testid="cms-media-library">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">
          {mode === "picker" ? "Select an Asset" : "Media Library"}
        </h2>
        <div>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept="image/*,video/mp4,application/pdf"
            onChange={handleFileSelect}
            data-testid="input-file-upload"
          />
          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadMutation.isPending}
            data-testid="button-upload-file"
          >
            <Upload className="w-4 h-4 mr-2" />
            Upload
          </Button>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search assets..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            data-testid="input-search-assets"
          />
        </div>
        <Select value={fileType} onValueChange={setFileType}>
          <SelectTrigger className="w-[120px]" data-testid="select-file-type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="image">Images</SelectItem>
            <SelectItem value="video">Videos</SelectItem>
            <SelectItem value="pdf">PDFs</SelectItem>
          </SelectContent>
        </Select>
        <Select value={licenseFilter} onValueChange={setLicenseFilter}>
          <SelectTrigger className="w-[140px]" data-testid="select-license-filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Licenses</SelectItem>
            {LICENSE_OPTIONS.map((l) => (
              <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {uniqueHubs.length > 0 && (
          <Select value={hubFilter} onValueChange={setHubFilter}>
            <SelectTrigger className="w-[140px]" data-testid="select-hub-filter">
              <MapPin className="h-3.5 w-3.5 mr-1" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Hubs</SelectItem>
              {uniqueHubs.map((h) => (
                <SelectItem key={h} value={h}>{h}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square rounded-lg" />
          ))}
        </div>
      ) : !assets?.length ? (
        <Card className="p-8 text-center text-muted-foreground">
          <Image className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p>No assets found. Upload your first file to get started.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {assets.map((asset) => {
            const Icon = FILE_TYPE_ICONS[asset.fileType] || FileText;
            return (
              <Card
                key={asset.id}
                className={`overflow-hidden cursor-pointer group hover:ring-2 hover:ring-primary transition-all ${
                  mode === "picker" ? "hover:shadow-lg" : ""
                }`}
                onClick={() => mode === "picker" && onSelect?.(asset)}
                data-testid={`card-asset-${asset.id}`}
              >
                <div className="aspect-square bg-muted relative flex items-center justify-center">
                  {asset.fileType === "image" ? (
                    <img
                      src={asset.fileUrl}
                      alt={asset.altTextEn || ""}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Icon className="w-12 h-12 text-muted-foreground" />
                  )}
                  {mode === "standalone" && (
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                      <Button
                        size="icon"
                        variant="secondary"
                        className="h-8 w-8"
                        onClick={(e) => { e.stopPropagation(); openEdit(asset); }}
                        data-testid={`button-edit-asset-${asset.id}`}
                      >
                        <Camera className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
                <div className="p-2 space-y-1">
                  <p className="text-xs font-medium truncate">
                    {asset.altTextEn || "Untitled"}
                  </p>
                  {asset.creditName && (
                    <p className="text-[10px] text-muted-foreground truncate">
                      by {asset.creditName}
                    </p>
                  )}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1 flex-wrap">
                      <Badge variant="outline" className="text-[10px]">
                        {asset.fileType}
                      </Badge>
                      {asset.licenseType && asset.licenseType !== "owned" && (
                        <Badge variant="outline" className="text-[10px]">
                          {asset.licenseType}
                        </Badge>
                      )}
                      {asset.priceInCents && (
                        <Badge className="text-[10px] bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
                          ${(asset.priceInCents / 100).toFixed(2)}
                        </Badge>
                      )}
                      {asset.hubUseApproved && (
                        <Badge className="text-[10px] bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300">
                          Hub Use
                        </Badge>
                      )}
                    </div>
                    <span className="text-[10px] text-muted-foreground">
                      {formatDate(asset.createdAt)}
                    </span>
                  </div>
                  {(asset.tags?.length ?? 0) > 0 && (
                    <div className="flex flex-wrap gap-0.5">
                      {asset.tags!.slice(0, 3).map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-[9px] px-1 py-0">
                          {tag}
                        </Badge>
                      ))}
                      {asset.tags!.length > 3 && (
                        <span className="text-[9px] text-muted-foreground">+{asset.tags!.length - 3}</span>
                      )}
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={showUploadDialog} onOpenChange={(open) => { if (!open) { setShowUploadDialog(false); resetForm(); } }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Upload Asset</DialogTitle>
            <DialogDescription>Add details, credit, and connections for this file.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {pendingPreview && (
              <div className="aspect-video bg-muted rounded overflow-hidden">
                <img src={pendingPreview} alt="" className="w-full h-full object-contain" />
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Alt Text (EN)</Label>
                <Input value={editAltEn} onChange={(e) => setEditAltEn(e.target.value)} data-testid="input-upload-alt-en" />
              </div>
              <div>
                <Label>Alt Text (ES)</Label>
                <Input value={editAltEs} onChange={(e) => setEditAltEs(e.target.value)} data-testid="input-upload-alt-es" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Caption (EN)</Label>
                <Input value={editCaptionEn} onChange={(e) => setEditCaptionEn(e.target.value)} data-testid="input-upload-caption-en" />
              </div>
              <div>
                <Label>Caption (ES)</Label>
                <Input value={editCaptionEs} onChange={(e) => setEditCaptionEs(e.target.value)} data-testid="input-upload-caption-es" />
              </div>
            </div>

            <div className="border-t pt-3 space-y-3">
              <h4 className="text-sm font-semibold flex items-center gap-1.5">
                <Camera className="h-3.5 w-3.5" /> Credit / Attribution
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Credit Name</Label>
                  <Input value={editCreditName} onChange={(e) => setEditCreditName(e.target.value)} placeholder="Photographer name" data-testid="input-upload-credit-name" />
                </div>
                <div>
                  <Label>Credit URL</Label>
                  <Input value={editCreditUrl} onChange={(e) => setEditCreditUrl(e.target.value)} placeholder="https://..." data-testid="input-upload-credit-url" />
                </div>
              </div>
              <div>
                <Label>License</Label>
                <Select value={editLicense} onValueChange={setEditLicense}>
                  <SelectTrigger data-testid="select-upload-license">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LICENSE_OPTIONS.map((l) => (
                      <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="border-t pt-3 space-y-3">
              <h4 className="text-sm font-semibold flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5" /> Connections
              </h4>
              <div>
                <Label>Linked Business</Label>
                <BusinessSearch value={editBusinessId} onChange={(id, name) => { setEditBusinessId(id); setEditBusinessName(name); }} />
              </div>
              <div>
                <Label>Creator ID</Label>
                <Input value={editCreatorId} onChange={(e) => setEditCreatorId(e.target.value)} placeholder="CRM contact or user ID" data-testid="input-upload-creator" />
              </div>
            </div>

            <div className="border-t pt-3 space-y-3">
              <h4 className="text-sm font-semibold flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" /> Location & Categories
              </h4>
              {uniqueHubs.length > 0 && (
                <div>
                  <Label>Hub</Label>
                  <Select value={editHubSlug || "_none"} onValueChange={(v) => setEditHubSlug(v === "_none" ? "" : v)}>
                    <SelectTrigger data-testid="select-upload-hub">
                      <SelectValue placeholder="Select hub" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">None</SelectItem>
                      {uniqueHubs.map((h) => (
                        <SelectItem key={h} value={h}>{h}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {zones && zones.length > 0 && (
                <div>
                  <Label>Zone</Label>
                  <Select value={editZoneId || "_none"} onValueChange={(v) => setEditZoneId(v === "_none" ? "" : v)}>
                    <SelectTrigger data-testid="select-upload-zone">
                      <SelectValue placeholder="Select zone" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">None</SelectItem>
                      {zones.map((z) => (
                        <SelectItem key={z.id} value={z.id}>{z.name} ({z.zoneType})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {l1Categories.length > 0 && (
                <div>
                  <Label>Categories</Label>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {l1Categories.map((cat) => {
                      const selected = editCategoryIds.includes(cat.id);
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
                            selected
                              ? "bg-foreground text-background border-foreground"
                              : "bg-transparent text-foreground border-border hover:bg-muted"
                          }`}
                          onClick={() => {
                            setEditCategoryIds(
                              selected
                                ? editCategoryIds.filter((id) => id !== cat.id)
                                : [...editCategoryIds, cat.id]
                            );
                          }}
                          data-testid={`button-category-${cat.id}`}
                        >
                          {cat.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="border-t pt-3 space-y-2">
              <Label>Tags</Label>
              <TagInput tags={editTags} onChange={setEditTags} />
            </div>

            <div className="border-t pt-3 space-y-3">
              <h4 className="text-sm font-semibold flex items-center gap-1.5">
                <DollarSign className="h-3.5 w-3.5" /> Pricing & Hub Use
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Download Price ($)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={editPriceDollars}
                    onChange={(e) => setEditPriceDollars(e.target.value)}
                    placeholder="e.g. 4.99"
                    data-testid="input-upload-price"
                  />
                </div>
                <div className="flex items-end pb-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editHubUseApproved}
                      onChange={(e) => setEditHubUseApproved(e.target.checked)}
                      className="w-4 h-4 rounded border-gray-300"
                      data-testid="checkbox-upload-hub-use"
                    />
                    <span className="text-sm">Approved for Hub Use</span>
                  </label>
                </div>
              </div>
            </div>

            <Button
              className="w-full"
              disabled={uploadMutation.isPending || !pendingFile}
              onClick={handleUploadSubmit}
              data-testid="button-submit-upload"
            >
              {uploadMutation.isPending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Uploading...</>
              ) : (
                <><Upload className="h-4 w-4 mr-2" /> Upload Asset</>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingAsset} onOpenChange={() => setEditingAsset(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Asset Details</DialogTitle>
            <DialogDescription>Update metadata, credit, and connections for this asset.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {editingAsset?.fileType === "image" && (
              <div className="aspect-video bg-muted rounded overflow-hidden">
                <img
                  src={editingAsset.fileUrl}
                  alt=""
                  className="w-full h-full object-contain"
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Alt Text (EN)</Label>
                <Input value={editAltEn} onChange={(e) => setEditAltEn(e.target.value)} data-testid="input-alt-en" />
              </div>
              <div>
                <Label>Alt Text (ES)</Label>
                <Input value={editAltEs} onChange={(e) => setEditAltEs(e.target.value)} data-testid="input-alt-es" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Caption (EN)</Label>
                <Input value={editCaptionEn} onChange={(e) => setEditCaptionEn(e.target.value)} data-testid="input-caption-en" />
              </div>
              <div>
                <Label>Caption (ES)</Label>
                <Input value={editCaptionEs} onChange={(e) => setEditCaptionEs(e.target.value)} data-testid="input-caption-es" />
              </div>
            </div>

            <div className="border-t pt-3 space-y-3">
              <h4 className="text-sm font-semibold flex items-center gap-1.5">
                <Camera className="h-3.5 w-3.5" /> Credit / Attribution
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Credit Name</Label>
                  <Input value={editCreditName} onChange={(e) => setEditCreditName(e.target.value)} placeholder="Photographer name" data-testid="input-edit-credit-name" />
                </div>
                <div>
                  <Label>Credit URL</Label>
                  <Input value={editCreditUrl} onChange={(e) => setEditCreditUrl(e.target.value)} placeholder="https://..." data-testid="input-edit-credit-url" />
                </div>
              </div>
              <div>
                <Label>License</Label>
                <Select value={editLicense} onValueChange={setEditLicense}>
                  <SelectTrigger data-testid="select-edit-license">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LICENSE_OPTIONS.map((l) => (
                      <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="border-t pt-3 space-y-3">
              <h4 className="text-sm font-semibold flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5" /> Connections
              </h4>
              <div>
                <Label>Linked Business</Label>
                <BusinessSearch value={editBusinessId} onChange={(id, name) => { setEditBusinessId(id); setEditBusinessName(name); }} />
              </div>
              <div>
                <Label>Creator ID</Label>
                <Input value={editCreatorId} onChange={(e) => setEditCreatorId(e.target.value)} placeholder="CRM contact or user ID" data-testid="input-edit-creator" />
              </div>
            </div>

            <div className="border-t pt-3 space-y-3">
              <h4 className="text-sm font-semibold flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" /> Location & Categories
              </h4>
              {uniqueHubs.length > 0 && (
                <div>
                  <Label>Hub</Label>
                  <Select value={editHubSlug || "_none"} onValueChange={(v) => setEditHubSlug(v === "_none" ? "" : v)}>
                    <SelectTrigger data-testid="select-edit-hub">
                      <SelectValue placeholder="Select hub" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">None</SelectItem>
                      {uniqueHubs.map((h) => (
                        <SelectItem key={h} value={h}>{h}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {zones && zones.length > 0 && (
                <div>
                  <Label>Zone</Label>
                  <Select value={editZoneId || "_none"} onValueChange={(v) => setEditZoneId(v === "_none" ? "" : v)}>
                    <SelectTrigger data-testid="select-edit-zone">
                      <SelectValue placeholder="Select zone" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">None</SelectItem>
                      {zones.map((z) => (
                        <SelectItem key={z.id} value={z.id}>{z.name} ({z.zoneType})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {l1Categories.length > 0 && (
                <div>
                  <Label>Categories</Label>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {l1Categories.map((cat) => {
                      const selected = editCategoryIds.includes(cat.id);
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
                            selected
                              ? "bg-foreground text-background border-foreground"
                              : "bg-transparent text-foreground border-border hover:bg-muted"
                          }`}
                          onClick={() => {
                            setEditCategoryIds(
                              selected
                                ? editCategoryIds.filter((id) => id !== cat.id)
                                : [...editCategoryIds, cat.id]
                            );
                          }}
                          data-testid={`button-edit-category-${cat.id}`}
                        >
                          {cat.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="border-t pt-3 space-y-2">
              <Label>Tags</Label>
              <TagInput tags={editTags} onChange={setEditTags} />
            </div>

            <div className="border-t pt-3 space-y-3">
              <h4 className="text-sm font-semibold flex items-center gap-1.5">
                <DollarSign className="h-3.5 w-3.5" /> Pricing & Hub Use
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Download Price ($)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={editPriceDollars}
                    onChange={(e) => setEditPriceDollars(e.target.value)}
                    placeholder="e.g. 4.99"
                    data-testid="input-edit-price"
                  />
                </div>
                <div className="flex items-end pb-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editHubUseApproved}
                      onChange={(e) => setEditHubUseApproved(e.target.checked)}
                      className="w-4 h-4 rounded border-gray-300"
                      data-testid="checkbox-edit-hub-use"
                    />
                    <span className="text-sm">Approved for Hub Use</span>
                  </label>
                </div>
              </div>
            </div>

            <Button
              className="w-full"
              disabled={updateMutation.isPending}
              onClick={handleEditSave}
              data-testid="button-save-asset"
            >
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
