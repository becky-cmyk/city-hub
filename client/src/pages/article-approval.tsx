import { useState } from "react";
import { useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { CheckCircle, Edit3, Loader2, AlertTriangle, PartyPopper } from "lucide-react";

interface ApprovalData {
  contactName: string;
  companyName: string;
  articleTitle: string;
  articleExcerpt: string;
  articleBody: string;
  brandShort: string;
  status: string;
}

export default function ArticleApprovalPage() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const [mode, setMode] = useState<"preview" | "corrections">("preview");
  const [corrections, setCorrections] = useState("");
  const [completed, setCompleted] = useState<"approved" | "corrected" | null>(null);

  const { data, isLoading, error } = useQuery<ApprovalData>({
    queryKey: ["/api/article-approval", token],
    queryFn: () => fetch(`/api/article-approval/${token}`).then(r => {
      if (!r.ok) throw new Error("Unable to load article");
      return r.json();
    }),
    enabled: !!token,
  });

  const [mutationError, setMutationError] = useState<string | null>(null);

  const approveMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/article-approval/${token}/approve`, { method: "POST" });
      const data = await r.json().catch(() => null);
      if (!r.ok) throw new Error(data?.error || "Approval failed");
      if (!data?.success) throw new Error(data?.message || "Approval failed");
      return data;
    },
    onSuccess: () => setCompleted("approved"),
    onError: (err: Error) => setMutationError(err.message),
  });

  const correctionsMutation = useMutation({
    mutationFn: async (notes: string) => {
      const r = await fetch(`/api/article-approval/${token}/corrections`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes }),
      });
      const data = await r.json().catch(() => null);
      if (!r.ok) throw new Error(data?.error || "Submission failed");
      if (!data?.success) throw new Error(data?.message || "Submission failed");
      return data;
    },
    onSuccess: () => setCompleted("corrected"),
    onError: (err: Error) => setMutationError(err.message),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center" data-testid="loading-approval">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4" data-testid="error-approval">
        <Card className="max-w-md w-full p-8 text-center">
          <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Link Expired or Invalid</h2>
          <p className="text-gray-500">This approval link may have already been used or is no longer valid. If you need help, please contact us directly.</p>
        </Card>
      </div>
    );
  }

  if (completed === "approved") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4" data-testid="success-approved">
        <Card className="max-w-md w-full p-8 text-center">
          <PartyPopper className="h-12 w-12 text-indigo-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Article Published!</h2>
          <p className="text-gray-500">Thank you for approving your community spotlight. It's now live on our Pulse feed for the community to see.</p>
        </Card>
      </div>
    );
  }

  if (completed === "corrected") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4" data-testid="success-corrections">
        <Card className="max-w-md w-full p-8 text-center">
          <CheckCircle className="h-12 w-12 text-indigo-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Corrections Received</h2>
          <p className="text-gray-500">Thank you for your feedback. We'll revise and publish the updated article shortly.</p>
        </Card>
      </div>
    );
  }

  const bodyParagraphs = data.articleBody.split(/\n\n|\n/).filter(p => p.trim());

  return (
    <div className="min-h-screen bg-gray-50" data-testid="article-approval-page">
      <div className="max-w-3xl mx-auto px-4 py-8 sm:py-12">
        <div className="text-center mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2" data-testid="text-brand">{data.brandShort}</h1>
          <p className="text-gray-500">Community Spotlight Preview</p>
        </div>

        <Card className="overflow-hidden mb-6">
          <div className="p-6 sm:p-8 border-b border-gray-200 bg-white">
            <p className="text-gray-600 mb-4">
              Hi {data.contactName}, here's your community spotlight article about <strong>{data.companyName}</strong>. Please review it and let us know if everything looks good.
            </p>
          </div>

          <div className="p-6 sm:p-8 bg-gray-50">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-3" data-testid="text-article-title">{data.articleTitle}</h2>
            <p className="text-gray-500 italic mb-6 text-sm" data-testid="text-article-excerpt">{data.articleExcerpt}</p>
            <hr className="mb-6 border-gray-200" />
            <div className="prose prose-gray max-w-none" data-testid="text-article-body">
              {bodyParagraphs.map((p, i) => (
                <p key={i} className="mb-4 text-gray-700 leading-relaxed">{p.trim()}</p>
              ))}
            </div>
          </div>
        </Card>

        {mutationError && (
          <Card className="p-4 mb-4 border-red-200 bg-red-50" data-testid="error-mutation">
            <div className="flex items-center gap-2 text-red-700">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <p className="text-sm">{mutationError}</p>
            </div>
          </Card>
        )}

        {mode === "preview" ? (
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button
              size="lg"
              onClick={() => approveMutation.mutate()}
              disabled={approveMutation.isPending}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
              data-testid="button-approve-article"
            >
              {approveMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle className="h-4 w-4 mr-2" />
              )}
              Approve & Publish
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => setMode("corrections")}
              data-testid="button-request-corrections"
            >
              <Edit3 className="h-4 w-4 mr-2" />
              Request Corrections
            </Button>
          </div>
        ) : (
          <Card className="p-6">
            <h3 className="font-semibold text-gray-900 mb-2">What needs correcting?</h3>
            <p className="text-sm text-gray-500 mb-4">
              Let us know what information needs to be updated. We'll revise the article and publish the corrected version.
            </p>
            <Textarea
              value={corrections}
              onChange={(e) => setCorrections(e.target.value)}
              placeholder="e.g. Our business name is actually spelled... / We've been open since 2019, not 2020... / My title is..."
              rows={4}
              className="mb-4"
              data-testid="textarea-corrections"
            />
            <div className="flex gap-3">
              <Button
                onClick={() => correctionsMutation.mutate(corrections)}
                disabled={correctionsMutation.isPending || !corrections.trim()}
                className="bg-indigo-600 hover:bg-indigo-700 text-white"
                data-testid="button-submit-corrections"
              >
                {correctionsMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : null}
                Submit Corrections
              </Button>
              <Button
                variant="outline"
                onClick={() => setMode("preview")}
                data-testid="button-cancel-corrections"
              >
                Cancel
              </Button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
