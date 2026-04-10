import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Plus, Trash2, Mail, AlertCircle } from "lucide-react";

type EmailSuppressionRecord = {
  id: string;
  email: string;
  suppressionType: "bounce" | "complaint" | "manual";
  reason: string | null;
  createdAt: string;
};

type EmailUnsubscribe = {
  id: string;
  email: string;
  scope: string;
  unsubscribedAt: string;
  source: string | null;
};

const SUPPRESSION_TYPE_COLORS: Record<string, string> = {
  bounce: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  complaint: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  manual: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
};

function AddSuppressionDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [suppressionType, setSuppressionType] = useState("manual");
  const [reason, setReason] = useState("");

  const addMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/admin/email-suppressions", {
        email,
        suppressionType,
        reason: reason || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/email-suppressions"] });
      toast({ title: "Suppression added" });
      setEmail("");
      setSuppressionType("manual");
      setReason("");
      onOpenChange(false);
    },
    onError: (err: any) => {
      toast({ title: "Error adding suppression", description: err.message, variant: "destructive" });
    },
  });

  const handleSubmit = () => {
    if (!email) {
      toast({ title: "Error", description: "Email is required", variant: "destructive" });
      return;
    }
    addMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Email Suppression</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              data-testid="input-suppression-email"
            />
          </div>
          <div>
            <Label htmlFor="type">Suppression Type</Label>
            <Select value={suppressionType} onValueChange={setSuppressionType}>
              <SelectTrigger id="type" data-testid="select-suppression-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">Manual</SelectItem>
                <SelectItem value="bounce">Bounce</SelectItem>
                <SelectItem value="complaint">Complaint</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="reason">Reason (Optional)</Label>
            <Textarea
              id="reason"
              placeholder="Why is this email being suppressed?"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="min-h-20"
              data-testid="textarea-suppression-reason"
            />
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel">
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={addMutation.isPending} data-testid="button-add-suppression">
              {addMutation.isPending ? "Adding..." : "Add"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function EmailSuppressionPanel({ cityId }: { cityId?: string }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { toast } = useToast();

  const { data: suppressions, isLoading: suppressionsLoading } = useQuery<EmailSuppressionRecord[]>({
    queryKey: ["/api/admin/email-suppressions"],
  });

  const { data: unsubscribes, isLoading: unsubscribesLoading } = useQuery<EmailUnsubscribe[]>({
    queryKey: ["/api/admin/email-unsubscribes"],
  });

  const deleteSuppression = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/admin/email-suppressions/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/email-suppressions"] });
      toast({ title: "Suppression removed" });
    },
    onError: (err: any) => {
      toast({ title: "Error removing suppression", description: err.message, variant: "destructive" });
    },
  });

  const deleteUnsubscribe = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/admin/email-unsubscribes/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/email-unsubscribes"] });
      toast({ title: "Unsubscribe removed" });
    },
    onError: (err: any) => {
      toast({ title: "Error removing unsubscribe", description: err.message, variant: "destructive" });
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold" data-testid="text-title">
          Email Suppression & Unsubscribes
        </h2>
        <p className="text-sm text-muted-foreground">Manage suppressed emails and unsubscribed users</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4 text-center">
          <Mail className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
          <p className="text-2xl font-bold" data-testid="text-stat-suppressions">
            {suppressions?.length || 0}
          </p>
          <p className="text-xs text-muted-foreground">Suppressions</p>
        </Card>
        <Card className="p-4 text-center">
          <AlertCircle className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
          <p className="text-2xl font-bold" data-testid="text-stat-unsubscribes">
            {unsubscribes?.length || 0}
          </p>
          <p className="text-xs text-muted-foreground">Unsubscribes</p>
        </Card>
      </div>

      <Tabs defaultValue="suppressions" className="w-full">
        <TabsList data-testid="tabs-main">
          <TabsTrigger value="suppressions" data-testid="tab-suppressions">
            Suppressions
          </TabsTrigger>
          <TabsTrigger value="unsubscribes" data-testid="tab-unsubscribes">
            Unsubscribes
          </TabsTrigger>
        </TabsList>

        <TabsContent value="suppressions" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setDialogOpen(true)} size="sm" data-testid="button-add-suppression-trigger">
              <Plus className="h-4 w-4 mr-1" />
              Add Suppression
            </Button>
          </div>

          {suppressionsLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : !suppressions?.length ? (
            <Card className="p-8 text-center">
              <Mail className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-muted-foreground">No suppressions found</p>
            </Card>
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {suppressions.map((supp) => (
                    <TableRow key={supp.id} data-testid={`row-suppression-${supp.id}`}>
                      <TableCell className="font-mono text-sm">{supp.email}</TableCell>
                      <TableCell>
                        <Badge className={SUPPRESSION_TYPE_COLORS[supp.suppressionType]}>
                          {supp.suppressionType}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{supp.reason || "-"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(supp.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteSuppression.mutate(supp.id)}
                          disabled={deleteSuppression.isPending}
                          data-testid={`button-delete-suppression-${supp.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="unsubscribes" className="space-y-4">
          {unsubscribesLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : !unsubscribes?.length ? (
            <Card className="p-8 text-center">
              <AlertCircle className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-muted-foreground">No unsubscribes found</p>
            </Card>
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Scope</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {unsubscribes.map((unsub) => (
                    <TableRow key={unsub.id} data-testid={`row-unsubscribe-${unsub.id}`}>
                      <TableCell className="font-mono text-sm">{unsub.email}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{unsub.scope}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{unsub.source || "-"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(unsub.unsubscribedAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteUnsubscribe.mutate(unsub.id)}
                          disabled={deleteUnsubscribe.isPending}
                          data-testid={`button-delete-unsubscribe-${unsub.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      <AddSuppressionDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}
