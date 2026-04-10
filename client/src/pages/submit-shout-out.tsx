import { useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { ArrowLeft, Megaphone, CheckCircle } from "lucide-react";
import { useSmartBack } from "@/hooks/use-smart-back";
import { Link } from "wouter";
import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { AuthDialog } from "@/components/auth-dialog";
import { VerificationCTA } from "@/components/verification-cta";

export default function SubmitShoutOut({ citySlug }: { citySlug: string }) {
  const { toast } = useToast();
  const smartBack = useSmartBack(`/${citySlug}/submit`);
  const { user, isLoading: authLoading } = useAuth();
  const [showAuthDialog, setShowAuthDialog] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [targetName, setTargetName] = useState("");
  const [message, setMessage] = useState("");
  const [submitterName, setSubmitterName] = useState("");
  const [submitterEmail, setSubmitterEmail] = useState("");
  const [submitterPhone, setSubmitterPhone] = useState("");

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = { targetName, message };
      await apiRequest("POST", `/api/cities/${citySlug}/submissions`, {
        type: "HUB_SHOUT_OUT",
        payload,
        submitterName,
        submitterEmail,
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
          <Megaphone className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Sign in to Give a Shout-Out</h2>
          <p className="text-sm text-muted-foreground mb-6">Create a free account to share shout-outs on CLT Metro Hub.</p>
          <Button onClick={() => setShowAuthDialog(true)} data-testid="button-auth-submit-shoutout">Sign In / Create Account</Button>
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
          <h2 className="text-xl font-bold mb-2" data-testid="submit-shout-success">Shout-Out Sent!</h2>
          <p className="text-muted-foreground mb-4">Your shout-out has been submitted for review.</p>
          <Link href={`/${citySlug}/submit`}><Button data-testid="submit-shout-back-home">Back to Submit</Button></Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Button variant="ghost" size="sm" className="gap-1" onClick={smartBack}><ArrowLeft className="h-4 w-4" /> Back</Button>
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2 mb-1" data-testid="submit-shout-title">
          <Megaphone className="h-6 w-6 text-primary" />
          Hub Shout-Out
        </h1>
        <p className="text-muted-foreground text-sm">Give a shout-out to someone in the community.</p>
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
            <label className="text-sm font-medium mb-1 block">Who are you shouting out?</label>
            <Input value={targetName} onChange={(e) => setTargetName(e.target.value)} required data-testid="submit-shout-target-name" />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Message</label>
            <Textarea value={message} onChange={(e) => setMessage(e.target.value)} data-testid="submit-shout-message" />
          </div>
          <div className="border-t pt-4 space-y-4">
            <h3 className="font-semibold text-sm">Your Information</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="text-sm font-medium mb-1 block">Your Name</label>
                <Input value={submitterName} onChange={(e) => setSubmitterName(e.target.value)} data-testid="submit-shout-submitter-name" />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Your Email</label>
                <Input type="email" value={submitterEmail} onChange={(e) => setSubmitterEmail(e.target.value)} data-testid="submit-shout-submitter-email" />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Your Phone <span className="text-red-500">*</span></label>
                <Input type="tel" value={submitterPhone} onChange={(e) => setSubmitterPhone(e.target.value)} placeholder="(555) 123-4567" data-testid="submit-shout-submitter-phone" />
              </div>
            </div>
          </div>
          <Button type="submit" className="w-full" disabled={mutation.isPending} data-testid="submit-shout-button">
            {mutation.isPending ? "Submitting..." : "Send Shout-Out"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
