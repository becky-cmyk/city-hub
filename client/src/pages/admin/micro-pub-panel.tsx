import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Copy, Trash2, Eye, Newspaper, ArrowLeft, ExternalLink, MapPin, Save } from "lucide-react";
import type { MicroPublication, MicroPubIssue, MicroPubSection, MicroPubCommunityAd, City } from "@shared/schema";

interface MicroPubPanelProps {
  selectedCityId?: number | string;
}

const SECTION_LABELS: Record<string, string> = {
  pets: "Pets",
  family: "Family",
  senior: "Senior Living",
  events: "Events",
  arts_entertainment: "Arts & Entertainment",
};

const POSITION_LABELS: Record<string, string> = {
  front1: "Front Page 1",
  front2: "Front Page 2",
  back1: "Back Page 1",
  back2: "Back Page 2",
  back3: "Back Page 3",
};

export default function MicroPubPanel({ selectedCityId }: MicroPubPanelProps) {
  const { toast } = useToast();
  const [view, setView] = useState<"list" | "issues" | "editor">("list");
  const [selectedPub, setSelectedPub] = useState<MicroPublication | null>(null);
  const [selectedIssue, setSelectedIssue] = useState<MicroPubIssue | null>(null);
  const [createPubOpen, setCreatePubOpen] = useState(false);
  const [pubForm, setPubForm] = useState({ name: "", hubSlug: "", description: "", coverImageUrl: "" });

  const { data: cities } = useQuery<City[]>({ queryKey: ["/api/admin/cities"] });
  const selectedCity = cities?.find((c) => String(c.id) === String(selectedCityId));

  const { data: publications = [], isLoading: pubsLoading } = useQuery<MicroPublication[]>({
    queryKey: ["/api/admin/micro-publications"],
    queryFn: () => apiRequest("GET", "/api/admin/micro-publications").then(r => r.json()),
  });

  const cityPubs = publications.filter(p => !selectedCityId || String(p.cityId) === String(selectedCityId));

  const createPubMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => apiRequest("POST", "/api/admin/micro-publications", data).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/micro-publications"] });
      setCreatePubOpen(false);
      setPubForm({ name: "", hubSlug: "", description: "", coverImageUrl: "" });
      toast({ title: "Publication created" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deletePubMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/admin/micro-publications/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/micro-publications"] });
      toast({ title: "Publication deleted" });
    },
  });

  if (view === "issues" && selectedPub) {
    return (
      <IssueList
        pub={selectedPub}
        citySlug={selectedCity?.slug || ""}
        onBack={() => { setView("list"); setSelectedPub(null); }}
        onEditIssue={(issue) => { setSelectedIssue(issue); setView("editor"); }}
      />
    );
  }

  if (view === "editor" && selectedPub && selectedIssue) {
    return (
      <IssueEditor
        pub={selectedPub}
        issue={selectedIssue}
        onBack={() => { setView("issues"); setSelectedIssue(null); }}
      />
    );
  }

  return (
    <div className="space-y-4" data-testid="micro-pub-panel">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Micro Hub Publications</h2>
          <p className="text-sm text-muted-foreground">
            Manage print publications and their digital twins
          </p>
        </div>
        <Button
          data-testid="btn-create-publication"
          onClick={() => setCreatePubOpen(true)}
        >
          <Plus className="h-4 w-4 mr-2" />
          New Publication
        </Button>
      </div>

      {pubsLoading ? (
        <div className="text-sm text-muted-foreground">Loading...</div>
      ) : cityPubs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Newspaper className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
            <p className="text-muted-foreground">No publications yet</p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => setCreatePubOpen(true)}
              data-testid="btn-create-pub-empty"
            >
              Create your first publication
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {cityPubs.map(pub => (
            <Card key={pub.id} data-testid={`card-publication-${pub.id}`}>
              <CardContent className="py-4 flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{pub.name}</span>
                    <Badge variant={pub.isActive ? "default" : "secondary"}>
                      {pub.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Hub: {pub.hubSlug} &middot; Slug: /{pub.slug}
                  </div>
                  {pub.description && (
                    <p className="text-sm text-muted-foreground mt-1 truncate">{pub.description}</p>
                  )}
                </div>
                <div className="flex gap-2 ml-4">
                  <Button
                    variant="outline"
                    size="sm"
                    data-testid={`btn-manage-issues-${pub.id}`}
                    onClick={() => { setSelectedPub(pub); setView("issues"); }}
                  >
                    <Newspaper className="h-4 w-4 mr-1" /> Issues
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    data-testid={`btn-delete-pub-${pub.id}`}
                    onClick={() => {
                      if (confirm("Delete this publication and all its issues?")) {
                        deletePubMutation.mutate(pub.id);
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={createPubOpen} onOpenChange={setCreatePubOpen}>
        <DialogContent data-testid="dialog-create-publication">
          <DialogHeader>
            <DialogTitle>New Publication</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Name</Label>
              <Input
                data-testid="input-pub-name"
                value={pubForm.name}
                onChange={e => setPubForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. NoDa Neighborhood Pulse"
              />
            </div>
            <div>
              <Label>Hub Slug</Label>
              <Input
                data-testid="input-pub-hub-slug"
                value={pubForm.hubSlug}
                onChange={e => setPubForm(f => ({ ...f, hubSlug: e.target.value }))}
                placeholder="e.g. noda"
              />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                data-testid="input-pub-description"
                value={pubForm.description}
                onChange={e => setPubForm(f => ({ ...f, description: e.target.value }))}
                placeholder="About this publication..."
                rows={3}
              />
            </div>
            <div>
              <Label>Cover Image URL</Label>
              <Input
                data-testid="input-pub-cover"
                value={pubForm.coverImageUrl}
                onChange={e => setPubForm(f => ({ ...f, coverImageUrl: e.target.value }))}
                placeholder="https://..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              data-testid="btn-submit-publication"
              disabled={!pubForm.name || !pubForm.hubSlug || !selectedCityId || createPubMutation.isPending}
              onClick={() => createPubMutation.mutate({
                name: pubForm.name,
                hubSlug: pubForm.hubSlug,
                description: pubForm.description || null,
                coverImageUrl: pubForm.coverImageUrl || null,
                cityId: String(selectedCityId),
              })}
            >
              {createPubMutation.isPending ? "Creating..." : "Create Publication"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function IssueList({ pub, citySlug, onBack, onEditIssue }: {
  pub: MicroPublication;
  citySlug: string;
  onBack: () => void;
  onEditIssue: (issue: MicroPubIssue) => void;
}) {
  const { toast } = useToast();

  const { data: issues = [], isLoading } = useQuery<MicroPubIssue[]>({
    queryKey: ["/api/admin/micro-publications", pub.id, "issues"],
    queryFn: () => apiRequest("GET", `/api/admin/micro-publications/${pub.id}/issues`).then(r => r.json()),
  });

  const createIssueMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/admin/micro-publications/${pub.id}/issues`, {
      title: `Issue #${issues.length + 1}`,
    }).then(r => r.json()),
    onSuccess: (data: { issue: MicroPubIssue }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/micro-publications", pub.id, "issues"] });
      toast({ title: "Issue created" });
      onEditIssue(data.issue);
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const cloneMutation = useMutation({
    mutationFn: (issueId: string) => apiRequest("POST", `/api/admin/micro-pub-issues/${issueId}/clone`).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/micro-publications", pub.id, "issues"] });
      toast({ title: "Issue cloned with rotated positions" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (issueId: string) => apiRequest("DELETE", `/api/admin/micro-pub-issues/${issueId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/micro-publications", pub.id, "issues"] });
      toast({ title: "Issue deleted" });
    },
  });

  const statusColors: Record<string, "default" | "secondary" | "outline"> = {
    draft: "secondary",
    published: "default",
    archived: "outline",
  };

  const publicUrl = citySlug ? `/${citySlug}/pub/${pub.slug}` : "";

  return (
    <div className="space-y-4" data-testid="issue-list">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack} data-testid="btn-back-to-pubs">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h2 className="text-lg font-semibold">{pub.name}</h2>
          {publicUrl && (
            <a
              href={publicUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-muted-foreground hover:underline flex items-center gap-1"
              data-testid="link-public-url"
            >
              {publicUrl} <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
        <Button
          data-testid="btn-create-issue"
          onClick={() => createIssueMutation.mutate()}
          disabled={createIssueMutation.isPending}
        >
          <Plus className="h-4 w-4 mr-1" /> New Issue
        </Button>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading issues...</div>
      ) : issues.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No issues yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {issues.map(issue => (
            <Card key={issue.id} data-testid={`card-issue-${issue.id}`}>
              <CardContent className="py-3 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">#{issue.issueNumber}: {issue.title}</span>
                    <Badge variant={statusColors[issue.status] || "secondary"}>
                      {issue.status}
                    </Badge>
                  </div>
                  {issue.publishDate && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Published: {new Date(issue.publishDate).toLocaleDateString()}
                    </p>
                  )}
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    data-testid={`btn-edit-issue-${issue.id}`}
                    onClick={() => onEditIssue(issue)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    data-testid={`btn-clone-issue-${issue.id}`}
                    onClick={() => cloneMutation.mutate(issue.id)}
                    disabled={cloneMutation.isPending}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    data-testid={`btn-delete-issue-${issue.id}`}
                    onClick={() => {
                      if (confirm("Delete this issue?")) deleteMutation.mutate(issue.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function IssueEditor({ pub, issue, onBack }: {
  pub: MicroPublication;
  issue: MicroPubIssue;
  onBack: () => void;
}) {
  const { toast } = useToast();
  const [issueTitle, setIssueTitle] = useState(issue.title);
  const [issueStatus, setIssueStatus] = useState(issue.status);
  const [activeTab, setActiveTab] = useState("sections");
  const [pickupText, setPickupText] = useState(
    Array.isArray(issue.pickupLocations)
      ? (issue.pickupLocations as Array<{ name: string; address: string }>).map(l => `${l.name}|${l.address}`).join("\n")
      : ""
  );

  const { data: sections = [], isLoading: sectionsLoading } = useQuery<MicroPubSection[]>({
    queryKey: ["/api/admin/micro-pub-issues", issue.id, "sections"],
    queryFn: () => apiRequest("GET", `/api/admin/micro-pub-issues/${issue.id}/sections`).then(r => r.json()),
  });

  const { data: ads = [] } = useQuery<MicroPubCommunityAd[]>({
    queryKey: ["/api/admin/micro-pub-issues", issue.id, "ads"],
    queryFn: () => apiRequest("GET", `/api/admin/micro-pub-issues/${issue.id}/ads`).then(r => r.json()),
  });

  const updateIssueMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      apiRequest("PATCH", `/api/admin/micro-pub-issues/${issue.id}`, data).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/micro-publications", pub.id, "issues"] });
      toast({ title: "Issue updated" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const saveIssueHeader = () => {
    const locations = pickupText.trim().split("\n").filter(Boolean).map(line => {
      const [name, address] = line.split("|");
      return { name: name?.trim() || "", address: address?.trim() || "" };
    });
    updateIssueMutation.mutate({
      title: issueTitle,
      status: issueStatus,
      publishDate: issueStatus === "published" ? new Date().toISOString() : issue.publishDate,
      pickupLocations: locations,
    });
  };

  return (
    <div className="space-y-4" data-testid="issue-editor">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack} data-testid="btn-back-to-issues">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h2 className="text-lg font-semibold">
            {pub.name} &mdash; #{issue.issueNumber}
          </h2>
        </div>
      </div>

      <Card>
        <CardContent className="py-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <Label>Title</Label>
              <Input
                data-testid="input-issue-title"
                value={issueTitle}
                onChange={e => setIssueTitle(e.target.value)}
              />
            </div>
            <div>
              <Label>Status</Label>
              <Select value={issueStatus} onValueChange={v => setIssueStatus(v as typeof issueStatus)}>
                <SelectTrigger data-testid="select-issue-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="published">Published</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button
                data-testid="btn-save-issue"
                onClick={saveIssueHeader}
                disabled={updateIssueMutation.isPending}
              >
                <Save className="h-4 w-4 mr-1" />
                {updateIssueMutation.isPending ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="sections" data-testid="tab-sections">Sections (5)</TabsTrigger>
          <TabsTrigger value="ads" data-testid="tab-ads">Community Ads (3)</TabsTrigger>
          <TabsTrigger value="pickup" data-testid="tab-pickup">Pickup Locations</TabsTrigger>
        </TabsList>

        <TabsContent value="sections" className="space-y-3 mt-3">
          {sectionsLoading ? (
            <div className="text-sm text-muted-foreground">Loading sections...</div>
          ) : sections.length === 0 ? (
            <p className="text-sm text-muted-foreground">No sections found</p>
          ) : (
            sections.map(section => (
              <SectionCard key={section.id} section={section} issueId={issue.id} />
            ))
          )}
        </TabsContent>

        <TabsContent value="ads" className="mt-3">
          <CommunityAdsEditor issueId={issue.id} ads={ads} />
        </TabsContent>

        <TabsContent value="pickup" className="mt-3">
          <Card>
            <CardContent className="py-4 space-y-3">
              <div className="flex items-center gap-2 mb-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <Label>Pickup Locations (one per line, format: Name|Address)</Label>
              </div>
              <Textarea
                data-testid="input-pickup-locations"
                value={pickupText}
                onChange={e => setPickupText(e.target.value)}
                placeholder={"Harris Teeter NoDa|123 N Davidson St\nLocal Coffee Shop|456 E 36th St"}
                rows={6}
              />
              <p className="text-xs text-muted-foreground">
                Changes are saved when you click Save on the issue header above.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SectionCard({ section, issueId }: { section: MicroPubSection; issueId: string }) {
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(false);
  const [form, setForm] = useState({
    storyTitle: section.storyTitle || "",
    storyBody: section.storyBody || "",
    storyImageUrl: section.storyImageUrl || "",
    nonprofitName: section.nonprofitName || "",
    nonprofitUrl: section.nonprofitUrl || "",
    sponsorName: section.sponsorName || "",
    sponsorImageUrl: section.sponsorImageUrl || "",
    sponsorLink: section.sponsorLink || "",
    sponsorLabel: section.sponsorLabel || "",
  });

  const updateMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      apiRequest("PATCH", `/api/admin/micro-pub-sections/${section.id}`, data).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/micro-pub-issues", issueId, "sections"] });
      toast({ title: "Section saved" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  return (
    <Card data-testid={`card-section-${section.id}`}>
      <CardHeader
        className="py-3 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-sm">
              {SECTION_LABELS[section.sectionType] || section.sectionType}
            </CardTitle>
            <Badge variant="outline">{POSITION_LABELS[section.position] || section.position}</Badge>
          </div>
          <div className="flex items-center gap-2">
            {section.sponsorName && (
              <Badge variant="secondary">Sponsor: {section.sponsorName}</Badge>
            )}
            {section.storyTitle && (
              <Badge variant="outline">Has story</Badge>
            )}
          </div>
        </div>
      </CardHeader>
      {expanded && (
        <CardContent className="pt-0 pb-4 space-y-4">
          <div className="space-y-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Nonprofit Story</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label>Story Title</Label>
                <Input
                  data-testid={`input-story-title-${section.id}`}
                  value={form.storyTitle}
                  onChange={e => setForm(f => ({ ...f, storyTitle: e.target.value }))}
                />
              </div>
              <div>
                <Label>Nonprofit Name</Label>
                <Input
                  data-testid={`input-nonprofit-name-${section.id}`}
                  value={form.nonprofitName}
                  onChange={e => setForm(f => ({ ...f, nonprofitName: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <Label>Story Body</Label>
              <Textarea
                data-testid={`input-story-body-${section.id}`}
                value={form.storyBody}
                onChange={e => setForm(f => ({ ...f, storyBody: e.target.value }))}
                rows={4}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label>Story Image URL</Label>
                <Input
                  data-testid={`input-story-image-${section.id}`}
                  value={form.storyImageUrl}
                  onChange={e => setForm(f => ({ ...f, storyImageUrl: e.target.value }))}
                />
              </div>
              <div>
                <Label>Nonprofit URL</Label>
                <Input
                  data-testid={`input-nonprofit-url-${section.id}`}
                  value={form.nonprofitUrl}
                  onChange={e => setForm(f => ({ ...f, nonprofitUrl: e.target.value }))}
                />
              </div>
            </div>
          </div>

          <div className="border-t pt-4 space-y-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Paired Sponsor</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label>Sponsor Name</Label>
                <Input
                  data-testid={`input-sponsor-name-${section.id}`}
                  value={form.sponsorName}
                  onChange={e => setForm(f => ({ ...f, sponsorName: e.target.value }))}
                />
              </div>
              <div>
                <Label>Sponsor Label</Label>
                <Input
                  data-testid={`input-sponsor-label-${section.id}`}
                  value={form.sponsorLabel}
                  onChange={e => setForm(f => ({ ...f, sponsorLabel: e.target.value }))}
                  placeholder="e.g. Sponsored by"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label>Sponsor Image URL</Label>
                <Input
                  data-testid={`input-sponsor-image-${section.id}`}
                  value={form.sponsorImageUrl}
                  onChange={e => setForm(f => ({ ...f, sponsorImageUrl: e.target.value }))}
                />
              </div>
              <div>
                <Label>Sponsor Link</Label>
                <Input
                  data-testid={`input-sponsor-link-${section.id}`}
                  value={form.sponsorLink}
                  onChange={e => setForm(f => ({ ...f, sponsorLink: e.target.value }))}
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              data-testid={`btn-save-section-${section.id}`}
              onClick={() => updateMutation.mutate(form)}
              disabled={updateMutation.isPending}
            >
              <Save className="h-4 w-4 mr-1" />
              {updateMutation.isPending ? "Saving..." : "Save Section"}
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

function CommunityAdsEditor({ issueId, ads }: { issueId: string; ads: MicroPubCommunityAd[] }) {
  const { toast } = useToast();
  const [adSlots, setAdSlots] = useState<Array<{
    slotNumber: number;
    businessName: string;
    imageUrl: string;
    link: string;
  }>>(() => {
    const slots = [1, 2, 3].map(n => {
      const existing = ads.find(a => a.slotNumber === n);
      return {
        slotNumber: n,
        businessName: existing?.businessName || "",
        imageUrl: existing?.imageUrl || "",
        link: existing?.link || "",
      };
    });
    return slots;
  });

  useEffect(() => {
    setAdSlots([1, 2, 3].map(n => {
      const existing = ads.find(a => a.slotNumber === n);
      return {
        slotNumber: n,
        businessName: existing?.businessName || "",
        imageUrl: existing?.imageUrl || "",
        link: existing?.link || "",
      };
    }));
  }, [ads]);

  const saveMutation = useMutation({
    mutationFn: (data: unknown) =>
      apiRequest("PUT", `/api/admin/micro-pub-issues/${issueId}/ads`, data).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/micro-pub-issues", issueId, "ads"] });
      toast({ title: "Community ads saved" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateSlot = (index: number, field: string, value: string) => {
    setAdSlots(prev => prev.map((s, i) => i === index ? { ...s, [field]: value } : s));
  };

  return (
    <div className="space-y-3" data-testid="community-ads-editor">
      {adSlots.map((slot, i) => (
        <Card key={slot.slotNumber} data-testid={`card-ad-slot-${slot.slotNumber}`}>
          <CardContent className="py-3 space-y-2">
            <p className="text-sm font-medium">Ad Slot {slot.slotNumber}</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <div>
                <Label>Business Name</Label>
                <Input
                  data-testid={`input-ad-name-${slot.slotNumber}`}
                  value={slot.businessName}
                  onChange={e => updateSlot(i, "businessName", e.target.value)}
                />
              </div>
              <div>
                <Label>Image URL</Label>
                <Input
                  data-testid={`input-ad-image-${slot.slotNumber}`}
                  value={slot.imageUrl}
                  onChange={e => updateSlot(i, "imageUrl", e.target.value)}
                />
              </div>
              <div>
                <Label>Link</Label>
                <Input
                  data-testid={`input-ad-link-${slot.slotNumber}`}
                  value={slot.link}
                  onChange={e => updateSlot(i, "link", e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
      <div className="flex justify-end">
        <Button
          data-testid="btn-save-ads"
          onClick={() => saveMutation.mutate(adSlots)}
          disabled={saveMutation.isPending}
        >
          <Save className="h-4 w-4 mr-1" />
          {saveMutation.isPending ? "Saving..." : "Save Community Ads"}
        </Button>
      </div>
    </div>
  );
}
