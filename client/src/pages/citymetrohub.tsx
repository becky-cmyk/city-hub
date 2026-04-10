import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { usePageMeta } from "@/hooks/use-page-meta";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Link } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Globe, Building2, MapPin, Calendar, Sparkles,
  DollarSign, FileText, Users, ArrowRight, Store,
  Layers, Bot, BarChart3, Palette, Languages, Shield,
  ChevronRight, ExternalLink, Mail, Loader2, CheckCircle,
  Phone
} from "lucide-react";

interface CmsPageData {
  id: string;
  titleEn: string;
  titleEs?: string;
  bodyEn: string;
  bodyEs?: string;
  excerptEn?: string;
  excerptEs?: string;
  status: string;
}

const FEATURES = [
  {
    icon: Store,
    titleEn: "Commerce Hub",
    titleEs: "Centro de Comercio",
    descEn: "Full business directory with categories, neighborhoods, search, reviews, and verified listings. Every business gets a presence page.",
    descEs: "Directorio completo de negocios con categorías, vecindarios, búsqueda, reseñas y listados verificados.",
    color: "hsl(174 62% 44%)",
  },
  {
    icon: MapPin,
    titleEn: "Neighborhoods",
    titleEs: "Vecindarios",
    descEn: "Every neighborhood gets its own hub page with local businesses, events, and community content. Block-by-block discovery.",
    descEs: "Cada vecindario tiene su propia página con negocios locales, eventos y contenido comunitario.",
    color: "hsl(152 72% 50%)",
  },
  {
    icon: Calendar,
    titleEn: "Events Engine",
    titleEs: "Motor de Eventos",
    descEn: "Community-submitted events, weekend roundups, featured listings, and neighborhood-level event feeds. Built for discovery.",
    descEs: "Eventos enviados por la comunidad, resúmenes de fin de semana y feeds de eventos por vecindario.",
    color: "hsl(14 77% 54%)",
  },
  {
    icon: Bot,
    titleEn: "AI City Guide",
    titleEs: "Guía IA de la Ciudad",
    descEn: "A branded AI assistant that knows the city. Helps visitors discover businesses, navigate the hub, and learn about neighborhoods.",
    descEs: "Un asistente de IA que conoce la ciudad. Ayuda a descubrir negocios y navegar el hub.",
    color: "hsl(273 66% 34%)",
  },
  {
    icon: DollarSign,
    titleEn: "Monetization",
    titleEs: "Monetización",
    descEn: "Stripe-powered payments for listing upgrades, verified badges, enhanced microsites, advertising, and sponsored content.",
    descEs: "Pagos con Stripe para mejoras de listados, insignias verificadas, micrositios y publicidad.",
    color: "hsl(46 88% 57%)",
  },
  {
    icon: FileText,
    titleEn: "CMS & Pulse",
    titleEs: "CMS y Pulse",
    descEn: "Full content management system with articles, editorial calendar, media library, and community-submitted stories.",
    descEs: "Sistema completo de gestión de contenido con artículos, calendario editorial y biblioteca de medios.",
    color: "hsl(211 55% 64%)",
  },
  {
    icon: Languages,
    titleEn: "Bilingual Support",
    titleEs: "Soporte Bilingüe",
    descEn: "Built-in English and Spanish support across the entire platform. Presence pages, navigation, and the AI guide all work in both languages.",
    descEs: "Soporte integrado en inglés y español en toda la plataforma, incluidas páginas de presencia y el guía IA.",
    color: "hsl(324 85% 60%)",
  },
  {
    icon: BarChart3,
    titleEn: "Admin Dashboard",
    titleEs: "Panel de Administración",
    descEn: "CRM, analytics, review moderation, email campaigns, subscriber management, and revenue reporting. Everything you need to run a city hub.",
    descEs: "CRM, analíticas, moderación de reseñas, campañas de correo y reportes de ingresos.",
    color: "hsl(0 0% 50%)",
  },
];

