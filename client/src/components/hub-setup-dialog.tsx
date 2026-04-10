import { useState, useEffect, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { Loader2, MapPin, Briefcase, Music, Eye, EyeOff } from "lucide-react";
import cosmicBg from "@assets/General_Backgroun_CLT_colors_1771643702572.png";
import { useI18n } from "@/lib/i18n";

type Step = "welcome" | "home_zip" | "work_play" | "account" | "saving" | "done";

interface ZoneInfo {
  id?: number;
  name?: string;
  resolved: boolean;
  noMatch?: boolean;
}

interface HubSetupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const STEPS_LOGGED_IN: Step[] = ["welcome", "home_zip", "work_play", "saving", "done"];
const STEPS_LOGGED_OUT: Step[] = ["welcome", "home_zip", "work_play", "account", "done"];

function StepDots({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center justify-center gap-1.5 mb-4" data-testid="step-dots">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className="rounded-full transition-all duration-300"
          style={{
            width: i === current ? 20 : 8,
            height: 8,
            backgroundColor: i === current ? "#F2C230" : i < current ? "#5B1D8F" : "rgba(255,255,255,0.3)",
          }}
        />
      ))}
    </div>
  );
}

async function resolveZip(zip: string): Promise<ZoneInfo> {
  try {
    const res = await fetch(`/api/zones/resolve?zip=${zip}&citySlug=charlotte`);
    if (!res.ok) return { resolved: true, noMatch: true };
    const data = await res.json();
    const bestZone = data?.zones?.find((z: any) => z.id && z.name);
    if (bestZone) {
      return { id: bestZone.id, name: bestZone.name, resolved: true };
    }
    if (data?.zipZoneId) {
      return { id: data.zipZoneId, name: data.county || `ZIP ${zip}`, resolved: true };
    }
    return { resolved: true, noMatch: true };
  } catch {
    return { resolved: true, noMatch: true };
  }
}

