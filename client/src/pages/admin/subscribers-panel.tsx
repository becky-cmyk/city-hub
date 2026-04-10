import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Users, Building2, UserCheck, Star } from "lucide-react";

interface Subscriber {
  id: string;
  email: string;
  displayName: string;
  accountType: string;
  createdAt: string;
  claimedCount: number;
  reviewCount: number;
  claimedBusinesses: { id: string; name: string; slug: string }[];
}

const ACCOUNT_TYPE_COLORS: Record<string, string> = {
  INDIVIDUAL: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  BUSINESS_OWNER: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  ORGANIZATION: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
};

export default function SubscribersPanel({ cityId }: { cityId?: string }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [accountTypeFilter, setAccountTypeFilter] = useState("all");

  const { data: subscribers, isLoading } = useQuery<Subscriber[]>({
    queryKey: ["/api/admin/subscribers", cityId, accountTypeFilter !== "all" ? accountTypeFilter : "", searchQuery],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (cityId) params.set("cityId", cityId);
      if (accountTypeFilter !== "all") params.set("accountType", accountTypeFilter);
      if (searchQuery) params.set("q", searchQuery);
      const res = await fetch(`/api/admin/subscribers?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load subscribers");
      return res.json();
    },
  });

  const stats = {
    total: subscribers?.length || 0,
    individual: subscribers?.filter((s) => s.accountType === "INDIVIDUAL").length || 0,
    businessOwner: subscribers?.filter((s) => s.accountType === "BUSINESS_OWNER").length || 0,
    organization: subscribers?.filter((s) => s.accountType === "ORGANIZATION").length || 0,
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold" data-testid="text-subscribers-title">Subscribers</h2>
        <p className="text-sm text-muted-foreground">Public user accounts across the platform</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4 text-center">
          <Users className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
          <p className="text-2xl font-bold" data-testid="text-stat-total">{stats.total}</p>
          <p className="text-xs text-muted-foreground">Total</p>
        </Card>
        <Card className="p-4 text-center">
          <UserCheck className="h-5 w-5 mx-auto mb-1 text-blue-500" />
          <p className="text-2xl font-bold" data-testid="text-stat-individual">{stats.individual}</p>
          <p className="text-xs text-muted-foreground">Individual</p>
        </Card>
        <Card className="p-4 text-center">
          <Building2 className="h-5 w-5 mx-auto mb-1 text-green-500" />
          <p className="text-2xl font-bold" data-testid="text-stat-business-owner">{stats.businessOwner}</p>
          <p className="text-xs text-muted-foreground">Business Owners</p>
        </Card>
        <Card className="p-4 text-center">
          <Star className="h-5 w-5 mx-auto mb-1 text-purple-500" />
          <p className="text-2xl font-bold" data-testid="text-stat-organization">{stats.organization}</p>
          <p className="text-xs text-muted-foreground">Organizations</p>
        </Card>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            data-testid="input-subscriber-search"
          />
        </div>
        <Select value={accountTypeFilter} onValueChange={setAccountTypeFilter}>
          <SelectTrigger className="w-full sm:w-48" data-testid="select-account-type-filter">
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="INDIVIDUAL">Individual</SelectItem>
            <SelectItem value="BUSINESS_OWNER">Business Owner</SelectItem>
            <SelectItem value="ORGANIZATION">Organization</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      ) : !subscribers?.length ? (
        <Card className="p-8 text-center">
          <Users className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-muted-foreground">No subscribers found</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {subscribers.map((sub) => (
            <Card key={sub.id} className="p-4" data-testid={`card-subscriber-${sub.id}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium truncate">{sub.displayName}</p>
                    <Badge className={`text-[10px] ${ACCOUNT_TYPE_COLORS[sub.accountType] || ""}`}>
                      {sub.accountType.replace("_", " ")}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground truncate">{sub.email}</p>
                  <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                    <span>Joined {new Date(sub.createdAt).toLocaleDateString()}</span>
                    {sub.claimedCount > 0 && (
                      <span className="flex items-center gap-1">
                        <Building2 className="h-3 w-3" />
                        {sub.claimedCount} claimed
                      </span>
                    )}
                    {sub.reviewCount > 0 && (
                      <span className="flex items-center gap-1">
                        <Star className="h-3 w-3" />
                        {sub.reviewCount} reviews
                      </span>
                    )}
                  </div>
                  {sub.claimedBusinesses.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {sub.claimedBusinesses.map((biz) => (
                        <Badge key={biz.id} variant="outline" className="text-[10px]">
                          {biz.name}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
