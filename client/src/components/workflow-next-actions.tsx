import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { queryClient } from "@/lib/queryClient";
import { ArrowRight, X, Loader2 } from "lucide-react";

interface Recommendation {
  id: string;
  actionType: string;
  label: string;
  description: string | null;
  targetUrl: string | null;
  priority: number;
}

export function WorkflowNextActions({
  workflowSessionId,
  citySlug,
  sessionSecret,
}: {
  workflowSessionId: string;
  citySlug?: string;
  sessionSecret?: string | null;
}) {
  const secretHeaders = sessionSecret ? { "X-Workflow-Secret": sessionSecret } : {};

  const { data, isLoading } = useQuery<{ recommendations: Recommendation[] }>({
    queryKey: ["/api/workflow", workflowSessionId, "recommendations"],
    queryFn: async () => {
      const res = await fetch(`/api/workflow/${workflowSessionId}/recommendations`, {
        headers: secretHeaders,
      });
      if (!res.ok) throw new Error("Failed to load");
      return res.json();
    },
    enabled: !!workflowSessionId,
  });

  const dismissMutation = useMutation({
    mutationFn: async (recId: string) => {
      await fetch(`/api/workflow/${workflowSessionId}/recommendations/${recId}/dismiss`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...secretHeaders },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workflow", workflowSessionId, "recommendations"] });
    },
  });

  const recommendations = data?.recommendations || [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
      </div>
    );
  }

  if (recommendations.length === 0) return null;

  return (
    <Card data-testid="workflow-next-actions">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">What's Next</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {recommendations.map((rec) => {
          const url = rec.targetUrl
            ? (citySlug && rec.targetUrl.startsWith("/") && !rec.targetUrl.startsWith(`/${citySlug}`)
              ? `/${citySlug}${rec.targetUrl}`
              : rec.targetUrl)
            : null;

          return (
            <div
              key={rec.id}
              className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900"
              data-testid={`recommendation-${rec.id}`}
            >
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm text-gray-900 dark:text-gray-100">
                  {rec.label}
                </p>
                {rec.description && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {rec.description}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {url && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => window.location.href = url}
                    data-testid={`recommendation-go-${rec.id}`}
                  >
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => dismissMutation.mutate(rec.id)}
                  disabled={dismissMutation.isPending}
                  data-testid={`recommendation-dismiss-${rec.id}`}
                >
                  <X className="h-4 w-4 text-gray-400" />
                </Button>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
