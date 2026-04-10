import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useState } from "react";
import {
  Plus, Loader2, Sparkles, Check, X, Eye,
  Quote, Megaphone, Type, Trash2, Bot
} from "lucide-react";
import type { PlatformMessaging } from "@shared/schema";
import { INSPIRATION_QUOTES, PLATFORM_TAGLINES } from "@shared/inspirational-quotes";

const PAGE_CONTEXT_OPTIONS = [
  { value: "activate", label: "Activate" },
  { value: "pricing", label: "Pricing" },
  { value: "claim", label: "Claim" },
  { value: "hub-screens", label: "Hub Screens" },
  { value: "tell-your-story", label: "Tell Your Story" },
  { value: "charlotte-chat", label: "Charlotte Chat" },
];

const STATUS_COLORS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  suggested: "secondary",
  approved: "default",
  rejected: "destructive",
  active: "default",
};

const CATEGORY_ICONS: Record<string, typeof Quote> = {
  quote: Quote,
  tagline: Type,
  cta: Megaphone,
};

function QuotePreview({ text, author, category }: { text: string; author?: string | null; category: string }) {
  return (
    <div className="rounded-md border p-4 bg-muted/30 space-y-2" data-testid="quote-preview">
      <div className="flex items-center gap-2">
        {category === "quote" && <Quote className="h-4 w-4 text-muted-foreground shrink-0" />}
        {category === "tagline" && <Type className="h-4 w-4 text-muted-foreground shrink-0" />}
        {category === "cta" && <Megaphone className="h-4 w-4 text-muted-foreground shrink-0" />}
        <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">{category}</span>
      </div>
      <p className="text-sm italic leading-relaxed">&ldquo;{text}&rdquo;</p>
      {author && <p className="text-xs text-muted-foreground">&mdash; {author}</p>}
    </div>
  );
}

function AddMessagingDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const [category, setCategory] = useState<string>("quote");
  const [text, setText] = useState("");
  const [author, setAuthor] = useState("");
  const [selectedContexts, setSelectedContexts] = useState<string[]>([]);

  const createMutation = useMutation({
    mutationFn: async () => {
      const resp = await apiRequest("POST", "/api/admin/messaging", {
        category,
        text,
        author: author || null,
        pageContexts: selectedContexts,
        status: "active",
        suggestedBy: "admin",
      });
      return resp.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/messaging"] });
      toast({ title: "Messaging added" });
      setText("");
      setAuthor("");
      setSelectedContexts([]);
      onClose();
    },
    onError: (err: any) => {
      toast({ title: "Failed to add", description: err.message, variant: "destructive" });
    },
  });

  const toggleContext = (ctx: string) => {
    setSelectedContexts(prev =>
      prev.includes(ctx) ? prev.filter(c => c !== ctx) : [...prev, ctx]
    );
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Custom Messaging</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium">Category</label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger data-testid="select-messaging-category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="quote">Quote</SelectItem>
                <SelectItem value="tagline">Tagline</SelectItem>
                <SelectItem value="cta">CTA</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium">Text</label>
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Enter the messaging text..."
              data-testid="input-messaging-text"
            />
          </div>
          {category === "quote" && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Author (optional)</label>
              <Input
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                placeholder="e.g. Gary Vaynerchuk"
                data-testid="input-messaging-author"
              />
            </div>
          )}
          <div className="space-y-1.5">
            <label className="text-xs font-medium">Page Contexts</label>
            <div className="flex flex-wrap gap-1.5">
              {PAGE_CONTEXT_OPTIONS.map((ctx) => (
                <Badge
                  key={ctx.value}
                  variant={selectedContexts.includes(ctx.value) ? "default" : "outline"}
                  className={`cursor-pointer toggle-elevate ${selectedContexts.includes(ctx.value) ? "toggle-elevated" : ""}`}
                  onClick={() => toggleContext(ctx.value)}
                  data-testid={`toggle-context-${ctx.value}`}
                >
                  {ctx.label}
                </Badge>
              ))}
            </div>
          </div>
          {text && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Preview</label>
              <QuotePreview text={text} author={author || null} category={category} />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} data-testid="button-cancel-messaging">Cancel</Button>
          <Button
            onClick={() => createMutation.mutate()}
            disabled={!text.trim() || createMutation.isPending}
            data-testid="button-save-messaging"
          >
            {createMutation.isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MessagingCard({ item, onPreview }: { item: PlatformMessaging; onPreview: (item: PlatformMessaging) => void }) {
  const { toast } = useToast();
  const Icon = CATEGORY_ICONS[item.category] || Quote;

  const updateMutation = useMutation({
    mutationFn: async (updates: Record<string, any>) => {
      await apiRequest("PATCH", `/api/admin/messaging/${item.id}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/messaging"] });
    },
    onError: (err: any) => {
      toast({ title: "Update failed", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/admin/messaging/${item.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/messaging"] });
      toast({ title: "Messaging deleted" });
    },
  });

  return (
    <Card className="p-3 space-y-2" data-testid={`card-messaging-${item.id}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
          <p className="text-sm leading-snug line-clamp-2">{item.text}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Badge variant={STATUS_COLORS[item.status] || "outline"} className="text-[10px]">
            {item.status}
          </Badge>
          {item.suggestedBy === "charlotte" && (
            <Badge variant="outline" className="text-[10px] gap-0.5">
              <Bot className="h-2.5 w-2.5" /> AI
            </Badge>
          )}
        </div>
      </div>
      {item.author && (
        <p className="text-xs text-muted-foreground">&mdash; {item.author}</p>
      )}
      {item.pageContexts && item.pageContexts.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {item.pageContexts.map((ctx) => (
            <Badge key={ctx} variant="outline" className="text-[9px]">{ctx}</Badge>
          ))}
        </div>
      )}
      <div className="flex items-center gap-1 pt-1">
        {item.status === "suggested" && (
          <>
            <Button
              size="sm"
              variant="outline"
              onClick={() => updateMutation.mutate({ status: "approved" })}
              disabled={updateMutation.isPending}
              data-testid={`button-approve-${item.id}`}
            >
              <Check className="h-3 w-3 mr-1" /> Approve
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => updateMutation.mutate({ status: "rejected" })}
              disabled={updateMutation.isPending}
              data-testid={`button-reject-${item.id}`}
            >
              <X className="h-3 w-3 mr-1" /> Reject
            </Button>
          </>
        )}
        {(item.status === "approved" || item.status === "active") && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => updateMutation.mutate({ status: item.status === "active" ? "approved" : "active" })}
            disabled={updateMutation.isPending}
            data-testid={`button-toggle-active-${item.id}`}
          >
            {item.status === "active" ? "Deactivate" : "Activate"}
          </Button>
        )}
        <Button
          size="icon"
          variant="ghost"
          onClick={() => onPreview(item)}
          data-testid={`button-preview-${item.id}`}
        >
          <Eye className="h-3.5 w-3.5" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          onClick={() => deleteMutation.mutate()}
          disabled={deleteMutation.isPending}
          data-testid={`button-delete-${item.id}`}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </Card>
  );
}

