import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { MapPin, Users, Link2, Plus, AlertTriangle, Loader2, Shield, X } from "lucide-react";
import type { Territory, Operator } from "@shared/schema";

function statusBadge(status: string) {
  const variant = status === "ACTIVE" ? "default" : status === "SUSPENDED" ? "secondary" : "destructive";
  return <Badge variant={variant} data-testid={`badge-status-${status.toLowerCase()}`}>{status}</Badge>;
}

function geoTypePlaceholder(geoType: string) {
  switch (geoType) {
    case "ZIP": return "Enter ZIP codes (e.g. 28277, 28226)";
    case "NEIGHBORHOOD": return "Enter neighborhood names (e.g. South End, NoDa)";
    case "TOWN": return "Enter town names (e.g. Matthews, Mint Hill)";
    default: return "Enter geo identifiers, separated by commas";
  }
}

function GeoCodesInput({ geoCodes, onChange, geoType, testIdPrefix }: { geoCodes: string[]; onChange: (codes: string[]) => void; geoType: string; testIdPrefix: string }) {
  const [inputValue, setInputValue] = useState("");

  function addCodes() {
    const newCodes = inputValue
      .split(",")
      .map(c => c.trim())
      .filter(c => c.length > 0 && !geoCodes.includes(c));
    if (newCodes.length > 0) {
      onChange([...geoCodes, ...newCodes]);
    }
    setInputValue("");
  }

  function removeCode(code: string) {
    onChange(geoCodes.filter(c => c !== code));
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addCodes();
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={addCodes}
          placeholder={geoTypePlaceholder(geoType)}
          data-testid={`${testIdPrefix}-input-geocodes`}
        />
      </div>
      {geoCodes.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {geoCodes.map(code => (
            <Badge key={code} variant="secondary" data-testid={`${testIdPrefix}-badge-geocode-${code}`}>
              {code}
              <button
                type="button"
                onClick={() => removeCode(code)}
                className="ml-1 inline-flex items-center"
                data-testid={`${testIdPrefix}-remove-geocode-${code}`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

function TerritoryTab() {
  const { toast } = useToast();
  const [showCreate, setShowCreate] = useState(false);
  const [editTerritory, setEditTerritory] = useState<Territory | null>(null);
  const [form, setForm] = useState({ name: "", code: "", type: "METRO" as string, parentTerritoryId: "", geoType: "ZIP" as string, cityId: "", siteUrl: "", emailDomain: "", geoCodes: [] as string[] });

  const { data: territories = [], isLoading } = useQuery<Territory[]>({ queryKey: ["/api/admin/territories"] });

  const metros = territories.filter(t => t.type === "METRO");

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/admin/territories", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/territories"] });
      setShowCreate(false);
      resetForm();
      toast({ title: "Territory created" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await apiRequest("PATCH", `/api/admin/territories/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/territories"] });
      setEditTerritory(null);
      toast({ title: "Territory updated" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  function resetForm() {
    setForm({ name: "", code: "", type: "METRO", parentTerritoryId: "", geoType: "ZIP", cityId: "", siteUrl: "", emailDomain: "", geoCodes: [] });
  }

  function openEdit(t: Territory) {
    setEditTerritory(t);
    setForm({
      name: t.name,
      code: t.code,
      type: t.type,
      parentTerritoryId: t.parentTerritoryId || "",
      geoType: t.geoType,
      cityId: t.cityId || "",
      siteUrl: t.siteUrl || "",
      emailDomain: t.emailDomain || "",
      geoCodes: (t.geoCodes as string[]) || [],
    });
  }

  function handleSubmitCreate() {
    const payload: any = { name: form.name, code: form.code, type: form.type, geoType: form.geoType };
    if (form.type === "MICRO" && form.parentTerritoryId) payload.parentTerritoryId = form.parentTerritoryId;
    if (form.cityId) payload.cityId = form.cityId;
    if (form.siteUrl) payload.siteUrl = form.siteUrl;
    if (form.emailDomain) payload.emailDomain = form.emailDomain;
    if (form.geoCodes.length > 0) payload.geoCodes = form.geoCodes;
    createMutation.mutate(payload);
  }

  function handleSubmitEdit() {
    if (!editTerritory) return;
    updateMutation.mutate({ id: editTerritory.id, data: { name: form.name, status: editTerritory.status, siteUrl: form.siteUrl || null, emailDomain: form.emailDomain || null, geoCodes: form.geoCodes } });
  }

  if (isLoading) return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold" data-testid="text-territories-title">Territories ({territories.length})</h3>
        <Button onClick={() => { resetForm(); setShowCreate(true); }} data-testid="button-create-territory">
          <Plus className="h-4 w-4 mr-2" /> Create Territory
        </Button>
      </div>

      {metros.map(metro => {
        const children = territories.filter(t => t.parentTerritoryId === metro.id);
        return (
          <Card key={metro.id} data-testid={`card-territory-${metro.id}`}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <CardTitle className="text-base">{metro.name}</CardTitle>
                    <Badge variant="outline">METRO</Badge>
                    {statusBadge(metro.status)}
                    <span className="text-sm text-muted-foreground font-mono">{metro.code}</span>
                  </div>
                  {(metro.siteUrl || metro.emailDomain) && (
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      {metro.siteUrl && <span>{metro.siteUrl}</span>}
                      {metro.emailDomain && <span>Email: {metro.emailDomain}</span>}
                    </div>
                  )}
                  {metro.geoCodes && (metro.geoCodes as string[]).length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1" data-testid={`geocodes-metro-${metro.id}`}>
                      {(metro.geoCodes as string[]).map(code => (
                        <Badge key={code} variant="outline" className="text-xs">{code}</Badge>
                      ))}
                    </div>
                  )}
                </div>
                <Button variant="ghost" size="sm" onClick={() => openEdit(metro)} data-testid={`button-edit-territory-${metro.id}`}>Edit</Button>
              </div>
            </CardHeader>
            {children.length > 0 && (
              <CardContent>
                <div className="space-y-2 ml-6 border-l-2 pl-4">
                  {children.map(micro => (
                    <div key={micro.id} className="flex items-center justify-between py-2" data-testid={`row-micro-${micro.id}`}>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm">{micro.name}</span>
                          <Badge variant="outline" className="text-xs">MICRO</Badge>
                          {statusBadge(micro.status)}
                          <span className="text-xs text-muted-foreground font-mono">{micro.code}</span>
                        </div>
                        {micro.geoCodes && (micro.geoCodes as string[]).length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1" data-testid={`geocodes-micro-${micro.id}`}>
                            {(micro.geoCodes as string[]).map(code => (
                              <Badge key={code} variant="outline" className="text-xs">{code}</Badge>
                            ))}
                          </div>
                        )}
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => openEdit(micro)} data-testid={`button-edit-micro-${micro.id}`}>Edit</Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            )}
          </Card>
        );
      })}

      {territories.filter(t => t.type === "MICRO" && !t.parentTerritoryId).map(orphan => (
        <Card key={orphan.id} className="border-yellow-200" data-testid={`card-orphan-${orphan.id}`}>
          <CardContent className="flex items-center justify-between py-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
              <span>{orphan.name}</span>
              <Badge variant="outline">MICRO (unassigned)</Badge>
              {statusBadge(orphan.status)}
            </div>
            <Button variant="ghost" size="sm" onClick={() => openEdit(orphan)}>Edit</Button>
          </CardContent>
        </Card>
      ))}

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create Territory</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Type</Label>
              <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                <SelectTrigger data-testid="select-territory-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="METRO">Metro</SelectItem>
                  <SelectItem value="MICRO">Micro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Name</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Charlotte Metro" data-testid="input-territory-name" />
            </div>
            <div>
              <Label>Code</Label>
              <Input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} placeholder="CLT or CLT-28277" data-testid="input-territory-code" />
            </div>
            <div>
              <Label>Geo Type</Label>
              <Select value={form.geoType} onValueChange={v => setForm(f => ({ ...f, geoType: v }))}>
                <SelectTrigger data-testid="select-geo-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ZIP">ZIP Code</SelectItem>
                  <SelectItem value="NEIGHBORHOOD">Neighborhood</SelectItem>
                  <SelectItem value="TOWN">Town</SelectItem>
                  <SelectItem value="CUSTOM">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Geo Codes</Label>
              <GeoCodesInput
                geoCodes={form.geoCodes}
                onChange={codes => setForm(f => ({ ...f, geoCodes: codes }))}
                geoType={form.geoType}
                testIdPrefix="create"
              />
            </div>
            {form.type === "MICRO" && (
              <div>
                <Label>Parent Metro Territory</Label>
                <Select value={form.parentTerritoryId} onValueChange={v => setForm(f => ({ ...f, parentTerritoryId: v }))}>
                  <SelectTrigger data-testid="select-parent-territory"><SelectValue placeholder="Select metro..." /></SelectTrigger>
                  <SelectContent>
                    {metros.map(m => (
                      <SelectItem key={m.id} value={m.id}>{m.name} ({m.code})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label>Site URL (optional)</Label>
              <Input value={form.siteUrl} onChange={e => setForm(f => ({ ...f, siteUrl: e.target.value }))} placeholder="e.g. https://cltmetrohub.com" data-testid="input-territory-site-url" />
            </div>
            <div>
              <Label>Email Domain (optional)</Label>
              <Input value={form.emailDomain} onChange={e => setForm(f => ({ ...f, emailDomain: e.target.value }))} placeholder="e.g. cltmetrohub.com" data-testid="input-territory-email-domain" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)} data-testid="button-cancel-create">Cancel</Button>
            <Button onClick={handleSubmitCreate} disabled={createMutation.isPending} data-testid="button-submit-territory">
              {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editTerritory} onOpenChange={() => setEditTerritory(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Territory</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Name</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} data-testid="input-edit-territory-name" />
            </div>
            <div>
              <Label>Code</Label>
              <Input value={form.code} disabled className="bg-muted" />
            </div>
            <div>
              <Label>Status</Label>
              <Select value={editTerritory?.status || "ACTIVE"} onValueChange={v => setEditTerritory(t => t ? { ...t, status: v as any } : null)}>
                <SelectTrigger data-testid="select-edit-status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="SUSPENDED">Suspended</SelectItem>
                  <SelectItem value="REVOKED">Revoked</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Site URL (optional)</Label>
              <Input value={form.siteUrl} onChange={e => setForm(f => ({ ...f, siteUrl: e.target.value }))} placeholder="e.g. https://cltmetrohub.com" data-testid="input-edit-territory-site-url" />
            </div>
            <div>
              <Label>Email Domain (optional)</Label>
              <Input value={form.emailDomain} onChange={e => setForm(f => ({ ...f, emailDomain: e.target.value }))} placeholder="e.g. cltmetrohub.com" data-testid="input-edit-territory-email-domain" />
            </div>
            <div>
              <Label>Geo Codes</Label>
              <GeoCodesInput
                geoCodes={form.geoCodes}
                onChange={codes => setForm(f => ({ ...f, geoCodes: codes }))}
                geoType={form.geoType}
                testIdPrefix="edit"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTerritory(null)}>Cancel</Button>
            <Button onClick={handleSubmitEdit} disabled={updateMutation.isPending} data-testid="button-save-territory">
              {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function OperatorsTab() {
  const { toast } = useToast();
  const [showCreate, setShowCreate] = useState(false);
  const [showAssign, setShowAssign] = useState<string | null>(null);
  const [form, setForm] = useState({ displayName: "", email: "", operatorType: "METRO" as string });
  const [assignForm, setAssignForm] = useState({ territoryId: "", exclusivity: "NONE" as string });

  const { data: operatorsData = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/admin/operators"] });
  const { data: territories = [] } = useQuery<Territory[]>({ queryKey: ["/api/admin/territories"] });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/admin/operators", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/operators"] });
      setShowCreate(false);
      setForm({ displayName: "", email: "", operatorType: "METRO" });
      toast({ title: "Operator created" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const revokeMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/admin/operators/${id}/revoke`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/operators"] });
      toast({ title: "Operator revoked", description: "Future revenue splits will auto-adjust." });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const assignMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/admin/operator-territories", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/operators"] });
      setShowAssign(null);
      toast({ title: "Operator assigned to territory" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const unassignMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/admin/operator-territories/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/operators"] });
      toast({ title: "Assignment removed" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  if (isLoading) return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold" data-testid="text-operators-title">Operators ({operatorsData.length})</h3>
        <Button onClick={() => setShowCreate(true)} data-testid="button-create-operator">
          <Plus className="h-4 w-4 mr-2" /> Create Operator
        </Button>
      </div>

      {operatorsData.map((op: any) => (
        <Card key={op.id} data-testid={`card-operator-${op.id}`}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <Users className="h-5 w-5 text-muted-foreground" />
                <div>
                  <span className="font-medium" data-testid={`text-operator-name-${op.id}`}>{op.displayName}</span>
                  <span className="text-sm text-muted-foreground ml-2">{op.email}</span>
                </div>
                <Badge variant="outline">{op.operatorType}</Badge>
                {statusBadge(op.status)}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => { setShowAssign(op.id); setAssignForm({ territoryId: "", exclusivity: "NONE" }); }} data-testid={`button-assign-${op.id}`}>
                  <Link2 className="h-4 w-4 mr-1" /> Assign
                </Button>
                {op.status === "ACTIVE" && (
                  <Button variant="destructive" size="sm" onClick={() => {
                    if (confirm(`Revoke operator "${op.displayName}"? Future revenue splits will auto-adjust.`)) {
                      revokeMutation.mutate(op.id);
                    }
                  }} data-testid={`button-revoke-${op.id}`}>
                    <Shield className="h-4 w-4 mr-1" /> Revoke
                  </Button>
                )}
              </div>
            </div>
            {op.territories && op.territories.length > 0 && (
              <div className="ml-10 space-y-1">
                {op.territories.map((t: any) => (
                  <div key={t.id} className="flex items-center justify-between text-sm py-1 px-2 rounded bg-muted/50" data-testid={`row-assignment-${t.id}`}>
                    <div className="flex items-center gap-2">
                      <MapPin className="h-3 w-3" />
                      <span>{t.territory?.name || "Unknown"}</span>
                      <Badge variant="outline" className="text-xs">{t.territory?.type}</Badge>
                      {t.exclusivity === "CONDITIONAL" && <Badge variant="secondary" className="text-xs">Conditional Exclusivity</Badge>}
                    </div>
                    <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => unassignMutation.mutate(t.id)} data-testid={`button-unassign-${t.id}`}>
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ))}

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create Operator</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Type</Label>
              <Select value={form.operatorType} onValueChange={v => setForm(f => ({ ...f, operatorType: v }))}>
                <SelectTrigger data-testid="select-operator-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="METRO">Metro Operator</SelectItem>
                  <SelectItem value="MICRO">Micro Operator</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Display Name</Label>
              <Input value={form.displayName} onChange={e => setForm(f => ({ ...f, displayName: e.target.value }))} placeholder="John Smith" data-testid="input-operator-name" />
            </div>
            <div>
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="john@example.com" data-testid="input-operator-email" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={() => createMutation.mutate(form)} disabled={createMutation.isPending} data-testid="button-submit-operator">
              {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!showAssign} onOpenChange={() => setShowAssign(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Assign to Territory</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Territory</Label>
              <Select value={assignForm.territoryId} onValueChange={v => setAssignForm(f => ({ ...f, territoryId: v }))}>
                <SelectTrigger data-testid="select-assign-territory"><SelectValue placeholder="Select territory..." /></SelectTrigger>
                <SelectContent>
                  {territories.map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.name} ({t.code}) - {t.type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Exclusivity</Label>
              <Select value={assignForm.exclusivity} onValueChange={v => setAssignForm(f => ({ ...f, exclusivity: v }))}>
                <SelectTrigger data-testid="select-exclusivity"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">None</SelectItem>
                  <SelectItem value="CONDITIONAL">Conditional</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAssign(null)}>Cancel</Button>
            <Button onClick={() => assignMutation.mutate({ operatorId: showAssign, ...assignForm })} disabled={assignMutation.isPending} data-testid="button-submit-assign">
              {assignMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Assign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function LicensingPanel({ cityId }: { cityId?: string }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold" data-testid="text-licensing-heading">Territories & Operators</h2>
        <p className="text-muted-foreground">Manage territory licensing, operator assignments, and the Metro/Micro hierarchy.</p>
      </div>

      <Card className="p-4 bg-muted/30 border-dashed">
        <div className="text-sm space-y-1">
          <p className="font-medium">City Metro Hub Licensing Model</p>
          <p className="text-muted-foreground">City Metro Hub (root) → Metro Territories (city-level) → Micro Territories (zip/neighborhood). All revenue flows through City Metro Hub and is split automatically based on operator assignments and status.</p>
        </div>
      </Card>

      <Tabs defaultValue="territories">
        <TabsList>
          <TabsTrigger value="territories" data-testid="tab-territories">Territories</TabsTrigger>
          <TabsTrigger value="operators" data-testid="tab-operators">Operators</TabsTrigger>
        </TabsList>
        <TabsContent value="territories"><TerritoryTab /></TabsContent>
        <TabsContent value="operators"><OperatorsTab /></TabsContent>
      </Tabs>
    </div>
  );
}
