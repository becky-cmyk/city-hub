import { useState } from "react";
import { useParams, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  Monitor, Plus, Pencil, Trash2, Save, Globe2, Languages,
  MessageSquare, AlertCircle, Wifi, WifiOff, ArrowLeft,
} from "lucide-react";

interface ScreenInfo {
  id: string;
  name: string;
  status: string;
  hubSlug: string | null;
  locationSlug: string | null;
  languageMode: string;
  lastHeartbeatAt: string | null;
  venueName: string | null;
  venueAddress: string | null;
  notes: string | null;
}

interface VenueSpecial {
  id: string;
  title: string;
  data: {
    specialText?: string;
    specialTextEs?: string;
    imageUrl?: string | null;
    venueName?: string;
  };
}

interface VenueData {
  screen: ScreenInfo;
  specials: VenueSpecial[];
}

interface SpecialFormData {
  title: string;
  specialText: string;
  specialTextEs: string;
  imageUrl: string;
}

const EMPTY_FORM: SpecialFormData = { title: "", specialText: "", specialTextEs: "", imageUrl: "" };

function getHeartbeatInfo(lastHeartbeatAt: string | null): { color: string; text: string } {
  if (!lastHeartbeatAt) return { color: "bg-gray-500", text: "Never connected" };
  const diff = Date.now() - new Date(lastHeartbeatAt).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 2) return { color: "bg-green-500", text: "Online now" };
  if (mins < 10) return { color: "bg-yellow-500", text: `Online ${mins} min ago` };
  if (mins < 60) return { color: "bg-red-500", text: `Offline ${mins} min ago` };
  const hours = Math.floor(mins / 60);
  return { color: "bg-red-500", text: `Offline ${hours}h ago` };
}

const LANG_OPTIONS = [
  { value: "en", icon: Globe2, label: "English", desc: "All content in English" },
  { value: "es", icon: MessageSquare, label: "Spanish", desc: "Todo el contenido en español" },
  { value: "bilingual", icon: Languages, label: "Bilingual", desc: "Content in both EN & ES" },
];

