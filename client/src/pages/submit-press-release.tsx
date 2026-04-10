import { useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { ArrowLeft, Newspaper, CheckCircle } from "lucide-react";
import { useSmartBack } from "@/hooks/use-smart-back";
import { Link } from "wouter";
import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { AuthDialog } from "@/components/auth-dialog";
import { VerificationCTA } from "@/components/verification-cta";

export default function SubmitPressRelease({ citySlug }: { citySlug: string }) {
  const { toast } = useToast();
  const smartBack = useSmartBack(`/${citySlug}/submit`);
  const { user, isLoading: authLoading } = useAuth();
  const [showAuthDialog, setShowAuthDialog] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = { title, content, organizationName, contactName, contactEmail };
      await apiRequest("POST", `/api/cities/${citySlug}/submissions`, {
        type: "PRESS_RELEASE",
        payload,
        submitterName: contactName,
        submitterEmail: contactEmail,
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
          <Newspaper className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Sign in to Submit a Press Release</h2>
          <p className="text-sm text-muted-foreground mb-6">Create a free account to submit press releases to CLT Metro Hub.</p>
          <Button onClick={() => setShowAuthDialog(true)} data-testid="button-auth-submit-press">Sign In / Create Account</Button>
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
          <h2 className="text-xl font-bold mb-2" data-testid="submit-press-success">Submitted!</h2>
          <p className="text-muted-foreground mb-4">We'll review your press release.</p>
          <Link href={`/${citySlug}/submit`}><Button data-testid="submit-press-back-home">Back to Submit</Button></Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Button variant="ghost" size="sm" className="gap-1" onClick={smartBack}><ArrowLeft className="h-4 w-4" /> Back</Button>
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2 mb-1" data-testid="submit-press-title">
          <Newspaper className="h-6 w-6 text-primary" />
          Submit a Press Release
        </h1>
        <p className="text-muted-foreground text-sm">Share your press release with the community.</p>
      </div>
      {user && <VerificationCTA compact />}
      <Card className="p-6">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
          className="space-y-4"
        >
          <div>
            <label className="text-sm font-medium mb-1 block">Title</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} required data-testid="submit-press-input-title" />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Content</label>
            <Textarea value={content} onChange={(e) => setContent(e.target.value)} data-testid="submit-press-content" />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Organization Name</label>
            <Input value={organizationName} onChange={(e) => setOrganizationName(e.target.value)} data-testid="submit-press-org-name" />
          </div>
          <div className="border-t pt-4 space-y-4">
            <h3 className="font-semibold text-sm">Contact Information</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="text-sm font-medium mb-1 block">Contact Name</label>
                <Input value={contactName} onChange={(e) => setContactName(e.target.value)} data-testid="submit-press-contact-name" />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Contact Email</label>
                <Input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} data-testid="submit-press-contact-email" />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Contact Phone <span className="text-red-500">*</span></label>
                <Input type="tel" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} placeholder="(555) 123-4567" data-testid="submit-press-contact-phone" />
              </div>
            </div>
          </div>
          <Button type="submit" className="w-full" disabled={mutation.isPending} data-testid="submit-press-button">
            {mutation.isPending ? "Submitting..." : "Submit Press Release"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
