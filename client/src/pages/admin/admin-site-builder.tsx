import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Sparkles, Eye, Save, ChevronUp, ChevronDown, Plus,
  Loader2, LayoutTemplate, Wand2, GripVertical, Trash2, RefreshCw,
  Globe, Type, Image, Users, Star, HelpCircle, Clock, Calendar,
  Phone, MessageSquare, Megaphone, X, Search, Building2,
  ExternalLink, Paintbrush, Crown, Zap, ArrowLeft
} from "lucide-react";
import type { MicrositeBlock, MicrositeBlockType, MicrositeTemplate, Business } from "@shared/schema";
import { MICROSITE_BLOCK_TYPES, MICROSITE_TEMPLATES, DEFAULT_MICROSITE_BLOCKS } from "@shared/schema";
import { TEMPLATE_STYLES } from "@/components/microsite/templates";

const BLOCK_ICONS: Record<string, any> = {
  hero: LayoutTemplate,
  about: Type,
  services: GripVertical,
  gallery: Image,
  testimonials: MessageSquare,
  cta: Megaphone,
  faq: HelpCircle,
  team: Users,
  hours: Clock,
  events: Calendar,
  reviews: Star,
  contact: Phone,
};

const BLOCK_LABELS: Record<string, string> = {
  hero: "Hero Banner",
  about: "About",
  services: "Services",
  gallery: "Gallery",
  testimonials: "Testimonials",
  cta: "Call to Action",
  faq: "FAQ",
  team: "Team",
  hours: "Hours & Location",
  events: "Events",
  reviews: "Reviews",
  contact: "Contact",
};

interface BlocksResponse {
  template: string;
  blocks: MicrositeBlock[];
}

