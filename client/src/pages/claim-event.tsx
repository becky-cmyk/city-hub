import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  CheckCircle, AlertCircle, Calendar, MapPin, Shield,
  Loader2, ArrowRight, Mail, Phone, User
} from "lucide-react";
import { useLocation } from "wouter";
import { useState, useEffect } from "react";

interface ClaimEventData {
  eventId: string;
  title: string;
  slug: string;
  startDateTime: string;
  locationName: string | null;
  imageUrl: string | null;
  organizerName: string | null;
  organizerEmail: string | null;
  maskedOrganizerPhone: string | null;
  availableChannels: string[];
  citySlug: string;
}

type FlowStep = "confirm" | "verification" | "complete";

export default function ClaimEvent({ citySlug, token: initialToken }: { citySlug: string; token: string }) {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const isSelfInitiate = initialToken === "self";
  const selfEventId = isSelfInitiate ? new URLSearchParams(window.location.search).get("eventId") : null;
  const [activeToken, setActiveToken] = useState(isSelfInitiate ? "" : initialToken);
  const [step, setStep] = useState<FlowStep>("confirm");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [verificationSent, setVerificationSent] = useState(false);
  const [verificationType, setVerificationType] = useState<"EMAIL" | "SMS">("EMAIL");
  const [govAccuracy, setGovAccuracy] = useState(false);

  const { data, isLoading, error } = useQuery<ClaimEventData>({
    queryKey: ["/api/event-claim/verify", activeToken],
    queryFn: async () => {
      const resp = await fetch(`/api/event-claim/verify?token=${activeToken}`);
      if (!resp.ok) {
        const err = await resp.json();
        throw new Error(err.error || "Invalid claim link");
      }
      return resp.json();
    },
    enabled: !!activeToken && !isSelfInitiate || (isSelfInitiate && !!activeToken),
  });

  const [pendingReview, setPendingReview] = useState(false);

  const initiateMutation = useMutation({
    mutationFn: async () => {
      if (!selfEventId || !email) throw new Error("Event ID and email required");
      const res = await apiRequest("POST", "/api/event-claim/initiate", {
        eventId: selfEventId,
        name,
        email,
        phone,
      });
      return res.json();
    },
    onSuccess: (result: { token?: string; pendingReview?: boolean; message?: string }) => {
      if (result.pendingReview) {
        setPendingReview(true);
      } else if (result.token) {
        setActiveToken(result.token);
      }
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  useEffect(() => {
    if (data) {
      if (data.organizerEmail) setEmail(data.organizerEmail);
      if (data.organizerName) setName(data.organizerName);
      if (data.availableChannels?.length > 0) {
        setVerificationType(data.availableChannels[0] as "EMAIL" | "SMS");
      }
      setStep("confirm");
    }
  }, [data]);

  const sendCodeMutation = useMutation({
    mutationFn: async () => {
      const target = verificationType === "EMAIL" ? email : phone;
      await apiRequest("POST", "/api/event-claim/send-code", {
        eventId: data!.eventId,
        type: verificationType,
        target,
        token: activeToken,
      });
    },
    onSuccess: () => {
      setVerificationSent(true);
      toast({ title: `Verification code sent via ${verificationType.toLowerCase()}` });
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const verifyCodeMutation = useMutation({
    mutationFn: async () => {
      const verifyTarget = verificationType === "EMAIL" ? email : phone;
      await apiRequest("POST", "/api/event-claim/verify-code", {
        eventId: data!.eventId,
        code: verificationCode,
        type: verificationType,
        token: activeToken,
        target: verifyTarget,
      });
    },
    onSuccess: () => {
      completeMutation.mutate();
    },
    onError: (e: Error) => {
      toast({ title: "Invalid Code", description: e.message, variant: "destructive" });
    },
  });

  const [claimResult, setClaimResult] = useState<{ venueEventsUrl?: string | null } | null>(null);

  const completeMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/event-claim/complete", {
        eventId: data!.eventId,
        token: activeToken,
        name,
        email,
        phone,
      });
      return res.json();
    },
    onSuccess: (result: { success: boolean; venueEventsUrl?: string | null }) => {
      setClaimResult(result);
      setStep("complete");
      toast({ title: "Event claimed successfully!" });
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  if (isSelfInitiate && !activeToken) {
    if (pendingReview) {
      return (
        <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-950 dark:to-gray-900 flex items-center justify-center p-4">
          <Card className="max-w-md w-full p-8 text-center">
            <CheckCircle className="h-12 w-12 mx-auto mb-4 text-purple-500" />
            <h2 className="text-xl font-bold mb-2" data-testid="text-pending-review-title">Claim Request Submitted</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Your claim request has been submitted for review. Our team will verify your identity and send you a claim link once approved.
            </p>
            <Button onClick={() => setLocation(`/${citySlug}`)} data-testid="button-back-to-city-pending">
              Back to CLT Hub
            </Button>
          </Card>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-950 dark:to-gray-900 flex items-center justify-center p-4">
        <div className="max-w-lg w-full space-y-6">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-sm font-medium mb-4">
              <Calendar className="h-4 w-4" />
              Claim Your Event
            </div>
          </div>
          <Card className="p-6">
            <h1 className="text-xl font-bold mb-2" data-testid="text-self-claim-title">Claim This Event</h1>
            <p className="text-sm text-muted-foreground mb-4">
              Enter your details to start the claim process. We'll verify your identity as the event organizer.
            </p>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground flex items-center gap-1">
                  <User className="h-3 w-3" /> Your Name
                </label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" data-testid="input-self-claim-name" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground flex items-center gap-1">
                  <Mail className="h-3 w-3" /> Email
                </label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="your@email.com" data-testid="input-self-claim-email" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground flex items-center gap-1">
                  <Phone className="h-3 w-3" /> Phone (optional)
                </label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(555) 123-4567" data-testid="input-self-claim-phone" />
              </div>
              <Button
                className="w-full"
                disabled={!name || !email || initiateMutation.isPending}
                onClick={() => initiateMutation.mutate()}
                data-testid="button-self-initiate"
              >
                {initiateMutation.isPending ? (
                  <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Starting Claim...</>
                ) : (
                  <>Start Claim Process <ArrowRight className="h-4 w-4 ml-1" /></>
                )}
              </Button>
            </div>
          </Card>
          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <Shield className="h-3.5 w-3.5" />
            Secure claim process powered by CLT Metro Hub
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-950 dark:to-gray-900 flex items-center justify-center p-4">
        <Card className="max-w-md w-full p-8 text-center">
          <Skeleton className="h-8 w-3/4 mx-auto mb-4" />
          <Skeleton className="h-4 w-1/2 mx-auto" />
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-950 dark:to-gray-900 flex items-center justify-center p-4">
        <Card className="max-w-md w-full p-8 text-center">
          <AlertCircle className="h-12 w-12 mx-auto mb-4 text-red-500" />
          <h2 className="text-xl font-bold mb-2" data-testid="text-claim-error">Claim Link Invalid</h2>
          <p className="text-muted-foreground" data-testid="text-claim-error-message">
            {(error as Error).message || "This claim link is invalid or has expired."}
          </p>
          <Button className="mt-4" onClick={() => setLocation(`/${citySlug}`)} data-testid="button-back-to-city">
            Back to CLT Hub
          </Button>
        </Card>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-950 dark:to-gray-900 flex items-center justify-center p-4">
      <div className="max-w-lg w-full space-y-6">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-sm font-medium mb-4">
            <Calendar className="h-4 w-4" />
            Claim Your Event
          </div>
        </div>

        {data.imageUrl && (
          <div className="rounded-xl overflow-hidden aspect-[2.5/1]">
            <img src={data.imageUrl} alt={data.title} className="w-full h-full object-cover" data-testid="img-event-claim" />
          </div>
        )}

        <Card className="p-6">
          <h1 className="text-xl font-bold mb-1" data-testid="text-event-title">{data.title}</h1>
          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground mb-4">
            {data.startDateTime && (
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                {new Date(data.startDateTime).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
              </span>
            )}
            {data.locationName && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                {data.locationName}
              </span>
            )}
          </div>

          {step === "confirm" && (
            <div className="space-y-4" data-testid="section-confirm-details">
              <p className="text-sm text-muted-foreground">
                Confirm your details to claim this event. You'll need to verify your identity to complete the claim.
              </p>

              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground flex items-center gap-1">
                    <User className="h-3 w-3" /> Your Name
                  </label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Full name"
                    data-testid="input-claim-name"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground flex items-center gap-1">
                    <Mail className="h-3 w-3" /> Email
                  </label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    data-testid="input-claim-email"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground flex items-center gap-1">
                    <Phone className="h-3 w-3" /> Phone (optional)
                  </label>
                  <Input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="(555) 123-4567"
                    data-testid="input-claim-phone"
                  />
                </div>
              </div>

              <label className="flex items-start gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={govAccuracy}
                  onChange={(e) => setGovAccuracy(e.target.checked)}
                  className="mt-1"
                  data-testid="checkbox-accuracy"
                />
                <span className="text-muted-foreground">
                  I confirm that I am the organizer of this event or am authorized to manage it on their behalf.
                </span>
              </label>

              <Button
                className="w-full"
                disabled={!name || !email || !govAccuracy}
                onClick={() => setStep("verification")}
                data-testid="button-proceed-verification"
              >
                Continue to Verification <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          )}

          {step === "verification" && (
            <div className="space-y-4" data-testid="section-verification">
              <p className="text-sm text-muted-foreground">
                We'll send a verification code to confirm your identity.
              </p>

              <div className="flex gap-2">
                {(!data?.availableChannels || data.availableChannels.includes("EMAIL")) && (
                  <Button
                    variant={verificationType === "EMAIL" ? "default" : "outline"}
                    className="flex-1"
                    onClick={() => setVerificationType("EMAIL")}
                    data-testid="button-verify-email"
                  >
                    <Mail className="h-4 w-4 mr-1" /> Email
                  </Button>
                )}
                {data?.availableChannels?.includes("SMS") && (
                  <Button
                    variant={verificationType === "SMS" ? "default" : "outline"}
                    className="flex-1"
                    onClick={() => setVerificationType("SMS")}
                    data-testid="button-verify-sms"
                  >
                    <Phone className="h-4 w-4 mr-1" /> SMS
                  </Button>
                )}
              </div>

              {verificationType === "EMAIL" ? (
                <p className="text-xs text-muted-foreground">
                  Sending to: <strong>{email}</strong>
                </p>
              ) : (
                <div className="space-y-1.5">
                  <p className="text-xs text-muted-foreground">
                    Enter the phone number on file{data?.maskedOrganizerPhone ? ` (ending ${data.maskedOrganizerPhone.slice(-4)})` : ""} to verify via SMS:
                  </p>
                  <Input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="(555) 123-4567"
                    data-testid="input-verify-phone"
                  />
                </div>
              )}

              {!verificationSent ? (
                <Button
                  className="w-full"
                  onClick={() => sendCodeMutation.mutate()}
                  disabled={sendCodeMutation.isPending || (verificationType === "SMS" && !phone)}
                  data-testid="button-send-code"
                >
                  {sendCodeMutation.isPending ? (
                    <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Sending...</>
                  ) : (
                    <>Send Verification Code</>
                  )}
                </Button>
              ) : (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-xs text-muted-foreground">Enter 6-digit code</label>
                    <Input
                      value={verificationCode}
                      onChange={(e) => setVerificationCode(e.target.value)}
                      placeholder="123456"
                      maxLength={6}
                      className="text-center text-2xl tracking-[0.5em] font-mono"
                      data-testid="input-verification-code"
                    />
                  </div>

                  <Button
                    className="w-full"
                    onClick={() => verifyCodeMutation.mutate()}
                    disabled={verificationCode.length !== 6 || verifyCodeMutation.isPending || completeMutation.isPending}
                    data-testid="button-verify-code"
                  >
                    {verifyCodeMutation.isPending || completeMutation.isPending ? (
                      <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Verifying...</>
                    ) : (
                      <>Verify & Claim Event</>
                    )}
                  </Button>

                  <button
                    className="text-xs text-purple-600 dark:text-purple-400 underline"
                    onClick={() => { setVerificationSent(false); setVerificationCode(""); }}
                    data-testid="button-resend-code"
                  >
                    Resend code
                  </button>
                </div>
              )}
            </div>
          )}

          {step === "complete" && (
            <div className="text-center space-y-4 py-4" data-testid="section-complete">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30">
                <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>
              <h2 className="text-xl font-bold" data-testid="text-claim-success">Event Claimed!</h2>
              <p className="text-sm text-muted-foreground">
                You now have full control of <strong>{data.title}</strong>. You can edit details, manage RSVPs, and post updates.
              </p>
              <div className="flex flex-col gap-2 pt-2">
                {claimResult?.venueEventsUrl && (
                  <Button
                    onClick={() => setLocation(claimResult.venueEventsUrl!)}
                    data-testid="button-manage-events"
                  >
                    Manage Your Events <ArrowRight className="h-4 w-4 ml-1" />
                  </Button>
                )}
                <Button
                  variant={claimResult?.venueEventsUrl ? "outline" : "default"}
                  onClick={() => setLocation(`/${data.citySlug}/events/${data.slug}`)}
                  data-testid="button-view-event"
                >
                  View Event Page <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setLocation(`/${data.citySlug}`)}
                  data-testid="button-back-to-hub"
                >
                  Back to CLT Hub
                </Button>
              </div>
            </div>
          )}
        </Card>

        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <Shield className="h-3.5 w-3.5" />
          Secure claim process powered by CLT Metro Hub
        </div>
      </div>
    </div>
  );
}
