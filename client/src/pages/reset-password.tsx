import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { CheckCircle2 } from "lucide-react";
import { Link } from "wouter";
import cosmicBg from "@assets/General_Backgroun_CLT_colors_1771643702572.png";
import { useI18n } from "@/lib/i18n";

const resetSchema = z.object({
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string().min(1, "Please confirm your password"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type ResetForm = z.infer<typeof resetSchema>;

export default function ResetPassword() {
  const { toast } = useToast();
  const { t } = useI18n();
  const [success, setSuccess] = useState(false);

  const params = new URLSearchParams(window.location.search);
  const token = params.get("token");
  const email = params.get("email");

  const form = useForm<ResetForm>({
    resolver: zodResolver(resetSchema),
    defaultValues: { newPassword: "", confirmPassword: "" },
  });

  const resetMutation = useMutation({
    mutationFn: async (data: ResetForm) => {
      const res = await apiRequest("POST", "/api/auth/reset-password", {
        email,
        token,
        newPassword: data.newPassword,
      });
      return res.json();
    },
    onSuccess: () => {
      setSuccess(true);
    },
    onError: (error: any) => {
      toast({ title: t("resetPassword.error"), description: error.message || t("resetPassword.resetFailed"), variant: "destructive" });
    },
  });

  if (!token || !email) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>{t("resetPassword.invalidTitle")}</CardTitle>
            <CardDescription>{t("resetPassword.invalidDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/charlotte" className="text-[#5B1D8F] hover:underline" data-testid="link-back-home">{t("resetPassword.backHome")}</Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-6 h-6 text-green-600" />
              <CardTitle>{t("resetPassword.successTitle")}</CardTitle>
            </div>
            <CardDescription>{t("resetPassword.successDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/charlotte" className="text-[#5B1D8F] hover:underline" data-testid="link-back-home">{t("resetPassword.backHome")}</Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative">
      <img src={cosmicBg} alt="" className="absolute inset-0 w-full h-full object-cover" aria-hidden="true" />
      <div className="absolute inset-0 bg-black/60" aria-hidden="true" />
      <Card className="w-full max-w-md relative z-10">
        <CardHeader>
          <CardTitle>{t("resetPassword.title")}</CardTitle>
          <CardDescription>{t("resetPassword.subtitle")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit((data) => resetMutation.mutate(data))} className="space-y-4">
              <FormField
                control={form.control}
                name="newPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("resetPassword.newPassword")}</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="••••••••" {...field} data-testid="input-new-password" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("resetPassword.confirmPassword")}</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="••••••••" {...field} data-testid="input-confirm-password" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={resetMutation.isPending} data-testid="button-reset-submit">
                {resetMutation.isPending ? t("resetPassword.resetting") : t("resetPassword.submit")}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