const STEPS = [
  {
    num: "01",
    titleEn: "Apply for Your City",
    titleEs: "Solicita Tu Ciudad",
    descEn: "Tell us which city you want to launch. We'll review the market opportunity and get you set up.",
    descEs: "Dinos qué ciudad quieres lanzar. Revisaremos la oportunidad y te ayudaremos a comenzar.",
    icon: Globe,
  },
  {
    num: "02",
    titleEn: "We Build Your Hub",
    titleEs: "Construimos Tu Hub",
    descEn: "Your city gets its own branded hub with commerce, neighborhoods, events, CMS, AI guide, and admin tools — ready to launch.",
    descEs: "Tu ciudad obtiene su propio hub con comercio, vecindarios, eventos, CMS, guía IA y herramientas de administración.",
    icon: Layers,
  },
  {
    num: "03",
    titleEn: "Launch & Grow",
    titleEs: "Lanza y Crece",
    descEn: "Start onboarding businesses, publishing content, and monetizing. We provide ongoing platform updates and support.",
    descEs: "Comienza a incorporar negocios, publicar contenido y monetizar. Proporcionamos actualizaciones y soporte continuo.",
    icon: ArrowRight,
  },
];

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
  "VA","WA","WV","WI","WY","DC","PR",
];

function StartCityForm({ lang }: { lang: "en" | "es" }) {
  const isEs = lang === "es";
  const { toast } = useToast();
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    cityName: "",
    stateCode: "",
    message: "",
  });

  const mutation = useMutation({
    mutationFn: async (data: typeof form) => {
      const res = await apiRequest("POST", "/api/public/start-city", data);
      return res.json();
    },
    onSuccess: () => {
      setSubmitted(true);
    },
    onError: (err: any) => {
      toast({
        title: isEs ? "Error" : "Error",
        description: err.message || (isEs ? "Algo salió mal. Inténtalo de nuevo." : "Something went wrong. Please try again."),
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.fullName || !form.email || !form.cityName || !form.stateCode) {
      toast({
        title: isEs ? "Campos requeridos" : "Required fields",
        description: isEs ? "Completa todos los campos obligatorios." : "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }
    mutation.mutate(form);
  };

  if (submitted) {
    return (
      <div className="mt-14">
        <Card className="mx-auto max-w-lg p-8 text-center" data-testid="card-apply-success">
          <CheckCircle className="h-12 w-12 mx-auto mb-4" style={{ color: "hsl(152 72% 50%)" }} />
          <h3 className="text-xl font-bold mb-2" data-testid="text-success-title">
            {isEs ? "¡Solicitud Recibida!" : "Application Received!"}
          </h3>
          <p className="text-sm text-muted-foreground leading-relaxed mb-4">
            {isEs
              ? "Revisaremos la oportunidad de mercado para tu ciudad y te contactaremos pronto."
              : "We'll review the market opportunity for your city and be in touch soon."}
          </p>
          <p className="text-xs text-muted-foreground">
            {isEs ? "¿Preguntas? Escríbenos a " : "Questions? Reach us at "}
            <a href="mailto:hello@citymetrohub.com" className="underline">hello@citymetrohub.com</a>
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="mt-14">
      <Card className="mx-auto max-w-2xl p-8" data-testid="card-start-city-form">
        <div className="text-center mb-6">
          <Palette className="h-8 w-8 mx-auto mb-3" style={{ color: "hsl(273 66% 34%)" }} />
          <h3 className="text-xl font-bold mb-1" data-testid="text-form-title">
            {isEs ? "¿Listo para Lanzar?" : "Ready to Launch?"}
          </h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {isEs
              ? "Cuéntanos sobre tu ciudad. Evaluaremos la oportunidad y te contactaremos."
              : "Tell us about your city. We'll evaluate the opportunity and get in touch."}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="fullName" className="text-sm font-medium">
                {isEs ? "Nombre Completo" : "Full Name"} *
              </Label>
              <Input
                id="fullName"
                value={form.fullName}
                onChange={(e) => setForm(f => ({ ...f, fullName: e.target.value }))}
                placeholder={isEs ? "Tu nombre" : "Your name"}
                data-testid="input-full-name"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-sm font-medium">
                {isEs ? "Correo Electrónico" : "Email"} *
              </Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder={isEs ? "tu@correo.com" : "you@email.com"}
                data-testid="input-email"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="phone" className="text-sm font-medium">
              {isEs ? "Teléfono (Opcional)" : "Phone (Optional)"}
            </Label>
            <Input
              id="phone"
              type="tel"
              value={form.phone}
              onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))}
              placeholder="(555) 123-4567"
              data-testid="input-phone"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="cityName" className="text-sm font-medium">
                {isEs ? "Ciudad / Área Metro" : "City / Metro Area"} *
              </Label>
              <Input
                id="cityName"
                value={form.cityName}
                onChange={(e) => setForm(f => ({ ...f, cityName: e.target.value }))}
                placeholder={isEs ? "Ej: Atlanta" : "e.g. Atlanta"}
                data-testid="input-city-name"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="stateCode" className="text-sm font-medium">
                {isEs ? "Estado" : "State"} *
              </Label>
              <select
                id="stateCode"
                value={form.stateCode}
                onChange={(e) => setForm(f => ({ ...f, stateCode: e.target.value }))}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                data-testid="select-state"
              >
                <option value="">{isEs ? "Selecciona..." : "Select..."}</option>
                {US_STATES.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="message" className="text-sm font-medium">
              {isEs ? "Cuéntanos más (Opcional)" : "Tell us more (Optional)"}
            </Label>
            <Textarea
              id="message"
              value={form.message}
              onChange={(e) => setForm(f => ({ ...f, message: e.target.value }))}
              placeholder={isEs
                ? "¿Por qué esta ciudad? ¿Tienes experiencia en medios locales o comercio?"
                : "Why this city? Do you have experience in local media or commerce?"}
              rows={3}
              data-testid="input-message"
            />
          </div>

          <Button
            type="submit"
            size="lg"
            className="w-full gap-2 text-white"
            style={{ background: "hsl(273 66% 34%)" }}
            disabled={mutation.isPending}
            data-testid="button-submit-application"
          >
            {mutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {isEs ? "Enviando..." : "Submitting..."}
              </>
            ) : (
              <>
                <ArrowRight className="h-4 w-4" />
                {isEs ? "Enviar Solicitud" : "Submit Application"}
              </>
            )}
          </Button>

          <p className="text-xs text-center text-muted-foreground">
            {isEs
              ? "Tu información es confidencial. Solo la usamos para evaluar la oportunidad de tu ciudad."
              : "Your information is confidential. We only use it to evaluate your city's opportunity."}
          </p>
        </form>
      </Card>
    </div>
  );
}

export default function CityCorehubPage() {
  usePageMeta({
    title: "CityMetroHub — Launch a City Hub for Your Metro",
    description: "CityMetroHub is the multi-city platform powering local commerce, neighborhoods, events, and community content. Start a city hub for your metro area.",
    ogType: "website",
    keywords: "city hub, local commerce, community platform, neighborhood directory, city guide, multi-city",
  });

  const { data: cmsPage } = useQuery<CmsPageData>({
    queryKey: ["/api/cms/pages", "citymetrohub"],
    queryFn: async () => {
      const res = await fetch("/api/cms/pages/citymetrohub");
      if (!res.ok) return null;
      return res.json();
    },
  });

  const [lang, setLang] = useState<"en" | "es">("en");
  const isEs = lang === "es";

  return (
    <div className="min-h-screen bg-background text-foreground" data-testid="citymetrohub-page">
      <header
        className="sticky top-0 z-50 border-b border-white/10"
        style={{ background: "linear-gradient(135deg, hsl(273 73% 23%), hsl(273 66% 34%), hsl(273 73% 23%))" }}
      >
        <div className="mx-auto flex items-center justify-between gap-3 px-4 lg:px-8 py-2">
          <Link href="/citymetrohub">
            <span className="flex items-center gap-2 cursor-pointer" data-testid="link-citymetrohub-logo">
              <Globe className="h-6 w-6 text-white" />
              <span className="text-lg font-bold text-white tracking-tight">CityMetroHub</span>
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="text-white/80 text-xs gap-1"
              onClick={() => setLang(isEs ? "en" : "es")}
              data-testid="button-lang-toggle"
            >
              <Languages className="h-3.5 w-3.5" />
              {isEs ? "English" : "Español"}
            </Button>
            <Link href="/charlotte">
              <Button variant="outline" size="sm" className="text-white border-white/30 gap-1" data-testid="link-charlotte-hub">
                <Building2 className="h-3.5 w-3.5" />
                Charlotte Hub
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <section
        className="relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, hsl(273 73% 18%), hsl(273 66% 28%), hsl(273 73% 18%))" }}
      >
        <div className="absolute inset-0 opacity-20" style={{ background: "radial-gradient(ellipse at 20% 50%, hsl(273 73% 40%) 0%, transparent 60%), radial-gradient(ellipse at 80% 30%, hsl(174 62% 44% / 0.3) 0%, transparent 50%)" }} />
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/20 to-black/50" />
        <div className="relative mx-auto max-w-7xl px-4 lg:px-8 py-20 md:py-28 text-center" data-testid="hero-section">
          <Badge variant="secondary" className="mb-6 text-xs" data-testid="badge-platform">
            <Shield className="h-3 w-3 mr-1" />
            {isEs ? "Plataforma Multi-Ciudad" : "Multi-City Platform"}
          </Badge>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-4 leading-tight" data-testid="text-hero-title">
            {isEs ? "Lanza un City Hub para Tu Metro" : "Launch a City Hub for Your Metro"}
          </h1>
          <p className="text-lg md:text-xl text-white/80 max-w-2xl mx-auto mb-8 leading-relaxed" data-testid="text-hero-subtitle">
            {isEs
              ? "CityMetroHub potencia hubs de ciudad locales — comercio, vecindarios, eventos, contenido comunitario y guías IA — todo en una plataforma."
              : "CityMetroHub powers local city hubs — commerce, neighborhoods, events, community content, and AI guides — all on one platform."}
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Button
              size="lg"
              className="gap-2 text-white"
              style={{ background: "hsl(46 88% 45%)", borderColor: "hsl(46 88% 35%)" }}
              onClick={() => document.getElementById("start-your-city")?.scrollIntoView({ behavior: "smooth" })}
              data-testid="button-hero-cta"
            >
              {isEs ? "Comienza Tu Ciudad" : "Start Your City"}
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="gap-2 text-white border-white/30 backdrop-blur-sm"
              onClick={() => document.getElementById("whats-included")?.scrollIntoView({ behavior: "smooth" })}
              data-testid="button-hero-learn"
            >
              {isEs ? "Ver Qué Incluye" : "See What's Included"}
            </Button>
          </div>
        </div>
      </section>

      <section className="py-16 md:py-20 px-4" data-testid="what-is-section">
        <div className="mx-auto max-w-7xl text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4" data-testid="text-what-is-title">
            {isEs ? "¿Qué es un City Hub?" : "What is a City Hub?"}
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed" data-testid="text-what-is-desc">
            {isEs
              ? "Un City Hub es una plataforma digital integral construida alrededor de una ciudad o área metropolitana. Conecta negocios locales, vecindarios, eventos y contenido comunitario en un solo lugar — impulsado por CityMetroHub."
              : "A City Hub is a comprehensive digital platform built around a city or metro area. It connects local businesses, neighborhoods, events, and community content in one place — powered by CityMetroHub."}
          </p>

          {cmsPage?.bodyEn && (
            <div
              className="prose prose-sm dark:prose-invert mx-auto text-left mb-10"
              dangerouslySetInnerHTML={{ __html: isEs && cmsPage.bodyEs ? cmsPage.bodyEs : cmsPage.bodyEn }}
              data-testid="cms-content-block"
            />
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              {
                icon: Building2,
                titleEn: "CLT Metro Hub",
                titleEs: "CLT Metro Hub",
                descEn: "Our flagship city — live and growing with 100+ neighborhoods, commerce listings, events, and community content.",
                descEs: "Nuestra ciudad insignia — activa y creciendo con 100+ vecindarios, listados de comercio, eventos y contenido comunitario.",
                color: "hsl(273 66% 34%)",
                active: true,
              },
              {
                icon: MapPin,
                titleEn: "Your City Next",
                titleEs: "Tu Ciudad es la Siguiente",
                descEn: "Every metro area has a community waiting to be connected. Apply to launch a hub for your city.",
                descEs: "Cada área metropolitana tiene una comunidad esperando ser conectada. Solicita lanzar un hub para tu ciudad.",
                color: "hsl(174 62% 44%)",
                active: false,
              },
              {
                icon: Globe,
                titleEn: "Multi-City Network",
                titleEs: "Red Multi-Ciudad",
                descEn: "Each city hub operates independently with its own branding, content, and monetization — all on the same proven platform.",
                descEs: "Cada hub de ciudad opera de forma independiente con su propia marca, contenido y monetización.",
                color: "hsl(46 88% 57%)",
                active: false,
              },
            ].map((item, i) => (
              <Card key={i} className="p-5 text-left" data-testid={`card-city-vision-${i}`}>
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-2 rounded-md" style={{ background: `${item.color}20` }}>
                    <item.icon className="h-5 w-5" style={{ color: item.color }} />
                  </div>
                  {item.active && (
                    <Badge variant="secondary" className="text-[10px]" data-testid="badge-live">
                      <Sparkles className="h-2.5 w-2.5 mr-0.5" />
                      Live
                    </Badge>
                  )}
                </div>
                <h3 className="font-semibold mb-1" data-testid={`text-city-title-${i}`}>{isEs ? item.titleEs : item.titleEn}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{isEs ? item.descEs : item.descEn}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section id="whats-included" className="py-16 md:py-20 px-4 bg-muted/30" data-testid="features-section">
        <div className="mx-auto max-w-7xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-3" data-testid="text-features-title">
              {isEs ? "Qué Incluye Cada City Hub" : "What's Included in Every City Hub"}
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto" data-testid="text-features-desc">
              {isEs
                ? "Todo lo que necesitas para lanzar, administrar y monetizar una plataforma comunitaria de ciudad."
                : "Everything you need to launch, manage, and monetize a city-level community platform."}
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {FEATURES.map((feature, i) => (
              <Card key={i} className="p-4 hover-elevate" data-testid={`card-feature-${i}`}>
                <div className="p-2 rounded-md inline-block mb-3" style={{ background: `${feature.color}15` }}>
                  <feature.icon className="h-5 w-5" style={{ color: feature.color }} />
                </div>
                <h3 className="font-semibold text-sm mb-1.5" data-testid={`text-feature-title-${i}`}>
                  {isEs ? feature.titleEs : feature.titleEn}
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {isEs ? feature.descEs : feature.descEn}
                </p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section id="start-your-city" className="py-16 md:py-20 px-4" data-testid="start-city-section">
        <div className="mx-auto max-w-7xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-3" data-testid="text-start-title">
              {isEs ? "Comienza Tu Ciudad" : "Start Your City"}
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto" data-testid="text-start-desc">
              {isEs
                ? "Tres pasos para lanzar un City Hub en tu área metropolitana."
                : "Three steps to launch a City Hub in your metro area."}
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {STEPS.map((step, i) => (
              <div key={i} className="text-center" data-testid={`step-${i}`}>
                <div
                  className="mx-auto w-14 h-14 rounded-full flex items-center justify-center mb-4"
                  style={{ background: "hsl(273 66% 34%)" }}
                >
                  <step.icon className="h-6 w-6 text-white" />
                </div>
                <div className="text-xs font-bold text-muted-foreground mb-1 uppercase tracking-wider">
                  {step.num}
                </div>
                <h3 className="font-semibold text-lg mb-2" data-testid={`text-step-title-${i}`}>
                  {isEs ? step.titleEs : step.titleEn}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {isEs ? step.descEs : step.descEn}
                </p>
              </div>
            ))}
          </div>

          <StartCityForm lang={lang} />
        </div>
      </section>

      <section
        className="py-12 px-4"
        style={{ background: "linear-gradient(135deg, hsl(273 73% 18%), hsl(273 66% 28%))" }}
        data-testid="live-hubs-section"
      >
        <div className="mx-auto max-w-7xl text-center">
          <h3 className="text-xl font-bold text-white mb-2" data-testid="text-live-title">
            {isEs ? "Hubs Activos" : "Live Hubs"}
          </h3>
          <p className="text-white/60 text-sm mb-6">
            {isEs ? "Mira la plataforma en acción" : "See the platform in action"}
          </p>
          <Link href="/charlotte">
            <Card className="inline-flex items-center gap-3 p-4 cursor-pointer hover-elevate overflow-visible" data-testid="card-charlotte-live">
              <div className="p-2 rounded-md" style={{ background: "hsl(273 66% 34% / 0.15)" }}>
                <Building2 className="h-5 w-5" style={{ color: "hsl(273 66% 34%)" }} />
              </div>
              <div className="text-left">
                <div className="font-semibold">CLT Metro Hub</div>
                <div className="text-xs text-muted-foreground">Charlotte, NC Metro</div>
              </div>
              <Badge variant="secondary" className="text-[10px] ml-2">
                <Sparkles className="h-2.5 w-2.5 mr-0.5" />
                Live
              </Badge>
              <ChevronRight className="h-4 w-4 text-muted-foreground ml-1" />
            </Card>
          </Link>
        </div>
      </section>

      <footer className="border-t py-8 px-4" data-testid="citymetrohub-footer">
        <div className="mx-auto max-w-7xl flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-muted-foreground" />
            <span className="font-semibold text-sm">CityMetroHub</span>
          </div>
          <p className="text-xs text-muted-foreground text-center">
            {isEs
              ? "© 2026 CityMetroHub. Todos los derechos reservados. Impulsando plataformas de ciudad en todo el país."
              : "© 2026 CityMetroHub. All rights reserved. Powering city-level community platforms nationwide."}
          </p>
          <a
            href="mailto:hello@citymetrohub.com"
            className="text-xs text-muted-foreground hover:underline"
            data-testid="link-footer-email"
          >
            hello@citymetrohub.com
          </a>
        </div>
      </footer>
    </div>
  );
}
