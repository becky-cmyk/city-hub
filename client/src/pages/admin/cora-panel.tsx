import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  Send, Brain, FileText, Mail, Palette, Lightbulb, HelpCircle,
  CheckCircle, XCircle, Copy, Archive, RotateCcw, Eye, Clock,
  ChevronRight, Sparkles, Edit, AlertTriangle, BookCheck, Pencil,
  Save, X, Upload, Replace, Mic, MicOff,
} from "lucide-react";

interface ChatMessage {
  role: "user" | "cora";
  content: string;
  data?: Record<string, unknown>;
  timestamp: Date;
}

const HAT_COLORS: Record<string, string> = {
  admin: "bg-zinc-700 text-white",
  cmo: "bg-amber-600 text-white",
  cfo: "bg-emerald-700 text-white",
  cto: "bg-blue-700 text-white",
  builder: "bg-violet-700 text-white",
  debugger: "bg-red-700 text-white",
  operator: "bg-cyan-700 text-white",
  editor: "bg-pink-700 text-white",
};

function HatBadge({ hat, submode }: { hat: string; submode?: string }) {
  return (
    <Badge data-testid={`badge-hat-${hat}`} className={`${HAT_COLORS[hat] || "bg-zinc-600 text-white"} text-xs`}>
      {hat}{submode ? ` / ${submode}` : ""}
    </Badge>
  );
}

function ApprovalIndicator() {
  return (
    <div data-testid="indicator-approval-required" className="flex items-center gap-1 text-amber-500 text-xs font-medium">
      <AlertTriangle className="w-3 h-3" />
      Approval Required
    </div>
  );
}

