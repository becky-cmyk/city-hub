import { useState } from "react";
import { Button } from "@/components/ui/button";
import { MapPin, Home, AlertTriangle } from "lucide-react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { DarkPageShell } from "@/components/dark-page-shell";
import { useI18n } from "@/lib/i18n";

export default function NotFound() {
  const { toast } = useToast();
  const { t } = useI18n();
  const [reported, setReported] = useState(false);

  return (
    <DarkPageShell>
      <div className="flex items-center justify-center min-h-[70vh]" data-testid="page-not-found">
        <div className="text-center px-6 max-w-lg mx-auto">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-white/10 border border-white/20 mb-6">
            <MapPin className="h-10 w-10 text-amber-400" />
          </div>

          <h1 className="text-4xl md:text-5xl font-bold text-white mb-3" data-testid="text-404-title">
            {t("notFound.title")}
          </h1>

          <p className="text-white/70 text-base md:text-lg mb-2">
            {t("notFound.subtitle")}
          </p>
          <p className="text-white/50 text-sm mb-8">
            {t("notFound.body")}
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/charlotte/coming-soon">
              <Button
                size="lg"
                className="gap-2 bg-amber-500 hover:bg-amber-600 text-white font-semibold px-6"
                data-testid="button-go-home"
              >
                <Home className="h-4 w-4" />
                {t("notFound.goHome")}
              </Button>
            </Link>

            <Button
              variant="outline"
              size="lg"
              className="gap-2 border-white/30 text-white hover:bg-white/10 hover:text-white"
              data-testid="button-report-issue"
              disabled={reported}
              onClick={async () => {
                try {
                  await apiRequest("POST", "/api/report-error", {
                    path: window.location.pathname,
                    userAgent: navigator.userAgent,
                  });
                  setReported(true);
                  toast({
                    title: t("notFound.thankYou"),
                    description: t("notFound.thankYouDesc"),
                  });
                } catch {
                  toast({
                    title: t("notFound.couldntSend"),
                    description: t("notFound.tryAgainLater"),
                    variant: "destructive",
                  });
                }
              }}
            >
              <AlertTriangle className="h-4 w-4" />
              {reported ? t("notFound.reported") : t("notFound.report")}
            </Button>
          </div>

          <p className="text-white/30 text-xs mt-10">
            {t("notFound.error404")}
          </p>
        </div>
      </div>
    </DarkPageShell>
  );
}
