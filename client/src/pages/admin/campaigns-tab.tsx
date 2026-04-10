import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Megaphone, Plus, Trash2, BarChart3, MessageSquare, ChevronDown, ChevronRight } from "lucide-react";

function CreateCampaignDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [cityId, setCityId] = useState<string>("");
  const { toast } = useToast();

  const { data: cities } = useQuery<any[]>({ queryKey: ["/api/cities"] });

  const createMutation = useMutation({
    mutationFn: async () => {
      const body: any = { title, description };
      if (startDate) body.startDate = startDate;
      if (endDate) body.endDate = endDate;
      if (cityId) body.cityId = cityId;
      await apiRequest("POST", "/api/admin/intelligence/campaigns", body);
    },
    onSuccess: () => {
      toast({ title: "Campaign created" });
      setOpen(false);
      setTitle("");
      setDescription("");
      setStartDate("");
      setEndDate("");
      setCityId("");
      onCreated();
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button data-testid="btn-create-campaign">
          <Plus className="w-4 h-4 mr-1" /> New Campaign
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create Campaign</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Input
            placeholder="Campaign title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            data-testid="input-campaign-title"
          />
          <Input
            placeholder="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            data-testid="input-campaign-description"
          />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Start Date</label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                data-testid="input-campaign-start"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">End Date</label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                data-testid="input-campaign-end"
              />
            </div>
          </div>
          <Select value={cityId} onValueChange={setCityId}>
            <SelectTrigger data-testid="select-campaign-city">
              <SelectValue placeholder="Select city" />
            </SelectTrigger>
            <SelectContent>
              {cities?.map((c: any) => (
                <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            className="w-full"
            onClick={() => createMutation.mutate()}
            disabled={createMutation.isPending || !title.trim()}
            data-testid="btn-submit-campaign"
          >
            {createMutation.isPending ? "Creating..." : "Create Campaign"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CampaignCard({ campaign }: { campaign: any }) {
  const [expanded, setExpanded] = useState(false);
  const { toast } = useToast();

  const toggleMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("PATCH", `/api/admin/intelligence/campaigns/${campaign.id}`, {
        isActive: !campaign.isActive,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/intelligence/campaigns"] });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  return (
    <Card data-testid={`card-campaign-${campaign.id}`}>
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setExpanded(!expanded)}
            data-testid={`btn-expand-campaign-${campaign.id}`}
          >
            {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </Button>
          <div className="min-w-0 flex-1">
            <CardTitle className="text-sm font-medium truncate">{campaign.title}</CardTitle>
            <div className="flex items-center gap-2 flex-wrap mt-1">
              {campaign.startDate && (
                <span className="text-xs text-muted-foreground">
                  {campaign.startDate} - {campaign.endDate || "ongoing"}
                </span>
              )}
              <Badge variant="secondary" className="text-xs">
                <MessageSquare className="w-3 h-3 mr-1" />
                {campaign.responseCount ?? 0} responses
              </Badge>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={campaign.isActive ? "default" : "secondary"}>
            {campaign.isActive ? "Active" : "Inactive"}
          </Badge>
          <Switch
            checked={!!campaign.isActive}
            onCheckedChange={() => toggleMutation.mutate()}
            data-testid={`switch-campaign-${campaign.id}`}
          />
        </div>
      </CardHeader>
      {expanded && (
        <CardContent className="pt-0">
          {campaign.description && (
            <p className="text-sm text-muted-foreground mb-4">{campaign.description}</p>
          )}
          <QuestionsSection campaignId={campaign.id} />
          <ResponsesSection campaignId={campaign.id} />
        </CardContent>
      )}
    </Card>
  );
}

function QuestionsSection({ campaignId }: { campaignId: number }) {
  const [questionText, setQuestionText] = useState("");
  const [questionType, setQuestionType] = useState("FREE_TEXT");
  const [optionsJson, setOptionsJson] = useState("");
  const { toast } = useToast();

  const { data: questions, isLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/intelligence/campaigns", campaignId, "questions"],
    queryFn: async () => {
      const res = await fetch(`/api/admin/intelligence/campaigns/${campaignId}/questions`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch questions");
      return res.json();
    },
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      const body: any = { questionText, questionType };
      if (questionType === "MULTIPLE_CHOICE" && optionsJson.trim()) {
        body.optionsJson = optionsJson;
      }
      await apiRequest("POST", `/api/admin/intelligence/campaigns/${campaignId}/questions`, body);
    },
    onSuccess: () => {
      setQuestionText("");
      setOptionsJson("");
      queryClient.invalidateQueries({ queryKey: ["/api/admin/intelligence/campaigns", campaignId, "questions"] });
      toast({ title: "Question added" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (qid: number) => {
      await apiRequest("DELETE", `/api/admin/intelligence/campaigns/${campaignId}/questions/${qid}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/intelligence/campaigns", campaignId, "questions"] });
      toast({ title: "Question removed" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-3 mb-4">
      <h4 className="text-sm font-medium flex items-center gap-1">
        <MessageSquare className="w-4 h-4" /> Questions
      </h4>

      {isLoading ? (
        <p className="text-xs text-muted-foreground">Loading...</p>
      ) : (
        <div className="space-y-2">
          {(questions || []).map((q: any) => (
            <div
              key={q.id}
              className="flex items-center justify-between gap-2 p-2 rounded-lg bg-muted/50"
              data-testid={`question-${q.id}`}
            >
              <div className="flex-1 min-w-0">
                <span className="text-sm">{q.questionText}</span>
                <Badge variant="secondary" className="ml-2 text-xs">{q.questionType}</Badge>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => deleteMutation.mutate(q.id)}
                disabled={deleteMutation.isPending}
                data-testid={`btn-delete-question-${q.id}`}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
          {(!questions || questions.length === 0) && (
            <p className="text-xs text-muted-foreground">No questions yet.</p>
          )}
        </div>
      )}

      <div className="flex items-end gap-2 flex-wrap">
        <div className="flex-1 min-w-[200px]">
          <Input
            placeholder="Question text..."
            value={questionText}
            onChange={(e) => setQuestionText(e.target.value)}
            data-testid="input-question-text"
          />
        </div>
        <Select value={questionType} onValueChange={setQuestionType}>
          <SelectTrigger className="w-[160px]" data-testid="select-question-type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="FREE_TEXT">Free Text</SelectItem>
            <SelectItem value="MULTIPLE_CHOICE">Multiple Choice</SelectItem>
            <SelectItem value="SCALE">Scale</SelectItem>
          </SelectContent>
        </Select>
        <Button
          size="sm"
          onClick={() => addMutation.mutate()}
          disabled={addMutation.isPending || !questionText.trim()}
          data-testid="btn-add-question"
        >
          <Plus className="w-4 h-4 mr-1" /> Add
        </Button>
      </div>

      {questionType === "MULTIPLE_CHOICE" && (
        <Input
          placeholder='Options JSON, e.g. ["Option A","Option B","Option C"]'
          value={optionsJson}
          onChange={(e) => setOptionsJson(e.target.value)}
          data-testid="input-options-json"
        />
      )}
    </div>
  );
}

function ResponsesSection({ campaignId }: { campaignId: number }) {
  const [showResponses, setShowResponses] = useState(false);

  const { data: responses, isLoading } = useQuery<any>({
    queryKey: ["/api/admin/intelligence/campaigns", campaignId, "responses"],
    queryFn: async () => {
      const res = await fetch(`/api/admin/intelligence/campaigns/${campaignId}/responses`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch responses");
      return res.json();
    },
    enabled: showResponses,
  });

  return (
    <div className="space-y-2">
      <Button
        variant="outline"
        size="sm"
        onClick={() => setShowResponses(!showResponses)}
        data-testid={`btn-view-responses-${campaignId}`}
      >
        <BarChart3 className="w-4 h-4 mr-1" />
        {showResponses ? "Hide" : "View"} Responses
      </Button>

      {showResponses && (
        <div className="mt-2">
          {isLoading ? (
            <p className="text-xs text-muted-foreground">Loading responses...</p>
          ) : !responses || (Array.isArray(responses) && responses.length === 0) ? (
            <p className="text-xs text-muted-foreground">No responses yet.</p>
          ) : (
            <div className="space-y-3">
              {responses.totalResponders !== undefined && (
                <p className="text-xs text-muted-foreground">Total unique respondents: {responses.totalResponders}</p>
              )}
              {(responses.questions || []).map((r: any, i: number) => (
                <Card key={i} className="p-3" data-testid={`response-aggregate-${i}`}>
                  <p className="text-sm font-medium mb-2">{r.question}</p>
                  {r.type === "MULTIPLE_CHOICE" && r.optionCounts && (
                    <div className="space-y-1">
                      {Object.entries(r.optionCounts).map(([answer, count]: [string, any]) => (
                        <div key={answer} className="flex items-center justify-between text-xs">
                          <span>{answer}</span>
                          <Badge variant="secondary">{count}</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                  {r.type === "SCALE" && r.average !== undefined && (
                    <p className="text-sm">Average: <strong>{r.average}</strong> / 5</p>
                  )}
                  {r.type === "FREE_TEXT" && r.responses?.length > 0 && (
                    <div className="space-y-1">
                      {r.responses.map((text: string, j: number) => (
                        <p key={j} className="text-xs bg-muted p-1 rounded">{text}</p>
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">Total: {r.total}</p>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function CampaignsTab({ cityId }: { cityId?: string }) {
  const { data: campaigns, isLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/intelligence/campaigns", cityId],
    queryFn: async () => {
      const p = new URLSearchParams();
      if (cityId) p.set("cityId", cityId);
      const res = await fetch(`/api/admin/intelligence/campaigns${p.toString() ? `?${p}` : ""}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch campaigns");
      return res.json();
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="text-lg font-medium flex items-center gap-2">
          <Megaphone className="w-5 h-5" /> Campaigns
        </h3>
        <CreateCampaignDialog
          onCreated={() => queryClient.invalidateQueries({ queryKey: ["/api/admin/intelligence/campaigns"] })}
        />
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Loading campaigns...</div>
      ) : (!campaigns || campaigns.length === 0) ? (
        <div className="text-center py-12 text-muted-foreground">
          No campaigns yet. Create one to start collecting intelligence.
        </div>
      ) : (
        <div className="space-y-3">
          {campaigns.map((c: any) => (
            <CampaignCard key={c.id} campaign={c} />
          ))}
        </div>
      )}
    </div>
  );
}