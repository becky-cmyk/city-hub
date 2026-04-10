import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText, Clock, Eye, Archive, Edit, CalendarCheck, CheckCircle, TrendingUp } from "lucide-react";

interface CmsContentItem {
  id: string;
  contentType: string;
  titleEn: string;
  titleEs: string;
  slug: string;
  status: string;
  publishAt: string | null;
  publishedAt: string | null;
  updatedAt: string;
  createdAt: string;
}

interface StatsItem {
  status: string;
  count: number;
}

const STATUS_CARDS = [
  { key: "draft", label: "Draft", icon: Edit, variant: "secondary" as const },
  { key: "in_review", label: "In Review", icon: Clock, variant: "outline" as const },
  { key: "scheduled", label: "Scheduled", icon: CalendarCheck, variant: "outline" as const },
  { key: "published", label: "Published", icon: Eye, variant: "default" as const },
  { key: "archived", label: "Archived", icon: Archive, variant: "secondary" as const },
];

function statusBadgeVariant(status: string): "default" | "secondary" | "outline" | "destructive" {
  switch (status) {
    case "published": return "default";
    case "draft": return "secondary";
    case "archived": return "destructive";
    default: return "outline";
  }
}

function ContentCard({ item, showDate }: { item: CmsContentItem; showDate?: "updated" | "published" | "scheduled" }) {
  const dateLabel = showDate === "published" && item.publishedAt
    ? new Date(item.publishedAt).toLocaleDateString()
    : showDate === "scheduled" && item.publishAt
    ? new Date(item.publishAt).toLocaleDateString()
    : new Date(item.updatedAt).toLocaleDateString();

  return (
    <Card className="p-3" data-testid={`card-item-${item.id}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-medium text-sm truncate" data-testid={`text-item-title-${item.id}`}>
            {item.titleEn}
          </p>
          <p className="text-xs text-muted-foreground" data-testid={`text-item-date-${item.id}`}>
            {dateLabel}
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
          <Badge variant="outline" className="text-xs" data-testid={`badge-type-${item.id}`}>
            {item.contentType}
          </Badge>
          <Badge variant={statusBadgeVariant(item.status)} className="text-xs" data-testid={`badge-status-${item.id}`}>
            {item.status}
          </Badge>
        </div>
      </div>
    </Card>
  );
}

export default function CmsDashboard({ cityId }: { cityId?: string }) {
  const { data: stats, isLoading: statsLoading } = useQuery<StatsItem[]>({
    queryKey: ["/api/admin/cms/content/stats"],
  });

  const { data: recentData, isLoading: recentLoading } = useQuery<{ items: CmsContentItem[]; total: number }>({
    queryKey: ["/api/admin/cms/content", "limit=10"],
    queryFn: () => fetch("/api/admin/cms/content?limit=10", { credentials: "include" }).then(r => r.json()),
  });

  const { data: scheduledData, isLoading: scheduledLoading } = useQuery<{ items: CmsContentItem[]; total: number }>({
    queryKey: ["/api/admin/cms/content", "status=scheduled&limit=5"],
    queryFn: () => fetch("/api/admin/cms/content?status=scheduled&limit=5", { credentials: "include" }).then(r => r.json()),
  });

  const { data: publishedData, isLoading: publishedLoading } = useQuery<{ items: CmsContentItem[]; total: number }>({
    queryKey: ["/api/admin/cms/content", "status=published&limit=5"],
    queryFn: () => fetch("/api/admin/cms/content?status=published&limit=5", { credentials: "include" }).then(r => r.json()),
  });

  const { data: reviewData, isLoading: reviewLoading } = useQuery<{ items: CmsContentItem[]; total: number }>({
    queryKey: ["/api/admin/cms/content", "status=in_review&limit=5"],
    queryFn: () => fetch("/api/admin/cms/content?status=in_review&limit=5", { credentials: "include" }).then(r => r.json()),
  });

  const getCount = (key: string): number => {
    if (!stats) return 0;
    const found = stats.find((s) => s.status === key);
    return found?.count ?? 0;
  };

  const totalContent = stats ? stats.reduce((sum, s) => sum + (s.count || 0), 0) : 0;

  return (
    <div className="space-y-6" data-testid="cms-dashboard">
      <div>
        <h2 className="font-semibold text-lg flex items-center gap-2" data-testid="text-cms-title">
          <FileText className="h-5 w-5" /> CMS Dashboard
        </h2>
        <p className="text-sm text-muted-foreground">Content management overview</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3" data-testid="grid-status-cards">
        {statsLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : (
          <Card className="p-4 space-y-2 bg-primary/5" data-testid="card-stat-total">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <TrendingUp className="h-4 w-4" />
              <span>Total</span>
            </div>
            <p className="text-2xl font-bold" data-testid="text-count-total">{totalContent}</p>
          </Card>
        )}
        {STATUS_CARDS.map((sc) => (
          statsLoading ? (
            <Skeleton key={sc.key} className="h-24 w-full" data-testid={`skeleton-stat-${sc.key}`} />
          ) : (
            <Card key={sc.key} className="p-4 space-y-2" data-testid={`card-stat-${sc.key}`}>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <sc.icon className="h-4 w-4" />
                <span>{sc.label}</span>
              </div>
              <p className="text-2xl font-bold" data-testid={`text-count-${sc.key}`}>
                {getCount(sc.key)}
              </p>
            </Card>
          )
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-3">
          <h3 className="font-semibold text-base flex items-center gap-2" data-testid="text-review-title">
            <Clock className="h-4 w-4 text-yellow-500" /> Awaiting Review
          </h3>
          {reviewLoading ? (
            <SkeletonCards count={3} />
          ) : !reviewData?.items?.length ? (
            <EmptyState icon={CheckCircle} message="No items awaiting review" testId="empty-review" />
          ) : (
            <div className="space-y-2">
              {reviewData.items.map((item) => (
                <ContentCard key={item.id} item={item} showDate="updated" />
              ))}
            </div>
          )}
        </div>

        <div className="space-y-3">
          <h3 className="font-semibold text-base flex items-center gap-2" data-testid="text-scheduled-title">
            <CalendarCheck className="h-4 w-4 text-purple-500" /> Upcoming Scheduled
          </h3>
          {scheduledLoading ? (
            <SkeletonCards count={3} />
          ) : !scheduledData?.items?.length ? (
            <EmptyState icon={CalendarCheck} message="No scheduled content" testId="empty-scheduled" />
          ) : (
            <div className="space-y-2">
              {scheduledData.items.map((item) => (
                <ContentCard key={item.id} item={item} showDate="scheduled" />
              ))}
            </div>
          )}
        </div>

        <div className="space-y-3">
          <h3 className="font-semibold text-base flex items-center gap-2" data-testid="text-published-title">
            <Eye className="h-4 w-4 text-green-500" /> Recently Published
          </h3>
          {publishedLoading ? (
            <SkeletonCards count={3} />
          ) : !publishedData?.items?.length ? (
            <EmptyState icon={FileText} message="No published content yet" testId="empty-published" />
          ) : (
            <div className="space-y-2">
              {publishedData.items.map((item) => (
                <ContentCard key={item.id} item={item} showDate="published" />
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="font-semibold text-base" data-testid="text-recent-title">Recently Updated</h3>
        {recentLoading ? (
          <SkeletonCards count={4} />
        ) : !recentData?.items?.length ? (
          <EmptyState icon={FileText} message="No content found" testId="empty-recent" />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {recentData.items.map((item) => (
              <ContentCard key={item.id} item={item} showDate="updated" />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SkeletonCards({ count }: { count: number }) {
  return (
    <div className="space-y-2">
      {[...Array(count)].map((_, i) => (
        <Skeleton key={i} className="h-14 w-full" />
      ))}
    </div>
  );
}

function EmptyState({ icon: Icon, message, testId }: { icon: any; message: string; testId: string }) {
  return (
    <Card className="p-6 text-center" data-testid={testId}>
      <Icon className="mx-auto h-8 w-8 text-muted-foreground/40 mb-2" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </Card>
  );
}
