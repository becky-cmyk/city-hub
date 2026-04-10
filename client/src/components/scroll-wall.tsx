import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/hooks/use-auth";
import { AuthDialog } from "@/components/auth-dialog";
import { Button } from "@/components/ui/button";
import { UserPlus } from "lucide-react";

interface ScrollWallProps {
  children: React.ReactNode[];
  previewCount?: number;
  featureName?: string;
}

export function ScrollWall({ children, previewCount = 4, featureName }: ScrollWallProps) {
  const { user } = useAuth();
  const { t } = useI18n();
  const [authOpen, setAuthOpen] = useState(false);
  const [authTab, setAuthTab] = useState<"signin" | "register">("register");

  if (user || children.length <= previewCount) {
    return <>{children}</>;
  }

  const visibleItems = children.slice(0, previewCount);

  return (
    <>
      <div className="relative" data-testid="scroll-wall-container">
        {visibleItems}

        <div className="relative mt-0">
          <div className="h-40 bg-gradient-to-b from-transparent to-background pointer-events-none" />

          <div className="flex flex-col items-center justify-center py-12 px-4 -mt-10">
            <div className="max-w-md w-full text-center space-y-4">
              <h3 className="text-xl font-semibold tracking-tight" data-testid="text-scroll-wall-headline">
                {t("scrollWall.headline")}
              </h3>
              <p className="text-sm text-muted-foreground" data-testid="text-scroll-wall-subtext">
                {t("scrollWall.subtext")}
              </p>
              <Button
                size="lg"
                className="w-full max-w-xs gap-2"
                onClick={() => { setAuthTab("register"); setAuthOpen(true); }}
                data-testid="button-scroll-wall-signup"
              >
                <UserPlus className="h-4 w-4" />
                {t("scrollWall.signUp")}
              </Button>
              <button
                className="text-sm text-muted-foreground underline underline-offset-2"
                onClick={() => { setAuthTab("signin"); setAuthOpen(true); }}
                data-testid="button-scroll-wall-login"
              >
                {t("scrollWall.logIn")}
              </button>
            </div>
          </div>
        </div>
      </div>

      <AuthDialog
        open={authOpen}
        onOpenChange={setAuthOpen}
        defaultTab={authTab}
      />
    </>
  );
}

export function ScrollWallOverlay() {
  const { user } = useAuth();
  const { t } = useI18n();
  const [authOpen, setAuthOpen] = useState(false);
  const [authTab, setAuthTab] = useState<"signin" | "register">("register");

  if (user) return null;

  return (
    <>
      <div className="relative mt-0" data-testid="scroll-wall-overlay">
        <div className="h-40 bg-gradient-to-b from-transparent to-background pointer-events-none -mt-40 relative z-10" />
        <div className="flex flex-col items-center justify-center py-12 px-4 -mt-10">
          <div className="max-w-md w-full text-center space-y-4">
            <h3 className="text-xl font-semibold tracking-tight" data-testid="text-scroll-wall-headline">
              {t("scrollWall.headline")}
            </h3>
            <p className="text-sm text-muted-foreground" data-testid="text-scroll-wall-subtext">
              {t("scrollWall.subtext")}
            </p>
            <Button
              size="lg"
              className="w-full max-w-xs gap-2"
              onClick={() => { setAuthTab("register"); setAuthOpen(true); }}
              data-testid="button-scroll-wall-signup"
            >
              <UserPlus className="h-4 w-4" />
              {t("scrollWall.signUp")}
            </Button>
            <button
              className="text-sm text-muted-foreground underline underline-offset-2"
              onClick={() => { setAuthTab("signin"); setAuthOpen(true); }}
              data-testid="button-scroll-wall-login"
            >
              {t("scrollWall.logIn")}
            </button>
          </div>
        </div>
      </div>
      <AuthDialog
        open={authOpen}
        onOpenChange={setAuthOpen}
        defaultTab={authTab}
      />
    </>
  );
}

export function useScrollWallGate() {
  const { user } = useAuth();
  const [authOpen, setAuthOpen] = useState(false);
  const [authTab, setAuthTab] = useState<"signin" | "register">("register");

  const requireAuth = (callback?: () => void) => {
    if (user) {
      callback?.();
      return true;
    }
    setAuthTab("register");
    setAuthOpen(true);
    return false;
  };

  const AuthGateDialog = () => (
    <AuthDialog
      open={authOpen}
      onOpenChange={setAuthOpen}
      defaultTab={authTab}
    />
  );

  return { isAuthenticated: !!user, requireAuth, AuthGateDialog, setAuthOpen, setAuthTab };
}
