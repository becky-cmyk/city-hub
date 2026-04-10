import { db } from "./db";
import { cmsContentItems, cities } from "@shared/schema";
import { eq, and } from "drizzle-orm";

async function seedCityMetroHubPage() {
  const [existing] = await db.select().from(cmsContentItems).where(
    and(eq(cmsContentItems.contentType, "page"), eq(cmsContentItems.slug, "citymetrohub"))
  ).limit(1);

  if (existing) {
    console.log("CityMetro Hub CMS page already exists, skipping seed.");
    return;
  }

  const [charlotte] = await db.select().from(cities).where(eq(cities.slug, "charlotte")).limit(1);
  if (!charlotte) {
    console.log("Charlotte city not found, cannot seed CityMetro Hub page.");
    return;
  }

  await db.insert(cmsContentItems).values({
    contentType: "page",
    titleEn: "City Metro Hub — Build Your City's Digital Hub",
    titleEs: "City Metro Hub — Construye el Centro Digital de tu Ciudad",
    slug: "citymetrohub",
    excerptEn: "CityMetro Hub is a multi-city platform empowering communities through locally-focused digital hubs. Start your own city hub today.",
    excerptEs: "CityMetro Hub es una plataforma multi-ciudad que empodera a las comunidades a través de centros digitales enfocados localmente.",
    bodyEn: `<h2>What is CityMetro Hub?</h2>
<p>CityMetro Hub is a next-generation platform that creates vibrant, locally-focused digital hubs for cities across the country. Each hub serves as the go-to destination for residents to discover local businesses, events, stories, and community connections — all organized by the neighborhoods they love.</p>

<h2>Our Vision</h2>
<p>We believe every city deserves a dedicated digital home — not a generic directory, but a living, breathing community hub that reflects the unique character of each neighborhood. CityMetro Hub puts neighborhoods first, connecting residents with the businesses, events, and stories that make their community special.</p>

<h2>What's Included in Every Hub</h2>
<ul>
<li><strong>Commerce Hub</strong> — A powerful business directory organized by neighborhoods, with tiered listings that help businesses stand out and get discovered.</li>
<li><strong>Neighborhood Microsites</strong> — Every neighborhood gets its own mini-hub with curated businesses, events, and stories specific to that area.</li>
<li><strong>Events Calendar</strong> — Local events organized by neighborhood and category, from farmers markets to live music to community meetings.</li>
<li><strong>Community Stories</strong> — Local journalism, press releases, shout-outs, and media mentions that keep residents informed and connected.</li>
<li><strong>AI City Guide</strong> — An intelligent assistant that helps residents discover what's happening in their city and find exactly what they need.</li>
<li><strong>Business Monetization</strong> — Built-in revenue through tiered listings, verified business presence, and premium placement options.</li>
<li><strong>Full CMS</strong> — A complete content management system to publish articles, manage events, curate lists, and keep the hub fresh.</li>
<li><strong>CRM & Outreach</strong> — Tools to manage business relationships, send email campaigns, and track community engagement.</li>
</ul>

<h2>Start Your City</h2>
<p>Are you passionate about your city? CityMetro Hub is looking for motivated individuals to launch and operate their own city hubs. This is a true business-in-a-box opportunity — we provide the platform, technology, and support. You bring the local knowledge and hustle.</p>

<h3>What You Get</h3>
<ul>
<li>A fully built, ready-to-launch city hub platform</li>
<li>Admin dashboard with complete CMS, CRM, and analytics</li>
<li>AI-powered content and business management tools</li>
<li>Monetization infrastructure (Stripe integration, tiered listings)</li>
<li>SEO-optimized for your city's local search</li>
<li>Bilingual support (English/Spanish)</li>
<li>Ongoing platform updates and new features</li>
<li>Training and community of hub operators</li>
</ul>

<h3>Who We're Looking For</h3>
<p>We're seeking community-minded entrepreneurs who know their city inside and out. Whether you're a local business owner, community organizer, journalist, or just someone who loves where they live — if you're ready to build something meaningful for your community, we want to hear from you.</p>

<h2>Contact Us</h2>
<p>Ready to bring CityMetro Hub to your city? Reach out to us at <strong>hello@citymetrohub.com</strong> to learn more about launching your own hub.</p>`,
    bodyEs: `<h2>¿Qué es CityMetro Hub?</h2>
<p>CityMetro Hub es una plataforma de próxima generación que crea centros digitales vibrantes y enfocados localmente para ciudades de todo el país. Cada centro sirve como el destino principal para que los residentes descubran negocios locales, eventos, historias y conexiones comunitarias — todo organizado por los vecindarios que aman.</p>

<h2>Nuestra Visión</h2>
<p>Creemos que cada ciudad merece un hogar digital dedicado — no un directorio genérico, sino un centro comunitario vivo que refleje el carácter único de cada vecindario. CityMetro Hub pone los vecindarios primero, conectando a los residentes con los negocios, eventos e historias que hacen especial a su comunidad.</p>

<h2>Qué Incluye Cada Hub</h2>
<ul>
<li><strong>Hub de Comercio</strong> — Un poderoso directorio de negocios organizado por vecindarios, con listados escalonados que ayudan a los negocios a destacarse.</li>
<li><strong>Micrositios de Vecindarios</strong> — Cada vecindario tiene su propio mini-hub con negocios, eventos e historias específicas de esa área.</li>
<li><strong>Calendario de Eventos</strong> — Eventos locales organizados por vecindario y categoría.</li>
<li><strong>Historias Comunitarias</strong> — Periodismo local, comunicados de prensa y menciones que mantienen informados a los residentes.</li>
<li><strong>Guía de Ciudad con IA</strong> — Un asistente inteligente que ayuda a los residentes a descubrir lo que está pasando en su ciudad.</li>
<li><strong>Monetización para Negocios</strong> — Ingresos integrados a través de listados escalonados y opciones de colocación premium.</li>
<li><strong>CMS Completo</strong> — Un sistema completo de gestión de contenido para publicar artículos, gestionar eventos y curar listas.</li>
<li><strong>CRM y Alcance</strong> — Herramientas para gestionar relaciones comerciales y enviar campañas de correo electrónico.</li>
</ul>

<h2>Inicia Tu Ciudad</h2>
<p>¿Te apasiona tu ciudad? CityMetro Hub busca personas motivadas para lanzar y operar sus propios hubs de ciudad. Esta es una verdadera oportunidad de negocio llave en mano.</p>

<h2>Contáctanos</h2>
<p>¿Listo para traer CityMetro Hub a tu ciudad? Escríbenos a <strong>hello@citymetrohub.com</strong> para saber más sobre cómo lanzar tu propio hub.</p>`,
    status: "published",
    publishedAt: new Date(),
    cityId: charlotte.id,
    languagePrimary: "en",
    seoTitleEn: "CityMetro Hub — Build Your City's Digital Hub | Multi-City Community Platform",
    seoTitleEs: "CityMetro Hub — Construye el Centro Digital de tu Ciudad",
    seoDescriptionEn: "CityMetro Hub creates vibrant, locally-focused digital hubs for cities. Discover businesses, events, and stories organized by neighborhood. Start your own city hub today.",
    seoDescriptionEs: "CityMetro Hub crea centros digitales vibrantes para ciudades. Descubre negocios, eventos e historias organizadas por vecindario.",
    visibility: "public",
  });

  console.log("CityMetro Hub CMS page seeded successfully.");
}

seedCityMetroHubPage().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
