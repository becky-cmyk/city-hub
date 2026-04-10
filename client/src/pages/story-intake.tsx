import { useState, useRef, useCallback, useEffect } from "react";
import { useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { Mic, MicOff, Camera, Send, Check, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import type { InterviewQuestionTemplate, IntakeResponse } from "@shared/schema";

interface IntakeData {
  invitation: {
    id: string;
    contactName: string;
    companyName: string | null;
    operatorName: string;
    operatorPhotoUrl: string | null;
    operatorGreeting: string | null;
    status: string;
    photoUrls: string[];
  };
  questions: InterviewQuestionTemplate[];
  responses: IntakeResponse[];
}

export default function StoryIntakePage() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const { toast } = useToast();
  const [expandedQ, setExpandedQ] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [recording, setRecording] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data, isLoading, error } = useQuery<IntakeData>({
    queryKey: ["/api/story-intake", token],
    enabled: !!token,
  });

  useEffect(() => {
    if (data?.responses) {
      const existing: Record<string, string> = {};
      for (const r of data.responses) {
        if (r.answerText) existing[r.questionId] = r.answerText;
      }
      setAnswers(prev => ({ ...existing, ...prev }));
    }
  }, [data?.responses]);

  useEffect(() => {
    if (data?.invitation?.status === "submitted" || data?.invitation?.status === "listing_created") {
      setSubmitted(true);
    }
  }, [data?.invitation?.status]);

  const saveMutation = useMutation({
    mutationFn: async ({ questionId, questionText, answerText, displayOrder }: { questionId: string; questionText: string; answerText: string; displayOrder: number }) => {
      const res = await fetch(`/api/story-intake/${token}/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId, questionText, answerText, displayOrder }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
  });

  const audioMutation = useMutation({
    mutationFn: async ({ questionId, questionText, audioBlob, displayOrder }: { questionId: string; questionText: string; audioBlob: Blob; displayOrder: number }) => {
      const formData = new FormData();
      formData.append("audio", audioBlob, "recording.webm");
      formData.append("questionId", questionId);
      formData.append("questionText", questionText);
      formData.append("displayOrder", String(displayOrder));
      const res = await fetch(`/api/story-intake/${token}/upload-audio`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: (data: IntakeResponse) => {
      if (data.answerText) {
        setAnswers(prev => ({ ...prev, [data.questionId]: data.answerText! }));
      }
      queryClient.invalidateQueries({ queryKey: ["/api/story-intake", token] });
      toast({ title: "Recording saved & transcribed!" });
    },
    onError: (err: any) => {
      toast({ title: "Recording failed", description: err.message, variant: "destructive" });
    },
  });

  const photoMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("photo", file);
      const res = await fetch(`/api/story-intake/${token}/upload-photo`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/story-intake", token] });
      toast({ title: "Photo uploaded!" });
    },
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/story-intake/${token}/submit`, { method: "POST" });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      setSubmitted(true);
      toast({ title: "Thank you!", description: "Your story has been submitted." });
    },
  });

  const startRecording = useCallback(async (questionId: string) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "audio/webm";
      const recorder = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.start(100);
      mediaRecorderRef.current = recorder;
      setRecording(questionId);
    } catch {
      toast({ title: "Microphone access needed", description: "Please allow microphone access to record.", variant: "destructive" });
    }
  }, [toast]);

  const stopRecording = useCallback((questionId: string, questionText: string, displayOrder: number) => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state !== "recording") return;
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
      recorder.stream.getTracks().forEach(t => t.stop());
      setRecording(null);
      audioMutation.mutate({ questionId, questionText, audioBlob: blob, displayOrder });
    };
    recorder.stop();
  }, [audioMutation]);

  const autoSave = useCallback((questionId: string, questionText: string, value: string, displayOrder: number) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
    saveMutation.mutate({ questionId, questionText, answerText: value, displayOrder });
  }, [saveMutation]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-amber-50 to-white">
        <Loader2 className="h-8 w-8 animate-spin text-amber-600" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-amber-50 to-white p-4">
        <Card className="p-8 text-center max-w-md">
          <h2 className="text-xl font-bold mb-2">Link Not Found</h2>
          <p className="text-muted-foreground">This story invitation link is invalid or has expired.</p>
        </Card>
      </div>
    );
  }

  const { invitation: inv, questions, responses } = data;
  const answeredIds = new Set([
    ...responses.map(r => r.questionId),
    ...Object.keys(answers).filter(k => answers[k]?.trim()),
  ]);

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-green-50 to-white p-4">
        <Card className="p-8 text-center max-w-md">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <Check className="h-8 w-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Thank You!</h2>
          <p className="text-muted-foreground mb-4">
            Your story has been submitted. {inv.operatorName} will review it and share it with the community.
          </p>
          <p className="text-sm text-muted-foreground">You can close this page now.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-white" data-testid="story-intake-page">
      <div className="max-w-lg mx-auto px-4 py-6 pb-32">
        <div className="text-center mb-8">
          {inv.operatorPhotoUrl && (
            <img src={inv.operatorPhotoUrl} alt={inv.operatorName} className="w-20 h-20 rounded-full object-cover mx-auto mb-3 border-4 border-white shadow-lg" data-testid="img-operator-photo" />
          )}
          <h1 className="text-2xl font-bold text-gray-900" data-testid="text-operator-name">{inv.operatorName}</h1>
          {inv.operatorGreeting && (
            <p className="text-gray-600 mt-2 text-sm leading-relaxed max-w-sm mx-auto">{inv.operatorGreeting}</p>
          )}
          {inv.contactName && (
            <p className="mt-3 text-lg font-medium text-amber-800">
              Hi {inv.contactName.split(" ")[0]}! Tell me your story.
            </p>
          )}
        </div>

        <div className="space-y-3">
          {questions.map((q, i) => {
            const isExpanded = expandedQ === q.id;
            const hasAnswer = answeredIds.has(q.id);
            const existingResponse = responses.find(r => r.questionId === q.id);
            const isRecording = recording === q.id;
            const isSaving = (saveMutation.isPending && saveMutation.variables?.questionId === q.id) ||
                             (audioMutation.isPending && audioMutation.variables?.questionId === q.id);

            return (
              <Card
                key={q.id}
                className={`overflow-hidden transition-all ${hasAnswer ? "border-green-200 bg-green-50/30" : ""}`}
                data-testid={`intake-question-${q.id}`}
              >
                <button
                  className="w-full text-left p-4 flex items-start gap-3"
                  onClick={() => setExpandedQ(isExpanded ? null : q.id)}
                  data-testid={`button-toggle-question-${q.id}`}
                >
                  <span className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-sm font-medium ${hasAnswer ? "bg-green-500 text-white" : "bg-amber-100 text-amber-700"}`}>
                    {hasAnswer ? <Check className="h-4 w-4" /> : i + 1}
                  </span>
                  <span className="flex-1 text-sm font-medium text-gray-800">{q.questionText}</span>
                  {isExpanded ? <ChevronUp className="h-4 w-4 text-gray-400 flex-shrink-0" /> : <ChevronDown className="h-4 w-4 text-gray-400 flex-shrink-0" />}
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4 space-y-3">
                    <Textarea
                      value={answers[q.id] || ""}
                      onChange={e => setAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                      onBlur={e => {
                        if (e.target.value.trim()) {
                          autoSave(q.id, q.questionText, e.target.value, i);
                        }
                      }}
                      placeholder="Type your answer here..."
                      rows={3}
                      className="text-sm"
                      data-testid={`textarea-answer-${q.id}`}
                    />

                    <div className="flex items-center gap-2 flex-wrap">
                      {isRecording ? (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => stopRecording(q.id, q.questionText, i)}
                          className="animate-pulse"
                          data-testid={`button-stop-recording-${q.id}`}
                        >
                          <MicOff className="h-4 w-4 mr-1" /> Stop Recording
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => startRecording(q.id)}
                          disabled={!!recording || audioMutation.isPending}
                          data-testid={`button-start-recording-${q.id}`}
                        >
                          <Mic className="h-4 w-4 mr-1" /> Speak Your Answer
                        </Button>
                      )}

                      {isSaving && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Loader2 className="h-3 w-3 animate-spin" /> Transcribing your voice...
                        </span>
                      )}
                      {hasAnswer && !isSaving && <Check className="h-4 w-4 text-green-500" />}
                    </div>

                    {isRecording && (
                      <div className="flex items-center gap-2 p-2 rounded-md bg-red-50 border border-red-200 text-xs text-red-700">
                        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                        Recording... Tap Stop when finished. Your voice will be automatically transcribed to text.
                      </div>
                    )}

                    {existingResponse?.audioUrl && (
                      <div className="text-xs text-muted-foreground flex items-center gap-1">
                        <Mic className="h-3 w-3" /> Voice recording saved & transcribed to text
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>

        <Card className="mt-6 p-4">
          <h3 className="font-medium text-sm mb-2 flex items-center gap-2">
            <Camera className="h-4 w-4" /> Add Photos (optional)
          </h3>
          <p className="text-xs text-muted-foreground mb-3">Share photos of your business, team, or space.</p>

          {inv.photoUrls && inv.photoUrls.length > 0 && (
            <div className="grid grid-cols-3 gap-2 mb-3">
              {inv.photoUrls.map((url: string, i: number) => (
                <img key={i} src={url} alt={`Upload ${i + 1}`} className="rounded-lg w-full h-20 object-cover" />
              ))}
            </div>
          )}

          <input
            type="file"
            accept="image/*"
            className="hidden"
            ref={fileInputRef}
            onChange={e => {
              const file = e.target.files?.[0];
              if (file) photoMutation.mutate(file);
            }}
          />
          <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={photoMutation.isPending} data-testid="button-upload-photo">
            {photoMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Camera className="h-4 w-4 mr-1" />}
            Upload Photo
          </Button>
        </Card>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur border-t p-4">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">
              {answeredIds.size} of {questions.length} answered
            </span>
            <div className="flex gap-1">
              {questions.map(q => (
                <div key={q.id} className={`w-2 h-2 rounded-full ${answeredIds.has(q.id) ? "bg-green-500" : "bg-gray-200"}`} />
              ))}
            </div>
          </div>
          <Button
            className="w-full"
            size="lg"
            disabled={answeredIds.size === 0 || submitMutation.isPending}
            onClick={() => submitMutation.mutate()}
            data-testid="button-submit-story"
          >
            {submitMutation.isPending ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <Send className="h-5 w-5 mr-2" />}
            Submit Your Story
          </Button>
        </div>
      </div>
    </div>
  );
}
