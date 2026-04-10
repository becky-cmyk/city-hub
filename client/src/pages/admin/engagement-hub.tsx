import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useDefaultCityId } from "@/hooks/use-city";
import {
  Vote, ClipboardList, FileText,
  Heart, Plus, Loader2, CheckCircle, XCircle,
  Star, Eye, Download, Award, Calendar, Pencil,
} from "lucide-react";

interface TopReactedEntry {
  entityType: string;
  entityId: string;
  count: number;
}

interface MostReviewedZone {
  zoneId: string;
  zoneName: string | null;
  reviewCount: number;
  avgRating: number;
}

interface EngagementSummary {
  neighborhoodReviews: number;
  polls: number;
  pollVotes: number;
  votingCampaigns: number;
  votingBallots: number;
  quizzes: number;
  quizAttempts: number;
  surveys: number;
  surveyResponses: number;
  contentReactions: number;
  activePolls: number;
  activeSurveys: number;
  activeQuizzes: number;
  activeCampaigns: number;
  pendingReviews: number;
  topReactedContent: TopReactedEntry[];
  mostReviewedZones: MostReviewedZone[];
}

interface PollOption {
  id: string;
  label: string;
  voteCount?: number;
}

interface AdminPoll {
  id: string;
  cityId: string;
  zoneId: string | null;
  question: string;
  choiceMode: string;
  isActive: boolean;
  isPinned: boolean;
  expiresAt: string | null;
  createdAt: string;
  options: PollOption[];
  totalVotes: number;
}

interface AdminSurvey {
  id: string;
  cityId: string;
  title: string;
  description: string | null;
  isActive: boolean;
  isAnonymous: boolean;
  expiresAt: string | null;
  createdAt: string;
  questionCount: number;
  responseCount: number;
}

interface SurveyQuestion {
  id: string;
  question: string;
  questionType: string;
  options: string[] | null;
  isRequired: boolean;
  sortOrder: number;
}

interface SurveyResponseEntry {
  id: string;
  surveyId: string;
  userId: string;
  answers: Record<string, string | string[] | number>;
  submittedAt: string;
  displayName: string;
}

interface SurveyResponsesData {
  questions: SurveyQuestion[];
  responses: SurveyResponseEntry[];
}

interface AdminQuiz {
  id: string;
  cityId: string;
  title: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  questionCount: number;
  attemptCount: number;
  avgScorePercent: number;
}

interface AdminVotingCampaign {
  id: string;
  cityId: string;
  title: string;
  description: string | null;
  slug: string;
  status: string;
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
  totalBallots: number;
  categoryCount: number;
}

interface VotingNominee {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  voteCount: number;
}

interface VotingCategoryResult {
  id: string;
  name: string;
  description: string | null;
  sortOrder: number;
  nominees: VotingNominee[];
}

interface CampaignResults {
  id: string;
  title: string;
  categories: VotingCategoryResult[];
}

interface AdminReview {
  id: string;
  cityId: string;
  zoneId: string;
  userId: string;
  rating: number;
  comment: string | null;
  pros: string[] | null;
  cons: string[] | null;
  status: string;
  createdAt: string;
  displayName: string;
  zoneName: string | null;
}

interface ReactionEntry {
  id: string;
  entityType: string;
  entityId: string;
  reactionType: string;
  createdAt: string;
  displayName: string;
}

interface ReactionsAnalytics {
  reactionsByType: Record<string, number>;
  reactionsByEntity: Record<string, number>;
  topReacted: TopReactedEntry[];
  recent: ReactionEntry[];
}

interface ZoneOption {
  id: string;
  name: string;
}

interface FilterBarProps {
  zoneId: string;
  setZoneId: (v: string) => void;
  dateFrom: string;
  setDateFrom: (v: string) => void;
  dateTo: string;
  setDateTo: (v: string) => void;
  zones: ZoneOption[];
  showZone?: boolean;
}

function downloadCsv(filename: string, headers: string[], rows: string[][]) {
  const csvContent = [headers.join(","), ...rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(","))].join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function buildFilterParams(cityId: string, zoneId: string, dateFrom: string, dateTo: string): string {
  let qs = `?cityId=${cityId}`;
  if (zoneId) qs += `&zoneId=${zoneId}`;
  if (dateFrom) qs += `&dateFrom=${dateFrom}`;
  if (dateTo) qs += `&dateTo=${dateTo}`;
  return qs;
}

function FilterBar({ zoneId, setZoneId, dateFrom, setDateFrom, dateTo, setDateTo, zones, showZone = true }: FilterBarProps) {
  return (
    <div className="flex items-center gap-2 flex-wrap mb-3" data-testid="filter-bar">
      {showZone && (
        <Select value={zoneId || "_all"} onValueChange={v => setZoneId(v === "_all" ? "" : v)}>
          <SelectTrigger className="w-40 text-xs" data-testid="select-zone-filter"><SelectValue placeholder="All neighborhoods" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">All neighborhoods</SelectItem>
            {zones.map(z => <SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>)}
          </SelectContent>
        </Select>
      )}
      <div className="flex items-center gap-1.5">
        <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
        <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-32 text-xs" data-testid="input-date-from" />
        <span className="text-xs text-muted-foreground">to</span>
        <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-32 text-xs" data-testid="input-date-to" />
      </div>
      {(zoneId || dateFrom || dateTo) && (
        <Button variant="ghost" size="sm" className="text-xs" onClick={() => { setZoneId(""); setDateFrom(""); setDateTo(""); }} data-testid="button-clear-filters">
          Clear
        </Button>
      )}
    </div>
  );
}

interface ActivityEntry {
  id: string;
  type: string;
  label: string;
  createdAt: string;
}

const ACTIVITY_TYPE_LABELS: Record<string, string> = {
  review: "Review",
  poll_vote: "Poll Vote",
  quiz_attempt: "Quiz",
  survey_response: "Survey",
  reaction: "Reaction",
};

