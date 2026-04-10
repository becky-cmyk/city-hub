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
import { Switch } from "@/components/ui/switch";
import { Plus, Mic } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const PROMPT_TYPES = ["GREETING", "VOICEMAIL", "IVR_MENU", "ESCALATION", "FOLLOW_UP"] as const;
const CALL_TRIGGERS = ["INBOUND_CALL", "OUTBOUND_CAMPAIGN", "MISSED_CALL_CALLBACK", "SCHEDULED_FOLLOWUP", "MANUAL"] as const;

export default function VoicePromptsPanel() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [promptType, setPromptType] = useState<string>("GREETING");
  const [scriptText, setScriptText] = useState("");
  const [callTrigger, setCallTrigger] = useState<string>("MANUAL");

  const { data: prompts = [], isLoading } = useQuery<Array<{
    id: string; name: string; promptType: string; scriptText: string;
    callTrigger: string; isActive: boolean; createdAt: string;
  }>>({ queryKey: ["/api/admin/comm/voice-prompts"] });

  const createMutation = useMutation({
    mutationFn: (data: { name: string; promptType: string; scriptText: string; callTrigger: string }) =>
      apiRequest("POST", "/api/admin/comm/voice-prompts", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/comm/voice-prompts"] });
      setOpen(false);
      setName("");
      setScriptText("");
      setPromptType("GREETING");
      setCallTrigger("MANUAL");
      toast({ title: "Voice prompt created" });
    },
    onError: () => toast({ title: "Failed to create voice prompt", variant: "destructive" }),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      apiRequest("PATCH", `/api/admin/comm/voice-prompts/${id}`, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/comm/voice-prompts"] });
    },
    onError: () => toast({ title: "Failed to update voice prompt", variant: "destructive" }),
  });

  if (isLoading) {
    return <div className="flex items-center justify-center p-12 text-muted-foreground" data-testid="loading-voice-prompts">Loading voice prompts...</div>;
  }

  return (
    <div className="space-y-4" data-testid="panel-voice-prompts">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground" data-testid="text-voice-prompts-count">
          {prompts.length} prompt{prompts.length !== 1 ? "s" : ""}
        </p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-voice-prompt">
              <Plus className="h-4 w-4 mr-1.5" />
              New Voice Prompt
            </Button>
          </DialogTrigger>
          <DialogContent data-testid="dialog-create-voice-prompt">
            <DialogHeader>
              <DialogTitle>Create Voice Prompt</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="voice-prompt-name">Prompt Name</Label>
                <Input
                  id="voice-prompt-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Welcome Greeting"
                  data-testid="input-voice-prompt-name"
                />
              </div>
              <div>
                <Label htmlFor="voice-prompt-type">Prompt Type</Label>
                <Select value={promptType} onValueChange={setPromptType}>
                  <SelectTrigger data-testid="select-voice-prompt-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PROMPT_TYPES.map((t) => (
                      <SelectItem key={t} value={t} data-testid={`option-prompt-type-${t}`}>
                        {t.replace(/_/g, " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="voice-call-trigger">Call Trigger</Label>
                <Select value={callTrigger} onValueChange={setCallTrigger}>
                  <SelectTrigger data-testid="select-voice-call-trigger">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CALL_TRIGGERS.map((t) => (
                      <SelectItem key={t} value={t} data-testid={`option-call-trigger-${t}`}>
                        {t.replace(/_/g, " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="voice-prompt-script">Script Text</Label>
                <Textarea
                  id="voice-prompt-script"
                  value={scriptText}
                  onChange={(e) => setScriptText(e.target.value)}
                  placeholder="Hello, thank you for calling CityMetroHub..."
                  rows={5}
                  data-testid="textarea-voice-prompt-script"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={() => createMutation.mutate({ name, promptType, scriptText, callTrigger })}
                disabled={!name.trim() || !scriptText.trim() || createMutation.isPending}
                data-testid="button-submit-voice-prompt"
              >
                {createMutation.isPending ? "Creating..." : "Create Prompt"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {prompts.length === 0 ? (
        <Card data-testid="card-empty-voice-prompts">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Mic className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-muted-foreground">No voice prompts yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {prompts.map((p) => (
            <Card key={p.id} className={!p.isActive ? "opacity-60" : ""} data-testid={`card-voice-prompt-${p.id}`}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium" data-testid={`text-prompt-name-${p.id}`}>{p.name}</CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" data-testid={`badge-prompt-type-${p.id}`}>
                      {p.promptType.replace(/_/g, " ")}
                    </Badge>
                    <Badge variant="secondary" data-testid={`badge-call-trigger-${p.id}`}>
                      {p.callTrigger.replace(/_/g, " ")}
                    </Badge>
                    <Switch
                      checked={p.isActive}
                      onCheckedChange={(checked) => toggleMutation.mutate({ id: p.id, isActive: checked })}
                      data-testid={`switch-prompt-active-${p.id}`}
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap" data-testid={`text-prompt-script-${p.id}`}>{p.scriptText}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
