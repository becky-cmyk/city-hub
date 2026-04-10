import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, Workflow, Mail, MessageCircle, Phone, ArrowRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  ACTIVE: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  PAUSED: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  ARCHIVED: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
};

const CHANNEL_ICONS: Record<string, typeof Mail> = {
  EMAIL: Mail,
  SMS: MessageCircle,
  VOICE: Phone,
};

type Step = {
  channel: "EMAIL" | "SMS" | "VOICE";
  delayMinutes: number;
  conditionType: string;
  fallbackChannel?: string | null;
};

type Sequence = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  triggerEvent: string;
  createdAt: string;
  steps: Array<{
    id: string;
    stepOrder: number;
    channel: string;
    delayMinutes: number;
    conditionType: string;
    fallbackChannel: string | null;
  }>;
};

export default function CommSequencesPanel() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [triggerEvent, setTriggerEvent] = useState("CONTACT_CREATED");
  const [steps, setSteps] = useState<Step[]>([
    { channel: "EMAIL", delayMinutes: 0, conditionType: "ALWAYS" },
  ]);

  const { data: sequences = [], isLoading } = useQuery<Sequence[]>({
    queryKey: ["/api/admin/comm/sequences"],
  });

  const createMutation = useMutation({
    mutationFn: (data: { name: string; description: string; triggerEvent: string; steps: Step[] }) =>
      apiRequest("POST", "/api/admin/comm/sequences", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/comm/sequences"] });
      setOpen(false);
      setName("");
      setDescription("");
      setSteps([{ channel: "EMAIL", delayMinutes: 0, conditionType: "ALWAYS" }]);
      toast({ title: "Sequence created" });
    },
    onError: () => toast({ title: "Failed to create sequence", variant: "destructive" }),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiRequest("PATCH", `/api/admin/comm/sequences/${id}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/comm/sequences"] });
    },
    onError: () => toast({ title: "Failed to update sequence status", variant: "destructive" }),
  });

  const addStep = () => {
    setSteps([...steps, { channel: "EMAIL", delayMinutes: 60, conditionType: "ALWAYS" }]);
  };

  const updateStep = (idx: number, field: keyof Step, value: string | number) => {
    const updated = [...steps];
    (updated[idx] as Record<string, unknown>)[field] = value;
    setSteps(updated);
  };

  const removeStep = (idx: number) => {
    if (steps.length <= 1) return;
    setSteps(steps.filter((_, i) => i !== idx));
  };

  if (isLoading) {
    return <div className="flex items-center justify-center p-12 text-muted-foreground" data-testid="loading-sequences">Loading sequences...</div>;
  }

  return (
    <div className="space-y-4" data-testid="panel-comm-sequences">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground" data-testid="text-sequences-count">
          {sequences.length} sequence{sequences.length !== 1 ? "s" : ""}
        </p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-sequence">
              <Plus className="h-4 w-4 mr-1.5" />
              New Sequence
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-xl" data-testid="dialog-create-sequence">
            <DialogHeader>
              <DialogTitle>Create Communication Sequence</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 max-h-[60vh] overflow-y-auto">
              <div>
                <Label htmlFor="seq-name">Sequence Name</Label>
                <Input
                  id="seq-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. New Contact Welcome Flow"
                  data-testid="input-sequence-name"
                />
              </div>
              <div>
                <Label htmlFor="seq-description">Description</Label>
                <Textarea
                  id="seq-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What this sequence does..."
                  rows={2}
                  data-testid="textarea-sequence-description"
                />
              </div>
              <div>
                <Label htmlFor="seq-trigger">Trigger Event</Label>
                <Select value={triggerEvent} onValueChange={setTriggerEvent}>
                  <SelectTrigger data-testid="select-trigger-event">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CONTACT_CREATED">Contact Created</SelectItem>
                    <SelectItem value="LISTING_CLAIMED">Listing Claimed</SelectItem>
                    <SelectItem value="BOOKING_CONFIRMED">Booking Confirmed</SelectItem>
                    <SelectItem value="FOLLOW_UP_DUE">Follow-up Due</SelectItem>
                    <SelectItem value="MANUAL">Manual Trigger</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <Label>Steps</Label>
                {steps.map((step, idx) => (
                  <div key={idx} className="border rounded-md p-3 space-y-2" data-testid={`step-${idx}`}>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Step {idx + 1}</span>
                      {steps.length > 1 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeStep(idx)}
                          data-testid={`button-remove-step-${idx}`}
                        >
                          Remove
                        </Button>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <Label className="text-xs">Channel</Label>
                        <Select value={step.channel} onValueChange={(v) => updateStep(idx, "channel", v)}>
                          <SelectTrigger data-testid={`select-step-channel-${idx}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="EMAIL">Email</SelectItem>
                            <SelectItem value="SMS">SMS</SelectItem>
                            <SelectItem value="VOICE">Voice</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs">Delay (min)</Label>
                        <Input
                          type="number"
                          min={0}
                          value={step.delayMinutes}
                          onChange={(e) => updateStep(idx, "delayMinutes", parseInt(e.target.value) || 0)}
                          data-testid={`input-step-delay-${idx}`}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Condition</Label>
                        <Select value={step.conditionType} onValueChange={(v) => updateStep(idx, "conditionType", v)}>
                          <SelectTrigger data-testid={`select-step-condition-${idx}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ALWAYS">Always</SelectItem>
                            <SelectItem value="NO_RESPONSE">No Response</SelectItem>
                            <SelectItem value="NO_OPEN">No Open</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={addStep} data-testid="button-add-step">
                  <Plus className="h-3 w-3 mr-1" />
                  Add Step
                </Button>
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={() => createMutation.mutate({ name, description, triggerEvent, steps })}
                disabled={!name.trim() || createMutation.isPending}
                data-testid="button-submit-sequence"
              >
                {createMutation.isPending ? "Creating..." : "Create Sequence"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {sequences.length === 0 ? (
        <Card data-testid="card-empty-sequences">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Workflow className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-muted-foreground">No communication sequences yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {sequences.map((seq) => (
            <Card key={seq.id} data-testid={`card-sequence-${seq.id}`}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-sm font-medium" data-testid={`text-sequence-name-${seq.id}`}>{seq.name}</CardTitle>
                    {seq.description && (
                      <p className="text-xs text-muted-foreground mt-0.5" data-testid={`text-sequence-desc-${seq.id}`}>{seq.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={STATUS_COLORS[seq.status] || ""} data-testid={`badge-sequence-status-${seq.id}`}>
                      {seq.status}
                    </Badge>
                    {seq.status === "DRAFT" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => statusMutation.mutate({ id: seq.id, status: "ACTIVE" })}
                        data-testid={`button-activate-${seq.id}`}
                      >
                        Activate
                      </Button>
                    )}
                    {seq.status === "ACTIVE" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => statusMutation.mutate({ id: seq.id, status: "PAUSED" })}
                        data-testid={`button-pause-${seq.id}`}
                      >
                        Pause
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-1 flex-wrap" data-testid={`steps-flow-${seq.id}`}>
                  <Badge variant="outline" className="text-xs">
                    {seq.triggerEvent.replace(/_/g, " ")}
                  </Badge>
                  {seq.steps.map((step, idx) => {
                    const Icon = CHANNEL_ICONS[step.channel] || Mail;
                    return (
                      <div key={step.id} className="flex items-center gap-1">
                        <ArrowRight className="h-3 w-3 text-muted-foreground" />
                        <div className="flex items-center gap-1 border rounded px-2 py-0.5">
                          <Icon className="h-3 w-3" />
                          <span className="text-xs">{step.channel}</span>
                          {step.delayMinutes > 0 && (
                            <span className="text-xs text-muted-foreground">
                              +{step.delayMinutes >= 60 ? `${Math.round(step.delayMinutes / 60)}h` : `${step.delayMinutes}m`}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
