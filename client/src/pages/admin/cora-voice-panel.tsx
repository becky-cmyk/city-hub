import { useState } from "react";
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
  Mic, Phone, PhoneIncoming, PhoneOutgoing, FileText,
  Plus, CheckCircle, XCircle, Archive, Copy, Edit, Save,
} from "lucide-react";

type AnyRecord = Record<string, unknown>;

function StatusBadge({ status }: { status: string }) {
  const variant = status === "active" || status === "approved" ? "default"
    : status === "archived" || status === "cancelled" ? "secondary"
    : status === "draft" ? "outline" : "secondary";
  return <Badge data-testid={`badge-status-${status}`} variant={variant}>{status}</Badge>;
}

function VoiceProfilesSection() {
  const { toast } = useToast();
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", persona: "cora", tone: "", pacing: "", introStyle: "", outroStyle: "", vocabulary: "", pronunciationNotes: "" });

  const profilesQuery = useQuery({ queryKey: ["/api/cora/voice/profiles"] });
  const profiles = (profilesQuery.data || []) as AnyRecord[];

  const createMutation = useMutation({
    mutationFn: async (data: AnyRecord) => { const res = await apiRequest("POST", "/api/cora/voice/profiles", data); return res.json(); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/cora/voice/profiles"] }); setShowCreate(false); toast({ title: "Voice profile created" }); },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: AnyRecord) => { const res = await apiRequest("PATCH", `/api/cora/voice/profiles/${id}`, data); return res.json(); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/cora/voice/profiles"] }); setEditingId(null); toast({ title: "Profile updated" }); },
  });

  const activateMutation = useMutation({
    mutationFn: async (id: string) => { const res = await apiRequest("POST", `/api/cora/voice/profiles/${id}/activate`); return res.json(); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/cora/voice/profiles"] }); toast({ title: "Profile activated" }); },
  });

  const archiveMutation = useMutation({
    mutationFn: async (id: string) => { const res = await apiRequest("POST", `/api/cora/voice/profiles/${id}/archive`); return res.json(); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/cora/voice/profiles"] }); toast({ title: "Profile archived" }); },
  });

  const handleCreate = () => {
    createMutation.mutate(form);
  };

  const startEdit = (p: AnyRecord) => {
    setEditingId(p.id as string);
    setForm({
      name: p.name as string || "",
      persona: p.persona as string || "cora",
      tone: p.tone as string || "",
      pacing: p.pacing as string || "",
      introStyle: p.introStyle as string || "",
      outroStyle: p.outroStyle as string || "",
      vocabulary: p.vocabulary as string || "",
      pronunciationNotes: p.pronunciationNotes as string || "",
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2"><Mic className="w-4 h-4" /> Voice Profiles</h3>
        <Button data-testid="button-create-voice-profile" size="sm" onClick={() => { setShowCreate(true); setForm({ name: "", persona: "cora", tone: "warm and professional", pacing: "moderate", introStyle: "friendly greeting", outroStyle: "clear next steps", vocabulary: "", pronunciationNotes: "" }); }}>
          <Plus className="w-3 h-3 mr-1" /> New Profile
        </Button>
      </div>

      {profiles.map((p) => (
        <Card key={p.id as string} data-testid={`card-voice-profile-${p.id}`}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">{p.name as string}</CardTitle>
              <div className="flex items-center gap-1">
                <Badge variant="secondary" className="text-xs">{p.persona as string}</Badge>
                <StatusBadge status={p.status as string} />
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            {editingId === p.id ? (
              <div className="space-y-2">
                <Input data-testid="input-edit-profile-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Name" />
                <Input data-testid="input-edit-profile-tone" value={form.tone} onChange={(e) => setForm({ ...form, tone: e.target.value })} placeholder="Tone" />
                <Input data-testid="input-edit-profile-pacing" value={form.pacing} onChange={(e) => setForm({ ...form, pacing: e.target.value })} placeholder="Pacing" />
                <Input data-testid="input-edit-profile-intro" value={form.introStyle} onChange={(e) => setForm({ ...form, introStyle: e.target.value })} placeholder="Intro Style" />
                <Input data-testid="input-edit-profile-outro" value={form.outroStyle} onChange={(e) => setForm({ ...form, outroStyle: e.target.value })} placeholder="Outro Style" />
                <Textarea data-testid="input-edit-profile-vocab" value={form.vocabulary} onChange={(e) => setForm({ ...form, vocabulary: e.target.value })} placeholder="Vocabulary notes" />
                <div className="flex gap-2">
                  <Button data-testid="button-save-profile" size="sm" onClick={() => updateMutation.mutate({ id: p.id, ...form })} disabled={updateMutation.isPending}>
                    <Save className="w-3 h-3 mr-1" /> Save
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>Cancel</Button>
                </div>
              </div>
            ) : (
              <>
                <div><span className="text-muted-foreground">Tone:</span> {p.tone as string}</div>
                <div><span className="text-muted-foreground">Pacing:</span> {p.pacing as string}</div>
                <div><span className="text-muted-foreground">Intro:</span> {p.introStyle as string}</div>
                <div><span className="text-muted-foreground">Outro:</span> {p.outroStyle as string}</div>
                {p.vocabulary && <div><span className="text-muted-foreground">Vocabulary:</span> {p.vocabulary as string}</div>}
                <div className="flex gap-2 pt-2">
                  <Button data-testid={`button-edit-profile-${p.id}`} size="sm" variant="outline" onClick={() => startEdit(p)}>
                    <Edit className="w-3 h-3 mr-1" /> Edit
                  </Button>
                  {(p.status as string) === "draft" && (
                    <Button data-testid={`button-activate-profile-${p.id}`} size="sm" onClick={() => activateMutation.mutate(p.id as string)}>
                      <CheckCircle className="w-3 h-3 mr-1" /> Activate
                    </Button>
                  )}
                  {(p.status as string) !== "archived" && (
                    <Button data-testid={`button-archive-profile-${p.id}`} size="sm" variant="outline" onClick={() => archiveMutation.mutate(p.id as string)}>
                      <Archive className="w-3 h-3 mr-1" /> Archive
                    </Button>
                  )}
                  <Button data-testid={`button-copy-profile-${p.id}`} size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(JSON.stringify(p, null, 2)); toast({ title: "Profile copied" }); }}>
                    <Copy className="w-3 h-3 mr-1" /> Export
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      ))}
      {profiles.length === 0 && <div className="text-xs text-muted-foreground text-center py-4">No voice profiles yet</div>}

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create Voice Profile</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input data-testid="input-new-profile-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Profile name" />
            <Input data-testid="input-new-profile-persona" value={form.persona} onChange={(e) => setForm({ ...form, persona: e.target.value })} placeholder="Persona (cora/charlotte)" />
            <Input data-testid="input-new-profile-tone" value={form.tone} onChange={(e) => setForm({ ...form, tone: e.target.value })} placeholder="Tone" />
            <Input data-testid="input-new-profile-pacing" value={form.pacing} onChange={(e) => setForm({ ...form, pacing: e.target.value })} placeholder="Pacing" />
            <Input data-testid="input-new-profile-intro" value={form.introStyle} onChange={(e) => setForm({ ...form, introStyle: e.target.value })} placeholder="Intro style" />
            <Input data-testid="input-new-profile-outro" value={form.outroStyle} onChange={(e) => setForm({ ...form, outroStyle: e.target.value })} placeholder="Outro style" />
            <Textarea data-testid="input-new-profile-vocab" value={form.vocabulary} onChange={(e) => setForm({ ...form, vocabulary: e.target.value })} placeholder="Vocabulary notes" />
          </div>
          <DialogFooter>
            <Button data-testid="button-submit-new-profile" onClick={handleCreate} disabled={!form.name || createMutation.isPending}>Create Profile</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CallCampaignsSection() {
  const { toast } = useToast();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", campaignType: "outbound_prospecting", targetAudience: "" });
  const [showTasks, setShowTasks] = useState<string | null>(null);
  const [taskForm, setTaskForm] = useState({ contactName: "", contactPhone: "", contactEmail: "", notes: "" });

  const campaignsQuery = useQuery({ queryKey: ["/api/cora/voice/campaigns"] });
  const campaigns = (campaignsQuery.data || []) as AnyRecord[];

  const tasksQuery = useQuery({
    queryKey: ["/api/cora/voice/campaigns", showTasks, "tasks"],
    queryFn: async () => {
      if (!showTasks) return [];
      const res = await fetch(`/api/cora/voice/campaigns/${showTasks}/tasks`);
      return res.json();
    },
    enabled: !!showTasks,
  });
  const tasks = (tasksQuery.data || []) as AnyRecord[];

  const createMutation = useMutation({
    mutationFn: async (data: AnyRecord) => { const res = await apiRequest("POST", "/api/cora/voice/campaigns", data); return res.json(); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/cora/voice/campaigns"] }); setShowCreate(false); toast({ title: "Campaign created as draft" }); },
  });

  const transitionMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => { const res = await apiRequest("POST", `/api/cora/voice/campaigns/${id}/transition`, { status }); return res.json(); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/cora/voice/campaigns"] }); toast({ title: "Campaign status updated" }); },
  });

  const archiveMutation = useMutation({
    mutationFn: async (id: string) => { const res = await apiRequest("POST", `/api/cora/voice/campaigns/${id}/archive`); return res.json(); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/cora/voice/campaigns"] }); toast({ title: "Campaign archived" }); },
  });

  const createTaskMutation = useMutation({
    mutationFn: async ({ campaignId, ...data }: AnyRecord) => { const res = await apiRequest("POST", `/api/cora/voice/campaigns/${campaignId}/tasks`, data); return res.json(); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/cora/voice/campaigns", showTasks, "tasks"] }); setTaskForm({ contactName: "", contactPhone: "", contactEmail: "", notes: "" }); toast({ title: "Task added" }); },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2"><Phone className="w-4 h-4" /> Call Campaigns</h3>
        <Button data-testid="button-create-campaign" size="sm" onClick={() => setShowCreate(true)}>
          <Plus className="w-3 h-3 mr-1" /> New Campaign
        </Button>
      </div>

      {campaigns.map((c) => (
        <Card key={c.id as string} data-testid={`card-campaign-${c.id}`}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">{c.name as string}</CardTitle>
              <div className="flex gap-1">
                <Badge variant="secondary" className="text-xs">{c.campaignType as string}</Badge>
                <StatusBadge status={c.status as string} />
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {c.description && <div>{c.description as string}</div>}
            {c.targetAudience && <div><span className="text-muted-foreground">Target:</span> {c.targetAudience as string}</div>}
            <div className="flex gap-2 pt-1 flex-wrap">
              {(c.status as string) === "draft" && (
                <Button data-testid={`button-approve-campaign-${c.id}`} size="sm" onClick={() => transitionMutation.mutate({ id: c.id as string, status: "approved" })}>
                  <CheckCircle className="w-3 h-3 mr-1" /> Approve
                </Button>
              )}
              {(c.status as string) === "draft" && (
                <Button data-testid={`button-reject-campaign-${c.id}`} size="sm" variant="destructive" onClick={() => transitionMutation.mutate({ id: c.id as string, status: "cancelled" })}>
                  <XCircle className="w-3 h-3 mr-1" /> Cancel
                </Button>
              )}
              <Button data-testid={`button-tasks-campaign-${c.id}`} size="sm" variant="outline" onClick={() => setShowTasks(showTasks === c.id ? null : c.id as string)}>
                Tasks
              </Button>
              <Button data-testid={`button-archive-campaign-${c.id}`} size="sm" variant="outline" onClick={() => archiveMutation.mutate(c.id as string)}>
                <Archive className="w-3 h-3 mr-1" /> Archive
              </Button>
              <Button data-testid={`button-export-campaign-${c.id}`} size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(JSON.stringify(c, null, 2)); toast({ title: "Campaign copied" }); }}>
                <Copy className="w-3 h-3 mr-1" /> Export
              </Button>
            </div>
            {showTasks === c.id && (
              <div className="border-t pt-2 mt-2 space-y-2">
                <div className="text-xs font-medium">Call Tasks</div>
                {tasks.map((t) => (
                  <div key={t.id as string} data-testid={`task-${t.id}`} className="p-2 bg-muted/50 rounded text-xs space-y-1">
                    <div className="flex justify-between">
                      <span className="font-medium">{t.contactName as string || "Unknown"}</span>
                      <StatusBadge status={t.status as string} />
                    </div>
                    {t.contactPhone && <div>{t.contactPhone as string}</div>}
                    {t.notes && <div className="text-muted-foreground">{t.notes as string}</div>}
                  </div>
                ))}
                <div className="flex gap-2">
                  <Input data-testid="input-task-name" value={taskForm.contactName} onChange={(e) => setTaskForm({ ...taskForm, contactName: e.target.value })} placeholder="Contact name" className="text-xs" />
                  <Input data-testid="input-task-phone" value={taskForm.contactPhone} onChange={(e) => setTaskForm({ ...taskForm, contactPhone: e.target.value })} placeholder="Phone" className="text-xs" />
                  <Button data-testid="button-add-task" size="sm" onClick={() => createTaskMutation.mutate({ campaignId: c.id, ...taskForm })} disabled={!taskForm.contactName}>
                    <Plus className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
      {campaigns.length === 0 && <div className="text-xs text-muted-foreground text-center py-4">No call campaigns yet</div>}

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create Call Campaign</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input data-testid="input-new-campaign-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Campaign name" />
            <Textarea data-testid="input-new-campaign-desc" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Description" />
            <Input data-testid="input-new-campaign-type" value={form.campaignType} onChange={(e) => setForm({ ...form, campaignType: e.target.value })} placeholder="Type (outbound_prospecting, crown_nomination, etc.)" />
            <Input data-testid="input-new-campaign-target" value={form.targetAudience} onChange={(e) => setForm({ ...form, targetAudience: e.target.value })} placeholder="Target audience" />
          </div>
          <DialogFooter>
            <Button data-testid="button-submit-new-campaign" onClick={() => createMutation.mutate(form)} disabled={!form.name || createMutation.isPending}>Create as Draft</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DraftScriptsSection() {
  const { toast } = useToast();

  const scriptsQuery = useQuery({
    queryKey: ["/api/cora/outreach", "voice"],
    queryFn: async () => {
      const res = await fetch("/api/cora/outreach?type=voicemail_script");
      const vm = await res.json();
      const res2 = await fetch("/api/cora/outreach?type=inbound_answer_script");
      const ia = await res2.json();
      const res3 = await fetch("/api/cora/outreach?type=follow_up_sms");
      const fu = await res3.json();
      return [...vm, ...ia, ...fu];
    },
  });
  const scripts = (scriptsQuery.data || []) as AnyRecord[];

  const approveMutation = useMutation({
    mutationFn: async (id: string) => { const res = await apiRequest("POST", `/api/cora/outreach/${id}/approve`); return res.json(); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/cora/outreach", "voice"] }); toast({ title: "Script approved" }); },
  });

  const archiveMutation = useMutation({
    mutationFn: async (id: string) => { const res = await apiRequest("POST", `/api/cora/outreach/${id}/archive`); return res.json(); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/cora/outreach", "voice"] }); toast({ title: "Script archived" }); },
  });

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold flex items-center gap-2"><FileText className="w-4 h-4" /> Draft Scripts</h3>
      {scripts.map((s) => (
        <Card key={s.id as string} data-testid={`card-script-${s.id}`}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">{s.title as string}</CardTitle>
              <div className="flex gap-1">
                <Badge variant="secondary" className="text-xs">{(s.type as string || "").replace(/_/g, " ")}</Badge>
                <StatusBadge status={s.status as string} />
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="whitespace-pre-wrap bg-muted/50 p-2 rounded text-xs max-h-40 overflow-y-auto">{s.body as string}</div>
            <div className="flex gap-2">
              {(s.status as string) === "draft" && (
                <Button data-testid={`button-approve-script-${s.id}`} size="sm" onClick={() => approveMutation.mutate(s.id as string)}>
                  <CheckCircle className="w-3 h-3 mr-1" /> Approve
                </Button>
              )}
              <Button data-testid={`button-copy-script-${s.id}`} size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(s.body as string); toast({ title: "Script copied" }); }}>
                <Copy className="w-3 h-3 mr-1" /> Copy
              </Button>
              <Button data-testid={`button-archive-script-${s.id}`} size="sm" variant="outline" onClick={() => archiveMutation.mutate(s.id as string)}>
                <Archive className="w-3 h-3 mr-1" /> Archive
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
      {scripts.length === 0 && <div className="text-xs text-muted-foreground text-center py-4">No voice scripts yet. Ask Cora to draft one.</div>}
    </div>
  );
}

function AnswerFlowsSection() {
  const { toast } = useToast();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", greeting: "Thank you for calling.", fallbackMessage: "Let me connect you with someone who can help." });

  const flowsQuery = useQuery({ queryKey: ["/api/cora/voice/answer-flows"] });
  const flows = (flowsQuery.data || []) as AnyRecord[];

  const createMutation = useMutation({
    mutationFn: async (data: AnyRecord) => { const res = await apiRequest("POST", "/api/cora/voice/answer-flows", data); return res.json(); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/cora/voice/answer-flows"] }); setShowCreate(false); toast({ title: "Answer flow created" }); },
  });

  const approveMutation = useMutation({
    mutationFn: async (id: string) => { const res = await apiRequest("POST", `/api/cora/voice/answer-flows/${id}/approve`); return res.json(); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/cora/voice/answer-flows"] }); toast({ title: "Flow approved" }); },
  });

  const rejectMutation = useMutation({
    mutationFn: async (id: string) => { const res = await apiRequest("POST", `/api/cora/voice/answer-flows/${id}/reject`); return res.json(); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/cora/voice/answer-flows"] }); toast({ title: "Flow returned to draft" }); },
  });

  const archiveMutation = useMutation({
    mutationFn: async (id: string) => { const res = await apiRequest("POST", `/api/cora/voice/answer-flows/${id}/archive`); return res.json(); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/cora/voice/answer-flows"] }); toast({ title: "Flow archived" }); },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2"><PhoneIncoming className="w-4 h-4" /> Inbound Answer Flows</h3>
        <Button data-testid="button-create-answer-flow" size="sm" onClick={() => setShowCreate(true)}>
          <Plus className="w-3 h-3 mr-1" /> New Flow
        </Button>
      </div>

      {flows.map((f) => (
        <Card key={f.id as string} data-testid={`card-answer-flow-${f.id}`}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">{f.name as string}</CardTitle>
              <StatusBadge status={f.status as string} />
            </div>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {f.description && <div className="text-muted-foreground">{f.description as string}</div>}
            <div><span className="text-muted-foreground">Greeting:</span> {f.greeting as string}</div>
            <div><span className="text-muted-foreground">Fallback:</span> {f.fallbackMessage as string}</div>
            {Array.isArray(f.captureFields) && (f.captureFields as string[]).length > 0 && (
              <div><span className="text-muted-foreground">Captures:</span> {(f.captureFields as string[]).join(", ")}</div>
            )}
            {Array.isArray(f.escalationRules) && (f.escalationRules as AnyRecord[]).length > 0 && (
              <div className="text-xs">
                <span className="text-muted-foreground">Escalation rules:</span>
                {(f.escalationRules as AnyRecord[]).map((r, i) => (
                  <div key={i} className="ml-2">{r.condition as string} → {r.action as string}</div>
                ))}
              </div>
            )}
            <div className="flex gap-2 pt-1">
              {(f.status as string) === "draft" && (
                <>
                  <Button data-testid={`button-approve-flow-${f.id}`} size="sm" onClick={() => approveMutation.mutate(f.id as string)}>
                    <CheckCircle className="w-3 h-3 mr-1" /> Approve
                  </Button>
                  <Button data-testid={`button-reject-flow-${f.id}`} size="sm" variant="destructive" onClick={() => rejectMutation.mutate(f.id as string)}>
                    <XCircle className="w-3 h-3 mr-1" /> Reject
                  </Button>
                </>
              )}
              <Button data-testid={`button-archive-flow-${f.id}`} size="sm" variant="outline" onClick={() => archiveMutation.mutate(f.id as string)}>
                <Archive className="w-3 h-3 mr-1" /> Archive
              </Button>
              <Button data-testid={`button-export-flow-${f.id}`} size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(JSON.stringify(f, null, 2)); toast({ title: "Flow exported" }); }}>
                <Copy className="w-3 h-3 mr-1" /> Export
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
      {flows.length === 0 && <div className="text-xs text-muted-foreground text-center py-4">No inbound answer flows yet</div>}

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create Inbound Answer Flow</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input data-testid="input-new-flow-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Flow name" />
            <Textarea data-testid="input-new-flow-desc" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Description" />
            <Input data-testid="input-new-flow-greeting" value={form.greeting} onChange={(e) => setForm({ ...form, greeting: e.target.value })} placeholder="Greeting" />
            <Input data-testid="input-new-flow-fallback" value={form.fallbackMessage} onChange={(e) => setForm({ ...form, fallbackMessage: e.target.value })} placeholder="Fallback message" />
          </div>
          <DialogFooter>
            <Button data-testid="button-submit-new-flow" onClick={() => createMutation.mutate(form)} disabled={!form.name || createMutation.isPending}>Create as Draft</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function OutboundFlowsSection() {
  const { toast } = useToast();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", opener: "", qualification: "", valueProp: "", objectionHandling: "", cta: "", close: "", voicemailVersion: "", smsFollowUp: "" });

  const flowsQuery = useQuery({ queryKey: ["/api/cora/voice/outbound-flows"] });
  const flows = (flowsQuery.data || []) as AnyRecord[];

  const createMutation = useMutation({
    mutationFn: async (data: AnyRecord) => { const res = await apiRequest("POST", "/api/cora/voice/outbound-flows", data); return res.json(); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/cora/voice/outbound-flows"] }); setShowCreate(false); toast({ title: "Outbound flow created" }); },
  });

  const approveMutation = useMutation({
    mutationFn: async (id: string) => { const res = await apiRequest("POST", `/api/cora/voice/outbound-flows/${id}/approve`); return res.json(); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/cora/voice/outbound-flows"] }); toast({ title: "Flow approved" }); },
  });

  const rejectMutation = useMutation({
    mutationFn: async (id: string) => { const res = await apiRequest("POST", `/api/cora/voice/outbound-flows/${id}/reject`); return res.json(); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/cora/voice/outbound-flows"] }); toast({ title: "Flow returned to draft" }); },
  });

  const archiveMutation = useMutation({
    mutationFn: async (id: string) => { const res = await apiRequest("POST", `/api/cora/voice/outbound-flows/${id}/archive`); return res.json(); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/cora/voice/outbound-flows"] }); toast({ title: "Flow archived" }); },
  });

  const sections = ["opener", "qualification", "valueProp", "objectionHandling", "cta", "close"] as const;
  const sectionLabels: Record<string, string> = { opener: "Opener", qualification: "Qualification", valueProp: "Value Prop", objectionHandling: "Objection Handling", cta: "CTA", close: "Close" };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2"><PhoneOutgoing className="w-4 h-4" /> Outbound Flows</h3>
        <Button data-testid="button-create-outbound-flow" size="sm" onClick={() => setShowCreate(true)}>
          <Plus className="w-3 h-3 mr-1" /> New Flow
        </Button>
      </div>

      {flows.map((f) => (
        <Card key={f.id as string} data-testid={`card-outbound-flow-${f.id}`}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">{f.name as string}</CardTitle>
              <StatusBadge status={f.status as string} />
            </div>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {f.description && <div className="text-muted-foreground">{f.description as string}</div>}
            {sections.map((s) => f[s] ? (
              <div key={s}>
                <span className="text-muted-foreground text-xs">{sectionLabels[s]}:</span>
                <div className="bg-muted/50 p-1.5 rounded text-xs mt-0.5">{f[s] as string}</div>
              </div>
            ) : null)}
            {f.voicemailVersion && (
              <div>
                <span className="text-muted-foreground text-xs">Voicemail Version:</span>
                <div className="bg-muted/50 p-1.5 rounded text-xs mt-0.5">{f.voicemailVersion as string}</div>
              </div>
            )}
            {f.smsFollowUp && (
              <div>
                <span className="text-muted-foreground text-xs">SMS Follow-Up:</span>
                <div className="bg-muted/50 p-1.5 rounded text-xs mt-0.5">{f.smsFollowUp as string}</div>
              </div>
            )}
            <div className="flex gap-2 pt-1">
              {(f.status as string) === "draft" && (
                <>
                  <Button data-testid={`button-approve-outbound-${f.id}`} size="sm" onClick={() => approveMutation.mutate(f.id as string)}>
                    <CheckCircle className="w-3 h-3 mr-1" /> Approve
                  </Button>
                  <Button data-testid={`button-reject-outbound-${f.id}`} size="sm" variant="destructive" onClick={() => rejectMutation.mutate(f.id as string)}>
                    <XCircle className="w-3 h-3 mr-1" /> Reject
                  </Button>
                </>
              )}
              <Button data-testid={`button-archive-outbound-${f.id}`} size="sm" variant="outline" onClick={() => archiveMutation.mutate(f.id as string)}>
                <Archive className="w-3 h-3 mr-1" /> Archive
              </Button>
              <Button data-testid={`button-export-outbound-${f.id}`} size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(JSON.stringify(f, null, 2)); toast({ title: "Flow exported" }); }}>
                <Copy className="w-3 h-3 mr-1" /> Export
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
      {flows.length === 0 && <div className="text-xs text-muted-foreground text-center py-4">No outbound flows yet</div>}

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Create Outbound Flow</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input data-testid="input-new-outbound-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Flow name" />
            <Textarea data-testid="input-new-outbound-desc" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Description" />
            <Textarea data-testid="input-new-outbound-opener" value={form.opener} onChange={(e) => setForm({ ...form, opener: e.target.value })} placeholder="Opener" />
            <Textarea data-testid="input-new-outbound-qualification" value={form.qualification} onChange={(e) => setForm({ ...form, qualification: e.target.value })} placeholder="Qualification" />
            <Textarea data-testid="input-new-outbound-valueprop" value={form.valueProp} onChange={(e) => setForm({ ...form, valueProp: e.target.value })} placeholder="Value Proposition" />
            <Textarea data-testid="input-new-outbound-objection" value={form.objectionHandling} onChange={(e) => setForm({ ...form, objectionHandling: e.target.value })} placeholder="Objection Handling" />
            <Textarea data-testid="input-new-outbound-cta" value={form.cta} onChange={(e) => setForm({ ...form, cta: e.target.value })} placeholder="Call to Action" />
            <Textarea data-testid="input-new-outbound-close" value={form.close} onChange={(e) => setForm({ ...form, close: e.target.value })} placeholder="Close" />
            <Textarea data-testid="input-new-outbound-vm" value={form.voicemailVersion} onChange={(e) => setForm({ ...form, voicemailVersion: e.target.value })} placeholder="Voicemail Version (optional)" />
            <Textarea data-testid="input-new-outbound-sms" value={form.smsFollowUp} onChange={(e) => setForm({ ...form, smsFollowUp: e.target.value })} placeholder="SMS Follow-Up (optional)" />
          </div>
          <DialogFooter>
            <Button data-testid="button-submit-new-outbound" onClick={() => createMutation.mutate(form)} disabled={!form.name || createMutation.isPending}>Create as Draft</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function CoraVoicePanel({ cityId }: { cityId?: string }) {
  const [activeTab, setActiveTab] = useState("profiles");

  return (
    <div data-testid="cora-voice-panel" className="space-y-4">
      <div className="flex items-center gap-3">
        <Mic className="w-5 h-5 text-violet-400" />
        <h2 className="font-semibold text-lg">Voice & Agent Prep</h2>
        <Badge variant="outline" className="text-xs">Draft-First</Badge>
      </div>
      <p className="text-sm text-muted-foreground">Configure voice personas, call campaigns, scripts, and answer flows. Everything starts as a draft requiring explicit approval.</p>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-5 w-full">
          <TabsTrigger data-testid="tab-voice-profiles" value="profiles" className="text-xs">Profiles</TabsTrigger>
          <TabsTrigger data-testid="tab-voice-campaigns" value="campaigns" className="text-xs">Campaigns</TabsTrigger>
          <TabsTrigger data-testid="tab-voice-scripts" value="scripts" className="text-xs">Scripts</TabsTrigger>
          <TabsTrigger data-testid="tab-voice-inbound" value="inbound" className="text-xs">Inbound</TabsTrigger>
          <TabsTrigger data-testid="tab-voice-outbound" value="outbound" className="text-xs">Outbound</TabsTrigger>
        </TabsList>

        <ScrollArea className="mt-4" style={{ maxHeight: "calc(100vh - 260px)" }}>
          <TabsContent value="profiles"><VoiceProfilesSection /></TabsContent>
          <TabsContent value="campaigns"><CallCampaignsSection /></TabsContent>
          <TabsContent value="scripts"><DraftScriptsSection /></TabsContent>
          <TabsContent value="inbound"><AnswerFlowsSection /></TabsContent>
          <TabsContent value="outbound"><OutboundFlowsSection /></TabsContent>
        </ScrollArea>
      </Tabs>
    </div>
  );
}
