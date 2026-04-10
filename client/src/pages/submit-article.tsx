import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { articlePitchSchema, type ArticlePitch } from "@shared/schema";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { ArrowLeft, FileText, CheckCircle } from "lucide-react";
import { useSmartBack } from "@/hooks/use-smart-back";
import { Link } from "wouter";
import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { AuthDialog } from "@/components/auth-dialog";
import { VerificationCTA } from "@/components/verification-cta";

export default function SubmitArticle({ citySlug }: { citySlug: string }) {
  const { toast } = useToast();
  const smartBack = useSmartBack(`/${citySlug}/submit`);
  const { user, isLoading: authLoading } = useAuth();
  const [showAuthDialog, setShowAuthDialog] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const form = useForm<ArticlePitch>({
    resolver: zodResolver(articlePitchSchema),
    defaultValues: { title: "", excerpt: "", submitterName: "", submitterEmail: "", submitterPhone: "" },
  });

  const mutation = useMutation({
    mutationFn: async (data: ArticlePitch) => {
      await apiRequest("POST", `/api/cities/${citySlug}/submissions`, {
        type: "ARTICLE_PITCH",
        payload: data,
        submitterName: data.submitterName,
        submitterEmail: data.submitterEmail,
      });
    },
    onSuccess: () => setSubmitted(true),
    onError: () => {
      toast({ title: "Error", description: "Could not submit.", variant: "destructive" });
    },
  });

  if (!authLoading && !user) {
    return (
      <div className="max-w-xl mx-auto">
        <Card className="p-8 text-center">
          <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Sign in to Submit a Story</h2>
          <p className="text-sm text-muted-foreground mb-6">Create a free account to pitch stories to CLT Metro Hub.</p>
          <Button onClick={() => setShowAuthDialog(true)} data-testid="button-auth-submit-article">Sign In / Create Account</Button>
          <AuthDialog open={showAuthDialog} onOpenChange={setShowAuthDialog} defaultTab="register" />
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="max-w-xl mx-auto">
        <Card className="p-8 text-center">
          <CheckCircle className="mx-auto h-12 w-12 text-green-500 mb-4" />
          <h2 className="text-xl font-bold mb-2">Pitch Submitted!</h2>
          <p className="text-muted-foreground mb-4">We'll review your story idea.</p>
          <Link href={`/${citySlug}`}><Button>Back to Home</Button></Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Button variant="ghost" size="sm" className="gap-1" onClick={smartBack}><ArrowLeft className="h-4 w-4" /> Back</Button>
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2 mb-1" data-testid="text-submit-article-title">
          <FileText className="h-6 w-6 text-primary" />
          Pitch a Story
        </h1>
        <p className="text-muted-foreground text-sm">Share your story idea with us.</p>
      </div>
      {user && <VerificationCTA compact />}
      <Card className="p-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit((data) => mutation.mutate(data))} className="space-y-4">
            <FormField control={form.control} name="title" render={({ field }) => (
              <FormItem><FormLabel>Story Title</FormLabel><FormControl><Input {...field} data-testid="input-article-title" /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="excerpt" render={({ field }) => (
              <FormItem><FormLabel>Summary / Pitch</FormLabel><FormControl><Textarea {...field} data-testid="input-article-excerpt" /></FormControl><FormMessage /></FormItem>
            )} />
            <div className="border-t pt-4 space-y-4">
              <h3 className="font-semibold text-sm">Your Information</h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField control={form.control} name="submitterName" render={({ field }) => (
                  <FormItem><FormLabel>Your Name</FormLabel><FormControl><Input {...field} data-testid="input-submitter-name" /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="submitterEmail" render={({ field }) => (
                  <FormItem><FormLabel>Your Email</FormLabel><FormControl><Input type="email" {...field} data-testid="input-submitter-email" /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="submitterPhone" render={({ field }) => (
                  <FormItem><FormLabel>Your Phone</FormLabel><FormControl><Input type="tel" placeholder="(555) 123-4567" {...field} data-testid="input-submitter-phone" /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={mutation.isPending} data-testid="button-submit-article">
              {mutation.isPending ? "Submitting..." : "Submit Story"}
            </Button>
          </form>
        </Form>
      </Card>
    </div>
  );
}
