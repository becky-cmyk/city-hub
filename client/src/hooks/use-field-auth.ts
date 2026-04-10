import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient, getQueryFn } from "@/lib/queryClient";

export interface FieldUser {
  authenticated: boolean;
  role: "admin" | "operator";
  id: string;
  name: string;
  email: string;
  adminRole?: string;
  operatorType?: string;
  cityId?: string;
  dashboardUrl: string;
  logoutUrl: string;
}

export function useFieldAuth() {
  const { data, isLoading, error } = useQuery<FieldUser>({
    queryKey: ["/api/field/auth"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      if (data?.logoutUrl) {
        await apiRequest("POST", data.logoutUrl);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/field/auth"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/me"] });
      queryClient.invalidateQueries({ queryKey: ["/api/operator/me"] });
    },
  });

  return {
    fieldUser: data ?? null,
    isAuthenticated: !!data?.authenticated,
    isLoading,
    role: data?.role ?? null,
    dashboardUrl: data?.dashboardUrl ?? "/admin",
    logout: () => logoutMutation.mutate(),
    isLoggingOut: logoutMutation.isPending,
  };
}
