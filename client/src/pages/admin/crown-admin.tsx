import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Crown, Trophy, Users, Vote, Plus, Loader2, Trash2, Send,
  BarChart3, Eye, Flag, Check, X, Award, UserPlus, Copy,
  Radar, Settings, Play, CircleCheck, Scan, Megaphone,
  Mail, Phone, RefreshCw, TrendingUp, Clock, Target,
  Zap, Gift, ArrowRight, FileText, Package, Monitor, Pen, Shield,
} from "lucide-react";
import type { CrownCategory, CrownParticipant } from "@shared/schema";
import { useAdminCitySelection } from "@/hooks/use-city";

interface CrownAdminProps {
  selectedCityId: string;
  initialTab?: string;
}

const STATUS_COLORS: Record<string, string> = {
  candidate: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  invited: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  verified_participant: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  nominee: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  qualified_nominee: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
  crown_winner: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
};

const STATUS_LABELS: Record<string, string> = {
  candidate: "Candidate",
  invited: "Invited",
  verified_participant: "Verified",
  nominee: "Nominee",
  qualified_nominee: "Qualified",
  crown_winner: "Winner",
};

export default function CrownAdmin({ selectedCityId, initialTab = "overview" }: CrownAdminProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState(initialTab);

  const { data: stats, isLoading: statsLoading } = useQuery<any>({
    queryKey: ["/api/admin/crown/stats", selectedCityId],
    queryFn: async () => {
      const r = await fetch(`/api/admin/crown/stats?cityId=${selectedCityId}`);
      if (!r.ok) return { categories: 0, participants: 0, votes: 0, winners: 0, statusBreakdown: [] };
      return r.json();
    },
  });

  return (
    <div className="space-y-6 p-4 md:p-6" data-testid="crown-admin-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-crown-title">
            <Crown className="h-6 w-6" /> Crown Program
          </h1>
          <p className="text-sm text-muted-foreground">Manage categories, participants, votes, and winners</p>
        </div>
      </div>

      {statsLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card data-testid="stat-categories">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                <Crown className="h-4 w-4" /> Categories
              </div>
              <p className="text-2xl font-bold">{stats?.categories || 0}</p>
            </CardContent>
          </Card>
          <Card data-testid="stat-participants">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                <Users className="h-4 w-4" /> Participants
              </div>
              <p className="text-2xl font-bold">{stats?.participants || 0}</p>
            </CardContent>
          </Card>
          <Card data-testid="stat-votes">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                <Vote className="h-4 w-4" /> Votes
              </div>
              <p className="text-2xl font-bold">{stats?.votes || 0}</p>
            </CardContent>
          </Card>
          <Card data-testid="stat-winners">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                <Trophy className="h-4 w-4" /> Winners
              </div>
              <p className="text-2xl font-bold">{stats?.winners || 0}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {stats?.statusBreakdown && stats.statusBreakdown.length > 0 && (
        <div className="flex flex-wrap gap-2" data-testid="status-breakdown">
          {stats.statusBreakdown.map((s: any) => (
            <Badge key={s.status} variant="outline" className="text-xs">
              {STATUS_LABELS[s.status] || s.status}: {s.count}
            </Badge>
          ))}
        </div>
      )}

      {stats?.onboarding && (
        <Card data-testid="stat-onboarding">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-3">
              <Shield className="h-4 w-4" /> Onboarding Funnel
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Invited</p>
                <p className="text-lg font-bold" data-testid="text-onboarding-invited">{stats.onboarding.totalInvited}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Accepted</p>
                <p className="text-lg font-bold" data-testid="text-onboarding-accepted">{stats.onboarding.totalAccepted}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Completed</p>
                <p className="text-lg font-bold" data-testid="text-onboarding-completed">{stats.onboarding.totalCompleted}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Completion Rate</p>
                <p className="text-lg font-bold" data-testid="text-onboarding-rate">{stats.onboarding.completionRate}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList data-testid="crown-tabs">
          <TabsTrigger value="hub-readiness" data-testid="tab-crown-hub-readiness">Hub Readiness</TabsTrigger>
          <TabsTrigger value="overview" data-testid="tab-crown-overview">Overview</TabsTrigger>
          <TabsTrigger value="categories" data-testid="tab-crown-categories">Categories</TabsTrigger>
          <TabsTrigger value="participants" data-testid="tab-crown-participants">Participants</TabsTrigger>
          <TabsTrigger value="hub-assignments" data-testid="tab-crown-hub-assignments">Hub Assignments</TabsTrigger>
          <TabsTrigger value="events" data-testid="tab-crown-events">Events</TabsTrigger>
          <TabsTrigger value="campaigns" data-testid="tab-crown-campaigns">Campaigns</TabsTrigger>
          <TabsTrigger value="packages" data-testid="tab-crown-packages">Packages</TabsTrigger>
          <TabsTrigger value="outreach" data-testid="tab-crown-outreach">Outreach</TabsTrigger>
          <TabsTrigger value="votes" data-testid="tab-crown-votes">Votes</TabsTrigger>
          <TabsTrigger value="flags" data-testid="tab-crown-flags">Flags</TabsTrigger>
          <TabsTrigger value="winners" data-testid="tab-crown-winners">Winners</TabsTrigger>
        </TabsList>

        <TabsContent value="hub-readiness">
          <HubReadinessTab cityId={selectedCityId} />
        </TabsContent>
        <TabsContent value="overview">
          <OverviewTab cityId={selectedCityId} />
        </TabsContent>
        <TabsContent value="categories">
          <CategoriesTab cityId={selectedCityId} />
        </TabsContent>
        <TabsContent value="participants">
          <ParticipantsTab cityId={selectedCityId} />
        </TabsContent>
        <TabsContent value="hub-assignments">
          <HubAssignmentsTab cityId={selectedCityId} />
        </TabsContent>
        <TabsContent value="events">
          <EventsTab cityId={selectedCityId} />
        </TabsContent>
        <TabsContent value="campaigns">
          <CampaignsTab cityId={selectedCityId} />
        </TabsContent>
        <TabsContent value="packages">
          <PackagesTab cityId={selectedCityId} />
        </TabsContent>
        <TabsContent value="outreach">
          <OutreachTab cityId={selectedCityId} />
        </TabsContent>
        <TabsContent value="votes">
          <VotesTab cityId={selectedCityId} />
        </TabsContent>
        <TabsContent value="flags">
          <FlagsTab cityId={selectedCityId} />
        </TabsContent>
        <TabsContent value="winners">
          <WinnersTab cityId={selectedCityId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function OverviewTab({ cityId }: { cityId: string }) {
  const { toast } = useToast();

  const seedMutation = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("POST", "/api/admin/crown/seed-categories", { cityId });
      return r.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/crown/categories"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/crown/stats"] });
      toast({ title: "Categories seeded", description: `${data.created} new categories created` });
    },
    onError: (e: any) => toast({ title: "Seed failed", description: e.message, variant: "destructive" }),
  });

  const seedAllMutation = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("POST", "/api/admin/crown/seed-all", { cityId });
      return r.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/crown/categories"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/crown/participants"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/crown/stats"] });
      toast({ title: "Data seeded", description: `${data.categoriesCreated} categories, ${data.participantsCreated} participants created` });
    },
    onError: (e: any) => toast({ title: "Seed failed", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-6 mt-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Seed Launch Categories</p>
              <p className="text-xs text-muted-foreground">Create 12 default Crown Award categories for this city</p>
            </div>
            <Button
              size="sm"
              onClick={() => seedMutation.mutate()}
              disabled={seedMutation.isPending}
              data-testid="button-seed-categories"
            >
              {seedMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
              Seed Categories
            </Button>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Seed All Data</p>
              <p className="text-xs text-muted-foreground">Create categories and sample participants for testing</p>
            </div>
            <Button
              size="sm"
              onClick={() => seedAllMutation.mutate()}
              disabled={seedAllMutation.isPending}
              data-testid="button-seed-all"
            >
              {seedAllMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
              Seed All
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Program Flow</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <div className="flex items-start gap-3">
              <Badge variant="outline" className="shrink-0 mt-0.5">1</Badge>
              <div>
                <p className="font-medium">Categories Setup</p>
                <p className="text-muted-foreground">Define award categories and set vote thresholds</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Badge variant="outline" className="shrink-0 mt-0.5">2</Badge>
              <div>
                <p className="font-medium">Candidate Nomination</p>
                <p className="text-muted-foreground">Add candidates and send invitation links</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Badge variant="outline" className="shrink-0 mt-0.5">3</Badge>
              <div>
                <p className="font-medium">Verification & Payment</p>
                <p className="text-muted-foreground">Participants accept invite and complete Hub Presence payment</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Badge variant="outline" className="shrink-0 mt-0.5">4</Badge>
              <div>
                <p className="font-medium">Public Voting</p>
                <p className="text-muted-foreground">Verified users vote with fraud detection</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Badge variant="outline" className="shrink-0 mt-0.5">5</Badge>
              <div>
                <p className="font-medium">Winners Announced</p>
                <p className="text-muted-foreground">Qualified nominees with highest votes earn the Crown</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function CategoriesTab({ cityId }: { cityId: string }) {
  const { toast } = useToast();
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [newLevel, setNewLevel] = useState("mid");
  const [newType, setNewType] = useState("business");

  const { data: categories, isLoading } = useQuery<CrownCategory[]>({
    queryKey: ["/api/admin/crown/categories", cityId],
    queryFn: async () => {
      const r = await fetch(`/api/admin/crown/categories?cityId=${cityId}`);
      if (!r.ok) return [];
      return r.json();
    },
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      const threshold = newLevel === "high" ? 75 : newLevel === "mid" ? 40 : 25;
      const r = await apiRequest("POST", "/api/admin/crown/categories", {
        cityId, name: newName, slug: newSlug || newName.toLowerCase().replace(/\s+/g, "-"),
        competitionLevel: newLevel, voteThreshold: threshold, participantType: newType,
        seasonYear: 2026,
      });
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/crown/categories"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/crown/stats"] });
      toast({ title: "Category created" });
      setShowAdd(false); setNewName(""); setNewSlug("");
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/admin/crown/categories/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/crown/categories"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/crown/stats"] });
      toast({ title: "Category deleted" });
    },
  });

  if (isLoading) return <Skeleton className="h-40" />;

  return (
    <div className="space-y-4 mt-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{categories?.length || 0} categories</p>
        <Button size="sm" onClick={() => setShowAdd(true)} data-testid="button-add-category">
          <Plus className="h-4 w-4 mr-1" /> Add Category
        </Button>
      </div>

      <div className="space-y-2">
        {categories?.map(cat => (
          <Card key={cat.id} data-testid={`card-category-${cat.id}`}>
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Crown className="h-4 w-4 text-amber-500" />
                <div>
                  <p className="font-medium text-sm">{cat.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Badge variant="outline" className="text-[10px]">{cat.competitionLevel}</Badge>
                    <span className="text-[10px] text-muted-foreground">Threshold: {cat.voteThreshold}</span>
                    <Badge variant="outline" className="text-[10px]">{cat.participantType}</Badge>
                  </div>
                </div>
              </div>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => deleteMutation.mutate(cat.id)}
                disabled={deleteMutation.isPending}
                data-testid={`button-delete-category-${cat.id}`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Crown Category</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Category name" value={newName} onChange={e => setNewName(e.target.value)} data-testid="input-category-name" />
            <Input placeholder="Slug (auto-generated)" value={newSlug} onChange={e => setNewSlug(e.target.value)} data-testid="input-category-slug" />
            <Select value={newLevel} onValueChange={setNewLevel}>
              <SelectTrigger data-testid="select-competition-level"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="high">High (75 votes)</SelectItem>
                <SelectItem value="mid">Mid (40 votes)</SelectItem>
                <SelectItem value="community">Community (25 votes)</SelectItem>
              </SelectContent>
            </Select>
            <Select value={newType} onValueChange={setNewType}>
              <SelectTrigger data-testid="select-participant-type"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="business">Business</SelectItem>
                <SelectItem value="creator">Creator</SelectItem>
                <SelectItem value="networking_group">Networking Group</SelectItem>
                <SelectItem value="community_org">Community Org</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)} data-testid="button-cancel-category">Cancel</Button>
            <Button onClick={() => addMutation.mutate()} disabled={!newName || addMutation.isPending} data-testid="button-save-category">
              {addMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ParticipantsTab({ cityId }: { cityId: string }) {
  const { toast } = useToast();
  const { selectedCitySlug } = useAdminCitySelection();
  const [showAdd, setShowAdd] = useState(false);
  const [filterCategory, setFilterCategory] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [newName, setNewName] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newCategoryId, setNewCategoryId] = useState("");
  const [newType, setNewType] = useState("business");
  const [newBio, setNewBio] = useState("");

  const { data: categories } = useQuery<CrownCategory[]>({
    queryKey: ["/api/admin/crown/categories", cityId],
    queryFn: async () => {
      const r = await fetch(`/api/admin/crown/categories?cityId=${cityId}`);
      if (!r.ok) return [];
      return r.json();
    },
  });

  const buildUrl = () => {
    let url = `/api/admin/crown/participants?cityId=${cityId}`;
    if (filterCategory && filterCategory !== "all") url += `&categoryId=${filterCategory}`;
    if (filterStatus && filterStatus !== "all") url += `&status=${filterStatus}`;
    return url;
  };

  const { data: participants, isLoading } = useQuery<(CrownParticipant & { categoryName: string })[]>({
    queryKey: ["/api/admin/crown/participants", cityId, filterCategory, filterStatus],
    queryFn: async () => {
      const r = await fetch(buildUrl());
      if (!r.ok) return [];
      return r.json();
    },
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("POST", "/api/admin/crown/participants", {
        cityId, categoryId: newCategoryId, name: newName,
        slug: newSlug || newName.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        email: newEmail || undefined, participantType: newType, bio: newBio || undefined,
        seasonYear: 2026,
      });
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/crown/participants"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/crown/stats"] });
      toast({ title: "Participant added" });
      setShowAdd(false); setNewName(""); setNewSlug(""); setNewEmail(""); setNewBio("");
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const inviteMutation = useMutation({
    mutationFn: async (id: string) => {
      const r = await apiRequest("POST", `/api/admin/crown/participants/${id}/invite`);
      return r.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/crown/participants"] });
      toast({ title: "Invitation sent", description: `Token: ${data.inviteToken}` });
    },
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      await apiRequest("PATCH", `/api/admin/crown/participants/${id}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/crown/participants"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/crown/stats"] });
      toast({ title: "Status updated" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/admin/crown/participants/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/crown/participants"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/crown/stats"] });
      toast({ title: "Participant removed" });
    },
  });

  const copyInviteLink = (token: string) => {
    const citySlug = selectedCitySlug || "";
    const url = `${window.location.origin}/${citySlug}/crown/invitation/${token}`;
    navigator.clipboard.writeText(url);
    toast({ title: "Copied to clipboard" });
  };

  if (isLoading) return <Skeleton className="h-40" />;

  return (
    <div className="space-y-4 mt-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-48" data-testid="select-filter-category">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categories?.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-48" data-testid="select-filter-status">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="candidate">Candidate</SelectItem>
            <SelectItem value="invited">Invited</SelectItem>
            <SelectItem value="verified_participant">Verified</SelectItem>
            <SelectItem value="nominee">Nominee</SelectItem>
            <SelectItem value="qualified_nominee">Qualified</SelectItem>
            <SelectItem value="crown_winner">Winner</SelectItem>
          </SelectContent>
        </Select>
        <div className="ml-auto">
          <Button size="sm" onClick={() => setShowAdd(true)} data-testid="button-add-participant">
            <UserPlus className="h-4 w-4 mr-1" /> Add Participant
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        {participants?.map(p => (
          <Card key={p.id} data-testid={`card-participant-${p.id}`}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm truncate">{p.name}</p>
                    <Badge className={`text-[10px] ${STATUS_COLORS[p.status] || ""}`}>
                      {STATUS_LABELS[p.status] || p.status}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                    <span>{p.categoryName}</span>
                    {p.email && <span>{p.email}</span>}
                    <span>{p.voteCount} votes</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {p.status === "candidate" && (
                    <Button size="sm" variant="outline" onClick={() => inviteMutation.mutate(p.id)}
                      disabled={inviteMutation.isPending} data-testid={`button-invite-${p.id}`}>
                      <Send className="h-3 w-3 mr-1" /> Invite
                    </Button>
                  )}
                  {p.inviteToken && (
                    <Button size="icon" variant="ghost" onClick={() => copyInviteLink(p.inviteToken!)}
                      data-testid={`button-copy-invite-${p.id}`}>
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  {p.status === "verified_participant" && (
                    <Button size="sm" variant="outline" onClick={() => statusMutation.mutate({ id: p.id, status: "nominee" })}
                      disabled={statusMutation.isPending} data-testid={`button-nominate-${p.id}`}>
                      <Award className="h-3 w-3 mr-1" /> Nominate
                    </Button>
                  )}
                  <Button size="icon" variant="ghost" onClick={() => deleteMutation.mutate(p.id)}
                    disabled={deleteMutation.isPending} data-testid={`button-delete-participant-${p.id}`}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {(!participants || participants.length === 0) && (
          <p className="text-center text-muted-foreground py-8 text-sm" data-testid="text-no-participants">
            No participants yet. Add candidates to get started.
          </p>
        )}
      </div>

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Crown Participant</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Name" value={newName} onChange={e => setNewName(e.target.value)} data-testid="input-participant-name" />
            <Input placeholder="Slug (auto-generated)" value={newSlug} onChange={e => setNewSlug(e.target.value)} data-testid="input-participant-slug" />
            <Input placeholder="Email (optional)" value={newEmail} onChange={e => setNewEmail(e.target.value)} data-testid="input-participant-email" />
            <Select value={newCategoryId} onValueChange={setNewCategoryId}>
              <SelectTrigger data-testid="select-participant-category"><SelectValue placeholder="Select category" /></SelectTrigger>
              <SelectContent>
                {categories?.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={newType} onValueChange={setNewType}>
              <SelectTrigger data-testid="select-participant-type"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="business">Business</SelectItem>
                <SelectItem value="creator">Creator</SelectItem>
                <SelectItem value="networking_group">Networking Group</SelectItem>
                <SelectItem value="community_org">Community Org</SelectItem>
              </SelectContent>
            </Select>
            <Textarea placeholder="Bio (optional)" value={newBio} onChange={e => setNewBio(e.target.value)} data-testid="input-participant-bio" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)} data-testid="button-cancel-participant">Cancel</Button>
            <Button onClick={() => addMutation.mutate()} disabled={!newName || !newCategoryId || addMutation.isPending} data-testid="button-save-participant">
              {addMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function VotesTab({ cityId }: { cityId: string }) {
  const { toast } = useToast();

  const { data: votes, isLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/crown/votes", cityId],
    queryFn: async () => {
      const r = await fetch(`/api/admin/crown/votes?cityId=${cityId}`);
      if (!r.ok) return [];
      return r.json();
    },
  });

  const flagMutation = useMutation({
    mutationFn: async ({ id, isFlagged }: { id: string; isFlagged: boolean }) => {
      await apiRequest("PATCH", `/api/admin/crown/votes/${id}/flag`, { isFlagged, flagReason: isFlagged ? "Manual admin flag" : null });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/crown/votes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/crown/participants"] });
      toast({ title: "Vote flag updated" });
    },
  });

  if (isLoading) return <Skeleton className="h-40" />;

  return (
    <div className="space-y-4 mt-4">
      <p className="text-sm text-muted-foreground">{votes?.length || 0} recent votes (last 200)</p>
      <div className="space-y-2">
        {votes?.map(v => (
          <Card key={v.id} data-testid={`card-vote-${v.id}`}>
            <CardContent className="p-3 flex items-center justify-between text-sm">
              <div className="flex items-center gap-3 min-w-0">
                {v.isFlagged && <Flag className="h-4 w-4 text-red-500 shrink-0" />}
                <div className="min-w-0">
                  <p className="truncate">
                    <span className="font-medium">{v.participantName}</span>
                    <span className="text-muted-foreground"> in </span>
                    <span>{v.categoryName}</span>
                  </p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {v.voterIp && <span>IP: {v.voterIp.substring(0, 12)}...</span>}
                    <span>{new Date(v.createdAt).toLocaleDateString()}</span>
                    {v.flagReason && <span className="text-red-500">{v.flagReason}</span>}
                  </div>
                </div>
              </div>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => flagMutation.mutate({ id: v.id, isFlagged: !v.isFlagged })}
                data-testid={`button-flag-vote-${v.id}`}
              >
                {v.isFlagged ? <Check className="h-4 w-4 text-green-500" /> : <Flag className="h-4 w-4" />}
              </Button>
            </CardContent>
          </Card>
        ))}
        {(!votes || votes.length === 0) && (
          <p className="text-center text-muted-foreground py-8 text-sm" data-testid="text-no-votes">No votes recorded yet.</p>
        )}
      </div>
    </div>
  );
}

function HubAssignmentsTab({ cityId }: { cityId: string }) {
  const { toast } = useToast();
  const [showAdd, setShowAdd] = useState(false);
  const [hubId, setHubId] = useState("");
  const [catId, setCatId] = useState("");

  const { data: assignments, isLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/crown/hub-assignments", cityId],
    queryFn: async () => {
      const r = await fetch(`/api/admin/crown/hub-assignments?cityId=${cityId}`);
      return r.json();
    },
  });

  const { data: categories } = useQuery<any[]>({
    queryKey: ["/api/admin/crown/categories", cityId],
    queryFn: async () => {
      const r = await fetch(`/api/admin/crown/categories?cityId=${cityId}`);
      return r.json();
    },
  });

  const { data: hubs } = useQuery<any[]>({
    queryKey: ["/api/admin/regions", cityId],
    queryFn: async () => {
      const r = await fetch(`/api/admin/regions?cityId=${cityId}&type=hub`);
      return r.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("POST", "/api/admin/crown/hub-assignments", { hubId, categoryId: catId, cityId, seasonYear: 2026 });
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/crown/hub-assignments"] });
      setShowAdd(false);
      setHubId(""); setCatId("");
      toast({ title: "Hub-category assignment created" });
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/admin/crown/hub-assignments/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/crown/hub-assignments"] });
      toast({ title: "Assignment removed" });
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-4 mt-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Hub-Category Assignments</h3>
        <Button size="sm" onClick={() => setShowAdd(!showAdd)} data-testid="button-add-hub-assignment">
          <Plus className="h-4 w-4 mr-1" /> Assign Category to Hub
        </Button>
      </div>

      {showAdd && (
        <Card>
          <CardContent className="py-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Hub</label>
                <Select value={hubId} onValueChange={setHubId}>
                  <SelectTrigger data-testid="select-hub"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(hubs || []).map((h: any) => (
                      <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Category</label>
                <Select value={catId} onValueChange={setCatId}>
                  <SelectTrigger data-testid="select-category-assign"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(categories || []).map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button size="sm" onClick={() => createMutation.mutate()} disabled={!hubId || !catId || createMutation.isPending} data-testid="button-save-hub-assignment">
              {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
            </Button>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : !assignments?.length ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">No hub-category assignments yet</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {assignments.map((a: any) => (
            <Card key={a.id} data-testid={`hub-assignment-${a.id}`}>
              <CardContent className="py-3 flex items-center justify-between">
                <div>
                  <span className="font-medium">{a.hubName}</span>
                  <span className="mx-2 text-muted-foreground">&rarr;</span>
                  <span>{a.categoryName}</span>
                </div>
                <Button size="sm" variant="ghost" onClick={() => deleteMutation.mutate(a.id)} data-testid={`button-delete-assignment-${a.id}`}>
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function EventsTab({ cityId }: { cityId: string }) {
  const { toast } = useToast();
  const [showAdd, setShowAdd] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [eventType, setEventType] = useState("meetup");
  const [location, setLocation] = useState("");
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceRule, setRecurrenceRule] = useState("");

  const { data: events, isLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/crown/events", cityId],
    queryFn: async () => {
      const r = await fetch(`/api/admin/crown/events?cityId=${cityId}`);
      return r.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("POST", "/api/admin/crown/events", {
        cityId, title, description, eventType, location, isRecurring, recurrenceRule: isRecurring ? recurrenceRule : null,
      });
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/crown/events"] });
      setShowAdd(false);
      setTitle(""); setDescription(""); setLocation("");
      toast({ title: "Event created" });
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/admin/crown/events/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/crown/events"] });
      toast({ title: "Event deleted" });
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-4 mt-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Crown Events</h3>
        <Button size="sm" onClick={() => setShowAdd(!showAdd)} data-testid="button-add-event">
          <Plus className="h-4 w-4 mr-1" /> Add Event
        </Button>
      </div>

      {showAdd && (
        <Card>
          <CardContent className="py-4 space-y-3">
            <div>
              <label className="text-sm font-medium">Title</label>
              <Input value={title} onChange={e => setTitle(e.target.value)} data-testid="input-event-title" />
            </div>
            <div>
              <label className="text-sm font-medium">Description</label>
              <Input value={description} onChange={e => setDescription(e.target.value)} data-testid="input-event-description" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Type</label>
                <Select value={eventType} onValueChange={setEventType}>
                  <SelectTrigger data-testid="select-event-type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="meetup">Meetup</SelectItem>
                    <SelectItem value="showcase">Showcase</SelectItem>
                    <SelectItem value="awards_ceremony">Awards Ceremony</SelectItem>
                    <SelectItem value="networking">Networking</SelectItem>
                    <SelectItem value="community">Community</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Location</label>
                <Input value={location} onChange={e => setLocation(e.target.value)} data-testid="input-event-location" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" checked={isRecurring} onChange={e => setIsRecurring(e.target.checked)} data-testid="checkbox-recurring" />
              <label className="text-sm">Recurring Event</label>
            </div>
            {isRecurring && (
              <div>
                <label className="text-sm font-medium">Recurrence Rule</label>
                <Input value={recurrenceRule} onChange={e => setRecurrenceRule(e.target.value)} placeholder="e.g. FREQ=WEEKLY;BYDAY=TU" data-testid="input-recurrence-rule" />
              </div>
            )}
            <Button size="sm" onClick={() => createMutation.mutate()} disabled={!title || createMutation.isPending} data-testid="button-save-event">
              {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
            </Button>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : !events?.length ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">No events yet</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {events.map((ev: any) => (
            <Card key={ev.id} data-testid={`event-card-${ev.id}`}>
              <CardContent className="py-3 flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{ev.title}</span>
                    <Badge variant="outline">{ev.eventType}</Badge>
                    {ev.isRecurring && <Badge variant="outline" className="bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300">Recurring</Badge>}
                  </div>
                  {ev.location && <p className="text-sm text-muted-foreground">{ev.location}</p>}
                  {ev.description && <p className="text-xs text-muted-foreground">{ev.description}</p>}
                </div>
                <Button size="sm" variant="ghost" onClick={() => deleteMutation.mutate(ev.id)} data-testid={`button-delete-event-${ev.id}`}>
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function FlagsTab({ cityId }: { cityId: string }) {
  const { toast } = useToast();
  const [showResolved, setShowResolved] = useState(false);

  const { data: flags, isLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/crown/vote-flags", cityId, showResolved],
    queryFn: async () => {
      const r = await fetch(`/api/admin/crown/vote-flags?cityId=${cityId}&resolved=${showResolved}`);
      return r.json();
    },
  });

  const resolveMutation = useMutation({
    mutationFn: async ({ flagId, resolution }: { flagId: string; resolution: string }) => {
      const r = await apiRequest("PATCH", `/api/admin/crown/vote-flags/${flagId}/resolve`, { resolution });
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/crown/vote-flags"] });
      toast({ title: "Flag resolved" });
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-4 mt-4">
      <div className="flex items-center gap-4">
        <Button
          variant={showResolved ? "outline" : "default"}
          size="sm"
          onClick={() => setShowResolved(false)}
          data-testid="button-show-pending-flags"
        >
          <Flag className="h-4 w-4 mr-1" />
          Pending
        </Button>
        <Button
          variant={showResolved ? "default" : "outline"}
          size="sm"
          onClick={() => setShowResolved(true)}
          data-testid="button-show-resolved-flags"
        >
          <Check className="h-4 w-4 mr-1" />
          Resolved
        </Button>
      </div>
      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : !flags?.length ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">No {showResolved ? "resolved" : "pending"} flags</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {flags.map((f: any) => (
            <Card key={f.id} data-testid={`flag-card-${f.id}`}>
              <CardContent className="py-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300">{f.flagType}</Badge>
                      <span className="text-sm font-medium">{f.participantName}</span>
                      <span className="text-xs text-muted-foreground">{f.categoryName}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">{f.reason}</p>
                    {f.voterIp && <p className="text-xs text-muted-foreground">IP: {f.voterIp}</p>}
                    <p className="text-xs text-muted-foreground">{new Date(f.createdAt).toLocaleString()}</p>
                    {f.resolution && (
                      <p className="text-xs font-medium">Resolution: {f.resolution} by {f.resolvedBy}</p>
                    )}
                  </div>
                  {!f.resolvedAt && (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => resolveMutation.mutate({ flagId: f.id, resolution: "dismissed" })}
                        disabled={resolveMutation.isPending}
                        data-testid={`button-dismiss-flag-${f.id}`}
                      >
                        Dismiss
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => resolveMutation.mutate({ flagId: f.id, resolution: "confirmed_fraud" })}
                        disabled={resolveMutation.isPending}
                        data-testid={`button-confirm-flag-${f.id}`}
                      >
                        Confirm Fraud
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function WinnersTab({ cityId }: { cityId: string }) {
  const { toast } = useToast();
  const [showDeclare, setShowDeclare] = useState(false);
  const [winnerCategoryId, setWinnerCategoryId] = useState("");
  const [winnerParticipantId, setWinnerParticipantId] = useState("");

  const { data: winners, isLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/crown/winners", cityId],
    queryFn: async () => {
      const r = await fetch(`/api/admin/crown/winners?cityId=${cityId}`);
      if (!r.ok) return [];
      return r.json();
    },
  });

  const { data: categories } = useQuery<CrownCategory[]>({
    queryKey: ["/api/admin/crown/categories", cityId],
    queryFn: async () => {
      const r = await fetch(`/api/admin/crown/categories?cityId=${cityId}`);
      if (!r.ok) return [];
      return r.json();
    },
  });

  const { data: qualifiedNominees } = useQuery<CrownParticipant[]>({
    queryKey: ["/api/admin/crown/participants", cityId, winnerCategoryId, "qualified"],
    queryFn: async () => {
      if (!winnerCategoryId) return [];
      const r = await fetch(`/api/admin/crown/participants?cityId=${cityId}&categoryId=${winnerCategoryId}`);
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!winnerCategoryId,
  });

  const declareMutation = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("POST", "/api/admin/crown/winners", {
        categoryId: winnerCategoryId, participantId: winnerParticipantId,
        cityId, seasonYear: 2026, rank: 1,
      });
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/crown/winners"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/crown/participants"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/crown/stats"] });
      toast({ title: "Winner declared" });
      setShowDeclare(false);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  if (isLoading) return <Skeleton className="h-40" />;

  return (
    <div className="space-y-4 mt-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{winners?.length || 0} winners</p>
        <Button size="sm" onClick={() => setShowDeclare(true)} data-testid="button-declare-winner">
          <Trophy className="h-4 w-4 mr-1" /> Declare Winner
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {winners?.map(w => (
          <Card key={w.id} data-testid={`card-winner-${w.id}`}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-amber-100 dark:bg-amber-900 flex items-center justify-center">
                  <Trophy className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="font-semibold text-sm">{w.participantName}</p>
                  <p className="text-xs text-muted-foreground">{w.categoryName}</p>
                  {w.announcedAt && (
                    <p className="text-[10px] text-muted-foreground">
                      Announced {new Date(w.announcedAt).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {(!winners || winners.length === 0) && (
        <p className="text-center text-muted-foreground py-8 text-sm" data-testid="text-no-winners">No winners declared yet.</p>
      )}

      <Dialog open={showDeclare} onOpenChange={setShowDeclare}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Declare Crown Winner</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Select value={winnerCategoryId} onValueChange={(v) => { setWinnerCategoryId(v); setWinnerParticipantId(""); }}>
              <SelectTrigger data-testid="select-winner-category"><SelectValue placeholder="Select category" /></SelectTrigger>
              <SelectContent>
                {categories?.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            {winnerCategoryId && (
              <Select value={winnerParticipantId} onValueChange={setWinnerParticipantId}>
                <SelectTrigger data-testid="select-winner-participant"><SelectValue placeholder="Select participant" /></SelectTrigger>
                <SelectContent>
                  {qualifiedNominees?.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} ({p.voteCount} votes) - {STATUS_LABELS[p.status] || p.status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeclare(false)} data-testid="button-cancel-winner">Cancel</Button>
            <Button onClick={() => declareMutation.mutate()}
              disabled={!winnerCategoryId || !winnerParticipantId || declareMutation.isPending}
              data-testid="button-confirm-winner">
              {declareMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Declare Winner"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const HUB_STATUS_STYLES: Record<string, string> = {
  INACTIVE: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  SCANNING: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  READY_FOR_ACTIVATION: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  NOMINATIONS_OPEN: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  VOTING_OPEN: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
  WINNERS_DECLARED: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
  ARCHIVED: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500",
};

const HUB_STATUS_LABELS: Record<string, string> = {
  INACTIVE: "Inactive",
  SCANNING: "Scanning",
  READY_FOR_ACTIVATION: "Ready to Activate",
  NOMINATIONS_OPEN: "Nominations Open",
  VOTING_OPEN: "Voting Open",
  WINNERS_DECLARED: "Winners Declared",
  ARCHIVED: "Archived",
};

interface HubReadinessItem {
  hub_id: string;
  hub_name: string;
  hub_slug: string;
  crown_status: string;
  activation: {
    id: string;
    categoriesScanned: number;
    categoriesReady: number;
    totalQualifiedBusinesses: number;
    readyCategoryNames: string[];
    lastScannedAt: string | null;
    status: string;
  } | null;
}

interface ScanResult {
  activation: Record<string, unknown>;
  hub_ready: boolean;
  summary: {
    hub_name: string;
    hub_id: string;
    total_businesses_detected: number;
    total_qualified_businesses: number;
    categories_scanned: number;
    categories_ready: number;
    categories_not_ready: number;
    recommended_launch_categories: string[];
    hub_crown_status: string;
  };
  category_results: {
    category_name: string;
    category_slug: string;
    category_status: string;
    total_businesses_found: number;
    total_qualified: number;
    candidates: { business_name: string; crown_candidate_score: number; invite_tier: string }[];
  }[];
}

interface CrownConfig {
  id: string;
  minCategoriesForLaunch: number;
  minQualifiedBusinesses: number;
  defaultCategoryMinimum: number;
  scanRadiusMiles: number;
  categoryThresholds: Record<string, number>;
}

function HubReadinessTab({ cityId }: { cityId: string }) {
  const { toast } = useToast();
  const [selectedHub, setSelectedHub] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [showConfig, setShowConfig] = useState(false);
  const [showActivateDialog, setShowActivateDialog] = useState(false);
  const [activatingHubId, setActivatingHubId] = useState<string | null>(null);

  const { data: hubs, isLoading: hubsLoading } = useQuery<HubReadinessItem[]>({
    queryKey: ["/api/admin/crown/hubs", cityId],
    queryFn: async () => {
      const r = await fetch(`/api/admin/crown/hubs?cityId=${cityId}`);
      if (!r.ok) return [];
      return r.json();
    },
  });

  const { data: config, isLoading: configLoading } = useQuery<CrownConfig>({
    queryKey: ["/api/admin/crown/config", cityId],
    queryFn: async () => {
      const r = await fetch(`/api/admin/crown/config?cityId=${cityId}`);
      if (!r.ok) return null;
      return r.json();
    },
  });

  const scanMutation = useMutation({
    mutationFn: async (hubId: string) => {
      const r = await apiRequest("POST", `/api/admin/crown/hubs/${hubId}/scan`, { cityId });
      return r.json();
    },
    onSuccess: (data: ScanResult) => {
      setScanResult(data);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/crown/hubs", cityId] });
      toast({
        title: data.hub_ready ? "Hub is ready for Crown" : "Scan complete",
        description: `${data.summary.categories_ready} of ${data.summary.categories_scanned} categories ready, ${data.summary.total_qualified_businesses} qualified businesses`,
      });
    },
    onError: (e: Error) => toast({ title: "Scan failed", description: e.message, variant: "destructive" }),
  });

  const activateMutation = useMutation({
    mutationFn: async (hubId: string) => {
      const r = await apiRequest("POST", `/api/admin/crown/hubs/${hubId}/activate`, { cityId });
      return r.json();
    },
    onSuccess: (data: { message: string }) => {
      setShowActivateDialog(false);
      setActivatingHubId(null);
      setScanResult(null);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/crown/hubs", cityId] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/crown/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/crown/categories"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/crown/participants"] });
      toast({ title: "Crown Activated", description: data.message });
    },
    onError: (e: Error) => toast({ title: "Activation failed", description: e.message, variant: "destructive" }),
  });

  const statusMutation = useMutation({
    mutationFn: async ({ hubId, status }: { hubId: string; status: string }) => {
      const r = await apiRequest("PATCH", `/api/admin/crown/hubs/${hubId}/status`, { status, cityId });
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/crown/hubs", cityId] });
      toast({ title: "Status updated" });
    },
    onError: (e: Error) => toast({ title: "Status update failed", description: e.message, variant: "destructive" }),
  });

  const configMutation = useMutation({
    mutationFn: async (updates: Partial<CrownConfig>) => {
      const r = await apiRequest("PATCH", "/api/admin/crown/config", { cityId, ...updates });
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/crown/config", cityId] });
      toast({ title: "Configuration saved" });
    },
    onError: (e: Error) => toast({ title: "Save failed", description: e.message, variant: "destructive" }),
  });

  if (hubsLoading) {
    return <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-24" />)}</div>;
  }

  return (
    <div className="space-y-6" data-testid="crown-hub-readiness-tab">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2" data-testid="text-hub-readiness-title">
            <Radar className="h-5 w-5" /> Hub Crown Readiness
          </h2>
          <p className="text-sm text-muted-foreground">Scan hubs to evaluate Crown Program readiness and activate when conditions are met</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowConfig(!showConfig)} data-testid="button-toggle-config">
          <Settings className="h-4 w-4 mr-1" /> Config
        </Button>
      </div>

      {showConfig && config && (
        <ConfigPanel config={config} onSave={(updates) => configMutation.mutate(updates)} saving={configMutation.isPending} />
      )}

      {(!hubs || hubs.length === 0) ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <p data-testid="text-no-hubs">No hubs found for this city. Hubs need to be set up before Crown readiness can be evaluated.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {hubs.map((hub) => (
            <Card key={hub.hub_id} className={selectedHub === hub.hub_id ? "ring-2 ring-amber-400 dark:ring-amber-500" : ""} data-testid={`card-hub-${hub.hub_id}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-base truncate" data-testid={`text-hub-name-${hub.hub_id}`}>{hub.hub_name}</h3>
                      <Badge className={HUB_STATUS_STYLES[hub.crown_status] || HUB_STATUS_STYLES.INACTIVE} data-testid={`badge-status-${hub.hub_id}`}>
                        {HUB_STATUS_LABELS[hub.crown_status] || hub.crown_status}
                      </Badge>
                    </div>
                    {hub.activation && (
                      <div className="flex flex-wrap gap-3 text-sm text-muted-foreground mt-1">
                        <span data-testid={`text-categories-ready-${hub.hub_id}`}>{hub.activation.categoriesReady} / {hub.activation.categoriesScanned} categories ready</span>
                        <span data-testid={`text-qualified-biz-${hub.hub_id}`}>{hub.activation.totalQualifiedBusinesses} qualified businesses</span>
                        {hub.activation.lastScannedAt && (
                          <span>Last scanned: {new Date(hub.activation.lastScannedAt).toLocaleDateString()}</span>
                        )}
                      </div>
                    )}
                    {hub.activation?.readyCategoryNames && hub.activation.readyCategoryNames.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {hub.activation.readyCategoryNames.map((cat) => (
                          <Badge key={cat} variant="outline" className="text-xs" data-testid={`badge-cat-${hub.hub_id}`}>
                            <CircleCheck className="h-3 w-3 mr-1 text-green-600" />{cat}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {["INACTIVE", "SCANNING", "READY_FOR_ACTIVATION"].includes(hub.crown_status) && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => { setSelectedHub(hub.hub_id); setScanResult(null); scanMutation.mutate(hub.hub_id); }}
                        disabled={scanMutation.isPending}
                        data-testid={`button-scan-${hub.hub_id}`}
                      >
                        {scanMutation.isPending && selectedHub === hub.hub_id ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Scan className="h-4 w-4 mr-1" />}
                        Scan
                      </Button>
                    )}
                    {hub.crown_status === "READY_FOR_ACTIVATION" && (
                      <Button
                        size="sm"
                        onClick={() => { setActivatingHubId(hub.hub_id); setShowActivateDialog(true); }}
                        data-testid={`button-activate-${hub.hub_id}`}
                      >
                        <Play className="h-4 w-4 mr-1" /> Activate Crown
                      </Button>
                    )}
                    {hub.crown_status === "NOMINATIONS_OPEN" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => statusMutation.mutate({ hubId: hub.hub_id, status: "VOTING_OPEN" })}
                        disabled={statusMutation.isPending}
                        data-testid={`button-open-voting-${hub.hub_id}`}
                      >
                        <Vote className="h-4 w-4 mr-1" /> Open Voting
                      </Button>
                    )}
                    {hub.crown_status === "VOTING_OPEN" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => statusMutation.mutate({ hubId: hub.hub_id, status: "WINNERS_DECLARED" })}
                        disabled={statusMutation.isPending}
                        data-testid={`button-declare-winners-${hub.hub_id}`}
                      >
                        <Trophy className="h-4 w-4 mr-1" /> Declare Winners
                      </Button>
                    )}
                    {hub.crown_status === "WINNERS_DECLARED" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => statusMutation.mutate({ hubId: hub.hub_id, status: "ARCHIVED" })}
                        disabled={statusMutation.isPending}
                        data-testid={`button-archive-${hub.hub_id}`}
                      >
                        Archive
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {scanResult && (
        <ScanResultsPanel result={scanResult} />
      )}

      <Dialog open={showActivateDialog} onOpenChange={setShowActivateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Activate Crown Program</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground" data-testid="text-activate-description">
              This will launch the Crown Program for this hub, create categories, and register qualified businesses as candidates. The hub will move to Nominations Open.
            </p>
            {scanResult && (
              <div className="space-y-1 text-sm">
                <p><strong>Ready categories:</strong> {scanResult.summary.categories_ready}</p>
                <p><strong>Qualified businesses:</strong> {scanResult.summary.total_qualified_businesses}</p>
                <p><strong>Launch categories:</strong> {scanResult.summary.recommended_launch_categories.join(", ")}</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowActivateDialog(false)} data-testid="button-cancel-activate">Cancel</Button>
            <Button
              onClick={() => activatingHubId && activateMutation.mutate(activatingHubId)}
              disabled={activateMutation.isPending}
              data-testid="button-confirm-activate"
            >
              {activateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Crown className="h-4 w-4 mr-1" />}
              Activate Crown
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ConfigPanel({ config, onSave, saving }: { config: CrownConfig; onSave: (u: Partial<CrownConfig>) => void; saving: boolean }) {
  const [minCats, setMinCats] = useState(String(config.minCategoriesForLaunch));
  const [minBiz, setMinBiz] = useState(String(config.minQualifiedBusinesses));
  const [defaultMin, setDefaultMin] = useState(String(config.defaultCategoryMinimum));
  const [radius, setRadius] = useState(String(config.scanRadiusMiles));

  return (
    <Card data-testid="config-panel">
      <CardHeader>
        <CardTitle className="text-sm font-medium">Crown Configuration</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Min Categories for Launch</label>
            <Input type="number" value={minCats} onChange={e => setMinCats(e.target.value)} data-testid="input-min-categories" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Min Qualified Businesses</label>
            <Input type="number" value={minBiz} onChange={e => setMinBiz(e.target.value)} data-testid="input-min-businesses" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Default Category Minimum</label>
            <Input type="number" value={defaultMin} onChange={e => setDefaultMin(e.target.value)} data-testid="input-default-minimum" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Scan Radius (miles)</label>
            <Input type="number" value={radius} onChange={e => setRadius(e.target.value)} data-testid="input-scan-radius" />
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <Button
            size="sm"
            onClick={() => onSave({
              minCategoriesForLaunch: parseInt(minCats),
              minQualifiedBusinesses: parseInt(minBiz),
              defaultCategoryMinimum: parseInt(defaultMin),
              scanRadiusMiles: parseInt(radius),
            })}
            disabled={saving}
            data-testid="button-save-config"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
            Save Configuration
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ScanResultsPanel({ result }: { result: ScanResult }) {
  const { summary, category_results } = result;

  return (
    <div className="space-y-4" data-testid="scan-results-panel">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <BarChart3 className="h-4 w-4" /> Scan Results: {summary.hub_name}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <p className="text-2xl font-bold" data-testid="text-scan-total-biz">{summary.total_businesses_detected}</p>
              <p className="text-xs text-muted-foreground">Businesses Found</p>
            </div>
            <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <p className="text-2xl font-bold" data-testid="text-scan-qualified">{summary.total_qualified_businesses}</p>
              <p className="text-xs text-muted-foreground">Qualified</p>
            </div>
            <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <p className="text-2xl font-bold text-green-600" data-testid="text-scan-cats-ready">{summary.categories_ready}</p>
              <p className="text-xs text-muted-foreground">Categories Ready</p>
            </div>
            <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <p className="text-2xl font-bold text-gray-400" data-testid="text-scan-cats-not-ready">{summary.categories_not_ready}</p>
              <p className="text-xs text-muted-foreground">Not Ready</p>
            </div>
          </div>

          {result.hub_ready && (
            <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/30 rounded-lg mb-4" data-testid="text-hub-ready-banner">
              <CircleCheck className="h-5 w-5 text-green-600" />
              <span className="font-medium text-green-700 dark:text-green-400">This hub meets all conditions for Crown activation</span>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-3">
        {category_results.map((cat) => (
          <Card key={cat.category_slug} data-testid={`card-category-${cat.category_slug}`}>
            <CardContent className="p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <h4 className="font-medium text-sm">{cat.category_name}</h4>
                  <Badge className={cat.category_status === "READY"
                    ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                    : "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
                  }>
                    {cat.category_status}
                  </Badge>
                </div>
                <span className="text-sm text-muted-foreground">{cat.total_qualified} qualified / {cat.total_businesses_found} found</span>
              </div>
              {cat.candidates.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {cat.candidates.slice(0, 8).map((c, i) => (
                    <Badge key={i} variant="outline" className="text-xs">
                      {c.business_name} ({c.crown_candidate_score})
                    </Badge>
                  ))}
                  {cat.candidates.length > 8 && (
                    <Badge variant="outline" className="text-xs text-muted-foreground">+{cat.candidates.length - 8} more</Badge>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

const INVITATION_STATUS_COLORS: Record<string, string> = {
  NOT_SENT: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  SENT: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  VIEWED: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900 dark:text-cyan-300",
  CLAIM_STARTED: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  CLAIM_COMPLETED: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  DECLINED: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  EXPIRED: "bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-400",
};

const TIER_COLORS: Record<string, string> = {
  anchor: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
  strong: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  emerging: "bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300",
};

function OutreachTab({ cityId }: { cityId: string }) {
  const { toast } = useToast();
  const [filterStatus, setFilterStatus] = useState("");
  const [filterTier, setFilterTier] = useState("");
  const [filterHub, setFilterHub] = useState("");

  const buildUrl = () => {
    let url = `/api/admin/crown/outreach/candidates?cityId=${cityId}`;
    if (filterStatus && filterStatus !== "all") url += `&status=${filterStatus}`;
    if (filterTier && filterTier !== "all") url += `&tier=${filterTier}`;
    if (filterHub && filterHub !== "all") url += `&hubId=${filterHub}`;
    return url;
  };

  const { data: candidates, isLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/crown/outreach/candidates", cityId, filterStatus, filterTier, filterHub],
    queryFn: async () => {
      const r = await fetch(buildUrl());
      if (!r.ok) return [];
      return r.json();
    },
  });

  const { data: metrics } = useQuery<any>({
    queryKey: ["/api/admin/crown/outreach/conversion-metrics", cityId, filterHub],
    queryFn: async () => {
      let url = `/api/admin/crown/outreach/conversion-metrics?cityId=${cityId}`;
      if (filterHub && filterHub !== "all") url += `&hubId=${filterHub}`;
      const r = await fetch(url);
      if (!r.ok) return null;
      return r.json();
    },
  });

  const { data: hubs } = useQuery<any[]>({
    queryKey: ["/api/admin/crown/hubs-list", cityId],
    queryFn: async () => {
      const r = await fetch(`/api/admin/regions?cityId=${cityId}&type=hub`);
      if (!r.ok) return [];
      return r.json();
    },
  });

  const sendInvitationMutation = useMutation({
    mutationFn: async (participantId: string) => {
      const r = await apiRequest("POST", "/api/admin/crown/outreach/send-invitation", { participantId, channel: "email" });
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/crown/outreach/candidates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/crown/outreach/conversion-metrics"] });
      toast({ title: "Invitation sent" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const markContactedMutation = useMutation({
    mutationFn: async (participantId: string) => {
      return apiRequest("POST", "/api/admin/crown/outreach/mark-contacted", { participantId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/crown/outreach/candidates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/crown/outreach/conversion-metrics"] });
      toast({ title: "Marked as contacted" });
    },
  });

  const markDeclinedMutation = useMutation({
    mutationFn: async (participantId: string) => {
      return apiRequest("POST", "/api/admin/crown/outreach/mark-declined", { participantId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/crown/outreach/candidates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/crown/outreach/conversion-metrics"] });
      toast({ title: "Marked as declined" });
    },
  });

  const batchSendMutation = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("POST", "/api/admin/crown/outreach/batch-send", {
        cityId,
        ...(filterHub && filterHub !== "all" ? { hubId: filterHub } : {}),
        ...(filterTier && filterTier !== "all" ? { tier: filterTier } : {}),
        channel: "email",
        limit: 25,
      });
      return r.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/crown/outreach/candidates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/crown/outreach/conversion-metrics"] });
      toast({ title: "Batch send complete", description: `${data.sent} invitations sent` });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const followUpMutation = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("POST", "/api/admin/crown/outreach/process-follow-ups", {});
      return r.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/crown/outreach/candidates"] });
      toast({ title: "Follow-ups processed", description: `${data.processed} reminders sent` });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-6 mt-4" data-testid="outreach-tab">
      {metrics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3" data-testid="outreach-metrics">
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center gap-1.5 text-muted-foreground text-xs mb-1">
                <Target className="h-3.5 w-3.5" /> Candidates
              </div>
              <p className="text-xl font-bold" data-testid="metric-candidates">{metrics.totalCandidates}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center gap-1.5 text-muted-foreground text-xs mb-1">
                <Send className="h-3.5 w-3.5" /> Invitations Sent
              </div>
              <p className="text-xl font-bold" data-testid="metric-sent">{metrics.invitationsSent}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center gap-1.5 text-muted-foreground text-xs mb-1">
                <Eye className="h-3.5 w-3.5" /> Viewed
              </div>
              <p className="text-xl font-bold" data-testid="metric-viewed">{metrics.invitationsViewed}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center gap-1.5 text-muted-foreground text-xs mb-1">
                <Check className="h-3.5 w-3.5" /> Claims Completed
              </div>
              <p className="text-xl font-bold" data-testid="metric-completed">{metrics.claimsCompleted}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center gap-1.5 text-muted-foreground text-xs mb-1">
                <Users className="h-3.5 w-3.5" /> Participants Active
              </div>
              <p className="text-xl font-bold" data-testid="metric-activated">{metrics.participantsActivated}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center gap-1.5 text-muted-foreground text-xs mb-1">
                <Award className="h-3.5 w-3.5" /> Nominees
              </div>
              <p className="text-xl font-bold" data-testid="metric-nominees">{metrics.nomineesCreated}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center gap-1.5 text-muted-foreground text-xs mb-1">
                <TrendingUp className="h-3.5 w-3.5" /> Claims Started
              </div>
              <p className="text-xl font-bold" data-testid="metric-started">{metrics.claimsStarted}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center gap-1.5 text-muted-foreground text-xs mb-1">
                <Clock className="h-3.5 w-3.5" /> Pending Outreach
              </div>
              <p className="text-xl font-bold" data-testid="metric-pending">{metrics.pendingOutreach}</p>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex gap-2 flex-wrap">
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[150px]" data-testid="select-outreach-status">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="candidate">Candidate</SelectItem>
              <SelectItem value="invited">Invited</SelectItem>
              <SelectItem value="verified_participant">Verified</SelectItem>
              <SelectItem value="nominee">Nominee</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterTier} onValueChange={setFilterTier}>
            <SelectTrigger className="w-[140px]" data-testid="select-outreach-tier">
              <SelectValue placeholder="All tiers" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All tiers</SelectItem>
              <SelectItem value="anchor">Anchor</SelectItem>
              <SelectItem value="strong">Strong</SelectItem>
              <SelectItem value="emerging">Emerging</SelectItem>
            </SelectContent>
          </Select>
          {hubs && hubs.length > 0 && (
            <Select value={filterHub} onValueChange={setFilterHub}>
              <SelectTrigger className="w-[160px]" data-testid="select-outreach-hub">
                <SelectValue placeholder="All hubs" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All hubs</SelectItem>
                {hubs.map((h: any) => (
                  <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => followUpMutation.mutate()}
            disabled={followUpMutation.isPending}
            data-testid="button-process-follow-ups"
          >
            {followUpMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />}
            Process Follow-ups
          </Button>
          <Button
            size="sm"
            onClick={() => batchSendMutation.mutate()}
            disabled={batchSendMutation.isPending}
            data-testid="button-batch-send"
          >
            {batchSendMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Send className="h-4 w-4 mr-1" />}
            Batch Send
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-20" />)}
        </div>
      ) : !candidates || candidates.length === 0 ? (
        <Card className="p-8 text-center">
          <Megaphone className="mx-auto h-10 w-10 text-muted-foreground/40 mb-3" />
          <h3 className="font-semibold mb-1">No outreach candidates</h3>
          <p className="text-sm text-muted-foreground">Import candidates from the discovery engine or add participants first</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {candidates.map((c: any) => (
            <Card key={c.id} data-testid={`card-outreach-${c.id}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h4 className="font-medium text-sm truncate" data-testid={`text-outreach-name-${c.id}`}>{c.name}</h4>
                      <Badge className={STATUS_COLORS[c.status] || "bg-gray-100 text-gray-700"} data-testid={`badge-outreach-status-${c.id}`}>
                        {STATUS_LABELS[c.status] || c.status}
                      </Badge>
                      {c.inviteTier && (
                        <Badge className={TIER_COLORS[c.inviteTier] || ""} data-testid={`badge-tier-${c.id}`}>
                          {c.inviteTier}
                        </Badge>
                      )}
                      {c.invitation && (
                        <Badge className={INVITATION_STATUS_COLORS[c.invitation.invitationStatus] || ""} data-testid={`badge-inv-status-${c.id}`}>
                          {c.invitation.invitationStatus?.replace(/_/g, " ")}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1 flex-wrap">
                      <span data-testid={`text-category-${c.id}`}>{c.categoryName}</span>
                      {c.crownCandidateScore != null && (
                        <span data-testid={`text-score-${c.id}`}>Score: {c.crownCandidateScore}</span>
                      )}
                      {c.email && (
                        <span className="flex items-center gap-1" data-testid={`text-email-${c.id}`}>
                          <Mail className="h-3 w-3" /> {c.email}
                        </span>
                      )}
                      {c.phone && (
                        <span className="flex items-center gap-1" data-testid={`text-phone-${c.id}`}>
                          <Phone className="h-3 w-3" /> {c.phone}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {c.readyForVenueTv && <Badge variant="outline" className="text-[10px]" data-testid={`badge-venue-tv-${c.id}`}>Venue TV</Badge>}
                      {c.readyForCreatorFeature && <Badge variant="outline" className="text-[10px]" data-testid={`badge-creator-${c.id}`}>Creator Feature</Badge>}
                      {c.readyForCrownStory && <Badge variant="outline" className="text-[10px]" data-testid={`badge-story-${c.id}`}>Crown Story</Badge>}
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {c.status === "candidate" && (
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => sendInvitationMutation.mutate(c.id)}
                        disabled={sendInvitationMutation.isPending}
                        data-testid={`button-send-invitation-${c.id}`}
                      >
                        <Send className="h-3.5 w-3.5 mr-1" /> Send
                      </Button>
                    )}
                    {c.status === "invited" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => sendInvitationMutation.mutate(c.id)}
                        disabled={sendInvitationMutation.isPending}
                        data-testid={`button-resend-invitation-${c.id}`}
                      >
                        <RefreshCw className="h-3.5 w-3.5 mr-1" /> Resend
                      </Button>
                    )}
                    {(c.status === "candidate" || c.status === "invited") && (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => markContactedMutation.mutate(c.id)}
                          disabled={markContactedMutation.isPending}
                          data-testid={`button-mark-contacted-${c.id}`}
                          title="Mark as Contacted"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => markDeclinedMutation.mutate(c.id)}
                          disabled={markDeclinedMutation.isPending}
                          data-testid={`button-mark-declined-${c.id}`}
                          title="Mark as Declined"
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

const CAMPAIGN_STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  READY: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  LAUNCHED: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  NOMINATIONS_OPEN: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  VOTING_OPEN: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
  WINNERS_ANNOUNCED: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
  ARCHIVED: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
};

const CAMPAIGN_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ["READY"],
  READY: ["LAUNCHED", "DRAFT"],
  LAUNCHED: ["NOMINATIONS_OPEN", "ARCHIVED"],
  NOMINATIONS_OPEN: ["VOTING_OPEN", "ARCHIVED"],
  VOTING_OPEN: ["WINNERS_ANNOUNCED", "ARCHIVED"],
  WINNERS_ANNOUNCED: ["ARCHIVED"],
  ARCHIVED: [],
};

function CampaignsTab({ cityId }: { cityId: string }) {
  const { toast } = useToast();
  const [showCreate, setShowCreate] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<string | null>(null);
  const [showGenerate, setShowGenerate] = useState(false);
  const [generateStage, setGenerateStage] = useState("launch");
  const [showContent, setShowContent] = useState<Record<string, unknown> | null>(null);
  const [showClaimVars, setShowClaimVars] = useState(false);
  const [claimVars, setClaimVars] = useState({ business_name: "", category_name: "", claim_link: "", voting_link: "", deadline: "14 days" });
  const [showEdit, setShowEdit] = useState(false);
  const [editCampaign, setEditCampaign] = useState<Record<string, unknown> | null>(null);
  const [editFields, setEditFields] = useState<Record<string, string>>({});
  const [showConfig, setShowConfig] = useState(false);
  const [expandedDistribution, setExpandedDistribution] = useState<string | null>(null);
  const [distStageMap, setDistStageMap] = useState<Record<string, string>>({});

  const [newHeadline, setNewHeadline] = useState("");
  const [newSubheadline, setNewSubheadline] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newRules, setNewRules] = useState("");
  const [newHubId, setNewHubId] = useState("");

  const { data: campaigns = [], isLoading } = useQuery<Array<Record<string, unknown>>>({
    queryKey: ["/api/admin/crown/campaigns", cityId],
    queryFn: async () => {
      const r = await fetch(`/api/admin/crown/campaigns?cityId=${cityId}`);
      if (!r.ok) return [];
      return r.json();
    },
  });

  const { data: hubs = [] } = useQuery<Array<{ id: string; name: string }>>({
    queryKey: ["/api/admin/crown/hub-activations", cityId, "for-campaigns"],
    queryFn: async () => {
      const r = await fetch(`/api/regions?cityId=${cityId}&type=hub`);
      if (!r.ok) return [];
      return r.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("POST", "/api/admin/crown/campaigns", {
        cityId, hubId: newHubId === "none" ? undefined : (newHubId || undefined), headline: newHeadline || undefined,
        subheadline: newSubheadline || undefined, description: newDescription || undefined,
        rules: newRules || undefined, seasonYear: 2026,
      });
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/crown/campaigns"] });
      toast({ title: "Campaign created" });
      setShowCreate(false);
      setNewHeadline(""); setNewSubheadline(""); setNewDescription(""); setNewRules(""); setNewHubId("");
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const transitionMutation = useMutation({
    mutationFn: async ({ id, targetStatus }: { id: string; targetStatus: string }) => {
      const r = await apiRequest("POST", `/api/admin/crown/campaigns/${id}/transition`, { targetStatus });
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/crown/campaigns"] });
      toast({ title: "Campaign status updated" });
    },
    onError: (e: Error) => toast({ title: "Transition failed", description: e.message, variant: "destructive" }),
  });

  const generateMutation = useMutation({
    mutationFn: async ({ id, stage }: { id: string; stage: string }) => {
      const r = await apiRequest("POST", `/api/admin/crown/campaigns/${id}/generate`, { stage });
      return r.json();
    },
    onSuccess: (data: Record<string, unknown>) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/crown/campaigns"] });
      setShowContent(data.content as Record<string, unknown>);
      toast({ title: "Content generated" });
    },
    onError: (e: Error) => toast({ title: "Generation failed", description: e.message, variant: "destructive" }),
  });

  const claimMessagingMutation = useMutation({
    mutationFn: async (id: string) => {
      const r = await apiRequest("POST", `/api/admin/crown/campaigns/${id}/claim-messaging`, { variables: claimVars });
      return r.json();
    },
    onSuccess: (data: Record<string, unknown>) => {
      setShowContent(data);
      setShowClaimVars(false);
      toast({ title: "Claim messaging generated" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const editMutation = useMutation({
    mutationFn: async ({ id, fields }: { id: string; fields: Record<string, string> }) => {
      const body: Record<string, unknown> = {};
      if (fields.headline !== undefined) body.headline = fields.headline;
      if (fields.subheadline !== undefined) body.subheadline = fields.subheadline;
      if (fields.description !== undefined) body.description = fields.description;
      if (fields.rules !== undefined) body.rules = fields.rules;
      if (fields.nominationsOpenAt) body.nominationsOpenAt = fields.nominationsOpenAt;
      if (fields.votingOpenAt) body.votingOpenAt = fields.votingOpenAt;
      if (fields.votingCloseAt) body.votingCloseAt = fields.votingCloseAt;
      if (fields.winnersAnnounceAt) body.winnersAnnounceAt = fields.winnersAnnounceAt;
      const r = await apiRequest("PATCH", `/api/admin/crown/campaigns/${id}`, body);
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/crown/campaigns"] });
      toast({ title: "Campaign updated" });
      setShowEdit(false);
      setEditCampaign(null);
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const { data: config } = useQuery<Record<string, unknown>>({
    queryKey: ["/api/admin/crown/campaign-config", cityId],
    queryFn: async () => {
      const r = await fetch(`/api/admin/crown/campaign-config?cityId=${cityId}`);
      if (!r.ok) return {};
      return r.json();
    },
  });

  const [configTone, setConfigTone] = useState("");
  const [configNaming, setConfigNaming] = useState("");
  const [configYearFormat, setConfigYearFormat] = useState("full");
  const [configEditorial, setConfigEditorial] = useState(true);
  const [configPeoplesChoice, setConfigPeoplesChoice] = useState(true);
  const [configCreatorCoverage, setConfigCreatorCoverage] = useState(true);
  const [configVenueTv, setConfigVenueTv] = useState(true);
  const [configPrint, setConfigPrint] = useState(false);

  useEffect(() => {
    if (config) {
      setConfigTone((config.tone as string) || "community_celebration");
      setConfigNaming((config.award_naming_format as string) || "Crown Award");
      setConfigYearFormat((config.year_format as string) || "full");
      setConfigEditorial(config.include_editorial !== false);
      setConfigPeoplesChoice(config.include_peoples_choice !== false);
      setConfigCreatorCoverage(config.enable_creator_coverage !== false);
      setConfigVenueTv(config.enable_venue_tv !== false);
      setConfigPrint(config.enable_print === true);
    }
  }, [config]);

  const configMutation = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("PUT", "/api/admin/crown/campaign-config", {
        cityId, seasonYear: 2026, tone: configTone, awardNamingFormat: configNaming,
        yearFormat: configYearFormat, includeEditorial: configEditorial,
        includePeoplesChoice: configPeoplesChoice, enableCreatorCoverage: configCreatorCoverage,
        enableVenueTv: configVenueTv, enablePrint: configPrint,
      });
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/crown/campaign-config"] });
      toast({ title: "Configuration saved" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const distributePulseMutation = useMutation({
    mutationFn: async ({ id, stage }: { id: string; stage: string }) => {
      const r = await apiRequest("POST", `/api/admin/crown/campaigns/${id}/distribute/pulse`, { stage });
      return r.json();
    },
    onSuccess: (data: Record<string, unknown>, variables: { id: string; stage: string }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/crown/campaigns"] });
      queryClient.invalidateQueries({ queryKey: [`/api/admin/crown/campaigns/${variables.id}/distribution-status`] });
      if (data.duplicate) {
        toast({ title: "Pulse draft already exists", description: `Draft for this stage already created (Post ID: ${data.postId})` });
      } else {
        toast({ title: "Pulse draft created", description: `Post ID: ${data.postId}` });
      }
    },
    onError: (e: Error) => toast({ title: "Pulse distribution failed", description: e.message, variant: "destructive" }),
  });

  const distributeTvMutation = useMutation({
    mutationFn: async ({ id, stage, targetHubSlug }: { id: string; stage: string; targetHubSlug?: string }) => {
      const payload: Record<string, string> = { stage };
      if (targetHubSlug) payload.targetHubSlug = targetHubSlug;
      const r = await apiRequest("POST", `/api/admin/crown/campaigns/${id}/distribute/tv`, payload);
      return r.json();
    },
    onSuccess: (data: Record<string, unknown>, variables: { id: string; stage: string }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/crown/campaigns"] });
      queryClient.invalidateQueries({ queryKey: [`/api/admin/crown/campaigns/${variables.id}/distribution-status`] });
      if (data.duplicate) {
        toast({ title: "TV slide already exists", description: `Slide for this stage already pushed` });
      } else {
        toast({ title: "TV slide pushed", description: `Template: ${data.templateKey}` });
      }
    },
    onError: (e: Error) => toast({ title: "TV distribution failed", description: e.message, variant: "destructive" }),
  });

  const distributeCreatorMutation = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: string }) => {
      const r = await apiRequest("POST", `/api/admin/crown/campaigns/${id}/distribute/creator`, { action });
      return r.json();
    },
    onSuccess: (data: Record<string, unknown>, variables: { id: string; action: string }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/crown/campaigns"] });
      queryClient.invalidateQueries({ queryKey: [`/api/admin/crown/campaigns/${variables.id}/distribution-status`] });
      const msg = data.sourceRequestId ? `Source request created` : `Flag set: ${data.flagSet}`;
      toast({ title: "Creator coverage updated", description: msg });
    },
    onError: (e: Error) => toast({ title: "Creator action failed", description: e.message, variant: "destructive" }),
  });

  if (isLoading) return <Skeleton className="h-40" />;

  return (
    <div className="space-y-4 mt-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{campaigns.length} campaigns</p>
        <Button size="sm" onClick={() => setShowCreate(true)} data-testid="button-create-campaign">
          <Plus className="h-4 w-4 mr-1" /> New Campaign
        </Button>
      </div>

      <div className="space-y-3">
        {campaigns.map((c) => {
          const status = c.status as string;
          const transitions = CAMPAIGN_TRANSITIONS[status] || [];
          const generatedContent = (c.generated_content || {}) as Record<string, unknown>;
          return (
            <Card key={c.id as string} data-testid={`card-campaign-${c.id}`}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Megaphone className="h-5 w-5 text-amber-500" />
                    <div>
                      <p className="font-medium text-sm">{(c.headline as string) || "Untitled Campaign"}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge className={CAMPAIGN_STATUS_COLORS[status] || ""}>{status.replace(/_/g, " ")}</Badge>
                        {c.hub_name && <span className="text-xs text-muted-foreground">{c.hub_name as string}</span>}
                        <span className="text-xs text-muted-foreground">Season {c.season_year as number}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {status === "DRAFT" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditCampaign(c);
                          setEditFields({
                            headline: (c.headline as string) || "",
                            subheadline: (c.subheadline as string) || "",
                            description: (c.description as string) || "",
                            rules: (c.rules as string) || "",
                            nominationsOpenAt: (c.nominations_open_at as string)?.split("T")[0] || "",
                            votingOpenAt: (c.voting_open_at as string)?.split("T")[0] || "",
                            votingCloseAt: (c.voting_close_at as string)?.split("T")[0] || "",
                            winnersAnnounceAt: (c.winners_announce_at as string)?.split("T")[0] || "",
                          });
                          setShowEdit(true);
                        }}
                        data-testid={`button-edit-campaign-${c.id}`}
                      >
                        <Settings className="h-3.5 w-3.5 mr-1" /> Edit
                      </Button>
                    )}
                    {transitions.map((t) => (
                      <Button
                        key={t}
                        size="sm"
                        variant="outline"
                        onClick={() => transitionMutation.mutate({ id: c.id as string, targetStatus: t })}
                        disabled={transitionMutation.isPending}
                        data-testid={`button-transition-${c.id}-${t}`}
                      >
                        <ArrowRight className="h-3.5 w-3.5 mr-1" />
                        {t.replace(/_/g, " ")}
                      </Button>
                    ))}
                  </div>
                </div>

                {c.description && <p className="text-xs text-muted-foreground">{c.description as string}</p>}

                <div className="flex items-center gap-2 flex-wrap">
                  {["launch", "nominations", "finalists", "voting", "winners"].map((stage) => (
                    <Button
                      key={stage}
                      size="sm"
                      variant={generatedContent[stage] ? "default" : "outline"}
                      onClick={() => {
                        setSelectedCampaign(c.id as string);
                        if (generatedContent[stage]) {
                          setShowContent(generatedContent[stage] as Record<string, unknown>);
                        } else {
                          setGenerateStage(stage);
                          setShowGenerate(true);
                        }
                      }}
                      data-testid={`button-gen-${stage}-${c.id}`}
                    >
                      <Zap className="h-3.5 w-3.5 mr-1" />
                      {stage.charAt(0).toUpperCase() + stage.slice(1)}
                      {generatedContent[stage] ? " (View)" : " (Generate)"}
                    </Button>
                  ))}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => { setSelectedCampaign(c.id as string); setShowClaimVars(true); }}
                    data-testid={`button-claim-msg-${c.id}`}
                  >
                    <FileText className="h-3.5 w-3.5 mr-1" /> Claim Messaging
                  </Button>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-muted-foreground">
                  {c.nominations_open_at && <span>Nominations: {new Date(c.nominations_open_at as string).toLocaleDateString()}</span>}
                  {c.voting_open_at && <span>Voting: {new Date(c.voting_open_at as string).toLocaleDateString()}</span>}
                  {c.voting_close_at && <span>Voting closes: {new Date(c.voting_close_at as string).toLocaleDateString()}</span>}
                  {c.winners_announce_at && <span>Winners: {new Date(c.winners_announce_at as string).toLocaleDateString()}</span>}
                </div>

                <div className="border-t pt-3 mt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setExpandedDistribution(expandedDistribution === (c.id as string) ? null : (c.id as string))}
                    data-testid={`button-toggle-dist-${c.id}`}
                  >
                    <Send className="h-3.5 w-3.5 mr-1" /> Distribution {expandedDistribution === (c.id as string) ? "(Hide)" : "(Show)"}
                  </Button>

                  {expandedDistribution === (c.id as string) && (
                    <CampaignDistribution
                      campaignId={c.id as string}
                      cityId={c.city_id as string}
                      distStage={distStageMap[c.id as string] || "launch"}
                      setDistStage={(s) => setDistStageMap((prev) => ({ ...prev, [c.id as string]: s }))}
                      onPulse={(stage) => distributePulseMutation.mutate({ id: c.id as string, stage })}
                      onTv={(stage, targetHubSlug) => distributeTvMutation.mutate({ id: c.id as string, stage, targetHubSlug })}
                      onCreator={(action) => distributeCreatorMutation.mutate({ id: c.id as string, action })}
                      isPulsePending={distributePulseMutation.isPending}
                      isTvPending={distributeTvMutation.isPending}
                      isCreatorPending={distributeCreatorMutation.isPending}
                    />
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create Campaign</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Select value={newHubId} onValueChange={setNewHubId}>
              <SelectTrigger data-testid="select-campaign-hub"><SelectValue placeholder="Select hub (optional)" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none" data-testid="select-item-hub-none">No hub (metro-wide)</SelectItem>
                {hubs.map((h) => <SelectItem key={h.id} value={h.id} data-testid={`select-item-hub-${h.id}`}>{h.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input placeholder="Campaign headline" value={newHeadline} onChange={(e) => setNewHeadline(e.target.value)} data-testid="input-campaign-headline" />
            <Input placeholder="Subheadline" value={newSubheadline} onChange={(e) => setNewSubheadline(e.target.value)} data-testid="input-campaign-subheadline" />
            <Textarea placeholder="Description" value={newDescription} onChange={(e) => setNewDescription(e.target.value)} data-testid="input-campaign-description" />
            <Textarea placeholder="Rules" value={newRules} onChange={(e) => setNewRules(e.target.value)} data-testid="input-campaign-rules" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)} data-testid="button-cancel-campaign">Cancel</Button>
            <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending} data-testid="button-save-campaign">
              {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showGenerate} onOpenChange={setShowGenerate}>
        <DialogContent>
          <DialogHeader><DialogTitle>Generate {generateStage} Content</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will generate structured announcement content for the {generateStage} stage. The content will be stored on the campaign and logged in the Message Center.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowGenerate(false)} data-testid="button-cancel-generate">Cancel</Button>
            <Button
              onClick={() => { if (selectedCampaign) { generateMutation.mutate({ id: selectedCampaign, stage: generateStage }); setShowGenerate(false); } }}
              disabled={generateMutation.isPending}
              data-testid="button-confirm-generate"
            >
              {generateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Generate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showClaimVars} onOpenChange={setShowClaimVars}>
        <DialogContent>
          <DialogHeader><DialogTitle>Generate Claim Messaging</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Business name" value={claimVars.business_name} onChange={(e) => setClaimVars({ ...claimVars, business_name: e.target.value })} data-testid="input-claim-business" />
            <Input placeholder="Category name" value={claimVars.category_name} onChange={(e) => setClaimVars({ ...claimVars, category_name: e.target.value })} data-testid="input-claim-category" />
            <Input placeholder="Claim link" value={claimVars.claim_link} onChange={(e) => setClaimVars({ ...claimVars, claim_link: e.target.value })} data-testid="input-claim-link" />
            <Input placeholder="Voting link" value={claimVars.voting_link} onChange={(e) => setClaimVars({ ...claimVars, voting_link: e.target.value })} data-testid="input-claim-voting-link" />
            <Input placeholder="Deadline" value={claimVars.deadline} onChange={(e) => setClaimVars({ ...claimVars, deadline: e.target.value })} data-testid="input-claim-deadline" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowClaimVars(false)} data-testid="button-cancel-claim-msg">Cancel</Button>
            <Button
              onClick={() => { if (selectedCampaign) claimMessagingMutation.mutate(selectedCampaign); }}
              disabled={claimMessagingMutation.isPending}
              data-testid="button-confirm-claim-msg"
            >
              {claimMessagingMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Generate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!showContent} onOpenChange={() => setShowContent(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Generated Content</DialogTitle></DialogHeader>
          <pre className="text-xs bg-muted p-4 rounded-lg overflow-x-auto whitespace-pre-wrap" data-testid="text-generated-content">
            {JSON.stringify(showContent, null, 2)}
          </pre>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { navigator.clipboard.writeText(JSON.stringify(showContent, null, 2)); toast({ title: "Copied to clipboard" }); }}
              data-testid="button-copy-content"
            >
              <Copy className="h-4 w-4 mr-1" /> Copy JSON
            </Button>
            <Button onClick={() => setShowContent(null)} data-testid="button-close-content">Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showEdit} onOpenChange={setShowEdit}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Edit Campaign</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Headline" value={editFields.headline || ""} onChange={(e) => setEditFields({ ...editFields, headline: e.target.value })} data-testid="input-edit-headline" />
            <Input placeholder="Subheadline" value={editFields.subheadline || ""} onChange={(e) => setEditFields({ ...editFields, subheadline: e.target.value })} data-testid="input-edit-subheadline" />
            <Textarea placeholder="Description" value={editFields.description || ""} onChange={(e) => setEditFields({ ...editFields, description: e.target.value })} data-testid="input-edit-description" />
            <Textarea placeholder="Rules" value={editFields.rules || ""} onChange={(e) => setEditFields({ ...editFields, rules: e.target.value })} data-testid="input-edit-rules" />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">Nominations Open</label>
                <Input type="date" value={editFields.nominationsOpenAt || ""} onChange={(e) => setEditFields({ ...editFields, nominationsOpenAt: e.target.value })} data-testid="input-edit-nominations-open" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Voting Open</label>
                <Input type="date" value={editFields.votingOpenAt || ""} onChange={(e) => setEditFields({ ...editFields, votingOpenAt: e.target.value })} data-testid="input-edit-voting-open" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Voting Close</label>
                <Input type="date" value={editFields.votingCloseAt || ""} onChange={(e) => setEditFields({ ...editFields, votingCloseAt: e.target.value })} data-testid="input-edit-voting-close" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Winners Announce</label>
                <Input type="date" value={editFields.winnersAnnounceAt || ""} onChange={(e) => setEditFields({ ...editFields, winnersAnnounceAt: e.target.value })} data-testid="input-edit-winners-announce" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEdit(false)} data-testid="button-cancel-edit-campaign">Cancel</Button>
            <Button
              onClick={() => { if (editCampaign) editMutation.mutate({ id: editCampaign.id as string, fields: editFields }); }}
              disabled={editMutation.isPending}
              data-testid="button-save-edit-campaign"
            >
              {editMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card className="mt-4">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="font-medium text-sm">Campaign Configuration</p>
            <Button
              size="sm"
              onClick={() => setShowConfig(!showConfig)}
              variant="outline"
              data-testid="button-toggle-config"
            >
              <Settings className="h-3.5 w-3.5 mr-1" /> {showConfig ? "Hide" : "Show"} Settings
            </Button>
          </div>
          {showConfig && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">Tone</label>
                  <Select value={configTone} onValueChange={setConfigTone}>
                    <SelectTrigger data-testid="select-config-tone"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="community_celebration" data-testid="select-item-tone-celebration">Community Celebration</SelectItem>
                      <SelectItem value="professional_excellence" data-testid="select-item-tone-professional">Professional Excellence</SelectItem>
                      <SelectItem value="local_pride" data-testid="select-item-tone-pride">Local Pride</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Award Naming</label>
                  <Input value={configNaming} onChange={(e) => setConfigNaming(e.target.value)} data-testid="input-config-naming" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Year Format</label>
                  <Select value={configYearFormat} onValueChange={setConfigYearFormat}>
                    <SelectTrigger data-testid="select-config-year-format"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="full" data-testid="select-year-format-full">Full (2026)</SelectItem>
                      <SelectItem value="short" data-testid="select-year-format-short">Short ('26)</SelectItem>
                      <SelectItem value="none" data-testid="select-year-format-none">No Year</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={configEditorial} onChange={(e) => setConfigEditorial(e.target.checked)} data-testid="checkbox-config-editorial" />
                  Editorial Awards
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={configPeoplesChoice} onChange={(e) => setConfigPeoplesChoice(e.target.checked)} data-testid="checkbox-config-peoples-choice" />
                  People's Choice
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={configCreatorCoverage} onChange={(e) => setConfigCreatorCoverage(e.target.checked)} data-testid="checkbox-config-creator" />
                  Creator Coverage
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={configVenueTv} onChange={(e) => setConfigVenueTv(e.target.checked)} data-testid="checkbox-config-venue-tv" />
                  Venue TV
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={configPrint} onChange={(e) => setConfigPrint(e.target.checked)} data-testid="checkbox-config-print" />
                  Print
                </label>
              </div>
              <Button size="sm" onClick={() => configMutation.mutate()} disabled={configMutation.isPending} data-testid="button-save-config">
                {configMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Configuration"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function CampaignDistribution({
  campaignId, cityId, distStage, setDistStage,
  onPulse, onTv, onCreator,
  isPulsePending, isTvPending, isCreatorPending,
}: {
  campaignId: string;
  cityId: string;
  distStage: string;
  setDistStage: (s: string) => void;
  onPulse: (stage: string) => void;
  onTv: (stage: string, targetHubSlug?: string) => void;
  onCreator: (action: string) => void;
  isPulsePending: boolean;
  isTvPending: boolean;
  isCreatorPending: boolean;
}) {
  const [tvTargetHub, setTvTargetHub] = useState("all");
  const { data: distStatus, isLoading: distLoading } = useQuery<Record<string, unknown>>({
    queryKey: [`/api/admin/crown/campaigns/${campaignId}/distribution-status`],
  });
  const { data: hubsList } = useQuery<Array<Record<string, unknown>>>({
    queryKey: ["/api/admin/crown/hubs-list", cityId],
    queryFn: async () => {
      const r = await fetch(`/api/admin/regions?cityId=${cityId}&type=hub`);
      if (!r.ok) return [];
      return r.json();
    },
  });

  const pulse = (distStatus?.pulse || {}) as { drafts?: Array<Record<string, unknown>>; postDetails?: Array<Record<string, unknown>> };
  const venueTv = (distStatus?.venueTv || {}) as { items?: Array<Record<string, unknown>>; itemDetails?: Array<Record<string, unknown>> };
  const creator = (distStatus?.creator || {}) as { actions?: Array<Record<string, unknown>>; sourceRequests?: Array<Record<string, unknown>>; suggestions?: Array<Record<string, unknown>> };
  const creatorFlags = (distStatus?.creatorFlags || {}) as { readyForCreatorFeature?: boolean; creatorStoryRequested?: boolean; creatorInterviewScheduled?: boolean };
  const pulseDrafts = pulse.drafts || [];
  const pulseDetails = pulse.postDetails || [];
  const tvItems = venueTv.items || [];
  const tvDetails = venueTv.itemDetails || [];
  const creatorActions = creator.actions || [];
  const creatorSuggestions = creator.suggestions || [];
  const creatorSRs = creator.sourceRequests || [];

  return (
    <div className="mt-3 space-y-4" data-testid={`dist-panel-${campaignId}`}>
      <div className="flex items-center gap-2 mb-2">
        <Select value={distStage} onValueChange={setDistStage}>
          <SelectTrigger className="w-40" data-testid={`select-dist-stage-${campaignId}`}><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="launch" data-testid="select-item-dist-launch">Launch</SelectItem>
            <SelectItem value="nominations" data-testid="select-item-dist-nominations">Nominations</SelectItem>
            <SelectItem value="finalists" data-testid="select-item-dist-finalists">Finalists</SelectItem>
            <SelectItem value="voting" data-testid="select-item-dist-voting">Voting</SelectItem>
            <SelectItem value="winners" data-testid="select-item-dist-winners">Winners</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card data-testid={`dist-pulse-card-${campaignId}`}>
          <CardContent className="p-3 space-y-2">
            <div className="flex items-center gap-2">
              <Pen className="h-4 w-4 text-blue-500" />
              <p className="font-medium text-sm">Pulse Stories</p>
              <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 ml-auto">{pulseDrafts.length}</Badge>
            </div>
            <Button
              size="sm"
              className="w-full"
              onClick={() => onPulse(distStage)}
              disabled={isPulsePending}
              data-testid={`button-dist-pulse-${campaignId}`}
            >
              {isPulsePending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Plus className="h-3.5 w-3.5 mr-1" />}
              Generate Pulse Draft
            </Button>
            {pulseDrafts.length > 0 && (
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {pulseDrafts.map((d, i) => {
                  const detail = pulseDetails.find((p) => p.id === d.postId);
                  return (
                    <div key={i} className="text-xs bg-muted rounded p-2 flex items-center justify-between" data-testid={`dist-pulse-item-${i}`}>
                      <div>
                        <p className="font-medium truncate max-w-[180px]">{d.title as string}</p>
                        <p className="text-muted-foreground">{d.stage as string} - {d.createdAt ? new Date(d.createdAt as string).toLocaleDateString() : ""}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Badge className="bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 text-[10px]">{(detail?.status as string) || "draft"}</Badge>
                        <Button size="sm" variant="ghost" className="h-auto p-0.5" onClick={() => window.open(`/admin/pulse-posts`, "_blank")} data-testid={`link-pulse-draft-${i}`}>
                          <Eye className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card data-testid={`dist-tv-card-${campaignId}`}>
          <CardContent className="p-3 space-y-2">
            <div className="flex items-center gap-2">
              <Monitor className="h-4 w-4 text-purple-500" />
              <p className="font-medium text-sm">Venue TV</p>
              <Badge className="bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300 ml-auto">{tvItems.length}</Badge>
            </div>
            <Select value={tvTargetHub} onValueChange={setTvTargetHub}>
              <SelectTrigger className="w-full text-xs" data-testid={`select-tv-hub-${campaignId}`}><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all" data-testid="select-tv-hub-all">All Screens</SelectItem>
                {(hubsList || []).map((h) => (
                  <SelectItem key={h.id as string} value={h.slug as string} data-testid={`select-tv-hub-${h.slug}`}>{h.name as string}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              className="w-full"
              onClick={() => onTv(distStage, tvTargetHub === "all" ? undefined : tvTargetHub)}
              disabled={isTvPending}
              data-testid={`button-dist-tv-${campaignId}`}
            >
              {isTvPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Monitor className="h-3.5 w-3.5 mr-1" />}
              Push to Venue TV
            </Button>
            {tvItems.length > 0 && (
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {tvItems.map((t, i) => {
                  const detail = tvDetails.find((tv) => tv.id === t.tvItemId);
                  return (
                    <div key={i} className="text-xs bg-muted rounded p-2 flex items-center justify-between" data-testid={`dist-tv-item-${i}`}>
                      <div>
                        <p className="font-medium truncate max-w-[180px]">{t.title as string}</p>
                        <p className="text-muted-foreground">{t.stage as string}{t.targetHubSlug ? ` (${t.targetHubSlug})` : ""} - {t.createdAt ? new Date(t.createdAt as string).toLocaleDateString() : ""}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Badge className={`text-[10px] ${detail?.enabled ? "bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-400" : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"}`}>{detail?.enabled ? "live" : "off"}</Badge>
                        <Button size="sm" variant="ghost" className="h-auto p-0.5" onClick={() => window.open(`/admin/web-tv`, "_blank")} data-testid={`link-tv-item-${i}`}>
                          <Eye className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card data-testid={`dist-creator-card-${campaignId}`}>
          <CardContent className="p-3 space-y-2">
            <div className="flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-amber-500" />
              <p className="font-medium text-sm">Creator Coverage</p>
              <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300 ml-auto">{creatorActions.length}</Badge>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs">
                {creatorFlags.readyForCreatorFeature ? <Check className="h-3 w-3 text-green-500" /> : <X className="h-3 w-3 text-gray-400" />}
                <span>Ready for feature</span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                {creatorFlags.creatorStoryRequested ? <Check className="h-3 w-3 text-green-500" /> : <X className="h-3 w-3 text-gray-400" />}
                <span>Story requested</span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                {creatorFlags.creatorInterviewScheduled ? <Check className="h-3 w-3 text-green-500" /> : <X className="h-3 w-3 text-gray-400" />}
                <span>Interview scheduled</span>
              </div>
            </div>
            <div className="flex gap-1">
              <Button
                size="sm"
                variant="outline"
                className="flex-1 text-xs"
                onClick={() => onCreator("ready_for_feature")}
                disabled={isCreatorPending || !!creatorFlags.readyForCreatorFeature}
                data-testid={`button-dist-creator-feature-${campaignId}`}
              >
                {isCreatorPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Flag className="h-3 w-3 mr-0.5" />} Feature
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="flex-1 text-xs"
                onClick={() => onCreator("request_story")}
                disabled={isCreatorPending || !!creatorFlags.creatorStoryRequested}
                data-testid={`button-dist-creator-story-${campaignId}`}
              >
                {isCreatorPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileText className="h-3 w-3 mr-0.5" />} Story
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="flex-1 text-xs"
                onClick={() => onCreator("schedule_interview")}
                disabled={isCreatorPending || !!creatorFlags.creatorInterviewScheduled}
                data-testid={`button-dist-creator-interview-${campaignId}`}
              >
                {isCreatorPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Clock className="h-3 w-3 mr-0.5" />} Interview
              </Button>
            </div>
            {creatorSRs.length > 0 && (
              <div className="space-y-1 max-h-24 overflow-y-auto">
                {creatorSRs.map((sr, i) => (
                  <div key={i} className="text-xs bg-muted rounded p-2 flex items-center justify-between" data-testid={`dist-creator-sr-${i}`}>
                    <div>
                      <p className="font-medium truncate max-w-[140px]">{sr.title as string}</p>
                      <p className="text-muted-foreground">{sr.status as string}</p>
                    </div>
                    <Button size="sm" variant="ghost" className="h-auto p-0.5" onClick={() => window.open(`/admin/source-requests`, "_blank")} data-testid={`link-creator-sr-${i}`}>
                      <Eye className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            {creatorSuggestions.length > 0 && (
              <div className="border-t pt-1 mt-1">
                <p className="text-[10px] font-medium text-muted-foreground mb-1">Coverage Suggestions</p>
                <div className="space-y-0.5 max-h-20 overflow-y-auto">
                  {creatorSuggestions.map((s, i) => (
                    <p key={i} className="text-[10px] text-muted-foreground truncate" data-testid={`dist-creator-suggestion-${i}`}>
                      {(s.title as string) || (s.description as string) || ""}
                    </p>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {distLoading && <Skeleton className="h-20" />}
    </div>
  );
}

function PackagesTab({ cityId }: { cityId: string }) {
  const { toast } = useToast();
  const [showCreate, setShowCreate] = useState(false);
  const [showAssign, setShowAssign] = useState<string | null>(null);
  const [assignParticipantId, setAssignParticipantId] = useState("");
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newPriceCents, setNewPriceCents] = useState(0);
  const [newIsPerk, setNewIsPerk] = useState(false);
  const [newItems, setNewItems] = useState("");

  const { data: packages = [], isLoading } = useQuery<Array<Record<string, unknown>>>({
    queryKey: ["/api/admin/crown/packages", cityId],
    queryFn: async () => {
      const r = await fetch(`/api/admin/crown/packages?cityId=${cityId}`);
      if (!r.ok) return [];
      return r.json();
    },
  });

  const { data: participants = [] } = useQuery<Array<{ id: string; name: string; status: string }>>({
    queryKey: ["/api/admin/crown/participants", cityId, "for-assign"],
    queryFn: async () => {
      const r = await fetch(`/api/admin/crown/participants?cityId=${cityId}`);
      if (!r.ok) return [];
      return r.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("POST", "/api/admin/crown/packages", {
        cityId, name: newName, description: newDescription || undefined,
        includedItems: newItems.split("\n").filter(Boolean),
        isIncludedPerk: newIsPerk, priceCents: newPriceCents,
      });
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/crown/packages"] });
      toast({ title: "Package created" });
      setShowCreate(false);
      setNewName(""); setNewDescription(""); setNewPriceCents(0); setNewIsPerk(false); setNewItems("");
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const assignMutation = useMutation({
    mutationFn: async ({ packageId, participantId }: { packageId: string; participantId: string }) => {
      const r = await apiRequest("POST", `/api/admin/crown/packages/${packageId}/assign`, { participantId });
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "Package assigned" });
      setShowAssign(null);
      setAssignParticipantId("");
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/admin/crown/packages/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/crown/packages"] });
      toast({ title: "Package deleted" });
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const r = await apiRequest("PATCH", `/api/admin/crown/packages/${id}`, { isActive });
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/crown/packages"] });
    },
  });

  if (isLoading) return <Skeleton className="h-40" />;

  return (
    <div className="space-y-4 mt-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{packages.length} marketing packages</p>
        <Button size="sm" onClick={() => setShowCreate(true)} data-testid="button-create-package">
          <Plus className="h-4 w-4 mr-1" /> New Package
        </Button>
      </div>

      <div className="space-y-3">
        {packages.map((pkg) => {
          const items = (pkg.included_items || []) as string[];
          const isActive = pkg.is_active as boolean;
          return (
            <Card key={pkg.id as string} className={!isActive ? "opacity-60" : ""} data-testid={`card-package-${pkg.id}`}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-amber-500" />
                    <p className="font-medium text-sm">{pkg.name as string}</p>
                    {pkg.is_included_perk ? (
                      <Badge variant="outline" className="text-[10px] bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300">Included Perk</Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px]">${((pkg.price_cents as number) / 100).toFixed(2)}</Badge>
                    )}
                    {!isActive && <Badge variant="outline" className="text-[10px] bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300">Inactive</Badge>}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button size="sm" variant="outline" onClick={() => setShowAssign(pkg.id as string)} data-testid={`button-assign-${pkg.id}`}>
                      <UserPlus className="h-3.5 w-3.5 mr-1" /> Assign
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => toggleActiveMutation.mutate({ id: pkg.id as string, isActive: !isActive })} data-testid={`button-toggle-${pkg.id}`}>
                      {isActive ? <X className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => deleteMutation.mutate(pkg.id as string)} data-testid={`button-delete-package-${pkg.id}`}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                {pkg.description && <p className="text-xs text-muted-foreground mb-2">{pkg.description as string}</p>}
                {items.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {items.map((item, i) => (
                      <Badge key={i} variant="outline" className="text-[10px]">{item}</Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create Marketing Package</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Package name" value={newName} onChange={(e) => setNewName(e.target.value)} data-testid="input-package-name" />
            <Textarea placeholder="Description" value={newDescription} onChange={(e) => setNewDescription(e.target.value)} data-testid="input-package-description" />
            <Textarea placeholder="Included items (one per line)" value={newItems} onChange={(e) => setNewItems(e.target.value)} data-testid="input-package-items" />
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={newIsPerk} onChange={(e) => setNewIsPerk(e.target.checked)} data-testid="checkbox-is-perk" />
                Included as perk
              </label>
              {!newIsPerk && (
                <Input
                  type="number"
                  placeholder="Price (cents)"
                  value={newPriceCents}
                  onChange={(e) => setNewPriceCents(parseInt(e.target.value) || 0)}
                  className="w-32"
                  data-testid="input-package-price"
                />
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)} data-testid="button-cancel-package">Cancel</Button>
            <Button onClick={() => createMutation.mutate()} disabled={!newName || createMutation.isPending} data-testid="button-save-package">
              {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!showAssign} onOpenChange={() => setShowAssign(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Assign Package to Participant</DialogTitle></DialogHeader>
          <Select value={assignParticipantId} onValueChange={setAssignParticipantId}>
            <SelectTrigger data-testid="select-assign-participant"><SelectValue placeholder="Select participant" /></SelectTrigger>
            <SelectContent>
              {participants.map((p) => (
                <SelectItem key={p.id} value={p.id} data-testid={`select-item-participant-${p.id}`}>{p.name} ({p.status})</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAssign(null)} data-testid="button-cancel-assign">Cancel</Button>
            <Button
              onClick={() => { if (showAssign && assignParticipantId) assignMutation.mutate({ packageId: showAssign, participantId: assignParticipantId }); }}
              disabled={!assignParticipantId || assignMutation.isPending}
              data-testid="button-confirm-assign"
            >
              {assignMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Assign"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
