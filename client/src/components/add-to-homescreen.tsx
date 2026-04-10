import { useState, useEffect } from "react";
import { X, Download, Rss, Share, MoreVertical, Plus, ArrowUp, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import charlotteAvatar from "@assets/charlotte-avatar-v2.png";

interface AddToHomescreenProps {
  citySlug: string;
}

export function AddToHomescreenBanner({ citySlug }: AddToHomescreenProps) {
  const [show, setShow] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showGuide, setShowGuide] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem("a2hs_pulse_dismissed");
    if (dismissed) return;

    const isStandalone = window.matchMedia("(display-mode: standalone)").matches
      || (window.navigator as Record<string, unknown>).standalone === true;
    if (isStandalone) return;

    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (!isMobile) return;

    const visited = localStorage.getItem("pulse_visited_count");
    const count = parseInt(visited || "0", 10);
    if (count > 0) {
      setShow(true);
    }
    localStorage.setItem("pulse_visited_count", String(count + 1));

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShow(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const result = await deferredPrompt.userChoice;
      if (result.outcome === "accepted") {
        setShow(false);
      }
      setDeferredPrompt(null);
    } else {
      setShowGuide(true);
    }
  };

  const handleDismiss = () => {
    setShow(false);
    localStorage.setItem("a2hs_pulse_dismissed", "1");
  };

  if (!show && !showGuide) return null;

  return (
    <>
      {show && (
        <div className="fixed bottom-16 left-3 right-3 z-50 lg:hidden animate-in slide-in-from-bottom-4 duration-300" data-testid="banner-add-homescreen">
          <div className="bg-gray-900 border border-purple-500/30 rounded-xl p-4 shadow-2xl flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/20 shrink-0">
              <Rss className="h-5 w-5 text-purple-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-semibold" data-testid="text-a2hs-title">Add CLT Hub to Home Screen</p>
              <p className="text-white/50 text-xs mt-0.5">Quick access like a native app</p>
            </div>
            <Button
              size="sm"
              onClick={handleInstall}
              className="shrink-0 bg-purple-600 hover:bg-purple-700 text-white gap-1"
              data-testid="button-install-pulse"
            >
              <Download className="h-3.5 w-3.5" />
              Add
            </Button>
            <button onClick={handleDismiss} className="text-white/30 hover:text-white/60 shrink-0" data-testid="button-dismiss-a2hs">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <InstallGuideSheet open={showGuide} onClose={() => setShowGuide(false)} />
    </>
  );
}

interface InstallGuideSheetProps {
  open: boolean;
  onClose: () => void;
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function detectPlatform(): "ios" | "android" | "other" {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "other";
}

const INSTALL_GUIDE_DISMISSED_KEY = "a2hs_install_guide_dismissed";

export function InstallGuideSheet({ open, onClose }: InstallGuideSheetProps) {
  const platform = detectPlatform();

  const dismissed = (() => {
    try { return localStorage.getItem(INSTALL_GUIDE_DISMISSED_KEY) === "1"; } catch { return false; }
  })();

  const handleClose = () => {
    try { localStorage.setItem(INSTALL_GUIDE_DISMISSED_KEY, "1"); } catch {}
    onClose();
  };

  if (!open || dismissed) return null;

  const iosSteps = [
    {
      icon: <Share className="h-5 w-5 text-purple-400" />,
      title: "Tap the Share button",
      desc: "At the bottom of Safari, tap the share icon (square with arrow pointing up)."
    },
    {
      icon: <Plus className="h-5 w-5 text-purple-400" />,
      title: "Tap \"Add to Home Screen\"",
      desc: "Scroll down in the share menu and tap \"Add to Home Screen\"."
    },
    {
      icon: <Smartphone className="h-5 w-5 text-purple-400" />,
      title: "Tap \"Add\"",
      desc: "Confirm the name and tap Add. The app icon will appear on your home screen."
    }
  ];

  const androidSteps = [
    {
      icon: <MoreVertical className="h-5 w-5 text-purple-400" />,
      title: "Tap the menu button",
      desc: "In Chrome, tap the three-dot menu at the top right of the screen."
    },
    {
      icon: <Download className="h-5 w-5 text-purple-400" />,
      title: "Tap \"Install App\" or \"Add to Home Screen\"",
      desc: "Select the install option from the menu. You may see either label."
    },
    {
      icon: <Smartphone className="h-5 w-5 text-purple-400" />,
      title: "Tap \"Install\"",
      desc: "Confirm the installation. The app icon will appear on your home screen."
    }
  ];

  const steps = platform === "ios" ? iosSteps : androidSteps;
  const platformLabel = platform === "ios" ? "iPhone / iPad" : "Android";

  return (
    <>
      <div className="fixed inset-0 z-[70] bg-black/60" onClick={handleClose} />
      <div className="fixed inset-x-0 bottom-0 z-[70] max-h-[80vh] overflow-y-auto rounded-t-2xl bg-gray-950 border-t border-white/10 px-5 pt-5 pb-8 animate-in slide-in-from-bottom duration-300" data-testid="install-guide-sheet">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <img src={charlotteAvatar} alt="Charlotte" className="h-8 w-8 rounded-full object-cover ring-2 ring-purple-400/50" />
            <h3 className="text-lg font-bold text-white">Add to Home Screen</h3>
          </div>
          <button
            onClick={handleClose}
            className="rounded-full p-1.5 text-white/40 hover:text-white/70 transition-colors"
            data-testid="button-close-install-guide"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="text-sm text-white/60 mb-5">
          Install CLT Hub on your {platformLabel} for quick access — no app store needed. Here's how:
        </p>

        <div className="space-y-4">
          {steps.map((step, idx) => (
            <div key={idx} className="flex items-start gap-3" data-testid={`install-step-${idx}`}>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-500/15 shrink-0 mt-0.5">
                {step.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-purple-600 text-xs font-bold text-white shrink-0">
                    {idx + 1}
                  </span>
                  <p className="text-sm font-semibold text-white">{step.title}</p>
                </div>
                <p className="text-xs text-white/50 mt-1 ml-7">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <Button
          onClick={handleClose}
          className="w-full mt-6 bg-purple-600 hover:bg-purple-700 text-white font-semibold"
          data-testid="button-got-it-install"
        >
          Got it
        </Button>
      </div>
    </>
  );
}