export default function TvVenuePortal() {
  const params = useParams<{ screenKey: string }>();
  const screenKey = params.screenKey;
  const { toast } = useToast();

  const [editingSpecial, setEditingSpecial] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState<SpecialFormData>(EMPTY_FORM);
  const [selectedLang, setSelectedLang] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery<VenueData>({
    queryKey: ["/api/tv/venue", screenKey],
  });

  const createSpecial = useMutation({
    mutationFn: async (body: SpecialFormData) => {
      const res = await apiRequest("POST", `/api/tv/venue/${screenKey}/specials`, body);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tv/venue", screenKey] });
      setShowCreateForm(false);
      setFormData(EMPTY_FORM);
      toast({ title: "Special created", description: "Your special has been added to the screen." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const updateSpecial = useMutation({
    mutationFn: async ({ id, body }: { id: string; body: SpecialFormData }) => {
      const res = await apiRequest("PATCH", `/api/tv/venue/${screenKey}/specials/${id}`, body);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tv/venue", screenKey] });
      setEditingSpecial(null);
      setFormData(EMPTY_FORM);
      toast({ title: "Special updated", description: "Your changes have been saved." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteSpecial = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/tv/venue/${screenKey}/specials/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tv/venue", screenKey] });
      toast({ title: "Special deleted", description: "The special has been removed." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const saveSettings = useMutation({
    mutationFn: async (languageMode: string) => {
      const res = await apiRequest("PATCH", `/api/tv/venue/${screenKey}/settings`, { languageMode });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tv/venue", screenKey] });
      setSelectedLang(null);
      toast({ title: "Settings saved", description: "Your language preference has been updated." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-[hsl(174,62%,44%)] border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center px-4" data-testid="page-venue-not-found">
        <div className="text-center space-y-4 max-w-md">
          <AlertCircle className="h-16 w-16 text-red-400 mx-auto" />
          <h1 className="text-2xl font-bold" data-testid="text-not-found-title">Screen Not Found</h1>
          <p className="text-white/60" data-testid="text-not-found-message">
            This screen key is invalid or has been removed. Please check your link and try again.
          </p>
          <Link href="/tv">
            <Button variant="outline" className="border-white/20 text-white" data-testid="button-back-to-promo">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Hub Screens
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const { screen, specials } = data;
  const heartbeat = getHeartbeatInfo(screen.lastHeartbeatAt);
  const currentLang = selectedLang || screen.languageMode;
  const hasLangChanged = selectedLang !== null && selectedLang !== screen.languageMode;

  function startEdit(special: VenueSpecial) {
    setEditingSpecial(special.id);
    setShowCreateForm(false);
    setFormData({
      title: special.title,
      specialText: special.data?.specialText || "",
      specialTextEs: special.data?.specialTextEs || "",
      imageUrl: special.data?.imageUrl || "",
    });
  }

  function startCreate() {
    setShowCreateForm(true);
    setEditingSpecial(null);
    setFormData(EMPTY_FORM);
  }

  function cancelForm() {
    setShowCreateForm(false);
    setEditingSpecial(null);
    setFormData(EMPTY_FORM);
  }

  function handleSubmitSpecial() {
    if (!formData.title.trim() || !formData.specialText.trim()) {
      toast({ title: "Missing fields", description: "Title and special text are required.", variant: "destructive" });
      return;
    }
    if (editingSpecial) {
      updateSpecial.mutate({ id: editingSpecial, body: formData });
    } else {
      createSpecial.mutate(formData);
    }
  }

  const isFormPending = createSpecial.isPending || updateSpecial.isPending;

  return (
    <div className="min-h-screen bg-gray-950 text-white" data-testid="page-venue-portal">
      <nav className="fixed top-0 left-0 right-0 z-50 bg-gray-950/95 backdrop-blur-md border-b border-white/10">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-4 px-4 py-3 flex-wrap">
          <Link href="/tv" className="flex items-center gap-2 text-white/70 transition-colors">
            <Monitor className="h-5 w-5 text-[hsl(174,62%,44%)]" />
            <span className="font-bold text-lg tracking-tight text-white">Hub Screens</span>
          </Link>
          <Badge
            variant="outline"
            className={`text-xs ${screen.status === "active" ? "border-green-500/50 text-green-400" : "border-yellow-500/50 text-yellow-400"}`}
            data-testid="badge-screen-status"
          >
            {screen.status === "active" ? "Active" : "Inactive"}
          </Badge>
        </div>
      </nav>

      <div className="pt-20 pb-16 px-4">
        <div className="max-w-2xl mx-auto space-y-6">

          <Card className="bg-white/5 border-white/10 p-6" data-testid="section-dashboard">
            <div className="space-y-4">
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-white" data-testid="text-screen-name">{screen.name}</h1>
                {screen.venueName && (
                  <p className="text-sm text-white/60 mt-1" data-testid="text-venue-name">{screen.venueName}</p>
                )}
              </div>

              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-2" data-testid="indicator-heartbeat">
                  <div className={`w-2.5 h-2.5 rounded-full ${heartbeat.color}`} />
                  <span className="text-sm text-white/70">{heartbeat.text}</span>
                </div>

                <div className="flex items-center gap-2" data-testid="text-language-mode">
                  <Languages className="h-4 w-4 text-white/50" />
                  <span className="text-sm text-white/70 capitalize">{screen.languageMode}</span>
                </div>
              </div>

              {screen.hubSlug && (
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs" data-testid="badge-hub-slug">
                    {screen.hubSlug}
                  </Badge>
                </div>
              )}
            </div>
          </Card>

          <div data-testid="section-specials">
            <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
              <h2 className="text-lg font-semibold text-white">Your Specials</h2>
              <Button
                size="sm"
                onClick={startCreate}
                disabled={specials.length >= 3 || showCreateForm}
                data-testid="button-add-special"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Special
              </Button>
            </div>

            {specials.length === 0 && !showCreateForm && (
              <Card className="bg-white/5 border-white/10 p-6 text-center" data-testid="empty-specials">
                <p className="text-white/50 text-sm">No specials yet. Add up to 3 venue specials to display on your screen.</p>
              </Card>
            )}

            <div className="space-y-3">
              {specials.map((special) => (
                <Card key={special.id} className="bg-white/5 border-white/10 p-4" data-testid={`card-special-${special.id}`}>
                  {editingSpecial === special.id ? (
                    <SpecialForm
                      formData={formData}
                      setFormData={setFormData}
                      onSubmit={handleSubmitSpecial}
                      onCancel={cancelForm}
                      isPending={isFormPending}
                      isEdit
                    />
                  ) : (
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <h3 className="font-medium text-white truncate" data-testid={`text-special-title-${special.id}`}>
                          {special.title}
                        </h3>
                        <p className="text-sm text-white/60 mt-1" data-testid={`text-special-text-${special.id}`}>
                          {special.data?.specialText || ""}
                        </p>
                        {special.data?.specialTextEs && (
                          <p className="text-xs text-white/40 mt-1 italic">{special.data.specialTextEs}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button size="icon" variant="ghost" onClick={() => startEdit(special)} data-testid={`button-edit-special-${special.id}`}>
                          <Pencil className="h-4 w-4 text-white/60" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => deleteSpecial.mutate(special.id)}
                          disabled={deleteSpecial.isPending}
                          data-testid={`button-delete-special-${special.id}`}
                        >
                          <Trash2 className="h-4 w-4 text-red-400" />
                        </Button>
                      </div>
                    </div>
                  )}
                </Card>
              ))}

              {showCreateForm && (
                <Card className="bg-white/5 border-white/10 p-4" data-testid="card-create-special">
                  <SpecialForm
                    formData={formData}
                    setFormData={setFormData}
                    onSubmit={handleSubmitSpecial}
                    onCancel={cancelForm}
                    isPending={isFormPending}
                    isEdit={false}
                  />
                </Card>
              )}
            </div>

            <p className="text-xs text-white/40 mt-2">{specials.length}/3 specials used</p>
          </div>

          <Card className="bg-white/5 border-white/10 p-6" data-testid="section-settings">
            <h2 className="text-lg font-semibold text-white mb-4">Settings</h2>
            <p className="text-sm text-white/60 mb-4">Choose the language for your screen content</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {LANG_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setSelectedLang(opt.value)}
                  className={`p-4 rounded-md border text-left transition-all ${
                    currentLang === opt.value
                      ? "border-[hsl(174,62%,44%)] bg-[hsl(174,62%,44%)]/10"
                      : "border-white/10 bg-white/5"
                  }`}
                  data-testid={`radio-lang-${opt.value}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <opt.icon className={`h-4 w-4 ${currentLang === opt.value ? "text-[hsl(174,62%,44%)]" : "text-white/50"}`} />
                    <span className={`text-sm font-medium ${currentLang === opt.value ? "text-white" : "text-white/70"}`}>
                      {opt.label}
                    </span>
                  </div>
                  <p className="text-xs text-white/50 mt-1">{opt.desc}</p>
                </button>
              ))}
            </div>
            {hasLangChanged && (
              <div className="mt-4">
                <Button
                  onClick={() => saveSettings.mutate(selectedLang!)}
                  disabled={saveSettings.isPending}
                  data-testid="button-save-settings"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {saveSettings.isPending ? "Saving..." : "Save Settings"}
                </Button>
              </div>
            )}
          </Card>

        </div>
      </div>

      <footer className="border-t border-white/10 py-6 text-center">
        <p className="text-xs text-white/40" data-testid="text-footer">
          Powered by{" "}
          <a href="/tv" className="text-[hsl(174,62%,44%)] transition-colors">CityMetroHub.tv</a>
        </p>
      </footer>
    </div>
  );
}

function SpecialForm({
  formData,
  setFormData,
  onSubmit,
  onCancel,
  isPending,
  isEdit,
}: {
  formData: SpecialFormData;
  setFormData: (d: SpecialFormData) => void;
  onSubmit: () => void;
  onCancel: () => void;
  isPending: boolean;
  isEdit: boolean;
}) {
  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs text-white/60 mb-1 block">Title *</label>
        <Input
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          placeholder="e.g. Happy Hour Special"
          className="bg-white/5 border-white/15 text-white placeholder:text-white/30"
          data-testid="input-special-title"
        />
      </div>
      <div>
        <label className="text-xs text-white/60 mb-1 block">Special Text *</label>
        <Textarea
          value={formData.specialText}
          onChange={(e) => setFormData({ ...formData, specialText: e.target.value })}
          placeholder="e.g. 50% off all appetizers, Mon-Fri 4-6pm"
          className="bg-white/5 border-white/15 text-white placeholder:text-white/30 resize-none"
          rows={2}
          data-testid="input-special-text"
        />
      </div>
      <div>
        <label className="text-xs text-white/60 mb-1 block">Spanish Text (optional)</label>
        <Textarea
          value={formData.specialTextEs}
          onChange={(e) => setFormData({ ...formData, specialTextEs: e.target.value })}
          placeholder="e.g. 50% de descuento en todos los aperitivos"
          className="bg-white/5 border-white/15 text-white placeholder:text-white/30 resize-none"
          rows={2}
          data-testid="input-special-text-es"
        />
      </div>
      <div>
        <label className="text-xs text-white/60 mb-1 block">Image URL (optional)</label>
        <Input
          value={formData.imageUrl}
          onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
          placeholder="https://..."
          className="bg-white/5 border-white/15 text-white placeholder:text-white/30"
          data-testid="input-special-image"
        />
      </div>
      <div className="flex items-center gap-2 pt-1 flex-wrap">
        <Button onClick={onSubmit} disabled={isPending} data-testid={isEdit ? "button-update-special" : "button-create-special"}>
          {isPending ? "Saving..." : isEdit ? "Update Special" : "Create Special"}
        </Button>
        <Button variant="ghost" onClick={onCancel} className="text-white/60" data-testid="button-cancel-special">
          Cancel
        </Button>
      </div>
    </div>
  );
}
