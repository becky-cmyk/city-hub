import { useQuery } from "@tanstack/react-query";
import type { AffiliateConfig } from "@/lib/affiliate-links";

export function usePlatformAffiliates() {
  return useQuery<AffiliateConfig[]>({
    queryKey: ["/api/platform-affiliates"],
    staleTime: 5 * 60 * 1000,
  });
}
