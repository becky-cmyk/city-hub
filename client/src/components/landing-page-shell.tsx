import { Link } from "wouter";
import { useCity } from "@/hooks/use-city";
import { mainLogo } from "@/lib/logos";
import { MapPin, Calendar, Briefcase, ShoppingBag, Users, UtensilsCrossed, Map, Home, ArrowRight, Heart } from "lucide-react";
import type { ReactNode } from "react";
import cosmicBg from "@assets/General_Backgroun_CLT_colors_1771643702572.png";

interface LandingPageShellProps {
  citySlug: string;
  children: ReactNode;
  className?: string;
  standalone?: boolean;
}

const ECOSYSTEM_LINKS = [
  { labelFn: (cn: string) => `Explore ${cn}`, path: "", icon: Home },
  { labelFn: () => "Events", path: "/events/browse", icon: Calendar },
  { labelFn: () => "Jobs", path: "/jobs/browse", icon: Briefcase },
  { labelFn: () => "Marketplace", path: "/marketplace", icon: ShoppingBag },
  { labelFn: () => "Food & Dining", path: "/explore/food", icon: UtensilsCrossed },
  { labelFn: () => "Family & Kids", path: "/explore/family", icon: Users },
  { labelFn: () => "Map", path: "/map", icon: Map },
  { labelFn: () => "Neighborhoods", path: "/neighborhoods", icon: MapPin },
];

export function LandingPageShell({ citySlug, children, className = "", standalone = false }: LandingPageShellProps) {
  const { data: city } = useCity(citySlug);
  const cityName = city?.name || citySlug.charAt(0).toUpperCase() + citySlug.slice(1);

  return (
    <div className={`dark bg-gray-950 min-h-screen relative overflow-x-hidden ${className}`}>
      <div
        className="absolute inset-0 opacity-10 pointer-events-none"
        style={{
          backgroundImage: `url(${cosmicBg})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />

      <header className="relative z-20 border-b border-white/10 bg-gray-950/80 backdrop-blur-sm" data-testid="landing-header">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href={`/${citySlug}`}>
            <div className="flex items-center gap-2 cursor-pointer" data-testid="link-landing-home">
              <img src={mainLogo} alt="CLT Hub" className="h-8 w-auto" />
              <span className="font-bold text-white text-lg hidden sm:inline">{cityName}</span>
            </div>
          </Link>
          <nav className="flex items-center gap-4" data-testid="landing-nav">
            {!standalone && (
              <>
                <Link href={`/${citySlug}/events/browse`}>
                  <span className="text-white/60 hover:text-white text-sm cursor-pointer hidden md:inline">Events</span>
                </Link>
                <Link href={`/${citySlug}/jobs/browse`}>
                  <span className="text-white/60 hover:text-white text-sm cursor-pointer hidden md:inline">Jobs</span>
                </Link>
                <Link href={`/${citySlug}/map`}>
                  <span className="text-white/60 hover:text-white text-sm cursor-pointer hidden md:inline">Map</span>
                </Link>
              </>
            )}
            <Link href={`/${citySlug}`}>
              <span className="px-4 py-2 rounded-lg text-sm font-semibold text-white cursor-pointer" style={{ background: "hsl(273 66% 34%)" }} data-testid="link-explore-hub">
                Explore Hub
              </span>
            </Link>
          </nav>
        </div>
      </header>

      <main className="relative z-10">
        {children}
      </main>

      <footer className="relative z-20 border-t border-white/10 bg-gray-950/90 mt-16" data-testid="landing-footer">
        <div className="max-w-6xl mx-auto px-4 py-10">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 mb-8">
            {ECOSYSTEM_LINKS.map((link) => {
              const Icon = link.icon;
              return (
                <Link key={link.path} href={`/${citySlug}${link.path}`}>
                  <div className="flex items-center gap-2 text-white/50 hover:text-white transition-colors cursor-pointer" data-testid={`footer-link-${link.path || "home"}`}>
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="text-sm">{link.labelFn(cityName)}</span>
                  </div>
                </Link>
              );
            })}
          </div>
          <div className="border-t border-white/10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <img src={mainLogo} alt="" className="h-6 w-auto opacity-60" />
              <span className="text-white/40 text-xs">CLT Hub</span>
            </div>
            <p className="text-white/30 text-xs">
              Your local guide to everything {cityName}. Neighborhoods, events, businesses, and community.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
