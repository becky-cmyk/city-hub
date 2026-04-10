import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import {
  Building2, Users, MapPin, Mail, Phone, Globe, Shield,
  CheckCircle, ArrowRight, ArrowLeft, Loader2, Search,
  MessageSquare, BookOpen, Settings, Star, Sparkles,
} from "lucide-react";
import charlotteAvatar from "@assets/charlotte-avatar-v2.png";
import { WorkflowNextActions } from "@/components/workflow-next-actions";

type WorkflowStep =
  | "match" | "account_check" | "verification" | "identity_router"
  | "basic_activation" | "story_builder" | "capability_activation"
  | "hub_category_setup" | "complete";

const FORM_STEPS: WorkflowStep[] = [
  "match", "account_check", "verification", "identity_router",
  "basic_activation", "story_builder", "capability_activation",
  "hub_category_setup", "complete",
];

const STEP_CONFIG: Record<WorkflowStep, { label: string; icon: typeof Building2 }> = {
  match: { label: "Find Your Presence", icon: Search },
  account_check: { label: "Account", icon: Users },
  verification: { label: "Verify", icon: Shield },
  identity_router: { label: "Your Role", icon: Users },
  basic_activation: { label: "Activate", icon: Building2 },
  story_builder: { label: "Your Story", icon: BookOpen },
  capability_activation: { label: "Capabilities", icon: Settings },
  hub_category_setup: { label: "Category", icon: Star },
  complete: { label: "Complete", icon: CheckCircle },
};

const IDENTITY_ROLES = [
  { value: "owner", label: "Business Owner" },
  { value: "manager", label: "Manager" },
  { value: "employee", label: "Employee" },
  { value: "marketing_rep", label: "Marketing Representative" },
  { value: "executive_director", label: "Executive Director" },
  { value: "board_member", label: "Board Member" },
  { value: "volunteer", label: "Volunteer" },
  { value: "host", label: "Host" },
  { value: "organizer", label: "Event Organizer" },
  { value: "creator", label: "Creator" },
  { value: "contributor", label: "Contributor" },
];

