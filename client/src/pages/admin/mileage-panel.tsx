import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Navigation, Trash2, Car, MapPin } from "lucide-react";

export default function MileagePanel({ cityId }: { cityId?: string }) {
  const { data: tripsData, isLoading } = useQuery<{ data: any[] }>({
    queryKey: ["/api/mileage/trips"],
  });

  const { data: summaryData } = useQuery<{ totalMiles: number; tripCount: number; totalMinutes: number; byCategory: any[] }>({
    queryKey: ["/api/mileage/trips/summary"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/mileage/trips/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/mileage/trips"] });
      queryClient.invalidateQueries({ queryKey: ["/api/mileage/trips/summary"] });
    },
  });

  const trips = tripsData?.data || [];

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold" data-testid="text-mileage-title">Mileage Log</h2>

      {summaryData && (
        <div className="grid grid-cols-3 gap-3">
          <Card>
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold">{summaryData.totalMiles.toFixed(1)}</p>
              <p className="text-xs text-muted-foreground">Total Miles</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold">{summaryData.tripCount}</p>
              <p className="text-xs text-muted-foreground">Trips</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold">{Math.floor(summaryData.totalMinutes / 60)}h {summaryData.totalMinutes % 60}m</p>
              <p className="text-xs text-muted-foreground">Drive Time</p>
            </CardContent>
          </Card>
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Loading trips...</div>
      ) : trips.length === 0 ? (
        <div className="text-center py-12">
          <Car className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-muted-foreground">No trips logged yet. Start one from Catch.</p>
        </div>
      ) : (
        <div className="grid gap-2">
          {trips.map((trip: any) => (
            <Card key={trip.id} data-testid={`card-trip-${trip.id}`}>
              <CardContent className="p-3 flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
                  <Navigation className="h-5 w-5 text-emerald-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{parseFloat(trip.miles).toFixed(1)} mi</span>
                    <Badge variant="outline" className="text-[9px]">{trip.category}</Badge>
                    {trip.durationMinutes && <span className="text-xs text-muted-foreground">{trip.durationMinutes} min</span>}
                  </div>
                  {trip.notes && <p className="text-xs text-muted-foreground mt-0.5 truncate">{trip.notes}</p>}
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                    <MapPin className="h-3 w-3" />
                    {trip.startLocation && <span>{trip.startLocation}</span>}
                    {trip.startLocation && trip.endLocation && <span>→</span>}
                    {trip.endLocation && <span>{trip.endLocation}</span>}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs text-muted-foreground">
                    {trip.tripDate ? new Date(trip.tripDate).toLocaleDateString() : ""}
                  </p>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => { if (confirm("Delete this trip?")) deleteMutation.mutate(trip.id); }} data-testid={`button-delete-trip-${trip.id}`}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
