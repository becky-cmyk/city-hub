import { useState, useCallback } from "react";
import { useAuth } from "./use-auth";

interface UseRequireAuthReturn {
  requireAuth: (action?: string) => boolean;
  isLoggedIn: boolean;
  showAuthPrompt: boolean;
  authAction: string;
  dismissAuthPrompt: () => void;
}

export function useRequireAuth(): UseRequireAuthReturn {
  const { isLoggedIn } = useAuth();
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);
  const [authAction, setAuthAction] = useState("");

  const requireAuth = useCallback((action?: string): boolean => {
    if (isLoggedIn) return true;
    setAuthAction(action || "continue");
    setShowAuthPrompt(true);
    return false;
  }, [isLoggedIn]);

  const dismissAuthPrompt = useCallback(() => {
    setShowAuthPrompt(false);
    setAuthAction("");
  }, []);

  return {
    requireAuth,
    isLoggedIn,
    showAuthPrompt,
    authAction,
    dismissAuthPrompt,
  };
}
