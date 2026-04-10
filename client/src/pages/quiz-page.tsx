import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useSmartBack } from "@/hooks/use-smart-back";
import { useParams, Link } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { AuthDialog } from "@/components/auth-dialog";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { usePageMeta } from "@/hooks/use-page-meta";
import { Brain, CheckCircle, XCircle, ArrowRight, ArrowLeft, Trophy, Share2 } from "lucide-react";

interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  sortOrder: number;
}

interface QuizData {
  id: string;
  title: string;
  description: string | null;
  isActive: boolean;
  questions: QuizQuestion[];
}

interface QuizResult {
  questionId: string;
  correct: boolean;
  correctIndex: number;
  explanation: string | null;
}

interface QuizSubmitResponse {
  score: number;
  totalQuestions: number;
  results: QuizResult[];
}

export default function QuizPage({ citySlug }: { citySlug: string }) {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const smartBack = useSmartBack(`/${citySlug}`);
  const { user } = useAuth();
  const { toast } = useToast();
  const [showAuth, setShowAuth] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [quizResults, setQuizResults] = useState<QuizSubmitResponse | null>(null);
  const [feedbackResult, setFeedbackResult] = useState<{ correct: boolean; correctIndex: number; explanation: string | null } | null>(null);

  const { data: quiz, isLoading } = useQuery<QuizData>({
    queryKey: ["/api/community/quizzes", slug],
    queryFn: async () => {
      const res = await fetch(`/api/community/quizzes/${slug}`);
      if (!res.ok) throw new Error("Not found");
      return res.json();
    },
  });

  usePageMeta({
    title: quiz ? `${quiz.title} | Quiz` : "Quiz",
    description: quiz?.description || "Test your knowledge with this community quiz",
  });

  const submitMutation = useMutation({
    mutationFn: async (finalAnswers: (number | null)[]) => {
      const res = await apiRequest("POST", `/api/community/quizzes/${quiz!.id}/submit`, { answers: finalAnswers });
      return res.json() as Promise<QuizSubmitResponse>;
    },
    onSuccess: (data) => {
      setQuizResults(data);
    },
    onError: (err: any) => {
      const msg = err?.message || "";
      if (msg.includes("already completed")) {
        toast({ title: "Already completed", description: "You have already taken this quiz." });
      } else {
        toast({ title: "Error", description: "Could not submit quiz. Please try again." });
      }
    },
  });

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto space-y-4 py-8 px-4">
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!quiz || !quiz.questions || quiz.questions.length === 0) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4 text-center">
        <Brain className="mx-auto h-12 w-12 text-muted-foreground/40 mb-4" />
        <h2 className="text-lg font-semibold mb-2">Quiz not found</h2>
        <p className="text-sm text-muted-foreground mb-4">This quiz may have been removed or is no longer available.</p>
        <Button variant="outline" className="gap-2" onClick={smartBack} data-testid="link-back-home">
          <ArrowLeft className="h-4 w-4" /> Back to Home
        </Button>
      </div>
    );
  }

  if (quizResults) {
    const pct = Math.round((quizResults.score / quizResults.totalQuestions) * 100);
    const grade = pct >= 90 ? "A" : pct >= 80 ? "B" : pct >= 70 ? "C" : pct >= 60 ? "D" : "F";
    const gradeColor = pct >= 70 ? "text-green-600" : pct >= 50 ? "text-amber-500" : "text-red-500";

    return (
      <div className="max-w-2xl mx-auto py-8 px-4">
        <Card className="p-6 text-center mb-6" data-testid="quiz-results-summary">
          <Trophy className={`mx-auto h-12 w-12 mb-3 ${gradeColor}`} />
          <h2 className="text-2xl font-bold mb-1" data-testid="text-quiz-score">
            {quizResults.score} / {quizResults.totalQuestions}
          </h2>
          <p className="text-muted-foreground mb-2">{pct}% correct</p>
          <Badge className={`text-lg px-3 py-1 ${gradeColor}`} variant="outline">
            Grade: {grade}
          </Badge>
          <div className="flex items-center justify-center gap-3 mt-4">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => {
                const text = `I scored ${quizResults.score}/${quizResults.totalQuestions} (${pct}%) on "${quiz.title}"!`;
                if (navigator.share) {
                  navigator.share({ title: quiz.title, text }).catch(() => {});
                } else {
                  navigator.clipboard.writeText(text);
                  toast({ title: "Copied to clipboard", description: "Share your score with friends!" });
                }
              }}
              data-testid="button-share-score"
            >
              <Share2 className="h-3.5 w-3.5" /> Share Score
            </Button>
            <Button variant="outline" size="sm" onClick={smartBack} data-testid="link-back-home">Back to Home</Button>
          </div>
        </Card>

        <h3 className="text-lg font-semibold mb-3">Review Answers</h3>
        <div className="space-y-4">
          {quiz.questions.map((q, idx) => {
            const result = quizResults.results[idx];
            const userAnswer = answers[idx];
            return (
              <Card key={q.id} className="p-4" data-testid={`quiz-review-${idx}`}>
                <div className="flex items-start gap-2 mb-2">
                  {result?.correct ? (
                    <CheckCircle className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                  )}
                  <p className="text-sm font-medium">{idx + 1}. {q.question}</p>
                </div>
                <div className="space-y-1.5 ml-7">
                  {q.options.map((opt, oi) => {
                    const isCorrect = result?.correctIndex === oi;
                    const isUserAnswer = userAnswer === oi;
                    return (
                      <div
                        key={oi}
                        className={`rounded-md px-3 py-1.5 text-sm ${
                          isCorrect
                            ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800"
                            : isUserAnswer && !isCorrect
                              ? "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800"
                              : "text-muted-foreground"
                        }`}
                      >
                        {opt}
                        {isCorrect && " (Correct)"}
                        {isUserAnswer && !isCorrect && " (Your answer)"}
                      </div>
                    );
                  })}
                  {result?.explanation && (
                    <p className="text-xs text-muted-foreground mt-2 italic">{result.explanation}</p>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    );
  }

  const question = quiz.questions[currentQuestion];
  const isLast = currentQuestion === quiz.questions.length - 1;
  const showingFeedback = feedbackResult !== null;

  const handleSelectAnswer = (optionIndex: number) => {
    if (showingFeedback) return;
    setSelectedAnswer(optionIndex);
  };

  const checkMutation = useMutation({
    mutationFn: async ({ questionId, answerIndex }: { questionId: string; answerIndex: number }) => {
      const res = await apiRequest("POST", `/api/community/quizzes/${quiz!.id}/check`, { questionId, answerIndex });
      return res.json() as Promise<{ correct: boolean; correctIndex: number; explanation: string | null }>;
    },
    onSuccess: (data) => {
      setFeedbackResult(data);
    },
  });

  const handleLockAnswer = () => {
    if (selectedAnswer === null) return;
    if (!user) {
      setShowAuth(true);
      return;
    }

    const newAnswers = [...answers];
    newAnswers[currentQuestion] = selectedAnswer;
    setAnswers(newAnswers);

    if (isLast) {
      submitMutation.mutate(newAnswers);
    } else {
      checkMutation.mutate({ questionId: question.id, answerIndex: selectedAnswer });
    }
  };

  const handleContinue = () => {
    setFeedbackResult(null);
    setSelectedAnswer(answers[currentQuestion + 1] ?? null);
    setCurrentQuestion(prev => prev + 1);
  };

  const handlePrev = () => {
    if (currentQuestion > 0 && !showingFeedback) {
      const newAnswers = [...answers];
      if (selectedAnswer !== null) {
        newAnswers[currentQuestion] = selectedAnswer;
      }
      setAnswers(newAnswers);
      setSelectedAnswer(answers[currentQuestion - 1] ?? null);
      setCurrentQuestion(prev => prev - 1);
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Brain className="h-5 w-5 text-violet-500" />
          <h1 className="text-xl font-bold" data-testid="text-quiz-title">{quiz.title}</h1>
        </div>
        {quiz.description && (
          <p className="text-sm text-muted-foreground">{quiz.description}</p>
        )}
      </div>

      <div className="flex items-center gap-2 mb-4">
        {quiz.questions.map((_, idx) => (
          <div
            key={idx}
            className={`h-1.5 flex-1 rounded-full transition-colors ${
              idx < currentQuestion
                ? "bg-violet-500"
                : idx === currentQuestion
                  ? "bg-violet-300"
                  : "bg-muted"
            }`}
          />
        ))}
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        Question {currentQuestion + 1} of {quiz.questions.length}
      </p>

      <Card className="p-5 mb-4" data-testid={`quiz-question-${currentQuestion}`}>
        <h2 className="text-base font-semibold mb-4">{question.question}</h2>
        <div className="space-y-2">
          {question.options.map((opt, oi) => {
            let optionStyle = "border-border hover:border-violet-200 cursor-pointer";
            if (showingFeedback && feedbackResult) {
              const userPick = answers[currentQuestion];
              const isCorrectOption = feedbackResult.correctIndex === oi;
              const isUserPick = oi === userPick;
              if (isCorrectOption) {
                optionStyle = "border-green-400 bg-green-50 dark:bg-green-900/20 font-medium";
              } else if (isUserPick && !isCorrectOption) {
                optionStyle = "border-red-400 bg-red-50 dark:bg-red-900/20 font-medium";
              } else {
                optionStyle = "border-border opacity-50";
              }
            } else if (selectedAnswer === oi) {
              optionStyle = "border-violet-400 bg-violet-50 dark:bg-violet-950/30 font-medium";
            }

            return (
              <button
                key={oi}
                onClick={() => handleSelectAnswer(oi)}
                disabled={showingFeedback}
                className={`w-full text-left rounded-lg border px-4 py-3 text-sm transition-all ${optionStyle}`}
                data-testid={`quiz-option-${oi}`}
              >
                <span className="font-mono text-xs text-muted-foreground mr-2">
                  {String.fromCharCode(65 + oi)}.
                </span>
                {opt}
                {showingFeedback && feedbackResult?.correctIndex === oi && (
                  <CheckCircle className="inline-block ml-2 h-4 w-4 text-green-500" />
                )}
                {showingFeedback && oi === answers[currentQuestion] && feedbackResult && feedbackResult.correctIndex !== oi && (
                  <XCircle className="inline-block ml-2 h-4 w-4 text-red-500" />
                )}
              </button>
            );
          })}
        </div>

        {showingFeedback && feedbackResult && (
          <div
            className={`mt-4 p-3 rounded-lg border ${
              feedbackResult.correct
                ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800"
                : "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"
            }`}
            data-testid="quiz-answer-feedback"
          >
            <p className={`text-sm font-medium ${feedbackResult.correct ? "text-green-700 dark:text-green-300" : "text-red-700 dark:text-red-300"}`}>
              {feedbackResult.correct ? "Correct!" : "Incorrect"}
            </p>
            {feedbackResult.explanation && (
              <p className="text-xs text-muted-foreground mt-1">{feedbackResult.explanation}</p>
            )}
          </div>
        )}
      </Card>

      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={handlePrev}
          disabled={currentQuestion === 0 || showingFeedback}
          className="gap-1.5"
          data-testid="button-quiz-prev"
        >
          <ArrowLeft className="h-4 w-4" /> Previous
        </Button>

        {showingFeedback ? (
          <Button
            onClick={handleContinue}
            className="gap-1.5"
            data-testid="button-quiz-continue"
          >
            Next <ArrowRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button
            onClick={handleLockAnswer}
            disabled={selectedAnswer === null || submitMutation.isPending || checkMutation.isPending}
            className="gap-1.5"
            data-testid="button-quiz-next"
          >
            {submitMutation.isPending || checkMutation.isPending
              ? "Checking..."
              : isLast
                ? "Finish Quiz"
                : "Lock Answer"
            }
          </Button>
        )}
      </div>

      <AuthDialog
        open={showAuth}
        onOpenChange={setShowAuth}
        title="Sign in to take the quiz"
        description="Create an account or sign in to submit your quiz answers."
      />
    </div>
  );
}
