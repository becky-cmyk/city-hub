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
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  ArrowLeft, Sparkles, Eye, Save, ChevronUp, ChevronDown, Plus,
  Loader2, LayoutTemplate, Wand2, GripVertical, Trash2, RefreshCw,
  Globe, Type, Image, Users, Star, HelpCircle, Clock, Calendar,
  Phone, MessageSquare, Megaphone, X
} from "lucide-react";
import { useSmartBack } from "@/hooks/use-smart-back";
import { Link } from "wouter";
import type { MicrositeBlock, MicrositeBlockType, MicrositeTemplate } from "@shared/schema";
import { MICROSITE_BLOCK_TYPES, MICROSITE_TEMPLATES, DEFAULT_MICROSITE_BLOCKS } from "@shared/schema";
import { TEMPLATE_STYLES } from "@/components/microsite/templates";
import { SeoScoreCard } from "@/components/seo-score-card";

const BLOCK_ICONS: Record<MicrositeBlockType, any> = {
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

const BLOCK_LABELS: Record<MicrositeBlockType, string> = {
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

interface BusinessCapabilities {
  tier: "FREE" | "VERIFIED" | "ENHANCED" | "ENTERPRISE";
  capabilities: {
    canUseGallery: boolean;
    canUseMediaBlocks: boolean;
    canShowBadges: boolean;
    canPriorityRank: boolean;
  };
}

export default function SiteBuilder({ citySlug, slug }: { citySlug: string; slug: string }) {
  const { toast } = useToast();
  const { isAdmin } = useAuth();
  const smartBack = useSmartBack(`/${citySlug}/owner/${slug}`);
  const [view, setView] = useState<"create" | "editor">("create");
  const [aiPrompt, setAiPrompt] = useState("");
  const [blocks, setBlocks] = useState<MicrositeBlock[]>([]);
  const [template, setTemplate] = useState<string>("modern");
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const { data: caps, isLoading: capsLoading } = useQuery<BusinessCapabilities>({
    queryKey: ["/api/cities", citySlug, "owner", slug, "entitlements"],
  });

  const { data: business } = useQuery<any>({
    queryKey: ["/api/cities", citySlug, "owner", slug],
  });

  const { data: blocksData, isLoading: blocksLoading } = useQuery<BlocksResponse>({
    queryKey: ["/api/owner/presence", business?.id, "blocks"],
    queryFn: async () => {
      const res = await fetch(`/api/owner/presence/${business.id}/blocks`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load blocks");
      return res.json();
    },
    enabled: !!business?.id && (isAdmin || (!!caps && (caps.tier === "ENHANCED" || caps.tier === "ENTERPRISE"))),
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
      const res = await apiRequest("POST", `/api/owner/presence/${business.id}/generate-site`, {
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
      toast({ title: "Site generated", description: "Charlotte has built your site. Review and customize it below." });
      queryClient.invalidateQueries({ queryKey: ["/api/owner/presence", business?.id, "blocks"] });
    },
    onError: (err: any) => {
      toast({ title: "Generation failed", description: err.message || "Please try again.", variant: "destructive" });
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("PUT", `/api/owner/presence/${business.id}/blocks`, { blocks });
      return true;
    },
    onSuccess: () => {
      setHasUnsavedChanges(false);
      toast({ title: "Site saved", description: "Your changes have been published." });
      queryClient.invalidateQueries({ queryKey: ["/api/owner/presence", business?.id, "blocks"] });
    },
    onError: () => {
      toast({ title: "Save failed", description: "Could not save your site. Please try again.", variant: "destructive" });
    },
  });

  const templateMutation = useMutation({
    mutationFn: async (newTemplate: string) => {
      await apiRequest("PUT", `/api/owner/presence/${business.id}/template`, { template: newTemplate });
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
      const res = await apiRequest("POST", `/api/owner/presence/${business.id}/regenerate-block`, { blockId, prompt });
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

  const addBlock = (type: MicrositeBlockType) => {
    const id = `${type}-${Date.now()}`;
    const newBlock: MicrositeBlock = {
      id,
      type,
      enabled: true,
      sortOrder: blocks.length,
      content: { headline: { en: BLOCK_LABELS[type], es: "" } },
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

  if (capsLoading || blocksLoading) {
    return (
      <div className="mx-auto p-4 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!isAdmin && (!caps || (caps.tier !== "ENHANCED" && caps.tier !== "ENTERPRISE"))) {
    return (
      <div className="max-w-lg mx-auto p-4">
        <Card className="p-8 text-center">
          <LayoutTemplate className="mx-auto h-10 w-10 text-muted-foreground/40 mb-3" />
          <h3 className="font-semibold mb-1" data-testid="text-upgrade-required">Microsite Builder</h3>
          <p className="text-sm text-muted-foreground mb-4">
            The AI-powered site builder is available on Enhanced tier and above.
          </p>
          <Link href={`/${citySlug}/presence/${slug}/pricing`}>
            <Button data-testid="button-view-plans">View Plans</Button>
          </Link>
        </Card>
      </div>
    );
  }

  const isEnhanced = isAdmin || (caps && (caps.tier === "ENHANCED" || caps.tier === "ENTERPRISE"));
  const sortedBlocks = [...blocks].sort((a, b) => a.sortOrder - b.sortOrder);
  const editingBlock = editingBlockId ? blocks.find(b => b.id === editingBlockId) : null;

  return (
    <div className="mx-auto p-4 space-y-6">
      <div className="flex items-center gap-2 flex-wrap">
        <Button variant="ghost" size="sm" className="gap-1" onClick={smartBack} data-testid="link-back-dashboard">
          <ArrowLeft className="h-4 w-4" /> Dashboard
        </Button>
      </div>

      {view === "create" && (
        <CreateView
          aiPrompt={aiPrompt}
          setAiPrompt={setAiPrompt}
          onGenerate={(prompt) => generateMutation.mutate(prompt)}
          isGenerating={generateMutation.isPending}
          hasExistingBlocks={hasExistingBlocks}
          onEditExisting={loadBlocksIntoEditor}
          isEnhanced={isEnhanced}
          onSelectTemplate={(t) => {
            setTemplate(t);
            const defaultBlocks = JSON.parse(JSON.stringify(DEFAULT_MICROSITE_BLOCKS));
            setBlocks(defaultBlocks);
            setView("editor");
          }}
        />
      )}

      {view === "editor" && (
        <EditorView
          blocks={sortedBlocks}
          template={template}
          isEnhanced={isEnhanced}
          editingBlock={editingBlock}
          editingBlockId={editingBlockId}
          hasUnsavedChanges={hasUnsavedChanges}
          isSaving={saveMutation.isPending}
          isRegenerating={regenerateMutation.isPending}
          regeneratingBlockId={regenerateMutation.variables?.blockId || null}
          citySlug={citySlug}
          slug={slug}
          onToggleBlock={toggleBlock}
          onMoveBlock={moveBlock}
          onSelectBlock={setEditingBlockId}
          onUpdateBlockContent={updateBlockContent}
          onRemoveBlock={removeBlock}
          onAddBlock={addBlock}
          onSave={() => saveMutation.mutate()}
          onChangeTemplate={(t) => templateMutation.mutate(t)}
          onRegenerateBlock={(blockId) => regenerateMutation.mutate({ blockId })}
          onBackToCreate={() => setView("create")}
        />
      )}
    </div>
  );
}

function CreateView({
  aiPrompt,
  setAiPrompt,
  onGenerate,
  isGenerating,
  hasExistingBlocks,
  onEditExisting,
  isEnhanced,
  onSelectTemplate,
}: {
  aiPrompt: string;
  setAiPrompt: (v: string) => void;
  onGenerate: (prompt: string) => void;
  isGenerating: boolean;
  hasExistingBlocks: boolean;
  onEditExisting: () => void;
  isEnhanced: boolean;
  onSelectTemplate: (t: string) => void;
}) {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-builder-title">
          <Sparkles className="h-6 w-6 text-primary" />
          Build Your Site
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Let Charlotte AI create a polished website for your business, or start from a template.
        </p>
      </div>

      {hasExistingBlocks && (
        <Card className="p-5 border-primary/20">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h3 className="font-semibold" data-testid="text-existing-site">You already have a site</h3>
              <p className="text-sm text-muted-foreground">Continue editing your existing microsite or generate a new one.</p>
            </div>
            <Button onClick={onEditExisting} className="gap-2" data-testid="button-edit-existing">
              <LayoutTemplate className="h-4 w-4" /> Edit Existing Site
            </Button>
          </div>
        </Card>
      )}

      <Card className="p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Wand2 className="h-5 w-5 text-primary" />
          <h2 className="font-semibold text-lg" data-testid="text-ai-section">Let Charlotte Build Your Site</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Describe your business, what makes you unique, and who your ideal customer is.
          Charlotte will generate a complete website with all sections populated.
        </p>
        <Textarea
          value={aiPrompt}
          onChange={(e) => setAiPrompt(e.target.value)}
          placeholder="We're a family-owned bakery in South End specializing in artisan sourdough and custom celebration cakes. Our customers love our warm atmosphere and weekly bread workshops..."
          className="min-h-[120px] text-sm"
          data-testid="input-ai-prompt"
        />
        <div className="flex items-center gap-3 flex-wrap">
          <Button
            onClick={() => onGenerate(aiPrompt)}
            disabled={isGenerating}
            className="gap-2"
            data-testid="button-generate-site"
          >
            {isGenerating ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Charlotte is building your site...</>
            ) : (
              <><Sparkles className="h-4 w-4" /> Generate My Site</>
            )}
          </Button>
          <Button
            variant="outline"
            onClick={() => onGenerate("")}
            disabled={isGenerating}
            className="gap-2"
            data-testid="button-auto-generate"
          >
            <RefreshCw className="h-4 w-4" /> Auto-Generate from My Info
          </Button>
        </div>

        {isGenerating && (
          <div className="flex items-center gap-3 p-4 rounded-md bg-primary/5" data-testid="generating-indicator">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <div>
              <p className="text-sm font-medium">Charlotte is building your site...</p>
              <p className="text-xs text-muted-foreground">This usually takes 10-20 seconds.</p>
            </div>
          </div>
        )}
      </Card>

      <div className="space-y-4">
        <h2 className="font-semibold text-lg" data-testid="text-template-section">Or Choose a Template to Start</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {MICROSITE_TEMPLATES.map((t) => {
            const style = TEMPLATE_STYLES[t];
            const isLocked = !isEnhanced && t !== "modern";
            return (
              <Card
                key={t}
                className={`p-4 space-y-3 cursor-pointer transition-colors ${isLocked ? "opacity-60" : "hover-elevate"}`}
                onClick={() => !isLocked && onSelectTemplate(t)}
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
                {isLocked && (
                  <Badge variant="secondary" className="text-xs">Enhanced Only</Badge>
                )}
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function EditorView({
  blocks,
  template,
  isEnhanced,
  editingBlock,
  editingBlockId,
  hasUnsavedChanges,
  isSaving,
  isRegenerating,
  regeneratingBlockId,
  citySlug,
  slug,
  onToggleBlock,
  onMoveBlock,
  onSelectBlock,
  onUpdateBlockContent,
  onRemoveBlock,
  onAddBlock,
  onSave,
  onChangeTemplate,
  onRegenerateBlock,
  onBackToCreate,
}: {
  blocks: MicrositeBlock[];
  template: string;
  isEnhanced: boolean;
  editingBlock: MicrositeBlock | null | undefined;
  editingBlockId: string | null;
  hasUnsavedChanges: boolean;
  isSaving: boolean;
  isRegenerating: boolean;
  regeneratingBlockId: string | null;
  citySlug: string;
  slug: string;
  onToggleBlock: (id: string) => void;
  onMoveBlock: (index: number, dir: "up" | "down") => void;
  onSelectBlock: (id: string | null) => void;
  onUpdateBlockContent: (id: string, field: string, value: any) => void;
  onRemoveBlock: (id: string) => void;
  onAddBlock: (type: MicrositeBlockType) => void;
  onSave: () => void;
  onChangeTemplate: (t: string) => void;
  onRegenerateBlock: (blockId: string) => void;
  onBackToCreate: () => void;
}) {
  const [showAddBlock, setShowAddBlock] = useState(false);
  const existingTypes = new Set(blocks.map(b => b.type));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap sticky top-0 z-50 bg-background py-3 border-b border-border -mx-4 px-4">
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="ghost" size="sm" onClick={onBackToCreate} className="gap-1" data-testid="button-back-create">
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          <h2 className="font-semibold" data-testid="text-editor-title">Site Editor</h2>
          {hasUnsavedChanges && (
            <Badge variant="secondary" data-testid="badge-unsaved">Unsaved Changes</Badge>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {isEnhanced && (
            <Select value={template} onValueChange={onChangeTemplate}>
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
          )}
          <Link href={`/${citySlug}/presence/${slug}`} target="_blank">
            <Button variant="outline" size="sm" className="gap-1" data-testid="button-preview">
              <Eye className="h-4 w-4" /> Preview
            </Button>
          </Link>
          <Button onClick={onSave} disabled={isSaving || !hasUnsavedChanges} className="gap-1" data-testid="button-save-site">
            {isSaving ? (
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
                  const Icon = BLOCK_ICONS[type];
                  return (
                    <Button
                      key={type}
                      variant="ghost"
                      size="sm"
                      className="justify-start gap-2 text-xs"
                      onClick={() => { onAddBlock(type); setShowAddBlock(false); }}
                      data-testid={`button-add-${type}`}
                    >
                      <Icon className="h-3 w-3" /> {BLOCK_LABELS[type]}
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
            {blocks.map((block, index) => {
              const Icon = BLOCK_ICONS[block.type] || LayoutTemplate;
              const isSelected = editingBlockId === block.id;
              const isRegenBlock = isRegenerating && regeneratingBlockId === block.id;
              return (
                <div
                  key={block.id}
                  className={`flex items-center gap-2 rounded-md p-2 cursor-pointer transition-colors ${isSelected ? "bg-accent" : "hover-elevate"}`}
                  onClick={() => onSelectBlock(isSelected ? null : block.id)}
                  data-testid={`block-item-${block.id}`}
                >
                  <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className={`text-sm flex-1 truncate ${!block.enabled ? "text-muted-foreground line-through" : ""}`}>
                    {BLOCK_LABELS[block.type]}
                  </span>
                  {isRegenBlock && <Loader2 className="h-3 w-3 animate-spin text-primary shrink-0" />}
                  <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" className="h-6 w-6" disabled={index === 0} onClick={() => onMoveBlock(index, "up")} data-testid={`button-move-up-${block.id}`}>
                      <ChevronUp className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6" disabled={index === blocks.length - 1} onClick={() => onMoveBlock(index, "down")} data-testid={`button-move-down-${block.id}`}>
                      <ChevronDown className="h-3 w-3" />
                    </Button>
                    <Switch
                      checked={block.enabled}
                      onCheckedChange={() => onToggleBlock(block.id)}
                      className="scale-75"
                      data-testid={`toggle-block-${block.id}`}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {(() => {
            const heroBlock = blocks.find(b => b.type === "hero");
            const aboutBlock = blocks.find(b => b.type === "about");
            const allText = blocks.filter(b => b.enabled).map(b => {
              const parts: string[] = [];
              if (b.content?.headline?.en) parts.push(b.content.headline.en);
              if (b.content?.body?.en) parts.push(b.content.body.en);
              if (b.content?.items) b.content.items.forEach((item: any) => {
                if (item.title?.en) parts.push(item.title.en);
                if (item.description?.en) parts.push(item.description.en);
              });
              return parts.join(" ");
            }).join(" ");
            return (
              <SeoScoreCard
                input={{
                  title: heroBlock?.content?.headline?.en || "",
                  metaDescription: aboutBlock?.content?.body?.en || "",
                  content: allText,
                  slug: slug,
                  cityKeyword: "Charlotte",
                }}
              />
            );
          })()}
        </div>

        <div>
          {editingBlock ? (
            <BlockEditor
              block={editingBlock}
              onUpdateContent={(field, value) => onUpdateBlockContent(editingBlock.id, field, value)}
              onRemove={() => onRemoveBlock(editingBlock.id)}
              onRegenerate={() => onRegenerateBlock(editingBlock.id)}
              isRegenerating={isRegenerating && regeneratingBlockId === editingBlock.id}
              onClose={() => onSelectBlock(null)}
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

function BlockEditor({
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

  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="font-semibold flex items-center gap-2" data-testid="text-block-editor-title">
          {(() => { const Icon = BLOCK_ICONS[block.type]; return Icon ? <Icon className="h-4 w-4 text-primary" /> : null; })()}
          {BLOCK_LABELS[block.type]}
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
              <><Wand2 className="h-3 w-3" /> Regenerate with Charlotte</>
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
        {(block.type === "hero" || block.type === "about" || block.type === "cta" ||
          block.type === "services" || block.type === "faq" || block.type === "testimonials" ||
          block.type === "team" || block.type === "gallery" || block.type === "hours" ||
          block.type === "events" || block.type === "reviews" || block.type === "contact") && (
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
        )}

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
              <Label>CTA Button Text (English)</Label>
              <Input
                value={getBilingualValue("ctaText", "en")}
                onChange={(e) => setBilingualValue("ctaText", "en", e.target.value)}
                data-testid="input-block-cta-text-en"
              />
            </div>
            <div className="space-y-2">
              <Label>CTA Link</Label>
              <Input
                value={content.ctaLink || ""}
                onChange={(e) => onUpdateContent("ctaLink", e.target.value)}
                placeholder="#contact"
                data-testid="input-block-cta-link"
              />
            </div>
          </>
        )}

        {block.type === "hero" && (
          <div className="space-y-2">
            <Label>Background Image URL</Label>
            <Input
              value={content.backgroundImage || ""}
              onChange={(e) => onUpdateContent("backgroundImage", e.target.value)}
              placeholder="https://..."
              data-testid="input-block-bg-image"
            />
          </div>
        )}

        {block.type === "about" && (
          <div className="space-y-2">
            <Label>Body Text (English)</Label>
            <Textarea
              value={getBilingualValue("body", "en")}
              onChange={(e) => setBilingualValue("body", "en", e.target.value)}
              className="min-h-[120px]"
              data-testid="input-block-body-en"
            />
            <Label className="text-xs text-muted-foreground">Body Text (Spanish)</Label>
            <Textarea
              value={getBilingualValue("body", "es")}
              onChange={(e) => setBilingualValue("body", "es", e.target.value)}
              className="min-h-[80px]"
              data-testid="input-block-body-es"
            />
          </div>
        )}

        {block.type === "about" && (
          <div className="space-y-2">
            <Label>Image URL</Label>
            <Input
              value={content.image || ""}
              onChange={(e) => onUpdateContent("image", e.target.value)}
              placeholder="https://..."
              data-testid="input-block-about-image"
            />
          </div>
        )}

        {(block.type === "services" || block.type === "faq" || block.type === "testimonials" || block.type === "team") && (
          <ItemsEditor
            blockType={block.type}
            items={(content.items as any[]) || []}
            onChange={(items) => onUpdateContent("items", items)}
          />
        )}

        {block.type === "contact" && (
          <p className="text-sm text-muted-foreground">
            Contact information is pulled from your business profile (phone, email, address, website).
          </p>
        )}

        {block.type === "hours" && (
          <p className="text-sm text-muted-foreground">
            Operating hours are pulled from your business profile. Update them in your dashboard settings.
          </p>
        )}

        {block.type === "events" && (
          <p className="text-sm text-muted-foreground">
            Events are pulled from your linked events on the platform.
          </p>
        )}

        {block.type === "reviews" && (
          <p className="text-sm text-muted-foreground">
            Reviews are pulled from Google and platform reviews automatically.
          </p>
        )}

        {block.type === "gallery" && (
          <p className="text-sm text-muted-foreground">
            Gallery images are pulled from your business profile gallery. Add more photos in your dashboard.
          </p>
        )}
      </div>
    </Card>
  );
}

function ItemsEditor({
  blockType,
  items,
  onChange,
}: {
  blockType: string;
  items: any[];
  onChange: (items: any[]) => void;
}) {
  const addItem = () => {
    let newItem: any = {};
    if (blockType === "services") {
      newItem = { title: { en: "", es: "" }, description: { en: "", es: "" } };
    } else if (blockType === "faq") {
      newItem = { question: { en: "", es: "" }, answer: { en: "", es: "" } };
    } else if (blockType === "testimonials") {
      newItem = { quote: { en: "", es: "" }, author: "", role: "" };
    } else if (blockType === "team") {
      newItem = { name: "", role: "", bio: { en: "", es: "" }, image: "" };
    }
    onChange([...items, newItem]);
  };

  const updateItem = (index: number, field: string, value: any) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  const updateItemBilingual = (index: number, field: string, lang: "en" | "es", value: string) => {
    const updated = [...items];
    const current = updated[index][field] || { en: "", es: "" };
    updated[index] = {
      ...updated[index],
      [field]: typeof current === "string" ? { en: lang === "en" ? value : current, es: lang === "es" ? value : "" } : { ...current, [lang]: value },
    };
    onChange(updated);
  };

  const removeItem = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <Label>Items ({items.length})</Label>
        <Button variant="outline" size="sm" onClick={addItem} className="gap-1" data-testid="button-add-item">
          <Plus className="h-3 w-3" /> Add
        </Button>
      </div>

      <Accordion type="single" collapsible className="w-full">
        {items.map((item, index) => {
          const itemLabel = blockType === "services"
            ? (item.title?.en || `Service ${index + 1}`)
            : blockType === "faq"
            ? (item.question?.en || `Question ${index + 1}`)
            : blockType === "testimonials"
            ? (item.author || `Testimonial ${index + 1}`)
            : blockType === "team"
            ? (item.name || `Member ${index + 1}`)
            : `Item ${index + 1}`;

          return (
            <AccordionItem value={`item-${index}`} key={index}>
              <AccordionTrigger className="text-sm" data-testid={`accordion-item-${index}`}>
                <div className="flex items-center gap-2 flex-1">
                  <span className="truncate">{itemLabel}</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-3 pt-2">
                {blockType === "services" && (
                  <>
                    <div className="space-y-1">
                      <Label className="text-xs">Title (English)</Label>
                      <Input value={item.title?.en || ""} onChange={(e) => updateItemBilingual(index, "title", "en", e.target.value)} data-testid={`input-service-title-en-${index}`} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Title (Spanish)</Label>
                      <Input value={item.title?.es || ""} onChange={(e) => updateItemBilingual(index, "title", "es", e.target.value)} data-testid={`input-service-title-es-${index}`} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Description (English)</Label>
                      <Textarea value={item.description?.en || ""} onChange={(e) => updateItemBilingual(index, "description", "en", e.target.value)} className="min-h-[60px]" data-testid={`input-service-desc-en-${index}`} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Description (Spanish)</Label>
                      <Textarea value={item.description?.es || ""} onChange={(e) => updateItemBilingual(index, "description", "es", e.target.value)} className="min-h-[60px]" data-testid={`input-service-desc-es-${index}`} />
                    </div>
                  </>
                )}

                {blockType === "faq" && (
                  <>
                    <div className="space-y-1">
                      <Label className="text-xs">Question (English)</Label>
                      <Input value={item.question?.en || ""} onChange={(e) => updateItemBilingual(index, "question", "en", e.target.value)} data-testid={`input-faq-q-en-${index}`} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Question (Spanish)</Label>
                      <Input value={item.question?.es || ""} onChange={(e) => updateItemBilingual(index, "question", "es", e.target.value)} data-testid={`input-faq-q-es-${index}`} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Answer (English)</Label>
                      <Textarea value={item.answer?.en || ""} onChange={(e) => updateItemBilingual(index, "answer", "en", e.target.value)} className="min-h-[60px]" data-testid={`input-faq-a-en-${index}`} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Answer (Spanish)</Label>
                      <Textarea value={item.answer?.es || ""} onChange={(e) => updateItemBilingual(index, "answer", "es", e.target.value)} className="min-h-[60px]" data-testid={`input-faq-a-es-${index}`} />
                    </div>
                  </>
                )}

                {blockType === "testimonials" && (
                  <>
                    <div className="space-y-1">
                      <Label className="text-xs">Quote (English)</Label>
                      <Textarea value={item.quote?.en || ""} onChange={(e) => updateItemBilingual(index, "quote", "en", e.target.value)} className="min-h-[60px]" data-testid={`input-testimonial-quote-en-${index}`} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Quote (Spanish)</Label>
                      <Textarea value={item.quote?.es || ""} onChange={(e) => updateItemBilingual(index, "quote", "es", e.target.value)} className="min-h-[60px]" data-testid={`input-testimonial-quote-es-${index}`} />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Author Name</Label>
                        <Input value={item.author || ""} onChange={(e) => updateItem(index, "author", e.target.value)} data-testid={`input-testimonial-author-${index}`} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Role/Title</Label>
                        <Input value={item.role || ""} onChange={(e) => updateItem(index, "role", e.target.value)} data-testid={`input-testimonial-role-${index}`} />
                      </div>
                    </div>
                  </>
                )}

                {blockType === "team" && (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Name</Label>
                        <Input value={item.name || ""} onChange={(e) => updateItem(index, "name", e.target.value)} data-testid={`input-team-name-${index}`} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Role/Title</Label>
                        <Input value={item.role || ""} onChange={(e) => updateItem(index, "role", e.target.value)} data-testid={`input-team-role-${index}`} />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Bio (English)</Label>
                      <Textarea value={item.bio?.en || ""} onChange={(e) => updateItemBilingual(index, "bio", "en", e.target.value)} className="min-h-[60px]" data-testid={`input-team-bio-en-${index}`} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Image URL</Label>
                      <Input value={item.image || ""} onChange={(e) => updateItem(index, "image", e.target.value)} data-testid={`input-team-image-${index}`} />
                    </div>
                  </>
                )}

                <Button variant="ghost" size="sm" className="text-destructive gap-1" onClick={() => removeItem(index)} data-testid={`button-remove-item-${index}`}>
                  <Trash2 className="h-3 w-3" /> Remove
                </Button>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
}
