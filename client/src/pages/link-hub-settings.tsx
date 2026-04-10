import { useState, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { AuthDialog } from "@/components/auth-dialog";
import { Link } from "wouter";
import {
  Link as LinkIcon,
  Plus,
  Trash2,
  Save,
  ExternalLink,
  Eye,
  EyeOff,
  GripVertical,
  BarChart3,
  Settings,
  Copy,
  Check,
  ArrowLeft,
  Lock,
  Loader2,
  ArrowUp,
  ArrowDown,
  Pencil,
  X,
} from "lucide-react";

interface LinkHubLink {
  id: string;
  title: string;
  url: string;
  icon: string | null;
  sortOrder: number;
  isVisible: boolean;
  clickCount: number;
}

interface LinkHubSettingsData {
  userId: string;
  bio: string | null;
  themeColor: string | null;
  showBusinesses: boolean;
  showEvents: boolean;
  showMarketplace: boolean;
  showSocialLinks: boolean;
  showCreatorContent: boolean;
  linkOrder?: string[] | null;
}

interface AutoLink {
  id: string;
  title: string;
  url: string;
  icon: string | null;
  type: string;
}

interface PublicLinkHubData {
  autoLinks: AutoLink[];
  customLinks: Array<{ id: string; title: string; url: string; icon: string | null; sortOrder: number; type: string }>;
  linkOrder: string[] | null;
}

interface AnalyticsData {
  totalClicks: number;
  links: Array<{ id: string; title: string; url: string; clickCount: number }>;
}

export default function LinkHubSettingsPage({ citySlug }: { citySlug: string }) {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [authOpen, setAuthOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"links" | "settings" | "analytics">("links");
  const [newLinkTitle, setNewLinkTitle] = useState("");
  const [newLinkUrl, setNewLinkUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [editingLinkId, setEditingLinkId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editUrl, setEditUrl] = useState("");

  const isPremium = user?.isVerifiedContributor === true || (user?.contributorStatus && user.contributorStatus !== "free");

  const { data: settings, isLoading: settingsLoading } = useQuery<LinkHubSettingsData>({
    queryKey: ["/api/link-hub/my/settings"],
    enabled: !!user,
  });

  const { data: links, isLoading: linksLoading } = useQuery<LinkHubLink[]>({
    queryKey: ["/api/link-hub/my/links"],
    enabled: !!user,
  });

  const { data: publicData } = useQuery<PublicLinkHubData>({
    queryKey: ["/api/cities", citySlug, "link-hub", user?.handle],
    queryFn: async () => {
      if (!user?.handle) return { autoLinks: [], customLinks: [], linkOrder: null };
      const res = await fetch(`/api/cities/${citySlug}/link-hub/${user.handle}`);
      if (!res.ok) return { autoLinks: [], customLinks: [], linkOrder: null };
      return res.json();
    },
    enabled: !!user?.handle && activeTab === "links",
  });

  const { data: analytics } = useQuery<AnalyticsData>({
    queryKey: ["/api/link-hub/my/analytics"],
    enabled: !!user && !!isPremium && activeTab === "analytics",
  });

  const saveMutation = useMutation({
    mutationFn: async (data: Partial<LinkHubSettingsData>) => {
      const res = await apiRequest("PUT", "/api/link-hub/my/settings", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/link-hub/my/settings"] });
      toast({ title: "Settings saved" });
    },
    onError: () => toast({ title: "Failed to save", variant: "destructive" }),
  });

  const addLinkMutation = useMutation({
    mutationFn: async (data: { title: string; url: string }) => {
      const res = await apiRequest("POST", "/api/link-hub/my/links", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/link-hub/my/links"] });
      setNewLinkTitle("");
      setNewLinkUrl("");
      toast({ title: "Link added" });
    },
    onError: (err: any) => toast({ title: err.message || "Failed to add link", variant: "destructive" }),
  });

  const updateLinkMutation = useMutation({
    mutationFn: async ({ linkId, data }: { linkId: string; data: { title?: string; url?: string } }) => {
      const res = await apiRequest("PUT", `/api/link-hub/my/links/${linkId}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/link-hub/my/links"] });
      setEditingLinkId(null);
      toast({ title: "Link updated" });
    },
    onError: (err: any) => toast({ title: err.message || "Failed to update link", variant: "destructive" }),
  });

  const deleteLinkMutation = useMutation({
    mutationFn: async (linkId: string) => {
      await apiRequest("DELETE", `/api/link-hub/my/links/${linkId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/link-hub/my/links"] });
      toast({ title: "Link removed" });
    },
  });

  const toggleVisibilityMutation = useMutation({
    mutationFn: async ({ linkId, isVisible }: { linkId: string; isVisible: boolean }) => {
      const res = await apiRequest("PUT", `/api/link-hub/my/links/${linkId}`, { isVisible });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/link-hub/my/links"] });
    },
  });

  const reorderMutation = useMutation({
    mutationFn: async (linkIds: string[]) => {
      const res = await apiRequest("PUT", "/api/link-hub/my/links/reorder", { linkIds });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/link-hub/my/links"] });
    },
    onError: () => toast({ title: "Failed to reorder", variant: "destructive" }),
  });

  const saveAllLinkOrderMutation = useMutation({
    mutationFn: async (linkOrder: string[]) => {
      const res = await apiRequest("PUT", "/api/link-hub/my/settings", { linkOrder });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/link-hub/my/settings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cities", citySlug, "link-hub", user?.handle] });
    },
    onError: () => toast({ title: "Failed to save order", variant: "destructive" }),
  });

  const getAllLinksOrdered = useCallback(() => {
    const autoLinks = publicData?.autoLinks || [];
    const customLinks = (links || []).filter(l => l.isVisible).map(l => ({
      id: l.id, title: l.title, url: l.url, icon: l.icon, type: "custom" as const,
    }));
    const allUnsorted = [...autoLinks, ...customLinks];
    const currentOrder = settings?.linkOrder;
    if (currentOrder && currentOrder.length > 0) {
      const linkMap = new Map(allUnsorted.map(l => [l.id, l]));
      const ordered: typeof allUnsorted = [];
      for (const id of currentOrder) {
        const link = linkMap.get(id);
        if (link) { ordered.push(link); linkMap.delete(id); }
      }
      for (const link of linkMap.values()) { ordered.push(link); }
      return ordered;
    }
    return allUnsorted;
  }, [publicData, links, settings]);

  const handleMoveAllLinks = useCallback((index: number, direction: "up" | "down") => {
    const ordered = getAllLinksOrdered();
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= ordered.length) return;
    const newOrder = [...ordered];
    [newOrder[index], newOrder[targetIndex]] = [newOrder[targetIndex], newOrder[index]];
    const linkIds = newOrder.map(l => l.id);
    if (settings) {
      queryClient.setQueryData(["/api/link-hub/my/settings"], { ...settings, linkOrder: linkIds });
    }
    saveAllLinkOrderMutation.mutate(linkIds);
  }, [getAllLinksOrdered, settings, saveAllLinkOrderMutation]);

  const handleMoveCustomLink = useCallback((index: number, direction: "up" | "down") => {
    if (!links) return;
    const sorted = [...links].sort((a, b) => a.sortOrder - b.sortOrder);
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= sorted.length) return;

    const newOrder = [...sorted];
    [newOrder[index], newOrder[targetIndex]] = [newOrder[targetIndex], newOrder[index]];
    const linkIds = newOrder.map(l => l.id);

    queryClient.setQueryData<LinkHubLink[]>(["/api/link-hub/my/links"], newOrder.map((l, i) => ({ ...l, sortOrder: i })));
    reorderMutation.mutate(linkIds);
  }, [links, reorderMutation]);

  const startEditing = (link: LinkHubLink) => {
    setEditingLinkId(link.id);
    setEditTitle(link.title);
    setEditUrl(link.url);
  };

  const saveEdit = () => {
    if (!editingLinkId || !editTitle.trim() || !editUrl.trim()) return;
    let url = editUrl.trim();
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      url = `https://${url}`;
    }
    updateLinkMutation.mutate({ linkId: editingLinkId, data: { title: editTitle.trim(), url } });
  };

  if (authLoading) {
    return (
      <div className="max-w-2xl mx-auto space-y-4" data-testid="link-hub-settings-loading">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-md mx-auto text-center py-12" data-testid="link-hub-settings-auth">
        <LinkIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h2 className="text-xl font-bold mb-2">My Link Page</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Sign in to create and manage your personal link page.
        </p>
        <Button onClick={() => setAuthOpen(true)} data-testid="button-sign-in-link-hub">
          Sign In
        </Button>
        <AuthDialog open={authOpen} onOpenChange={setAuthOpen} citySlug={citySlug} />
      </div>
    );
  }

  const linkPageUrl = user.handle ? `/${citySlug}/@${user.handle}` : null;
  const fullUrl = linkPageUrl ? `${window.location.origin}${linkPageUrl}` : null;

  const handleCopy = async () => {
    if (fullUrl) {
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({ title: "Link copied!" });
    }
  };

  const handleSaveSettings = () => {
    if (!settings) return;
    saveMutation.mutate({
      bio: settings.bio,
      themeColor: settings.themeColor,
      showBusinesses: settings.showBusinesses,
      showEvents: settings.showEvents,
      showMarketplace: settings.showMarketplace,
      showSocialLinks: settings.showSocialLinks,
      showCreatorContent: settings.showCreatorContent,
    });
  };

  const handleAddLink = () => {
    if (!newLinkTitle.trim() || !newLinkUrl.trim()) return;
    let url = newLinkUrl.trim();
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      url = `https://${url}`;
    }
    addLinkMutation.mutate({ title: newLinkTitle.trim(), url });
  };

  const sortedLinks = links ? [...links].sort((a, b) => a.sortOrder - b.sortOrder) : [];

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2" data-testid="text-link-hub-settings-title">
            <LinkIcon className="h-5 w-5" />
            My Link Page
          </h1>
          {!user.handle && (
            <p className="text-sm text-muted-foreground mt-1">
              Set up a handle in your profile to activate your link page.
            </p>
          )}
        </div>

        {linkPageUrl && (
          <div className="flex items-center gap-2">
            <Link href={linkPageUrl}>
              <Button variant="outline" size="sm" data-testid="button-preview-link-hub">
                <Eye className="h-3.5 w-3.5 mr-1" />
                Preview
              </Button>
            </Link>
            <Button variant="outline" size="sm" onClick={handleCopy} data-testid="button-copy-link-hub-url">
              {copied ? <Check className="h-3.5 w-3.5 mr-1" /> : <Copy className="h-3.5 w-3.5 mr-1" />}
              {copied ? "Copied" : "Copy URL"}
            </Button>
          </div>
        )}
      </div>

      <div className="flex gap-1 border-b">
        {(["links", "settings", "analytics"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
            data-testid={`tab-link-hub-${tab}`}
          >
            {tab === "links" && <LinkIcon className="h-3.5 w-3.5 inline mr-1.5" />}
            {tab === "settings" && <Settings className="h-3.5 w-3.5 inline mr-1.5" />}
            {tab === "analytics" && <BarChart3 className="h-3.5 w-3.5 inline mr-1.5" />}
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
            {tab === "analytics" && !isPremium && <Lock className="h-3 w-3 inline ml-1" />}
          </button>
        ))}
      </div>

      {activeTab === "links" && (
        <div className="space-y-4">
          <Card className="p-4" data-testid="card-add-link">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
              <Plus className="h-4 w-4" />
              Add Custom Link
              {!isPremium && links && links.length >= 5 && (
                <Badge variant="secondary" className="ml-2 text-xs">Limit reached</Badge>
              )}
            </h3>
            <div className="space-y-2">
              <Input
                placeholder="Link title"
                value={newLinkTitle}
                onChange={(e) => setNewLinkTitle(e.target.value)}
                data-testid="input-link-title"
              />
              <Input
                placeholder="URL (e.g. https://example.com)"
                value={newLinkUrl}
                onChange={(e) => setNewLinkUrl(e.target.value)}
                data-testid="input-link-url"
              />
              <Button
                size="sm"
                onClick={handleAddLink}
                disabled={!newLinkTitle.trim() || !newLinkUrl.trim() || addLinkMutation.isPending || (!isPremium && (links?.length || 0) >= 5)}
                data-testid="button-add-link"
              >
                {addLinkMutation.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Plus className="h-3.5 w-3.5 mr-1" />}
                Add Link
              </Button>
              {!isPremium && (
                <p className="text-xs text-muted-foreground">
                  Free accounts: {links?.length || 0}/5 custom links used
                </p>
              )}
            </div>
          </Card>

          {linksLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : sortedLinks.length > 0 ? (
            <div className="space-y-2" data-testid="link-hub-links-list">
              {sortedLinks.map((link, index) => (
                <Card key={link.id} className="p-3" data-testid={`card-manage-link-${link.id}`}>
                  {editingLinkId === link.id ? (
                    <div className="space-y-2">
                      <Input
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        placeholder="Link title"
                        data-testid={`input-edit-title-${link.id}`}
                      />
                      <Input
                        value={editUrl}
                        onChange={(e) => setEditUrl(e.target.value)}
                        placeholder="URL"
                        data-testid={`input-edit-url-${link.id}`}
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={saveEdit}
                          disabled={updateLinkMutation.isPending || !editTitle.trim() || !editUrl.trim()}
                          data-testid={`button-save-edit-${link.id}`}
                        >
                          {updateLinkMutation.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1" />}
                          Save
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditingLinkId(null)}
                          data-testid={`button-cancel-edit-${link.id}`}
                        >
                          <X className="h-3.5 w-3.5 mr-1" />
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <div className="flex flex-col gap-0.5 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5"
                          disabled={index === 0 || reorderMutation.isPending}
                          onClick={() => handleMoveCustomLink(index, "up")}
                          data-testid={`button-move-up-${link.id}`}
                        >
                          <ArrowUp className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5"
                          disabled={index === sortedLinks.length - 1 || reorderMutation.isPending}
                          onClick={() => handleMoveCustomLink(index, "down")}
                          data-testid={`button-move-down-${link.id}`}
                        >
                          <ArrowDown className="h-3 w-3" />
                        </Button>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium truncate ${!link.isVisible ? "line-through text-muted-foreground" : ""}`}>
                          {link.title}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">{link.url}</p>
                      </div>
                      {isPremium && (
                        <Badge variant="outline" className="text-xs shrink-0">
                          {link.clickCount} clicks
                        </Badge>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => startEditing(link)}
                        data-testid={`button-edit-link-${link.id}`}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleVisibilityMutation.mutate({ linkId: link.id, isVisible: !link.isVisible })}
                        data-testid={`button-toggle-link-${link.id}`}
                      >
                        {link.isVisible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        onClick={() => deleteLinkMutation.mutate(link.id)}
                        data-testid={`button-delete-link-${link.id}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </Card>
              ))}
            </div>
          ) : (
            <Card className="p-8 text-center" data-testid="link-hub-no-links">
              <LinkIcon className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">No custom links yet. Add your first one above.</p>
            </Card>
          )}

          {publicData && getAllLinksOrdered().length > 1 && (
            <Card className="p-4 mt-4" data-testid="card-link-display-order">
              <h3 className="text-sm font-semibold mb-1 flex items-center gap-1.5">
                <GripVertical className="h-4 w-4" />
                Link Display Order
              </h3>
              <p className="text-xs text-muted-foreground mb-3">
                Reorder how all links appear on your public page.
              </p>
              <div className="space-y-1.5">
                {getAllLinksOrdered().map((link, index) => (
                  <div key={link.id} className="flex items-center gap-2 p-2 rounded border text-sm" data-testid={`order-link-${link.id}`}>
                    <div className="flex flex-col gap-0.5 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5"
                        disabled={index === 0 || saveAllLinkOrderMutation.isPending}
                        onClick={() => handleMoveAllLinks(index, "up")}
                        data-testid={`button-order-up-${link.id}`}
                      >
                        <ArrowUp className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5"
                        disabled={index === getAllLinksOrdered().length - 1 || saveAllLinkOrderMutation.isPending}
                        onClick={() => handleMoveAllLinks(index, "down")}
                        data-testid={`button-order-down-${link.id}`}
                      >
                        <ArrowDown className="h-3 w-3" />
                      </Button>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{link.title}</p>
                    </div>
                    <Badge variant="outline" className="text-xs shrink-0 capitalize">
                      {link.type}
                    </Badge>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}

      {activeTab === "settings" && (
        <div className="space-y-4">
          <Card className="p-4 space-y-4" data-testid="card-link-hub-settings">
            <div>
              <Label htmlFor="bio" className="text-sm font-medium flex items-center gap-1.5">
                Custom Bio
                {!isPremium && <Lock className="h-3 w-3 text-muted-foreground" />}
              </Label>
              {isPremium ? (
                <>
                  <Textarea
                    id="bio"
                    placeholder="Tell people about yourself..."
                    value={settings?.bio || ""}
                    onChange={(e) => {
                      if (settings) {
                        queryClient.setQueryData(["/api/link-hub/my/settings"], {
                          ...settings,
                          bio: e.target.value,
                        });
                      }
                    }}
                    maxLength={280}
                    rows={3}
                    data-testid="input-link-hub-bio"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {(settings?.bio || "").length}/280 characters
                  </p>
                </>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Custom bios are available for verified/premium members.
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="themeColor" className="text-sm font-medium flex items-center gap-1.5">
                Theme Color
                {!isPremium && <Lock className="h-3 w-3 text-muted-foreground" />}
              </Label>
              {isPremium ? (
                <Input
                  id="themeColor"
                  placeholder="e.g. 273 66% 34%"
                  value={settings?.themeColor || ""}
                  onChange={(e) => {
                    if (settings) {
                      queryClient.setQueryData(["/api/link-hub/my/settings"], {
                        ...settings,
                        themeColor: e.target.value,
                      });
                    }
                  }}
                  data-testid="input-link-hub-theme-color"
                />
              ) : (
                <p className="text-xs text-muted-foreground">
                  Custom theme colors are available for verified/premium members.
                </p>
              )}
            </div>
          </Card>

          <Card className="p-4 space-y-4" data-testid="card-link-hub-visibility">
            <h3 className="text-sm font-semibold">Auto-populated Links</h3>
            <p className="text-xs text-muted-foreground">
              Choose which types of content appear automatically on your link page.
            </p>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="showBusinesses" className="text-sm">Show Businesses</Label>
                <Switch
                  id="showBusinesses"
                  checked={settings?.showBusinesses ?? true}
                  onCheckedChange={(checked) => {
                    if (settings) {
                      queryClient.setQueryData(["/api/link-hub/my/settings"], {
                        ...settings,
                        showBusinesses: checked,
                      });
                    }
                  }}
                  data-testid="switch-show-businesses"
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="showEvents" className="text-sm">Show Events</Label>
                <Switch
                  id="showEvents"
                  checked={settings?.showEvents ?? true}
                  onCheckedChange={(checked) => {
                    if (settings) {
                      queryClient.setQueryData(["/api/link-hub/my/settings"], {
                        ...settings,
                        showEvents: checked,
                      });
                    }
                  }}
                  data-testid="switch-show-events"
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="showMarketplace" className="text-sm">Show Marketplace Listings</Label>
                <Switch
                  id="showMarketplace"
                  checked={settings?.showMarketplace ?? true}
                  onCheckedChange={(checked) => {
                    if (settings) {
                      queryClient.setQueryData(["/api/link-hub/my/settings"], {
                        ...settings,
                        showMarketplace: checked,
                      });
                    }
                  }}
                  data-testid="switch-show-marketplace"
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="showCreatorContent" className="text-sm">Show Pulse Posts</Label>
                <Switch
                  id="showCreatorContent"
                  checked={settings?.showCreatorContent ?? true}
                  onCheckedChange={(checked) => {
                    if (settings) {
                      queryClient.setQueryData(["/api/link-hub/my/settings"], {
                        ...settings,
                        showCreatorContent: checked,
                      });
                    }
                  }}
                  data-testid="switch-show-creator-content"
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="showSocialLinks" className="text-sm">Show Social & Website Links</Label>
                <Switch
                  id="showSocialLinks"
                  checked={settings?.showSocialLinks ?? true}
                  onCheckedChange={(checked) => {
                    if (settings) {
                      queryClient.setQueryData(["/api/link-hub/my/settings"], {
                        ...settings,
                        showSocialLinks: checked,
                      });
                    }
                  }}
                  data-testid="switch-show-social-links"
                />
              </div>
            </div>
          </Card>

          <Button onClick={handleSaveSettings} disabled={saveMutation.isPending} data-testid="button-save-link-hub-settings">
            {saveMutation.isPending ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Save className="h-4 w-4 mr-1.5" />}
            Save Settings
          </Button>
        </div>
      )}

      {activeTab === "analytics" && (
        <div className="space-y-4">
          {!isPremium ? (
            <Card className="p-8 text-center" data-testid="card-analytics-locked">
              <Lock className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <h3 className="font-semibold mb-1">Link Analytics</h3>
              <p className="text-sm text-muted-foreground mb-3">
                Link click analytics are available for verified and premium members.
              </p>
              <Badge variant="secondary">Premium Feature</Badge>
            </Card>
          ) : analytics ? (
            <>
              <Card className="p-4" data-testid="card-analytics-total">
                <div className="text-center">
                  <p className="text-3xl font-bold">{analytics.totalClicks}</p>
                  <p className="text-sm text-muted-foreground">Total Link Clicks</p>
                </div>
              </Card>

              {analytics.links.length > 0 && (
                <div className="space-y-2" data-testid="analytics-links-list">
                  {analytics.links
                    .sort((a, b) => b.clickCount - a.clickCount)
                    .map((link) => (
                      <Card key={link.id} className="p-3" data-testid={`card-analytics-link-${link.id}`}>
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">{link.title}</p>
                            <p className="text-xs text-muted-foreground truncate">{link.url}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-lg font-bold">{link.clickCount}</p>
                            <p className="text-xs text-muted-foreground">clicks</p>
                          </div>
                        </div>
                      </Card>
                    ))}
                </div>
              )}
            </>
          ) : (
            <div className="space-y-2">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
