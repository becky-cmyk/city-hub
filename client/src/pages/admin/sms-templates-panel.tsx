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
import { Plus, FileText, ToggleLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const CATEGORIES = ["INTRO", "FOLLOW_UP", "BOOKING_REMINDER", "CLAIM_PROMPT", "WELCOME", "CUSTOM"] as const;

export default function SmsTemplatesPanel() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState<string>("CUSTOM");

  const { data: templates = [], isLoading } = useQuery<Array<{
    id: string; name: string; body: string; category: string;
    charCount: number; isActive: boolean; createdAt: string;
  }>>({ queryKey: ["/api/admin/comm/sms-templates"] });

  const createMutation = useMutation({
    mutationFn: (data: { name: string; body: string; category: string }) =>
      apiRequest("POST", "/api/admin/comm/sms-templates", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/comm/sms-templates"] });
      setOpen(false);
      setName("");
      setBody("");
      setCategory("CUSTOM");
      toast({ title: "SMS template created" });
    },
    onError: () => toast({ title: "Failed to create template", variant: "destructive" }),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      apiRequest("PATCH", `/api/admin/comm/sms-templates/${id}`, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/comm/sms-templates"] });
    },
    onError: () => toast({ title: "Failed to update template", variant: "destructive" }),
  });

  if (isLoading) {
    return <div className="flex items-center justify-center p-12 text-muted-foreground" data-testid="loading-sms-templates">Loading SMS templates...</div>;
  }

  return (
    <div className="space-y-4" data-testid="panel-sms-templates">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground" data-testid="text-sms-templates-count">
          {templates.length} template{templates.length !== 1 ? "s" : ""}
        </p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-sms-template">
              <Plus className="h-4 w-4 mr-1.5" />
              New Template
            </Button>
          </DialogTrigger>
          <DialogContent data-testid="dialog-create-sms-template">
            <DialogHeader>
              <DialogTitle>Create SMS Template</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="sms-template-name">Template Name</Label>
                <Input
                  id="sms-template-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Welcome SMS"
                  data-testid="input-sms-template-name"
                />
              </div>
              <div>
                <Label htmlFor="sms-template-category">Category</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger data-testid="select-sms-template-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c} data-testid={`option-category-${c}`}>
                        {c.replace(/_/g, " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="sms-template-body">Message Body</Label>
                <Textarea
                  id="sms-template-body"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Hi {{name}}, welcome to CityMetroHub..."
                  rows={4}
                  data-testid="textarea-sms-template-body"
                />
                <p className="text-xs text-muted-foreground mt-1" data-testid="text-char-count">
                  {body.length} / 160 characters{body.length > 160 ? " (multi-segment)" : ""}
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={() => createMutation.mutate({ name, body, category })}
                disabled={!name.trim() || !body.trim() || createMutation.isPending}
                data-testid="button-submit-sms-template"
              >
                {createMutation.isPending ? "Creating..." : "Create Template"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {templates.length === 0 ? (
        <Card data-testid="card-empty-sms-templates">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-muted-foreground">No SMS templates yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {templates.map((t) => (
            <Card key={t.id} className={!t.isActive ? "opacity-60" : ""} data-testid={`card-sms-template-${t.id}`}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium" data-testid={`text-template-name-${t.id}`}>{t.name}</CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" data-testid={`badge-template-category-${t.id}`}>
                      {t.category.replace(/_/g, " ")}
                    </Badge>
                    <Switch
                      checked={t.isActive}
                      onCheckedChange={(checked) => toggleMutation.mutate({ id: t.id, isActive: checked })}
                      data-testid={`switch-template-active-${t.id}`}
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap" data-testid={`text-template-body-${t.id}`}>{t.body}</p>
                <p className="text-xs text-muted-foreground mt-2" data-testid={`text-template-chars-${t.id}`}>
                  {t.charCount} chars
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
