import { useState, useEffect, useCallback, useMemo } from "react";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, Mail, MessageSquare, Shield, Store, Users, Check, X, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { useI18n, type TranslationKey } from "@/lib/i18n";
import cosmicBg from "@assets/General_Backgroun_CLT_colors_1771643702572.png";

function buildAuthSchemas(t: (key: TranslationKey) => string) {
  const loginSchema = z.object({
    email: z.string().email(t("auth.validEmailRequired")),
    password: z.string().min(1, t("auth.passwordRequired")),
  });

  const registerSchema = z.object({
    email: z.string().email(t("auth.validEmailRequired")),
    password: z.string().min(8, t("auth.passwordMinLength")),
    confirmPassword: z.string().min(1, "Please confirm your password"),
    displayName: z.string().min(1, t("auth.displayNameRequired")),
    handle: z.string().optional(),
    dateOfBirth: z.string().min(1, t("auth.dobRequired")),
    agreeToTerms: z.literal(true, { errorMap: () => ({ message: "You must agree to the terms and conditions" }) }),
    ownsBusinessInterest: z.boolean().optional().default(false),
    orgInterest: z.boolean().optional().default(false),
  }).refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  }).refine((data) => {
    const val = data.dateOfBirth.trim();
    let dob: Date | null = null;
    const mmddyyyy = val.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (mmddyyyy) {
      dob = new Date(parseInt(mmddyyyy[3]), parseInt(mmddyyyy[1]) - 1, parseInt(mmddyyyy[2]));
    } else {
      const parsed = new Date(val);
      if (!isNaN(parsed.getTime())) dob = parsed;
    }
    if (!dob || isNaN(dob.getTime())) return false;
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) age--;
    return age >= 18;
  }, {
    message: "You must be 18 or older to create an account",
    path: ["dateOfBirth"],
  });

  const forgotSchema = z.object({
    email: z.string().email(t("auth.validEmailRequired")),
  });

  return { loginSchema, registerSchema, forgotSchema };
}

type LoginForm = { email: string; password: string };
type RegisterForm = { email: string; password: string; confirmPassword: string; displayName: string; handle?: string; dateOfBirth: string; agreeToTerms: boolean; ownsBusinessInterest: boolean; orgInterest: boolean };
type ForgotForm = { email: string };

interface AuthDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (options?: { needsHubSetup?: boolean }) => void;
  defaultTab?: "signin" | "register";
}

