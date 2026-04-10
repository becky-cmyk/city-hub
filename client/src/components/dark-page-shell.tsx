import cosmicBg from "@assets/General_Backgroun_CLT_colors_1771643702572.png";
import type { ReactNode } from "react";

interface DarkPageShellProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  maxWidth?: "narrow" | "wide";
  className?: string;
  fillHeight?: boolean;
}

export function DarkPageShell({ children, title, subtitle, maxWidth = "narrow", className = "", fillHeight = false }: DarkPageShellProps) {
  const widthClass = maxWidth === "wide" ? "" : "max-w-2xl";

  return (
    <div className={`dark bg-gray-950 relative overflow-x-hidden ${fillHeight ? "h-full overflow-y-auto" : "min-h-screen"} ${className}`}>
      <div
        className={`${fillHeight ? "fixed" : "absolute"} inset-0 opacity-20 pointer-events-none`}
        style={{
          backgroundImage: `url(${cosmicBg})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />
      <div className={`relative z-10 ${widthClass} w-full mx-auto px-4 py-6`}>
        {(title || subtitle) && (
          <div className="mb-6">
            {title && (
              <h1 className="text-2xl md:text-3xl font-bold text-white" data-testid="text-page-title">
                {title}
              </h1>
            )}
            {subtitle && (
              <p className="text-white/50 text-sm mt-1">{subtitle}</p>
            )}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
