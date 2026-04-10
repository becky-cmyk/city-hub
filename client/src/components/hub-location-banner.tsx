import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { MapPin, Navigation2, X } from "lucide-react";

interface HubLocationBannerProps {
  detectedZoneName: string | null;
  homeZoneName: string | null;
  isInDifferentZone: boolean;
  dismissed: boolean;
  isLoggedIn: boolean;
  onExploreHere: () => void;
  onStayInHub: () => void;
  onDismiss: () => void;
  tempZoneActive: boolean;
  onSwitchBack: () => void;
}

export function HubLocationBanner({
  detectedZoneName,
  homeZoneName,
  isInDifferentZone,
  dismissed,
  isLoggedIn,
  onExploreHere,
  onStayInHub,
  onDismiss,
  tempZoneActive,
  onSwitchBack,
}: HubLocationBannerProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Detection banner: shown when user is in a different zone
  if (isInDifferentZone && !dismissed && !tempZoneActive) {
    return (
      <div
        className={`transition-all duration-300 ease-out ${
          mounted ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2"
        }`}
      >
        <div
          className="mx-auto px-4 lg:px-8 mb-4"
          data-testid="banner-detection-container"
        >
          <div
            className="relative rounded-md border border-[#5B1D8F]/20 bg-white dark:bg-slate-950 shadow-sm overflow-hidden"
            style={{
              backgroundImage:
                "linear-gradient(90deg, rgba(91, 29, 143, 0.03) 0%, rgba(242, 194, 48, 0.02) 100%)",
            }}
          >
            {/* Gradient left border */}
            <div
              className="absolute left-0 top-0 bottom-0 w-1 rounded-l-md"
              style={{
                background:
                  "linear-gradient(to bottom, #5B1D8F, #F2C230)",
              }}
            />

            <div className="pl-4 pr-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
              <div className="flex items-start sm:items-center gap-3 flex-1">
                <MapPin
                  className="h-5 w-5 mt-0.5 sm:mt-0 shrink-0"
                  style={{ color: "#5B1D8F" }}
                  data-testid="icon-location-pin"
                />
                <p className="text-sm text-foreground">
                  {isLoggedIn ? (
                    <>
                      Looks like you're in{" "}
                      <span className="font-semibold">{detectedZoneName}</span>{" "}
                      right now.
                    </>
                  ) : (
                    <>
                      You're near{" "}
                      <span className="font-semibold">{detectedZoneName}</span>
                      . Want to see what's here?
                    </>
                  )}
                </p>
              </div>

              <div className="flex gap-2 flex-col sm:flex-row">
                <Button
                  size="sm"
                  onClick={onExploreHere}
                  style={{
                    background: "#F2C230",
                    color: "#5B1D8F",
                  }}
                  className="font-medium hover:opacity-90"
                  data-testid="button-explore-zone"
                >
                  Explore {detectedZoneName}
                </Button>

                {isLoggedIn && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={onStayInHub}
                    className="font-medium"
                    data-testid="button-stay-in-hub"
                  >
                    Stay in {homeZoneName}
                  </Button>
                )}

                <Button
                  size="icon"
                  variant="ghost"
                  onClick={onDismiss}
                  className="h-9 w-9"
                  data-testid="button-dismiss-banner"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Temp zone active banner: shown when exploring a different zone
  if (tempZoneActive && detectedZoneName) {
    return (
      <div
        className={`transition-all duration-300 ease-out ${
          mounted ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2"
        }`}
      >
        <div
          className="mx-auto px-4 lg:px-8 mb-4"
          data-testid="banner-temp-zone-container"
        >
          <div
            className="rounded-md border border-[#F2C230]/30 py-2.5 px-4 flex items-center justify-between"
            style={{
              background: "rgba(242, 194, 48, 0.08)",
            }}
          >
            <div className="flex items-center gap-2">
              <Navigation2
                className="h-4 w-4 shrink-0"
                style={{ color: "#5B1D8F" }}
                data-testid="icon-navigation"
              />
              <p className="text-sm text-foreground">
                Exploring <span className="font-semibold">{detectedZoneName}</span>
              </p>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={onSwitchBack}
              className="text-xs p-0 h-auto"
              style={{ color: "#5B1D8F" }}
              data-testid="button-switch-back"
            >
              Switch back to {homeZoneName}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
