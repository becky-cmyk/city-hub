import { db } from "./db";
import { tvItems, tvLoops, tvLoopItems, tvSchedules, tvHostPhrases, tvPlacements } from "@shared/schema";
import { eq, sql } from "drizzle-orm";
import { storage } from "./storage";

export async function seedTvContent() {
  console.log("[SEED] Seeding TV content (enhanced v2)...");
  await seedTvLoopsAndSchedules();
}

async function seedTvLoopsAndSchedules() {
  const existingLoops = await db.select().from(tvLoops).limit(1);
  if (existingLoops.length > 0) {
    console.log("[SEED] TV loops exist — dropping and recreating (idempotent dev seed)...");
    await db.delete(tvLoopItems);
    await db.delete(tvSchedules);
    await db.delete(tvHostPhrases);
    await db.delete(tvPlacements);
    await db.delete(tvLoops);
    await db.delete(tvItems);
  }

  console.log("[SEED] Creating rich TV content items, loops, schedules, phrases, placements...");

  const today = new Date();
  const tonightTime = new Date(today);
  tonightTime.setHours(19, 0, 0, 0);

  const items: Record<string, any> = {};

  items.pulse_headline_1 = await storage.createTvItem({
    title: "Charlotte Pulse: What's New This Week",
    type: "slide",
    sourceScope: "metro",
    templateKey: "pulse_headline",
    priority: 6,
    enabled: true,
    durationSec: 10,
    contentFamily: "local_pulse",
    data: {
      headline: "Charlotte Pulse",
      headlineEs: "Pulso de Charlotte",
      subline: "What's new in the Queen City this week",
      sublineEs: "Qué hay de nuevo en la Queen City esta semana",
      items: [
        { text: "South End rail extension breaks ground", tag: "Development" },
        { text: "NoDa gallery walk returns Friday", tag: "Arts" },
        { text: "New food hall announced for Camp North End", tag: "Food" },
      ],
    },
    tags: ["pulse", "news"],
    daypartSlots: [],
    categoryIds: [],
    isPaid: false,
  } as any);

  items.pulse_headline_2 = await storage.createTvItem({
    title: "Charlotte Pulse: Local Business Wins",
    type: "slide",
    sourceScope: "metro",
    templateKey: "pulse_headline",
    priority: 6,
    enabled: true,
    durationSec: 10,
    contentFamily: "local_pulse",
    data: {
      headline: "Local Business Wins",
      headlineEs: "Logros de Negocios Locales",
      subline: "Good news from Charlotte entrepreneurs",
      sublineEs: "Buenas noticias de emprendedores de Charlotte",
      items: [
        { text: "Plaza Midwood bakery named Best in NC", tag: "Award" },
        { text: "CLT startup raises $2M seed round", tag: "Tech" },
        { text: "Dilworth coffee shop celebrates 10 years", tag: "Milestone" },
      ],
    },
    tags: ["pulse", "business"],
    daypartSlots: [],
    categoryIds: [],
    isPaid: false,
  } as any);

  items.neighborhood_spotlight_1 = await storage.createTvItem({
    title: "Neighborhood Spotlight: South End",
    type: "slide",
    sourceScope: "metro",
    templateKey: "neighborhood_spotlight",
    priority: 6,
    enabled: true,
    durationSec: 15,
    contentFamily: "local_pulse",
    contentType: "narrated_segment",
    narrationText: "Welcome to Charlotte Hub Screens, your window into the Queen City. From the best local eats to tonight's events, we keep you connected to everything happening in your neighborhood.",
    narrationEnabled: true,
    voiceProfile: "warm_local_host",
    data: {
      headline: "South End Spotlight",
      headlineEs: "Enfoque en South End",
      subline: "Charlotte's fastest-growing neighborhood",
      sublineEs: "El vecindario de más rápido crecimiento de Charlotte",
      description: "From breweries to boutiques, South End has become Charlotte's most walkable district.",
      descriptionEs: "De cervecerías a boutiques, South End se ha convertido en el distrito más caminable de Charlotte.",
    },
    assetUrl: "/assets/stock_images/feed_community_1.jpg",
    tags: ["neighborhood", "south-end"],
    daypartSlots: [],
    categoryIds: [],
    isPaid: false,
  } as any);

  items.neighborhood_spotlight_2 = await storage.createTvItem({
    title: "Neighborhood Spotlight: NoDa Arts District",
    type: "slide",
    sourceScope: "metro",
    templateKey: "neighborhood_spotlight",
    priority: 6,
    enabled: true,
    durationSec: 15,
    contentFamily: "neighborhood_favorite",
    contentType: "narrated_segment",
    narrationText: "NoDa is Charlotte's creative heart. From the monthly gallery crawl to live music seven nights a week, this arts district is where Charlotte's creative community comes alive.",
    narrationEnabled: true,
    voiceProfile: "warm_local_host",
    data: {
      headline: "NoDa Arts District",
      headlineEs: "Distrito Artístico NoDa",
      subline: "Charlotte's creative heart",
      sublineEs: "El corazón creativo de Charlotte",
      description: "NoDa hosts the famous First Friday gallery crawl and over a dozen live music venues.",
      descriptionEs: "NoDa alberga el famoso paseo de galerías del Primer Viernes y más de una docena de locales de música en vivo.",
    },
    assetUrl: "/assets/stock_images/feed_arts-culture_1.jpg",
    tags: ["neighborhood", "noda"],
    daypartSlots: [],
    categoryIds: [],
    isPaid: false,
  } as any);

  items.support_local_1 = await storage.createTvItem({
    title: "Support Local: Shop Charlotte",
    type: "slide",
    sourceScope: "metro",
    templateKey: "support_local_spotlight",
    priority: 6,
    enabled: true,
    durationSec: 12,
    contentFamily: "support_local",
    contentType: "support_local",
    narrationText: "Every dollar you spend at a local business stays right here in Charlotte. From family-owned restaurants to neighborhood boutiques, shopping local builds a stronger community for all of us.",
    narrationEnabled: true,
    voiceProfile: "warm_local_host",
    data: {
      headline: "Support Local Charlotte",
      headlineEs: "Apoya lo Local en Charlotte",
      description: "Every purchase makes a difference in your neighborhood.",
      descriptionEs: "Cada compra hace la diferencia en tu vecindario.",
      accentColor: "#10b981",
    },
    assetUrl: "/assets/stock_images/feed_shopping-retail_1.jpg",
    tags: ["support-local"],
    daypartSlots: [],
    categoryIds: [],
    isPaid: false,
  } as any);

  items.support_local_2 = await storage.createTvItem({
    title: "Support Local: Dine Charlotte",
    type: "slide",
    sourceScope: "metro",
    templateKey: "support_local_spotlight",
    priority: 6,
    enabled: true,
    durationSec: 12,
    contentFamily: "support_local",
    contentType: "support_local",
    narrationText: "Charlotte's restaurant scene is driven by passionate local chefs and family-owned kitchens. When you dine local, you're tasting the real Charlotte and keeping our food culture thriving.",
    narrationEnabled: true,
    voiceProfile: "warm_local_host",
    data: {
      headline: "Dine Local Charlotte",
      headlineEs: "Come Local en Charlotte",
      description: "Charlotte's food scene is powered by local passion.",
      descriptionEs: "La escena gastronómica de Charlotte es impulsada por la pasión local.",
      accentColor: "#f59e0b",
    },
    assetUrl: "/assets/stock_images/feed_food-dining_1.jpg",
    tags: ["support-local", "food"],
    daypartSlots: [],
    categoryIds: [],
    isPaid: false,
  } as any);

  items.trivia_1 = await storage.createTvItem({
    title: "Charlotte Trivia: Founding Year",
    type: "slide",
    sourceScope: "metro",
    templateKey: "trivia_question",
    priority: 6,
    enabled: true,
    durationSec: 12,
    contentFamily: "info_now",
    data: {
      question: "What year was Charlotte founded?",
      questionEs: "¿En qué año fue fundada Charlotte?",
      answers: ["1755", "1768", "1782", "1799"],
      correctIndex: 1,
      funFact: "Charlotte was named after Queen Charlotte of Mecklenburg-Strelitz, wife of King George III.",
      category: "History",
    },
    tags: ["trivia", "history"],
    daypartSlots: [],
    categoryIds: [],
    isPaid: false,
  } as any);

  items.trivia_2 = await storage.createTvItem({
    title: "Charlotte Trivia: Art Galleries Neighborhood",
    type: "slide",
    sourceScope: "metro",
    templateKey: "trivia_question",
    priority: 6,
    enabled: true,
    durationSec: 12,
    contentFamily: "info_now",
    data: {
      question: "Which Charlotte neighborhood is known for its art galleries and live music?",
      questionEs: "¿Qué vecindario de Charlotte es conocido por sus galerías de arte y música en vivo?",
      answers: ["Dilworth", "NoDa", "Myers Park", "South End"],
      correctIndex: 1,
      funFact: "NoDa stands for North Davidson and hosts the famous First Friday gallery crawl every month.",
      category: "Local Knowledge",
    },
    tags: ["trivia", "neighborhoods"],
    daypartSlots: [],
    categoryIds: [],
    isPaid: false,
  } as any);

  items.trivia_3 = await storage.createTvItem({
    title: "Charlotte Trivia: BBQ Style",
    type: "slide",
    sourceScope: "metro",
    templateKey: "trivia_question",
    priority: 6,
    enabled: true,
    durationSec: 12,
    contentFamily: "info_now",
    data: {
      question: "What is Charlotte's signature BBQ style?",
      questionEs: "¿Cuál es el estilo de BBQ distintivo de Charlotte?",
      answers: ["Kansas City-style", "Texas-style", "Lexington-style", "Memphis-style"],
      correctIndex: 2,
      funFact: "Lexington-style BBQ uses a tomato-vinegar 'dip' sauce and is also called Piedmont-style.",
      category: "Food",
    },
    tags: ["trivia", "food"],
    daypartSlots: [],
    categoryIds: [],
    isPaid: false,
  } as any);

  items.trivia_4 = await storage.createTvItem({
    title: "Charlotte Trivia: Bank of America Stadium",
    type: "slide",
    sourceScope: "metro",
    templateKey: "trivia_question",
    priority: 6,
    enabled: true,
    durationSec: 12,
    contentFamily: "info_now",
    data: {
      question: "Which Charlotte sports team plays at Bank of America Stadium?",
      questionEs: "¿Qué equipo deportivo de Charlotte juega en el Bank of America Stadium?",
      answers: ["Charlotte Hornets", "Charlotte FC", "Carolina Panthers", "Charlotte Knights"],
      correctIndex: 2,
      funFact: "Bank of America Stadium opened in 1996 and seats over 74,000 fans in Uptown Charlotte.",
      category: "Sports",
    },
    tags: ["trivia", "sports"],
    daypartSlots: [],
    categoryIds: [],
    isPaid: false,
  } as any);

  items.trivia_5 = await storage.createTvItem({
    title: "Charlotte Trivia: Lake Norman",
    type: "slide",
    sourceScope: "metro",
    templateKey: "trivia_question",
    priority: 6,
    enabled: true,
    durationSec: 12,
    contentFamily: "info_now",
    data: {
      question: "Lake Norman is the largest man-made lake in which state?",
      questionEs: "¿Lake Norman es el lago artificial más grande de qué estado?",
      answers: ["South Carolina", "Virginia", "North Carolina", "Georgia"],
      correctIndex: 2,
      funFact: "Lake Norman covers over 32,510 acres and has more than 520 miles of shoreline.",
      category: "Geography",
    },
    tags: ["trivia", "geography"],
    daypartSlots: [],
    categoryIds: [],
    isPaid: false,
  } as any);

  items.social_proof_1 = await storage.createTvItem({
    title: "Social: CLT Foodie South End",
    type: "slide",
    sourceScope: "metro",
    templateKey: "social_proof",
    priority: 5,
    enabled: true,
    durationSec: 10,
    contentFamily: "local_pulse",
    hubSlug: "south-end",
    data: {
      platform: "tiktok",
      username: "clt.foodie",
      caption: "South End's restaurant scene is absolutely unreal right now. New spots opening every week and the food hall vibes are next level.",
      captionEs: "La escena de restaurantes de South End es increíble. Nuevos locales abriendo cada semana y la onda del food hall está en otro nivel.",
      likes: 12400,
      views: 89000,
      postUrl: "https://www.tiktok.com/@clt.foodie",
    },
    assetUrl: "/assets/stock_images/feed_food-dining_1.jpg",
    tags: ["social", "food", "south-end"],
    daypartSlots: [],
    categoryIds: [],
    isPaid: false,
  } as any);

  items.social_proof_2 = await storage.createTvItem({
    title: "Social: ExploreCLT NoDa First Friday",
    type: "slide",
    sourceScope: "metro",
    templateKey: "social_proof",
    priority: 5,
    enabled: true,
    durationSec: 10,
    contentFamily: "local_pulse",
    hubSlug: "noda",
    data: {
      platform: "instagram",
      username: "exploreclt",
      caption: "First Friday in NoDa never disappoints! Live music, local art, and the best street food in Charlotte. Mark your calendars for next month.",
      captionEs: "El Primer Viernes en NoDa nunca decepciona. Música en vivo, arte local y la mejor comida callejera de Charlotte.",
      likes: 8700,
      views: 45000,
      postUrl: "https://www.instagram.com/exploreclt",
    },
    assetUrl: "/assets/stock_images/feed_arts-culture_1.jpg",
    tags: ["social", "arts", "noda"],
    daypartSlots: [],
    categoryIds: [],
    isPaid: false,
  } as any);

  items.social_proof_3 = await storage.createTvItem({
    title: "Social: CLT Fitness Community",
    type: "slide",
    sourceScope: "metro",
    templateKey: "social_proof",
    priority: 5,
    enabled: true,
    durationSec: 10,
    contentFamily: "local_pulse",
    data: {
      platform: "instagram",
      username: "cltfitfam",
      caption: "Charlotte's fitness community is something else. Free yoga in Romare Bearden Park every Saturday morning. See you there!",
      captionEs: "La comunidad fitness de Charlotte es increíble. Yoga gratis en Romare Bearden Park cada sábado por la mañana.",
      likes: 5200,
      views: 31000,
      postUrl: "https://www.instagram.com/cltfitfam",
    },
    assetUrl: "/assets/stock_images/feed_health-wellness_1.jpg",
    tags: ["social", "fitness"],
    daypartSlots: [],
    categoryIds: [],
    isPaid: false,
  } as any);

  items.venue_special_1 = await storage.createTvItem({
    title: "South End Brewing Co. Happy Hour",
    type: "slide",
    sourceScope: "hub",
    templateKey: "venue_special",
    priority: 7,
    enabled: true,
    durationSec: 10,
    contentFamily: "venue_spotlight",
    hubSlug: "south-end",
    data: {
      venueName: "South End Brewing Co.",
      title: "Happy Hour Special",
      titleEs: "Especial de Happy Hour",
      description: "$5 craft pints & half-price appetizers every weekday from 4-7 PM. Join us on the patio!",
      descriptionEs: "Pintas artesanales a $5 y aperitivos a mitad de precio de lunes a viernes de 4-7 PM.",
      accentColor: "#f59e0b",
    },
    assetUrl: "/assets/stock_images/feed_food-dining_2.jpg",
    tags: ["venue-special", "brewery", "south-end"],
    daypartSlots: ["afternoon", "evening"],
    categoryIds: [],
    isPaid: false,
  } as any);

  items.venue_special_2 = await storage.createTvItem({
    title: "The Waterman: Weekend Brunch",
    type: "slide",
    sourceScope: "hub",
    templateKey: "venue_special",
    priority: 7,
    enabled: true,
    durationSec: 10,
    contentFamily: "venue_spotlight",
    hubSlug: "plaza-midwood",
    data: {
      venueName: "The Waterman",
      title: "Weekend Brunch",
      titleEs: "Brunch de Fin de Semana",
      description: "Bottomless mimosas and oyster platters every Saturday and Sunday from 10 AM to 2 PM.",
      descriptionEs: "Mimosas ilimitadas y bandejas de ostras sábados y domingos de 10 AM a 2 PM.",
      accentColor: "#3b82f6",
    },
    assetUrl: "/assets/stock_images/feed_food-dining_3.jpg",
    tags: ["venue-special", "brunch", "plaza-midwood"],
    daypartSlots: ["morning", "afternoon"],
    categoryIds: [],
    isPaid: false,
  } as any);

  items.venue_special_3 = await storage.createTvItem({
    title: "Amelie's: Late Night Pastries",
    type: "slide",
    sourceScope: "hub",
    templateKey: "venue_special",
    priority: 6,
    enabled: true,
    durationSec: 10,
    contentFamily: "venue_spotlight",
    hubSlug: "noda",
    data: {
      venueName: "Amelie's French Bakery",
      title: "Late Night Pastries",
      titleEs: "Pasteles de Noche",
      description: "Open until 2 AM with fresh pastries, artisan coffee, and a cozy atmosphere in the heart of NoDa.",
      descriptionEs: "Abierto hasta las 2 AM con pasteles frescos, café artesanal y un ambiente acogedor en el corazón de NoDa.",
      accentColor: "#e11d48",
    },
    assetUrl: "/assets/stock_images/feed_nightlife_1.jpg",
    tags: ["venue-special", "bakery", "noda"],
    daypartSlots: ["evening", "latenight"],
    categoryIds: [],
    isPaid: false,
  } as any);

  items.qr_cta_1 = await storage.createTvItem({
    title: "QR CTA: Leave a Google Review",
    type: "slide",
    sourceScope: "hub",
    templateKey: "qr_cta",
    priority: 5,
    enabled: true,
    durationSec: 10,
    contentFamily: "info_now",
    hubSlug: "south-end",
    data: {
      headline: "Leave Us a Review!",
      headlineEs: "Dejanos una Resena!",
      description: "Scan to share your experience on Google",
      descriptionEs: "Escanea para compartir tu experiencia en Google",
      ctaText: "Scan Now",
      ctaTextEs: "Escanea Ahora",
      qrUrl: "https://g.page/review",
      accentColor: "#3b82f6",
    },
    tags: ["qr-cta", "review"],
    daypartSlots: [],
    categoryIds: [],
    isPaid: false,
  } as any);

  items.qr_cta_2 = await storage.createTvItem({
    title: "QR CTA: Join the Charlotte Hub",
    type: "slide",
    sourceScope: "metro",
    templateKey: "qr_cta",
    priority: 5,
    enabled: true,
    durationSec: 10,
    contentFamily: "info_now",
    data: {
      headline: "Join the Charlotte Hub",
      headlineEs: "Unete al Hub de Charlotte",
      description: "Scan to explore local businesses, events, and deals near you",
      descriptionEs: "Escanea para explorar negocios locales, eventos y ofertas cerca de ti",
      ctaText: "Explore Now",
      ctaTextEs: "Explora Ahora",
      qrUrl: "/charlotte",
      accentColor: "#10b981",
    },
    tags: ["qr-cta", "hub"],
    daypartSlots: [],
    categoryIds: [],
    isPaid: false,
  } as any);

  items.qr_cta_3 = await storage.createTvItem({
    title: "QR CTA: Submit Your Event",
    type: "slide",
    sourceScope: "metro",
    templateKey: "qr_cta",
    priority: 4,
    enabled: true,
    durationSec: 10,
    contentFamily: "info_now",
    data: {
      headline: "Got an Event?",
      headlineEs: "Tienes un Evento?",
      description: "Submit your event for free and reach thousands of Charlotte locals",
      descriptionEs: "Envia tu evento gratis y llega a miles de habitantes de Charlotte",
      ctaText: "Submit Event",
      ctaTextEs: "Enviar Evento",
      qrUrl: "/charlotte/submit-event",
      accentColor: "#8b5cf6",
    },
    tags: ["qr-cta", "events"],
    daypartSlots: [],
    categoryIds: [],
    isPaid: false,
  } as any);

  items.hub_discovery = await storage.createTvItem({
    title: "Hub Discovery: Explore Charlotte Neighborhoods",
    type: "slide",
    sourceScope: "metro",
    templateKey: "hub_discovery",
    priority: 5,
    enabled: true,
    durationSec: 12,
    contentFamily: "local_pulse",
    data: {
      headline: "Explore Charlotte",
      headlineEs: "Explora Charlotte",
      subline: "Discover neighborhoods, businesses, and events near you",
      sublineEs: "Descubre vecindarios, negocios y eventos cerca de ti",
      neighborhoods: ["South End", "NoDa", "Plaza Midwood", "Dilworth", "Uptown"],
    },
    tags: ["hub", "discovery"],
    daypartSlots: [],
    categoryIds: [],
    isPaid: false,
  } as any);

  items.nonprofit_1 = await storage.createTvItem({
    title: "Nonprofit Spotlight: Charlotte Community Foundation",
    type: "slide",
    sourceScope: "metro",
    templateKey: "nonprofit_showcase",
    priority: 5,
    enabled: true,
    durationSec: 12,
    contentFamily: "nonprofit_showcase",
    contentType: "nonprofit_feature",
    narrationText: "The Charlotte Community Foundation has been serving families across Mecklenburg County for over two decades. Their after-school programs reach more than 500 children each year. Scan the QR code to learn how you can help.",
    narrationEnabled: true,
    voiceProfile: "warm_local_host",
    data: {
      organizationName: "Charlotte Community Foundation",
      missionStatement: "Building stronger neighborhoods through education and community engagement.",
      missionStatementEs: "Construyendo vecindarios mas fuertes a traves de la educacion y la participacion comunitaria.",
      donateUrl: "https://charlottecommunityfoundation.org/donate",
      accentColor: "#e11d48",
    },
    assetUrl: "/assets/stock_images/feed_community_1.jpg",
    tags: ["nonprofit"],
    daypartSlots: [],
    categoryIds: [],
    isPaid: false,
  } as any);

  items.nonprofit_2 = await storage.createTvItem({
    title: "Nonprofit Spotlight: Charlotte Rescue Mission",
    type: "slide",
    sourceScope: "metro",
    templateKey: "nonprofit_showcase",
    priority: 5,
    enabled: true,
    durationSec: 12,
    contentFamily: "nonprofit_showcase",
    contentType: "nonprofit_feature",
    narrationText: "Charlotte Rescue Mission provides life-changing programs for men, women, and children experiencing homelessness and addiction. Their recovery programs have helped thousands rebuild their lives right here in our community.",
    narrationEnabled: true,
    voiceProfile: "warm_local_host",
    data: {
      organizationName: "Charlotte Rescue Mission",
      missionStatement: "Restoring lives through Christ-centered programs for the homeless and addicted.",
      missionStatementEs: "Restaurando vidas a traves de programas centrados en Cristo para personas sin hogar y adictas.",
      donateUrl: "https://charlotterescuemission.org/donate",
      accentColor: "#6366f1",
    },
    assetUrl: "/assets/stock_images/feed_community_2.jpg",
    tags: ["nonprofit"],
    daypartSlots: [],
    categoryIds: [],
    isPaid: false,
  } as any);

  items.nonprofit_3 = await storage.createTvItem({
    title: "Nonprofit Spotlight: Arts+ CLT",
    type: "slide",
    sourceScope: "metro",
    templateKey: "nonprofit_showcase",
    priority: 5,
    enabled: true,
    durationSec: 12,
    contentFamily: "nonprofit_showcase",
    data: {
      organizationName: "Arts+ Charlotte",
      missionStatement: "Connecting artists, educators, and communities through creative programs across Charlotte.",
      missionStatementEs: "Conectando artistas, educadores y comunidades a traves de programas creativos en Charlotte.",
      donateUrl: "https://artsplus.org/support",
      accentColor: "#f97316",
    },
    assetUrl: "/assets/stock_images/feed_arts-culture_2.jpg",
    tags: ["nonprofit", "arts"],
    daypartSlots: [],
    categoryIds: [],
    isPaid: false,
  } as any);

  items.community_partner_1 = await storage.createTvItem({
    title: "Community Partner: Charlotte Area Fund",
    type: "slide",
    sourceScope: "metro",
    templateKey: "community_partner",
    priority: 5,
    enabled: true,
    durationSec: 12,
    contentFamily: "community_partner",
    data: {
      partnerName: "Charlotte Area Fund",
      description: "Providing economic opportunity and social services to Charlotte residents since 1963.",
      descriptionEs: "Proporcionando oportunidades economicas y servicios sociales a los residentes de Charlotte desde 1963.",
      accentColor: "#059669",
    },
    assetUrl: "/assets/stock_images/feed_community_3.jpg",
    tags: ["community", "partner"],
    daypartSlots: [],
    categoryIds: [],
    isPaid: false,
  } as any);

  items.community_partner_2 = await storage.createTvItem({
    title: "Community Partner: Charlotte Mecklenburg Library",
    type: "slide",
    sourceScope: "metro",
    templateKey: "community_partner",
    priority: 5,
    enabled: true,
    durationSec: 12,
    contentFamily: "community_partner",
    contentType: "narrated_segment",
    narrationText: "Charlotte Mecklenburg Library serves over a million visitors annually across twenty branches. From free Wi-Fi to children's story time, the library is a cornerstone of every Charlotte neighborhood.",
    narrationEnabled: true,
    voiceProfile: "warm_local_host",
    data: {
      partnerName: "Charlotte Mecklenburg Library",
      description: "Free resources, programs, and community spaces across 20 branches in Mecklenburg County.",
      descriptionEs: "Recursos gratuitos, programas y espacios comunitarios en 20 sucursales del Condado de Mecklenburg.",
      accentColor: "#2563eb",
    },
    assetUrl: "/assets/stock_images/feed_education_1.jpg",
    tags: ["community", "library"],
    daypartSlots: [],
    categoryIds: [],
    isPaid: false,
  } as any);

  items.weather_current = await storage.createTvItem({
    title: "Weather: Charlotte Current Conditions",
    type: "slide",
    sourceScope: "metro",
    templateKey: "weather_current",
    priority: 4,
    enabled: true,
    durationSec: 8,
    contentFamily: "info_now",
    data: {
      location: "Charlotte, NC",
      locationEs: "Charlotte, NC",
    },
    tags: ["weather"],
    daypartSlots: [],
    categoryIds: [],
    isPaid: false,
  } as any);

  items.traffic_update = await storage.createTvItem({
    title: "Traffic Update: Charlotte Metro",
    type: "slide",
    sourceScope: "metro",
    templateKey: "traffic_update",
    priority: 4,
    enabled: true,
    durationSec: 8,
    contentFamily: "info_now",
    data: {
      headline: "Traffic Update",
      headlineEs: "Actualizacion de Trafico",
      routes: [
        { name: "I-77 North", status: "moderate", statusEs: "moderado" },
        { name: "I-485 Inner", status: "clear", statusEs: "despejado" },
        { name: "I-85 South", status: "heavy", statusEs: "pesado" },
      ],
    },
    tags: ["traffic"],
    daypartSlots: ["morning", "afternoon"],
    categoryIds: [],
    isPaid: false,
  } as any);

  items.sports_scores = await storage.createTvItem({
    title: "Sports: Charlotte Teams Update",
    type: "slide",
    sourceScope: "metro",
    templateKey: "sports_scores",
    priority: 5,
    enabled: true,
    durationSec: 10,
    contentFamily: "info_now",
    data: {
      headline: "Charlotte Sports",
      headlineEs: "Deportes de Charlotte",
      teams: [
        { name: "Carolina Panthers", sport: "NFL", status: "Next game Sunday" },
        { name: "Charlotte Hornets", sport: "NBA", status: "Tonight at 7 PM" },
        { name: "Charlotte FC", sport: "MLS", status: "Saturday at 5 PM" },
      ],
    },
    tags: ["sports"],
    daypartSlots: [],
    categoryIds: [],
    isPaid: false,
  } as any);

  items.tonight_1 = await storage.createTvItem({
    title: "Tonight Around You: Charlotte Events",
    type: "slide",
    sourceScope: "metro",
    templateKey: "tonight_around_you",
    priority: 7,
    enabled: true,
    durationSec: 15,
    contentFamily: "tonight_around_you",
    contentType: "narrated_segment",
    narrationText: "Here is what's happening around Charlotte tonight. Live jazz at The Jazz Room in South End starting at seven. The food truck rally kicks off at Camp North End at eight thirty. And if you're feeling brave, open mic comedy at The Comedy Zone starts at nine.",
    narrationEnabled: true,
    voiceProfile: "upbeat_event_host",
    data: {
      headline: "Tonight Around You",
      headlineEs: "Esta Noche Cerca de Ti",
      subline: "What's happening nearby",
      sublineEs: "Que pasa cerca de ti",
      events: [
        { title: "Live Jazz at The Jazz Room", startTime: "7:00 PM", locationName: "The Jazz Room, South End", tag: "Live Music", isFeatured: true },
        { title: "Food Truck Rally", startTime: "8:30 PM", locationName: "Camp North End", tag: "Free", isFeatured: false },
        { title: "Open Mic Comedy Night", startTime: "9:00 PM", locationName: "The Comedy Zone, Uptown", isFeatured: false },
      ],
      qrUrl: "/charlotte/events?filter=tonight",
    },
    tags: ["tonight", "events"],
    daypartSlots: ["evening"],
    categoryIds: [],
    isPaid: false,
  } as any);

  items.tonight_2 = await storage.createTvItem({
    title: "Tonight Around You: Nightlife Picks",
    type: "slide",
    sourceScope: "metro",
    templateKey: "tonight_around_you",
    priority: 6,
    enabled: true,
    durationSec: 12,
    contentFamily: "tonight_around_you",
    data: {
      headline: "Tonight's Nightlife",
      headlineEs: "Vida Nocturna de Hoy",
      subline: "Best spots tonight",
      sublineEs: "Los mejores lugares esta noche",
      events: [
        { title: "DJ Night at Roxbury", startTime: "10:00 PM", locationName: "Roxbury Nightclub, Uptown", tag: "Nightlife", isFeatured: true },
        { title: "Trivia at Craft Tasting Room", startTime: "7:00 PM", locationName: "NoDa", tag: "Free", isFeatured: false },
        { title: "Live Band at The Milestone", startTime: "8:00 PM", locationName: "The Milestone Club", isFeatured: false },
      ],
      qrUrl: "/charlotte/events?filter=tonight",
    },
    tags: ["tonight", "nightlife"],
    daypartSlots: ["evening", "latenight"],
    categoryIds: [],
    isPaid: false,
  } as any);

  items.event_countdown_1 = await storage.createTvItem({
    title: "Event Countdown: Live Music Tonight",
    type: "slide",
    sourceScope: "hub",
    templateKey: "event_countdown",
    priority: 7,
    enabled: true,
    durationSec: 10,
    contentFamily: "tonight_around_you",
    hubSlug: "noda",
    data: {
      eventName: "Live Music Tonight",
      eventNameEs: "Musica en Vivo Esta Noche",
      eventTime: new Date(new Date().setHours(20, 0, 0, 0)).toISOString(),
      venue: "The Evening Muse, NoDa",
      description: "Acoustic set featuring local artists",
      descriptionEs: "Set acustico con artistas locales",
      accentColor: "#f43f5e",
    },
    tags: ["event", "music", "noda"],
    daypartSlots: ["afternoon", "evening"],
    categoryIds: [],
    isPaid: false,
  } as any);

  items.event_countdown_2 = await storage.createTvItem({
    title: "Event Countdown: Farmers Market",
    type: "slide",
    sourceScope: "hub",
    templateKey: "event_countdown",
    priority: 6,
    enabled: true,
    durationSec: 10,
    contentFamily: "weekend_happenings",
    hubSlug: "south-end",
    data: {
      eventName: "Farmers Market",
      eventNameEs: "Mercado de Agricultores",
      eventTime: new Date(new Date().setHours(9, 0, 0, 0)).toISOString(),
      venue: "Atherton Mill, South End",
      description: "Fresh produce, local vendors, and live music every Saturday",
      descriptionEs: "Productos frescos, vendedores locales y musica en vivo cada sabado",
      accentColor: "#22c55e",
    },
    tags: ["event", "market", "south-end"],
    daypartSlots: ["morning"],
    categoryIds: [],
    isPaid: false,
  } as any);

  items.this_weekend_1 = await storage.createTvItem({
    title: "This Weekend: Charlotte Events",
    type: "slide",
    sourceScope: "metro",
    templateKey: "this_weekend",
    priority: 6,
    enabled: true,
    durationSec: 12,
    contentFamily: "weekend_happenings",
    contentType: "narrated_segment",
    narrationText: "This weekend in Charlotte is packed. The Farmers Market at Atherton Mill kicks off Saturday morning. NoDa hosts its brewery crawl at two. And don't miss Sunday brunch with live music at The Waterman in Plaza Midwood.",
    narrationEnabled: true,
    voiceProfile: "upbeat_event_host",
    data: {
      headline: "This Weekend",
      headlineEs: "Este Fin de Semana",
      subline: "Plans around you",
      sublineEs: "Planes cerca de ti",
      events: [
        { title: "Farmers Market at South End", startTime: "6:00 PM", dayLabel: "Fri", locationName: "Atherton Mill, South End", tag: "Free", isFeatured: false },
        { title: "Brewery Crawl", startTime: "2:00 PM", dayLabel: "Sat", locationName: "NoDa Brewing District", tag: "Featured", isFeatured: true },
        { title: "Art Walk & Gallery Hop", startTime: "11:00 AM", dayLabel: "Sat", locationName: "NoDa Arts District", isFeatured: false },
        { title: "Sunday Brunch & Live Music", startTime: "10:00 AM", dayLabel: "Sun", locationName: "The Waterman, Plaza Midwood", tag: "Live Music", isFeatured: false },
      ],
      qrUrl: "/charlotte/events?filter=weekend",
    },
    tags: ["weekend", "events"],
    daypartSlots: [],
    categoryIds: [],
    isPaid: false,
  } as any);

  items.this_weekend_2 = await storage.createTvItem({
    title: "This Weekend: Family Fun",
    type: "slide",
    sourceScope: "metro",
    templateKey: "this_weekend",
    priority: 6,
    enabled: true,
    durationSec: 12,
    contentFamily: "weekend_happenings",
    data: {
      headline: "Weekend Family Fun",
      headlineEs: "Diversion Familiar de Fin de Semana",
      subline: "Kid-friendly events this weekend",
      sublineEs: "Eventos para ninos este fin de semana",
      events: [
        { title: "Discovery Place Kids Day", startTime: "10:00 AM", dayLabel: "Sat", locationName: "Discovery Place Science", tag: "Family", isFeatured: true },
        { title: "Freedom Park Kite Festival", startTime: "1:00 PM", dayLabel: "Sat", locationName: "Freedom Park", tag: "Free", isFeatured: false },
        { title: "CLT Knights Family Sunday", startTime: "2:00 PM", dayLabel: "Sun", locationName: "Truist Field", tag: "Sports", isFeatured: false },
      ],
      qrUrl: "/charlotte/events?filter=weekend&category=family",
    },
    tags: ["weekend", "family"],
    daypartSlots: [],
    categoryIds: [],
    isPaid: false,
  } as any);

  items.hub_event = await storage.createTvItem({
    title: "Hub Event: South End First Friday",
    type: "slide",
    sourceScope: "hub",
    templateKey: "hub_event",
    priority: 6,
    enabled: true,
    durationSec: 12,
    contentFamily: "tonight_around_you",
    hubSlug: "south-end",
    data: {
      eventName: "South End First Friday",
      eventNameEs: "Primer Viernes de South End",
      description: "Art, live music, food trucks, and late-night shopping along the Rail Trail.",
      descriptionEs: "Arte, musica en vivo, camiones de comida y compras nocturnas a lo largo del Rail Trail.",
      date: "First Friday of each month",
      time: "6:00 PM - 10:00 PM",
      accentColor: "#8b5cf6",
    },
    tags: ["hub-event", "south-end"],
    daypartSlots: ["evening"],
    categoryIds: [],
    isPaid: false,
  } as any);

  items.sponsor_ad = await storage.createTvItem({
    title: "Sponsor: Queen City Auto Detailing",
    type: "slide",
    sourceScope: "metro",
    templateKey: "sponsor_ad",
    priority: 4,
    enabled: true,
    durationSec: 10,
    contentFamily: "local_commerce_spotlight",
    data: {
      businessName: "Queen City Auto Detailing",
      tagline: "Charlotte's #1 Mobile Detailing",
      taglineEs: "El #1 en Detallado Movil de Charlotte",
      promoText: "First wash 50% off — mention Hub Screens!",
      promoTextEs: "Primera lavada 50% de descuento — menciona Hub Screens!",
      description: "We come to you. Professional detailing at your home or office.",
      descriptionEs: "Vamos a ti. Detallado profesional en tu casa u oficina.",
      accentColor: "#10b981",
    },
    tags: ["sponsor", "auto"],
    daypartSlots: [],
    categoryIds: [],
    isPaid: true,
  } as any);

  console.log(`[SEED] Created ${Object.keys(items).length} TV content items`);

  const loopA = await storage.createTvLoop({
    name: "Local Pulse Hour",
    slug: "local-pulse-hour",
    description: "A general-purpose 60-minute loop featuring local business highlights, trivia, social proof, and neighborhood happenings.",
    durationTargetMinutes: 60,
    theme: "general",
    audienceType: "general",
    venueTypes: ["bar", "restaurant", "gym", "salon", "cafe"],
    enabled: true,
    narrationStyle: "warm_local_host",
    subtitleMode: "auto",
    orderStrategy: "semi_random",
    daytimeTags: ["day", "morning", "afternoon"],
    rules: null,
  });

  const loopB = await storage.createTvLoop({
    name: "Community Spotlight Hour",
    slug: "community-spotlight-hour",
    description: "A 60-minute community-focused loop featuring nonprofits, local organizations, support-local messaging, and neighborhood stories.",
    durationTargetMinutes: 60,
    theme: "community",
    audienceType: "general",
    venueTypes: ["bar", "restaurant", "gym", "salon", "cafe", "community_center", "library", "coworking"],
    enabled: true,
    narrationStyle: "warm_local_host",
    subtitleMode: "auto",
    orderStrategy: "semi_random",
    daytimeTags: ["day", "afternoon"],
    rules: null,
  });

  const loopC = await storage.createTvLoop({
    name: "Tonight Around You Hour",
    slug: "tonight-around-you-hour",
    description: "A 60-minute evening-focused loop featuring tonight's events, nightlife highlights, venue specials, and event countdowns.",
    durationTargetMinutes: 60,
    theme: "nightlife",
    audienceType: "21+",
    venueTypes: ["bar", "restaurant", "nightlife", "lounge"],
    enabled: true,
    narrationStyle: "upbeat_event_host",
    subtitleMode: "auto",
    orderStrategy: "weighted_shuffle",
    daytimeTags: ["evening", "latenight", "happy_hour"],
    rules: null,
  });

  const loopD = await storage.createTvLoop({
    name: "Info + Entertainment Hour",
    slug: "info-entertainment-hour",
    description: "A 60-minute info-focused loop with weather, traffic, sports, trivia, and light social proof. Ideal for waiting rooms and offices.",
    durationTargetMinutes: 60,
    theme: "info",
    audienceType: "general",
    venueTypes: ["gym", "salon", "waiting_room", "office"],
    enabled: true,
    narrationStyle: "calm_waiting_room",
    subtitleMode: "auto",
    orderStrategy: "semi_random",
    daytimeTags: ["day", "morning", "afternoon"],
    rules: null,
  });

  const loopE = await storage.createTvLoop({
    name: "Weekend Happenings",
    slug: "weekend-happenings",
    description: "A 90-minute weekend-focused loop with extended event coverage, arts & culture, food & drink, outdoor activities, and family-friendly highlights.",
    durationTargetMinutes: 90,
    theme: "weekend",
    audienceType: "family",
    venueTypes: ["bar", "restaurant", "family", "community"],
    enabled: true,
    narrationStyle: "upbeat_event_host",
    subtitleMode: "auto",
    orderStrategy: "weighted_shuffle",
    daytimeTags: ["weekend"],
    rules: null,
  });

  const loopAItems = [
    { tvItemId: items.pulse_headline_1.id, templateKey: "pulse_headline", position: 0, sectionLabel: "Headlines", weight: 2, isRequired: true },
    { tvItemId: items.neighborhood_spotlight_1.id, templateKey: "neighborhood_spotlight", position: 1, sectionLabel: "Neighborhood", weight: 2, isRequired: true },
    { tvItemId: items.social_proof_1.id, templateKey: "social_proof", position: 2, sectionLabel: "Social Buzz", weight: 1, isRequired: false },
    { tvItemId: items.trivia_1.id, templateKey: "trivia_question", position: 3, sectionLabel: "Trivia", weight: 1, isRequired: false },
    { tvItemId: items.support_local_1.id, templateKey: "support_local_spotlight", position: 4, sectionLabel: "Support Local", weight: 2, isRequired: true },
    { tvItemId: items.weather_current.id, templateKey: "weather_current", position: 5, sectionLabel: "Weather", weight: 1, isRequired: false },
    { tvItemId: items.pulse_headline_2.id, templateKey: "pulse_headline", position: 6, sectionLabel: "Headlines", weight: 1, isRequired: false },
    { tvItemId: items.social_proof_2.id, templateKey: "social_proof", position: 7, sectionLabel: "Social Buzz", weight: 1, isRequired: false },
    { tvItemId: items.trivia_2.id, templateKey: "trivia_question", position: 8, sectionLabel: "Trivia", weight: 1, isRequired: false },
    { tvItemId: items.qr_cta_1.id, templateKey: "qr_cta", position: 9, sectionLabel: "Take Action", weight: 1, isRequired: false },
    { tvItemId: items.hub_discovery.id, templateKey: "hub_discovery", position: 10, sectionLabel: "Explore", weight: 1, isRequired: false },
    { tvItemId: items.neighborhood_spotlight_2.id, templateKey: "neighborhood_spotlight", position: 11, sectionLabel: "Neighborhood", weight: 1, isRequired: false },
    { tvItemId: items.social_proof_3.id, templateKey: "social_proof", position: 12, sectionLabel: "Social Buzz", weight: 1, isRequired: false },
    { tvItemId: items.trivia_3.id, templateKey: "trivia_question", position: 13, sectionLabel: "Trivia", weight: 1, isRequired: false },
    { tvItemId: items.venue_special_1.id, templateKey: "venue_special", position: 14, sectionLabel: "Venue Spotlight", weight: 1, isRequired: false },
    { tvItemId: items.qr_cta_2.id, templateKey: "qr_cta", position: 15, sectionLabel: "Take Action", weight: 1, isRequired: false },
    { tvItemId: items.trivia_4.id, templateKey: "trivia_question", position: 16, sectionLabel: "Trivia", weight: 1, isRequired: false },
    { tvItemId: items.support_local_2.id, templateKey: "support_local_spotlight", position: 17, sectionLabel: "Support Local", weight: 1, isRequired: false },
  ];

  const loopBItems = [
    { tvItemId: items.nonprofit_1.id, templateKey: "nonprofit_showcase", position: 0, sectionLabel: "Nonprofit Partner", weight: 2, isRequired: true },
    { tvItemId: items.support_local_1.id, templateKey: "support_local_spotlight", position: 1, sectionLabel: "Support Local", weight: 2, isRequired: true },
    { tvItemId: items.neighborhood_spotlight_1.id, templateKey: "neighborhood_spotlight", position: 2, sectionLabel: "Neighborhood", weight: 1, isRequired: false },
    { tvItemId: items.community_partner_1.id, templateKey: "community_partner", position: 3, sectionLabel: "Community", weight: 1, isRequired: false },
    { tvItemId: items.nonprofit_2.id, templateKey: "nonprofit_showcase", position: 4, sectionLabel: "Nonprofit Partner", weight: 2, isRequired: true },
    { tvItemId: items.weather_current.id, templateKey: "weather_current", position: 5, sectionLabel: "Weather", weight: 1, isRequired: false },
    { tvItemId: items.community_partner_2.id, templateKey: "community_partner", position: 6, sectionLabel: "Community", weight: 1, isRequired: false },
    { tvItemId: items.social_proof_1.id, templateKey: "social_proof", position: 7, sectionLabel: "Community Voices", weight: 1, isRequired: false },
    { tvItemId: items.neighborhood_spotlight_2.id, templateKey: "neighborhood_spotlight", position: 8, sectionLabel: "Neighborhood", weight: 1, isRequired: false },
    { tvItemId: items.support_local_2.id, templateKey: "support_local_spotlight", position: 9, sectionLabel: "Support Local", weight: 1, isRequired: false },
    { tvItemId: items.nonprofit_3.id, templateKey: "nonprofit_showcase", position: 10, sectionLabel: "Nonprofit Partner", weight: 1, isRequired: false },
    { tvItemId: items.qr_cta_1.id, templateKey: "qr_cta", position: 11, sectionLabel: "Get Involved", weight: 1, isRequired: false },
    { tvItemId: items.social_proof_2.id, templateKey: "social_proof", position: 12, sectionLabel: "Community Voices", weight: 1, isRequired: false },
    { tvItemId: items.trivia_1.id, templateKey: "trivia_question", position: 13, sectionLabel: "Fun Facts", weight: 1, isRequired: false },
    { tvItemId: items.qr_cta_2.id, templateKey: "qr_cta", position: 14, sectionLabel: "Get Involved", weight: 1, isRequired: false },
    { tvItemId: items.social_proof_3.id, templateKey: "social_proof", position: 15, sectionLabel: "Community Voices", weight: 1, isRequired: false },
  ];

  const loopCItems = [
    { tvItemId: items.tonight_1.id, templateKey: "tonight_around_you", position: 0, sectionLabel: "Tonight Preview", weight: 3, isRequired: true },
    { tvItemId: items.event_countdown_1.id, templateKey: "event_countdown", position: 1, sectionLabel: "Countdown", weight: 2, isRequired: true },
    { tvItemId: items.venue_special_1.id, templateKey: "venue_special", position: 2, sectionLabel: "Happy Hour", weight: 2, isRequired: false },
    { tvItemId: items.social_proof_1.id, templateKey: "social_proof", position: 3, sectionLabel: "Social Buzz", weight: 1, isRequired: false },
    { tvItemId: items.tonight_2.id, templateKey: "tonight_around_you", position: 4, sectionLabel: "Nightlife", weight: 2, isRequired: false },
    { tvItemId: items.venue_special_3.id, templateKey: "venue_special", position: 5, sectionLabel: "Late Night", weight: 1, isRequired: false },
    { tvItemId: items.qr_cta_1.id, templateKey: "qr_cta", position: 6, sectionLabel: "Take Action", weight: 1, isRequired: false },
    { tvItemId: items.hub_event.id, templateKey: "hub_event", position: 7, sectionLabel: "Hub Event", weight: 1, isRequired: false },
    { tvItemId: items.social_proof_2.id, templateKey: "social_proof", position: 8, sectionLabel: "Social Buzz", weight: 1, isRequired: false },
    { tvItemId: items.venue_special_2.id, templateKey: "venue_special", position: 9, sectionLabel: "Food & Drink", weight: 1, isRequired: false },
    { tvItemId: items.event_countdown_2.id, templateKey: "event_countdown", position: 10, sectionLabel: "Coming Up", weight: 1, isRequired: false },
    { tvItemId: items.trivia_2.id, templateKey: "trivia_question", position: 11, sectionLabel: "Trivia", weight: 1, isRequired: false },
    { tvItemId: items.sponsor_ad.id, templateKey: "sponsor_ad", position: 12, sectionLabel: "Sponsor", weight: 1, isRequired: false },
    { tvItemId: items.social_proof_3.id, templateKey: "social_proof", position: 13, sectionLabel: "Social Buzz", weight: 1, isRequired: false },
    { tvItemId: items.qr_cta_3.id, templateKey: "qr_cta", position: 14, sectionLabel: "Take Action", weight: 1, isRequired: false },
  ];

  const loopDItems = [
    { tvItemId: items.weather_current.id, templateKey: "weather_current", position: 0, sectionLabel: "Weather", weight: 2, isRequired: true },
    { tvItemId: items.traffic_update.id, templateKey: "traffic_update", position: 1, sectionLabel: "Traffic", weight: 2, isRequired: true },
    { tvItemId: items.sports_scores.id, templateKey: "sports_scores", position: 2, sectionLabel: "Sports", weight: 2, isRequired: false },
    { tvItemId: items.trivia_1.id, templateKey: "trivia_question", position: 3, sectionLabel: "Trivia", weight: 1, isRequired: false },
    { tvItemId: items.trivia_2.id, templateKey: "trivia_question", position: 4, sectionLabel: "Trivia", weight: 1, isRequired: false },
    { tvItemId: items.pulse_headline_1.id, templateKey: "pulse_headline", position: 5, sectionLabel: "Headlines", weight: 1, isRequired: false },
    { tvItemId: items.social_proof_1.id, templateKey: "social_proof", position: 6, sectionLabel: "Social Buzz", weight: 1, isRequired: false },
    { tvItemId: items.qr_cta_2.id, templateKey: "qr_cta", position: 7, sectionLabel: "Take Action", weight: 1, isRequired: false },
    { tvItemId: items.trivia_3.id, templateKey: "trivia_question", position: 8, sectionLabel: "Trivia", weight: 1, isRequired: false },
    { tvItemId: items.trivia_4.id, templateKey: "trivia_question", position: 9, sectionLabel: "Trivia", weight: 1, isRequired: false },
    { tvItemId: items.pulse_headline_2.id, templateKey: "pulse_headline", position: 10, sectionLabel: "Headlines", weight: 1, isRequired: false },
    { tvItemId: items.social_proof_2.id, templateKey: "social_proof", position: 11, sectionLabel: "Social Buzz", weight: 1, isRequired: false },
    { tvItemId: items.trivia_5.id, templateKey: "trivia_question", position: 12, sectionLabel: "Trivia", weight: 1, isRequired: false },
    { tvItemId: items.social_proof_3.id, templateKey: "social_proof", position: 13, sectionLabel: "Social Buzz", weight: 1, isRequired: false },
    { tvItemId: items.qr_cta_1.id, templateKey: "qr_cta", position: 14, sectionLabel: "Take Action", weight: 1, isRequired: false },
    { tvItemId: items.support_local_1.id, templateKey: "support_local_spotlight", position: 15, sectionLabel: "Support Local", weight: 1, isRequired: false },
  ];

  const loopEItems = [
    { tvItemId: items.this_weekend_1.id, templateKey: "this_weekend", position: 0, sectionLabel: "This Weekend", weight: 3, isRequired: true },
    { tvItemId: items.this_weekend_2.id, templateKey: "this_weekend", position: 1, sectionLabel: "Family Weekend", weight: 2, isRequired: true },
    { tvItemId: items.tonight_1.id, templateKey: "tonight_around_you", position: 2, sectionLabel: "Tonight", weight: 2, isRequired: false },
    { tvItemId: items.event_countdown_1.id, templateKey: "event_countdown", position: 3, sectionLabel: "Countdown", weight: 2, isRequired: false },
    { tvItemId: items.support_local_1.id, templateKey: "support_local_spotlight", position: 4, sectionLabel: "Support Local", weight: 1, isRequired: false },
    { tvItemId: items.nonprofit_1.id, templateKey: "nonprofit_showcase", position: 5, sectionLabel: "Nonprofit Partner", weight: 1, isRequired: false },
    { tvItemId: items.venue_special_1.id, templateKey: "venue_special", position: 6, sectionLabel: "Weekend Specials", weight: 1, isRequired: false },
    { tvItemId: items.social_proof_1.id, templateKey: "social_proof", position: 7, sectionLabel: "Social Buzz", weight: 1, isRequired: false },
    { tvItemId: items.trivia_1.id, templateKey: "trivia_question", position: 8, sectionLabel: "Trivia", weight: 1, isRequired: false },
    { tvItemId: items.qr_cta_1.id, templateKey: "qr_cta", position: 9, sectionLabel: "Take Action", weight: 1, isRequired: false },
    { tvItemId: items.event_countdown_2.id, templateKey: "event_countdown", position: 10, sectionLabel: "Coming Up", weight: 1, isRequired: false },
    { tvItemId: items.venue_special_2.id, templateKey: "venue_special", position: 11, sectionLabel: "Weekend Specials", weight: 1, isRequired: false },
    { tvItemId: items.support_local_2.id, templateKey: "support_local_spotlight", position: 12, sectionLabel: "Support Local", weight: 1, isRequired: false },
    { tvItemId: items.nonprofit_2.id, templateKey: "nonprofit_showcase", position: 13, sectionLabel: "Nonprofit Partner", weight: 1, isRequired: false },
    { tvItemId: items.social_proof_2.id, templateKey: "social_proof", position: 14, sectionLabel: "Social Buzz", weight: 1, isRequired: false },
    { tvItemId: items.trivia_5.id, templateKey: "trivia_question", position: 15, sectionLabel: "Trivia", weight: 1, isRequired: false },
    { tvItemId: items.community_partner_1.id, templateKey: "community_partner", position: 16, sectionLabel: "Community", weight: 1, isRequired: false },
    { tvItemId: items.hub_event.id, templateKey: "hub_event", position: 17, sectionLabel: "Hub Event", weight: 1, isRequired: false },
    { tvItemId: items.social_proof_3.id, templateKey: "social_proof", position: 18, sectionLabel: "Social Buzz", weight: 1, isRequired: false },
    { tvItemId: items.qr_cta_3.id, templateKey: "qr_cta", position: 19, sectionLabel: "Take Action", weight: 1, isRequired: false },
    { tvItemId: items.sponsor_ad.id, templateKey: "sponsor_ad", position: 20, sectionLabel: "Sponsor", weight: 1, isRequired: false },
    { tvItemId: items.neighborhood_spotlight_1.id, templateKey: "neighborhood_spotlight", position: 21, sectionLabel: "Neighborhood", weight: 1, isRequired: false },
    { tvItemId: items.trivia_3.id, templateKey: "trivia_question", position: 22, sectionLabel: "Trivia", weight: 1, isRequired: false },
  ];

  const allLoopItemSets = [
    { loopId: loopA.id, items: loopAItems },
    { loopId: loopB.id, items: loopBItems },
    { loopId: loopC.id, items: loopCItems },
    { loopId: loopD.id, items: loopDItems },
    { loopId: loopE.id, items: loopEItems },
  ];

  for (const { loopId, items: loopItems } of allLoopItemSets) {
    for (const li of loopItems) {
      await storage.createTvLoopItem({ loopId, ...li } as any);
    }
  }

  console.log(`[SEED] Loop items: A=${loopAItems.length}, B=${loopBItems.length}, C=${loopCItems.length}, D=${loopDItems.length}, E=${loopEItems.length}`);

  await storage.createTvSchedule({
    name: "Weekday Daytime",
    metroSlug: "charlotte",
    dayOfWeek: ["monday", "tuesday", "wednesday", "thursday", "friday"],
    startTime: "06:00",
    endTime: "16:59",
    loopIds: [loopA.id, loopB.id, loopD.id],
    weightingStrategy: "weighted_random",
    fallbackLoopId: loopA.id,
    noConsecutiveRepeat: true,
    enabled: true,
  });

  await storage.createTvSchedule({
    name: "Weekday Evening",
    metroSlug: "charlotte",
    dayOfWeek: ["monday", "tuesday", "wednesday", "thursday", "friday"],
    startTime: "17:00",
    endTime: "23:59",
    loopIds: [loopC.id, loopD.id],
    weightingStrategy: "alternating",
    fallbackLoopId: loopC.id,
    noConsecutiveRepeat: true,
    enabled: true,
  });

  await storage.createTvSchedule({
    name: "Weekend All Day",
    metroSlug: "charlotte",
    dayOfWeek: ["saturday", "sunday"],
    startTime: "08:00",
    endTime: "23:59",
    loopIds: [loopE.id, loopB.id, loopC.id],
    weightingStrategy: "sequential",
    fallbackLoopId: loopE.id,
    noConsecutiveRepeat: true,
    enabled: true,
  });

  const hostPhrases = [
    { category: "local_intro", theme: "general", phraseText: "Good to have you here. Let's see what's happening around Charlotte.", phraseTextEs: "Que bueno tenerte aqui. Veamos que pasa en Charlotte." },
    { category: "local_intro", theme: "morning", phraseText: "Good morning, Charlotte! Here's your local update.", phraseTextEs: "Buenos dias, Charlotte! Aqui esta tu actualizacion local." },
    { category: "local_intro", theme: "afternoon", phraseText: "Happy afternoon, Charlotte. Let's catch up on what's new in your neighborhood.", phraseTextEs: "Feliz tarde, Charlotte. Pongamonos al dia con lo nuevo en tu vecindario." },
    { category: "local_intro", theme: "weekend", phraseText: "Happy weekend, Charlotte! There's so much to do. Let's dive in.", phraseTextEs: "Feliz fin de semana, Charlotte! Hay mucho que hacer. Vamos a verlo." },
    { category: "event_intro", theme: "general", phraseText: "Something fun is coming up around the corner.", phraseTextEs: "Algo divertido se acerca a la vuelta de la esquina." },
    { category: "event_intro", theme: "music", phraseText: "Live music is in the air tonight in Charlotte.", phraseTextEs: "La musica en vivo se siente esta noche en Charlotte." },
    { category: "event_intro", theme: "food", phraseText: "Hungry? Check out these local food events happening soon.", phraseTextEs: "Tienes hambre? Mira estos eventos de comida que se acercan." },
    { category: "event_intro", theme: "family", phraseText: "Looking for something fun for the whole family? We have ideas.", phraseTextEs: "Buscas algo divertido para toda la familia? Tenemos ideas." },
    { category: "support_local_intro", theme: "general", phraseText: "When you shop local, you're investing in your own community.", phraseTextEs: "Cuando compras local, estas invirtiendo en tu propia comunidad." },
    { category: "support_local_intro", theme: "dining", phraseText: "Looking for your next great meal? We've got you covered.", phraseTextEs: "Buscas tu proxima gran comida? Te tenemos cubierto." },
    { category: "support_local_intro", theme: "retail", phraseText: "Charlotte's local shops have something special waiting for you today.", phraseTextEs: "Las tiendas locales de Charlotte tienen algo especial esperandote hoy." },
    { category: "support_local_intro", theme: "new", phraseText: "A new spot just opened up in the neighborhood. Let's take a look.", phraseTextEs: "Un nuevo lugar acaba de abrir en el vecindario. Echemos un vistazo." },
    { category: "nonprofit_intro", theme: "general", phraseText: "This community partner is making a real difference right here in Charlotte.", phraseTextEs: "Este socio comunitario esta haciendo una verdadera diferencia aqui en Charlotte." },
    { category: "nonprofit_intro", theme: "education", phraseText: "Education changes lives. Meet an organization doing incredible work for Charlotte families.", phraseTextEs: "La educacion cambia vidas. Conoce una organizacion que hace un trabajo increible para las familias de Charlotte." },
    { category: "nonprofit_intro", theme: "health", phraseText: "Health and wellness matter. Here's a local nonprofit making healthcare accessible.", phraseTextEs: "La salud y el bienestar importan. Aqui hay una organizacion sin fines de lucro que hace accesible la atencion medica." },
    { category: "nonprofit_intro", theme: "youth", phraseText: "Charlotte's young people are the future. This organization is investing in them today.", phraseTextEs: "Los jovenes de Charlotte son el futuro. Esta organizacion esta invirtiendo en ellos hoy." },
    { category: "venue_intro", theme: "general", phraseText: "Let's shine a spotlight on a local favorite.", phraseTextEs: "Pongamos el foco en un favorito local." },
    { category: "venue_intro", theme: "south-end", phraseText: "South End keeps growing and evolving. Let's see what's new.", phraseTextEs: "South End sigue creciendo y evolucionando. Veamos que hay de nuevo." },
    { category: "venue_intro", theme: "noda", phraseText: "NoDa is Charlotte's creative heart. Here's what's happening in the arts district.", phraseTextEs: "NoDa es el corazon creativo de Charlotte. Esto es lo que pasa en el distrito artistico." },
    { category: "venue_intro", theme: "uptown", phraseText: "Uptown Charlotte is buzzing. Let's check out what's on the menu tonight.", phraseTextEs: "Uptown Charlotte esta en movimiento. Veamos que hay en el menu esta noche." },
    { category: "quick_update", theme: "general", phraseText: "Here's a quick update from around Charlotte.", phraseTextEs: "Aqui va una actualizacion rapida de Charlotte." },
    { category: "quick_update", theme: "weather", phraseText: "Let's check in on the weather before you head out.", phraseTextEs: "Veamos el clima antes de que salgas." },
    { category: "quick_update", theme: "traffic", phraseText: "Before you hit the road, here's a quick traffic check.", phraseTextEs: "Antes de salir a la carretera, aqui va un chequeo rapido del trafico." },
    { category: "quick_update", theme: "sports", phraseText: "Charlotte sports fans, here's your latest update.", phraseTextEs: "Fanaticos del deporte de Charlotte, aqui esta su ultima actualizacion." },
  ];

  for (const phrase of hostPhrases) {
    await storage.createTvHostPhrase({ ...phrase, enabled: true } as any);
  }

  await storage.createTvPlacement({
    placementName: "South End Brewing: Support Local Feature",
    metroSlug: "charlotte",
    hubSlug: "south-end",
    advertiserName: "South End Brewing Co.",
    amountMonthlyCents: 0,
    placementType: "support_local",
    quarterlyTerm: "Q2-2026",
    includesEnhancedPresenceBonus: false,
    valueDisplayText: "Featured Local Business",
    narrationEnabled: true,
    captionEnabled: true,
    competitorSensitive: false,
    enabled: true,
  } as any);

  await storage.createTvPlacement({
    placementName: "Charlotte Community Foundation: Nonprofit Showcase",
    metroSlug: "charlotte",
    advertiserName: "Charlotte Community Foundation",
    amountMonthlyCents: 0,
    placementType: "nonprofit_showcase",
    quarterlyTerm: "Q2-2026",
    includesEnhancedPresenceBonus: false,
    valueDisplayText: "Community Partner Spotlight",
    narrationEnabled: true,
    captionEnabled: true,
    competitorSensitive: false,
    enabled: true,
  } as any);

  await storage.createTvPlacement({
    placementName: "Queen City Auto: Local Commerce Spotlight",
    metroSlug: "charlotte",
    advertiserName: "Queen City Auto Detailing",
    amountMonthlyCents: 15000,
    placementType: "local_commerce_spotlight",
    quarterlyTerm: "Q2-2026",
    includesEnhancedPresenceBonus: true,
    valueDisplayText: "$150/mo — Local Commerce Spotlight",
    narrationEnabled: false,
    captionEnabled: false,
    competitorSensitive: true,
    enabled: true,
  } as any);

  await storage.createTvPlacement({
    placementName: "NoDa Arts: Community Partner",
    metroSlug: "charlotte",
    hubSlug: "noda",
    advertiserName: "NoDa Arts Alliance",
    amountMonthlyCents: 0,
    placementType: "community_partner",
    quarterlyTerm: "Q2-2026",
    includesEnhancedPresenceBonus: false,
    valueDisplayText: "Community Partner",
    narrationEnabled: false,
    captionEnabled: true,
    competitorSensitive: false,
    enabled: true,
  } as any);

  await storage.createTvPlacement({
    placementName: "Charlotte Rescue Mission: Nonprofit Showcase",
    metroSlug: "charlotte",
    advertiserName: "Charlotte Rescue Mission",
    amountMonthlyCents: 0,
    placementType: "nonprofit_showcase",
    quarterlyTerm: "Q2-2026",
    includesEnhancedPresenceBonus: false,
    valueDisplayText: "Nonprofit Partner Spotlight",
    narrationEnabled: true,
    captionEnabled: true,
    competitorSensitive: false,
    enabled: true,
  } as any);

  await storage.createTvPlacement({
    placementName: "Charlotte Mecklenburg Library: Community Partner",
    metroSlug: "charlotte",
    advertiserName: "Charlotte Mecklenburg Library",
    amountMonthlyCents: 0,
    placementType: "community_partner",
    quarterlyTerm: "Q2-2026",
    includesEnhancedPresenceBonus: false,
    valueDisplayText: "Community Partner",
    narrationEnabled: true,
    captionEnabled: true,
    competitorSensitive: false,
    enabled: true,
  } as any);

  console.log("[SEED] Created 5 TV loops (15-23 items each), 3 schedules, 24 host phrases, 6 placements");
  console.log("[SEED] Narrated items: neighborhood_spotlight_1, neighborhood_spotlight_2, support_local_1, support_local_2, nonprofit_1, nonprofit_2, community_partner_2, tonight_1, this_weekend_1");
}