export default function AdminSiteBuilder({ cityId }: { cityId?: string }) {
  const { toast } = useToast();
  const [selectedBusinessId, setSelectedBusinessId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [view, setView] = useState<"picker" | "create" | "editor">("picker");
  const [aiPrompt, setAiPrompt] = useState("");
  const [blocks, setBlocks] = useState<MicrositeBlock[]>([]);
  const [template, setTemplate] = useState<string>("modern");
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showAddBlock, setShowAddBlock] = useState(false);

  const { data: allBusinesses, isLoading: bizLoading } = useQuery<Business[]>({
    queryKey: ["/api/admin/businesses"],
  });

  const selectedBiz = allBusinesses?.find(b => b.id === selectedBusinessId);

  const { data: blocksData, isLoading: blocksLoading } = useQuery<BlocksResponse>({
    queryKey: ["/api/admin/presence", selectedBusinessId, "blocks"],
    queryFn: async () => {
      const res = await fetch(`/api/admin/presence/${selectedBusinessId}/blocks`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load blocks");
      return res.json();
    },
    enabled: !!selectedBusinessId && view !== "picker",
  });

  const hasExistingBlocks = !!(blocksData?.blocks && blocksData.blocks.length > 0 &&
    blocksData.blocks.some(b => b.content?.headline?.en || b.content?.body?.en));

  const loadBlocksIntoEditor = useCallback(() => {
    if (blocksData) {
      setBlocks(blocksData.blocks);
      setTemplate(blocksData.template || "modern");
      setView("editor");
    }
  }, [blocksData]);

  const generateMutation = useMutation({
    mutationFn: async (prompt: string) => {
      const res = await apiRequest("POST", `/api/admin/presence/${selectedBusinessId}/generate-site`, {
        prompt: prompt || undefined,
        auto: !prompt,
      });
      return res.json();
    },
    onSuccess: (data: any) => {
      setBlocks(data.blocks);
      setTemplate(data.template || "modern");
      setView("editor");
      setHasUnsavedChanges(false);
      toast({ title: "Site generated", description: "Charlotte has built the site. Review and customize it below." });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/presence", selectedBusinessId, "blocks"] });
    },
    onError: (err: any) => {
      toast({ title: "Generation failed", description: err.message || "Please try again.", variant: "destructive" });
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("PUT", `/api/admin/presence/${selectedBusinessId}/blocks`, { blocks });
      return true;
    },
    onSuccess: () => {
      setHasUnsavedChanges(false);
      toast({ title: "Site saved", description: "Changes have been published." });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/presence", selectedBusinessId, "blocks"] });
    },
    onError: () => {
      toast({ title: "Save failed", description: "Could not save the site. Please try again.", variant: "destructive" });
    },
  });

  const templateMutation = useMutation({
    mutationFn: async (newTemplate: string) => {
      await apiRequest("PUT", `/api/admin/presence/${selectedBusinessId}/template`, { template: newTemplate });
      return newTemplate;
    },
    onSuccess: (newTemplate) => {
      setTemplate(newTemplate);
      toast({ title: "Template updated" });
    },
    onError: () => {
      toast({ title: "Error", description: "Could not change template.", variant: "destructive" });
    },
  });

  const regenerateMutation = useMutation({
    mutationFn: async ({ blockId, prompt }: { blockId: string; prompt?: string }) => {
      const res = await apiRequest("POST", `/api/admin/presence/${selectedBusinessId}/regenerate-block`, { blockId, prompt });
      return res.json();
    },
    onSuccess: (data: any) => {
      setBlocks(prev => prev.map(b => b.id === data.blockId ? { ...b, content: data.content } : b));
      setHasUnsavedChanges(true);
      toast({ title: "Block regenerated", description: "Content has been refreshed by Charlotte." });
    },
    onError: () => {
      toast({ title: "Regeneration failed", variant: "destructive" });
    },
  });

  const selectBusiness = (bizId: string) => {
    setSelectedBusinessId(bizId);
    setView("create");
    setBlocks([]);
    setEditingBlockId(null);
    setHasUnsavedChanges(false);
    setAiPrompt("");
  };

  const backToPicker = () => {
    if (hasUnsavedChanges) {
      if (!confirm("You have unsaved changes. Are you sure you want to go back?")) return;
    }
    setSelectedBusinessId(null);
    setView("picker");
    setBlocks([]);
    setEditingBlockId(null);
    setHasUnsavedChanges(false);
  };

  const moveBlock = (index: number, direction: "up" | "down") => {
    const newBlocks = [...blocks];
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= newBlocks.length) return;
    [newBlocks[index], newBlocks[swapIndex]] = [newBlocks[swapIndex], newBlocks[index]];
    newBlocks.forEach((b, i) => { b.sortOrder = i; });
    setBlocks(newBlocks);
    setHasUnsavedChanges(true);
  };

  const toggleBlock = (blockId: string) => {
    setBlocks(prev => prev.map(b => b.id === blockId ? { ...b, enabled: !b.enabled } : b));
    setHasUnsavedChanges(true);
  };

  const updateBlockContent = (blockId: string, field: string, value: any) => {
    setBlocks(prev => prev.map(b => {
      if (b.id !== blockId) return b;
      return { ...b, content: { ...b.content, [field]: value } };
    }));
    setHasUnsavedChanges(true);
  };

  const addBlock = (type: string) => {
    const id = `${type}-${Date.now()}`;
    const newBlock: MicrositeBlock = {
      id,
      type: type as MicrositeBlockType,
      enabled: true,
      sortOrder: blocks.length,
      content: { headline: { en: BLOCK_LABELS[type] || type, es: "" } },
    };
    setBlocks(prev => [...prev, newBlock]);
    setEditingBlockId(id);
    setHasUnsavedChanges(true);
  };

  const removeBlock = (blockId: string) => {
    setBlocks(prev => prev.filter(b => b.id !== blockId).map((b, i) => ({ ...b, sortOrder: i })));
    if (editingBlockId === blockId) setEditingBlockId(null);
    setHasUnsavedChanges(true);
  };

  const filteredBusinesses = (allBusinesses || []).filter(b =>
    !searchQuery || b.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    b.slug?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (view === "picker") {
    return (
      <div className="space-y-6" data-testid="admin-site-builder">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            AI Site Builder
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Select a business to build or manage their microsite with Charlotte AI.
          </p>
        </div>

        <TemplateShowcase />

        <div>
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
            <Building2 className="h-4 w-4" />
            Select a Business
          </h3>
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search businesses..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
              data-testid="input-search-businesses"
            />
          </div>

          {bizLoading ? (
            <div className="space-y-2">
              {[1,2,3].map(i => <Skeleton key={i} className="h-14 w-full" />)}
            </div>
          ) : (
            <div className="space-y-1.5 max-h-[500px] overflow-y-auto">
              {filteredBusinesses.slice(0, 50).map((biz) => {
                const hasMicrosite = !!(biz.micrositeBlocks as any)?.length;
                return (
                  <Card
                    key={biz.id}
                    className="p-3 flex items-center gap-3 cursor-pointer transition-colors hover:bg-accent/50"
                    onClick={() => selectBusiness(biz.id)}
                    data-testid={`card-biz-${biz.slug}`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{biz.name}</div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge
                          variant="outline"
                          className={`text-[8px] ${
                            biz.listingTier === "ENHANCED" ? "border-[#5B1D8F] text-[#5B1D8F]" :
                            "border-muted-foreground/30"
                          }`}
                        >
                          {biz.listingTier || "FREE"}
                        </Badge>
                        {hasMicrosite && (
                          <Badge variant="secondary" className="text-[8px]">
                            <Globe className="h-2 w-2 mr-0.5" /> Has Site
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {hasMicrosite && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-[10px] h-7 px-2"
                          onClick={(e) => { e.stopPropagation(); window.open(`/charlotte/presence/${biz.slug}`, "_blank"); }}
                          data-testid={`button-view-live-${biz.slug}`}
                        >
                          <Eye className="h-3 w-3 mr-1" /> View
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-[10px] h-7 px-2"
                        onClick={(e) => { e.stopPropagation(); selectBusiness(biz.id); }}
                        data-testid={`button-build-${biz.slug}`}
                      >
                        <Wand2 className="h-3 w-3 mr-1" /> Build
                      </Button>
                    </div>
                  </Card>
                );
              })}
              {filteredBusinesses.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No businesses found.</p>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (blocksLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (view === "create") {
    return (
      <div className="space-y-6" data-testid="admin-site-builder-create">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={backToPicker} className="gap-1" data-testid="button-back-picker">
            <ArrowLeft className="h-4 w-4" /> All Businesses
          </Button>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2" data-testid="text-building-for">
              <Sparkles className="h-5 w-5 text-primary" />
              Building site for: {selectedBiz?.name || "Unknown"}
            </h2>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline" className="text-[9px]">{selectedBiz?.listingTier || "FREE"}</Badge>
              {selectedBiz?.slug && (
                <button
                  className="text-[10px] text-primary underline"
                  onClick={() => window.open(`/charlotte/presence/${selectedBiz.slug}`, "_blank")}
                  data-testid="link-view-live"
                >
                  View live microsite
                </button>
              )}
            </div>
          </div>
        </div>

        {selectedBiz && selectedBiz.listingTier !== "ENHANCED" && (
          <Card className="p-4 border-amber-500/30 bg-amber-50 dark:bg-amber-950/20" data-testid="tier-warning-banner">
            <div className="flex items-start gap-3">
              <Crown className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                  This business is on {selectedBiz.listingTier || "FREE"} tier
                </p>
                <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                  Microsite will not be publicly visible until upgraded to Enhanced ($99/yr). You can still build and save the site — it will go live once the business upgrades.
                </p>
              </div>
            </div>
          </Card>
        )}

        {hasExistingBlocks && (
          <Card className="p-5 border-primary/20">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <h3 className="font-semibold" data-testid="text-existing-site">This business already has a site</h3>
                <p className="text-sm text-muted-foreground">Continue editing the existing microsite or generate a new one.</p>
              </div>
              <Button onClick={loadBlocksIntoEditor} className="gap-2" data-testid="button-edit-existing">
                <LayoutTemplate className="h-4 w-4" /> Edit Existing Site
              </Button>
            </div>
          </Card>
        )}

        <Card className="p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Wand2 className="h-5 w-5 text-primary" />
            <h2 className="font-semibold text-lg" data-testid="text-ai-section">Let Charlotte Build the Site</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Provide optional context about the business, or auto-generate from existing data.
          </p>
          <Textarea
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            placeholder="Add context about the business, what makes them unique, their ideal customer..."
            className="min-h-[100px] text-sm"
            data-testid="input-ai-prompt"
          />
          <div className="flex items-center gap-3 flex-wrap">
            <Button
              onClick={() => generateMutation.mutate(aiPrompt)}
              disabled={generateMutation.isPending}
              className="gap-2"
              data-testid="button-generate-site"
            >
              {generateMutation.isPending ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Charlotte is building...</>
              ) : (
                <><Sparkles className="h-4 w-4" /> Generate Site</>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={() => generateMutation.mutate("")}
              disabled={generateMutation.isPending}
              className="gap-2"
              data-testid="button-auto-generate"
            >
              <RefreshCw className="h-4 w-4" /> Auto-Generate from Business Info
            </Button>
          </div>

          {generateMutation.isPending && (
            <div className="flex items-center gap-3 p-4 rounded-md bg-primary/5" data-testid="generating-indicator">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <div>
                <p className="text-sm font-medium">Charlotte is building the site...</p>
                <p className="text-xs text-muted-foreground">This usually takes 10-20 seconds.</p>
              </div>
            </div>
          )}
        </Card>

        <div className="space-y-4">
          <h2 className="font-semibold text-lg" data-testid="text-template-section">Or Start from a Template</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {MICROSITE_TEMPLATES.map((t) => {
              const style = TEMPLATE_STYLES[t];
              return (
                <Card
                  key={t}
                  className="p-4 space-y-3 cursor-pointer transition-colors hover:bg-accent/50"
                  onClick={() => {
                    setTemplate(t);
                    const defaultBlocks = JSON.parse(JSON.stringify(DEFAULT_MICROSITE_BLOCKS));
                    setBlocks(defaultBlocks);
                    setView("editor");
                  }}
                  data-testid={`template-card-${t}`}
                >
                  <div className="h-24 rounded-md bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center">
                    <span className="text-lg font-semibold" style={{ fontFamily: style.fontHeading }}>
                      {style.name}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-medium text-sm">{style.name}</h3>
                    <p className="text-xs text-muted-foreground">{style.description}</p>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  const sortedBlocks = [...blocks].sort((a, b) => a.sortOrder - b.sortOrder);
  const editingBlock = editingBlockId ? blocks.find(b => b.id === editingBlockId) : null;
  const existingTypes = new Set(blocks.map(b => b.type));

  const isEditorTierEligible = selectedBiz?.listingTier === "ENHANCED";

  return (
    <div className="space-y-4" data-testid="admin-site-builder-editor">
      {!isEditorTierEligible && (
        <div className="flex items-center gap-2 rounded-md p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-500/30" data-testid="editor-tier-warning">
          <Crown className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
          <p className="text-xs text-amber-700 dark:text-amber-400">
            <span className="font-semibold">{selectedBiz?.listingTier || "FREE"} tier</span> — This microsite won't be publicly visible until upgraded to Enhanced.
          </p>
        </div>
      )}
      <div className="flex items-center justify-between gap-3 flex-wrap sticky top-0 z-50 bg-background py-3 border-b border-border">
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="ghost" size="sm" onClick={() => setView("create")} className="gap-1" data-testid="button-back-create">
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          <h2 className="font-semibold text-sm" data-testid="text-editor-title">
            Editing: {selectedBiz?.name}
          </h2>
          {hasUnsavedChanges && (
            <Badge variant="secondary" data-testid="badge-unsaved">Unsaved</Badge>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={template} onValueChange={(t) => templateMutation.mutate(t)}>
            <SelectTrigger className="w-36" data-testid="select-template">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MICROSITE_TEMPLATES.map((t) => (
                <SelectItem key={t} value={t} data-testid={`option-template-${t}`}>
                  {TEMPLATE_STYLES[t].name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedBiz?.slug && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1"
              onClick={() => window.open(`/charlotte/presence/${selectedBiz.slug}`, "_blank")}
              data-testid="button-preview"
            >
              <Eye className="h-4 w-4" /> Preview
            </Button>
          )}
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !hasUnsavedChanges} className="gap-1" data-testid="button-save-site">
            {saveMutation.isPending ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</>
            ) : (
              <><Save className="h-4 w-4" /> Save & Publish</>
            )}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Blocks</h3>
            <Button variant="ghost" size="icon" onClick={() => setShowAddBlock(!showAddBlock)} data-testid="button-add-block">
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {showAddBlock && (
            <Card className="p-3 space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Add a Block</p>
              <div className="grid grid-cols-2 gap-1">
                {MICROSITE_BLOCK_TYPES.filter(t => !existingTypes.has(t)).map((type) => {
                  const Icon = BLOCK_ICONS[type] || LayoutTemplate;
                  return (
                    <Button
                      key={type}
                      variant="ghost"
                      size="sm"
                      className="justify-start gap-2 text-xs"
                      onClick={() => { addBlock(type); setShowAddBlock(false); }}
                      data-testid={`button-add-${type}`}
                    >
                      <Icon className="h-3 w-3" /> {BLOCK_LABELS[type] || type}
                    </Button>
                  );
                })}
              </div>
              {existingTypes.size >= MICROSITE_BLOCK_TYPES.length && (
                <p className="text-xs text-muted-foreground">All block types are already added.</p>
              )}
            </Card>
          )}

          <div className="space-y-1">
            {sortedBlocks.map((block, index) => {
              const Icon = BLOCK_ICONS[block.type] || LayoutTemplate;
              const isSelected = editingBlockId === block.id;
              const isRegenBlock = regenerateMutation.isPending && regenerateMutation.variables?.blockId === block.id;
              return (
                <div
                  key={block.id}
                  className={`flex items-center gap-2 rounded-md p-2 cursor-pointer transition-colors ${isSelected ? "bg-accent" : "hover:bg-accent/50"}`}
                  onClick={() => setEditingBlockId(isSelected ? null : block.id)}
                  data-testid={`block-item-${block.id}`}
                >
                  <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className={`text-sm flex-1 truncate ${!block.enabled ? "text-muted-foreground line-through" : ""}`}>
                    {BLOCK_LABELS[block.type] || block.type}
                  </span>
                  {isRegenBlock && <Loader2 className="h-3 w-3 animate-spin text-primary shrink-0" />}
                  <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" className="h-6 w-6" disabled={index === 0} onClick={() => moveBlock(index, "up")}>
                      <ChevronUp className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6" disabled={index === sortedBlocks.length - 1} onClick={() => moveBlock(index, "down")}>
                      <ChevronDown className="h-3 w-3" />
                    </Button>
                    <Switch
                      checked={block.enabled}
                      onCheckedChange={() => toggleBlock(block.id)}
                      className="scale-75"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div>
          {editingBlock ? (
            <AdminBlockEditor
              block={editingBlock}
              onUpdateContent={(field, value) => updateBlockContent(editingBlock.id, field, value)}
              onRemove={() => removeBlock(editingBlock.id)}
              onRegenerate={() => regenerateMutation.mutate({ blockId: editingBlock.id })}
              isRegenerating={regenerateMutation.isPending && regenerateMutation.variables?.blockId === editingBlock.id}
              onClose={() => setEditingBlockId(null)}
            />
          ) : (
            <Card className="p-8 text-center">
              <LayoutTemplate className="mx-auto h-10 w-10 text-muted-foreground/30 mb-3" />
              <h3 className="font-semibold text-muted-foreground" data-testid="text-select-block">Select a Block to Edit</h3>
              <p className="text-sm text-muted-foreground mt-1">Click on any block in the list to edit its content.</p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function TemplateShowcase() {
  const TEMPLATE_PREVIEWS = [
    { id: "modern" as const, heroStyle: "bg-gradient-to-br from-slate-100 to-blue-50 dark:from-slate-900 dark:to-blue-950", accent: "bg-blue-500", layout: "centered" },
    { id: "classic" as const, heroStyle: "bg-gradient-to-br from-amber-50 to-stone-100 dark:from-amber-950 dark:to-stone-900", accent: "bg-amber-600", layout: "left-aligned" },
    { id: "bold" as const, heroStyle: "bg-gradient-to-br from-gray-900 to-black text-white", accent: "bg-red-500", layout: "overlay" },
    { id: "elegant" as const, heroStyle: "bg-gradient-to-br from-rose-50 to-purple-50 dark:from-rose-950 dark:to-purple-950", accent: "bg-rose-400", layout: "split" },
  ];

  return (
    <div>
      <h3 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
        <Paintbrush className="h-4 w-4" />
        Available Templates
      </h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {TEMPLATE_PREVIEWS.map((t) => {
          const style = TEMPLATE_STYLES[t.id];
          return (
            <Card key={t.id} className="overflow-hidden" data-testid={`card-template-${t.id}`}>
              <div className={`${t.heroStyle} p-3 min-h-[80px] flex flex-col justify-center`}>
                <Badge className={`${t.accent} text-white text-[8px] w-fit`}>{style.name}</Badge>
                <div className="mt-2 space-y-0.5">
                  <div className="h-2 w-16 bg-foreground/15 rounded" />
                  <div className="h-1.5 w-20 bg-foreground/10 rounded" />
                </div>
              </div>
              <div className="p-2">
                <p className="text-[10px] text-muted-foreground">{style.description}</p>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function AdminBlockEditor({
  block,
  onUpdateContent,
  onRemove,
  onRegenerate,
  isRegenerating,
  onClose,
}: {
  block: MicrositeBlock;
  onUpdateContent: (field: string, value: any) => void;
  onRemove: () => void;
  onRegenerate: () => void;
  isRegenerating: boolean;
  onClose: () => void;
}) {
  const content = block.content || {};

  const getBilingualValue = (field: string, lang: "en" | "es"): string => {
    const val = (content as any)[field];
    if (!val) return "";
    if (typeof val === "string") return lang === "en" ? val : "";
    return val[lang] || "";
  };

  const setBilingualValue = (field: string, lang: "en" | "es", value: string) => {
    const current = (content as any)[field] || { en: "", es: "" };
    const updated = typeof current === "string"
      ? { en: lang === "en" ? value : current, es: lang === "es" ? value : "" }
      : { ...current, [lang]: value };
    onUpdateContent(field, updated);
  };

  const Icon = BLOCK_ICONS[block.type] || LayoutTemplate;

  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="font-semibold flex items-center gap-2" data-testid="text-block-editor-title">
          <Icon className="h-4 w-4 text-primary" />
          {BLOCK_LABELS[block.type] || block.type}
        </h3>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={onRegenerate}
            disabled={isRegenerating}
            className="gap-1"
            data-testid="button-regenerate-block"
          >
            {isRegenerating ? (
              <><Loader2 className="h-3 w-3 animate-spin" /> Regenerating...</>
            ) : (
              <><Wand2 className="h-3 w-3" /> Regenerate</>
            )}
          </Button>
          <Button variant="ghost" size="icon" onClick={onRemove} data-testid="button-remove-block">
            <Trash2 className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={onClose} data-testid="button-close-editor">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Headline (English)</Label>
          <Input
            value={getBilingualValue("headline", "en")}
            onChange={(e) => setBilingualValue("headline", "en", e.target.value)}
            data-testid="input-block-headline-en"
          />
          <Label className="text-xs text-muted-foreground">Headline (Spanish)</Label>
          <Input
            value={getBilingualValue("headline", "es")}
            onChange={(e) => setBilingualValue("headline", "es", e.target.value)}
            data-testid="input-block-headline-es"
          />
        </div>

        {(block.type === "hero" || block.type === "cta") && (
          <>
            <div className="space-y-2">
              <Label>Subheadline (English)</Label>
              <Input
                value={getBilingualValue("subheadline", "en")}
                onChange={(e) => setBilingualValue("subheadline", "en", e.target.value)}
                data-testid="input-block-subheadline-en"
              />
              <Label className="text-xs text-muted-foreground">Subheadline (Spanish)</Label>
              <Input
                value={getBilingualValue("subheadline", "es")}
                onChange={(e) => setBilingualValue("subheadline", "es", e.target.value)}
                data-testid="input-block-subheadline-es"
              />
            </div>
            <div className="space-y-2">
              <Label>CTA Text (English)</Label>
              <Input
                value={getBilingualValue("ctaText", "en")}
                onChange={(e) => setBilingualValue("ctaText", "en", e.target.value)}
                data-testid="input-block-cta-en"
              />
              <Label className="text-xs text-muted-foreground">CTA Link</Label>
              <Input
                value={content.ctaLink || ""}
                onChange={(e) => onUpdateContent("ctaLink", e.target.value)}
                data-testid="input-block-cta-link"
              />
            </div>
          </>
        )}

        {block.type === "about" && (
          <div className="space-y-2">
            <Label>Body (English)</Label>
            <Textarea
              value={getBilingualValue("body", "en")}
              onChange={(e) => setBilingualValue("body", "en", e.target.value)}
              className="min-h-[120px] text-sm"
              data-testid="input-block-body-en"
            />
            <Label className="text-xs text-muted-foreground">Body (Spanish)</Label>
            <Textarea
              value={getBilingualValue("body", "es")}
              onChange={(e) => setBilingualValue("body", "es", e.target.value)}
              className="min-h-[100px] text-sm"
              data-testid="input-block-body-es"
            />
          </div>
        )}

        {(block.type === "services" || block.type === "faq" || block.type === "testimonials") && content.items && (
          <div className="space-y-3">
            <Label className="text-sm font-medium">Items ({(content.items as any[]).length})</Label>
            {(content.items as any[]).map((item: any, idx: number) => (
              <Card key={idx} className="p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">Item {idx + 1}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => {
                      const items = [...(content.items as any[])];
                      items.splice(idx, 1);
                      onUpdateContent("items", items);
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
                {block.type === "services" && (
                  <>
                    <Input
                      value={item.title?.en || ""}
                      onChange={(e) => {
                        const items = [...(content.items as any[])];
                        items[idx] = { ...items[idx], title: { ...items[idx].title, en: e.target.value } };
                        onUpdateContent("items", items);
                      }}
                      placeholder="Service title (EN)"
                      className="text-sm"
                    />
                    <Input
                      value={item.description?.en || ""}
                      onChange={(e) => {
                        const items = [...(content.items as any[])];
                        items[idx] = { ...items[idx], description: { ...items[idx].description, en: e.target.value } };
                        onUpdateContent("items", items);
                      }}
                      placeholder="Description (EN)"
                      className="text-sm"
                    />
                  </>
                )}
                {block.type === "faq" && (
                  <>
                    <Input
                      value={item.question?.en || ""}
                      onChange={(e) => {
                        const items = [...(content.items as any[])];
                        items[idx] = { ...items[idx], question: { ...items[idx].question, en: e.target.value } };
                        onUpdateContent("items", items);
                      }}
                      placeholder="Question (EN)"
                      className="text-sm"
                    />
                    <Textarea
                      value={item.answer?.en || ""}
                      onChange={(e) => {
                        const items = [...(content.items as any[])];
                        items[idx] = { ...items[idx], answer: { ...items[idx].answer, en: e.target.value } };
                        onUpdateContent("items", items);
                      }}
                      placeholder="Answer (EN)"
                      className="text-sm min-h-[60px]"
                    />
                  </>
                )}
                {block.type === "testimonials" && (
                  <>
                    <Textarea
                      value={item.quote?.en || ""}
                      onChange={(e) => {
                        const items = [...(content.items as any[])];
                        items[idx] = { ...items[idx], quote: { ...items[idx].quote, en: e.target.value } };
                        onUpdateContent("items", items);
                      }}
                      placeholder="Quote (EN)"
                      className="text-sm min-h-[60px]"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        value={item.author || ""}
                        onChange={(e) => {
                          const items = [...(content.items as any[])];
                          items[idx] = { ...items[idx], author: e.target.value };
                          onUpdateContent("items", items);
                        }}
                        placeholder="Author name"
                        className="text-sm"
                      />
                      <Input
                        value={item.role || ""}
                        onChange={(e) => {
                          const items = [...(content.items as any[])];
                          items[idx] = { ...items[idx], role: e.target.value };
                          onUpdateContent("items", items);
                        }}
                        placeholder="Role"
                        className="text-sm"
                      />
                    </div>
                  </>
                )}
              </Card>
            ))}
            <Button
              variant="outline"
              size="sm"
              className="w-full text-xs gap-1"
              onClick={() => {
                const items = [...(content.items as any[])];
                if (block.type === "services") items.push({ title: { en: "", es: "" }, description: { en: "", es: "" } });
                else if (block.type === "faq") items.push({ question: { en: "", es: "" }, answer: { en: "", es: "" } });
                else if (block.type === "testimonials") items.push({ quote: { en: "", es: "" }, author: "", role: "" });
                onUpdateContent("items", items);
              }}
              data-testid="button-add-item"
            >
              <Plus className="h-3 w-3" /> Add Item
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}
