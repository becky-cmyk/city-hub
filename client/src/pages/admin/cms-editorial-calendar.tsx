import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, ChevronRight, FileText, Calendar } from "lucide-react";
import { useLocation } from "wouter";

interface CalendarItem {
  id: string;
  titleEn: string;
  status: string;
  contentType: string;
  publishAt: string | null;
  publishedAt: string | null;
  unpublishAt: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
  in_review: "bg-yellow-100 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-200",
  scheduled: "bg-purple-100 text-purple-800 dark:bg-purple-800 dark:text-purple-200",
  published: "bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-200",
  archived: "bg-orange-100 text-orange-800 dark:bg-orange-800 dark:text-orange-200",
};

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function getMonthDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let i = 1; i <= daysInMonth; i++) days.push(i);
  return days;
}

function getDateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function CmsEditorialCalendar({ cityId }: { cityId?: string }) {
  const [, navigate] = useLocation();
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());

  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0, 23, 59, 59);

  const calendarUrl = `/api/admin/cms/calendar?start=${start.toISOString()}&end=${end.toISOString()}`;
  const { data: items, isLoading } = useQuery<CalendarItem[]>({
    queryKey: [calendarUrl],
  });

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  }

  function nextMonth() {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  }

  const dayItems = new Map<string, { item: CalendarItem; eventType: string }[]>();
  if (items) {
    for (const item of items) {
      const addToDay = (dateStr: string | null, eventType: string) => {
        if (!dateStr) return;
        const d = new Date(dateStr);
        const key = getDateKey(d);
        if (!dayItems.has(key)) dayItems.set(key, []);
        dayItems.get(key)!.push({ item, eventType });
      };
      addToDay(item.publishAt, "scheduled");
      addToDay(item.publishedAt, "published");
      addToDay(item.unpublishAt, "unpublish");
    }
  }

  const days = getMonthDays(year, month);
  const todayKey = getDateKey(today);

  return (
    <div className="space-y-4" data-testid="editorial-calendar">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Editorial Calendar</h2>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={prevMonth} data-testid="button-prev-month">
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm font-medium min-w-[140px] text-center" data-testid="text-current-month">
            {MONTHS[month]} {year}
          </span>
          <Button size="sm" variant="outline" onClick={nextMonth} data-testid="button-next-month">
            <ChevronRight className="w-4 h-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => { setMonth(today.getMonth()); setYear(today.getFullYear()); }}
            data-testid="button-today"
          >
            Today
          </Button>
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="h-96 w-full" />
      ) : (
        <Card className="p-2">
          <div className="grid grid-cols-7 gap-px">
            {DAYS.map(d => (
              <div key={d} className="text-center text-xs font-medium text-muted-foreground py-2">{d}</div>
            ))}
            {days.map((day, idx) => {
              if (day === null) return <div key={`empty-${idx}`} className="min-h-[80px] bg-muted/20 rounded" />;
              const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const entries = dayItems.get(key) || [];
              const isToday = key === todayKey;
              return (
                <div
                  key={key}
                  className={`min-h-[80px] border rounded p-1 ${isToday ? "ring-2 ring-primary/50 bg-primary/5" : "bg-background"}`}
                  data-testid={`calendar-day-${key}`}
                >
                  <div className={`text-xs font-medium mb-1 ${isToday ? "text-primary font-bold" : "text-muted-foreground"}`}>
                    {day}
                  </div>
                  <div className="space-y-0.5">
                    {entries.slice(0, 3).map((entry, i) => (
                      <div
                        key={`${entry.item.id}-${entry.eventType}-${i}`}
                        className="text-[10px] leading-tight truncate px-1 py-0.5 rounded cursor-pointer hover:opacity-80"
                        style={{
                          backgroundColor: entry.eventType === "scheduled" ? "hsl(var(--chart-4) / 0.15)" :
                            entry.eventType === "published" ? "hsl(var(--chart-2) / 0.15)" : "hsl(var(--chart-5) / 0.15)",
                          color: entry.eventType === "scheduled" ? "hsl(var(--chart-4))" :
                            entry.eventType === "published" ? "hsl(var(--chart-2))" : "hsl(var(--chart-5))",
                        }}
                        onClick={() => navigate(`/admin/cms/editor/${entry.item.id}`)}
                        title={`${entry.eventType}: ${entry.item.titleEn}`}
                        data-testid={`calendar-entry-${entry.item.id}`}
                      >
                        {entry.item.titleEn}
                      </div>
                    ))}
                    {entries.length > 3 && (
                      <div className="text-[10px] text-muted-foreground pl-1">+{entries.length - 3} more</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex gap-4 mt-3 px-2 pb-1">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <div className="w-2.5 h-2.5 rounded" style={{ backgroundColor: "hsl(var(--chart-4) / 0.5)" }} />
              Scheduled
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <div className="w-2.5 h-2.5 rounded" style={{ backgroundColor: "hsl(var(--chart-2) / 0.5)" }} />
              Published
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <div className="w-2.5 h-2.5 rounded" style={{ backgroundColor: "hsl(var(--chart-5) / 0.5)" }} />
              Unpublish
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
