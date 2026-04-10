import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useI18n } from "@/lib/i18n";
import { AuthDialog } from "@/components/auth-dialog";
import { VerifiedBadge } from "@/components/verified-badge";
import { VerificationCTA } from "@/components/verification-cta";
import { getDeviceId } from "@/lib/device";
import { DarkPageShell } from "@/components/dark-page-shell";
import { Link } from "wouter";
import {
  User,
  MapPin,
  Bookmark,
  Settings,
  Heart,
  Trash2,
  Building2,
  Calendar,
  FileText,
  LogOut,
  Shield,
  ChevronRight,
  Bell,
  Sparkles,
  Users,
  Briefcase,
  Palette,
  GraduationCap,
  Landmark,
  Check,
  Loader2,
  Zap,
  Home,
  Link as LinkIcon,
} from "lucide-react";
import type { ProfileType } from "@/hooks/use-auth";

interface SavedItem {
  id: string;
  itemType: string;
  itemId: string;
  planName: string | null;
  createdAt: string;
  itemName?: string;
  itemSlug?: string;
}

const TOPIC_OPTIONS = [
  { key: "food", labelEn: "Food & Dining", labelEs: "Comida y Restaurantes", icon: "🍽" },
  { key: "music", labelEn: "Music & Nightlife", labelEs: "Música y Vida Nocturna", icon: "🎵" },
  { key: "events", labelEn: "Events", labelEs: "Eventos", icon: "📅" },
  { key: "sports", labelEn: "Sports", labelEs: "Deportes", icon: "⚽" },
  { key: "arts", labelEn: "Arts & Culture", labelEs: "Arte y Cultura", icon: "🎨" },
  { key: "real-estate", labelEn: "Real Estate", labelEs: "Bienes Raíces", icon: "🏠" },
  { key: "family", labelEn: "Family & Kids", labelEs: "Familia y Niños", icon: "👨‍👩‍👧" },
  { key: "pets", labelEn: "Pets & Animals", labelEs: "Mascotas", icon: "🐾" },
  { key: "health", labelEn: "Health & Wellness", labelEs: "Salud y Bienestar", icon: "💪" },
  { key: "shopping", labelEn: "Shopping & Retail", labelEs: "Compras", icon: "🛍" },
  { key: "outdoors", labelEn: "Outdoors", labelEs: "Actividades al Aire Libre", icon: "🌳" },
  { key: "community", labelEn: "Community", labelEs: "Comunidad", icon: "🤝" },
];

const PREFS_STORAGE_KEY = "cch_feed_topics";
const NOTIF_STORAGE_KEY = "cch_notifications";