export function AuthDialog({ open, onOpenChange, onSuccess, defaultTab = "signin" }: AuthDialogProps) {
  const { toast } = useToast();
  const { t } = useI18n();
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState(defaultTab);

  const { loginSchema, registerSchema, forgotSchema } = useMemo(() => buildAuthSchemas(t), [t]);

  useEffect(() => {
    if (open) setActiveTab(defaultTab);
  }, [open, defaultTab]);

  const [showForgot, setShowForgot] = useState(false);
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);

  const [showMagicLink, setShowMagicLink] = useState(false);
  const [magicLinkEmail, setMagicLinkEmail] = useState("");
  const [magicLinkSent, setMagicLinkSent] = useState(false);

  const [showSmsOtp, setShowSmsOtp] = useState(false);
  const [smsEmail, setSmsEmail] = useState("");
  const [smsEligible, setSmsEligible] = useState<boolean | null>(null);
  const [smsNotEligible, setSmsNotEligible] = useState(false);
  const [otpCode, setOtpCode] = useState("");

  const loginForm = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const registerForm = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: { email: "", password: "", confirmPassword: "", displayName: "", handle: "", dateOfBirth: "", agreeToTerms: false, ownsBusinessInterest: false, orgInterest: false } as RegisterForm,
  });

  const watchBusinessInterest = registerForm.watch("ownsBusinessInterest");
  const watchOrgInterest = registerForm.watch("orgInterest");
  const watchHandle = registerForm.watch("handle");

  const [handleCheckDebounce, setHandleCheckDebounce] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [handleAvailability, setHandleAvailability] = useState<{ available: boolean; reason?: string } | null>(null);
  const [checkingHandle, setCheckingHandle] = useState(false);

  const suggestHandle = useCallback((name: string) => {
    const suggestion = name.toLowerCase().replace(/[^a-z0-9._]/g, "").replace(/^[^a-z]+/, "").slice(0, 30);
    if (suggestion.length >= 3) {
      registerForm.setValue("handle", suggestion);
    }
  }, [registerForm]);

  useEffect(() => {
    if (!watchHandle || watchHandle.length < 3) {
      setHandleAvailability(null);
      return;
    }
    setCheckingHandle(true);
    if (handleCheckDebounce) clearTimeout(handleCheckDebounce);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/handle/check/${encodeURIComponent(watchHandle)}`);
        const data = await res.json();
        setHandleAvailability(data);
      } catch {
        setHandleAvailability(null);
      }
      setCheckingHandle(false);
    }, 500);
    setHandleCheckDebounce(timer);
    return () => clearTimeout(timer);
  }, [watchHandle]);

  const forgotForm = useForm<ForgotForm>({
    resolver: zodResolver(forgotSchema),
    defaultValues: { email: "" },
  });

  const forgotMutation = useMutation({
    mutationFn: async (data: ForgotForm) => {
      const res = await apiRequest("POST", "/api/auth/forgot-password", data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: t("auth.resetLinkSent"), description: t("auth.resetLinkDesc") });
      setShowForgot(false);
    },
    onError: (error: any) => {
      toast({ title: t("auth.error"), description: error.message || t("auth.genericError"), variant: "destructive" });
    },
  });

  const loginMutation = useMutation({
    mutationFn: async (data: LoginForm) => {
      const res = await apiRequest("POST", "/api/auth/login", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/my-listings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cities"] });
      toast({ title: t("auth.signedInSuccess") });
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (error: any) => {
      const message = error.message || t("auth.loginFailed");
      toast({
        title: t("auth.loginFailed"),
        description: message,
        variant: "destructive",
      });
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (data: RegisterForm) => {
      const { confirmPassword, ...payload } = data;
      const res = await apiRequest("POST", "/api/auth/register", payload);
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/my-listings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cities"] });
      toast({ title: t("auth.accountCreated") });
      onOpenChange(false);
      if (data?.hasPresenceInterest) {
        const citySlug = window.location.pathname.split("/")[1] || "charlotte";
        navigate(`/${citySlug}/activate`);
      } else {
        onSuccess?.(data?.needsHubSetup ? { needsHubSetup: true } : undefined);
      }
    },
    onError: (error: any) => {
      const message = error.message || t("auth.registrationFailed");
      toast({
        title: t("auth.registrationFailed"),
        description: message,
        variant: "destructive",
      });
    },
  });

  const magicLinkMutation = useMutation({
    mutationFn: async (email: string) => {
      const res = await apiRequest("POST", "/api/auth/magic-link", { email });
      return res.json();
    },
    onSuccess: () => {
      setMagicLinkSent(true);
      toast({ title: t("auth.magicLinkSent"), description: t("auth.magicLinkDesc") });
    },
    onError: (error: any) => {
      toast({ title: t("auth.error"), description: error.message || t("auth.genericError"), variant: "destructive" });
    },
  });

  const smsOtpSendMutation = useMutation({
    mutationFn: async (email: string) => {
      const res = await apiRequest("POST", "/api/auth/sms-otp/send", { email });
      return res.json();
    },
    onSuccess: (data: any) => {
      if (data?.eligible) {
        setSmsEligible(true);
        setSmsNotEligible(false);
      } else {
        setSmsEligible(false);
        setSmsNotEligible(true);
      }
    },
    onError: (error: any) => {
      toast({ title: t("auth.error"), description: error.message || t("auth.genericError"), variant: "destructive" });
    },
  });

  const smsOtpVerifyMutation = useMutation({
    mutationFn: async ({ email, code }: { email: string; code: string }) => {
      const res = await apiRequest("POST", "/api/auth/sms-otp/verify", { email, code });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/my-listings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cities"] });
      toast({ title: t("auth.signedInSuccess") });
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (error: any) => {
      toast({ title: t("auth.verificationFailed"), description: error.message || t("auth.invalidCode"), variant: "destructive" });
    },
  });

  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-sm overflow-hidden p-0">
        <div className="relative">
          <img src={cosmicBg} alt="" className="absolute inset-0 w-full h-full object-cover" aria-hidden="true" />
          <div className="absolute inset-0 bg-black/50" aria-hidden="true" />
          <div className="relative px-6 pt-5 pb-2">
            <DialogHeader>
              <DialogTitle data-testid="text-auth-dialog-title" className="text-white">
                {t("auth.signInTitle")}
              </DialogTitle>
            </DialogHeader>
          </div>
        </div>
        <div className="px-6 pb-6 pt-2 max-h-[70vh] overflow-y-auto">

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="signin" data-testid="tab-signin">
              {t("auth.signIn")}
            </TabsTrigger>
            <TabsTrigger value="signup" data-testid="tab-signup">
              {t("auth.createAccount")}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="signin" className="space-y-4">
            {showForgot ? (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">{t("auth.forgotPrompt")}</p>
                <Form {...forgotForm}>
                  <form onSubmit={forgotForm.handleSubmit((data) => forgotMutation.mutate(data))} className="space-y-4">
                    <FormField
                      control={forgotForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("auth.email")}</FormLabel>
                          <FormControl>
                            <Input type="email" placeholder="you@example.com" {...field} data-testid="input-forgot-email" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button type="submit" className="w-full" disabled={forgotMutation.isPending} data-testid="button-forgot-submit">
                      {forgotMutation.isPending ? t("auth.sending") : t("auth.sendResetLink")}
                    </Button>
                  </form>
                </Form>
                <button type="button" className="text-sm text-[#5B1D8F] hover:underline" onClick={() => setShowForgot(false)} data-testid="button-back-to-login">
                  {t("auth.backToSignIn")}
                </button>
              </div>
            ) : (
              <>
                <Form {...loginForm}>
                  <form
                    onSubmit={loginForm.handleSubmit((data) =>
                      loginMutation.mutate(data)
                    )}
                    className="space-y-4"
                  >
                    <FormField
                      control={loginForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("auth.email")}</FormLabel>
                          <FormControl>
                            <Input
                              type="email"
                              placeholder="you@example.com"
                              {...field}
                              data-testid="input-login-email"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={loginForm.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("auth.password")}</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Input
                                type={showLoginPassword ? "text" : "password"}
                                placeholder="••••••••"
                                {...field}
                                data-testid="input-login-password"
                              />
                              <button
                                type="button"
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                                onClick={() => setShowLoginPassword(!showLoginPassword)}
                                data-testid="button-toggle-login-password"
                                tabIndex={-1}
                              >
                                {showLoginPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                              </button>
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <Button
                      type="submit"
                      className="w-full"
                      disabled={loginMutation.isPending}
                      data-testid="button-login-submit"
                    >
                      {loginMutation.isPending ? t("auth.signingIn") : t("auth.signIn")}
                    </Button>
                  </form>
                </Form>

                <div className="space-y-3">
                  <div className="space-y-2">
                    {!showMagicLink ? (
                      <button
                        type="button"
                        className="flex items-center gap-2 text-sm text-[#5B1D8F] hover:underline"
                        onClick={() => { setShowMagicLink(true); setMagicLinkSent(false); setMagicLinkEmail(""); }}
                        data-testid="button-show-magic-link"
                      >
                        <Mail className="h-3.5 w-3.5" />
                        {t("auth.sendSignInLink")}
                      </button>
                    ) : (
                      <div className="space-y-2 rounded-md border p-3">
                        <p className="text-sm font-medium">{t("auth.signInLink")}</p>
                        {magicLinkSent ? (
                          <p className="text-sm text-muted-foreground" data-testid="text-magic-link-sent">
                            {t("auth.checkEmailLink")}
                          </p>
                        ) : (
                          <div className="flex gap-2">
                            <Input
                              type="email"
                              placeholder="you@example.com"
                              value={magicLinkEmail}
                              onChange={(e) => setMagicLinkEmail(e.target.value)}
                              data-testid="input-magic-link-email"
                            />
                            <Button
                              type="button"
                              size="sm"
                              disabled={!magicLinkEmail || magicLinkMutation.isPending}
                              onClick={() => magicLinkMutation.mutate(magicLinkEmail)}
                              data-testid="button-send-magic-link"
                            >
                              {magicLinkMutation.isPending ? t("auth.sending") : t("auth.send")}
                            </Button>
                          </div>
                        )}
                        <button
                          type="button"
                          className="text-xs text-muted-foreground hover:underline"
                          onClick={() => { setShowMagicLink(false); setMagicLinkSent(false); }}
                          data-testid="button-hide-magic-link"
                        >
                          {t("auth.cancel")}
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    {!showSmsOtp ? (
                      <button
                        type="button"
                        className="flex items-center gap-2 text-sm text-[#5B1D8F] hover:underline"
                        onClick={() => { setShowSmsOtp(true); setSmsEligible(null); setSmsNotEligible(false); setSmsEmail(""); setOtpCode(""); }}
                        data-testid="button-show-sms-otp"
                      >
                        <MessageSquare className="h-3.5 w-3.5" />
                        {t("auth.textMeCode")}
                      </button>
                    ) : (
                      <div className="space-y-2 rounded-md border p-3">
                        <p className="text-sm font-medium">{t("auth.textMeCode")}</p>
                        {smsNotEligible ? (
                          <p className="text-sm text-muted-foreground" data-testid="text-sms-not-eligible">
                            {t("auth.smsNotAvailable")}
                          </p>
                        ) : smsEligible ? (
                          <div className="space-y-2">
                            <p className="text-sm text-muted-foreground">{t("auth.enterCode")}</p>
                            <InputOTP
                              maxLength={6}
                              value={otpCode}
                              onChange={setOtpCode}
                              data-testid="input-sms-otp-code"
                            >
                              <InputOTPGroup>
                                <InputOTPSlot index={0} />
                                <InputOTPSlot index={1} />
                                <InputOTPSlot index={2} />
                                <InputOTPSlot index={3} />
                                <InputOTPSlot index={4} />
                                <InputOTPSlot index={5} />
                              </InputOTPGroup>
                            </InputOTP>
                            <Button
                              type="button"
                              size="sm"
                              className="w-full"
                              disabled={otpCode.length !== 6 || smsOtpVerifyMutation.isPending}
                              onClick={() => smsOtpVerifyMutation.mutate({ email: smsEmail, code: otpCode })}
                              data-testid="button-verify-sms-otp"
                            >
                              {smsOtpVerifyMutation.isPending ? t("auth.verifying") : t("auth.verifyCode")}
                            </Button>
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <Input
                              type="email"
                              placeholder="you@example.com"
                              value={smsEmail}
                              onChange={(e) => setSmsEmail(e.target.value)}
                              data-testid="input-sms-email"
                            />
                            <Button
                              type="button"
                              size="sm"
                              disabled={!smsEmail || smsOtpSendMutation.isPending}
                              onClick={() => smsOtpSendMutation.mutate(smsEmail)}
                              data-testid="button-send-sms-otp"
                            >
                              {smsOtpSendMutation.isPending ? t("auth.sending") : t("auth.send")}
                            </Button>
                          </div>
                        )}
                        <button
                          type="button"
                          className="text-xs text-muted-foreground hover:underline"
                          onClick={() => { setShowSmsOtp(false); setSmsEligible(null); setSmsNotEligible(false); }}
                          data-testid="button-hide-sms-otp"
                        >
                          {t("auth.cancel")}
                        </button>
                      </div>
                    )}
                  </div>

                  <button type="button" className="text-sm text-[#5B1D8F] hover:underline" onClick={() => setShowForgot(true)} data-testid="button-forgot-password">
                    {t("auth.forgotPassword")}
                  </button>
                </div>

                <div className="border-t pt-3">
                  <a
                    href="/admin/login"
                    className="flex items-center gap-2 text-sm text-muted-foreground hover:text-[#5B1D8F] hover:underline transition-colors"
                    data-testid="link-admin-signin"
                  >
                    <Shield className="h-3.5 w-3.5" />
                    {t("auth.adminSignIn")}
                  </a>
                </div>
              </>
            )}
          </TabsContent>

          <TabsContent value="signup" className="space-y-4">
            <Form {...registerForm}>
              <form
                onSubmit={registerForm.handleSubmit((data) =>
                  registerMutation.mutate(data)
                )}
                className="space-y-4"
              >
                <FormField
                  control={registerForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("auth.email")}</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="you@example.com"
                          {...field}
                          data-testid="input-register-email"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={registerForm.control}
                  name="displayName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("auth.displayName")}</FormLabel>
                      <FormControl>
                        <Input
                          type="text"
                          placeholder="Your name"
                          {...field}
                          data-testid="input-register-displayname"
                          onBlur={(e) => {
                            field.onBlur();
                            const currentHandle = registerForm.getValues("handle");
                            if (!currentHandle && e.target.value) {
                              suggestHandle(e.target.value);
                            }
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={registerForm.control}
                  name="handle"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("auth.handle")}</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">@</span>
                          <Input
                            type="text"
                            placeholder="yourhandle"
                            className="pl-7"
                            {...field}
                            onChange={(e) => field.onChange(e.target.value.toLowerCase().replace(/[^a-z0-9._]/g, ""))}
                            data-testid="input-register-handle"
                          />
                          {field.value && field.value.length >= 3 && (
                            <span className="absolute right-3 top-1/2 -translate-y-1/2">
                              {checkingHandle ? (
                                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                              ) : handleAvailability?.available ? (
                                <Check className="h-4 w-4 text-green-600" />
                              ) : handleAvailability ? (
                                <X className="h-4 w-4 text-red-500" />
                              ) : null}
                            </span>
                          )}
                        </div>
                      </FormControl>
                      {handleAvailability && !handleAvailability.available && (
                        <p className="text-xs text-red-500" data-testid="text-handle-error">{handleAvailability.reason}</p>
                      )}
                      <p className="text-xs text-muted-foreground">{t("auth.handleHint")}</p>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={registerForm.control}
                  name="dateOfBirth"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("auth.dateOfBirth")}</FormLabel>
                      <FormControl>
                        <Input
                          type="text"
                          placeholder="MM/DD/YYYY"
                          {...field}
                          data-testid="input-register-dob"
                        />
                      </FormControl>
                      <p className="text-xs text-muted-foreground">
                        {t("auth.dobHint")}
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={registerForm.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("auth.password")}</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            type={showRegisterPassword ? "text" : "password"}
                            placeholder="••••••••"
                            {...field}
                            data-testid="input-register-password"
                          />
                          <button
                            type="button"
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                            onClick={() => setShowRegisterPassword(!showRegisterPassword)}
                            data-testid="button-toggle-register-password"
                            tabIndex={-1}
                          >
                            {showRegisterPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={registerForm.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirm Password</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            type={showConfirmPassword ? "text" : "password"}
                            placeholder="••••••••"
                            {...field}
                            data-testid="input-register-confirm-password"
                          />
                          <button
                            type="button"
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            data-testid="button-toggle-confirm-password"
                            tabIndex={-1}
                          >
                            {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="space-y-3 rounded-md border border-dashed border-muted-foreground/30 p-3 bg-muted/30">
                  <p className="text-xs font-medium text-muted-foreground">{t("auth.personalizeHint")}</p>
                  <FormField
                    control={registerForm.control}
                    name="ownsBusinessInterest"
                    render={({ field }) => (
                      <FormItem className="flex items-start gap-2 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            data-testid="checkbox-business-interest"
                          />
                        </FormControl>
                        <div className="flex items-center gap-1.5">
                          <Store className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <FormLabel className="text-sm font-normal cursor-pointer">{t("auth.ownBusiness")}</FormLabel>
                        </div>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={registerForm.control}
                    name="orgInterest"
                    render={({ field }) => (
                      <FormItem className="flex items-start gap-2 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            data-testid="checkbox-org-interest"
                          />
                        </FormControl>
                        <div className="flex items-center gap-1.5">
                          <Users className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <FormLabel className="text-sm font-normal cursor-pointer">{t("auth.communityOrg")}</FormLabel>
                        </div>
                      </FormItem>
                    )}
                  />
                  {(watchBusinessInterest || watchOrgInterest) && (
                    <p className="text-xs text-[#5B1D8F] font-medium" data-testid="text-activate-hint">
                      {t("auth.activateHint")}
                    </p>
                  )}
                </div>

                <FormField
                  control={registerForm.control}
                  name="agreeToTerms"
                  render={({ field }) => (
                    <FormItem className="flex items-start gap-2 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value === true}
                          onCheckedChange={field.onChange}
                          data-testid="checkbox-agree-terms"
                        />
                      </FormControl>
                      <div className="space-y-1">
                        <FormLabel className="text-sm font-normal cursor-pointer leading-snug">
                          I agree to the{" "}
                          <a href={`/${window.location.pathname.split("/")[1] || "charlotte"}/terms`} target="_blank" rel="noopener noreferrer" className="text-[#5B1D8F] underline" data-testid="link-terms">Terms of Service</a>
                          {" "}and{" "}
                          <a href={`/${window.location.pathname.split("/")[1] || "charlotte"}/privacy`} target="_blank" rel="noopener noreferrer" className="text-[#5B1D8F] underline" data-testid="link-privacy">Privacy Policy</a>
                        </FormLabel>
                        <FormMessage />
                      </div>
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  className="w-full"
                  disabled={registerMutation.isPending}
                  data-testid="button-register-submit"
                >
                  {registerMutation.isPending
                    ? t("auth.creatingAccount")
                    : t("auth.createAccount")}
                </Button>
              </form>
            </Form>
          </TabsContent>
        </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}