export default function MessagingLibraryPanel({ cityId }: { cityId?: string }) {
  const { toast } = useToast();
  const [addOpen, setAddOpen] = useState(false);
  const [previewItem, setPreviewItem] = useState<PlatformMessaging | null>(null);
  const [activeTab, setActiveTab] = useState("all");

  const { data: items, isLoading } = useQuery<PlatformMessaging[]>({
    queryKey: ["/api/admin/messaging"],
  });

  const suggestMutation = useMutation({
    mutationFn: async () => {
      const resp = await apiRequest("POST", "/api/admin/messaging/suggest-variations");
      return resp.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/messaging"] });
      toast({ title: "Variations generated", description: `${data.generated} new messaging variations created by Charlotte` });
    },
    onError: (err: any) => {
      toast({ title: "Generation failed", description: err.message, variant: "destructive" });
    },
  });

  const builtInCount = INSPIRATION_QUOTES.length;
  const taglineCount = PLATFORM_TAGLINES.length;
  const customCount = items?.length || 0;
  const activeCount = items?.filter(i => i.status === "active").length || 0;
  const suggestedCount = items?.filter(i => i.status === "suggested").length || 0;

  const filteredItems = items?.filter(item => {
    if (activeTab === "all") return true;
    if (activeTab === "suggested") return item.status === "suggested";
    return item.category === activeTab;
  }) || [];

  return (
    <div className="space-y-4 p-4 max-w-5xl" data-testid="messaging-library-panel">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h2 className="text-lg font-bold" data-testid="text-panel-title">Messaging Library</h2>
          <p className="text-xs text-muted-foreground">
            Manage platform quotes, taglines, and CTAs across selling pages
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => suggestMutation.mutate()}
            disabled={suggestMutation.isPending}
            data-testid="button-suggest-variations"
          >
            {suggestMutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5 mr-1.5" />
            )}
            Suggest Variations
          </Button>
          <Button onClick={() => setAddOpen(true)} data-testid="button-add-messaging">
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Add Custom
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-3 text-center">
          <p className="text-2xl font-bold" data-testid="text-builtin-count">{builtInCount}</p>
          <p className="text-[10px] text-muted-foreground">Built-in Quotes</p>
        </Card>
        <Card className="p-3 text-center">
          <p className="text-2xl font-bold" data-testid="text-tagline-count">{taglineCount}</p>
          <p className="text-[10px] text-muted-foreground">Built-in Taglines</p>
        </Card>
        <Card className="p-3 text-center">
          <p className="text-2xl font-bold" data-testid="text-custom-count">{customCount}</p>
          <p className="text-[10px] text-muted-foreground">Custom Messaging</p>
        </Card>
        <Card className="p-3 text-center">
          <p className="text-2xl font-bold" data-testid="text-active-count">{activeCount}</p>
          <p className="text-[10px] text-muted-foreground">Active</p>
        </Card>
      </div>

      {suggestedCount > 0 && (
        <Card className="p-3 flex items-center justify-between gap-2 border-amber-500/30 bg-amber-50/5">
          <div className="flex items-center gap-2">
            <Bot className="h-4 w-4 text-amber-500" />
            <p className="text-sm">
              <span className="font-medium">{suggestedCount}</span> Charlotte-suggested variation{suggestedCount !== 1 ? "s" : ""} awaiting review
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={() => setActiveTab("suggested")} data-testid="button-review-suggested">
            Review
          </Button>
        </Card>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList data-testid="tabs-messaging-filter">
          <TabsTrigger value="all" data-testid="tab-all">All</TabsTrigger>
          <TabsTrigger value="quote" data-testid="tab-quotes">Quotes</TabsTrigger>
          <TabsTrigger value="tagline" data-testid="tab-taglines">Taglines</TabsTrigger>
          <TabsTrigger value="cta" data-testid="tab-ctas">CTAs</TabsTrigger>
          <TabsTrigger value="suggested" data-testid="tab-suggested">
            Suggested
            {suggestedCount > 0 && (
              <Badge variant="secondary" className="ml-1.5 text-[9px] h-4 min-w-[16px] justify-center">{suggestedCount}</Badge>
            )}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : filteredItems.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-sm text-muted-foreground">
            {activeTab === "suggested"
              ? "No pending suggestions. Click \"Suggest Variations\" to have Charlotte generate new messaging."
              : "No custom messaging yet. Add your own or let Charlotte suggest variations."}
          </p>
        </Card>
      ) : (
        <div className="space-y-2">
          {filteredItems.map((item) => (
            <MessagingCard key={item.id} item={item} onPreview={setPreviewItem} />
          ))}
        </div>
      )}

      <AddMessagingDialog open={addOpen} onClose={() => setAddOpen(false)} />

      <Dialog open={!!previewItem} onOpenChange={(v) => !v && setPreviewItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Preview</DialogTitle>
          </DialogHeader>
          {previewItem && (
            <div className="space-y-4">
              <QuotePreview text={previewItem.text} author={previewItem.author} category={previewItem.category} />
              <div className="space-y-1.5">
                <p className="text-xs font-medium">Page Contexts:</p>
                <div className="flex flex-wrap gap-1">
                  {(previewItem.pageContexts || []).length > 0 ? (
                    previewItem.pageContexts!.map((ctx) => (
                      <Badge key={ctx} variant="outline" className="text-[10px]">{ctx}</Badge>
                    ))
                  ) : (
                    <span className="text-xs text-muted-foreground">No page contexts assigned</span>
                  )}
                </div>
              </div>
              <div className="space-y-1.5">
                <p className="text-xs font-medium">Status:</p>
                <Badge variant={STATUS_COLORS[previewItem.status] || "outline"}>{previewItem.status}</Badge>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
