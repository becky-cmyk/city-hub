import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { Building2, Search, CheckCircle, Users, Shield, Crown, ArrowRight, ArrowLeft, MapPin, Globe, Sparkles, AlertCircle } from "lucide-react";

type Step = "search" | "found" | "role" | "account" | "success";

interface PresenceResult {
  id: string;
  name: string;
  slug: string;
  address?: string;
  city?: string;
  state?: string;
  imageUrl?: string | null;
  claimStatus?: string;
  description?: string;
  micrositeTagline?: string;
}

const STEPS: Step[] = ["search", "found", "role", "account", "success"];

function StepIndicator({ current }: { current: Step }) {
  const labels = ["Search", "Confirm", "Role", "Account", "Done"];
  const currentIdx = STEPS.indexOf(current);
  return (
    <div className="flex items-center justify-center gap-2 mb-6" data-testid="step-indicator">
      {STEPS.map((step, i) => (
        <div key={step} className="flex items-center gap-2">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
              i < currentIdx
                ? "bg-[#5B1D8F] text-white"
                : i === currentIdx
                ? "bg-[#F2C230] text-[#5B1D8F]"
                : "bg-muted text-muted-foreground"
            }`}
            data-testid={`step-dot-${step}`}
          >
            {i < currentIdx ? <CheckCircle className="w-4 h-4" /> : i + 1}
          </div>
          <span className="text-xs text-muted-foreground hidden sm:inline">{labels[i]}</span>
          {i < STEPS.length - 1 && (
            <div className={`w-6 h-0.5 ${i < currentIdx ? "bg-[#5B1D8F]" : "bg-muted"}`} />
          )}
        </div>
      ))}
    </div>
  );
}

export default function ConfirmPresence({ citySlug }: { citySlug: string }) {
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const [step, setStep] = useState<Step>("search");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [businessName, setBusinessName] = useState("");
  const [city, setCity] = useState("Charlotte");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");

  const [presence, setPresence] = useState<PresenceResult | null>(null);
  const [clarifyQuestions, setClarifyQuestions] = useState<string[]>([]);
  const [clarifyAnswers, setClarifyAnswers] = useState<string[]>([]);

  const [selectedRole, setSelectedRole] = useState<"owner" | "manager" | "team" | "">("");
  const [ownerRefName, setOwnerRefName] = useState("");
  const [ownerRefEmail, setOwnerRefEmail] = useState("");

  const [displayName, setDisplayName] = useState("");
  const [accountEmail, setAccountEmail] = useState("");
  const [personalEmail, setPersonalEmail] = useState("");
  const [password, setPassword] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [govAccuracy, setGovAccuracy] = useState(false);
  const [govAuthorized, setGovAuthorized] = useState(false);
  const [govTerms, setGovTerms] = useState(false);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!businessName.trim()) {
      toast({ title: "Business name is required", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    setClarifyQuestions([]);
    try {
      const resp = await apiRequest("POST", "/api/confirm/find-presence", {
        businessName: businessName.trim(),
        city,
        contactName,
        contactEmail,
        websiteUrl,
      });
      const data = await resp.json();
      if (data.status === "found" && data.presence) {
        setPresence(data.presence);
        setStep("found");
      } else if (data.status === "clarify" && data.questions) {
        setClarifyQuestions(data.questions);
        setClarifyAnswers(new Array(data.questions.length).fill(""));
      } else {
        await autoGenerate();
      }
    } catch (err: any) {
      toast({ title: "Search failed", description: err.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleClarify() {
    setIsSubmitting(true);
    try {
      const resp = await apiRequest("POST", "/api/confirm/clarify", {
        businessName,
        city,
        answers: clarifyAnswers,
      });
      const data = await resp.json();
      if (data.status === "found" && data.presence) {
        setPresence(data.presence);
        setStep("found");
        setClarifyQuestions([]);
      } else {
        setClarifyQuestions([]);
        await autoGenerate();
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function autoGenerate() {
    try {
      const resp = await apiRequest("POST", "/api/confirm/generate", {
        businessName,
        city,
        contactName,
        contactEmail,
        websiteUrl,
      });
      const data = await resp.json();
      if (data.presence) {
        setPresence(data.presence);
        setStep("found");
      }
    } catch (err: any) {
      toast({ title: "Error creating presence", description: err.message, variant: "destructive" });
    }
  }

  async function handleClaim(e: React.FormEvent) {
    e.preventDefault();
    if (!displayName.trim() || !accountEmail.trim() || !password.trim()) {
      toast({ title: "Please fill in all required fields", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    try {
      await apiRequest("POST", "/api/confirm/claim", {
        presenceId: presence?.id,
        role: selectedRole,
        displayName,
        email: accountEmail,
        personalEmail: personalEmail.trim() || undefined,
        password,
        dateOfBirth,
        ownerRefName: selectedRole !== "owner" ? ownerRefName : undefined,
        ownerRefEmail: selectedRole !== "owner" ? ownerRefEmail : undefined,
      });
      setStep("success");
    } catch (err: any) {
      toast({ title: "Claim failed", description: err.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto py-8 px-4 space-y-4">
      <StepIndicator current={step} />

      {step === "search" && (
        <Card>
          <div className="h-2 rounded-t-md bg-gradient-to-r from-[#5B1D8F] via-[#F04FAF] to-[#F2C230]" />
          <CardHeader>
            <CardTitle className="flex items-center gap-2 flex-wrap" data-testid="text-search-title">
              <Building2 className="h-6 w-6 text-[#5B1D8F]" />
              Confirm Your Hub Presence
            </CardTitle>
            <CardDescription>
              Let's find your business, organization, or service in our directory
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSearch} className="space-y-4">
              <div>
                <Label htmlFor="businessName">Business Name *</Label>
                <Input
                  id="businessName"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="Enter your business name"
                  required
                  data-testid="input-business-name"
                />
              </div>
              <div>
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Charlotte"
                  data-testid="input-city"
                />
              </div>
              <div>
                <Label htmlFor="contactName">Contact Name</Label>
                <Input
                  id="contactName"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  placeholder="Your full name"
                  data-testid="input-contact-name"
                />
              </div>
              <div>
                <Label htmlFor="contactEmail">Contact Email</Label>
                <Input
                  id="contactEmail"
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder="you@example.com"
                  data-testid="input-contact-email"
                />
              </div>
              <div>
                <Label htmlFor="websiteUrl">Website or Social URL (optional)</Label>
                <div className="relative">
                  <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="websiteUrl"
                    value={websiteUrl}
                    onChange={(e) => setWebsiteUrl(e.target.value)}
                    placeholder="https://..."
                    className="pl-10"
                    data-testid="input-website-url"
                  />
                </div>
              </div>

              {clarifyQuestions.length > 0 && (
                <div className="space-y-3 border rounded-md p-4">
                  <p className="text-sm font-medium flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-[#F2C230]" />
                    We need a bit more info to find your listing
                  </p>
                  {clarifyQuestions.map((q, i) => (
                    <div key={i}>
                      <Label>{q}</Label>
                      <Input
                        value={clarifyAnswers[i] || ""}
                        onChange={(e) => {
                          const next = [...clarifyAnswers];
                          next[i] = e.target.value;
                          setClarifyAnswers(next);
                        }}
                        data-testid={`input-clarify-${i}`}
                      />
                    </div>
                  ))}
                  <Button
                    type="button"
                    onClick={handleClarify}
                    disabled={isSubmitting}
                    className="w-full bg-[#5B1D8F] hover:bg-[#5B1D8F]/90 text-white"
                    data-testid="button-submit-clarify"
                  >
                    {isSubmitting ? "Searching..." : "Submit Answers"}
                  </Button>
                </div>
              )}

              {clarifyQuestions.length === 0 && (
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-[#5B1D8F] hover:bg-[#5B1D8F]/90 text-white"
                  data-testid="button-search-presence"
                >
                  <Search className="h-4 w-4 mr-2" />
                  {isSubmitting ? "Searching..." : "Find My Business"}
                </Button>
              )}
            </form>
          </CardContent>
        </Card>
      )}

      {step === "found" && presence && (
        <Card>
          <div className="h-2 rounded-t-md bg-gradient-to-r from-[#5B1D8F] via-[#F04FAF] to-[#F2C230]" />
          <CardHeader>
            <CardTitle data-testid="text-found-title">Is this your business?</CardTitle>
            <CardDescription>Please confirm this is the correct listing</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-4 p-4 border rounded-md">
              {presence.imageUrl && (
                <img
                  src={presence.imageUrl}
                  alt={presence.name}
                  className="h-20 w-20 rounded-md object-cover shrink-0"
                  data-testid="img-presence"
                />
              )}
              <div className="min-w-0">
                <h3 className="font-semibold text-lg" data-testid="text-presence-name">
                  {presence.name}
                </h3>
                {(presence.address || presence.city) && (
                  <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                    <MapPin className="h-3 w-3 shrink-0" />
                    {[presence.address, presence.city, presence.state].filter(Boolean).join(", ")}
                  </p>
                )}
                {presence.micrositeTagline && (
                  <p className="text-sm italic text-muted-foreground mt-1" data-testid="text-presence-tagline">
                    {presence.micrositeTagline}
                  </p>
                )}
                {presence.description && (
                  <p className="text-sm text-muted-foreground mt-1" data-testid="text-presence-description">
                    {presence.description}
                  </p>
                )}
                {presence.claimStatus && (
                  <span className="inline-block mt-2 text-xs px-2 py-0.5 rounded-full bg-[#F2C230]/20 text-[#5B1D8F] font-medium">
                    {presence.claimStatus}
                  </span>
                )}
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                onClick={() => setStep("role")}
                className="flex-1 bg-[#5B1D8F] hover:bg-[#5B1D8F]/90 text-white"
                data-testid="button-confirm-yes"
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Yes, that's me
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setPresence(null);
                  setStep("search");
                }}
                className="flex-1"
                data-testid="button-confirm-no"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                No, search again
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === "role" && (
        <Card>
          <div className="h-2 rounded-t-md bg-gradient-to-r from-[#5B1D8F] via-[#F04FAF] to-[#F2C230]" />
          <CardHeader>
            <CardTitle data-testid="text-role-title">Select Your Role</CardTitle>
            <CardDescription>
              How are you connected to {presence?.name || "this business"}?
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3">
              {([
                {
                  value: "owner" as const,
                  icon: Crown,
                  label: "Owner",
                  desc: "I am the owner or authorized representative",
                  badge: "Instant Access",
                  badgeClass: "bg-[#F2C230]/20 text-[#5B1D8F]",
                },
                {
                  value: "manager" as const,
                  icon: Shield,
                  label: "Manager",
                  desc: "I manage this business on behalf of the owner",
                  badge: "Requires Owner Approval",
                  badgeClass: "bg-[#F04FAF]/10 text-[#F04FAF]",
                },
                {
                  value: "team" as const,
                  icon: Users,
                  label: "Team",
                  desc: "I'm a team member (staff, volunteer, etc.)",
                  badge: "Requires Owner Approval",
                  badgeClass: "bg-[#F04FAF]/10 text-[#F04FAF]",
                },
              ]).map((role) => (
                <button
                  key={role.value}
                  type="button"
                  onClick={() => setSelectedRole(role.value)}
                  className={`w-full text-left p-4 rounded-md border-2 transition-colors ${
                    selectedRole === role.value
                      ? "border-[#5B1D8F] bg-[#5B1D8F]/5"
                      : "border-border hover-elevate"
                  }`}
                  data-testid={`button-role-${role.value}`}
                >
                  <div className="flex items-start gap-3">
                    <role.icon className={`h-5 w-5 shrink-0 mt-0.5 ${
                      selectedRole === role.value ? "text-[#5B1D8F]" : "text-muted-foreground"
                    }`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{role.label}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${role.badgeClass}`}>
                          {role.badge}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{role.desc}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {(selectedRole === "manager" || selectedRole === "team") && (
              <div className="space-y-3 border rounded-md p-4">
                <p className="text-sm font-medium">Owner Information</p>
                <div>
                  <Label htmlFor="ownerRefName">Owner Name</Label>
                  <Input
                    id="ownerRefName"
                    value={ownerRefName}
                    onChange={(e) => setOwnerRefName(e.target.value)}
                    placeholder="Owner's full name"
                    data-testid="input-owner-ref-name"
                  />
                </div>
                <div>
                  <Label htmlFor="ownerRefEmail">Owner Email</Label>
                  <Input
                    id="ownerRefEmail"
                    type="email"
                    value={ownerRefEmail}
                    onChange={(e) => setOwnerRefEmail(e.target.value)}
                    placeholder="owner@example.com"
                    data-testid="input-owner-ref-email"
                  />
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setStep("found")}
                data-testid="button-role-back"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <Button
                onClick={() => setStep("account")}
                disabled={!selectedRole}
                className="flex-1 bg-[#5B1D8F] hover:bg-[#5B1D8F]/90 text-white"
                data-testid="button-role-continue"
              >
                Continue
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === "account" && (
        <Card>
          <div className="h-2 rounded-t-md bg-gradient-to-r from-[#5B1D8F] via-[#F04FAF] to-[#F2C230]" />
          <CardHeader>
            <CardTitle data-testid="text-account-title">
              {selectedRole === "owner" ? "Create Your Ownership Account" : "Complete Your Claim"}
            </CardTitle>
            <CardDescription>
              Set up your account to manage your presence on the hub
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleClaim} className="space-y-4">
              <div>
                <Label htmlFor="displayName">Display Name *</Label>
                <Input
                  id="displayName"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Your display name"
                  required
                  data-testid="input-display-name"
                />
              </div>
              <div>
                <Label htmlFor="accountEmail">Business Email *</Label>
                <p className="text-xs text-muted-foreground mb-1">Used to manage your presence. Not displayed publicly.</p>
                <Input
                  id="accountEmail"
                  type="email"
                  value={accountEmail}
                  onChange={(e) => setAccountEmail(e.target.value)}
                  placeholder="you@yourbusiness.com"
                  required
                  data-testid="input-account-email"
                />
              </div>
              <div>
                <Label htmlFor="personalEmail">Personal Email</Label>
                <p className="text-xs text-muted-foreground mb-1">For your personal hub experience and community updates.</p>
                <Input
                  id="personalEmail"
                  type="email"
                  value={personalEmail}
                  onChange={(e) => setPersonalEmail(e.target.value)}
                  placeholder="you@gmail.com"
                  data-testid="input-personal-email"
                />
              </div>
              <div>
                <Label htmlFor="password">Password *</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Create a secure password"
                  required
                  data-testid="input-password"
                />
              </div>
              <div>
                <Label htmlFor="dob">Date of Birth</Label>
                <Input
                  id="dob"
                  type="date"
                  value={dateOfBirth}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                  data-testid="input-dob"
                />
              </div>

              <div className="space-y-3 border rounded-md p-4 bg-muted/30">
                <p className="text-sm font-medium flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Governance Confirmations
                </p>
                <label className="flex items-start gap-3 cursor-pointer" data-testid="checkbox-gov-accuracy">
                  <input
                    type="checkbox"
                    checked={govAccuracy}
                    onChange={(e) => setGovAccuracy(e.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-gray-300"
                  />
                  <span className="text-sm">I confirm that the information provided is accurate and truthful.</span>
                </label>
                <label className="flex items-start gap-3 cursor-pointer" data-testid="checkbox-gov-authorized">
                  <input
                    type="checkbox"
                    checked={govAuthorized}
                    onChange={(e) => setGovAuthorized(e.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-gray-300"
                  />
                  <span className="text-sm">I am authorized to manage this presence on behalf of the business or organization.</span>
                </label>
                <label className="flex items-start gap-3 cursor-pointer" data-testid="checkbox-gov-terms">
                  <input
                    type="checkbox"
                    checked={govTerms}
                    onChange={(e) => setGovTerms(e.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-gray-300"
                  />
                  <span className="text-sm">I agree to the platform terms of service and community guidelines.</span>
                </label>
              </div>

              <p className="text-xs text-muted-foreground">
                Already have an account? Sign in first, then return here.
              </p>

              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep("role")}
                  data-testid="button-account-back"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting || !govAccuracy || !govAuthorized || !govTerms}
                  className="flex-1 bg-[#5B1D8F] hover:bg-[#5B1D8F]/90 text-white"
                  data-testid="button-submit-claim"
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  {isSubmitting ? "Submitting..." : "Confirm My Presence"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {step === "success" && (
        <Card>
          <div className="h-2 rounded-t-md bg-gradient-to-r from-[#5B1D8F] via-[#F04FAF] to-[#F2C230]" />
          <CardContent className="py-12 text-center space-y-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center animate-bounce">
              <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
            <h2 className="text-2xl font-bold" data-testid="text-success-title">
              Your Presence Has Been Confirmed!
            </h2>
            <p className="text-muted-foreground max-w-md mx-auto">
              {selectedRole === "owner"
                ? "You now have full access to manage your presence."
                : "Your request has been sent to the owner for approval."}
            </p>
            {presence?.slug && (
              <div className="flex flex-col gap-2 max-w-xs mx-auto pt-4">
                <Button
                  onClick={() => setLocation(`/${citySlug}/owner/${presence.slug}`)}
                  className="bg-[#5B1D8F] hover:bg-[#5B1D8F]/90 text-white"
                  data-testid="button-go-dashboard"
                >
                  Go to Owner Dashboard
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setLocation(`/${citySlug}`)}
                  data-testid="button-go-home"
                >
                  Back to Hub Home
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
