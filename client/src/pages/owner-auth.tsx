import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { usePageMeta } from "@/hooks/use-page-meta";
import {
  Store, Mail, Lock, ArrowRight, Loader2, Eye, EyeOff,
  Crown, CheckCircle, Sparkles, Shield, KeyRound,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";

function GradientBar() {
  return <div className="h-2 rounded-t-md bg-gradient-to-r from-[#5B1D8F] via-[#F04FAF] to-[#F2C230]" />;
}

export default function OwnerAuth({ citySlug }: { citySlug: string }) {
  const { toast } = useToast();
  const { t } = useI18n();
  const [, navigate] = useLocation();

  usePageMeta({
    title: "Owner Sign In — CLT Metro Hub",
    description: "Sign in to manage your presence on CLT Metro Hub.",
  });

  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [entityId, setEntityId] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const initialEntityId = params.get("entityId") || "";
    const initialEmail = params.get("email") || "";
    const registerMode = params.get("register") === "true";
    if (initialEntityId) setEntityId(initialEntityId);
    if (initialEmail) setEmail(initialEmail);
    if (registerMode) setMode("register");
  }, []);

  const loginMutation = useMutation({
    mutationFn: async () => {
      const resp = await apiRequest("POST", "/api/owner/login", { email, password });
      return resp.json();
    },
    onSuccess: (data) => {
      toast({ title: t("ownerAuth.welcomeBack"), description: t("ownerAuth.redirecting") });
      fetchPresenceAndRedirect(data.entityId);
    },
    onError: (err: any) => {
      toast({ title: t("ownerAuth.signInFailed"), description: err.message, variant: "destructive" });
    },
  });

  const registerMutation = useMutation({
    mutationFn: async () => {
      const resp = await apiRequest("POST", "/api/owner/register", {
        email,
        password,
        entityId,
      });
      return resp.json();
    },
    onSuccess: (data) => {
      toast({ title: t("ownerAuth.accountCreated"), description: t("ownerAuth.redirecting") });
      fetchPresenceAndRedirect(data.entityId);
    },
    onError: (err: any) => {
      toast({ title: t("ownerAuth.regFailed"), description: err.message, variant: "destructive" });
    },
  });

  async function fetchPresenceAndRedirect(presenceEntityId: string) {
    try {
      const resp = await apiRequest("GET", "/api/owner/me");
      const data = await resp.json();
      if (data.presence?.slug) {
        navigate(`/${citySlug}/owner/${data.presence.slug}`);
      } else {
        navigate(`/${citySlug}`);
      }
    } catch {
      navigate(`/${citySlug}`);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (mode === "register") {
      if (password !== confirmPassword) {
        toast({ title: t("ownerAuth.passwordsDontMatch"), description: t("ownerAuth.passwordsMatchDesc"), variant: "destructive" });
        return;
      }
      if (password.length < 8) {
        toast({ title: t("ownerAuth.passwordTooShort"), description: t("ownerAuth.passwordMinDesc"), variant: "destructive" });
        return;
      }
      registerMutation.mutate();
    } else {
      loginMutation.mutate();
    }
  }

  const isPending = loginMutation.isPending || registerMutation.isPending;

  return (
    <div className="max-w-md mx-auto py-12 px-4 space-y-6">
      <div className="text-center space-y-3">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-[#5B1D8F] to-[#F04FAF] flex items-center justify-center shadow-lg">
          <KeyRound className="h-8 w-8 text-white" />
        </div>
        <h1 className="text-2xl font-bold">
          {mode === "login" ? t("ownerAuth.signInTitle") : t("ownerAuth.createTitle")}
        </h1>
        <p className="text-muted-foreground text-sm max-w-sm mx-auto">
          {mode === "login"
            ? t("ownerAuth.signInDesc")
            : t("ownerAuth.createDesc")}
        </p>
      </div>

      <Card className="overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-[#5B1D8F] via-[#F04FAF] to-[#F2C230]" />
        <CardContent className="pt-6 pb-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium flex items-center gap-2">
                <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                {t("ownerAuth.email")}
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@yourbusiness.com"
                required
                data-testid="input-owner-email"
              />
              {mode === "register" && (
                <p className="text-xs text-muted-foreground">{t("ownerAuth.emailMatch")}</p>
              )}
            </div>

            {mode === "register" && !entityId && (
              <div className="space-y-2">
                <Label htmlFor="entityId" className="text-sm font-medium flex items-center gap-2">
                  <Store className="h-3.5 w-3.5 text-muted-foreground" />
                  {t("ownerAuth.presenceId")}
                </Label>
                <Input
                  id="entityId"
                  value={entityId}
                  onChange={(e) => setEntityId(e.target.value)}
                  placeholder={t("ownerAuth.presenceIdPlaceholder")}
                  required
                  data-testid="input-owner-entity-id"
                />
                <p className="text-xs text-muted-foreground">{t("ownerAuth.presenceIdNote")}</p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium flex items-center gap-2">
                <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                {t("ownerAuth.password")}
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === "register" ? t("ownerAuth.createPassword") : t("ownerAuth.enterPassword")}
                  required
                  className="pr-10"
                  data-testid="input-owner-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  data-testid="button-toggle-password"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {mode === "register" && (
              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-sm font-medium flex items-center gap-2">
                  <Shield className="h-3.5 w-3.5 text-muted-foreground" />
                  {t("ownerAuth.confirmPassword")}
                </Label>
                <Input
                  id="confirmPassword"
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder={t("ownerAuth.confirmPlaceholder")}
                  required
                  data-testid="input-owner-confirm-password"
                />
              </div>
            )}

            <Button
              type="submit"
              disabled={isPending}
              className="w-full bg-[#5B1D8F] hover:bg-[#5B1D8F]/90 text-white font-semibold h-11"
              data-testid="button-owner-submit"
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : mode === "login" ? (
                <ArrowRight className="h-4 w-4 mr-2" />
              ) : (
                <CheckCircle className="h-4 w-4 mr-2" />
              )}
              {mode === "login" ? t("ownerAuth.signIn") : t("ownerAuth.createAccount")}
            </Button>
          </form>

          <div className="mt-5 pt-5 border-t text-center">
            {mode === "login" ? (
              <p className="text-sm text-muted-foreground">
                {t("ownerAuth.justActivated")}{" "}
                <button
                  onClick={() => setMode("register")}
                  className="text-[#5B1D8F] font-medium underline-offset-2 hover:underline"
                  data-testid="button-switch-register"
                >
                  {t("ownerAuth.createYourAccount")}
                </button>
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                {t("ownerAuth.alreadyHaveAccount")}{" "}
                <button
                  onClick={() => setMode("login")}
                  className="text-[#5B1D8F] font-medium underline-offset-2 hover:underline"
                  data-testid="button-switch-login"
                >
                  {t("ownerAuth.signInInstead")}
                </button>
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {mode === "login" && (
        <div className="bg-muted/30 rounded-xl p-5 space-y-3">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[#F2C230]" />
            {t("ownerAuth.noPresence")}
          </h3>
          <p className="text-sm text-muted-foreground">
            {t("ownerAuth.activateDesc")}
          </p>
          <Button
            variant="outline"
            onClick={() => navigate(`/${citySlug}/activate`)}
            className="w-full"
            data-testid="button-go-activate"
          >
            <Store className="h-4 w-4 mr-2" />
            {t("ownerAuth.activatePresence")}
          </Button>
        </div>
      )}
    </div>
  );
}