export function HubSetupDialog({ open, onOpenChange }: HubSetupDialogProps) {
  const { toast } = useToast();
  const { user, isLoggedIn } = useAuth();
  const { t } = useI18n();

  const steps = isLoggedIn ? STEPS_LOGGED_IN : STEPS_LOGGED_OUT;
  const [step, setStep] = useState<Step>("welcome");
  const currentIndex = steps.indexOf(step);

  const [homeZip, setHomeZip] = useState("");
  const [homeZone, setHomeZone] = useState<ZoneInfo>({ resolved: false });
  const [homeResolving, setHomeResolving] = useState(false);

  const [workZip, setWorkZip] = useState("");
  const [workZone, setWorkZone] = useState<ZoneInfo>({ resolved: false });
  const [workResolving, setWorkResolving] = useState(false);

  const [playZip, setPlayZip] = useState("");
  const [playZone, setPlayZone] = useState<ZoneInfo>({ resolved: false });
  const [playResolving, setPlayResolving] = useState(false);

  const [authMode, setAuthMode] = useState<"register" | "signin">("register");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const resetState = useCallback(() => {
    setStep("welcome");
    setHomeZip("");
    setHomeZone({ resolved: false });
    setWorkZip("");
    setWorkZone({ resolved: false });
    setPlayZip("");
    setPlayZone({ resolved: false });
    setAuthMode("register");
    setDisplayName("");
    setEmail("");
    setPassword("");
    setDateOfBirth("");
    setShowPassword(false);
  }, []);

  useEffect(() => {
    if (!open) resetState();
  }, [open, resetState]);

  const autoResolve = useCallback(async (zip: string, setZone: (z: ZoneInfo) => void, setResolving: (b: boolean) => void) => {
    if (zip.length === 5 && /^\d{5}$/.test(zip)) {
      setResolving(true);
      const result = await resolveZip(zip);
      setZone(result);
      setResolving(false);
    } else {
      setZone({ resolved: false });
    }
  }, []);

  useEffect(() => { autoResolve(homeZip, setHomeZone, setHomeResolving); }, [homeZip, autoResolve]);
  useEffect(() => { autoResolve(workZip, setWorkZone, setWorkResolving); }, [workZip, autoResolve]);
  useEffect(() => { autoResolve(playZip, setPlayZone, setPlayResolving); }, [playZip, autoResolve]);

  const saveHubs = useCallback(async () => {
    const hubs: { hubType: string; zip: string; zone: ZoneInfo }[] = [];
    if (homeZip) hubs.push({ hubType: "HOME", zip: homeZip, zone: homeZone });
    if (workZip) hubs.push({ hubType: "WORK", zip: workZip, zone: workZone });
    if (playZip) hubs.push({ hubType: "PLAY", zip: playZip, zone: playZone });

    for (const hub of hubs) {
      await apiRequest("POST", "/api/auth/hubs", {
        hubType: hub.hubType,
        city: "Charlotte",
        state: "NC",
        zip: hub.zip,
        neighborhood: hub.zone.name || "",
        radiusMiles: 15,
        zoneId: hub.zone.id || null,
      });
    }
    queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
  }, [homeZip, homeZone, workZip, workZone, playZip, playZone]);

  const saveMutation = useMutation({
    mutationFn: saveHubs,
    onSuccess: () => setStep("done"),
    onError: (error: any) => {
      toast({ title: t("hubSetup.saveFailed"), description: error.message || t("hubSetup.couldNotSave"), variant: "destructive" });
    },
  });

  const registerMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/auth/register", {
        email, password, displayName, dateOfBirth,
      });
      return res.json();
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      try { await saveHubs(); } catch {}
      setStep("done");
    },
    onError: (error: any) => {
      toast({ title: t("hubSetup.regFailed"), description: error.message || t("hubSetup.couldNotCreate"), variant: "destructive" });
    },
  });

  const loginMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/auth/login", { email, password });
      return res.json();
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      try { await saveHubs(); } catch {}
      setStep("done");
    },
    onError: (error: any) => {
      toast({ title: t("hubSetup.signInFailed"), description: error.message || t("hubSetup.invalidCreds"), variant: "destructive" });
    },
  });

  const goNext = () => {
    const idx = steps.indexOf(step);
    if (idx < steps.length - 1) {
      const next = steps[idx + 1];
      if (next === "saving") {
        saveMutation.mutate();
      }
      setStep(next);
    }
  };

  const handleSkip = () => {
    onOpenChange(false);
  };

  const handleZipInput = (value: string, setter: (v: string) => void) => {
    const cleaned = value.replace(/\D/g, "").slice(0, 5);
    setter(cleaned);
  };

  function ZipResult({ zone, resolving }: { zone: ZoneInfo; resolving: boolean }) {
    if (resolving) return <div className="flex items-center gap-1.5 mt-1.5"><Loader2 className="h-3.5 w-3.5 animate-spin" style={{ color: "#F2C230" }} /><span className="text-xs text-muted-foreground">{t("hubSetup.lookingUp")}</span></div>;
    if (!zone.resolved) return null;
    if (zone.name) return <div className="flex items-center gap-1.5 mt-1.5" data-testid="text-zone-resolved"><MapPin className="h-3.5 w-3.5" style={{ color: "#F04FAF" }} /><span className="text-xs font-medium" style={{ color: "#5B1D8F" }}>{t("hubSetup.gotIt", { zone: zone.name })}</span></div>;
    return <div className="text-xs text-muted-foreground mt-1.5" data-testid="text-zone-no-match">{t("hubSetup.noMatch")}</div>;
  }

  const renderStep = () => {
    switch (step) {
      case "welcome":
        return (
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="text-2xl font-bold" style={{ color: "#5B1D8F" }} data-testid="text-welcome-title">
              {t("hubSetup.welcomeTitle")}
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {t("hubSetup.welcomeDesc")}
            </p>
            <Button
              className="w-full"
              style={{ backgroundColor: "#5B1D8F" }}
              onClick={goNext}
              data-testid="button-lets-do-it"
            >
              {t("hubSetup.letsDoIt")}
            </Button>
            <button
              type="button"
              className="text-sm text-muted-foreground hover:underline"
              onClick={handleSkip}
              data-testid="button-maybe-later"
            >
              {t("hubSetup.maybeLater")}
            </button>
          </div>
        );

      case "home_zip":
        return (
          <div className="space-y-4">
            <div className="text-lg font-semibold" style={{ color: "#5B1D8F" }} data-testid="text-home-zip-title">
              {t("hubSetup.homeZipTitle")}
            </div>
            <div className="flex justify-center">
              <Input
                type="text"
                inputMode="numeric"
                placeholder="28202"
                value={homeZip}
                onChange={(e) => handleZipInput(e.target.value, setHomeZip)}
                className="text-center text-2xl tracking-widest max-w-[180px] font-mono"
                maxLength={5}
                data-testid="input-home-zip"
              />
            </div>
            <div className="flex justify-center">
              <ZipResult zone={homeZone} resolving={homeResolving} />
            </div>
            <Button
              className="w-full"
              style={{ backgroundColor: "#5B1D8F" }}
              onClick={goNext}
              disabled={homeZip.length < 5}
              data-testid="button-home-zip-next"
            >
              {t("hubSetup.next")}
            </Button>
          </div>
        );

      case "work_play":
        return (
          <div className="space-y-4">
            <div className="text-lg font-semibold" style={{ color: "#5B1D8F" }} data-testid="text-work-play-title">
              {t("hubSetup.workPlayTitle")}
            </div>
            <p className="text-xs text-muted-foreground">{t("hubSetup.bothOptional")}</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Briefcase className="h-3.5 w-3.5" /> {t("hubSetup.workZip")}
                </div>
                <Input
                  type="text"
                  inputMode="numeric"
                  placeholder="ZIP"
                  value={workZip}
                  onChange={(e) => handleZipInput(e.target.value, setWorkZip)}
                  className="text-center font-mono tracking-wider"
                  maxLength={5}
                  data-testid="input-work-zip"
                />
                <ZipResult zone={workZone} resolving={workResolving} />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Music className="h-3.5 w-3.5" /> {t("hubSetup.playZip")}
                </div>
                <Input
                  type="text"
                  inputMode="numeric"
                  placeholder="ZIP"
                  value={playZip}
                  onChange={(e) => handleZipInput(e.target.value, setPlayZip)}
                  className="text-center font-mono tracking-wider"
                  maxLength={5}
                  data-testid="input-play-zip"
                />
                <ZipResult zone={playZone} resolving={playResolving} />
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={goNext}
                data-testid="button-work-play-skip"
              >
                {t("hubSetup.skipThis")}
              </Button>
              <Button
                className="flex-1"
                style={{ backgroundColor: "#5B1D8F" }}
                onClick={goNext}
                data-testid="button-work-play-next"
              >
                {t("hubSetup.next")}
              </Button>
            </div>
          </div>
        );

      case "account":
        return (
          <div className="space-y-4">
            {authMode === "register" ? (
              <>
                <div className="text-lg font-semibold" style={{ color: "#5B1D8F" }} data-testid="text-account-title">
                  {t("hubSetup.accountTitle")}
                </div>
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium">{t("hubSetup.displayName")}</label>
                    <Input
                      type="text"
                      placeholder="Your name"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      data-testid="input-hub-display-name"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium">{t("hubSetup.email")}</label>
                    <Input
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      data-testid="input-hub-email"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium">{t("hubSetup.password")}</label>
                    <div className="relative">
                      <Input
                        type={showPassword ? "text" : "password"}
                        placeholder={t("hubSetup.minChars")}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        data-testid="input-hub-password"
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                        onClick={() => setShowPassword(!showPassword)}
                        data-testid="button-toggle-hub-password"
                        tabIndex={-1}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium">{t("hubSetup.dateOfBirth")}</label>
                    <Input
                      type="text"
                      placeholder="MM/DD/YYYY"
                      value={dateOfBirth}
                      onChange={(e) => setDateOfBirth(e.target.value)}
                      data-testid="input-hub-dob"
                    />
                    <p className="text-xs text-muted-foreground">{t("hubSetup.dobNote")}</p>
                  </div>
                </div>
                <Button
                  className="w-full"
                  style={{ backgroundColor: "#5B1D8F" }}
                  disabled={!displayName || !email || password.length < 8 || !dateOfBirth || registerMutation.isPending}
                  onClick={() => registerMutation.mutate()}
                  data-testid="button-create-account"
                >
                  {registerMutation.isPending ? (
                    <><Loader2 className="h-4 w-4 animate-spin mr-2" />{t("hubSetup.creating")}</>
                  ) : (
                    t("hubSetup.createAccount")
                  )}
                </Button>
                <button
                  type="button"
                  className="w-full text-sm hover:underline"
                  style={{ color: "#5B1D8F" }}
                  onClick={() => setAuthMode("signin")}
                  data-testid="button-switch-to-signin"
                >
                  {t("hubSetup.alreadyHaveAccount")}
                </button>
              </>
            ) : (
              <>
                <div className="text-lg font-semibold" style={{ color: "#5B1D8F" }} data-testid="text-signin-title">
                  {t("hubSetup.signInTitle")}
                </div>
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium">{t("hubSetup.email")}</label>
                    <Input
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      data-testid="input-hub-signin-email"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium">{t("hubSetup.password")}</label>
                    <div className="relative">
                      <Input
                        type={showPassword ? "text" : "password"}
                        placeholder="Your password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        data-testid="input-hub-signin-password"
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                        onClick={() => setShowPassword(!showPassword)}
                        data-testid="button-toggle-hub-signin-password"
                        tabIndex={-1}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                </div>
                <Button
                  className="w-full"
                  style={{ backgroundColor: "#5B1D8F" }}
                  disabled={!email || !password || loginMutation.isPending}
                  onClick={() => loginMutation.mutate()}
                  data-testid="button-signin-save"
                >
                  {loginMutation.isPending ? (
                    <><Loader2 className="h-4 w-4 animate-spin mr-2" />{t("hubSetup.signingIn")}</>
                  ) : (
                    t("hubSetup.signInSave")
                  )}
                </Button>
                <button
                  type="button"
                  className="w-full text-sm hover:underline"
                  style={{ color: "#5B1D8F" }}
                  onClick={() => setAuthMode("register")}
                  data-testid="button-switch-to-register"
                >
                  {t("hubSetup.needAccount")}
                </button>
              </>
            )}
          </div>
        );

      case "saving":
        return (
          <div className="flex flex-col items-center justify-center py-8 space-y-3" data-testid="step-saving">
            <Loader2 className="h-8 w-8 animate-spin" style={{ color: "#5B1D8F" }} />
            <p className="text-sm font-medium">{t("hubSetup.savingHubs")}</p>
          </div>
        );

      case "done":
        return (
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="text-xl font-bold" style={{ color: "#5B1D8F" }} data-testid="text-done-title">
              {t("hubSetup.allSet")}
            </div>
            <p className="text-sm text-muted-foreground">
              {t("hubSetup.feedPrioritize")}
            </p>
            <div className="w-full space-y-2 rounded-md border p-3 text-left text-sm">
              {homeZone.name && (
                <div className="flex items-center gap-2" data-testid="text-summary-home">
                  <MapPin className="h-4 w-4" style={{ color: "#F04FAF" }} />
                  <span className="font-medium">{t("hubSetup.home")}</span> {homeZone.name}
                </div>
              )}
              {!homeZone.name && homeZip && (
                <div className="flex items-center gap-2" data-testid="text-summary-home">
                  <MapPin className="h-4 w-4" style={{ color: "#F04FAF" }} />
                  <span className="font-medium">{t("hubSetup.home")}</span> {homeZip}
                </div>
              )}
              {(workZone.name || workZip) && (
                <div className="flex items-center gap-2" data-testid="text-summary-work">
                  <Briefcase className="h-4 w-4" style={{ color: "#F2C230" }} />
                  <span className="font-medium">{t("hubSetup.work")}</span> {workZone.name || workZip}
                </div>
              )}
              {(playZone.name || playZip) && (
                <div className="flex items-center gap-2" data-testid="text-summary-play">
                  <Music className="h-4 w-4" style={{ color: "#5B1D8F" }} />
                  <span className="font-medium">{t("hubSetup.play")}</span> {playZone.name || playZip}
                </div>
              )}
            </div>
            <Button
              className="w-full"
              style={{ backgroundColor: "#5B1D8F" }}
              onClick={() => onOpenChange(false)}
              data-testid="button-start-exploring"
            >
              {t("hubSetup.startExploring")}
            </Button>
          </div>
        );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-sm overflow-hidden p-0" data-testid="hub-setup-dialog">
        <div className="relative">
          <img
            src={cosmicBg}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
            aria-hidden="true"
          />
          <div className="absolute inset-0 bg-black/50" aria-hidden="true" />
          <div className="relative px-6 pt-5 pb-3">
            <StepDots current={currentIndex} total={steps.length} />
          </div>
        </div>
        <div className="px-6 pb-6 pt-4">
          {renderStep()}
        </div>
      </DialogContent>
    </Dialog>
  );
}