function StepBar({ current }: { current: WorkflowStep }) {
  const currentIdx = FORM_STEPS.indexOf(current);
  const visibleSteps = FORM_STEPS.filter((s) => s !== "complete");

  return (
    <div className="flex items-center justify-center gap-1 mb-6" data-testid="workflow-step-bar">
      {visibleSteps.map((step, i) => {
        const config = STEP_CONFIG[step];
        const Icon = config.icon;
        const isActive = i === currentIdx;
        const isDone = i < currentIdx;
        return (
          <div key={step} className="flex items-center">
            <div
              className={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-medium transition-colors ${
                isActive
                  ? "bg-violet-600 text-white"
                  : isDone
                    ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                    : "bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500"
              }`}
              title={config.label}
            >
              {isDone ? <CheckCircle className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
            </div>
            {i < visibleSteps.length - 1 && (
              <div className={`w-4 sm:w-8 h-0.5 mx-0.5 ${i < currentIdx ? "bg-green-300 dark:bg-green-700" : "bg-gray-200 dark:bg-gray-700"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function WorkflowForm({ citySlug }: { citySlug: string }) {
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const params = new URLSearchParams(window.location.search);
  const resumeSessionId = params.get("session");
  const startSource = params.get("source") || "cta";

  const [workflowSessionId, setWorkflowSessionId] = useState<string | null>(resumeSessionId);
  const [sessionSecret, setSessionSecret] = useState<string | null>(() => {
    if (resumeSessionId) return sessionStorage.getItem(`wf_secret_${resumeSessionId}`);
    return null;
  });
  const [currentStep, setCurrentStep] = useState<WorkflowStep>("match");
  const [formData, setFormData] = useState({
    businessName: "",
    contactName: "",
    contactEmail: "",
    contactPhone: "",
    website: "",
    identityRole: "",
    presenceType: "commerce",
    verificationCode: "",
  });
  const [isLoading, setIsLoading] = useState(false);

  const cityQuery = useQuery<{ id: string; brandName: string }>({
    queryKey: ["/api/cities/slug", citySlug],
    queryFn: async () => {
      const res = await fetch(`/api/cities/slug/${citySlug}`);
      if (!res.ok) throw new Error("City not found");
      return res.json();
    },
  });

  const sessionQuery = useQuery({
    queryKey: ["/api/workflow", workflowSessionId],
    queryFn: async () => {
      if (!workflowSessionId) return null;
      const headers: Record<string, string> = {};
      if (sessionSecret) headers["X-Workflow-Secret"] = sessionSecret;
      const res = await fetch(`/api/workflow/${workflowSessionId}`, { headers });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!workflowSessionId,
  });

  useEffect(() => {
    if (sessionQuery.data?.session) {
      const session = sessionQuery.data.session;
      const step = session.currentStep as WorkflowStep;
      if (FORM_STEPS.includes(step)) {
        setCurrentStep(step);
      }
      setFormData((prev) => ({
        ...prev,
        businessName: session.businessName || prev.businessName,
        contactName: session.contactName || prev.contactName,
        contactEmail: session.contactEmail || prev.contactEmail,
        contactPhone: session.contactPhone || prev.contactPhone,
        identityRole: session.identityRole || prev.identityRole,
        presenceType: session.presenceType || prev.presenceType,
      }));
    }
  }, [sessionQuery.data]);

  const startOrResumeSession = useCallback(async (): Promise<string | null> => {
    if (workflowSessionId) return workflowSessionId;
    if (!cityQuery.data?.id) return null;

    setIsLoading(true);
    try {
      const existingSecret = sessionSecret || undefined;
      const res = await apiRequest("POST", "/api/workflow/start", {
        cityId: cityQuery.data.id,
        source: startSource,
        contactEmail: formData.contactEmail || undefined,
        contactName: formData.contactName || undefined,
        businessName: formData.businessName || undefined,
        existingSessionSecret: existingSecret,
      });
      const data = await res.json();
      const newId = data.sessionId;
      setWorkflowSessionId(newId);
      if (data.sessionSecret) {
        setSessionSecret(data.sessionSecret);
        sessionStorage.setItem(`wf_secret_${newId}`, data.sessionSecret);
      }
      const step = data.currentStep === "entry" ? "match" : (data.currentStep as WorkflowStep);
      setCurrentStep(step);
      return newId;
    } catch (err) {
      toast({ title: "Error", description: "Could not start workflow session", variant: "destructive" });
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [workflowSessionId, cityQuery.data, startSource, formData, toast]);

  const workflowFetch = useCallback(async (method: string, url: string, body?: Record<string, unknown>) => {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (sessionSecret) headers["X-Workflow-Secret"] = sessionSecret;
    const res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      credentials: "include",
    });
    if (!res.ok) throw new Error(`Workflow request failed: ${res.status}`);
    return res.json();
  }, [sessionSecret]);

  const advanceStep = useCallback(async (toStep: WorkflowStep, sessionUpdates?: Record<string, unknown>, overrideId?: string) => {
    const sid = overrideId || workflowSessionId;
    if (!sid) return;
    setIsLoading(true);
    try {
      await workflowFetch("POST", `/api/workflow/${sid}/advance`, {
        toStep,
        eventData: { source: "form_fallback" },
        sessionUpdates,
      });
      setCurrentStep(toStep);
      queryClient.invalidateQueries({ queryKey: ["/api/workflow", sid] });
    } catch {
      try {
        await workflowFetch("POST", `/api/workflow/${sid}/skip`, {
          toStep,
          reason: "Form fallback skip",
        });
        setCurrentStep(toStep);
        queryClient.invalidateQueries({ queryKey: ["/api/workflow", sid] });
      } catch {
        toast({ title: "Error", description: "Could not advance to next step", variant: "destructive" });
      }
    } finally {
      setIsLoading(false);
    }
  }, [workflowSessionId, workflowFetch, toast]);

  const goToCharlotte = useCallback(() => {
    const charlotteUrl = `/${citySlug}/tell-your-story${workflowSessionId ? `?wfSession=${workflowSessionId}` : ""}`;
    navigate(charlotteUrl);
  }, [citySlug, workflowSessionId, navigate]);

  const renderMatchStep = () => (
    <Card data-testid="workflow-step-match">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Search className="h-5 w-5 text-violet-600" />
          Find Your Presence
        </CardTitle>
        <CardDescription>
          Let's find or create your business listing on the Hub.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="businessName">Business or Organization Name</Label>
          <Input
            id="businessName"
            value={formData.businessName}
            onChange={(e) => setFormData((p) => ({ ...p, businessName: e.target.value }))}
            placeholder="e.g. Crown Coffee Co."
            data-testid="input-business-name"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="contactName">Your Name</Label>
            <Input
              id="contactName"
              value={formData.contactName}
              onChange={(e) => setFormData((p) => ({ ...p, contactName: e.target.value }))}
              placeholder="First name"
              data-testid="input-contact-name"
            />
          </div>
          <div>
            <Label htmlFor="contactEmail">Email</Label>
            <Input
              id="contactEmail"
              type="email"
              value={formData.contactEmail}
              onChange={(e) => setFormData((p) => ({ ...p, contactEmail: e.target.value }))}
              placeholder="you@example.com"
              data-testid="input-contact-email"
            />
          </div>
        </div>
        <div>
          <Label htmlFor="contactPhone">Phone</Label>
          <Input
            id="contactPhone"
            type="tel"
            value={formData.contactPhone}
            onChange={(e) => setFormData((p) => ({ ...p, contactPhone: e.target.value }))}
            placeholder="(704) 555-0123"
            data-testid="input-contact-phone"
          />
        </div>
        <div>
          <Label htmlFor="website">Website or Social URL (optional)</Label>
          <Input
            id="website"
            value={formData.website}
            onChange={(e) => setFormData((p) => ({ ...p, website: e.target.value }))}
            placeholder="https://..."
            data-testid="input-website"
          />
        </div>
        <div>
          <Label htmlFor="presenceType">Type</Label>
          <Select
            value={formData.presenceType}
            onValueChange={(v) => setFormData((p) => ({ ...p, presenceType: v }))}
          >
            <SelectTrigger data-testid="select-presence-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="commerce">Business / Commerce</SelectItem>
              <SelectItem value="organization">Organization / Nonprofit</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button
          className="w-full"
          disabled={!formData.businessName || !formData.contactEmail || isLoading}
          onClick={async () => {
            const sid = await startOrResumeSession();
            if (sid) {
              try {
                await workflowFetch("POST", `/api/workflow/${sid}/match-business`, {
                  name: formData.businessName,
                  city: citySlug,
                  websiteOrSocial: formData.website || undefined,
                });
              } catch (err) {
                console.error("[WORKFLOW-FORM] Match-business call failed:", err);
              }
              await advanceStep("account_check", {
                businessName: formData.businessName,
                contactEmail: formData.contactEmail,
                contactName: formData.contactName,
                contactPhone: formData.contactPhone,
                presenceType: formData.presenceType,
              }, sid);
            }
          }}
          data-testid="button-match-next"
        >
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ArrowRight className="h-4 w-4 mr-2" />}
          Find and Continue
        </Button>
      </CardContent>
    </Card>
  );

  const renderAccountStep = () => (
    <Card data-testid="workflow-step-account">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5 text-violet-600" />
          Account Setup
        </CardTitle>
        <CardDescription>
          Confirm your contact details for your Hub presence.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Signed in as <span className="font-medium text-gray-900 dark:text-gray-100">{formData.contactEmail}</span>
          </p>
          {formData.businessName && (
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Business: <span className="font-medium text-gray-900 dark:text-gray-100">{formData.businessName}</span>
            </p>
          )}
        </div>
        <div>
          <Label htmlFor="website">Website (optional)</Label>
          <Input
            id="website"
            value={formData.website}
            onChange={(e) => setFormData((p) => ({ ...p, website: e.target.value }))}
            placeholder="https://your-site.com"
            data-testid="input-website"
          />
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setCurrentStep("match")}
            data-testid="button-account-back"
          >
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <Button
            className="flex-1"
            disabled={isLoading}
            onClick={() => advanceStep("verification")}
            data-testid="button-account-next"
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ArrowRight className="h-4 w-4 mr-2" />}
            Continue to Verification
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  const renderVerificationStep = () => (
    <Card data-testid="workflow-step-verification">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-violet-600" />
          Verify Your Identity
        </CardTitle>
        <CardDescription>
          We'll send a verification code to confirm you represent this business.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            disabled={isLoading}
            onClick={async () => {
              setIsLoading(true);
              try {
                await workflowFetch("POST", `/api/workflow/${workflowSessionId}/event`, {
                  eventType: "verification_sent",
                  eventData: { verificationMethod: "email", source: "form_fallback" },
                });
                toast({ title: "Sent", description: "Verification email sent" });
              } catch (err) {
                console.error("[WORKFLOW-FORM] Email verification event failed:", err);
              } finally { setIsLoading(false); }
            }}
            data-testid="button-verify-email"
          >
            <Mail className="h-4 w-4 mr-1" /> Send via Email
          </Button>
          <Button
            variant="outline"
            disabled={isLoading || !formData.contactPhone}
            onClick={async () => {
              setIsLoading(true);
              try {
                await workflowFetch("POST", `/api/workflow/${workflowSessionId}/event`, {
                  eventType: "verification_sent",
                  eventData: { verificationMethod: "sms", source: "form_fallback" },
                });
                toast({ title: "Sent", description: "Verification SMS sent" });
              } catch (err) {
                console.error("[WORKFLOW-FORM] SMS verification event failed:", err);
              } finally { setIsLoading(false); }
            }}
            data-testid="button-verify-sms"
          >
            <Phone className="h-4 w-4 mr-1" /> Send via SMS
          </Button>
        </div>
        <div>
          <Label htmlFor="verificationCode">Verification Code</Label>
          <Input
            id="verificationCode"
            value={formData.verificationCode}
            onChange={(e) => setFormData((p) => ({ ...p, verificationCode: e.target.value }))}
            placeholder="123456"
            maxLength={6}
            data-testid="input-verification-code"
          />
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setCurrentStep("account_check")}
            data-testid="button-verify-back"
          >
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <Button
            className="flex-1"
            disabled={formData.verificationCode.length < 6 || isLoading}
            onClick={() => advanceStep("identity_router")}
            data-testid="button-verify-next"
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}
            Verify and Continue
          </Button>
        </div>
        <button
          className="text-xs text-violet-600 underline w-full text-center"
          onClick={() => advanceStep("identity_router")}
          data-testid="button-skip-verification"
        >
          Skip verification for now
        </button>
      </CardContent>
    </Card>
  );

  const renderIdentityStep = () => (
    <Card data-testid="workflow-step-identity">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5 text-violet-600" />
          Your Role
        </CardTitle>
        <CardDescription>
          How are you connected to {formData.businessName || "this presence"}?
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Select
          value={formData.identityRole}
          onValueChange={(v) => setFormData((p) => ({ ...p, identityRole: v }))}
        >
          <SelectTrigger data-testid="select-identity-role">
            <SelectValue placeholder="Select your role" />
          </SelectTrigger>
          <SelectContent>
            {IDENTITY_ROLES.map((r) => (
              <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setCurrentStep("verification")}
            data-testid="button-identity-back"
          >
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <Button
            className="flex-1"
            disabled={!formData.identityRole || isLoading}
            onClick={async () => {
              if (!workflowSessionId) return;
              setIsLoading(true);
              try {
                await workflowFetch("POST", `/api/workflow/${workflowSessionId}/identity`, {
                  role: formData.identityRole,
                  presenceType: formData.presenceType,
                });
                await advanceStep("basic_activation");
              } catch (err) {
                console.error("[WORKFLOW-FORM] Identity set failed:", err);
                toast({ title: "Error", description: "Could not set identity role", variant: "destructive" });
              } finally {
                setIsLoading(false);
              }
            }}
            data-testid="button-identity-next"
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ArrowRight className="h-4 w-4 mr-2" />}
            Continue
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  const renderActivationStep = () => (
    <Card data-testid="workflow-step-activation">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-violet-600" />
          Basic Activation
        </CardTitle>
        <CardDescription>
          Your presence is being set up on the Hub.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <p className="font-medium text-green-800 dark:text-green-300">Presence Created</p>
          </div>
          <p className="text-sm text-green-700 dark:text-green-400">
            {formData.businessName} has been registered on the Hub. Continue to tell your story and unlock more features.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setCurrentStep("identity_router")}
            data-testid="button-activation-back"
          >
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <Button
            className="flex-1"
            disabled={isLoading}
            onClick={() => advanceStep("story_builder")}
            data-testid="button-activation-next"
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <BookOpen className="h-4 w-4 mr-2" />}
            Tell Your Story
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  const renderStoryStep = () => (
    <Card data-testid="workflow-step-story">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-violet-600" />
          Your Story
        </CardTitle>
        <CardDescription>
          Share your neighborhood story to unlock trust features and get featured.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div
          className="rounded-lg border-2 border-dashed border-violet-300 dark:border-violet-700 p-6 text-center cursor-pointer"
          onClick={goToCharlotte}
          data-testid="button-story-charlotte"
        >
          <img src={charlotteAvatar} alt="Charlotte" className="w-12 h-12 rounded-full mx-auto mb-3" />
          <p className="font-medium text-gray-900 dark:text-gray-100 mb-1">Tell your story with Charlotte</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Have a guided conversation with Charlotte, our AI community editor.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setCurrentStep("basic_activation")}
            data-testid="button-story-back"
          >
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => advanceStep("capability_activation")}
            data-testid="button-story-skip"
          >
            Skip for now <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  const renderCapabilityStep = () => (
    <Card data-testid="workflow-step-capability">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5 text-violet-600" />
          Capabilities
        </CardTitle>
        <CardDescription>
          Choose additional features for your Hub presence.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          {["Events Calendar", "Job Board", "Marketplace", "Hub TV Network"].map((cap) => (
            <div key={cap} className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
              <Sparkles className="h-4 w-4 text-violet-500 shrink-0" />
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{cap}</span>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setCurrentStep("story_builder")}
            data-testid="button-capability-back"
          >
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <Button
            className="flex-1"
            disabled={isLoading}
            onClick={() => advanceStep("hub_category_setup")}
            data-testid="button-capability-next"
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ArrowRight className="h-4 w-4 mr-2" />}
            Continue
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  const renderCategoryStep = () => (
    <Card data-testid="workflow-step-category">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Star className="h-5 w-5 text-violet-600" />
          Hub Category
        </CardTitle>
        <CardDescription>
          We'll place you in the right neighborhood category based on your information.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800 p-4">
          <p className="text-sm text-violet-800 dark:text-violet-300">
            Your category placement will be optimized automatically based on your business details and story.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setCurrentStep("capability_activation")}
            data-testid="button-category-back"
          >
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <Button
            className="flex-1"
            disabled={isLoading}
            onClick={() => advanceStep("complete")}
            data-testid="button-category-complete"
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}
            Complete Setup
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  const renderCompleteStep = () => (
    <div className="space-y-6" data-testid="workflow-step-complete">
      <Card>
        <CardContent className="pt-6 text-center">
          <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
            You're All Set
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            {formData.businessName
              ? `${formData.businessName} is now on the Hub.`
              : "Your presence is now active on the Hub."
            }
          </p>
        </CardContent>
      </Card>
      {workflowSessionId && (
        <WorkflowNextActions workflowSessionId={workflowSessionId} citySlug={citySlug} sessionSecret={sessionSecret} />
      )}
    </div>
  );

  const renderStep = () => {
    switch (currentStep) {
      case "match": return renderMatchStep();
      case "account_check": return renderAccountStep();
      case "verification": return renderVerificationStep();
      case "identity_router": return renderIdentityStep();
      case "basic_activation": return renderActivationStep();
      case "story_builder": return renderStoryStep();
      case "capability_activation": return renderCapabilityStep();
      case "hub_category_setup": return renderCategoryStep();
      case "complete": return renderCompleteStep();
      default: return renderMatchStep();
    }
  };

  return (
    <div className="max-w-xl mx-auto px-4 py-8" data-testid="workflow-form-page">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-1">
          Get Started on the Hub
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Set up your neighborhood presence in a few steps
        </p>
      </div>
      <StepBar current={currentStep} />
      {currentStep !== "complete" && (
        <div className="mb-4 text-center">
          <button
            className="text-sm text-violet-600 dark:text-violet-400 flex items-center gap-1.5 mx-auto"
            onClick={goToCharlotte}
            data-testid="button-switch-to-charlotte"
          >
            <img src={charlotteAvatar} alt="Charlotte" className="w-5 h-5 rounded-full" />
            Talk to Charlotte instead
          </button>
        </div>
      )}
      {renderStep()}
    </div>
  );
}
