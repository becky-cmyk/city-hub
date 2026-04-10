import { useQuery, useMutation } from "@tanstack/react-query";
import { useAdminCitySelection } from "@/hooks/use-city";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useState } from "react";
import {
  Mail, Send, Eye, Calendar, Building2, FileText, Loader2,
  Clock, Users, CheckCircle, AlertCircle, Globe
} from "lucide-react";

interface DigestPreview {
  title: string;
  titleEs: string;
  slug: string;
  htmlContent: string;
  htmlContentEs: string;
  contentJson: {
    businesses: Array<{ id: string; name: string; slug: string; imageUrl?: string | null; categoryName?: string }>;
    events: Array<{ id: string; title: string; slug: string; imageUrl?: string | null; startDateTime?: string }>;
    articles: Array<{ id: string; title: string; slug: string; imageUrl?: string | null; excerpt?: string | null }>;
  };
}

interface DigestHistory {
  id: string;
  title: string;
  titleEs?: string | null;
  slug: string;
  digestStatus: string;
  sentAt?: string | null;
  recipientCount?: number | null;
  createdAt: string;
  contentJson?: DigestPreview["contentJson"] | null;
}

export default function WeeklyDigestPanel({ cityId }: { cityId?: string }) {
  const { toast } = useToast();
  const { selectedCitySlug } = useAdminCitySelection();
  const [testEmail, setTestEmail] = useState("");
  const [previewLocale, setPreviewLocale] = useState<"en" | "es">("en");
  const [showHtmlPreview, setShowHtmlPreview] = useState(false);

  const { data: preview, isLoading: previewLoading } = useQuery<DigestPreview>({
    queryKey: ["/api/admin/digest/preview"],
  });

  const { data: history, isLoading: historyLoading } = useQuery<DigestHistory[]>({
    queryKey: ["/api/admin/digest/history"],
  });

  const sendDigestMutation = useMutation({
    mutationFn: async () => {
      const resp = await apiRequest("POST", "/api/admin/digest/send", { citySlug: selectedCitySlug || "" });
      return resp.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/digest/history"] });
      toast({ title: "Digest Sent", description: `Sent to ${data.sent} subscribers. ${data.failed} failed.` });
    },
    onError: (err: any) => {
      toast({ title: "Send failed", description: err.message || "Could not send digest", variant: "destructive" });
    },
  });

  const testSendMutation = useMutation({
    mutationFn: async () => {
      const resp = await apiRequest("POST", "/api/admin/digest/test-send", {
        toEmail: testEmail,
        locale: previewLocale,
        citySlug: selectedCitySlug || "",
      });
      return resp.json();
    },
    onSuccess: () => {
      toast({ title: "Test email sent", description: `Preview sent to ${testEmail}` });
    },
    onError: (err: any) => {
      toast({ title: "Test send failed", description: err.message || "Could not send test", variant: "destructive" });
    },
  });

  const formatDate = (d: string | null | undefined) => {
    if (!d) return "N/A";
    return new Date(d).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2" data-testid="text-digest-title">
            <Mail className="h-5 w-5" /> Weekly Digest
          </h2>
          <p className="text-sm text-muted-foreground">
            Automated "Charlotte This Week" email for subscribers
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="secondary">
            <Clock className="h-3 w-3 mr-1" /> Mondays 9am ET
          </Badge>
        </div>
      </div>

      <Tabs defaultValue="preview">
        <TabsList>
          <TabsTrigger value="preview" data-testid="tab-digest-preview">
            <Eye className="h-3.5 w-3.5 mr-1" /> Preview
          </TabsTrigger>
          <TabsTrigger value="history" data-testid="tab-digest-history">
            <Calendar className="h-3.5 w-3.5 mr-1" /> History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="preview" className="space-y-4">
          {previewLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-8 w-64" />
              <Skeleton className="h-64 w-full" />
            </div>
          ) : preview ? (
            <>
              <Card className="p-4 space-y-4">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div>
                    <h3 className="font-semibold text-lg" data-testid="text-digest-preview-title">
                      {previewLocale === "es" ? preview.titleEs : preview.title}
                    </h3>
                    <p className="text-xs text-muted-foreground">Slug: {preview.slug}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant={previewLocale === "en" ? "default" : "outline"}
                      onClick={() => setPreviewLocale("en")}
                      data-testid="button-locale-en"
                    >
                      EN
                    </Button>
                    <Button
                      size="sm"
                      variant={previewLocale === "es" ? "default" : "outline"}
                      onClick={() => setPreviewLocale("es")}
                      data-testid="button-locale-es"
                    >
                      ES
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <Card className="p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Building2 className="h-4 w-4 text-purple-600" />
                      <span className="font-medium text-sm">Businesses ({preview.contentJson.businesses.length})</span>
                    </div>
                    <ul className="space-y-1">
                      {preview.contentJson.businesses.map(b => (
                        <li key={b.id} className="text-xs text-muted-foreground" data-testid={`text-digest-biz-${b.id}`}>
                          {b.name}
                        </li>
                      ))}
                      {preview.contentJson.businesses.length === 0 && (
                        <li className="text-xs text-muted-foreground italic">No businesses</li>
                      )}
                    </ul>
                  </Card>

                  <Card className="p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Calendar className="h-4 w-4 text-amber-600" />
                      <span className="font-medium text-sm">Events ({preview.contentJson.events.length})</span>
                    </div>
                    <ul className="space-y-1">
                      {preview.contentJson.events.map(e => (
                        <li key={e.id} className="text-xs text-muted-foreground" data-testid={`text-digest-event-${e.id}`}>
                          {e.title}
                        </li>
                      ))}
                      {preview.contentJson.events.length === 0 && (
                        <li className="text-xs text-muted-foreground italic">No events</li>
                      )}
                    </ul>
                  </Card>

                  <Card className="p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="h-4 w-4 text-purple-600" />
                      <span className="font-medium text-sm">Articles ({preview.contentJson.articles.length})</span>
                    </div>
                    <ul className="space-y-1">
                      {preview.contentJson.articles.map(a => (
                        <li key={a.id} className="text-xs text-muted-foreground" data-testid={`text-digest-article-${a.id}`}>
                          {a.title}
                        </li>
                      ))}
                      {preview.contentJson.articles.length === 0 && (
                        <li className="text-xs text-muted-foreground italic">No articles</li>
                      )}
                    </ul>
                  </Card>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowHtmlPreview(!showHtmlPreview)}
                    data-testid="button-toggle-html-preview"
                  >
                    <Eye className="h-3.5 w-3.5 mr-1" />
                    {showHtmlPreview ? "Hide" : "Show"} Email Preview
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const url = `/api/admin/digest/preview-html?locale=${previewLocale}`;
                      window.open(url, "_blank");
                    }}
                    data-testid="button-open-html-tab"
                  >
                    <Globe className="h-3.5 w-3.5 mr-1" />
                    Open in New Tab
                  </Button>
                </div>

                {showHtmlPreview && (
                  <div className="border rounded-md overflow-hidden" style={{ height: 500 }}>
                    <iframe
                      srcDoc={previewLocale === "es" ? preview.htmlContentEs : preview.htmlContent}
                      title="Digest Preview"
                      className="w-full h-full border-0"
                      data-testid="iframe-digest-preview"
                    />
                  </div>
                )}
              </Card>

              <Card className="p-4 space-y-3">
                <h4 className="font-semibold text-sm">Actions</h4>

                <div className="flex items-center gap-2 flex-wrap">
                  <Input
                    value={testEmail}
                    onChange={(e) => setTestEmail(e.target.value)}
                    placeholder="test@example.com"
                    className="max-w-xs"
                    data-testid="input-test-email"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => testSendMutation.mutate()}
                    disabled={testSendMutation.isPending || !testEmail}
                    data-testid="button-test-send"
                  >
                    {testSendMutation.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                    ) : (
                      <Send className="h-3.5 w-3.5 mr-1" />
                    )}
                    Test Send ({previewLocale.toUpperCase()})
                  </Button>
                </div>

                <div className="border-t pt-3">
                  <Button
                    onClick={() => {
                      if (confirm("Send the weekly digest to ALL opted-in subscribers now?")) {
                        sendDigestMutation.mutate();
                      }
                    }}
                    disabled={sendDigestMutation.isPending}
                    data-testid="button-send-digest"
                  >
                    {sendDigestMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4 mr-2" />
                    )}
                    Send Digest Now
                  </Button>
                  <p className="text-xs text-muted-foreground mt-1">
                    This will send to all active subscribers immediately.
                  </p>
                </div>
              </Card>
            </>
          ) : (
            <Card className="p-6 text-center">
              <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Could not load digest preview</p>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="history" className="space-y-3">
          {historyLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : history && history.length > 0 ? (
            history.map(d => (
              <Card key={d.id} className="p-4" data-testid={`card-digest-${d.id}`}>
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="space-y-1 min-w-0">
                    <h4 className="font-medium text-sm truncate" data-testid={`text-digest-history-title-${d.id}`}>
                      {d.title}
                    </h4>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant={d.digestStatus === "sent" ? "default" : "secondary"}>
                        {d.digestStatus === "sent" ? (
                          <CheckCircle className="h-3 w-3 mr-1" />
                        ) : (
                          <Clock className="h-3 w-3 mr-1" />
                        )}
                        {d.digestStatus}
                      </Badge>
                      {d.recipientCount != null && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Users className="h-3 w-3" /> {d.recipientCount} recipients
                        </span>
                      )}
                      {d.sentAt && (
                        <span className="text-xs text-muted-foreground">
                          {formatDate(d.sentAt)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {d.contentJson && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span><Building2 className="h-3 w-3 inline" /> {d.contentJson.businesses?.length || 0}</span>
                        <span><Calendar className="h-3 w-3 inline" /> {d.contentJson.events?.length || 0}</span>
                        <span><FileText className="h-3 w-3 inline" /> {d.contentJson.articles?.length || 0}</span>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            ))
          ) : (
            <Card className="p-6 text-center">
              <Mail className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No digests sent yet</p>
              <p className="text-xs text-muted-foreground">The first digest will be sent automatically next Monday at 9am ET</p>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
