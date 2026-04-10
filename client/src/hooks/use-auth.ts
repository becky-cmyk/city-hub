import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient, getQueryFn } from "@/lib/queryClient";

export interface UserHub {
  id: string;
  userId: string;
  hubType: "HOME" | "WORK" | "PLAY";
  city: string;
  state?: string | null;
  zip?: string | null;
  neighborhood?: string | null;
  radiusMiles: number;
}

export type ProfileType = "resident" | "business" | "creator" | "expert" | "employer" | "organization";

export interface User {
  id: string;
  email: string;
  displayName: string;
  isAdmin?: boolean;
  adminRole?: string | null;
  activeHubType?: "HOME" | "WORK" | "PLAY";
  isUnder18?: boolean;
  isUnder21?: boolean;
  hubs?: UserHub[];
  phone?: string | null;
  phoneVerified?: boolean;
  recoveryEmail?: string | null;
  profileTypes?: ProfileType[];
  activeProfileType?: ProfileType;
  defaultLanding?: "pulse" | "hub";
}

export function useAuth() {
  const {
    data: user,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["/api/auth/me"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    retry: false,
  });

  const isLoggedIn = !!user;
  const isAdmin = !!(user as User | null)?.isAdmin;

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/auth/logout");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/my-listings"] });
      queryClient.removeQueries({ queryKey: ["/api/cities"] });
    },
  });

  const logout = () => {
    logoutMutation.mutate();
  };

  const activeHub = (user as User | null)?.hubs?.find(
    (h) => h.hubType === (user as User | null)?.activeHubType
  );

  return {
    user: user as User | null,
    isLoading,
    isLoggedIn,
    isAdmin,
    logout,
    activeHub,
  };
}
