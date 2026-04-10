import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BlockRenderer, type BlockRendererContext } from "@/components/microsite/block-renderer";
import type { MicrositeBlock } from "@shared/schema";
import { ArrowLeft, Eye, Palette, Languages } from "lucide-react";
import { usePageMeta } from "@/hooks/use-page-meta";

const ACCENT_COLOR = "#6B4C9A";

const SAMPLE_BLOCKS: MicrositeBlock[] = [
  {
    id: "hero-1",
    type: "hero",
    enabled: true,
    sortOrder: 0,
    content: {
      headline: { en: "Queen City Coffee Co.", es: "Queen City Coffee Co." },
      subheadline: {
        en: "Craft coffee roasted in-house, served with Southern hospitality in the heart of South End.",
        es: "Caf\u00e9 artesanal tostado en casa, servido con hospitalidad sure\u00f1a en el coraz\u00f3n de South End.",
      },
      ctaText: { en: "Visit Us Today", es: "Vis\u00edtenos Hoy" },
      ctaLink: "#contact",
      backgroundImage: "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=1600&q=80",
    },
  },
  {
    id: "about-1",
    type: "about",
    enabled: true,
    sortOrder: 1,
    content: {
      headline: { en: "Our Story", es: "Nuestra Historia" },
      body: {
        en: "Founded in 2018, Queen City Coffee Co. was born out of a passion for specialty coffee and community. We source our beans directly from small-farm cooperatives in Colombia, Ethiopia, and Guatemala, roasting them in small batches right here in Charlotte.\n\nOur South End location features a sun-drenched patio, a curated local art gallery, and a meeting space available for community events. Whether you're grabbing a quick espresso on the Rail Trail or settling in for a productive afternoon, we've built a space that feels like home.",
        es: "Fundada en 2018, Queen City Coffee Co. naci\u00f3 de una pasi\u00f3n por el caf\u00e9 de especialidad y la comunidad. Obtenemos nuestros granos directamente de cooperativas de peque\u00f1os agricultores en Colombia, Etiop\u00eda y Guatemala, tost\u00e1ndolos en peque\u00f1os lotes aqu\u00ed mismo en Charlotte.\n\nNuestra ubicaci\u00f3n en South End cuenta con un patio soleado, una galer\u00eda de arte local curada y un espacio de reuniones disponible para eventos comunitarios.",
      },
      image: "https://images.unsplash.com/photo-1442512595331-e89e73853f31?w=800&q=80",
    },
  },
  {
    id: "services-1",
    type: "services",
    enabled: true,
    sortOrder: 2,
    content: {
      headline: { en: "What We Offer", es: "Lo Que Ofrecemos" },
      items: [
        { name: { en: "Single-Origin Pour Overs", es: "Vertidos de Origen \u00danico" }, description: { en: "Rotating selection of single-origin beans, brewed to order.", es: "Selecci\u00f3n rotativa de granos de origen \u00fanico." } },
        { name: { en: "Espresso Bar", es: "Bar de Espresso" }, description: { en: "Classic and seasonal espresso drinks crafted by our baristas.", es: "Bebidas cl\u00e1sicas y de temporada de espresso." } },
        { name: { en: "Fresh-Baked Pastries", es: "Pasteler\u00eda Reci\u00e9n Horneada" }, description: { en: "Daily pastries from our partner bakery, Sunflour.", es: "Pasteler\u00eda diaria de nuestra panader\u00eda asociada." } },
        { name: { en: "Private Event Space", es: "Espacio para Eventos" }, description: { en: "Host your next meetup or workshop in our back room (seats 30).", es: "Organice su pr\u00f3ximo evento en nuestra sala trasera." } },
        { name: { en: "Wholesale Beans", es: "Granos al por Mayor" }, description: { en: "We supply fresh-roasted beans to restaurants and offices across Charlotte.", es: "Suministramos granos a restaurantes y oficinas." } },
        { name: { en: "Coffee Subscriptions", es: "Suscripciones de Caf\u00e9" }, description: { en: "Monthly delivery of our seasonal blends to your door.", es: "Entrega mensual de nuestras mezclas de temporada." } },
      ],
    },
  },
  {
    id: "gallery-1",
    type: "gallery",
    enabled: true,
    sortOrder: 3,
    content: {
      headline: { en: "Gallery", es: "Galer\u00eda" },
      items: [
        { url: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=600&q=80" },
        { url: "https://images.unsplash.com/photo-1498804103079-a6351b050096?w=600&q=80" },
        { url: "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=600&q=80" },
        { url: "https://images.unsplash.com/photo-1511920170033-f8396924c348?w=600&q=80" },
        { url: "https://images.unsplash.com/photo-1442512595331-e89e73853f31?w=600&q=80" },
        { url: "https://images.unsplash.com/photo-1559496417-e7f25cb247f3?w=600&q=80" },
      ],
    },
  },
  {
    id: "testimonials-1",
    type: "testimonials",
    enabled: true,
    sortOrder: 4,
    content: {
      headline: { en: "What Our Guests Say", es: "Lo Que Dicen Nuestros Clientes" },
      items: [
        { author: "Marcus T.", quote: "Best pour-over in Charlotte, hands down. The baristas really know their craft and the space is perfect for getting work done.", rating: 5, role: "South End Resident" },
        { author: "Rachel K.", quote: "I host my book club here every month. The private room is cozy, the lattes are incredible, and the staff always goes above and beyond.", rating: 5, role: "Regular Customer" },
        { author: "David L.", quote: "Their Colombian single-origin changed my whole perspective on coffee. Now I can't drink anything else. The subscription is totally worth it.", rating: 5, role: "Subscription Member" },
      ],
    },
  },
  {
    id: "team-1",
    type: "team",
    enabled: true,
    sortOrder: 5,
    content: {
      headline: { en: "Meet Our Team", es: "Conozca Nuestro Equipo" },
      items: [
        { name: "Jasmine Carter", role: "Founder & Head Roaster", bio: "Third-generation Charlotte native with 12 years in specialty coffee. SCA certified Q Grader." },
        { name: "Marco Rivera", role: "Lead Barista", bio: "Southeast Barista Champion 2024. Specializes in latte art and pour-over technique." },
        { name: "Aisha Johnson", role: "Events & Community Manager", bio: "Connects local creators, nonprofits, and entrepreneurs with our space and platform." },
      ],
    },
  },
  {
    id: "faq-1",
    type: "faq",
    enabled: true,
    sortOrder: 6,
    content: {
      headline: { en: "Frequently Asked Questions", es: "Preguntas Frecuentes" },
      items: [
        { question: "Do you offer dairy-free milk options?", answer: "Yes! We carry oat, almond, and coconut milk at no extra charge." },
        { question: "Can I book the private event space?", answer: "Absolutely. Our back room seats up to 30 and includes A/V equipment. Email us or visit the front counter to reserve." },
        { question: "Do you sell beans to take home?", answer: "We sell all of our current roasts in 12oz and 2lb bags, both in-store and through our online subscription." },
        { question: "Is there parking available?", answer: "Street parking is available along South Blvd, and the Camden Road garage is a 2-minute walk. We also have a bike rack on the Rail Trail side." },
      ],
    },
  },
  {
    id: "hours-1",
    type: "hours",
    enabled: true,
    sortOrder: 7,
    content: {
      headline: { en: "Hours & Location", es: "Horario y Ubicaci\u00f3n" },
    },
  },
  {
    id: "cta-1",
    type: "cta",
    enabled: true,
    sortOrder: 8,
    content: {
      headline: { en: "Start Your Morning Right", es: "\u00bfListo para Comenzar?" },
      subheadline: {
        en: "Stop by for a fresh cup, or set up a wholesale account for your business.",
        es: "Pase por una taza fresca, o configure una cuenta mayorista para su negocio.",
      },
      ctaText: { en: "Get Directions", es: "Obt\u00e9n Direcciones" },
      ctaLink: "#contact",
    },
  },
  {
    id: "contact-1",
    type: "contact",
    enabled: true,
    sortOrder: 9,
    content: {
      headline: { en: "Contact Us", es: "Cont\u00e1ctenos" },
    },
  },
  {
    id: "events-1",
    type: "events",
    enabled: true,
    sortOrder: 10,
    content: {
      headline: { en: "Upcoming Events", es: "Pr\u00f3ximos Eventos" },
    },
  },
  {
    id: "reviews-1",
    type: "reviews",
    enabled: true,
    sortOrder: 11,
    content: {
      headline: { en: "Reviews", es: "Rese\u00f1as" },
    },
  },
  {
    id: "creator-1",
    type: "creator",
    enabled: true,
    sortOrder: 12,
    content: {
      headline: { en: "Content Creator", es: "Creador de Contenido" },
      body: {
        en: "Queen City Coffee Co. produces original content about Charlotte's food and coffee culture, including video roasting tutorials, neighborhood food guides, and behind-the-scenes looks at our sourcing trips.",
        es: "Queen City Coffee Co. produce contenido original sobre la cultura gastron\u00f3mica y cafetera de Charlotte.",
      },
      items: [
        { title: "South End Coffee Crawl Guide", description: "A video tour of the best independent coffee spots along the Rail Trail.", platform: "YouTube" },
        { title: "Bean-to-Cup: Colombia Origin Trip", description: "Behind the scenes at our partner cooperative in Huila, Colombia.", platform: "Instagram" },
        { title: "Latte Art 101 with Marco", description: "Learn the basics of free-pour latte art from our lead barista.", platform: "YouTube" },
      ],
    },
  },
  {
    id: "contributor-1",
    type: "contributor",
    enabled: true,
    sortOrder: 13,
    content: {
      headline: { en: "Community Contributor", es: "Contribuidor Comunitario" },
      body: {
        en: "We actively contribute to Charlotte's local food ecosystem through partnerships, charity events, and educational programs for aspiring baristas.",
        es: "Contribuimos activamente al ecosistema gastron\u00f3mico local de Charlotte.",
      },
      items: [
        { title: "The Rise of Third-Wave Coffee in the Carolinas", publication: "Charlotte Magazine", date: "Jan 2026", excerpt: "How Charlotte's independent roasters are redefining the local coffee scene." },
        { title: "5 Must-Try Coffee Shops Along the Rail Trail", publication: "Charlotte Agenda", date: "Nov 2025", excerpt: "A curated guide to the best espresso stops from South End to Uptown." },
        { title: "Farm-to-Cup: Building Direct Trade Relationships", publication: "Specialty Coffee Association Blog", date: "Sep 2025", excerpt: "Lessons learned from a decade of sourcing directly from small-farm cooperatives." },
      ],
    },
  },
  {
    id: "expert-1",
    type: "expert",
    enabled: true,
    sortOrder: 14,
    content: {
      headline: { en: "Coffee Expertise", es: "Experiencia en Caf\u00e9" },
      body: {
        en: "Jasmine Carter is a certified Q Grader and has been sourcing specialty beans from origin countries for over a decade. Available for media interviews, panel discussions, and consulting.",
        es: "Jasmine Carter es una Q Grader certificada con m\u00e1s de una d\u00e9cada de experiencia.",
      },
      items: [
        { topic: "Specialty Coffee Sourcing", description: "Direct trade relationships with small-farm cooperatives in Latin America and East Africa.", quoteReady: true },
        { topic: "Sustainable Roasting Practices", description: "Low-emission roasting and compostable packaging initiatives.", quoteReady: true },
        { topic: "Charlotte Food & Beverage Scene", description: "Trends, openings, and the evolving palate of the Queen City.", quoteReady: false },
      ],
    },
  },
  {
    id: "podcast-1",
    type: "podcast",
    enabled: true,
    sortOrder: 15,
    content: {
      headline: { en: "The Roast Report", es: "El Informe del Tueste" },
      body: {
        en: "A weekly podcast exploring Charlotte's food scene, coffee culture, and the entrepreneurs behind your favorite local spots.",
        es: "Un podcast semanal explorando la escena gastron\u00f3mica de Charlotte.",
      },
      items: [
        { title: "Ep. 42: The Future of South End Dining", description: "We sit down with three new restaurateurs opening on South Blvd this spring.", date: "Mar 6, 2026", duration: "38 min" },
        { title: "Ep. 41: Farm-to-Cup in the Carolinas", description: "How local roasters are building direct relationships with growers.", date: "Feb 27, 2026", duration: "45 min" },
        { title: "Ep. 40: Latte Art Championships Recap", description: "Marco Rivera shares his journey to the Southeast finals.", date: "Feb 20, 2026", duration: "32 min" },
      ],
    },
  },
  {
    id: "speaker-1",
    type: "speaker",
    enabled: true,
    sortOrder: 16,
    content: {
      headline: { en: "Speaking & Events", es: "Conferencias y Eventos" },
      body: {
        en: "Jasmine Carter is available for keynotes, panel discussions, and workshop facilitation on topics ranging from specialty coffee to minority entrepreneurship in the food industry.",
        es: "Jasmine Carter est\u00e1 disponible para conferencias y talleres.",
      },
      items: [
        { topic: "Building a Brand in the Local Food Economy", audienceType: "Entrepreneurs & Small Business", description: "How to stand out in a competitive market by leaning into community." },
        { topic: "From Bean to Cup: The Specialty Coffee Journey", audienceType: "General Audience", description: "An engaging, visual talk tracing the path from farm to your morning cup." },
      ],
      ctaText: { en: "Book Jasmine for Your Event", es: "Reserve a Jasmine para su Evento" },
      ctaLink: "mailto:events@queencitycoffee.example.com",
    },
  },
  {
    id: "venue-1",
    type: "venue_info",
    enabled: true,
    sortOrder: 17,
    content: {
      headline: { en: "Venue Details", es: "Detalles del Lugar" },
      body: {
        en: "Our South End location features indoor and outdoor seating, a private event room, and direct Rail Trail access. Perfect for community meetups, networking events, and private parties.",
        es: "Nuestra ubicaci\u00f3n en South End cuenta con asientos interiores y exteriores.",
      },
      items: [
        { label: "Free Wi-Fi", value: "100 Mbps" },
        { label: "Outdoor Patio", value: "20 seats" },
        { label: "A/V Equipment", value: "Projector & PA" },
        { label: "Accessibility", value: "ADA Compliant" },
        { label: "Rail Trail Access", value: "Direct" },
        { label: "Bike Parking", value: "12 racks" },
      ],
    },
  },
];

const SAMPLE_CONTEXT: BlockRendererContext = {
  businessName: "Queen City Coffee Co.",
  coverImage: "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=1600&q=80",
  galleryImages: [],
  events: [
    { id: "evt-1", title: "Latte Art Throwdown", slug: "latte-art-throwdown", startDateTime: "2026-03-20T18:00:00", locationName: "Queen City Coffee Co." },
    { id: "evt-2", title: "Single-Origin Tasting Night", slug: "single-origin-tasting", startDateTime: "2026-03-27T19:00:00", locationName: "Queen City Coffee Co." },
    { id: "evt-3", title: "Barista 101 Workshop", slug: "barista-101-workshop", startDateTime: "2026-04-05T10:00:00", locationName: "Queen City Coffee Co." },
  ],
  reviews: [
    { id: "rev-1", rating: 5, text: "Absolutely the best coffee in Charlotte. The single-origin pour-over is incredible.", displayName: "Sarah M.", source: "Google", createdAt: "2026-02-15T12:00:00" },
    { id: "rev-2", rating: 5, text: "Love the atmosphere and the staff is so friendly. My go-to spot in South End.", displayName: "James W.", source: "Google", createdAt: "2026-02-20T14:00:00" },
    { id: "rev-3", rating: 4, text: "Great coffee and pastries. The private room is perfect for our team meetings.", displayName: "Linda P.", source: "Yelp", createdAt: "2026-03-01T09:00:00" },
  ],
  googleRating: "4.8",
  googleReviewCount: 247,
  hoursOfOperation: {
    monday: "6:00 AM - 7:00 PM",
    tuesday: "6:00 AM - 7:00 PM",
    wednesday: "6:00 AM - 7:00 PM",
    thursday: "6:00 AM - 9:00 PM",
    friday: "6:00 AM - 9:00 PM",
    saturday: "7:00 AM - 9:00 PM",
    sunday: "7:00 AM - 5:00 PM",
  },
  address: "2135 South Blvd, Charlotte, NC 28203",
  phone: "(704) 555-0188",
  email: "hello@queencitycoffee.example.com",
  website: "https://queencitycoffee.example.com",
  menuUrl: "https://queencitycoffee.example.com/menu",
  reservationUrl: "https://queencitycoffee.example.com/reserve",
  orderingLinks: { "DoorDash": "https://doordash.com/queencitycoffee", "UberEats": "https://ubereats.com/queencitycoffee" },
  latitude: 35.2116,
  longitude: -80.8576,
  citySlug: "charlotte",
  businessSlug: "queen-city-coffee-co",
};

const TEMPLATES = [
  { id: "modern", label: "Modern" },
  { id: "classic", label: "Classic" },
  { id: "bold", label: "Bold" },
  { id: "elegant", label: "Elegant" },
] as const;

type Locale = "en" | "es";

export default function SampleListing() {
  usePageMeta({ title: "Sample Business Listing | CityMetroHub" });

  useEffect(() => {
    let robotsMeta = document.querySelector('meta[name="robots"]') as HTMLMetaElement | null;
    if (!robotsMeta) {
      robotsMeta = document.createElement("meta");
      robotsMeta.name = "robots";
      document.head.appendChild(robotsMeta);
    }
    robotsMeta.content = "noindex, nofollow";
    return () => {
      if (robotsMeta) robotsMeta.remove();
    };
  }, []);

  const [template, setTemplate] = useState<string>("modern");
  const [locale, setLocale] = useState<Locale>("en");

  return (
    <div className="min-h-screen bg-background" data-testid="page-sample-listing">
      <div className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href="/">
              <Button variant="ghost" size="sm" data-testid="button-back-home">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium" data-testid="text-sample-badge">Sample Showcase</span>
            </div>
            <Badge variant="outline" className="text-xs" data-testid="badge-demo">
              Demo
            </Badge>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Palette className="w-4 h-4 text-muted-foreground" />
              <div className="flex gap-1">
                {TEMPLATES.map((t) => (
                  <Button
                    key={t.id}
                    variant={template === t.id ? "default" : "outline"}
                    size="sm"
                    onClick={() => setTemplate(t.id)}
                    data-testid={`button-template-${t.id}`}
                  >
                    {t.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Languages className="w-4 h-4 text-muted-foreground" />
              <div className="flex gap-1">
                <Button
                  variant={locale === "en" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setLocale("en")}
                  data-testid="button-locale-en"
                >
                  EN
                </Button>
                <Button
                  variant={locale === "es" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setLocale("es")}
                  data-testid="button-locale-es"
                >
                  ES
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <BlockRenderer
        blocks={SAMPLE_BLOCKS}
        template={template}
        accentColor={ACCENT_COLOR}
        context={SAMPLE_CONTEXT}
        locale={locale}
      />

      <footer className="border-t py-8 px-6 text-center text-sm text-muted-foreground" data-testid="footer-sample">
        <p>
          This is a sample showcase of a CityMetroHub business listing page.
          All content is fictional and for demonstration purposes only.
        </p>
        <div className="mt-4 flex justify-center gap-4">
          <Link href="/charlotte">
            <Button variant="outline" size="sm" data-testid="button-explore-charlotte">
              Explore Charlotte
            </Button>
          </Link>
          <Link href="/charlotte/advertise">
            <Button size="sm" style={{ backgroundColor: ACCENT_COLOR, color: "#fff" }} data-testid="button-get-listed">
              Get Your Business Listed
            </Button>
          </Link>
        </div>
      </footer>
    </div>
  );
}
