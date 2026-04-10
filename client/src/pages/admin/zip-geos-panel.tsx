import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { MapPin, Upload, Search, Loader2, Database } from "lucide-react";

interface ZipGeo {
  zip: string;
  city: string;
  state: string;
  lat: string;
  lng: string;
  radiusMeters: number;
}

interface ZipGeosResponse {
  items: ZipGeo[];
  totalCount: number;
}

function parseCSV(text: string): Array<{ zip: string; city: string; state: string; lat: string; lng: string; radiusMeters?: number }> {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];
  const header = lines[0].toLowerCase().split(",").map((h) => h.trim());
  const zipIdx = header.findIndex((h) => h === "zip" || h === "zipcode" || h === "zip_code");
  const cityIdx = header.findIndex((h) => h === "city");
  const stateIdx = header.findIndex((h) => h === "state");
  const latIdx = header.findIndex((h) => h === "lat" || h === "latitude");
  const lngIdx = header.findIndex((h) => h === "lng" || h === "longitude" || h === "lon");
  const radiusIdx = header.findIndex((h) => h === "radius" || h === "radius_meters" || h === "radiusmeters");

  if (zipIdx === -1 || cityIdx === -1 || stateIdx === -1 || latIdx === -1 || lngIdx === -1) return [];

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
    if (cols.length < 5) continue;
    const zip = cols[zipIdx];
    if (!zip || zip.length < 3) continue;
    rows.push({
      zip,
      city: cols[cityIdx] || "",
      state: cols[stateIdx] || "",
      lat: cols[latIdx] || "",
      lng: cols[lngIdx] || "",
      radiusMeters: radiusIdx >= 0 ? parseInt(cols[radiusIdx]) || undefined : undefined,
    });
  }
  return rows;
}

export default function ZipGeosPanel({ cityId }: { cityId?: string }) {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [csvText, setCsvText] = useState("");
  const [showImport, setShowImport] = useState(false);
  const [parsedRows, setParsedRows] = useState<ReturnType<typeof parseCSV>>([]);

  const { data, isLoading } = useQuery<ZipGeosResponse>({
    queryKey: ["/api/admin/zip-geos", search ? `?search=${search}` : ""],
  });

  const importMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/admin/zip-geos/import-csv", { rows: parsedRows });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/zip-geos"] });
      toast({ title: `${parsedRows.length} ZIP codes imported` });
      setCsvText("");
      setParsedRows([]);
      setShowImport(false);
    },
    onError: (e: any) => {
      toast({ title: "Import failed", description: e.message, variant: "destructive" });
    },
  });

  const handleParseCSV = () => {
    const rows = parseCSV(csvText);
    if (rows.length === 0) {
      toast({ title: "No valid rows found", description: "CSV must have headers: zip, city, state, lat, lng", variant: "destructive" });
      return;
    }
    setParsedRows(rows);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setCsvText(ev.target?.result as string || "");
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-semibold text-lg flex items-center gap-2" data-testid="text-zip-geos-title">
            <MapPin className="h-5 w-5" />
            ZIP Code Areas
          </h2>
          <p className="text-sm text-muted-foreground">
            Manage ZIP code geographic data for targeted imports
            {data && <span className="ml-2 font-medium">({data.totalCount} total)</span>}
          </p>
        </div>
        <Button variant={showImport ? "secondary" : "default"} onClick={() => setShowImport(!showImport)} data-testid="button-toggle-import">
          <Upload className="h-4 w-4 mr-2" />
          {showImport ? "Hide Import" : "Import CSV"}
        </Button>
      </div>

      {showImport && (
        <Card className="p-4 space-y-3" data-testid="csv-import-section">
          <div className="space-y-2">
            <Label>Upload CSV file or paste CSV data</Label>
            <Input type="file" accept=".csv" onChange={handleFileUpload} data-testid="input-csv-file" />
            <Textarea
              placeholder="zip,city,state,lat,lng&#10;28202,Charlotte,NC,35.2271,-80.8431&#10;28203,Charlotte,NC,35.2087,-80.8581"
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              rows={6}
              className="font-mono text-xs"
              data-testid="textarea-csv"
            />
          </div>

          {parsedRows.length > 0 && (
            <div className="bg-muted/50 rounded p-3">
              <p className="text-sm font-medium mb-1">{parsedRows.length} rows parsed</p>
              <p className="text-xs text-muted-foreground">
                Preview: {parsedRows.slice(0, 3).map((r) => `${r.zip} (${r.city})`).join(", ")}
                {parsedRows.length > 3 && ` ...and ${parsedRows.length - 3} more`}
              </p>
            </div>
          )}

          <div className="flex gap-2">
            {parsedRows.length === 0 ? (
              <Button onClick={handleParseCSV} disabled={!csvText.trim()} data-testid="button-parse-csv">
                <Database className="h-4 w-4 mr-2" />
                Parse CSV
              </Button>
            ) : (
              <Button onClick={() => importMutation.mutate()} disabled={importMutation.isPending} data-testid="button-import-csv">
                {importMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                Import {parsedRows.length} ZIPs
              </Button>
            )}
          </div>
        </Card>
      )}

      <div className="flex items-center gap-2">
        <Search className="h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by ZIP or city..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
          data-testid="input-search-zip"
        />
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : !data || data.items.length === 0 ? (
        <Card className="p-8 text-center" data-testid="empty-zip-geos">
          <MapPin className="mx-auto h-10 w-10 text-muted-foreground/40 mb-3" />
          <h3 className="font-semibold mb-1">No ZIP codes found</h3>
          <p className="text-sm text-muted-foreground">
            {search ? "No results for your search" : "Import a CSV with Charlotte-area ZIP codes to get started"}
          </p>
        </Card>
      ) : (
        <div className="border rounded-lg overflow-hidden" data-testid="zip-geos-table">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left py-2 px-3 font-medium">ZIP</th>
                <th className="text-left py-2 px-3 font-medium">City</th>
                <th className="text-left py-2 px-3 font-medium">State</th>
                <th className="text-left py-2 px-3 font-medium">Lat</th>
                <th className="text-left py-2 px-3 font-medium">Lng</th>
                <th className="text-left py-2 px-3 font-medium">Radius</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((z) => (
                <tr key={z.zip} className="border-t" data-testid={`row-zip-${z.zip}`}>
                  <td className="py-2 px-3 font-mono font-medium">{z.zip}</td>
                  <td className="py-2 px-3">{z.city}</td>
                  <td className="py-2 px-3">{z.state}</td>
                  <td className="py-2 px-3 text-muted-foreground">{z.lat}</td>
                  <td className="py-2 px-3 text-muted-foreground">{z.lng}</td>
                  <td className="py-2 px-3 text-muted-foreground">{z.radiusMeters}m</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
