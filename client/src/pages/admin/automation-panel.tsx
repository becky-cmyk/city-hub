import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Zap, Plus, Edit, Trash2, Play, Pause, Clock, CheckCircle, AlertCircle, FileText } from "lucide-react";
import type { AutomationRule, AutomationLogEntry } from "@shared/schema";

const TRIGGER_EVENTS = [
  { value: "booking_no_response", label: "Booking No Response" },
  { value: "content_published", label: "Content Published" },
  { value: "story_approved", label: "Story Approved" },
  { value: "lead_created", label: "Lead Created" },
  { value: "event_rsvp", label: "Event RSVP" },
];

const ACTION_TYPES = [
  { value: "send_email", label: "Send Email" },
  { value: "update_status", label: "Update Status" },
  { value: "generate_content", label: "Generate Content" },
  { value: "create_notification", label: "Create Notification" },
];

interface AutomationPanelProps {
  cityId?: string;
}

export default function AutomationPanel({ cityId }: AutomationPanelProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"rules" | "logs">("rules");
  const [showForm, setShowForm] = useState(false);
  const [editingRule, setEditingRule] = useState<AutomationRule | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    triggerEvent: "lead_created" as string,
    delayMinutes: 0,
    actionType: "create_notification" as string,
    actionConfig: "{}",
    isActive: true,
    cityId: cityId || null as string | null,
  });

  const rulesUrl = cityId
    ? `/api/admin/automation/rules?cityId=${encodeURIComponent(cityId)}`
    : "/api/admin/automation/rules";

  const { data: rules = [], isLoading: rulesLoading } = useQuery<AutomationRule[]>({
    queryKey: ["/api/admin/automation/rules", cityId],
    queryFn: async () => {
      const res = await fetch(rulesUrl, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch rules");
      return res.json();
    },
  });

  const { data: logs = [], isLoading: logsLoading } = useQuery<AutomationLogEntry[]>({
    queryKey: ["/api/admin/automation/logs", cityId],
    queryFn: async () => {
      const res = await fetch("/api/admin/automation/logs?limit=100", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch logs");
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/admin/automation/rules", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/automation/rules"] });
      toast({ title: "Rule created" });
      resetForm();
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await apiRequest("PATCH", `/api/admin/automation/rules/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/automation/rules"] });
      toast({ title: "Rule updated" });
      resetForm();
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/admin/automation/rules/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/automation/rules"] });
      toast({ title: "Rule deleted" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const res = await apiRequest("PATCH", `/api/admin/automation/rules/${id}`, { isActive });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/automation/rules"] });
    },
  });

  function resetForm() {
    setShowForm(false);
    setEditingRule(null);
    setFormData({
      name: "",
      description: "",
      triggerEvent: "lead_created",
      delayMinutes: 0,
      actionType: "create_notification",
      actionConfig: "{}",
      isActive: true,
      cityId: cityId || null,
    });
  }

  function openEditForm(rule: AutomationRule) {
    setEditingRule(rule);
    setFormData({
      name: rule.name || "",
      description: rule.description || "",
      triggerEvent: rule.triggerEvent,
      delayMinutes: rule.delayMinutes,
      actionType: rule.actionType,
      actionConfig: JSON.stringify(rule.actionConfig || {}, null, 2),
      isActive: rule.isActive,
      cityId: rule.cityId,
    });
    setShowForm(true);
  }

  function handleSubmit() {
    let actionConfig: any;
    try {
      actionConfig = JSON.parse(formData.actionConfig);
    } catch {
      toast({ title: "Invalid JSON in action config", variant: "destructive" });
      return;
    }

    const payload = {
      name: formData.name || null,
      description: formData.description || null,
      triggerEvent: formData.triggerEvent,
      delayMinutes: formData.delayMinutes,
      actionType: formData.actionType,
      actionConfig,
      isActive: formData.isActive,
      cityId: formData.cityId || null,
    };

    if (editingRule) {
      updateMutation.mutate({ id: editingRule.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  const getTriggerLabel = (val: string) => TRIGGER_EVENTS.find(t => t.value === val)?.label || val;
  const getActionLabel = (val: string) => ACTION_TYPES.find(a => a.value === val)?.label || val;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2" data-testid="text-automation-title">
            <Zap className="h-6 w-6" />
            Automation Engine
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Configure trigger-based rules to automate follow-ups, status changes, and notifications
          </p>
        </div>
        <Button onClick={() => { resetForm(); setShowForm(true); }} data-testid="button-create-rule">
          <Plus className="h-4 w-4 mr-1" /> New Rule
        </Button>
      </div>

      <div className="flex gap-2">
        <Button
          variant={activeTab === "rules" ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveTab("rules")}
          data-testid="button-tab-rules"
        >
          <Zap className="h-4 w-4 mr-1" /> Rules ({rules.length})
        </Button>
        <Button
          variant={activeTab === "logs" ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveTab("logs")}
          data-testid="button-tab-logs"
        >
          <FileText className="h-4 w-4 mr-1" /> Execution Log
        </Button>
      </div>

      {activeTab === "rules" && (
        <div className="space-y-3">
          {rulesLoading ? (
            Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)
          ) : rules.length === 0 ? (
            <Card className="p-8 text-center text-muted-foreground">
              <Zap className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>No automation rules yet. Create one to get started.</p>
            </Card>
          ) : (
            rules.map((rule) => (
              <Card key={rule.id} className="p-4" data-testid={`card-rule-${rule.id}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold truncate" data-testid={`text-rule-name-${rule.id}`}>
                        {rule.name || "Unnamed Rule"}
                      </span>
                      <Badge variant={rule.isActive ? "default" : "secondary"} data-testid={`badge-rule-status-${rule.id}`}>
                        {rule.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    {rule.description && (
                      <p className="text-sm text-muted-foreground mb-2">{rule.description}</p>
                    )}
                    <div className="flex flex-wrap gap-2 text-xs">
                      <Badge variant="outline">
                        Trigger: {getTriggerLabel(rule.triggerEvent)}
                      </Badge>
                      <Badge variant="outline">
                        Action: {getActionLabel(rule.actionType)}
                      </Badge>
                      {rule.delayMinutes > 0 && (
                        <Badge variant="outline">
                          <Clock className="h-3 w-3 mr-1" />
                          {rule.delayMinutes}m delay
                        </Badge>
                      )}
                      {rule.cityId && (
                        <Badge variant="outline">City-scoped</Badge>
                      )}
                      {!rule.cityId && (
                        <Badge variant="outline">Platform-wide</Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Switch
                      checked={rule.isActive}
                      onCheckedChange={(checked) => toggleMutation.mutate({ id: rule.id, isActive: checked })}
                      data-testid={`switch-rule-active-${rule.id}`}
                    />
                    <Button variant="ghost" size="icon" onClick={() => openEditForm(rule)} data-testid={`button-edit-rule-${rule.id}`}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        if (confirm("Delete this rule?")) deleteMutation.mutate(rule.id);
                      }}
                      data-testid={`button-delete-rule-${rule.id}`}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      {activeTab === "logs" && (
        <div className="space-y-3">
          {logsLoading ? (
            Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)
          ) : logs.length === 0 ? (
            <Card className="p-8 text-center text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>No automation executions yet.</p>
            </Card>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-3 font-medium">Action</th>
                    <th className="text-left p-3 font-medium">Status</th>
                    <th className="text-left p-3 font-medium">Details</th>
                    <th className="text-left p-3 font-medium">Executed</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id} className="border-t" data-testid={`row-log-${log.id}`}>
                      <td className="p-3">
                        <Badge variant="outline">{getActionLabel(log.actionType)}</Badge>
                      </td>
                      <td className="p-3">
                        {log.error ? (
                          <Badge variant="destructive" className="gap-1">
                            <AlertCircle className="h-3 w-3" /> Error
                          </Badge>
                        ) : (
                          <Badge variant="default" className="gap-1 bg-green-600">
                            <CheckCircle className="h-3 w-3" /> Success
                          </Badge>
                        )}
                      </td>
                      <td className="p-3 text-xs text-muted-foreground max-w-[300px] truncate">
                        {log.error || (log.result ? JSON.stringify(log.result) : "-")}
                      </td>
                      <td className="p-3 text-xs text-muted-foreground">
                        {log.executedAt ? new Date(log.executedAt).toLocaleString() : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <Dialog open={showForm} onOpenChange={(open) => { if (!open) resetForm(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle data-testid="text-form-title">
              {editingRule ? "Edit Automation Rule" : "Create Automation Rule"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Rule Name</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Email new leads"
                data-testid="input-rule-name"
              />
            </div>
            <div>
              <Label>Description</Label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="What does this rule do?"
                data-testid="input-rule-description"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Trigger Event</Label>
                <Select value={formData.triggerEvent} onValueChange={(v) => setFormData({ ...formData, triggerEvent: v })}>
                  <SelectTrigger data-testid="select-trigger-event">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TRIGGER_EVENTS.map(t => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Action Type</Label>
                <Select value={formData.actionType} onValueChange={(v) => setFormData({ ...formData, actionType: v })}>
                  <SelectTrigger data-testid="select-action-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ACTION_TYPES.map(a => (
                      <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Delay (minutes)</Label>
              <Input
                type="number"
                min={0}
                value={formData.delayMinutes}
                onChange={(e) => setFormData({ ...formData, delayMinutes: parseInt(e.target.value) || 0 })}
                data-testid="input-delay-minutes"
              />
              <p className="text-xs text-muted-foreground mt-1">
                How long to wait after the trigger fires before executing the action
              </p>
            </div>
            <div>
              <Label>Action Config (JSON)</Label>
              <Textarea
                value={formData.actionConfig}
                onChange={(e) => setFormData({ ...formData, actionConfig: e.target.value })}
                rows={4}
                className="font-mono text-xs"
                placeholder='{"templateKey": "welcome", "toEmail": "{{email}}"}'
                data-testid="input-action-config"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {formData.actionType === "send_email" && 'Keys: templateKey (required), toEmail (optional, uses payload email)'}
                {formData.actionType === "update_status" && 'Keys: newStatus (required)'}
                {formData.actionType === "generate_content" && 'Keys: cityId (optional, uses payload cityId)'}
                {formData.actionType === "create_notification" && 'Keys: notificationTitle, notificationBody, priority'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Label>City-scoped</Label>
              <Switch
                checked={!!formData.cityId}
                onCheckedChange={(checked) => setFormData({ ...formData, cityId: checked && cityId ? cityId : null })}
                disabled={!cityId}
                data-testid="switch-city-scoped"
              />
              <span className="text-xs text-muted-foreground">
                {formData.cityId ? "Applies to current city only" : "Platform-wide"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Label>Active</Label>
              <Switch
                checked={formData.isActive}
                onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                data-testid="switch-form-active"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetForm} data-testid="button-cancel-form">Cancel</Button>
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
              data-testid="button-save-rule"
            >
              {(createMutation.isPending || updateMutation.isPending) ? "Saving..." : (editingRule ? "Update Rule" : "Create Rule")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
