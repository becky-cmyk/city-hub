import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Mail, Plus, Edit, Trash2, Send, History } from "lucide-react";
import { useState, useCallback } from "react";
import EmailBlockEditor, { type EmailBlock, extractBlocksFromHtml } from "@/components/email-block-editor";

type EmailTemplate = {
  id: string;
  templateKey: string;
  classification: string;
  name: string;
  subject: string;
  preheader: string | null;
  htmlBody: string;
  textBody: string | null;
  brandId: string | null;
  status: string;
  createdByUserId: string | null;
  updatedByUserId: string | null;
  createdAt: string;
  updatedAt: string;
};

type Revision = {
  id: string;
  changedBy: string | null;
  changeType: string;
  changedFields: Record<string, unknown> | null;
  createdAt: string;
};

const TEMPLATE_KEYS = ["welcome", "prospecting", "claim_invite", "weekly_hub", "weekend_hub", "story_outreach_a", "story_outreach_b"] as const;
const CLASSIFICATIONS = ["marketing", "transactional"] as const;
const STATUSES = ["draft", "active", "archived"] as const;

function statusVariant(status: string): "default" | "secondary" | "outline" {
  if (status === "active") return "default";
  if (status === "archived") return "outline";
  return "secondary";
}

function TemplateForm({ template, onClose }: { template?: EmailTemplate; onClose: () => void }) {
  const { toast } = useToast();
  const [name, setName] = useState(template?.name || "");
  const [templateKey, setTemplateKey] = useState(template?.templateKey || "");
  const [classification, setClassification] = useState(template?.classification || "transactional");
  const [subject, setSubject] = useState(template?.subject || "");
  const [preheader, setPreheader] = useState(template?.preheader || "");
  const [htmlBody, setHtmlBody] = useState(template?.htmlBody || "");
  const [blocks, setBlocks] = useState<EmailBlock[]>(() => {
    if (template?.htmlBody) {
      const extracted = extractBlocksFromHtml(template.htmlBody);
      if (extracted) return extracted;
    }
    return [];
  });
  const [textBody, setTextBody] = useState(template?.textBody || "");
  const [status, setStatus] = useState(template?.status || "draft");
  const handleBlocksChange = useCallback((newBlocks: EmailBlock[]) => {
    setBlocks(newBlocks);
  }, []);

  const handleHtmlChange = useCallback((html: string) => {
    setHtmlBody(html);
  }, []);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload: Record<string, any> = {
        name,
        templateKey,
        classification,
        subject,
        preheader: preheader || null,
        htmlBody,
        textBody: textBody || null,
        status,
      };
      if (template) {
        return apiRequest("PATCH", `/api/admin/email-templates/${template.id}`, payload);
      }
      return apiRequest("POST", "/api/admin/email-templates", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/email-templates"] });
      toast({ title: template ? "Template updated" : "Template created" });
      onClose();
    },
    onError: (err: any) => {
      toast({ title: "Error saving template", description: err.message, variant: "destructive" });
    },
  });

  return (
    <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>{template ? "Edit Template" : "New Email Template"}</DialogTitle>
      </DialogHeader>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Name *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Template name" data-testid="input-template-name" />
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger data-testid="select-template-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Template Key *</Label>
            <Select value={templateKey} onValueChange={setTemplateKey}>
              <SelectTrigger data-testid="select-template-key">
                <SelectValue placeholder="Select key" />
              </SelectTrigger>
              <SelectContent>
                {TEMPLATE_KEYS.map((k) => (
                  <SelectItem key={k} value={k}>{k.replace(/_/g, " ")}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Classification *</Label>
            <Select value={classification} onValueChange={setClassification}>
              <SelectTrigger data-testid="select-classification">
                <SelectValue placeholder="Select classification" />
              </SelectTrigger>
              <SelectContent>
                {CLASSIFICATIONS.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Subject *</Label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Email subject line" data-testid="input-template-subject" />
          </div>
          <div className="space-y-1.5">
            <Label>Preheader</Label>
            <Input value={preheader} onChange={(e) => setPreheader(e.target.value)} placeholder="Preview text (optional)" data-testid="input-template-preheader" />
          </div>
        </div>

        <div className="border-t pt-3">
          <EmailBlockEditor
            blocks={blocks}
            onBlocksChange={handleBlocksChange}
            onHtmlChange={handleHtmlChange}
            legacyHtml={template && blocks.length === 0 && template.htmlBody ? template.htmlBody : undefined}
          />
        </div>

        <div className="space-y-1.5">
          <Label>Text Body (optional plain text)</Label>
          <Textarea
            value={textBody}
            onChange={(e) => setTextBody(e.target.value)}
            placeholder="Plain text version..."
            rows={3}
            data-testid="input-template-text-body"
          />
        </div>

        <div className="flex gap-2 pt-2">
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || !name || !templateKey || !subject || !htmlBody}
            data-testid="button-save-template"
          >
            {saveMutation.isPending ? "Saving..." : template ? "Update Template" : "Create Template"}
          </Button>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
        </div>
      </div>
    </DialogContent>
  );
}

function TestSendDialog({ template, onClose }: { template: EmailTemplate; onClose: () => void }) {
  const { toast } = useToast();
  const [toEmail, setToEmail] = useState("");

  const sendMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/admin/email-templates/${template.id}/test-send`, { toEmail });
    },
    onSuccess: () => {
      toast({ title: "Test email sent", description: `Sent to ${toEmail}` });
      onClose();
    },
    onError: (err: any) => {
      toast({ title: "Error sending test", description: err.message, variant: "destructive" });
    },
  });

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Send Test Email</DialogTitle>
      </DialogHeader>
      <p className="text-sm text-muted-foreground">Send a test of "{template.name}" to a recipient.</p>
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label>Recipient Email *</Label>
          <Input
            type="email"
            value={toEmail}
            onChange={(e) => setToEmail(e.target.value)}
            placeholder="test@example.com"
            data-testid="input-test-send-email"
          />
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => sendMutation.mutate()}
            disabled={sendMutation.isPending || !toEmail}
            data-testid="button-confirm-test-send"
          >
            <Send className="h-4 w-4 mr-1" />
            {sendMutation.isPending ? "Sending..." : "Send Test"}
          </Button>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
        </div>
      </div>
    </DialogContent>
  );
}

function RevisionsDialog({ template, onClose }: { template: EmailTemplate; onClose: () => void }) {
  const { data: revisions, isLoading } = useQuery<Revision[]>({
    queryKey: ["/api/admin/email-templates", template.id, "revisions"],
    queryFn: async () => {
      const res = await fetch(`/api/admin/email-templates/${template.id}/revisions`);
      if (!res.ok) throw new Error("Failed to load revisions");
      return res.json();
    },
  });

  return (
    <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Revision History - {template.name}</DialogTitle>
      </DialogHeader>
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      ) : !revisions || revisions.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">No revisions found</p>
      ) : (
        <div className="space-y-2">
          {revisions.map((rev) => (
            <Card key={rev.id} className="p-3" data-testid={`card-revision-${rev.id}`}>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <Badge variant="secondary" data-testid={`badge-revision-type-${rev.id}`}>{rev.changeType}</Badge>
                <span className="text-xs text-muted-foreground" data-testid={`text-revision-date-${rev.id}`}>
                  {new Date(rev.createdAt).toLocaleString()}
                </span>
              </div>
              {rev.changedBy && (
                <p className="text-xs text-muted-foreground mt-1">By: {rev.changedBy}</p>
              )}
              {rev.changedFields && (
                <p className="text-xs text-muted-foreground mt-1">
                  Fields: {Object.keys(rev.changedFields).join(", ")}
                </p>
              )}
            </Card>
          ))}
        </div>
      )}
      <div className="flex justify-end pt-2">
        <Button variant="outline" onClick={onClose}>Close</Button>
      </div>
    </DialogContent>
  );
}

export default function EmailTemplatesPanel({ cityId }: { cityId?: string }) {
  const { toast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
  const [deletingTemplate, setDeletingTemplate] = useState<EmailTemplate | null>(null);
  const [testSendTemplate, setTestSendTemplate] = useState<EmailTemplate | null>(null);
  const [revisionsTemplate, setRevisionsTemplate] = useState<EmailTemplate | null>(null);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterKey, setFilterKey] = useState("");

  const queryParams = new URLSearchParams();
  if (filterStatus) queryParams.set("status", filterStatus);
  if (filterKey) queryParams.set("templateKey", filterKey);
  const qs = queryParams.toString();

  const { data: templates, isLoading } = useQuery<EmailTemplate[]>({
    queryKey: ["/api/admin/email-templates", qs],
    queryFn: async () => {
      const res = await fetch(`/api/admin/email-templates${qs ? `?${qs}` : ""}`);
      if (!res.ok) throw new Error("Failed to load templates");
      return res.json();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/admin/email-templates/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/email-templates"] });
      toast({ title: "Template deleted" });
      setDeletingTemplate(null);
    },
    onError: (err: any) => {
      toast({ title: "Error deleting template", description: err.message, variant: "destructive" });
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="font-semibold text-lg flex items-center gap-2" data-testid="text-email-templates-title">
            <Mail className="h-5 w-5" /> Email Templates
          </h2>
          <p className="text-sm text-muted-foreground">Manage transactional and marketing email templates</p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)} data-testid="button-create-template">
          <Plus className="h-4 w-4 mr-1" /> New Template
        </Button>
      </div>

      <div className="flex gap-2 flex-wrap">
        <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v === "all" ? "" : v)}>
          <SelectTrigger className="w-[140px]" data-testid="select-filter-status">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterKey} onValueChange={(v) => setFilterKey(v === "all" ? "" : v)}>
          <SelectTrigger className="w-[180px]" data-testid="select-filter-template-key">
            <SelectValue placeholder="All template keys" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All template keys</SelectItem>
            {TEMPLATE_KEYS.map((k) => (
              <SelectItem key={k} value={k}>{k.replace(/_/g, " ")}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      ) : !templates || templates.length === 0 ? (
        <Card className="p-8 text-center">
          <Mail className="mx-auto h-10 w-10 text-muted-foreground/40 mb-3" />
          <h3 className="font-semibold mb-1">No email templates found</h3>
          <p className="text-sm text-muted-foreground">Create your first template to get started</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {templates.map((tpl) => (
            <Card key={tpl.id} className="p-4" data-testid={`card-template-${tpl.id}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h3 className="font-semibold truncate" data-testid={`text-template-name-${tpl.id}`}>
                      {tpl.name}
                    </h3>
                    <Badge variant={statusVariant(tpl.status)} data-testid={`badge-status-${tpl.id}`}>
                      {tpl.status}
                    </Badge>
                    <Badge variant="outline" data-testid={`badge-classification-${tpl.id}`}>
                      {tpl.classification}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground" data-testid={`text-template-key-${tpl.id}`}>
                    {tpl.templateKey.replace(/_/g, " ")} &middot; Subject: {tpl.subject}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5" data-testid={`text-template-updated-${tpl.id}`}>
                    Updated: {new Date(tpl.updatedAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex gap-1 shrink-0 flex-wrap">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setTestSendTemplate(tpl)}
                    data-testid={`button-test-send-${tpl.id}`}
                  >
                    <Send className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setRevisionsTemplate(tpl)}
                    data-testid={`button-revisions-${tpl.id}`}
                  >
                    <History className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setEditingTemplate(tpl)}
                    data-testid={`button-edit-template-${tpl.id}`}
                  >
                    <Edit className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setDeletingTemplate(tpl)}
                    data-testid={`button-delete-template-${tpl.id}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        {isCreateOpen && <TemplateForm onClose={() => setIsCreateOpen(false)} />}
      </Dialog>

      <Dialog open={!!editingTemplate} onOpenChange={(open) => !open && setEditingTemplate(null)}>
        {editingTemplate && <TemplateForm template={editingTemplate} onClose={() => setEditingTemplate(null)} />}
      </Dialog>

      <Dialog open={!!testSendTemplate} onOpenChange={(open) => !open && setTestSendTemplate(null)}>
        {testSendTemplate && <TestSendDialog template={testSendTemplate} onClose={() => setTestSendTemplate(null)} />}
      </Dialog>

      <Dialog open={!!revisionsTemplate} onOpenChange={(open) => !open && setRevisionsTemplate(null)}>
        {revisionsTemplate && <RevisionsDialog template={revisionsTemplate} onClose={() => setRevisionsTemplate(null)} />}
      </Dialog>

      <AlertDialog open={!!deletingTemplate} onOpenChange={(open) => !open && setDeletingTemplate(null)}>
        {deletingTemplate && (
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Template?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete "{deletingTemplate.name}". This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="flex gap-2 justify-end">
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteMutation.mutate(deletingTemplate.id)}
                disabled={deleteMutation.isPending}
                className="bg-destructive text-destructive-foreground"
                data-testid="button-confirm-delete-template"
              >
                {deleteMutation.isPending ? "Deleting..." : "Delete"}
              </AlertDialogAction>
            </div>
          </AlertDialogContent>
        )}
      </AlertDialog>
    </div>
  );
}
