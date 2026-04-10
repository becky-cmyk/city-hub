import { useCallback } from "react";
import { useLocation } from "wouter";

type SmartBackFn = {
  (overrideFallback: string): void;
  (): void;
};

export function useSmartBack(fallback: string): SmartBackFn {
  const [, navigate] = useLocation();

  return useCallback(((overrideFallback?: unknown) => {
    const navDepth = parseInt(sessionStorage.getItem("_nav_depth") || "0", 10);
    if (navDepth > 1) {
      window.history.back();
    } else {
      const target = typeof overrideFallback === "string" ? overrideFallback : fallback;
      navigate(target);
    }
  }) as SmartBackFn, [fallback, navigate]);
}