function PlanCard({ plan, onApprove, onReject, onModify, onBuild }: {
  plan: Record<string, unknown>;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onModify: (id: string) => void;
  onBuild: (id: string) => void;
}) {
  const planJson = plan.planJson as Record<string, unknown> | null;
  const status = plan.status as string;

  return (
    <Card data-testid={`card-plan-${plan.id}`} className="border-violet-500/30">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">{plan.title as string}</CardTitle>
          <div className="flex items-center gap-2">
            {status === "draft" && <ApprovalIndicator />}
            <Badge variant={status === "approved" ? "default" : status === "rejected" ? "destructive" : "secondary"}>
              {status}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {planJson && (
          <div className="text-sm space-y-1">
            <div><span className="font-medium">Goal:</span> {planJson.goal as string}</div>
            {Array.isArray(planJson.steps) && (
              <div>
                <span className="font-medium">Steps:</span>
                <ul className="list-disc ml-4 mt-1">
                  {(planJson.steps as string[]).map((s, i) => <li key={i}>{s}</li>)}
                </ul>
              </div>
            )}
            <div><span className="font-medium">Impact:</span> {planJson.impact as string}</div>
            <div><span className="font-medium">Risks:</span> {planJson.risks as string}</div>
            <div><span className="font-medium">Confidence:</span> {planJson.confidence as string}</div>
          </div>
        )}
        <div className="flex gap-2 pt-2">
          {status === "draft" && (
            <>
              <Button data-testid={`button-approve-plan-${plan.id}`} size="sm" onClick={() => onApprove(plan.id as string)}>
                <CheckCircle className="w-3 h-3 mr-1" /> Approve
              </Button>
              <Button data-testid={`button-modify-plan-${plan.id}`} size="sm" variant="outline" onClick={() => onModify(plan.id as string)}>
                <Pencil className="w-3 h-3 mr-1" /> Modify
              </Button>
              <Button data-testid={`button-reject-plan-${plan.id}`} size="sm" variant="destructive" onClick={() => onReject(plan.id as string)}>
                <XCircle className="w-3 h-3 mr-1" /> Reject
              </Button>
            </>
          )}
          {status === "approved" && (
            <Button data-testid={`button-build-plan-${plan.id}`} size="sm" onClick={() => onBuild(plan.id as string)}>
              <Sparkles className="w-3 h-3 mr-1" /> Build
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function BuildCard({ build, onRevert, onPreview, onMarkReady, isMarkedReady }: {
  build: Record<string, unknown>;
  onRevert: (id: string) => void;
  onPreview: (id: string) => void;
  onMarkReady: (id: string) => void;
  isMarkedReady?: boolean;
}) {
  const [showPrompt, setShowPrompt] = useState(false);
  const status = isMarkedReady ? "ready" : (build.status as string || "completed");

  return (
    <Card data-testid={`card-build-${build.id}`} className="border-blue-500/30">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">Build Log</CardTitle>
          <div className="flex gap-1">
            <Badge>{build.buildType as string}</Badge>
            {status && <Badge variant="secondary">{status}</Badge>}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="text-sm">
          <span className="font-medium">Changes:</span> {build.changesSummary as string}
        </div>
        {build.filesModified && Array.isArray(build.filesModified) && (
          <div className="text-sm">
            <span className="font-medium">Files modified:</span>
            <ul className="list-disc ml-4 mt-1 text-xs text-zinc-400">
              {(build.filesModified as string[]).map((f, i) => <li key={i}>{f}</li>)}
            </ul>
          </div>
        )}
        {build.replitPrompt && (
          <div>
            <Button data-testid={`button-toggle-prompt-${build.id}`} variant="outline" size="sm" onClick={() => setShowPrompt(!showPrompt)}>
              <Eye className="w-3 h-3 mr-1" /> {showPrompt ? "Hide" : "Show"} Replit Prompt
            </Button>
            {showPrompt && (
              <pre className="mt-2 p-2 bg-zinc-900 rounded text-xs overflow-auto max-h-40 text-zinc-300">
                {build.replitPrompt as string}
              </pre>
            )}
          </div>
        )}
        <div className="flex gap-2 pt-2">
          <Button data-testid={`button-preview-build-${build.id}`} size="sm" variant="outline" onClick={() => onPreview(build.id as string)}>
            <Eye className="w-3 h-3 mr-1" /> Preview
          </Button>
          <Button data-testid={`button-mark-ready-${build.id}`} size="sm" disabled={isMarkedReady} onClick={() => onMarkReady(build.id as string)}>
            <BookCheck className="w-3 h-3 mr-1" /> {isMarkedReady ? "Ready" : "Mark Ready"}
          </Button>
          <Button data-testid={`button-revert-build-${build.id}`} size="sm" variant="outline" onClick={() => onRevert(build.id as string)}>
            <RotateCcw className="w-3 h-3 mr-1" /> Revert
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function SourceSelectionCard({ sources, onApprove, onCancel, onReplace, onUseOwn }: {
  sources: Array<{ type: string; id: string; name: string; excerpt?: string; reason?: string }>;
  onApprove: () => void;
  onCancel: () => void;
  onReplace: (index: number) => void;
  onUseOwn: () => void;
}) {
  return (
    <Card data-testid="card-source-selection" className="border-amber-500/30">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">Selected Sources</CardTitle>
          <ApprovalIndicator />
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {sources.map((s, i) => (
          <div key={i} className="p-2 bg-zinc-800/50 rounded text-sm">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-xs">{s.type}</Badge>
                <span className="font-medium">{s.name}</span>
              </div>
              <Button
                data-testid={`button-replace-source-${i}`}
                size="sm"
                variant="ghost"
                className="h-6 text-xs"
                onClick={() => onReplace(i)}
              >
                <Replace className="w-3 h-3 mr-1" /> Replace
              </Button>
            </div>
            {s.reason && <div className="text-xs text-zinc-400 mt-1">{s.reason}</div>}
          </div>
        ))}
        <div className="flex gap-2 pt-2 flex-wrap">
          <Button data-testid="button-approve-sources" size="sm" onClick={onApprove}>
            <CheckCircle className="w-3 h-3 mr-1" /> Approve and Generate
          </Button>
          <Button data-testid="button-use-own-sources" size="sm" variant="outline" onClick={onUseOwn}>
            <Upload className="w-3 h-3 mr-1" /> Use My Own
          </Button>
          <Button data-testid="button-cancel-sources" size="sm" variant="outline" onClick={onCancel}>
            <X className="w-3 h-3 mr-1" /> Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function OutreachCard({ outreach, onApprove, onArchive, onCopy, onEdit }: {
  outreach: Record<string, unknown>;
  onApprove: (id: string) => void;
  onArchive: (id: string) => void;
  onCopy: (text: string) => void;
  onEdit: (outreach: Record<string, unknown>) => void;
}) {
  const status = outreach.status as string;

  return (
    <Card data-testid={`card-outreach-${outreach.id}`} className="border-amber-500/30">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">{outreach.title as string}</CardTitle>
          <div className="flex gap-1">
            <Badge variant="secondary" className="text-xs">{outreach.type as string}</Badge>
            <Badge variant="secondary" className="text-xs">{outreach.targetType as string}</Badge>
            <Badge variant={status === "approved" ? "default" : "secondary"}>{status}</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {outreach.subjectLine && (
          <div className="text-sm"><span className="font-medium">Subject:</span> {outreach.subjectLine as string}</div>
        )}
        <div className="text-sm whitespace-pre-wrap bg-zinc-800/50 p-2 rounded">{outreach.body as string}</div>
        <div className="flex gap-2 pt-2 flex-wrap">
          {status === "draft" && (
            <Button data-testid={`button-approve-outreach-${outreach.id}`} size="sm" onClick={() => onApprove(outreach.id as string)}>
              <CheckCircle className="w-3 h-3 mr-1" /> Approve
            </Button>
          )}
          <Button data-testid={`button-edit-outreach-${outreach.id}`} size="sm" variant="outline" onClick={() => onEdit(outreach)}>
            <Edit className="w-3 h-3 mr-1" /> Edit
          </Button>
          <Button data-testid={`button-copy-outreach-${outreach.id}`} size="sm" variant="outline" onClick={() => onCopy(outreach.body as string)}>
            <Copy className="w-3 h-3 mr-1" /> Copy
          </Button>
          <Button data-testid={`button-archive-outreach-${outreach.id}`} size="sm" variant="outline" onClick={() => onArchive(outreach.id as string)}>
            <Archive className="w-3 h-3 mr-1" /> Archive
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ProposalCard({ proposal, onApprove, onRevert, onCopy, onEdit }: {
  proposal: Record<string, unknown>;
  onApprove: (id: string) => void;
  onRevert: (id: string) => void;
  onCopy: (text: string) => void;
  onEdit: (proposal: Record<string, unknown>) => void;
}) {
  const status = proposal.status as string;
  const previewConfig = proposal.previewConfig as Record<string, string> | null;
  const codeSnippet = proposal.codeSnippet as string | null;

  return (
    <Card data-testid={`card-proposal-${proposal.id}`} className="border-violet-500/30">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">{proposal.name as string}</CardTitle>
          <div className="flex gap-1">
            <Badge variant="secondary" className="text-xs">{proposal.changeType as string}</Badge>
            <Badge variant={status === "approved" ? "default" : "secondary"}>{status}</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="text-sm">{proposal.description as string}</div>
        {previewConfig && Object.keys(previewConfig).length > 0 && (
          <div className="p-2 bg-zinc-800/50 rounded text-xs space-y-1">
            {Object.entries(previewConfig).map(([k, v]) => (
              <div key={k} className="flex justify-between">
                <span className="text-zinc-400">{k}:</span>
                <span>{v}</span>
              </div>
            ))}
          </div>
        )}
        {codeSnippet && (
          <pre className="p-2 bg-zinc-900 rounded text-xs overflow-auto max-h-32 text-zinc-300">{codeSnippet}</pre>
        )}
        <div className="flex gap-2 pt-2 flex-wrap">
          {status === "draft" && (
            <Button data-testid={`button-approve-proposal-${proposal.id}`} size="sm" onClick={() => onApprove(proposal.id as string)}>
              <CheckCircle className="w-3 h-3 mr-1" /> Approve
            </Button>
          )}
          <Button data-testid={`button-edit-proposal-${proposal.id}`} size="sm" variant="outline" onClick={() => onEdit(proposal)}>
            <Edit className="w-3 h-3 mr-1" /> Edit
          </Button>
          {codeSnippet && (
            <Button data-testid={`button-copy-code-${proposal.id}`} size="sm" variant="outline" onClick={() => onCopy(codeSnippet)}>
              <Copy className="w-3 h-3 mr-1" /> Copy Code
            </Button>
          )}
          {(status === "approved" || status === "applied") && (
            <Button data-testid={`button-revert-proposal-${proposal.id}`} size="sm" variant="outline" onClick={() => onRevert(proposal.id as string)}>
              <RotateCcw className="w-3 h-3 mr-1" /> Revert
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function RecommendationCard({ rec }: { rec: Record<string, unknown> }) {
  const buckets = rec.buckets as Array<{ label: string; options: Array<{ name: string; whatItIs: string; whyItFits: string; bestFor: string }> }>;

  return (
    <Card data-testid="card-recommendation" className="border-emerald-500/30">
      <CardContent className="pt-4 space-y-3">
        {buckets?.map((bucket, bi) => (
          <div key={bi}>
            <div className="font-medium text-sm mb-1">{bucket.label}</div>
            {bucket.options?.map((opt, oi) => (
              <div key={oi} className="p-2 bg-zinc-800/50 rounded text-sm mb-1">
                <div className="font-medium">{opt.name}</div>
                <div className="text-xs text-zinc-400">{opt.whatItIs}</div>
                <div className="text-xs mt-1"><span className="text-zinc-500">Why:</span> {opt.whyItFits}</div>
                <div className="text-xs"><span className="text-zinc-500">Best for:</span> {opt.bestFor}</div>
              </div>
            ))}
          </div>
        ))}
        {rec.whatToAskFor && <div className="text-sm"><span className="font-medium">What to ask for:</span> {rec.whatToAskFor as string}</div>}
        {rec.whatToExpect && <div className="text-sm"><span className="font-medium">What to expect:</span> {rec.whatToExpect as string}</div>}
        {rec.recommendation && <div className="text-sm font-medium text-emerald-400">{rec.recommendation as string}</div>}
      </CardContent>
    </Card>
  );
}

function OutreachEditDialog({ outreach, onSave, onClose }: {
  outreach: Record<string, unknown>;
  onSave: (id: string, data: { title?: string; subjectLine?: string; body?: string }) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(outreach.title as string || "");
  const [subjectLine, setSubjectLine] = useState(outreach.subjectLine as string || "");
  const [body, setBody] = useState(outreach.body as string || "");

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Outreach Draft</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-zinc-400">Title</label>
            <Input data-testid="input-edit-outreach-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-medium text-zinc-400">Subject Line</label>
            <Input data-testid="input-edit-outreach-subject" value={subjectLine} onChange={(e) => setSubjectLine(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-medium text-zinc-400">Body</label>
            <Textarea data-testid="input-edit-outreach-body" value={body} onChange={(e) => setBody(e.target.value)} rows={8} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button data-testid="button-save-outreach-edit" onClick={() => onSave(outreach.id as string, { title, subjectLine, body })}>
            <Save className="w-3 h-3 mr-1" /> Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ProposalEditDialog({ proposal, onSave, onClose }: {
  proposal: Record<string, unknown>;
  onSave: (id: string, data: { name?: string; description?: string; codeSnippet?: string }) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(proposal.name as string || "");
  const [description, setDescription] = useState(proposal.description as string || "");
  const [codeSnippet, setCodeSnippet] = useState(proposal.codeSnippet as string || "");

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit UI Proposal</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-zinc-400">Name</label>
            <Input data-testid="input-edit-proposal-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-medium text-zinc-400">Description</label>
            <Textarea data-testid="input-edit-proposal-description" value={description} onChange={(e) => setDescription(e.target.value)} rows={4} />
          </div>
          <div>
            <label className="text-xs font-medium text-zinc-400">Code Snippet</label>
            <Textarea data-testid="input-edit-proposal-code" value={codeSnippet} onChange={(e) => setCodeSnippet(e.target.value)} rows={6} className="font-mono text-xs" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button data-testid="button-save-proposal-edit" onClick={() => onSave(proposal.id as string, { name, description, codeSnippet })}>
            <Save className="w-3 h-3 mr-1" /> Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function KnowledgeCard({ item, onUpdate }: {
  item: Record<string, unknown>;
  onUpdate: (id: string, data: { value?: string; confidenceLevel?: string; needsReview?: boolean }) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(item.value as string || "");
  const [editConfidence, setEditConfidence] = useState(item.confidenceLevel as string || "medium");

  const startEditing = () => {
    setEditValue(item.value as string || "");
    setEditConfidence(item.confidenceLevel as string || "medium");
    setEditing(true);
  };

  const cancelEditing = () => {
    setEditValue(item.value as string || "");
    setEditConfidence(item.confidenceLevel as string || "medium");
    setEditing(false);
  };

  const handleSave = () => {
    onUpdate(item.id as string, { value: editValue, confidenceLevel: editConfidence, needsReview: false });
    setEditing(false);
  };

  return (
    <Card data-testid={`card-knowledge-${item.id}`} className="border-zinc-700">
      <CardContent className="pt-3 space-y-1">
        <div className="flex justify-between text-xs">
          <Badge variant="secondary" className="text-[10px]">{item.category as string}</Badge>
          {editing ? (
            <select
              data-testid={`select-confidence-${item.id}`}
              className="bg-zinc-800 border border-zinc-600 rounded px-1 text-[10px]"
              value={editConfidence}
              onChange={(e) => setEditConfidence(e.target.value)}
            >
              <option value="low">low</option>
              <option value="medium">medium</option>
              <option value="high">high</option>
            </select>
          ) : (
            <Badge variant="secondary" className="text-[10px]">{item.confidenceLevel as string}</Badge>
          )}
        </div>
        <div className="text-sm font-medium">{item.key as string}</div>
        {editing ? (
          <Textarea
            data-testid={`input-edit-knowledge-${item.id}`}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            rows={3}
            className="text-sm"
          />
        ) : (
          <div className="text-sm text-zinc-400">{item.value as string}</div>
        )}
        {item.needsReview && !editing && (
          <Badge variant="destructive" className="text-[10px]">Needs Review</Badge>
        )}
        <div className="flex gap-1 pt-1">
          {editing ? (
            <>
              <Button data-testid={`button-save-knowledge-${item.id}`} size="sm" variant="outline" className="text-xs h-6" onClick={handleSave}>
                <Save className="w-3 h-3 mr-1" /> Save
              </Button>
              <Button data-testid={`button-cancel-knowledge-${item.id}`} size="sm" variant="ghost" className="text-xs h-6" onClick={cancelEditing}>
                Cancel
              </Button>
            </>
          ) : (
            <Button data-testid={`button-edit-knowledge-${item.id}`} size="sm" variant="outline" className="text-xs h-6" onClick={startEditing}>
              <Pencil className="w-3 h-3 mr-1" /> Edit
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function CoraPanel({ cityId }: { cityId?: string }) {
  const { toast } = useToast();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [pendingSources, setPendingSources] = useState<Array<{ type: string; id: string; name: string; excerpt?: string; reason?: string }> | null>(null);
  const [rightTab, setRightTab] = useState("history");
  const [editingOutreach, setEditingOutreach] = useState<Record<string, unknown> | null>(null);
  const [editingProposal, setEditingProposal] = useState<Record<string, unknown> | null>(null);
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null);
  const [markedReadyIds, setMarkedReadyIds] = useState<Set<string>>(new Set());
  const [voicePrepMode, setVoicePrepMode] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const plansQuery = useQuery({ queryKey: ["/api/cora/plans"] });
  const buildsQuery = useQuery({ queryKey: ["/api/cora/builds"] });
  const outreachQuery = useQuery({ queryKey: ["/api/cora/outreach"] });
  const proposalsQuery = useQuery({ queryKey: ["/api/cora/proposals"] });
  const questionsQuery = useQuery({ queryKey: ["/api/cora/questions"] });
  const suggestionsQuery = useQuery({ queryKey: ["/api/cora/suggestions"] });
  const knowledgeQuery = useQuery({ queryKey: ["/api/cora/knowledge"] });

  const coraMutation = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const res = await apiRequest("POST", "/api/cora/request", body);
      return res.json();
    },
    onSuccess: (data: Record<string, unknown>) => {
      const responseType = data.responseType as string;

      const coraMsg: ChatMessage = {
        role: "cora",
        content: data.message as string,
        data,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, coraMsg]);

      if (responseType === "source_selection" && data.suggestions) {
        setPendingSources(data.suggestions as Array<{ type: string; id: string; name: string; excerpt?: string; reason?: string }>);
      }

      queryClient.invalidateQueries({ queryKey: ["/api/cora/plans"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cora/outreach"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cora/proposals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cora/questions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cora/builds"] });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const approvePlanMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/cora/plans/${id}/approve`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cora/plans"] });
      toast({ title: "Plan approved" });
    },
  });

  const rejectPlanMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/cora/plans/${id}/reject`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cora/plans"] });
      toast({ title: "Plan rejected" });
    },
  });

  const buildPlanMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/cora/plans/${id}/build`);
      return res.json();
    },
    onSuccess: (data: Record<string, unknown>) => {
      queryClient.invalidateQueries({ queryKey: ["/api/cora/plans"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cora/builds"] });
      setMessages((prev) => [...prev, {
        role: "cora",
        content: "Build completed. Review the build log and replit prompt.",
        data: { responseType: "build_complete", build: data },
        timestamp: new Date(),
      }]);
    },
  });

  const revertBuildMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/cora/builds/${id}/revert`);
      return res.json();
    },
    onSuccess: (data: Record<string, unknown>) => {
      queryClient.invalidateQueries({ queryKey: ["/api/cora/builds"] });
      setMessages((prev) => [...prev, {
        role: "cora",
        content: "Revert instructions generated. Review below — nothing was auto-applied.",
        data: { responseType: "revert_complete", revert: data },
        timestamp: new Date(),
      }]);
    },
  });

  const approveOutreachMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/cora/outreach/${id}/approve`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cora/outreach"] });
      toast({ title: "Outreach approved" });
    },
  });

  const archiveOutreachMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/cora/outreach/${id}/archive`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cora/outreach"] });
      toast({ title: "Outreach archived" });
    },
  });

  const updateOutreachMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { title?: string; subjectLine?: string; body?: string } }) => {
      const res = await apiRequest("PATCH", `/api/cora/outreach/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cora/outreach"] });
      setEditingOutreach(null);
      toast({ title: "Outreach updated" });
    },
  });

  const approveProposalMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/cora/proposals/${id}/approve`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cora/proposals"] });
      toast({ title: "Proposal approved" });
    },
  });

  const revertProposalMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/cora/proposals/${id}/revert`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cora/proposals"] });
      toast({ title: "Proposal reverted" });
    },
  });

  const updateProposalMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { name?: string; description?: string; codeSnippet?: string } }) => {
      const res = await apiRequest("PATCH", `/api/cora/proposals/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cora/proposals"] });
      setEditingProposal(null);
      toast({ title: "Proposal updated" });
    },
  });

  const updateQuestionMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await apiRequest("PATCH", `/api/cora/questions/${id}`, { status });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cora/questions"] });
    },
  });

  const updateSuggestionMutation = useMutation({
    mutationFn: async ({ id, approved, executed }: { id: string; approved?: boolean; executed?: boolean }) => {
      const res = await apiRequest("PATCH", `/api/cora/suggestions/${id}`, { approved, executed });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cora/suggestions"] });
    },
  });

  const updateKnowledgeMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { value?: string; confidenceLevel?: string; needsReview?: boolean } }) => {
      const res = await apiRequest("PATCH", `/api/cora/knowledge/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cora/knowledge"] });
      toast({ title: "Knowledge updated" });
    },
  });

  const handleSend = () => {
    if (!inputValue.trim()) return;
    const userMsg: ChatMessage = { role: "user", content: inputValue, timestamp: new Date() };
    setMessages((prev) => [...prev, userMsg]);
    coraMutation.mutate({ input: inputValue, scope: "metro", metroId: cityId, conversation_mode: voicePrepMode ? "voice_prep" : "text" });
    setInputValue("");
  };

  const handleApproveAndGenerate = () => {
    if (!pendingSources) return;
    coraMutation.mutate({
      input: "generate content",
      scope: "metro",
      metroId: cityId,
      approvedSources: pendingSources,
    });
    setPendingSources(null);
  };

  const handleModifyPlan = (id: string) => {
    setInputValue(`modify plan ${id}: `);
  };

  const handlePreviewBuild = (id: string) => {
    const build = builds.find((b) => b.id === id);
    if (build) {
      setMessages((prev) => [...prev, {
        role: "cora",
        content: `Build preview for ${id}:\n${build.changesSummary as string || "No summary available."}\n\nReplit Prompt:\n${build.replitPrompt as string || "N/A"}`,
        data: { responseType: "build_preview" },
        timestamp: new Date(),
      }]);
    }
  };

  const handleMarkReady = (id: string) => {
    setMarkedReadyIds((prev) => new Set(prev).add(id));
    setMessages((prev) => [...prev, {
      role: "cora",
      content: `Build ${id.slice(0, 8)} marked as ready for deployment. No changes were auto-applied.`,
      data: { responseType: "status_update" },
      timestamp: new Date(),
    }]);
    toast({ title: "Marked ready", description: `Build ${id.slice(0, 8)} marked as ready for deployment.` });
  };

  const handleReplaceSource = (index: number) => {
    toast({ title: "Replace source", description: `Select a replacement for source #${index + 1}. Use the chat to specify a new source.` });
  };

  const handleUseOwnSources = () => {
    setPendingSources(null);
    setInputValue("I want to use my own sources: ");
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied to clipboard" });
  };

  const plans = (plansQuery.data || []) as Array<Record<string, unknown>>;
  const builds = (buildsQuery.data || []) as Array<Record<string, unknown>>;
  const outreachItems = (outreachQuery.data || []) as Array<Record<string, unknown>>;
  const proposals = (proposalsQuery.data || []) as Array<Record<string, unknown>>;
  const questions = (questionsQuery.data || []) as Array<Record<string, unknown>>;
  const suggestions = (suggestionsQuery.data || []) as Array<Record<string, unknown>>;
  const knowledge = (knowledgeQuery.data || []) as Array<Record<string, unknown>>;

  const reverts = builds.filter((b) => (b.status as string) === "reverted" || (b.buildType as string) === "revert");

  return (
    <div data-testid="cora-panel" className="flex h-[calc(100vh-80px)] gap-4">
      <div className="w-64 shrink-0 flex flex-col">
        <div className="flex items-center gap-2 mb-4">
          <Brain className="w-5 h-5 text-violet-400" />
          <h2 className="font-semibold text-lg">Cora</h2>
        </div>

        <ScrollArea className="flex-1">
          <div className="space-y-3">
            <div>
              <div className="text-xs font-medium text-zinc-400 mb-1 flex items-center gap-1">
                <FileText className="w-3 h-3" /> Recent Plans
              </div>
              {plans.slice(0, 8).map((p) => (
                <button
                  key={p.id as string}
                  data-testid={`history-plan-${p.id}`}
                  className={`w-full text-left p-2 rounded text-xs hover:bg-zinc-800/50 flex items-center justify-between ${selectedHistoryId === p.id ? "bg-zinc-800/70 ring-1 ring-violet-500/50" : ""}`}
                  onClick={() => { setRightTab("history"); setSelectedHistoryId(p.id as string); }}
                >
                  <span className="truncate">{p.title as string}</span>
                  <Badge variant="secondary" className="text-[10px] ml-1 shrink-0">{p.status as string}</Badge>
                </button>
              ))}
              {plans.length === 0 && <div className="text-xs text-zinc-500 p-2">No plans yet</div>}
            </div>

            <div>
              <div className="text-xs font-medium text-zinc-400 mb-1 flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> Recent Builds
              </div>
              {builds.filter((b) => (b.buildType as string) !== "revert").slice(0, 5).map((b) => (
                <button
                  key={b.id as string}
                  data-testid={`history-build-${b.id}`}
                  className={`w-full text-left p-2 rounded text-xs hover:bg-zinc-800/50 flex items-center justify-between ${selectedHistoryId === b.id ? "bg-zinc-800/70 ring-1 ring-violet-500/50" : ""}`}
                  onClick={() => { setRightTab("history"); setSelectedHistoryId(b.id as string); }}
                >
                  <span className="truncate">{b.changesSummary as string || `Build ${(b.id as string).slice(0, 8)}`}</span>
                  <Badge variant="secondary" className="text-[10px] ml-1 shrink-0">{b.buildType as string}</Badge>
                </button>
              ))}
              {builds.filter((b) => (b.buildType as string) !== "revert").length === 0 && <div className="text-xs text-zinc-500 p-2">No builds yet</div>}
            </div>

            <div>
              <div className="text-xs font-medium text-zinc-400 mb-1 flex items-center gap-1">
                <RotateCcw className="w-3 h-3" /> Reverts
              </div>
              {reverts.slice(0, 5).map((r) => (
                <button
                  key={r.id as string}
                  data-testid={`history-revert-${r.id}`}
                  className={`w-full text-left p-2 rounded text-xs hover:bg-zinc-800/50 flex items-center justify-between ${selectedHistoryId === r.id ? "bg-zinc-800/70 ring-1 ring-violet-500/50" : ""}`}
                  onClick={() => { setRightTab("history"); setSelectedHistoryId(r.id as string); }}
                >
                  <span className="truncate">{r.changesSummary as string || `Revert ${(r.id as string).slice(0, 8)}`}</span>
                  <Badge variant="destructive" className="text-[10px] ml-1 shrink-0">reverted</Badge>
                </button>
              ))}
              {reverts.length === 0 && <div className="text-xs text-zinc-500 p-2">No reverts</div>}
            </div>

            <div>
              <div className="text-xs font-medium text-zinc-400 mb-1 flex items-center gap-1">
                <Mail className="w-3 h-3" /> Recent Outreach
              </div>
              {outreachItems.slice(0, 5).map((o) => (
                <button
                  key={o.id as string}
                  data-testid={`history-outreach-${o.id}`}
                  className={`w-full text-left p-2 rounded text-xs hover:bg-zinc-800/50 flex items-center justify-between ${selectedHistoryId === o.id ? "bg-zinc-800/70 ring-1 ring-violet-500/50" : ""}`}
                  onClick={() => { setRightTab("outreach"); setSelectedHistoryId(o.id as string); }}
                >
                  <span className="truncate">{o.title as string}</span>
                  <Badge variant="secondary" className="text-[10px] ml-1 shrink-0">{o.status as string}</Badge>
                </button>
              ))}
              {outreachItems.length === 0 && <div className="text-xs text-zinc-500 p-2">No outreach yet</div>}
            </div>

            <div>
              <div className="text-xs font-medium text-zinc-400 mb-1 flex items-center gap-1">
                <Palette className="w-3 h-3" /> UI Proposals
              </div>
              {proposals.slice(0, 5).map((pr) => (
                <button
                  key={pr.id as string}
                  data-testid={`history-proposal-${pr.id}`}
                  className={`w-full text-left p-2 rounded text-xs hover:bg-zinc-800/50 flex items-center justify-between ${selectedHistoryId === pr.id ? "bg-zinc-800/70 ring-1 ring-violet-500/50" : ""}`}
                  onClick={() => { setRightTab("proposals"); setSelectedHistoryId(pr.id as string); }}
                >
                  <span className="truncate">{pr.name as string}</span>
                  <Badge variant="secondary" className="text-[10px] ml-1 shrink-0">{pr.status as string}</Badge>
                </button>
              ))}
              {proposals.length === 0 && <div className="text-xs text-zinc-500 p-2">No proposals yet</div>}
            </div>
          </div>
        </ScrollArea>
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        <ScrollArea className="flex-1 mb-4">
          <div className="space-y-4 p-2">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-64 text-zinc-500">
                <Brain className="w-12 h-12 mb-3 text-violet-400/50" />
                <div className="text-sm">Ask Cora anything — content, outreach, plans, UI changes, recommendations</div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] ${msg.role === "user" ? "bg-violet-700/30 rounded-lg p-3" : "space-y-2 w-full"}`}>
                  {msg.role === "user" ? (
                    <div data-testid={`chat-msg-user-${i}`} className="text-sm">{msg.content}</div>
                  ) : (
                    <div data-testid={`chat-msg-cora-${i}`} className="space-y-2">
                      {msg.data?.hat && (
                        <HatBadge
                          hat={(msg.data.hat as Record<string, string>).hat}
                          submode={(msg.data.hat as Record<string, string>).submode}
                        />
                      )}
                      <div className="text-sm">{msg.content}</div>

                      {msg.data?.approvalRequired && <ApprovalIndicator />}

                      {msg.data?.responseType === "source_selection" && msg.data?.suggestions && (
                        <SourceSelectionCard
                          sources={msg.data.suggestions as Array<{ type: string; id: string; name: string; excerpt?: string; reason?: string }>}
                          onApprove={handleApproveAndGenerate}
                          onCancel={() => setPendingSources(null)}
                          onReplace={handleReplaceSource}
                          onUseOwn={handleUseOwnSources}
                        />
                      )}

                      {msg.data?.responseType === "plan_created" && msg.data?.plan && (
                        <PlanCard
                          plan={msg.data.plan as Record<string, unknown>}
                          onApprove={(id) => approvePlanMutation.mutate(id)}
                          onReject={(id) => rejectPlanMutation.mutate(id)}
                          onModify={handleModifyPlan}
                          onBuild={(id) => buildPlanMutation.mutate(id)}
                        />
                      )}

                      {msg.data?.responseType === "build_complete" && msg.data?.build && (
                        <BuildCard
                          build={msg.data.build as Record<string, unknown>}
                          onRevert={(id) => revertBuildMutation.mutate(id)}
                          onPreview={handlePreviewBuild}
                          onMarkReady={handleMarkReady}
                          isMarkedReady={markedReadyIds.has((msg.data.build as Record<string, unknown>).id as string)}
                        />
                      )}

                      {msg.data?.responseType === "revert_complete" && msg.data?.revert && (
                        <Card className="border-red-500/30">
                          <CardContent className="pt-4 text-sm">
                            <div className="font-medium mb-2">Revert Instructions</div>
                            <pre className="whitespace-pre-wrap text-xs bg-zinc-900 p-2 rounded">
                              {(msg.data.revert as Record<string, unknown>).revertSummary as string}
                            </pre>
                            <div className="text-xs text-zinc-500 mt-2">Nothing was auto-applied.</div>
                          </CardContent>
                        </Card>
                      )}

                      {msg.data?.responseType === "outreach_draft" && msg.data?.outreach && (
                        <OutreachCard
                          outreach={msg.data.outreach as Record<string, unknown>}
                          onApprove={(id) => approveOutreachMutation.mutate(id)}
                          onArchive={(id) => archiveOutreachMutation.mutate(id)}
                          onCopy={handleCopy}
                          onEdit={(o) => setEditingOutreach(o)}
                        />
                      )}

                      {msg.data?.responseType === "ui_proposal" && msg.data?.proposal && (
                        <ProposalCard
                          proposal={msg.data.proposal as Record<string, unknown>}
                          onApprove={(id) => approveProposalMutation.mutate(id)}
                          onRevert={(id) => revertProposalMutation.mutate(id)}
                          onCopy={handleCopy}
                          onEdit={(p) => setEditingProposal(p)}
                        />
                      )}

                      {msg.data?.responseType === "recommendation" && msg.data?.recommendation && (
                        <RecommendationCard rec={msg.data.recommendation as Record<string, unknown>} />
                      )}

                      {msg.data?.responseType === "voice_script_draft" && msg.data?.voiceScript && (
                        <Card data-testid="card-voice-script" className="border-violet-500/30">
                          <CardHeader className="pb-2">
                            <div className="flex items-center justify-between">
                              <CardTitle className="text-sm">{(msg.data.voiceScript as Record<string, unknown>).title as string}</CardTitle>
                              <Badge variant="secondary" className="text-xs">{((msg.data.voiceScript as Record<string, unknown>).type as string || "").replace(/_/g, " ")}</Badge>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-2">
                            <div className="text-sm whitespace-pre-wrap bg-zinc-800/50 p-2 rounded">{(msg.data.voiceScript as Record<string, unknown>).body as string}</div>
                            <div className="flex gap-2">
                              <Button data-testid="button-approve-voice-script" size="sm" onClick={() => approveOutreachMutation.mutate((msg.data?.voiceScript as Record<string, unknown>).id as string)}>
                                <CheckCircle className="w-3 h-3 mr-1" /> Approve
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => handleCopy((msg.data?.voiceScript as Record<string, unknown>).body as string)}>
                                <Copy className="w-3 h-3 mr-1" /> Copy
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      )}

                      {msg.data?.responseType === "content_generated" && msg.data?.outputs && (
                        <div className="space-y-2">
                          {(msg.data.outputs as Array<Record<string, unknown>>).map((output, oi) => (
                            <Card key={oi} className="border-emerald-500/30">
                              <CardContent className="pt-3 space-y-1">
                                <div className="text-sm font-medium">{(output.source as Record<string, string>).name}</div>
                                {(output.deliverables as Array<Record<string, unknown>>).map((d, di) => (
                                  <div key={di} className="p-2 bg-zinc-800/50 rounded text-xs">
                                    <div className="flex gap-1 mb-1">
                                      <Badge variant="secondary" className="text-[10px]">{d.type as string}</Badge>
                                      {d.platform && <Badge variant="secondary" className="text-[10px]">{d.platform as string}</Badge>}
                                    </div>
                                    <div>{d.content as string}</div>
                                  </div>
                                ))}
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {coraMutation.isPending && (
              <div className="flex justify-start">
                <div className="bg-zinc-800/50 rounded-lg p-3 text-sm text-zinc-400 animate-pulse">
                  Cora is thinking...
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
        </ScrollArea>

        <div className="flex gap-2 items-center">
          <Button
            data-testid="button-voice-prep-toggle"
            variant={voicePrepMode ? "default" : "outline"}
            size="icon"
            className={`shrink-0 ${voicePrepMode ? "bg-violet-600 hover:bg-violet-700" : ""}`}
            onClick={() => setVoicePrepMode(!voicePrepMode)}
            title={voicePrepMode ? "Voice-prep mode active" : "Switch to voice-prep mode"}
          >
            {voicePrepMode ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
          </Button>
          {voicePrepMode && <span className="text-xs text-violet-400 shrink-0">Voice Prep</span>}
          <Input
            data-testid="input-cora-chat"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
            placeholder={voicePrepMode ? "Talk to Cora (voice-prep mode)..." : "Ask Cora anything..."}
            disabled={coraMutation.isPending}
          />
          <Button
            data-testid="button-send-cora"
            onClick={handleSend}
            disabled={coraMutation.isPending || !inputValue.trim()}
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="w-80 shrink-0 flex flex-col">
        <Tabs value={rightTab} onValueChange={setRightTab}>
          <TabsList className="w-full grid grid-cols-4 mb-2">
            <TabsTrigger data-testid="tab-history" value="history" className="text-xs">History</TabsTrigger>
            <TabsTrigger data-testid="tab-outreach" value="outreach" className="text-xs">Outreach</TabsTrigger>
            <TabsTrigger data-testid="tab-proposals" value="proposals" className="text-xs">Proposals</TabsTrigger>
            <TabsTrigger data-testid="tab-memory" value="memory" className="text-xs">Memory</TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1">
            <TabsContent value="history" className="space-y-3 mt-0">
              <div className="text-xs font-medium text-zinc-400">Plans</div>
              {plans.map((p) => (
                <PlanCard
                  key={p.id as string}
                  plan={p}
                  onApprove={(id) => approvePlanMutation.mutate(id)}
                  onReject={(id) => rejectPlanMutation.mutate(id)}
                  onModify={handleModifyPlan}
                  onBuild={(id) => buildPlanMutation.mutate(id)}
                />
              ))}
              <div className="text-xs font-medium text-zinc-400 mt-3">Builds</div>
              {builds.filter((b) => (b.buildType as string) !== "revert" && (b.status as string) !== "reverted").map((b) => (
                <BuildCard
                  key={b.id as string}
                  build={b}
                  onRevert={(id) => revertBuildMutation.mutate(id)}
                  onPreview={handlePreviewBuild}
                  onMarkReady={handleMarkReady}
                  isMarkedReady={markedReadyIds.has(b.id as string)}
                />
              ))}
              <div className="text-xs font-medium text-zinc-400 mt-3">Reverts</div>
              {reverts.map((r) => (
                <Card key={r.id as string} data-testid={`card-revert-${r.id}`} className="border-red-500/30">
                  <CardContent className="pt-3 space-y-1">
                    <div className="text-sm font-medium">Revert</div>
                    <div className="text-xs text-zinc-400">{r.changesSummary as string || "Rollback completed"}</div>
                    {r.revertSummary && (
                      <pre className="whitespace-pre-wrap text-xs bg-zinc-900 p-2 rounded max-h-24 overflow-auto">
                        {r.revertSummary as string}
                      </pre>
                    )}
                  </CardContent>
                </Card>
              ))}
              {plans.length === 0 && builds.length === 0 && reverts.length === 0 && (
                <div className="text-xs text-zinc-500 text-center py-4">No history yet</div>
              )}
            </TabsContent>

            <TabsContent value="outreach" className="space-y-3 mt-0">
              {outreachItems.map((o) => (
                <OutreachCard
                  key={o.id as string}
                  outreach={o}
                  onApprove={(id) => approveOutreachMutation.mutate(id)}
                  onArchive={(id) => archiveOutreachMutation.mutate(id)}
                  onCopy={handleCopy}
                  onEdit={(oi) => setEditingOutreach(oi)}
                />
              ))}
              {outreachItems.length === 0 && (
                <div className="text-xs text-zinc-500 text-center py-4">No outreach drafts</div>
              )}
            </TabsContent>

            <TabsContent value="proposals" className="space-y-3 mt-0">
              {proposals.map((pr) => (
                <ProposalCard
                  key={pr.id as string}
                  proposal={pr}
                  onApprove={(id) => approveProposalMutation.mutate(id)}
                  onRevert={(id) => revertProposalMutation.mutate(id)}
                  onCopy={handleCopy}
                  onEdit={(p) => setEditingProposal(p)}
                />
              ))}
              {proposals.length === 0 && (
                <div className="text-xs text-zinc-500 text-center py-4">No UI proposals</div>
              )}
            </TabsContent>

            <TabsContent value="memory" className="mt-0">
              <Tabs defaultValue="questions">
                <TabsList className="w-full grid grid-cols-3 mb-2">
                  <TabsTrigger data-testid="tab-questions" value="questions" className="text-xs">Questions</TabsTrigger>
                  <TabsTrigger data-testid="tab-suggestions" value="suggestions" className="text-xs">Suggestions</TabsTrigger>
                  <TabsTrigger data-testid="tab-knowledge" value="knowledge" className="text-xs">Knowledge</TabsTrigger>
                </TabsList>

                <TabsContent value="questions" className="space-y-2 mt-0">
                  {questions.map((q) => (
                    <Card key={q.id as string} data-testid={`card-question-${q.id}`} className="border-zinc-700">
                      <CardContent className="pt-3 space-y-2">
                        <div className="text-sm">{q.question as string}</div>
                        {q.context && <div className="text-xs text-zinc-500">{q.context as string}</div>}
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-[10px]">{q.status as string}</Badge>
                          <Badge variant="secondary" className="text-[10px]">{q.priority as string}</Badge>
                        </div>
                        <div className="flex gap-1">
                          {(q.status as string) === "pending" && (
                            <>
                              <Button
                                data-testid={`button-answer-${q.id}`}
                                size="sm"
                                variant="outline"
                                className="text-xs h-6"
                                onClick={() => updateQuestionMutation.mutate({ id: q.id as string, status: "answered" })}
                              >
                                Mark Answered
                              </Button>
                              <Button
                                data-testid={`button-ignore-${q.id}`}
                                size="sm"
                                variant="outline"
                                className="text-xs h-6"
                                onClick={() => updateQuestionMutation.mutate({ id: q.id as string, status: "ignored" })}
                              >
                                Ignore
                              </Button>
                            </>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  {questions.length === 0 && <div className="text-xs text-zinc-500 text-center py-4">No questions</div>}
                </TabsContent>

                <TabsContent value="suggestions" className="space-y-2 mt-0">
                  {suggestions.map((s) => (
                    <Card key={s.id as string} data-testid={`card-suggestion-${s.id}`} className="border-zinc-700">
                      <CardContent className="pt-3 space-y-2">
                        <div className="text-sm">{s.suggestion as string}</div>
                        {s.context && <div className="text-xs text-zinc-500">{s.context as string}</div>}
                        <div className="flex gap-1">
                          <Badge variant={s.approved ? "default" : "secondary"} className="text-[10px]">
                            {s.approved ? "Approved" : "Pending"}
                          </Badge>
                          {s.executed && <Badge className="text-[10px]">Executed</Badge>}
                        </div>
                        <div className="flex gap-1">
                          {!s.approved && (
                            <Button
                              data-testid={`button-approve-suggestion-${s.id}`}
                              size="sm"
                              variant="outline"
                              className="text-xs h-6"
                              onClick={() => updateSuggestionMutation.mutate({ id: s.id as string, approved: true })}
                            >
                              Approve
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  {suggestions.length === 0 && <div className="text-xs text-zinc-500 text-center py-4">No suggestions</div>}
                </TabsContent>

                <TabsContent value="knowledge" className="space-y-2 mt-0">
                  {knowledge.map((k) => (
                    <KnowledgeCard
                      key={k.id as string}
                      item={k}
                      onUpdate={(id, data) => updateKnowledgeMutation.mutate({ id, data })}
                    />
                  ))}
                  {knowledge.length === 0 && <div className="text-xs text-zinc-500 text-center py-4">No knowledge entries</div>}
                </TabsContent>
              </Tabs>
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </div>

      {editingOutreach && (
        <OutreachEditDialog
          outreach={editingOutreach}
          onSave={(id, data) => updateOutreachMutation.mutate({ id, data })}
          onClose={() => setEditingOutreach(null)}
        />
      )}

      {editingProposal && (
        <ProposalEditDialog
          proposal={editingProposal}
          onSave={(id, data) => updateProposalMutation.mutate({ id, data })}
          onClose={() => setEditingProposal(null)}
        />
      )}
    </div>
  );
}