function getStoredTopics(): string[] {
  try {
    const raw = localStorage.getItem(PREFS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function getStoredNotifications(): { weekendAlerts: boolean; newContent: boolean } {
  try {
    const raw = localStorage.getItem(NOTIF_STORAGE_KEY);
    return raw ? JSON.parse(raw) : { weekendAlerts: true, newContent: false };
  } catch {
    return { weekendAlerts: true, newContent: false };
  }
}

function AnonymousPrompt({ citySlug }: { citySlug: string }) {
  const { t, locale } = useI18n();
  const [authOpen, setAuthOpen] = useState(false);

  return (
    <div className="space-y-6 max-w-lg mx-auto" data-testid="subscriber-profile-anonymous">
      <div className="rounded-md border border-white/10 bg-white/5 p-8 text-center space-y-4">
        <div className="mx-auto h-16 w-16 rounded-full flex items-center justify-center bg-purple-500/20">
          <User className="h-8 w-8 text-purple-400" />
        </div>
        <h1 className="text-xl font-bold text-white" data-testid="text-profile-signin-title">
          {locale === "es" ? "Únete a CLT Metro Hub" : "Join CLT Metro Hub"}
        </h1>
        <p className="text-white/50 text-sm leading-relaxed">
          {locale === "es"
            ? "Crea una cuenta para personalizar tu feed, guardar elementos y recibir alertas de fin de semana."
            : "Create an account to personalize your feed, save items, and get weekend alerts."}
        </p>
        <div className="space-y-3 text-left">
          <div className="flex items-start gap-3">
            <Sparkles className="h-5 w-5 shrink-0 mt-0.5 text-purple-400" />
            <div>
              <p className="text-sm font-medium text-white">{locale === "es" ? "Feed personalizado" : "Personalized Feed"}</p>
              <p className="text-xs text-white/40">
                {locale === "es" ? "Contenido adaptado a tus intereses y vecindario" : "Content tailored to your interests and neighborhood"}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Bookmark className="h-5 w-5 shrink-0 mt-0.5 text-purple-400" />
            <div>
              <p className="text-sm font-medium text-white">{locale === "es" ? "Guardar elementos" : "Save Items"}</p>
              <p className="text-xs text-white/40">
                {locale === "es" ? "Guarda negocios, eventos y artículos para después" : "Bookmark businesses, events, and articles for later"}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Bell className="h-5 w-5 shrink-0 mt-0.5 text-purple-400" />
            <div>
              <p className="text-sm font-medium text-white">{locale === "es" ? "Alertas de fin de semana" : "Weekend Alerts"}</p>
              <p className="text-xs text-white/40">
                {locale === "es" ? "Recibe lo mejor de tu vecindario cada viernes" : "Get the best of your neighborhood every Friday"}
              </p>
            </div>
          </div>
        </div>
        <div className="pt-2 space-y-2">
          <Button
            className="w-full bg-purple-600 border-purple-500 text-white"
            onClick={() => setAuthOpen(true)}
            data-testid="button-profile-signup"
          >
            {locale === "es" ? "Crear Cuenta" : "Sign Up Free"}
          </Button>
          <Button
            variant="outline"
            className="w-full border-white/20 text-white"
            onClick={() => setAuthOpen(true)}
            data-testid="button-profile-login"
          >
            {locale === "es" ? "Ya tengo una cuenta" : "Already have an account? Log In"}
          </Button>
        </div>
      </div>
      <AuthDialog open={authOpen} onOpenChange={setAuthOpen} />
    </div>
  );
}

function SavedItemsSection({ citySlug }: { citySlug: string }) {
  const { toast } = useToast();
  const deviceId = getDeviceId();

  const { data: items, isLoading } = useQuery<SavedItem[]>({
    queryKey: ["/api/cities", citySlug, "saved", `?deviceId=${deviceId}`],
  });

  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/cities/${citySlug}/saved/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cities", citySlug, "saved"] });
      toast({ title: "Removed from saved" });
    },
  });

  const getIcon = (type: string) => {
    switch (type) {
      case "BUSINESS": return Building2;
      case "EVENT": return Calendar;
      case "ARTICLE": return FileText;
      default: return Bookmark;
    }
  };

  const getLink = (item: SavedItem) => {
    switch (item.itemType) {
      case "BUSINESS": return `/${citySlug}/directory/${item.itemSlug || item.itemId}`;
      case "EVENT": return `/${citySlug}/events/${item.itemSlug || item.itemId}`;
      case "ARTICLE": return `/${citySlug}/articles/${item.itemSlug || item.itemId}`;
      default: return "#";
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-md border border-white/10 bg-white/5 p-4">
            <Skeleton className="h-12 w-full bg-white/10" />
          </div>
        ))}
      </div>
    );
  }

  if (!items || items.length === 0) {
    return (
      <div className="rounded-md border border-white/10 bg-white/5 p-12 text-center" data-testid="saved-empty">
        <Bookmark className="mx-auto h-12 w-12 text-white/20 mb-4" />
        <h3 className="font-semibold text-lg mb-1 text-white">No saved items yet</h3>
        <p className="text-white/40 text-sm">
          Tap the bookmark icon on any business, event, or article to save it here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item) => {
        const Icon = getIcon(item.itemType);
        return (
          <div key={item.id} className="rounded-md border border-white/10 bg-white/5 p-4" data-testid={`card-saved-${item.id}`}>
            <div className="flex items-center gap-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-purple-500/20 shrink-0">
                <Icon className="h-4 w-4 text-purple-400" />
              </div>
              <div className="flex-1 min-w-0">
                <Link href={getLink(item)}>
                  <span className="font-semibold text-white hover:underline cursor-pointer" data-testid={`link-saved-item-${item.id}`}>
                    {item.itemName || `${item.itemType} item`}
                  </span>
                </Link>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <Badge variant="outline" className="text-[10px] border-white/20 text-white/60">{item.itemType}</Badge>
                  {item.planName && <Badge variant="secondary" className="text-[10px] bg-white/10 text-white/70">{item.planName}</Badge>}
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => removeMutation.mutate(item.id)}
                disabled={removeMutation.isPending}
                data-testid={`button-remove-saved-${item.id}`}
              >
                <Trash2 className="h-4 w-4 text-white/40" />
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TopicPreferences({ locale }: { locale: string }) {
  const [selectedTopics, setSelectedTopics] = useState<string[]>(getStoredTopics);

  const toggleTopic = (key: string) => {
    setSelectedTopics((prev) => {
      const next = prev.includes(key) ? prev.filter((t) => t !== key) : [...prev, key];
      localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  return (
    <div className="space-y-4" data-testid="section-topic-preferences">
      <div>
        <h3 className="text-sm font-semibold mb-1 text-white">
          {locale === "es" ? "Mis Intereses" : "My Feed Preferences"}
        </h3>
        <p className="text-xs text-white/40">
          {locale === "es"
            ? "Selecciona los temas que te interesan para personalizar tu feed"
            : "Select topics you care about to personalize your feed"}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {TOPIC_OPTIONS.map((topic) => {
          const isSelected = selectedTopics.includes(topic.key);
          return (
            <button
              key={topic.key}
              onClick={() => toggleTopic(topic.key)}
              className={`flex items-center gap-2 rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                isSelected
                  ? "border-purple-500/50 bg-purple-500/10 font-medium text-white"
                  : "border-white/10 text-white/70"
              }`}
              data-testid={`toggle-topic-${topic.key}`}
            >
              <Heart
                className={`h-4 w-4 shrink-0 ${isSelected ? "fill-current text-purple-400" : "text-white/40"}`}
              />
              <span className="truncate">{locale === "es" ? topic.labelEs : topic.labelEn}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function NotificationPreferences({ locale }: { locale: string }) {
  const [notifs, setNotifs] = useState(getStoredNotifications);

  const update = (key: string, val: boolean) => {
    const next = { ...notifs, [key]: val };
    setNotifs(next);
    localStorage.setItem(NOTIF_STORAGE_KEY, JSON.stringify(next));
  };

  return (
    <div className="space-y-4" data-testid="section-notification-preferences">
      <h3 className="text-sm font-semibold text-white">
        {locale === "es" ? "Notificaciones" : "Notifications"}
      </h3>
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-white">{locale === "es" ? "Alertas de fin de semana" : "Weekend Alerts"}</p>
            <p className="text-xs text-white/40">
              {locale === "es" ? "Recibe eventos y actividades cada viernes" : "Get events and activities every Friday"}
            </p>
          </div>
          <Switch
            checked={notifs.weekendAlerts}
            onCheckedChange={(v) => update("weekendAlerts", v)}
            data-testid="switch-weekend-alerts"
          />
        </div>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-white">{locale === "es" ? "Contenido nuevo" : "New Content"}</p>
            <p className="text-xs text-white/40">
              {locale === "es" ? "Notificar cuando hay contenido nuevo en tu vecindario" : "Notify when new content appears in your hub"}
            </p>
          </div>
          <Switch
            checked={notifs.newContent}
            onCheckedChange={(v) => update("newContent", v)}
            data-testid="switch-new-content"
          />
        </div>
      </div>
    </div>
  );
}

function LandingPreference({ locale }: { locale: string }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const current = user?.defaultLanding || "pulse";

  const updateLanding = useMutation({
    mutationFn: async (value: "pulse" | "hub") => {
      await apiRequest("PUT", "/api/auth/default-landing", { defaultLanding: value });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      toast({ title: locale === "es" ? "Preferencia guardada" : "Preference saved" });
    },
  });

  return (
    <div className="space-y-3" data-testid="section-landing-preference">
      <h3 className="text-sm font-semibold text-white">
        {locale === "es" ? "Pantalla de inicio" : "Default Landing"}
      </h3>
      <p className="text-xs text-white/40">
        {locale === "es"
          ? "Elige qué ver al abrir la app"
          : "Choose what you see when you open the app"}
      </p>
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => updateLanding.mutate("pulse")}
          disabled={updateLanding.isPending}
          className={`flex items-center gap-2 px-3 py-3 rounded-lg border text-sm font-medium transition-colors ${
            current === "pulse"
              ? "border-purple-500/50 bg-purple-500/10 text-purple-300"
              : "border-white/10 bg-white/5 text-white/60"
          }`}
          data-testid="button-landing-pulse"
        >
          <Zap className="h-4 w-4" />
          Pulse Feed
        </button>
        <button
          onClick={() => updateLanding.mutate("hub")}
          disabled={updateLanding.isPending}
          className={`flex items-center gap-2 px-3 py-3 rounded-lg border text-sm font-medium transition-colors ${
            current === "hub"
              ? "border-purple-500/50 bg-purple-500/10 text-purple-300"
              : "border-white/10 bg-white/5 text-white/60"
          }`}
          data-testid="button-landing-hub"
        >
          <Home className="h-4 w-4" />
          {locale === "es" ? "Mi Hub" : "My Hub"}
        </button>
      </div>
    </div>
  );
}

const PROFILE_TYPE_OPTIONS: { key: ProfileType; labelEn: string; labelEs: string; icon: typeof User; descEn: string; descEs: string }[] = [
  { key: "resident", labelEn: "Resident", labelEs: "Residente", icon: User, descEn: "Local community member", descEs: "Miembro de la comunidad local" },
  { key: "business", labelEn: "Business Owner", labelEs: "Dueño de Negocio", icon: Building2, descEn: "Own or manage a local business", descEs: "Propietario o gerente de un negocio local" },
  { key: "creator", labelEn: "Creator", labelEs: "Creador", icon: Palette, descEn: "Content creator, artist, or media", descEs: "Creador de contenido, artista o medios" },
  { key: "expert", labelEn: "Expert", labelEs: "Experto", icon: GraduationCap, descEn: "Professional offering expertise", descEs: "Profesional que ofrece experiencia" },
  { key: "employer", labelEn: "Employer", labelEs: "Empleador", icon: Briefcase, descEn: "Hiring and workforce", descEs: "Contratación y fuerza laboral" },
  { key: "organization", labelEn: "Organization", labelEs: "Organización", icon: Landmark, descEn: "Nonprofit, civic, or community group", descEs: "Organización sin fines de lucro o cívica" },
];

function ProfileTypeSelector({ locale }: { locale: string }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const currentTypes: ProfileType[] = user?.profileTypes || ["resident"];
  const currentActive: ProfileType = user?.activeProfileType || currentTypes[0] || "resident";
  const [selected, setSelected] = useState<ProfileType[]>(currentTypes);
  const [activeType, setActiveType] = useState<ProfileType>(currentActive);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setSelected(user?.profileTypes || ["resident"]);
    setActiveType(user?.activeProfileType || (user?.profileTypes || ["resident"])[0] || "resident");
    setDirty(false);
  }, [user?.profileTypes, user?.activeProfileType]);

  const handleTypeClick = (pt: ProfileType) => {
    if (selected.includes(pt)) {
      if (activeType === pt) {
        setSelected((prev) => {
          const next = prev.filter((t) => t !== pt);
          if (next.length === 0) return prev;
          setDirty(true);
          setActiveType(next[0]);
          return next;
        });
      } else {
        setActiveType(pt);
        setDirty(true);
      }
    } else {
      setSelected((prev) => {
        const next = [...prev, pt];
        setDirty(true);
        return next;
      });
    }
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("PUT", "/api/auth/profile-types", { profileTypes: selected, activeProfileType: activeType });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      setDirty(false);
      toast({ title: locale === "es" ? "Tipos de perfil actualizados" : "Profile types updated" });
    },
    onError: () => {
      toast({ title: locale === "es" ? "Error al guardar" : "Failed to save", variant: "destructive" });
    },
  });

  return (
    <div className="rounded-md border border-white/10 bg-white/5 p-4 space-y-3" data-testid="section-profile-types">
      <div className="flex items-center gap-2">
        <Users className="h-4 w-4 text-purple-400" />
        <p className="text-sm font-medium text-white">
          {locale === "es" ? "Tipos de Participación" : "Participation Types"}
        </p>
      </div>
      <p className="text-xs text-white/40">
        {locale === "es"
          ? "Selecciona cómo participas en la plataforma. Puedes elegir varios. Toca un tipo seleccionado para hacerlo activo."
          : "Select how you participate on the platform. You can choose multiple. Tap a selected type to make it active."}
      </p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {PROFILE_TYPE_OPTIONS.map((opt) => {
          const Icon = opt.icon;
          const isSelected = selected.includes(opt.key);
          const isActive = activeType === opt.key && isSelected;
          return (
            <button
              key={opt.key}
              onClick={() => handleTypeClick(opt.key)}
              className={`flex items-start gap-3 rounded-md border p-3 text-left transition-colors ${
                isActive
                  ? "border-purple-400 bg-purple-500/25 ring-1 ring-purple-400/40"
                  : isSelected
                    ? "border-purple-500/50 bg-purple-500/15"
                    : "border-white/10 bg-white/5"
              }`}
              data-testid={`toggle-profile-type-${opt.key}`}
            >
              <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${isActive ? "bg-purple-400/40" : isSelected ? "bg-purple-500/30" : "bg-white/10"}`}>
                <Icon className={`h-4 w-4 ${isActive ? "text-purple-200" : isSelected ? "text-purple-300" : "text-white/40"}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className={`text-sm font-medium ${isSelected ? "text-white" : "text-white/60"}`}>
                    {locale === "es" ? opt.labelEs : opt.labelEn}
                  </p>
                  {isActive && (
                    <span className="rounded bg-purple-500/30 px-1.5 py-0.5 text-[10px] font-medium text-purple-200" data-testid={`badge-active-type-${opt.key}`}>
                      {locale === "es" ? "ACTIVO" : "ACTIVE"}
                    </span>
                  )}
                </div>
                <p className="text-xs text-white/30">
                  {locale === "es" ? opt.descEs : opt.descEn}
                </p>
              </div>
              {isSelected && <Check className="h-4 w-4 text-purple-400 shrink-0 mt-1" />}
            </button>
          );
        })}
      </div>
      {dirty && (
        <Button
          size="sm"
          className="gap-2 bg-purple-600 border-purple-500 text-white"
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          data-testid="button-save-profile-types"
        >
          {saveMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {locale === "es" ? "Guardar" : "Save"}
        </Button>
      )}
    </div>
  );
}

export default function SubscriberProfile({ citySlug }: { citySlug: string }) {
  const { user, isLoggedIn, isLoading: authLoading, logout, activeHub } = useAuth();
  const { locale } = useI18n();

  if (authLoading) {
    return (
      <DarkPageShell>
        <div className="space-y-4 max-w-2xl mx-auto" data-testid="subscriber-profile-loading">
          <Skeleton className="h-24 w-full rounded-md bg-white/10" />
          <Skeleton className="h-8 w-48 bg-white/10" />
          <Skeleton className="h-64 w-full rounded-md bg-white/10" />
        </div>
      </DarkPageShell>
    );
  }

  if (!isLoggedIn || !user) {
    return (
      <DarkPageShell title={locale === "es" ? "Tu Perfil" : "Your Profile"}>
        <AnonymousPrompt citySlug={citySlug} />
      </DarkPageShell>
    );
  }

  const initials = (user.displayName || user.email)
    .split(/[\s@]/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const homeHub = user.hubs?.find((h) => h.hubType === "HOME");
  const savedHubName = homeHub?.neighborhood || homeHub?.city || localStorage.getItem("hub_home") || null;

  return (
    <DarkPageShell>
      <div className="space-y-6 max-w-2xl mx-auto" data-testid="subscriber-profile">
        <div className="rounded-md border border-white/10 bg-white/5 p-5" data-testid="card-profile-header">
          <div className="flex items-start gap-4 flex-wrap">
            <Avatar className="h-14 w-14">
              <AvatarFallback className="text-base font-bold bg-purple-500/20 text-purple-400">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-bold text-white flex items-center gap-2" data-testid="text-profile-name">
                {user.displayName || user.email}
                {(user as any).isVerifiedContributor && <VerifiedBadge tier={(user as any).verificationTier} />}
              </h1>
              <p className="text-sm text-white/50">{user.email}</p>
              <div className="mt-2 flex items-center gap-2 flex-wrap">
                {savedHubName && (
                  <Badge variant="outline" className="border-white/20 text-white/70" data-testid="badge-home-hub">
                    <MapPin className="h-3 w-3 mr-1" />
                    {savedHubName}
                  </Badge>
                )}
                {user.isAdmin && (
                  <Badge variant="secondary" className="bg-purple-500/20 text-purple-300" data-testid="badge-admin">
                    <Shield className="h-3 w-3 mr-1" />
                    Admin
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>

        {!(user as any).isVerifiedContributor && <VerificationCTA compact />}

        <Tabs defaultValue="saved" data-testid="tabs-profile">
          <TabsList className="w-full justify-start flex-wrap gap-1 bg-white/5 border border-white/10">
            <TabsTrigger value="saved" className="gap-1 text-white/60 data-[state=active]:text-white data-[state=active]:bg-white/10" data-testid="tab-saved">
              <Bookmark className="h-3.5 w-3.5" />
              {locale === "es" ? "Guardados" : "Saved"}
            </TabsTrigger>
            <TabsTrigger value="preferences" className="gap-1 text-white/60 data-[state=active]:text-white data-[state=active]:bg-white/10" data-testid="tab-preferences">
              <Heart className="h-3.5 w-3.5" />
              {locale === "es" ? "Preferencias" : "Preferences"}
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-1 text-white/60 data-[state=active]:text-white data-[state=active]:bg-white/10" data-testid="tab-settings">
              <Settings className="h-3.5 w-3.5" />
              {locale === "es" ? "Configuración" : "Settings"}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="saved" className="mt-4" data-testid="section-saved-items">
            <SavedItemsSection citySlug={citySlug} />
          </TabsContent>

          <TabsContent value="preferences" className="mt-4 space-y-6" data-testid="section-preferences">
            <TopicPreferences locale={locale} />
            <NotificationPreferences locale={locale} />
          </TabsContent>

          <TabsContent value="settings" className="mt-4 space-y-4" data-testid="section-settings">
            <ProfileTypeSelector locale={locale} />
            <LandingPreference locale={locale} />

            {savedHubName && (
              <div className="rounded-md border border-white/10 bg-white/5 p-4" data-testid="card-home-hub-info">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-md shrink-0 bg-purple-500/20">
                    <MapPin className="h-4 w-4 text-purple-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white">{locale === "es" ? "Mi Hub" : "Home Hub"}</p>
                    <p className="text-sm text-white/50">{savedHubName}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-white/30 shrink-0" />
                </div>
              </div>
            )}

            <Link href={`/${citySlug}/link-hub/settings`}>
              <div className="rounded-md border border-white/10 bg-white/5 p-4 hover-elevate cursor-pointer" data-testid="link-my-link-page">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-md shrink-0 bg-purple-500/20">
                    <LinkIcon className="h-4 w-4 text-purple-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white">{locale === "es" ? "Mi Página de Enlaces" : "My Link Page"}</p>
                    <p className="text-xs text-white/40">
                      {locale === "es" ? "Gestiona tu página de enlaces personales" : "Manage your personal link page"}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-white/30 shrink-0" />
                </div>
              </div>
            </Link>

            <Link href={`/${citySlug}/account/security`}>
              <div className="rounded-md border border-white/10 bg-white/5 p-4 hover-elevate cursor-pointer" data-testid="link-account-security">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-md shrink-0 bg-white/10">
                    <Shield className="h-4 w-4 text-white/50" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white">{locale === "es" ? "Seguridad de la cuenta" : "Account Security"}</p>
                    <p className="text-xs text-white/40">
                      {locale === "es" ? "Contraseña y configuración de seguridad" : "Password and security settings"}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-white/30 shrink-0" />
                </div>
              </div>
            </Link>

            <Button
              variant="outline"
              className="w-full gap-2 border-white/20 text-white"
              onClick={logout}
              data-testid="button-logout"
            >
              <LogOut className="h-4 w-4" />
              {locale === "es" ? "Cerrar Sesión" : "Log Out"}
            </Button>
          </TabsContent>
        </Tabs>
      </div>
    </DarkPageShell>
  );
}
