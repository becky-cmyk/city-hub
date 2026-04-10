import { useState } from "react";
import { useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiRequest } from "@/lib/queryClient";
import { HelpCircle, CheckCircle, XCircle, Loader2, Lightbulb } from "lucide-react";
import { DarkPageShell } from "@/components/dark-page-shell";

interface TriviaQuestion {
  id: string;
  question: string;
  answers: string[];
  category?: string;
}

interface TriviaResult {
  correct: boolean;
  correctAnswer: string;
  funFact?: string;
}

const categoryColors: Record<string, string> = {
  History: "#f59e0b",
  Food: "#ef4444",
  Sports: "#3b82f6",
  "Local Knowledge": "#10b981",
};

export default function TvTrivia() {
  const params = useParams<{ questionId: string }>();
  const questionId = params.questionId;

  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [email, setEmail] = useState("");
  const [result, setResult] = useState<TriviaResult | null>(null);

  const { data: question, isLoading, error } = useQuery<TriviaQuestion>({
    queryKey: ["/api/tv/trivia", questionId],
    enabled: !!questionId,
  });

  const answerMutation = useMutation({
    mutationFn: async (answerIndex: number) => {
      const body: Record<string, any> = { answer: answerIndex };
      if (email.trim()) body.email = email.trim();
      const res = await apiRequest("POST", `/api/tv/trivia/${questionId}/answer`, body);
      return res.json() as Promise<TriviaResult>;
    },
    onSuccess: (data) => {
      setResult(data);
    },
  });

  const handleAnswer = (index: number) => {
    if (result || answerMutation.isPending) return;
    setSelectedAnswer(index);
    answerMutation.mutate(index);
  };

  const accent = categoryColors[question?.category || ""] || "#8b5cf6";
  const answerLabels = ["A", "B", "C", "D"];

  if (isLoading) {
    return (
      <DarkPageShell>
        <div className="flex items-center justify-center min-h-[60vh]" data-testid="trivia-loading">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DarkPageShell>
    );
  }

  if (error || !question) {
    return (
      <DarkPageShell>
        <div className="flex items-center justify-center min-h-[60vh]" data-testid="trivia-error">
          <Card className="max-w-md w-full p-6 text-center">
            <XCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h1 className="text-xl font-bold mb-2">Question Not Found</h1>
            <p className="text-sm text-muted-foreground">This trivia question may have expired or doesn't exist.</p>
          </Card>
        </div>
      </DarkPageShell>
    );
  }

  return (
    <DarkPageShell>
      <div data-testid="trivia-page">
        <div className="flex items-center gap-2 mb-6">
          <HelpCircle className="h-5 w-5" style={{ color: accent }} />
          <span className="text-lg font-bold" data-testid="text-trivia-title">CLT Trivia</span>
          {question.category && (
            <Badge
              className="ml-auto text-white border-transparent no-default-hover-elevate no-default-active-elevate"
              style={{ backgroundColor: `${accent}cc` }}
              data-testid="badge-trivia-category"
            >
              {question.category}
            </Badge>
          )}
        </div>

        <Card className="p-6 mb-6">
          <h1 className="text-xl font-bold mb-6" data-testid="text-trivia-question">
            {question.question}
          </h1>

          <div className="space-y-3">
            {question.answers.map((answer, i) => {
              let borderStyle = "border-border";
              let bgStyle = "";

              if (result) {
                if (result.correct && selectedAnswer === i) {
                  borderStyle = "border-green-500";
                  bgStyle = "bg-green-500/10";
                } else if (!result.correct && selectedAnswer === i) {
                  borderStyle = "border-red-500";
                  bgStyle = "bg-red-500/10";
                } else if (answer === result.correctAnswer) {
                  borderStyle = "border-green-500";
                  bgStyle = "bg-green-500/5";
                }
              } else if (selectedAnswer === i) {
                borderStyle = "border-primary";
              }

              return (
                <button
                  key={i}
                  onClick={() => handleAnswer(i)}
                  disabled={!!result || answerMutation.isPending}
                  className={`w-full flex items-center gap-3 rounded-md border p-4 text-left transition-colors ${borderStyle} ${bgStyle} disabled:cursor-default`}
                  data-testid={`button-trivia-answer-${i}`}
                >
                  <span
                    className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm text-white"
                    style={{ backgroundColor: `${accent}80` }}
                  >
                    {answerLabels[i]}
                  </span>
                  <span className="font-medium">{answer}</span>
                  {result && answer === result.correctAnswer && (
                    <CheckCircle className="h-5 w-5 ml-auto text-green-500 flex-shrink-0" />
                  )}
                  {result && !result.correct && selectedAnswer === i && (
                    <XCircle className="h-5 w-5 ml-auto text-red-500 flex-shrink-0" />
                  )}
                </button>
              );
            })}
          </div>

          {answerMutation.isPending && (
            <div className="flex items-center justify-center mt-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}
        </Card>

        {result && (
          <Card className="p-6 mb-6" data-testid="card-trivia-result">
            <div className="flex items-center gap-2 mb-3">
              {result.correct ? (
                <>
                  <CheckCircle className="h-6 w-6 text-green-500" />
                  <span className="text-lg font-bold text-green-600 dark:text-green-400">Correct!</span>
                </>
              ) : (
                <>
                  <XCircle className="h-6 w-6 text-red-500" />
                  <span className="text-lg font-bold text-red-600 dark:text-red-400">Not quite!</span>
                </>
              )}
            </div>
            <p className="text-sm text-muted-foreground mb-2">
              The correct answer is: <span className="font-semibold text-foreground">{result.correctAnswer}</span>
            </p>
            {result.funFact && (
              <div className="flex items-start gap-2 mt-4 p-3 rounded-md bg-muted/50">
                <Lightbulb className="h-4 w-4 mt-0.5 text-amber-500 flex-shrink-0" />
                <p className="text-sm" data-testid="text-trivia-funfact">{result.funFact}</p>
              </div>
            )}
          </Card>
        )}

        {!result && (
          <Card className="p-4" data-testid="card-trivia-email">
            <Label className="text-xs text-muted-foreground">Enter your email for a chance to win prizes (optional)</Label>
            <Input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-2"
              data-testid="input-trivia-email"
            />
          </Card>
        )}

        <div className="text-center mt-8">
          <span className="text-xs text-muted-foreground tracking-widest uppercase">
            Powered by CityMetroHub.tv
          </span>
        </div>
      </div>
    </DarkPageShell>
  );
}