function RecentActivityFeed({ cityId }: { cityId: string }) {
  const { data: activity, isLoading } = useQuery<ActivityEntry[]>({
    queryKey: ["/api/admin/community/recent-activity", cityId],
    queryFn: async () => {
      const resp = await fetch(`/api/admin/community/recent-activity?cityId=${cityId}`);
      if (!resp.ok) throw new Error("Failed");
      return resp.json();
    },
    enabled: !!cityId,
  });

  if (isLoading) return <Skeleton className="h-40" />;
  if (!activity || activity.length === 0) return null;

  return (
    <Card data-testid="card-recent-activity">
      <CardContent className="p-4">
        <p className="text-xs font-medium mb-3">Recent Activity</p>
        <div className="divide-y">
          {activity.map(a => (
            <div key={`${a.type}-${a.id}`} className="flex items-center justify-between py-2">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <Badge variant="outline" className="text-[10px] shrink-0">{ACTIVITY_TYPE_LABELS[a.type] || a.type}</Badge>
                <span className="text-xs truncate">{a.label}</span>
              </div>
              <span className="text-[10px] text-muted-foreground shrink-0 ml-2">{new Date(a.createdAt).toLocaleDateString()}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function OverviewTab({ summary, isLoading, cityId }: { summary: EngagementSummary | undefined; isLoading: boolean; cityId: string }) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3" data-testid="engagement-overview-loading">
        {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
      </div>
    );
  }
  if (!summary) return <p className="text-sm text-muted-foreground p-4">No data available.</p>;

  const metrics = [
    { label: "Polls", total: summary.polls, active: summary.activePolls, icon: Vote, sub: `${summary.pollVotes} votes` },
    { label: "Surveys", total: summary.surveys, active: summary.activeSurveys, icon: ClipboardList, sub: `${summary.surveyResponses} responses` },
    { label: "Quizzes", total: summary.quizzes, active: summary.activeQuizzes, icon: FileText, sub: `${summary.quizAttempts} attempts` },
    { label: "Voting Campaigns", total: summary.votingCampaigns, active: summary.activeCampaigns, icon: Award, sub: `${summary.votingBallots} ballots` },
    { label: "Reviews", total: summary.neighborhoodReviews, active: summary.pendingReviews, icon: Star, sub: `${summary.pendingReviews} pending moderation` },
    { label: "Reactions", total: summary.contentReactions, active: 0, icon: Heart, sub: "total reactions" },
  ];

  const totalParticipation = summary.pollVotes + summary.surveyResponses + summary.quizAttempts + summary.votingBallots + summary.contentReactions;

  return (
    <div className="space-y-5" data-testid="engagement-overview">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {metrics.map(m => (
          <Card key={m.label} data-testid={`card-metric-${m.label.toLowerCase().replace(/\s+/g, "-")}`}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <m.icon className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">{m.label}</span>
              </div>
              <p className="text-2xl font-bold">{m.total}</p>
              <div className="flex items-center gap-2 mt-1">
                {m.active > 0 && <Badge variant="outline" className="text-[10px] bg-green-500/10 text-green-600 border-green-500/20">{m.active} active</Badge>}
                <span className="text-[11px] text-muted-foreground">{m.sub}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card data-testid="card-total-participation">
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground mb-1">Total Community Participation</p>
          <p className="text-3xl font-bold">{totalParticipation.toLocaleString()}</p>
          <p className="text-[11px] text-muted-foreground mt-1">Across all engagement features (votes + responses + attempts + ballots + reactions)</p>
        </CardContent>
      </Card>

      <RecentActivityFeed cityId={cityId} />

      <div className="grid md:grid-cols-2 gap-4">
        <Card data-testid="card-top-reacted-content">
          <CardContent className="p-4">
            <p className="text-xs font-medium mb-3">Top Reacted Content</p>
            {summary.topReactedContent && summary.topReactedContent.length > 0 ? (
              <div className="divide-y">
                {summary.topReactedContent.map((item, i) => (
                  <div key={`${item.entityType}-${item.entityId}`} className="flex items-center justify-between py-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[11px] text-muted-foreground w-5">#{i + 1}</span>
                      <Badge variant="outline" className="text-[10px] capitalize">{item.entityType.replace(/_/g, " ")}</Badge>
                    </div>
                    <span className="text-xs font-medium">{item.count} reactions</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No reacted content yet.</p>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-most-reviewed-zones">
          <CardContent className="p-4">
            <p className="text-xs font-medium mb-3">Most Reviewed Neighborhoods</p>
            {summary.mostReviewedZones && summary.mostReviewedZones.length > 0 ? (
              <div className="divide-y">
                {summary.mostReviewedZones.map((zone, i) => (
                  <div key={zone.zoneId} className="flex items-center justify-between py-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[11px] text-muted-foreground w-5">#{i + 1}</span>
                      <span className="text-xs">{zone.zoneName || "Unknown"}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="flex items-center gap-0.5">
                        <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                        <span className="text-xs font-medium">{zone.avgRating}</span>
                      </div>
                      <span className="text-[11px] text-muted-foreground">{zone.reviewCount} reviews</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No approved reviews yet.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function PollsTab({ cityId, zones }: { cityId: string; zones: ZoneOption[] }) {
  const { toast } = useToast();
  const [showCreate, setShowCreate] = useState(false);
  const [editPoll, setEditPoll] = useState<AdminPoll | null>(null);
  const [editQuestion, setEditQuestion] = useState("");
  const [editPinned, setEditPinned] = useState(false);
  const [newQuestion, setNewQuestion] = useState("");
  const [newOptions, setNewOptions] = useState(["", ""]);
  const [newChoiceMode, setNewChoiceMode] = useState("single");
  const [zoneId, setZoneId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const { data: polls, isLoading } = useQuery<AdminPoll[]>({
    queryKey: ["/api/admin/community/polls", cityId, zoneId, dateFrom, dateTo],
    queryFn: async () => {
      const resp = await fetch(`/api/admin/community/polls${buildFilterParams(cityId, zoneId, dateFrom, dateTo)}`);
      if (!resp.ok) throw new Error("Failed to fetch polls");
      return resp.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: { cityId: string; question: string; choiceMode: string; options: string[] }) => {
      const resp = await apiRequest("POST", "/api/admin/community/polls", data);
      return resp.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/community/polls"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/community/engagement-summary"] });
      toast({ title: "Poll created" });
      setShowCreate(false);
      setNewQuestion("");
      setNewOptions(["", ""]);
    },
    onError: (err: Error) => toast({ title: "Failed to create poll", description: err.message, variant: "destructive" }),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const resp = await apiRequest("PATCH", `/api/admin/community/polls/${id}`, { isActive });
      return resp.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/community/polls"] });
      toast({ title: "Poll updated" });
    },
  });

  const editMutation = useMutation({
    mutationFn: async ({ id, question, isPinned }: { id: string; question: string; isPinned: boolean }) => {
      const resp = await apiRequest("PATCH", `/api/admin/community/polls/${id}`, { question, isPinned });
      return resp.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/community/polls"] });
      toast({ title: "Poll updated" });
      setEditPoll(null);
    },
    onError: (err: Error) => toast({ title: "Failed to update", description: err.message, variant: "destructive" }),
  });

  const openEditPoll = (poll: AdminPoll) => {
    setEditPoll(poll);
    setEditQuestion(poll.question);
    setEditPinned(poll.isPinned);
  };

  const handleCreate = () => {
    const filtered = newOptions.filter(o => o.trim());
    if (!newQuestion.trim() || filtered.length < 2) {
      toast({ title: "Please provide a question and at least 2 options", variant: "destructive" });
      return;
    }
    createMutation.mutate({ cityId, question: newQuestion.trim(), choiceMode: newChoiceMode, options: filtered.map(o => o.trim()) });
  };

  const handleExport = () => {
    if (!polls || polls.length === 0) return;
    const headers = ["Question", "Choice Mode", "Active", "Total Votes", "Created", "Options"];
    const rows = polls.map(p => [
      p.question, p.choiceMode, p.isActive ? "Yes" : "No", String(p.totalVotes),
      new Date(p.createdAt).toLocaleDateString(),
      p.options.map(o => `${o.label} (${o.voteCount || 0})`).join("; "),
    ]);
    downloadCsv("polls-export.csv", headers, rows);
  };

  if (isLoading) return <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20" />)}</div>;

  return (
    <div className="space-y-4" data-testid="polls-tab">
      <FilterBar zoneId={zoneId} setZoneId={setZoneId} dateFrom={dateFrom} setDateFrom={setDateFrom} dateTo={dateTo} setDateTo={setDateTo} zones={zones} />
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-sm text-muted-foreground">{polls?.length || 0} polls</p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExport} disabled={!polls?.length} data-testid="button-export-polls"><Download className="h-3.5 w-3.5 mr-1" /> Export CSV</Button>
          <Button size="sm" onClick={() => setShowCreate(true)} data-testid="button-create-poll"><Plus className="h-3.5 w-3.5 mr-1" /> New Poll</Button>
        </div>
      </div>

      {polls?.map(poll => (
        <Card key={poll.id} data-testid={`card-poll-${poll.id}`}>
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant={poll.isActive ? "default" : "outline"} className="text-[10px]">{poll.isActive ? "Active" : "Inactive"}</Badge>
                  {poll.isPinned && <Badge variant="outline" className="text-[10px]">Pinned</Badge>}
                  <Badge variant="outline" className="text-[10px]">{poll.choiceMode}</Badge>
                </div>
                <p className="text-sm font-medium">{poll.question}</p>
                <div className="mt-2 space-y-1">
                  {poll.options.map(opt => {
                    const pct = poll.totalVotes > 0 ? Math.round(((opt.voteCount || 0) / poll.totalVotes) * 100) : 0;
                    return (
                      <div key={opt.id} className="flex items-center gap-2 text-xs">
                        <span className="text-muted-foreground flex-1">{opt.label}</span>
                        <div className="w-20 bg-muted rounded-full h-1.5"><div className="bg-foreground/20 h-1.5 rounded-full" style={{ width: `${pct}%` }} /></div>
                        <span className="font-medium w-16 text-right">{opt.voteCount || 0} ({pct}%)</span>
                      </div>
                    );
                  })}
                </div>
                <p className="text-[11px] text-muted-foreground mt-2">
                  {poll.totalVotes} total votes · Created {new Date(poll.createdAt).toLocaleDateString()}
                  {poll.expiresAt && ` · Expires ${new Date(poll.expiresAt).toLocaleDateString()}`}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditPoll(poll)} data-testid={`button-edit-poll-${poll.id}`}><Pencil className="h-3.5 w-3.5" /></Button>
                <Switch checked={poll.isActive} onCheckedChange={(checked) => toggleMutation.mutate({ id: poll.id, isActive: checked })} data-testid={`switch-poll-active-${poll.id}`} />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
      {polls?.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No polls match the current filters.</p>}

      <Dialog open={!!editPoll} onOpenChange={(o) => { if (!o) setEditPoll(null); }}>
        <DialogContent data-testid="dialog-edit-poll">
          <DialogHeader><DialogTitle>Edit Poll</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Question</Label><Input value={editQuestion} onChange={e => setEditQuestion(e.target.value)} data-testid="input-edit-poll-question" /></div>
            <div className="flex items-center gap-2"><Switch checked={editPinned} onCheckedChange={setEditPinned} data-testid="switch-edit-poll-pinned" /><Label>Pinned</Label></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditPoll(null)}>Cancel</Button>
            <Button onClick={() => editPoll && editMutation.mutate({ id: editPoll.id, question: editQuestion.trim(), isPinned: editPinned })} disabled={editMutation.isPending} data-testid="button-save-poll">
              {editMutation.isPending && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent data-testid="dialog-create-poll">
          <DialogHeader><DialogTitle>Create Poll</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Question</Label><Input value={newQuestion} onChange={e => setNewQuestion(e.target.value)} placeholder="What do you think about..." data-testid="input-poll-question" /></div>
            <div>
              <Label>Choice Mode</Label>
              <Select value={newChoiceMode} onValueChange={setNewChoiceMode}>
                <SelectTrigger data-testid="select-poll-choice-mode"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="single">Single Choice</SelectItem><SelectItem value="multi">Multiple Choice</SelectItem></SelectContent>
              </Select>
            </div>
            <div>
              <Label>Options</Label>
              <div className="space-y-2">
                {newOptions.map((opt, i) => (
                  <div key={i} className="flex gap-2">
                    <Input value={opt} onChange={e => { const c = [...newOptions]; c[i] = e.target.value; setNewOptions(c); }} placeholder={`Option ${i + 1}`} data-testid={`input-poll-option-${i}`} />
                    {newOptions.length > 2 && <Button variant="ghost" size="icon" onClick={() => setNewOptions(newOptions.filter((_, j) => j !== i))}><XCircle className="h-4 w-4" /></Button>}
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={() => setNewOptions([...newOptions, ""])} data-testid="button-add-poll-option"><Plus className="h-3 w-3 mr-1" /> Add Option</Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending} data-testid="button-submit-poll">
              {createMutation.isPending && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />} Create Poll
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SurveysTab({ cityId }: { cityId: string }) {
  const { toast } = useToast();
  const [showCreate, setShowCreate] = useState(false);
  const [editSurvey, setEditSurvey] = useState<AdminSurvey | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [viewResponsesId, setViewResponsesId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [newQuestions, setNewQuestions] = useState<Array<{ question: string; questionType: string; options: string[] | null; isRequired: boolean }>>([
    { question: "", questionType: "text", options: null, isRequired: true },
  ]);

  const { data: surveys, isLoading } = useQuery<AdminSurvey[]>({
    queryKey: ["/api/admin/community/surveys", cityId, dateFrom, dateTo],
    queryFn: async () => {
      const resp = await fetch(`/api/admin/community/surveys${buildFilterParams(cityId, "", dateFrom, dateTo)}`);
      if (!resp.ok) throw new Error("Failed");
      return resp.json();
    },
  });

  const { data: responsesData } = useQuery<SurveyResponsesData>({
    queryKey: ["/api/admin/community/surveys", viewResponsesId, "responses"],
    queryFn: async () => {
      const resp = await fetch(`/api/admin/community/surveys/${viewResponsesId}/responses`);
      if (!resp.ok) throw new Error("Failed");
      return resp.json();
    },
    enabled: !!viewResponsesId,
  });

  const createMutation = useMutation({
    mutationFn: async (data: { cityId: string; title: string; description: string | null; questions: Array<{ question: string; questionType: string; options: string[] | null; isRequired: boolean }> }) => {
      const resp = await apiRequest("POST", "/api/admin/community/surveys", data);
      return resp.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/community/surveys"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/community/engagement-summary"] });
      toast({ title: "Survey created" });
      setShowCreate(false);
      setNewTitle("");
      setNewDescription("");
      setNewQuestions([{ question: "", questionType: "text", options: null, isRequired: true }]);
    },
    onError: (err: Error) => toast({ title: "Failed to create survey", description: err.message, variant: "destructive" }),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const resp = await apiRequest("PATCH", `/api/admin/community/surveys/${id}`, { isActive });
      return resp.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/admin/community/surveys"] }); toast({ title: "Survey updated" }); },
  });

  const surveyEditMutation = useMutation({
    mutationFn: async ({ id, title, description }: { id: string; title: string; description: string | null }) => {
      const resp = await apiRequest("PATCH", `/api/admin/community/surveys/${id}`, { title, description });
      return resp.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/community/surveys"] });
      toast({ title: "Survey updated" });
      setEditSurvey(null);
    },
    onError: (err: Error) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });

  const openEditSurvey = (s: AdminSurvey) => {
    setEditSurvey(s);
    setEditTitle(s.title);
    setEditDesc(s.description || "");
  };

  const handleCreate = () => {
    const validQs = newQuestions.filter(q => q.question.trim());
    if (!newTitle.trim() || validQs.length === 0) { toast({ title: "Provide a title and at least one question", variant: "destructive" }); return; }
    createMutation.mutate({ cityId, title: newTitle.trim(), description: newDescription.trim() || null, questions: validQs });
  };

  const handleExport = () => {
    if (!surveys || surveys.length === 0) return;
    const headers = ["Title", "Active", "Anonymous", "Questions", "Responses", "Created"];
    const rows = surveys.map(s => [s.title, s.isActive ? "Yes" : "No", s.isAnonymous ? "Yes" : "No", String(s.questionCount), String(s.responseCount), new Date(s.createdAt).toLocaleDateString()]);
    downloadCsv("surveys-export.csv", headers, rows);
  };

  const handleExportResponses = () => {
    if (!responsesData || responsesData.responses.length === 0) return;
    const headers = ["Respondent", "Submitted At", ...responsesData.questions.map(q => q.question)];
    const rows = responsesData.responses.map(r => [
      r.displayName, new Date(r.submittedAt).toLocaleString(),
      ...responsesData.questions.map(q => { const val = r.answers?.[q.id]; if (val === undefined) return ""; return Array.isArray(val) ? val.join("; ") : String(val); }),
    ]);
    downloadCsv("survey-responses-export.csv", headers, rows);
  };

  const moveQuestion = (from: number, to: number) => {
    if (to < 0 || to >= newQuestions.length) return;
    const c = [...newQuestions];
    const [item] = c.splice(from, 1);
    c.splice(to, 0, item);
    setNewQuestions(c);
  };

  if (isLoading) return <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20" />)}</div>;

  return (
    <div className="space-y-4" data-testid="surveys-tab">
      <FilterBar zoneId="" setZoneId={() => {}} dateFrom={dateFrom} setDateFrom={setDateFrom} dateTo={dateTo} setDateTo={setDateTo} zones={[]} showZone={false} />
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-sm text-muted-foreground">{surveys?.length || 0} surveys</p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExport} disabled={!surveys?.length} data-testid="button-export-surveys"><Download className="h-3.5 w-3.5 mr-1" /> Export CSV</Button>
          <Button size="sm" onClick={() => setShowCreate(true)} data-testid="button-create-survey"><Plus className="h-3.5 w-3.5 mr-1" /> New Survey</Button>
        </div>
      </div>

      {surveys?.map(survey => (
        <Card key={survey.id} data-testid={`card-survey-${survey.id}`}>
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant={survey.isActive ? "default" : "outline"} className="text-[10px]">{survey.isActive ? "Active" : "Inactive"}</Badge>
                  {survey.isAnonymous && <Badge variant="outline" className="text-[10px]">Anonymous</Badge>}
                </div>
                <p className="text-sm font-medium">{survey.title}</p>
                {survey.description && <p className="text-xs text-muted-foreground mt-0.5">{survey.description}</p>}
                <p className="text-[11px] text-muted-foreground mt-2">{survey.questionCount} questions · {survey.responseCount} responses · Created {new Date(survey.createdAt).toLocaleDateString()}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditSurvey(survey)} data-testid={`button-edit-survey-${survey.id}`}><Pencil className="h-3.5 w-3.5" /></Button>
                <Button variant="outline" size="sm" onClick={() => setViewResponsesId(survey.id)} data-testid={`button-view-responses-${survey.id}`}><Eye className="h-3.5 w-3.5 mr-1" /> Responses</Button>
                <Switch checked={survey.isActive} onCheckedChange={(checked) => toggleMutation.mutate({ id: survey.id, isActive: checked })} data-testid={`switch-survey-active-${survey.id}`} />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
      {surveys?.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No surveys match the current filters.</p>}

      <Dialog open={!!editSurvey} onOpenChange={(o) => { if (!o) setEditSurvey(null); }}>
        <DialogContent data-testid="dialog-edit-survey">
          <DialogHeader><DialogTitle>Edit Survey</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Title</Label><Input value={editTitle} onChange={e => setEditTitle(e.target.value)} data-testid="input-edit-survey-title" /></div>
            <div><Label>Description</Label><Textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} data-testid="input-edit-survey-desc" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditSurvey(null)}>Cancel</Button>
            <Button onClick={() => editSurvey && surveyEditMutation.mutate({ id: editSurvey.id, title: editTitle.trim(), description: editDesc.trim() || null })} disabled={surveyEditMutation.isPending} data-testid="button-save-survey">
              {surveyEditMutation.isPending && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto" data-testid="dialog-create-survey">
          <DialogHeader><DialogTitle>Create Survey</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Title</Label><Input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Survey title" data-testid="input-survey-title" /></div>
            <div><Label>Description (optional)</Label><Textarea value={newDescription} onChange={e => setNewDescription(e.target.value)} placeholder="Brief description" data-testid="input-survey-description" /></div>
            <div>
              <Label>Questions</Label>
              <div className="space-y-3 mt-2">
                {newQuestions.map((q, i) => (
                  <Card key={i}>
                    <CardContent className="p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium">Q{i + 1}</span>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="sm" className="text-[10px] px-1" disabled={i === 0} onClick={() => moveQuestion(i, i - 1)}>Up</Button>
                          <Button variant="ghost" size="sm" className="text-[10px] px-1" disabled={i === newQuestions.length - 1} onClick={() => moveQuestion(i, i + 1)}>Down</Button>
                          {newQuestions.length > 1 && <Button variant="ghost" size="icon" onClick={() => setNewQuestions(newQuestions.filter((_, j) => j !== i))}><XCircle className="h-4 w-4" /></Button>}
                        </div>
                      </div>
                      <Input value={q.question} onChange={e => { const c = [...newQuestions]; c[i] = { ...c[i], question: e.target.value }; setNewQuestions(c); }} placeholder={`Question ${i + 1}`} data-testid={`input-survey-q-${i}`} />
                      <div className="flex items-center gap-2">
                        <Select value={q.questionType} onValueChange={val => { const c = [...newQuestions]; c[i] = { ...c[i], questionType: val, options: val === "text" || val === "rating" ? null : ["", ""] }; setNewQuestions(c); }}>
                          <SelectTrigger className="w-32" data-testid={`select-survey-q-type-${i}`}><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="text">Text</SelectItem>
                            <SelectItem value="single_choice">Single Choice</SelectItem>
                            <SelectItem value="multi_choice">Multi Choice</SelectItem>
                            <SelectItem value="rating">Rating</SelectItem>
                          </SelectContent>
                        </Select>
                        <div className="flex items-center gap-1.5 ml-auto">
                          <Label className="text-xs">Required</Label>
                          <Switch checked={q.isRequired} onCheckedChange={checked => { const c = [...newQuestions]; c[i] = { ...c[i], isRequired: checked }; setNewQuestions(c); }} />
                        </div>
                      </div>
                      {q.options && (
                        <div className="space-y-1">
                          {q.options.map((opt, oi) => (
                            <Input key={oi} value={opt} onChange={e => { const c = [...newQuestions]; const opts = [...(c[i].options || [])]; opts[oi] = e.target.value; c[i] = { ...c[i], options: opts }; setNewQuestions(c); }} placeholder={`Option ${oi + 1}`} className="text-xs" />
                          ))}
                          <Button variant="ghost" size="sm" onClick={() => { const c = [...newQuestions]; c[i] = { ...c[i], options: [...(c[i].options || []), ""] }; setNewQuestions(c); }}><Plus className="h-3 w-3 mr-1" /> Add Option</Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
                <Button variant="outline" size="sm" onClick={() => setNewQuestions([...newQuestions, { question: "", questionType: "text", options: null, isRequired: true }])} data-testid="button-add-survey-question"><Plus className="h-3 w-3 mr-1" /> Add Question</Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending} data-testid="button-submit-survey">
              {createMutation.isPending && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />} Create Survey
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewResponsesId} onOpenChange={() => setViewResponsesId(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto" data-testid="dialog-survey-responses">
          <DialogHeader><DialogTitle>Survey Responses</DialogTitle></DialogHeader>
          {responsesData ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{responsesData.responses.length} responses</p>
                {responsesData.responses.length > 0 && (
                  <Button variant="outline" size="sm" onClick={handleExportResponses} data-testid="button-export-responses"><Download className="h-3.5 w-3.5 mr-1" /> Export CSV</Button>
                )}
              </div>
              {responsesData.responses.length > 0 && responsesData.questions.length > 0 && (
                <Card>
                  <CardContent className="p-4">
                    <p className="text-xs font-medium mb-3">Response Summary</p>
                    {responsesData.questions.map(q => {
                      const answers = responsesData.responses.map(r => r.answers?.[q.id]).filter(a => a !== undefined);
                      if (q.questionType === "rating") {
                        const nums = answers.map(a => Number(a)).filter(n => !isNaN(n));
                        const avg = nums.length > 0 ? (nums.reduce((s, n) => s + n, 0) / nums.length).toFixed(1) : "—";
                        return (
                          <div key={q.id} className="mb-2">
                            <p className="text-xs text-muted-foreground">{q.question}</p>
                            <p className="text-sm font-medium">Avg: {avg} ({nums.length} ratings)</p>
                          </div>
                        );
                      }
                      if (q.questionType === "single_choice" || q.questionType === "multi_choice") {
                        const counts: Record<string, number> = {};
                        answers.forEach(a => {
                          const vals = Array.isArray(a) ? a : [String(a)];
                          vals.forEach(v => { counts[v] = (counts[v] || 0) + 1; });
                        });
                        return (
                          <div key={q.id} className="mb-2">
                            <p className="text-xs text-muted-foreground">{q.question}</p>
                            <div className="space-y-0.5 mt-1">
                              {Object.entries(counts).sort(([, a], [, b]) => b - a).map(([opt, cnt]) => (
                                <div key={opt} className="flex items-center gap-2 text-xs">
                                  <span className="flex-1">{opt}</span>
                                  <span className="font-medium">{cnt}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      }
                      return (
                        <div key={q.id} className="mb-2">
                          <p className="text-xs text-muted-foreground">{q.question}</p>
                          <p className="text-xs">{answers.length} text responses</p>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              )}
              {responsesData.responses.length === 0 ? (
                <p className="text-sm text-center py-4 text-muted-foreground">No responses yet.</p>
              ) : (
                <div className="divide-y">
                  {responsesData.responses.map((r) => (
                    <div key={r.id} className="py-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium">{r.displayName}</span>
                        <span className="text-[10px] text-muted-foreground">{new Date(r.submittedAt).toLocaleString()}</span>
                      </div>
                      {responsesData.questions.map((q) => (
                        <div key={q.id} className="ml-2">
                          <p className="text-xs text-muted-foreground">{q.question}</p>
                          <p className="text-sm">{r.answers?.[q.id] !== undefined ? (Array.isArray(r.answers[q.id]) ? (r.answers[q.id] as string[]).join(", ") : String(r.answers[q.id])) : "—"}</p>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2"><Skeleton className="h-8 w-full" /><Skeleton className="h-20 w-full" /></div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface HardestQuestion {
  quizTitle: string;
  question: string;
  total: number;
  wrong: number;
  wrongPercent: number;
}

function HardestQuestionsCard({ cityId }: { cityId: string }) {
  const { data: questions, isLoading } = useQuery<HardestQuestion[]>({
    queryKey: ["/api/admin/community/quizzes/hardest-questions", cityId],
    queryFn: async () => {
      const resp = await fetch(`/api/admin/community/quizzes/hardest-questions?cityId=${cityId}`);
      if (!resp.ok) throw new Error("Failed");
      return resp.json();
    },
    enabled: !!cityId,
  });

  if (isLoading) return <Skeleton className="h-32" />;
  if (!questions || questions.length === 0) return null;

  return (
    <Card data-testid="card-hardest-questions">
      <CardContent className="p-4">
        <p className="text-xs font-medium mb-3">Hardest Questions (Highest Wrong Answer Rate)</p>
        <div className="space-y-2">
          {questions.map((q, i) => (
            <div key={i} className="flex items-start gap-3 py-1.5 border-b last:border-0">
              <Badge variant="outline" className="text-[10px] shrink-0 mt-0.5">{q.wrongPercent}%</Badge>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium truncate">{q.question}</p>
                <p className="text-[10px] text-muted-foreground">{q.quizTitle} · {q.wrong}/{q.total} answered wrong</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function QuizzesTab({ cityId }: { cityId: string }) {
  const { toast } = useToast();
  const [showCreate, setShowCreate] = useState(false);
  const [editQuiz, setEditQuiz] = useState<AdminQuiz | null>(null);
  const [editQuizTitle, setEditQuizTitle] = useState("");
  const [editQuizDesc, setEditQuizDesc] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [newQuestions, setNewQuestions] = useState<Array<{ question: string; options: string[]; correctIndex: number; explanation: string }>>([
    { question: "", options: ["", "", "", ""], correctIndex: 0, explanation: "" },
  ]);

  const { data: quizzes, isLoading } = useQuery<AdminQuiz[]>({
    queryKey: ["/api/admin/community/quizzes", cityId, dateFrom, dateTo],
    queryFn: async () => {
      const resp = await fetch(`/api/admin/community/quizzes${buildFilterParams(cityId, "", dateFrom, dateTo)}`);
      if (!resp.ok) throw new Error("Failed");
      return resp.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: { cityId: string; title: string; description: string | null; questions: Array<{ question: string; options: string[]; correctIndex: number; explanation: string | null }> }) => {
      const resp = await apiRequest("POST", "/api/admin/community/quizzes", data);
      return resp.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/community/quizzes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/community/engagement-summary"] });
      toast({ title: "Quiz created" });
      setShowCreate(false);
      setNewTitle("");
      setNewDescription("");
      setNewQuestions([{ question: "", options: ["", "", "", ""], correctIndex: 0, explanation: "" }]);
    },
    onError: (err: Error) => toast({ title: "Failed to create quiz", description: err.message, variant: "destructive" }),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const resp = await apiRequest("PATCH", `/api/admin/community/quizzes/${id}`, { isActive });
      return resp.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/admin/community/quizzes"] }); toast({ title: "Quiz updated" }); },
  });

  const quizEditMutation = useMutation({
    mutationFn: async ({ id, title, description }: { id: string; title: string; description: string | null }) => {
      const resp = await apiRequest("PATCH", `/api/admin/community/quizzes/${id}`, { title, description });
      return resp.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/community/quizzes"] });
      toast({ title: "Quiz updated" });
      setEditQuiz(null);
    },
    onError: (err: Error) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });

  const openEditQuiz = (q: AdminQuiz) => {
    setEditQuiz(q);
    setEditQuizTitle(q.title);
    setEditQuizDesc(q.description || "");
  };

  const handleCreate = () => {
    const validQs = newQuestions.filter(q => q.question.trim() && q.options.filter(o => o.trim()).length >= 2);
    if (!newTitle.trim() || validQs.length === 0) { toast({ title: "Provide a title and at least one question with 2+ options", variant: "destructive" }); return; }
    createMutation.mutate({
      cityId, title: newTitle.trim(), description: newDescription.trim() || null,
      questions: validQs.map(q => {
        const filteredOptions = q.options.map((o, i) => ({ label: o.trim(), origIdx: i })).filter(o => o.label);
        const remappedCorrectIndex = filteredOptions.findIndex(o => o.origIdx === q.correctIndex);
        return { question: q.question.trim(), options: filteredOptions.map(o => o.label), correctIndex: remappedCorrectIndex >= 0 ? remappedCorrectIndex : 0, explanation: q.explanation.trim() || null };
      }),
    });
  };

  const handleExport = () => {
    if (!quizzes || quizzes.length === 0) return;
    const headers = ["Title", "Active", "Questions", "Attempts", "Avg Score %", "Created"];
    const rows = quizzes.map(q => [q.title, q.isActive ? "Yes" : "No", String(q.questionCount), String(q.attemptCount), String(q.avgScorePercent), new Date(q.createdAt).toLocaleDateString()]);
    downloadCsv("quizzes-export.csv", headers, rows);
  };

  if (isLoading) return <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20" />)}</div>;

  return (
    <div className="space-y-4" data-testid="quizzes-tab">
      <FilterBar zoneId="" setZoneId={() => {}} dateFrom={dateFrom} setDateFrom={setDateFrom} dateTo={dateTo} setDateTo={setDateTo} zones={[]} showZone={false} />
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-sm text-muted-foreground">{quizzes?.length || 0} quizzes</p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExport} disabled={!quizzes?.length} data-testid="button-export-quizzes"><Download className="h-3.5 w-3.5 mr-1" /> Export CSV</Button>
          <Button size="sm" onClick={() => setShowCreate(true)} data-testid="button-create-quiz"><Plus className="h-3.5 w-3.5 mr-1" /> New Quiz</Button>
        </div>
      </div>

      {quizzes?.map(quiz => (
        <Card key={quiz.id} data-testid={`card-quiz-${quiz.id}`}>
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <Badge variant={quiz.isActive ? "default" : "outline"} className="text-[10px] mb-1">{quiz.isActive ? "Active" : "Inactive"}</Badge>
                <p className="text-sm font-medium">{quiz.title}</p>
                {quiz.description && <p className="text-xs text-muted-foreground mt-0.5">{quiz.description}</p>}
                <p className="text-[11px] text-muted-foreground mt-2">{quiz.questionCount} questions · {quiz.attemptCount} attempts · Avg score: {quiz.avgScorePercent}%</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditQuiz(quiz)} data-testid={`button-edit-quiz-${quiz.id}`}><Pencil className="h-3.5 w-3.5" /></Button>
                <Switch checked={quiz.isActive} onCheckedChange={(checked) => toggleMutation.mutate({ id: quiz.id, isActive: checked })} data-testid={`switch-quiz-active-${quiz.id}`} />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
      {quizzes?.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No quizzes match the current filters.</p>}

      <HardestQuestionsCard cityId={cityId} />

      <Dialog open={!!editQuiz} onOpenChange={(o) => { if (!o) setEditQuiz(null); }}>
        <DialogContent data-testid="dialog-edit-quiz">
          <DialogHeader><DialogTitle>Edit Quiz</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Title</Label><Input value={editQuizTitle} onChange={e => setEditQuizTitle(e.target.value)} data-testid="input-edit-quiz-title" /></div>
            <div><Label>Description</Label><Textarea value={editQuizDesc} onChange={e => setEditQuizDesc(e.target.value)} data-testid="input-edit-quiz-desc" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditQuiz(null)}>Cancel</Button>
            <Button onClick={() => editQuiz && quizEditMutation.mutate({ id: editQuiz.id, title: editQuizTitle.trim(), description: editQuizDesc.trim() || null })} disabled={quizEditMutation.isPending} data-testid="button-save-quiz">
              {quizEditMutation.isPending && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto" data-testid="dialog-create-quiz">
          <DialogHeader><DialogTitle>Create Quiz</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Title</Label><Input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Quiz title" data-testid="input-quiz-title" /></div>
            <div><Label>Description (optional)</Label><Textarea value={newDescription} onChange={e => setNewDescription(e.target.value)} placeholder="Brief description" data-testid="input-quiz-description" /></div>
            <div>
              <Label>Questions</Label>
              <div className="space-y-3 mt-2">
                {newQuestions.map((q, i) => (
                  <Card key={i}>
                    <CardContent className="p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium">Question {i + 1}</span>
                        {newQuestions.length > 1 && <Button variant="ghost" size="icon" onClick={() => setNewQuestions(newQuestions.filter((_, j) => j !== i))}><XCircle className="h-4 w-4" /></Button>}
                      </div>
                      <Input value={q.question} onChange={e => { const c = [...newQuestions]; c[i] = { ...c[i], question: e.target.value }; setNewQuestions(c); }} placeholder="Question text" data-testid={`input-quiz-q-${i}`} />
                      {q.options.map((opt, oi) => (
                        <div key={oi} className="flex items-center gap-2">
                          <input type="radio" name={`quiz-q-${i}-correct`} checked={q.correctIndex === oi} onChange={() => { const c = [...newQuestions]; c[i] = { ...c[i], correctIndex: oi }; setNewQuestions(c); }} className="shrink-0" />
                          <Input value={opt} onChange={e => { const c = [...newQuestions]; const opts = [...c[i].options]; opts[oi] = e.target.value; c[i] = { ...c[i], options: opts }; setNewQuestions(c); }} placeholder={`Option ${oi + 1}`} className="text-xs" />
                        </div>
                      ))}
                      <Input value={q.explanation} onChange={e => { const c = [...newQuestions]; c[i] = { ...c[i], explanation: e.target.value }; setNewQuestions(c); }} placeholder="Explanation (shown after answering)" className="text-xs" />
                    </CardContent>
                  </Card>
                ))}
                <Button variant="outline" size="sm" onClick={() => setNewQuestions([...newQuestions, { question: "", options: ["", "", "", ""], correctIndex: 0, explanation: "" }])} data-testid="button-add-quiz-question"><Plus className="h-3 w-3 mr-1" /> Add Question</Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending} data-testid="button-submit-quiz">
              {createMutation.isPending && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />} Create Quiz
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function VotingTab({ cityId }: { cityId: string }) {
  const { toast } = useToast();
  const [showCreate, setShowCreate] = useState(false);
  const [editCampaign, setEditCampaign] = useState<AdminVotingCampaign | null>(null);
  const [editCampTitle, setEditCampTitle] = useState("");
  const [editCampDesc, setEditCampDesc] = useState("");
  const [editCampStartsAt, setEditCampStartsAt] = useState("");
  const [editCampEndsAt, setEditCampEndsAt] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [newStartsAt, setNewStartsAt] = useState("");
  const [newEndsAt, setNewEndsAt] = useState("");
  const [addCategoryFor, setAddCategoryFor] = useState<string | null>(null);
  const [newCatName, setNewCatName] = useState("");
  const [addNomineeFor, setAddNomineeFor] = useState<string | null>(null);
  const [newNomName, setNewNomName] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const { data: campaigns, isLoading } = useQuery<AdminVotingCampaign[]>({
    queryKey: ["/api/admin/community/voting-campaigns", cityId, dateFrom, dateTo],
    queryFn: async () => {
      const resp = await fetch(`/api/admin/community/voting-campaigns${buildFilterParams(cityId, "", dateFrom, dateTo)}`);
      if (!resp.ok) throw new Error("Failed");
      return resp.json();
    },
  });

  const { data: resultsData } = useQuery<CampaignResults>({
    queryKey: ["/api/admin/community/voting-campaigns", expandedId, "results"],
    queryFn: async () => {
      const resp = await fetch(`/api/admin/community/voting-campaigns/${expandedId}/results`);
      if (!resp.ok) throw new Error("Failed");
      return resp.json();
    },
    enabled: !!expandedId,
  });

  const createMutation = useMutation({
    mutationFn: async (data: { cityId: string; title: string; slug: string; description: string | null; startsAt?: string; endsAt?: string }) => {
      const resp = await apiRequest("POST", "/api/admin/community/voting-campaigns", data);
      return resp.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/community/voting-campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/community/engagement-summary"] });
      toast({ title: "Campaign created" });
      setShowCreate(false);
      setNewTitle(""); setNewDescription(""); setNewSlug(""); setNewStartsAt(""); setNewEndsAt("");
    },
    onError: (err: Error) => toast({ title: "Failed to create campaign", description: err.message, variant: "destructive" }),
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const resp = await apiRequest("PATCH", `/api/admin/community/voting-campaigns/${id}`, { status });
      return resp.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/admin/community/voting-campaigns"] }); toast({ title: "Campaign updated" }); },
  });

  const campaignEditMutation = useMutation({
    mutationFn: async ({ id, title, description, startsAt, endsAt }: { id: string; title: string; description: string | null; startsAt: string | null; endsAt: string | null }) => {
      const resp = await apiRequest("PATCH", `/api/admin/community/voting-campaigns/${id}`, { title, description, startsAt, endsAt });
      return resp.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/community/voting-campaigns"] });
      toast({ title: "Campaign updated" });
      setEditCampaign(null);
    },
    onError: (err: Error) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });

  const openEditCampaign = (c: AdminVotingCampaign) => {
    setEditCampaign(c);
    setEditCampTitle(c.title);
    setEditCampDesc(c.description || "");
    setEditCampStartsAt(c.startsAt ? new Date(c.startsAt).toISOString().slice(0, 16) : "");
    setEditCampEndsAt(c.endsAt ? new Date(c.endsAt).toISOString().slice(0, 16) : "");
  };

  const addCategoryMutation = useMutation({
    mutationFn: async ({ campaignId, name }: { campaignId: string; name: string }) => {
      const resp = await apiRequest("POST", `/api/admin/community/voting-campaigns/${campaignId}/categories`, { name });
      return resp.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/community/voting-campaigns", expandedId, "results"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/community/voting-campaigns"] });
      toast({ title: "Category added" });
      setAddCategoryFor(null); setNewCatName("");
    },
    onError: (err: Error) => toast({ title: "Failed to add category", description: err.message, variant: "destructive" }),
  });

  const addNomineeMutation = useMutation({
    mutationFn: async ({ categoryId, name }: { categoryId: string; name: string }) => {
      const resp = await apiRequest("POST", `/api/admin/community/voting-categories/${categoryId}/nominees`, { name });
      return resp.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/community/voting-campaigns", expandedId, "results"] });
      toast({ title: "Nominee added" });
      setAddNomineeFor(null); setNewNomName("");
    },
    onError: (err: Error) => toast({ title: "Failed to add nominee", description: err.message, variant: "destructive" }),
  });

  const STATUS_COLORS: Record<string, string> = {
    draft: "bg-muted text-muted-foreground",
    active: "bg-green-500/10 text-green-600 border-green-500/20",
    closed: "bg-red-500/10 text-red-600 border-red-500/20",
    archived: "bg-muted text-muted-foreground",
  };

  const handleExport = () => {
    if (!campaigns || campaigns.length === 0) return;
    const headers = ["Title", "Slug", "Status", "Categories", "Ballots", "Starts", "Ends", "Created"];
    const rows = campaigns.map(c => [c.title, c.slug, c.status, String(c.categoryCount), String(c.totalBallots), c.startsAt ? new Date(c.startsAt).toLocaleDateString() : "", c.endsAt ? new Date(c.endsAt).toLocaleDateString() : "", new Date(c.createdAt).toLocaleDateString()]);
    downloadCsv("voting-campaigns-export.csv", headers, rows);
  };

  const handleCreateSubmit = () => {
    if (!newTitle.trim() || !newSlug.trim()) return;
    const payload: { cityId: string; title: string; slug: string; description: string | null; startsAt?: string; endsAt?: string } = {
      cityId, title: newTitle.trim(), slug: newSlug.trim(), description: newDescription.trim() || null,
    };
    if (newStartsAt) payload.startsAt = new Date(newStartsAt).toISOString();
    if (newEndsAt) payload.endsAt = new Date(newEndsAt).toISOString();
    createMutation.mutate(payload);
  };

  if (isLoading) return <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20" />)}</div>;

  return (
    <div className="space-y-4" data-testid="voting-tab">
      <FilterBar zoneId="" setZoneId={() => {}} dateFrom={dateFrom} setDateFrom={setDateFrom} dateTo={dateTo} setDateTo={setDateTo} zones={[]} showZone={false} />
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-sm text-muted-foreground">{campaigns?.length || 0} campaigns</p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExport} disabled={!campaigns?.length} data-testid="button-export-campaigns"><Download className="h-3.5 w-3.5 mr-1" /> Export CSV</Button>
          <Button size="sm" onClick={() => setShowCreate(true)} data-testid="button-create-campaign"><Plus className="h-3.5 w-3.5 mr-1" /> New Campaign</Button>
        </div>
      </div>

      {campaigns?.map(campaign => {
        const winnerByCat: Record<string, VotingNominee | null> = {};
        if (expandedId === campaign.id && resultsData?.categories) {
          for (const cat of resultsData.categories) {
            if (cat.nominees && cat.nominees.length > 0) {
              const sorted = [...cat.nominees].sort((a, b) => b.voteCount - a.voteCount);
              winnerByCat[cat.id] = sorted[0].voteCount > 0 ? sorted[0] : null;
            }
          }
        }

        return (
          <Card key={campaign.id} data-testid={`card-campaign-${campaign.id}`}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <Badge variant="outline" className={`text-[10px] ${STATUS_COLORS[campaign.status] || ""}`}>{campaign.status}</Badge>
                  <p className="text-sm font-medium mt-1">{campaign.title}</p>
                  {campaign.description && <p className="text-xs text-muted-foreground mt-0.5">{campaign.description}</p>}
                  <p className="text-[11px] text-muted-foreground mt-2">
                    {campaign.categoryCount} categories · {campaign.totalBallots} ballots · Created {new Date(campaign.createdAt).toLocaleDateString()}
                    {campaign.startsAt && ` · Starts ${new Date(campaign.startsAt).toLocaleDateString()}`}
                    {campaign.endsAt && ` · Ends ${new Date(campaign.endsAt).toLocaleDateString()}`}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditCampaign(campaign)} data-testid={`button-edit-campaign-${campaign.id}`}><Pencil className="h-3.5 w-3.5" /></Button>
                  <Select value={campaign.status} onValueChange={(val) => statusMutation.mutate({ id: campaign.id, status: val })}>
                    <SelectTrigger className="w-24 text-xs" data-testid={`select-campaign-status-${campaign.id}`}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="closed">Closed</SelectItem>
                      <SelectItem value="archived">Archived</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="sm" onClick={() => setExpandedId(expandedId === campaign.id ? null : campaign.id)} data-testid={`button-view-results-${campaign.id}`}><Eye className="h-3.5 w-3.5 mr-1" /> Results</Button>
                </div>
              </div>

              {expandedId === campaign.id && resultsData && (
                <div className="mt-4 border-t pt-3 space-y-3">
                  {resultsData.categories?.map((cat) => {
                    const winner = winnerByCat[cat.id];
                    return (
                      <div key={cat.id}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <p className="text-xs font-medium">{cat.name}</p>
                            {campaign.status === "closed" && winner && (
                              <Badge variant="outline" className="text-[10px] bg-yellow-500/10 text-yellow-700 border-yellow-500/20">
                                Winner: {winner.name}
                              </Badge>
                            )}
                          </div>
                          <Button variant="ghost" size="sm" className="text-[10px]" onClick={() => { setAddNomineeFor(cat.id); setNewNomName(""); }} data-testid={`button-add-nominee-${cat.id}`}><Plus className="h-3 w-3 mr-1" /> Nominee</Button>
                        </div>
                        <div className="space-y-1">
                          {cat.nominees?.map((nom, ni) => {
                            const maxVotes = Math.max(...(cat.nominees?.map(n => n.voteCount) || [1]), 1);
                            return (
                              <div key={nom.id} className="flex items-center gap-2">
                                <span className="text-[11px] text-muted-foreground w-5 shrink-0">#{ni + 1}</span>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs truncate">{nom.name}</span>
                                    <span className="text-[10px] font-medium">{nom.voteCount} votes</span>
                                  </div>
                                  <div className="w-full bg-muted rounded-full h-1.5 mt-0.5"><div className="bg-foreground/20 h-1.5 rounded-full" style={{ width: `${(nom.voteCount / maxVotes) * 100}%` }} /></div>
                                </div>
                              </div>
                            );
                          })}
                          {(!cat.nominees || cat.nominees.length === 0) && <p className="text-[11px] text-muted-foreground">No nominees added yet.</p>}
                        </div>
                      </div>
                    );
                  })}
                  {(!resultsData.categories || resultsData.categories.length === 0) && <p className="text-xs text-muted-foreground">No categories added yet.</p>}
                  <Button variant="outline" size="sm" onClick={() => { setAddCategoryFor(campaign.id); setNewCatName(""); }} data-testid={`button-add-category-${campaign.id}`}><Plus className="h-3 w-3 mr-1" /> Add Category</Button>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
      {campaigns?.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No voting campaigns match the current filters.</p>}

      <Dialog open={!!editCampaign} onOpenChange={(o) => { if (!o) setEditCampaign(null); }}>
        <DialogContent data-testid="dialog-edit-campaign">
          <DialogHeader><DialogTitle>Edit Campaign</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Title</Label><Input value={editCampTitle} onChange={e => setEditCampTitle(e.target.value)} data-testid="input-edit-campaign-title" /></div>
            <div><Label>Description</Label><Textarea value={editCampDesc} onChange={e => setEditCampDesc(e.target.value)} data-testid="input-edit-campaign-desc" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Starts At</Label><Input type="datetime-local" value={editCampStartsAt} onChange={e => setEditCampStartsAt(e.target.value)} data-testid="input-edit-campaign-starts" /></div>
              <div><Label>Ends At</Label><Input type="datetime-local" value={editCampEndsAt} onChange={e => setEditCampEndsAt(e.target.value)} data-testid="input-edit-campaign-ends" /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditCampaign(null)}>Cancel</Button>
            <Button onClick={() => editCampaign && campaignEditMutation.mutate({ id: editCampaign.id, title: editCampTitle.trim(), description: editCampDesc.trim() || null, startsAt: editCampStartsAt || null, endsAt: editCampEndsAt || null })} disabled={campaignEditMutation.isPending} data-testid="button-save-campaign">
              {campaignEditMutation.isPending && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent data-testid="dialog-create-campaign">
          <DialogHeader><DialogTitle>Create Voting Campaign</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Title</Label><Input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Best of Charlotte 2025" data-testid="input-campaign-title" /></div>
            <div><Label>Slug</Label><Input value={newSlug} onChange={e => setNewSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))} placeholder="best-of-charlotte-2025" data-testid="input-campaign-slug" /></div>
            <div><Label>Description (optional)</Label><Textarea value={newDescription} onChange={e => setNewDescription(e.target.value)} placeholder="Campaign description" data-testid="input-campaign-description" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Starts At (optional)</Label><Input type="datetime-local" value={newStartsAt} onChange={e => setNewStartsAt(e.target.value)} data-testid="input-campaign-starts" /></div>
              <div><Label>Ends At (optional)</Label><Input type="datetime-local" value={newEndsAt} onChange={e => setNewEndsAt(e.target.value)} data-testid="input-campaign-ends" /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={handleCreateSubmit} disabled={createMutation.isPending} data-testid="button-submit-campaign">
              {createMutation.isPending && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />} Create Campaign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!addCategoryFor} onOpenChange={() => setAddCategoryFor(null)}>
        <DialogContent data-testid="dialog-add-category">
          <DialogHeader><DialogTitle>Add Voting Category</DialogTitle></DialogHeader>
          <div><Label>Category Name</Label><Input value={newCatName} onChange={e => setNewCatName(e.target.value)} placeholder="Best Restaurant" data-testid="input-category-name" /></div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddCategoryFor(null)}>Cancel</Button>
            <Button onClick={() => { if (!newCatName.trim() || !addCategoryFor) return; addCategoryMutation.mutate({ campaignId: addCategoryFor, name: newCatName.trim() }); }} disabled={addCategoryMutation.isPending} data-testid="button-submit-category">
              {addCategoryMutation.isPending && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />} Add Category
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!addNomineeFor} onOpenChange={() => setAddNomineeFor(null)}>
        <DialogContent data-testid="dialog-add-nominee">
          <DialogHeader><DialogTitle>Add Nominee</DialogTitle></DialogHeader>
          <div><Label>Nominee Name</Label><Input value={newNomName} onChange={e => setNewNomName(e.target.value)} placeholder="Business or person name" data-testid="input-nominee-name" /></div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddNomineeFor(null)}>Cancel</Button>
            <Button onClick={() => { if (!newNomName.trim() || !addNomineeFor) return; addNomineeMutation.mutate({ categoryId: addNomineeFor, name: newNomName.trim() }); }} disabled={addNomineeMutation.isPending} data-testid="button-submit-nominee">
              {addNomineeMutation.isPending && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />} Add Nominee
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface BusinessReview {
  id: string;
  businessId: string;
  rating: number;
  comment: string | null;
  status: string;
  sourceType: string;
  createdAt: string;
  business?: { name: string } | null;
}

function ReviewsTab({ cityId, zones }: { cityId: string; zones: ZoneOption[] }) {
  const { toast } = useToast();
  const [reviewType, setReviewType] = useState<"neighborhood" | "business">("neighborhood");
  const [statusFilter, setStatusFilter] = useState("all");
  const [zoneId, setZoneId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const { data: reviews, isLoading } = useQuery<AdminReview[]>({
    queryKey: ["/api/admin/community/neighborhood-reviews", cityId, statusFilter, zoneId, dateFrom, dateTo],
    queryFn: async () => {
      let url = `/api/admin/community/neighborhood-reviews${buildFilterParams(cityId, zoneId, dateFrom, dateTo)}`;
      if (statusFilter !== "all") url += `&status=${statusFilter}`;
      const resp = await fetch(url);
      if (!resp.ok) throw new Error("Failed");
      return resp.json();
    },
  });

  const { data: businessReviews, isLoading: bizLoading } = useQuery<BusinessReview[]>({
    queryKey: ["/api/admin/reviews", statusFilter === "all" ? "PENDING" : statusFilter],
    queryFn: async () => {
      const resp = await fetch(`/api/admin/reviews?status=${statusFilter === "all" ? "PENDING" : statusFilter}`);
      if (!resp.ok) throw new Error("Failed");
      return resp.json();
    },
    enabled: reviewType === "business",
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const resp = await apiRequest("PATCH", `/api/admin/community/neighborhood-reviews/${id}/status`, { status });
      return resp.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/community/neighborhood-reviews"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/community/engagement-summary"] });
      toast({ title: "Review status updated" });
    },
    onError: (err: Error) => toast({ title: "Failed to update", description: err.message, variant: "destructive" }),
  });

  const bizStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const resp = await apiRequest("PATCH", `/api/admin/reviews/${id}/status`, { status });
      return resp.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/reviews"] });
      toast({ title: "Business review status updated" });
    },
    onError: (err: Error) => toast({ title: "Failed to update", description: err.message, variant: "destructive" }),
  });

  interface TrendPoint { month: string; avgRating: number; count: number }
  interface TopRatedNeighborhood { zoneId: string; zoneName: string; avgRating: number; reviewCount: number }
  interface TopRatedBusiness { businessId: string; businessName: string; avgRating: number; reviewCount: number }

  const { data: trendsData } = useQuery<{ neighborhoodTrends: TrendPoint[]; businessTrends: TrendPoint[] }>({
    queryKey: ["/api/admin/community/reviews/trends", cityId, dateFrom, dateTo],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (cityId) params.set("cityId", cityId);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      const resp = await fetch(`/api/admin/community/reviews/trends?${params}`);
      if (!resp.ok) throw new Error("Failed");
      return resp.json();
    },
  });

  const { data: topRatedData } = useQuery<{ topNeighborhoods: TopRatedNeighborhood[]; topBusinesses: TopRatedBusiness[] }>({
    queryKey: ["/api/admin/community/reviews/top-rated", cityId, dateFrom, dateTo],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (cityId) params.set("cityId", cityId);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      const resp = await fetch(`/api/admin/community/reviews/top-rated?${params}`);
      if (!resp.ok) throw new Error("Failed");
      return resp.json();
    },
  });

  const STATUS_BADGE: Record<string, string> = {
    PENDING: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
    APPROVED: "bg-green-500/10 text-green-600 border-green-500/20",
    REJECTED: "bg-red-500/10 text-red-600 border-red-500/20",
  };

  const handleExport = () => {
    if (!reviews || reviews.length === 0) return;
    const headers = ["Reviewer", "Neighborhood", "Rating", "Comment", "Pros", "Cons", "Status", "Date"];
    const rows = reviews.map(r => [r.displayName, r.zoneName || "", String(r.rating), r.comment || "", (r.pros || []).join("; "), (r.cons || []).join("; "), r.status, new Date(r.createdAt).toLocaleDateString()]);
    downloadCsv("neighborhood-reviews-export.csv", headers, rows);
  };

  if (isLoading) return <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20" />)}</div>;

  const pendingCount = reviews?.filter(r => r.status === "PENDING").length || 0;
  const approvedReviews = reviews?.filter(r => r.status === "APPROVED") || [];
  const avgRating = approvedReviews.length > 0 ? (approvedReviews.reduce((s, r) => s + r.rating, 0) / approvedReviews.length).toFixed(1) : "—";
  const zoneStats: Record<string, { name: string; count: number; totalRating: number }> = {};
  for (const r of (reviews || [])) {
    if (r.status !== "APPROVED") continue;
    if (!zoneStats[r.zoneId]) zoneStats[r.zoneId] = { name: r.zoneName || "Unknown", count: 0, totalRating: 0 };
    zoneStats[r.zoneId].count += 1;
    zoneStats[r.zoneId].totalRating += r.rating;
  }
  const zoneStatsList = Object.entries(zoneStats).sort(([, a], [, b]) => b.count - a.count).slice(0, 5);

  return (
    <div className="space-y-4" data-testid="reviews-tab">
      <div className="flex gap-2">
        <Button variant={reviewType === "neighborhood" ? "default" : "outline"} size="sm" onClick={() => setReviewType("neighborhood")} data-testid="button-review-type-neighborhood">Neighborhood Reviews</Button>
        <Button variant={reviewType === "business" ? "default" : "outline"} size="sm" onClick={() => setReviewType("business")} data-testid="button-review-type-business">Business Reviews</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {trendsData && (trendsData.neighborhoodTrends.length > 0 || trendsData.businessTrends.length > 0) && (
          <Card data-testid="card-review-trends">
            <CardContent className="p-4">
              <p className="text-xs font-medium mb-3">Rating Trends Over Time</p>
              <div className="space-y-2">
                {trendsData.neighborhoodTrends.length > 0 && (
                  <div>
                    <p className="text-[10px] text-muted-foreground mb-1">Neighborhood</p>
                    <div className="flex flex-wrap gap-2">
                      {trendsData.neighborhoodTrends.map(t => (
                        <div key={t.month} className="text-center border rounded px-2 py-1">
                          <p className="text-[10px] text-muted-foreground">{t.month}</p>
                          <div className="flex items-center gap-0.5">
                            <Star className="h-2.5 w-2.5 fill-yellow-400 text-yellow-400" />
                            <span className="text-xs font-medium">{t.avgRating}</span>
                          </div>
                          <p className="text-[10px] text-muted-foreground">{t.count} reviews</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {trendsData.businessTrends.length > 0 && (
                  <div>
                    <p className="text-[10px] text-muted-foreground mb-1">Business</p>
                    <div className="flex flex-wrap gap-2">
                      {trendsData.businessTrends.map(t => (
                        <div key={t.month} className="text-center border rounded px-2 py-1">
                          <p className="text-[10px] text-muted-foreground">{t.month}</p>
                          <div className="flex items-center gap-0.5">
                            <Star className="h-2.5 w-2.5 fill-yellow-400 text-yellow-400" />
                            <span className="text-xs font-medium">{t.avgRating}</span>
                          </div>
                          <p className="text-[10px] text-muted-foreground">{t.count} reviews</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
        {topRatedData && (topRatedData.topNeighborhoods.length > 0 || topRatedData.topBusinesses.length > 0) && (
          <Card data-testid="card-top-rated">
            <CardContent className="p-4">
              <p className="text-xs font-medium mb-3">Top Rated by Period</p>
              {topRatedData.topNeighborhoods.length > 0 && (
                <div className="mb-3">
                  <p className="text-[10px] text-muted-foreground mb-1">Top Neighborhoods</p>
                  <div className="space-y-1">
                    {topRatedData.topNeighborhoods.slice(0, 5).map((n, i) => (
                      <div key={n.zoneId} className="flex items-center justify-between text-xs">
                        <span>{i + 1}. {n.zoneName || "Unknown"}</span>
                        <span className="font-medium flex items-center gap-0.5"><Star className="h-2.5 w-2.5 fill-yellow-400 text-yellow-400" />{n.avgRating} ({n.reviewCount})</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {topRatedData.topBusinesses.length > 0 && (
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">Top Businesses</p>
                  <div className="space-y-1">
                    {topRatedData.topBusinesses.slice(0, 5).map((b, i) => (
                      <div key={b.businessId} className="flex items-center justify-between text-xs">
                        <span>{i + 1}. {b.businessName || "Unknown"}</span>
                        <span className="font-medium flex items-center gap-0.5"><Star className="h-2.5 w-2.5 fill-yellow-400 text-yellow-400" />{b.avgRating} ({b.reviewCount})</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {reviewType === "business" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="text-sm text-muted-foreground">{businessReviews?.length || 0} business reviews</p>
            <Select value={statusFilter === "all" ? "PENDING" : statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-32 text-xs" data-testid="select-biz-review-status"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="APPROVED">Approved</SelectItem>
                <SelectItem value="REJECTED">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {bizLoading && <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20" />)}</div>}
          {businessReviews?.map(br => (
            <Card key={br.id} data-testid={`card-biz-review-${br.id}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className={`text-[10px] ${STATUS_BADGE[br.status] || ""}`}>{br.status}</Badge>
                      <div className="flex items-center gap-0.5">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star key={i} className={`h-3 w-3 ${i < br.rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"}`} />
                        ))}
                      </div>
                      <Badge variant="outline" className="text-[10px]">{br.sourceType}</Badge>
                    </div>
                    <p className="text-xs font-medium">{br.business?.name || br.businessId}</p>
                    {br.comment && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{br.comment}</p>}
                    <p className="text-[10px] text-muted-foreground mt-1">{new Date(br.createdAt).toLocaleDateString()}</p>
                  </div>
                  {br.status === "PENDING" && (
                    <div className="flex gap-1 shrink-0">
                      <Button size="sm" variant="outline" onClick={() => bizStatusMutation.mutate({ id: br.id, status: "APPROVED" })} data-testid={`button-approve-biz-review-${br.id}`}><CheckCircle className="h-3.5 w-3.5 text-green-600" /></Button>
                      <Button size="sm" variant="outline" onClick={() => bizStatusMutation.mutate({ id: br.id, status: "REJECTED" })} data-testid={`button-reject-biz-review-${br.id}`}><XCircle className="h-3.5 w-3.5 text-red-600" /></Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
          {!bizLoading && (!businessReviews || businessReviews.length === 0) && <p className="text-sm text-muted-foreground text-center py-8">No business reviews with this status.</p>}
        </div>
      )}

      {reviewType === "neighborhood" && (
      <div className="space-y-4">
      <FilterBar zoneId={zoneId} setZoneId={setZoneId} dateFrom={dateFrom} setDateFrom={setDateFrom} dateTo={dateTo} setDateTo={setDateTo} zones={zones} />

      {zoneStatsList.length > 0 && (
        <Card data-testid="card-review-analytics">
          <CardContent className="p-4">
            <p className="text-xs font-medium mb-3">Neighborhood Review Analytics (Approved)</p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1">
              <div className="mb-2">
                <span className="text-xs text-muted-foreground">Overall Average</span>
                <div className="flex items-center gap-1.5">
                  <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                  <span className="text-sm font-bold">{avgRating}</span>
                  <span className="text-[11px] text-muted-foreground">({approvedReviews.length} approved)</span>
                </div>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Pending Moderation</span>
                <p className="text-sm font-bold">{pendingCount}</p>
              </div>
              {zoneStatsList.map(([zId, stat]) => (
                <div key={zId} className="flex items-center justify-between text-xs py-0.5">
                  <span>{stat.name}</span>
                  <span className="font-medium">{(stat.totalRating / stat.count).toFixed(1)} avg · {stat.count} reviews</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-3">
          <p className="text-sm text-muted-foreground">{reviews?.length || 0} reviews</p>
          {pendingCount > 0 && <Badge variant="outline" className="text-[10px] bg-yellow-500/10 text-yellow-600 border-yellow-500/20">{pendingCount} pending</Badge>}
        </div>
        <div className="flex gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-32 text-xs" data-testid="select-review-status-filter"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="PENDING">Pending</SelectItem>
              <SelectItem value="APPROVED">Approved</SelectItem>
              <SelectItem value="REJECTED">Rejected</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={handleExport} disabled={!reviews?.length} data-testid="button-export-reviews"><Download className="h-3.5 w-3.5 mr-1" /> Export CSV</Button>
        </div>
      </div>

      {reviews?.map(review => (
        <Card key={review.id} data-testid={`card-review-${review.id}`}>
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="outline" className={`text-[10px] ${STATUS_BADGE[review.status] || ""}`}>{review.status}</Badge>
                  <div className="flex items-center gap-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className={`h-3 w-3 ${i < review.rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"}`} />
                    ))}
                  </div>
                </div>
                <p className="text-xs font-medium">{review.displayName} · {review.zoneName || "Unknown zone"}</p>
                {review.comment && <p className="text-sm mt-1">{review.comment}</p>}
                {review.pros && review.pros.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {review.pros.map((p, i) => <Badge key={i} variant="outline" className="text-[10px] bg-green-500/5 text-green-600 border-green-500/20">{p}</Badge>)}
                  </div>
                )}
                {review.cons && review.cons.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {review.cons.map((c, i) => <Badge key={i} variant="outline" className="text-[10px] bg-red-500/5 text-red-600 border-red-500/20">{c}</Badge>)}
                  </div>
                )}
                <p className="text-[11px] text-muted-foreground mt-2">{new Date(review.createdAt).toLocaleString()}</p>
              </div>
              {review.status === "PENDING" && (
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="outline" size="sm" onClick={() => statusMutation.mutate({ id: review.id, status: "APPROVED" })} data-testid={`button-approve-review-${review.id}`}><CheckCircle className="h-3.5 w-3.5 mr-1" /> Approve</Button>
                  <Button variant="outline" size="sm" onClick={() => statusMutation.mutate({ id: review.id, status: "REJECTED" })} data-testid={`button-reject-review-${review.id}`}><XCircle className="h-3.5 w-3.5 mr-1" /> Reject</Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
      {reviews?.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No reviews match the current filters.</p>}
      </div>
      )}
    </div>
  );
}

function ReactionsTab({ cityId }: { cityId: string }) {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const { data: analytics, isLoading } = useQuery<ReactionsAnalytics>({
    queryKey: ["/api/admin/community/reactions", cityId, dateFrom, dateTo],
    queryFn: async () => {
      const resp = await fetch(`/api/admin/community/reactions${buildFilterParams(cityId, "", dateFrom, dateTo)}`);
      if (!resp.ok) throw new Error("Failed");
      return resp.json();
    },
  });

  const REACTION_LABELS: Record<string, string> = { like: "Like", love: "Love", insightful: "Insightful", funny: "Funny", helpful: "Helpful" };
  const totalReactions = analytics ? Object.values(analytics.reactionsByType).reduce((s, v) => s + v, 0) : 0;

  const handleExport = () => {
    if (!analytics || analytics.recent.length === 0) return;
    const headers = ["User", "Reaction", "Content Type", "Content ID", "Date"];
    const rows = analytics.recent.map(r => [r.displayName, r.reactionType, r.entityType, r.entityId, new Date(r.createdAt).toLocaleString()]);
    downloadCsv("reactions-export.csv", headers, rows);
  };

  if (isLoading) return <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20" />)}</div>;
  if (!analytics) return <p className="text-sm text-muted-foreground p-4">No reaction data available.</p>;

  return (
    <div className="space-y-4" data-testid="reactions-tab">
      <FilterBar zoneId="" setZoneId={() => {}} dateFrom={dateFrom} setDateFrom={setDateFrom} dateTo={dateTo} setDateTo={setDateTo} zones={[]} showZone={false} />
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-sm text-muted-foreground">{totalReactions} total reactions</p>
        <Button variant="outline" size="sm" onClick={handleExport} disabled={!analytics.recent.length} data-testid="button-export-reactions"><Download className="h-3.5 w-3.5 mr-1" /> Export CSV</Button>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card data-testid="card-reactions-by-type">
          <CardContent className="p-4">
            <p className="text-xs font-medium mb-3">Reactions by Type</p>
            <div className="space-y-2">
              {Object.entries(analytics.reactionsByType).sort(([, a], [, b]) => b - a).map(([type, count]) => {
                const pct = totalReactions > 0 ? Math.round((count / totalReactions) * 100) : 0;
                return (
                  <div key={type} className="flex items-center gap-2">
                    <span className="text-xs w-20">{REACTION_LABELS[type] || type}</span>
                    <div className="flex-1 bg-muted rounded-full h-2"><div className="bg-foreground/20 h-2 rounded-full" style={{ width: `${pct}%` }} /></div>
                    <span className="text-xs font-medium w-16 text-right">{count} ({pct}%)</span>
                  </div>
                );
              })}
              {Object.keys(analytics.reactionsByType).length === 0 && <p className="text-xs text-muted-foreground">No reactions yet.</p>}
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-reactions-by-content">
          <CardContent className="p-4">
            <p className="text-xs font-medium mb-3">Reactions by Content Type</p>
            <div className="space-y-2">
              {Object.entries(analytics.reactionsByEntity).sort(([, a], [, b]) => b - a).map(([type, count]) => (
                <div key={type} className="flex items-center justify-between">
                  <span className="text-xs capitalize">{type.replace(/_/g, " ")}</span>
                  <span className="text-xs font-medium">{count}</span>
                </div>
              ))}
              {Object.keys(analytics.reactionsByEntity).length === 0 && <p className="text-xs text-muted-foreground">No reactions yet.</p>}
            </div>
          </CardContent>
        </Card>
      </div>

      {analytics.topReacted.length > 0 && (
        <Card data-testid="card-top-reacted">
          <CardContent className="p-4">
            <p className="text-xs font-medium mb-3">Top Reacted Content</p>
            <div className="divide-y">
              {analytics.topReacted.map((item, i) => (
                <div key={`${item.entityType}-${item.entityId}`} className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[11px] text-muted-foreground w-5">#{i + 1}</span>
                    <Badge variant="outline" className="text-[10px] capitalize">{item.entityType.replace(/_/g, " ")}</Badge>
                  </div>
                  <span className="text-xs font-medium">{item.count} reactions</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {analytics.recent.length > 0 && (
        <Card data-testid="card-recent-reactions">
          <CardContent className="p-4">
            <p className="text-xs font-medium mb-3">Recent Activity</p>
            <div className="divide-y">
              {analytics.recent.map(r => (
                <div key={r.id} className="flex items-center justify-between py-2">
                  <div className="min-w-0 flex-1">
                    <span className="text-xs font-medium">{r.displayName}</span>
                    <p className="text-[11px] text-muted-foreground">{REACTION_LABELS[r.reactionType] || r.reactionType} on {r.entityType.replace(/_/g, " ")}</p>
                  </div>
                  <span className="text-[10px] text-muted-foreground shrink-0">{new Date(r.createdAt).toLocaleDateString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function EngagementHub({ selectedCityId, initialTab = "overview" }: { selectedCityId?: string; initialTab?: string }) {
  const defaultCityId = useDefaultCityId();
  const cityId = selectedCityId || defaultCityId || "";

  const { data: summary, isLoading: summaryLoading } = useQuery<EngagementSummary>({
    queryKey: ["/api/admin/community/engagement-summary", cityId],
    queryFn: async () => {
      const resp = await fetch(`/api/admin/community/engagement-summary?cityId=${cityId}`);
      if (!resp.ok) throw new Error("Failed");
      return resp.json();
    },
    enabled: !!cityId,
  });

  const { data: zonesRaw } = useQuery<Array<{ id: string; name: string }>>({
    queryKey: ["/api/admin/zones"],
    queryFn: async () => {
      const resp = await fetch("/api/admin/zones");
      if (!resp.ok) throw new Error("Failed");
      return resp.json();
    },
  });

  const zones: ZoneOption[] = (zonesRaw || []).map(z => ({ id: z.id, name: z.name }));

  return (
    <div className="space-y-4 p-1" data-testid="engagement-hub">
      <div>
        <h2 className="text-lg font-semibold" data-testid="text-engagement-hub-title">Community Engagement Hub</h2>
        <p className="text-sm text-muted-foreground">Manage polls, surveys, quizzes, voting campaigns, neighborhood reviews, and content reactions</p>
      </div>

      <Tabs defaultValue={initialTab} className="w-full">
        <TabsList className="w-full justify-start flex-wrap h-auto gap-1 bg-transparent p-0" data-testid="engagement-tabs">
          <TabsTrigger value="overview" className="text-xs data-[state=active]:bg-muted" data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="polls" className="text-xs data-[state=active]:bg-muted" data-testid="tab-polls">Polls{summary ? ` (${summary.polls})` : ""}</TabsTrigger>
          <TabsTrigger value="surveys" className="text-xs data-[state=active]:bg-muted" data-testid="tab-surveys">Surveys{summary ? ` (${summary.surveys})` : ""}</TabsTrigger>
          <TabsTrigger value="quizzes" className="text-xs data-[state=active]:bg-muted" data-testid="tab-quizzes">Quizzes{summary ? ` (${summary.quizzes})` : ""}</TabsTrigger>
          <TabsTrigger value="voting" className="text-xs data-[state=active]:bg-muted" data-testid="tab-voting">Voting{summary ? ` (${summary.votingCampaigns})` : ""}</TabsTrigger>
          <TabsTrigger value="reviews" className="text-xs data-[state=active]:bg-muted" data-testid="tab-reviews">Reviews{summary ? ` (${summary.neighborhoodReviews})` : ""}</TabsTrigger>
          <TabsTrigger value="reactions" className="text-xs data-[state=active]:bg-muted" data-testid="tab-reactions">Reactions{summary ? ` (${summary.contentReactions})` : ""}</TabsTrigger>
        </TabsList>

        <div className="mt-4">
          <TabsContent value="overview" className="mt-0"><OverviewTab summary={summary} isLoading={summaryLoading} cityId={cityId} /></TabsContent>
          <TabsContent value="polls" className="mt-0">{cityId && <PollsTab cityId={cityId} zones={zones} />}</TabsContent>
          <TabsContent value="surveys" className="mt-0">{cityId && <SurveysTab cityId={cityId} />}</TabsContent>
          <TabsContent value="quizzes" className="mt-0">{cityId && <QuizzesTab cityId={cityId} />}</TabsContent>
          <TabsContent value="voting" className="mt-0">{cityId && <VotingTab cityId={cityId} />}</TabsContent>
          <TabsContent value="reviews" className="mt-0">{cityId && <ReviewsTab cityId={cityId} zones={zones} />}</TabsContent>
          <TabsContent value="reactions" className="mt-0">{cityId && <ReactionsTab cityId={cityId} />}</TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
