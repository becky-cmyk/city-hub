import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useSmartBack } from "@/hooks/use-smart-back";
import { useParams } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { AuthDialog } from "@/components/auth-dialog";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { usePageMeta } from "@/hooks/use-page-meta";
import { ClipboardList, CheckCircle, Star, ArrowLeft } from "lucide-react";
import { Link } from "wouter";

interface SurveyQuestion {
  id: string;
  question: string;
  questionType: string;
  options: string[] | null;
  sortOrder: number;
}

interface SurveyData {
  id: string;
  title: string;
  description: string | null;
  isActive: boolean;
  isAnonymous: boolean;
  questions: SurveyQuestion[];
}

export default function SurveyPage({ citySlug }: { citySlug: string }) {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const smartBack = useSmartBack(`/${citySlug}`);
  const { user } = useAuth();
  const { toast } = useToast();
  const [showAuth, setShowAuth] = useState(false);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [submitted, setSubmitted] = useState(false);

  const { data: survey, isLoading } = useQuery<SurveyData>({
    queryKey: ["/api/community/surveys", slug],
    queryFn: async () => {
      const res = await fetch(`/api/community/surveys/${slug}`);
      if (!res.ok) throw new Error("Not found");
      return res.json();
    },
  });

  usePageMeta({
    title: survey ? `${survey.title} | Survey` : "Survey",
    description: survey?.description || "Take this community survey",
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!survey) return;
      const formattedAnswers: Record<string, any> = {};
      for (const q of survey.questions) {
        formattedAnswers[q.id] = answers[q.id] ?? null;
      }
      await apiRequest("POST", `/api/community/surveys/${survey.id}/respond`, { answers: formattedAnswers });
    },
    onSuccess: () => {
      setSubmitted(true);
    },
    onError: (err: any) => {
      const msg = err?.message || "";
      if (msg.includes("Already responded")) {
        toast({ title: "Already submitted", description: "You have already responded to this survey." });
      } else {
        toast({ title: "Error", description: "Could not submit survey. Please try again." });
      }
    },
  });

  const handleSubmit = () => {
    if (!user) {
      setShowAuth(true);
      return;
    }
    if (!survey) return;
    const unanswered = survey.questions.filter(q => {
      const val = answers[q.id];
      if (val === null || val === undefined) return true;
      if (typeof val === "string" && val.trim() === "") return true;
      if (Array.isArray(val) && val.length === 0) return true;
      return false;
    });
    if (unanswered.length > 0) {
      toast({
        title: "Incomplete survey",
        description: `Please answer all ${survey.questions.length} questions before submitting.`,
      });
      return;
    }
    submitMutation.mutate();
  };

  const updateAnswer = (questionId: string, value: any) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
  };

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto space-y-4 py-8 px-4">
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!survey) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4 text-center">
        <ClipboardList className="mx-auto h-12 w-12 text-muted-foreground/40 mb-4" />
        <h2 className="text-lg font-semibold mb-2">Survey not found</h2>
        <p className="text-sm text-muted-foreground mb-4">This survey may have been removed or is no longer available.</p>
        <Button variant="outline" className="gap-2" onClick={smartBack} data-testid="link-back-home">
          <ArrowLeft className="h-4 w-4" /> Back to Home
        </Button>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4 text-center">
        <div className="mx-auto h-16 w-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-4">
          <CheckCircle className="h-8 w-8 text-green-600" />
        </div>
        <h2 className="text-xl font-bold mb-2" data-testid="text-survey-complete">Thank you!</h2>
        <p className="text-muted-foreground mb-6">Your responses have been recorded.</p>
        <Button variant="outline" onClick={smartBack} data-testid="link-back-home">Back to Home</Button>
      </div>
    );
  }

  if (!survey.isActive) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4 text-center">
        <ClipboardList className="mx-auto h-12 w-12 text-muted-foreground/40 mb-4" />
        <h2 className="text-lg font-semibold mb-2">Survey Closed</h2>
        <p className="text-sm text-muted-foreground">This survey is no longer accepting responses.</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <ClipboardList className="h-5 w-5 text-violet-500" />
          <h1 className="text-2xl font-bold" data-testid="text-survey-title">{survey.title}</h1>
        </div>
        {survey.description && (
          <p className="text-muted-foreground text-sm">{survey.description}</p>
        )}
        {survey.isAnonymous && (
          <p className="text-xs text-muted-foreground mt-2">Responses are anonymous.</p>
        )}
      </div>

      <div className="space-y-6">
        {survey.questions.map((q, idx) => (
          <Card key={q.id} className="p-4" data-testid={`survey-question-${idx}`}>
            <label className="text-sm font-medium mb-3 block">
              {idx + 1}. {q.question}
            </label>
            {q.questionType === "text" && (
              <Textarea
                value={answers[q.id] || ""}
                onChange={e => updateAnswer(q.id, e.target.value)}
                placeholder="Your answer..."
                className="resize-none"
                data-testid={`input-survey-q-${idx}`}
              />
            )}
            {q.questionType === "rating" && (
              <div className="flex gap-1" data-testid={`rating-survey-q-${idx}`}>
                {[1, 2, 3, 4, 5].map(n => (
                  <button
                    key={n}
                    onClick={() => updateAnswer(q.id, n)}
                    className="p-1 transition-colors"
                    data-testid={`rating-star-${n}`}
                  >
                    <Star
                      className={`h-6 w-6 ${
                        (answers[q.id] || 0) >= n
                          ? "fill-amber-400 text-amber-400"
                          : "text-muted-foreground/30"
                      }`}
                    />
                  </button>
                ))}
              </div>
            )}
            {q.questionType === "single_choice" && q.options && (
              <div className="space-y-2">
                {q.options.map((opt, oi) => (
                  <label
                    key={oi}
                    className={`flex items-center gap-3 rounded-lg border px-3 py-2 text-sm cursor-pointer transition-colors ${
                      answers[q.id] === opt ? "border-violet-400 bg-violet-50 dark:bg-violet-950/30" : "border-border hover:border-violet-200"
                    }`}
                    data-testid={`option-survey-q-${idx}-${oi}`}
                  >
                    <input
                      type="radio"
                      name={`survey-q-${q.id}`}
                      value={opt}
                      checked={answers[q.id] === opt}
                      onChange={() => updateAnswer(q.id, opt)}
                      className="accent-violet-500"
                    />
                    {opt}
                  </label>
                ))}
              </div>
            )}
            {q.questionType === "multi_choice" && q.options && (
              <div className="space-y-2">
                {q.options.map((opt, oi) => {
                  const selected = Array.isArray(answers[q.id]) && answers[q.id].includes(opt);
                  return (
                    <label
                      key={oi}
                      className={`flex items-center gap-3 rounded-lg border px-3 py-2 text-sm cursor-pointer transition-colors ${
                        selected ? "border-violet-400 bg-violet-50 dark:bg-violet-950/30" : "border-border hover:border-violet-200"
                      }`}
                      data-testid={`option-survey-q-${idx}-${oi}`}
                    >
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => {
                          const prev = Array.isArray(answers[q.id]) ? [...answers[q.id]] : [];
                          if (selected) {
                            updateAnswer(q.id, prev.filter(v => v !== opt));
                          } else {
                            updateAnswer(q.id, [...prev, opt]);
                          }
                        }}
                        className="accent-violet-500"
                      />
                      {opt}
                    </label>
                  );
                })}
              </div>
            )}
          </Card>
        ))}
      </div>

      <Button
        className="w-full mt-6"
        onClick={handleSubmit}
        disabled={submitMutation.isPending}
        data-testid="button-survey-submit"
      >
        {submitMutation.isPending ? "Submitting..." : "Submit Responses"}
      </Button>

      <AuthDialog
        open={showAuth}
        onOpenChange={setShowAuth}
        title="Sign in to respond"
        description="Create an account or sign in to submit your survey responses."
      />
    </div>
  );
}
