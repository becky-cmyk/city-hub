import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { MapPin, Plus, Trash2, Download, Loader2 } from "lucide-react";

type Region = {
  id: string;
  name: string;
  code: string;
  regionType: string;
  parentRegionId: string | null;
  centerLat: string | null;
  centerLng: string | null;
};

type HubZipCoverage = {
  id: string;
  hubRegionId: string;
  zip: string;
  confidence: "high" | "med" | "low";
  notes: string | null;
  createdAt: string;
};

export default function HubsCoveragePanel({ cityId }: { cityId?: string }) {
  const { toast } = useToast();
  const [selectedCounty, setSelectedCounty] = useState<string>("all");
  const [selectedHub, setSelectedHub] = useState<Region | null>(null);
  const [addZipOpen, setAddZipOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [newZip, setNewZip] = useState("");
  const [newConfidence, setNewConfidence] = useState<"high" | "med" | "low">("low");
  const [bulkText, setBulkText] = useState("");
  const [bulkConfidence, setBulkConfidence] = useState<"high" | "med" | "low">("low");

  const { data: counties = [] } = useQuery<Region[]>({
    queryKey: ["/api/admin/hubs/counties"],
  });

  const hubsUrl = selectedCounty === "all" ? "/api/admin/hubs" : `/api/admin/hubs?countyId=${selectedCounty}`;
  const { data: hubs = [], isLoading: hubsLoading } = useQuery<Region[]>({
    queryKey: [hubsUrl],
  });

  const coverageUrl = selectedHub ? `/api/admin/hubs/${selectedHub.id}/coverage` : "";
  const { data: coverage = [], isLoading: coverageLoading } = useQuery<HubZipCoverage[]>({
    queryKey: [coverageUrl],
    enabled: !!selectedHub,
  });

  const addCoverageMut = useMutation({
    mutationFn: async (data: { zip: string; confidence: string }) => {
      return apiRequest("POST", `/api/admin/hubs/${selectedHub!.id}/coverage`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [coverageUrl] });
      setAddZipOpen(false);
      setNewZip("");
      toast({ title: "ZIP added to coverage" });
    },
    onError: (e: any) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const bulkAddMut = useMutation({
    mutationFn: async (data: { zips: string[]; confidence: string }) => {
      const res = await apiRequest("POST", `/api/admin/hubs/${selectedHub!.id}/coverage/bulk`, data);
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: [coverageUrl] });
      setBulkOpen(false);
      setBulkText("");
      const msg = `Inserted ${data.inserted}${data.missing?.length ? `, ${data.missing.length} missing ZIPs: ${data.missing.join(", ")}` : ""}`;
      toast({ title: "Bulk add complete", description: msg });
    },
    onError: (e: any) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const deleteCoverageMut = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/admin/hubs/coverage/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [coverageUrl] });
      toast({ title: "ZIP removed from coverage" });
    },
  });

  const importFromHubMut = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/admin/places/import-jobs", {
        mode: "text_search",
        areaMode: "hub",
        hubRegionId: selectedHub!.id,
        queryText: "businesses in " + selectedHub!.name,
        requestedCount: 20,
      });
    },
    onSuccess: () => {
      toast({ title: "Import job started", description: `Importing for hub: ${selectedHub!.name}` });
    },
    onError: (e: any) => {
      toast({ title: "Import error", description: e.message, variant: "destructive" });
    },
  });

  const getCountyName = (hub: Region) => {
    const county = counties.find((c) => c.id === hub.parentRegionId);
    return county?.name || "—";
  };

  const confidenceBadge = (c: string) => {
    const v = c === "high" ? "default" : c === "med" ? "secondary" : "outline";
    return <Badge variant={v as any} data-testid={`badge-confidence-${c}`}>{c}</Badge>;
  };

  return (
    <div className="space-y-4" data-testid="hubs-coverage-panel">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold" data-testid="text-hubs-title">Hubs & Coverage</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Hub List</CardTitle>
            <Select value={selectedCounty} onValueChange={setSelectedCounty} data-testid="select-county-filter">
              <SelectTrigger data-testid="select-county-trigger">
                <SelectValue placeholder="Filter by county" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Counties</SelectItem>
                {counties.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent className="max-h-[60vh] overflow-y-auto space-y-1 p-2">
            {hubsLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
            ) : hubs.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No hubs found</p>
            ) : (
              hubs.map((hub) => (
                <button
                  key={hub.id}
                  onClick={() => setSelectedHub(hub)}
                  className={`w-full text-left p-2 rounded-md text-sm transition-colors ${
                    selectedHub?.id === hub.id
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-muted"
                  }`}
                  data-testid={`button-hub-${hub.code}`}
                >
                  <div className="flex items-center gap-2">
                    <MapPin className="h-3.5 w-3.5 shrink-0" />
                    <div className="min-w-0">
                      <span className="font-medium block truncate">{hub.name}</span>
                      <span className={`text-[10px] block ${selectedHub?.id === hub.id ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                        {getCountyName(hub)} · {hub.code}
                      </span>
                    </div>
                  </div>
                </button>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          {selectedHub ? (
            <>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg" data-testid="text-hub-name">{selectedHub.name}</CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">
                      {getCountyName(selectedHub)} · Code: {selectedHub.code}
                      {selectedHub.centerLat && selectedHub.centerLng && (
                        <> · Center: {Number(selectedHub.centerLat).toFixed(4)}, {Number(selectedHub.centerLng).toFixed(4)}</>
                      )}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => setAddZipOpen(true)} data-testid="button-add-zip">
                      <Plus className="h-3.5 w-3.5 mr-1" /> Add ZIP
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setBulkOpen(true)} data-testid="button-bulk-add">
                      Bulk Add
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => importFromHubMut.mutate()}
                      disabled={importFromHubMut.isPending}
                      data-testid="button-import-hub"
                    >
                      <Download className="h-3.5 w-3.5 mr-1" />
                      {importFromHubMut.isPending ? "Starting..." : "Import from Hub"}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {coverageLoading ? (
                  <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
                ) : coverage.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No ZIP coverage mapped yet.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ZIP</TableHead>
                        <TableHead>Confidence</TableHead>
                        <TableHead>Notes</TableHead>
                        <TableHead className="w-[60px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {coverage.map((c) => (
                        <TableRow key={c.id} data-testid={`row-coverage-${c.zip}`}>
                          <TableCell className="font-mono">{c.zip}</TableCell>
                          <TableCell>{confidenceBadge(c.confidence)}</TableCell>
                          <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{c.notes || "—"}</TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => deleteCoverageMut.mutate(c.id)}
                              data-testid={`button-delete-coverage-${c.zip}`}
                            >
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </>
          ) : (
            <CardContent className="flex items-center justify-center py-16">
              <p className="text-muted-foreground text-sm">Select a hub from the list to view and edit its ZIP coverage.</p>
            </CardContent>
          )}
        </Card>
      </div>

      <Dialog open={addZipOpen} onOpenChange={setAddZipOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add ZIP to {selectedHub?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="ZIP code (e.g. 28202)"
              value={newZip}
              onChange={(e) => setNewZip(e.target.value)}
              data-testid="input-add-zip"
            />
            <Select value={newConfidence} onValueChange={(v) => setNewConfidence(v as any)}>
              <SelectTrigger data-testid="select-add-confidence">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="med">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddZipOpen(false)}>Cancel</Button>
            <Button
              onClick={() => addCoverageMut.mutate({ zip: newZip, confidence: newConfidence })}
              disabled={addCoverageMut.isPending || !newZip}
              data-testid="button-confirm-add-zip"
            >
              {addCoverageMut.isPending ? "Adding..." : "Add ZIP"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bulk Add ZIPs to {selectedHub?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Textarea
              placeholder="Paste ZIP codes, one per line or comma-separated"
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              rows={4}
              data-testid="input-bulk-zips"
            />
            <Select value={bulkConfidence} onValueChange={(v) => setBulkConfidence(v as any)}>
              <SelectTrigger data-testid="select-bulk-confidence">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="med">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkOpen(false)}>Cancel</Button>
            <Button
              onClick={() => {
                const zips = bulkText.split(/[\n,]+/).map((z) => z.trim()).filter(Boolean);
                if (zips.length > 0) bulkAddMut.mutate({ zips, confidence: bulkConfidence });
              }}
              disabled={bulkAddMut.isPending || !bulkText.trim()}
              data-testid="button-confirm-bulk-add"
            >
              {bulkAddMut.isPending ? "Adding..." : "Bulk Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
