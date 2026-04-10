import { useQuery } from "@tanstack/react-query";
import { TrainFront, TramFront } from "lucide-react";
import type { TransitStop, TransitLine } from "@shared/schema";

interface TransitBadgeProps {
  transitStopId?: string;
  transitStopName?: string;
  transitLineName?: string;
  transitLineColor?: string;
  transitLineType?: string;
}

export function TransitBadge({
  transitStopName,
  transitLineName,
  transitLineColor,
  transitLineType,
}: TransitBadgeProps) {
  if (!transitLineName || !transitLineColor) return null;

  const Icon = transitLineType === "STREETCAR" ? TramFront : TrainFront;
  const label = transitStopName
    ? `Near ${transitLineName}`
    : `On the ${transitLineName}`;

  return (
    <span
      data-testid="transit-badge"
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium text-white"
      style={{ backgroundColor: transitLineColor }}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </span>
  );
}

interface TransitBadgeFromIdProps {
  stopId: string;
  citySlug: string;
}

export function TransitBadgeFromId({ stopId, citySlug }: TransitBadgeFromIdProps) {
  const { data: stops } = useQuery<TransitStop[]>({
    queryKey: ["/api/cities", citySlug, "transit-stops"],
  });

  const { data: lines } = useQuery<TransitLine[]>({
    queryKey: ["/api/cities", citySlug, "transit-lines"],
  });

  if (!stops || !lines) return null;

  const stop = stops.find((s) => s.id === stopId);
  if (!stop) return null;

  const line = lines.find((l) => l.id === stop.transitLineId);
  if (!line) return null;

  return (
    <TransitBadge
      transitStopId={stop.id}
      transitStopName={stop.name}
      transitLineName={line.name}
      transitLineColor={line.color}
      transitLineType={line.lineType}
    />
  );
}
