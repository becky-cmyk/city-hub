import { useQuery } from "@tanstack/react-query";

interface OperatorTerritory {
  id: string;
  operatorId: string;
  territoryId: string;
  exclusivity: string;
  territory: {
    id: string;
    type: string;
    code: string;
    name: string;
    status: string;
    parentTerritoryId: string | null;
  } | null;
}

interface OperatorUser {
  id: string;
  email: string;
  displayName: string;
  operatorType: string;
  status: string;
  territories: OperatorTerritory[];
}

export function useOperator() {
  const { data: operator, isLoading, error } = useQuery<OperatorUser>({
    queryKey: ["/api/operator/me"],
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  return {
    operator: operator ?? null,
    isLoading,
    isAuthenticated: !!operator && !error,
  };
}
