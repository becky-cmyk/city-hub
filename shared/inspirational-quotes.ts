export interface InspirationQuote {
  id: string;
  text: string;
  author: string;
  authorTitle: string;
  category: "business_leader" | "community_builder" | "local_philosophy";
  themes: QuoteTheme[];
  pageContexts: PageContext[];
}

export type QuoteTheme =
  | "storytelling"
  | "community"
  | "discovery"
  | "social_selling"
  | "purpose"
  | "relationships"
  | "local_media"
  | "founder";

export type PageContext =
  | "activate"
  | "pricing"
  | "claim"
  | "hub-screens"
  | "tell-your-story"
  | "charlotte-chat";

export const INSPIRATION_QUOTES: InspirationQuote[] = [
  {
    id: "gv-document",
    text: "Don't create content. Document your journey.",
    author: "Gary Vaynerchuk",
    authorTitle: "Entrepreneur & Author",
    category: "business_leader",
    themes: ["storytelling", "social_selling"],
    pageContexts: ["activate", "tell-your-story", "charlotte-chat"],
  },
  {
    id: "gv-care",
    text: "The best marketing strategy ever: care.",
    author: "Gary Vaynerchuk",
    authorTitle: "Entrepreneur & Author",
    category: "business_leader",
    themes: ["relationships", "social_selling", "community"],
    pageContexts: ["pricing", "activate", "claim", "charlotte-chat"],
  },
  {
    id: "gv-attention",
    text: "Attention is the number one asset in business.",
    author: "Gary Vaynerchuk",
    authorTitle: "Entrepreneur & Author",
    category: "business_leader",
    themes: ["social_selling", "discovery"],
    pageContexts: ["pricing", "hub-screens", "charlotte-chat"],
  },
  {
    id: "gv-content-gateway",
    text: "Content is the gateway drug to business.",
    author: "Gary Vaynerchuk",
    authorTitle: "Entrepreneur & Author",
    category: "business_leader",
    themes: ["storytelling", "social_selling"],
    pageContexts: ["activate", "tell-your-story", "charlotte-chat"],
  },
  {
    id: "sg-stories",
    text: "People do not buy goods and services. They buy relations, stories, and magic.",
    author: "Seth Godin",
    authorTitle: "Author & Marketing Thought Leader",
    category: "business_leader",
    themes: ["storytelling", "relationships", "social_selling"],
    pageContexts: ["pricing", "activate", "claim", "charlotte-chat"],
  },
  {
    id: "sg-marketing",
    text: "Marketing is no longer about the stuff you make, but the stories you tell.",
    author: "Seth Godin",
    authorTitle: "Author & Marketing Thought Leader",
    category: "business_leader",
    themes: ["storytelling", "social_selling"],
    pageContexts: ["activate", "tell-your-story", "charlotte-chat"],
  },
  {
    id: "ss-why",
    text: "People don't buy what you do; they buy why you do it.",
    author: "Simon Sinek",
    authorTitle: "Author & Leadership Speaker",
    category: "business_leader",
    themes: ["purpose", "storytelling"],
    pageContexts: ["activate", "claim", "tell-your-story", "charlotte-chat"],
  },
  {
    id: "ss-believe",
    text: "The goal is not to do business with everybody. The goal is to do business with people who believe what you believe.",
    author: "Simon Sinek",
    authorTitle: "Author & Leadership Speaker",
    category: "business_leader",
    themes: ["purpose", "community", "relationships"],
    pageContexts: ["pricing", "claim", "charlotte-chat"],
  },
  {
    id: "pd-customer",
    text: "The purpose of business is to create and keep a customer.",
    author: "Peter Drucker",
    authorTitle: "Management Thought Leader",
    category: "business_leader",
    themes: ["relationships", "community"],
    pageContexts: ["pricing", "activate", "charlotte-chat"],
  },
  {
    id: "mlk-community",
    text: "Life's most persistent and urgent question is, what are you doing for others?",
    author: "Dr. Martin Luther King Jr.",
    authorTitle: "Civil Rights Leader",
    category: "community_builder",
    themes: ["community", "purpose"],
    pageContexts: ["activate", "claim", "tell-your-story", "charlotte-chat"],
  },
  {
    id: "mlk-together",
    text: "We may have all come on different ships, but we're in the same boat now.",
    author: "Dr. Martin Luther King Jr.",
    authorTitle: "Civil Rights Leader",
    category: "community_builder",
    themes: ["community", "relationships"],
    pageContexts: ["activate", "claim", "charlotte-chat"],
  },
  {
    id: "cc-together",
    text: "We cannot seek achievement for ourselves and forget about progress and prosperity for our community.",
    author: "Cesar Chavez",
    authorTitle: "Labor Leader & Civil Rights Activist",
    category: "community_builder",
    themes: ["community", "purpose"],
    pageContexts: ["activate", "claim", "charlotte-chat"],
  },
  {
    id: "dh-organize",
    text: "Every moment is an organizing opportunity, every person a potential activist, every minute a chance to change the world.",
    author: "Dolores Huerta",
    authorTitle: "Labor Leader & Civil Rights Activist",
    category: "community_builder",
    themes: ["community", "founder", "purpose"],
    pageContexts: ["activate", "tell-your-story", "charlotte-chat"],
  },
  {
    id: "fr-neighbor",
    text: "All of us, at some time or other, need help. Whether we're giving or receiving help, each one of us has something valuable to bring to this world.",
    author: "Fred Rogers",
    authorTitle: "Educator & Television Host",
    category: "community_builder",
    themes: ["community", "relationships"],
    pageContexts: ["activate", "claim", "charlotte-chat"],
  },
  {
    id: "fr-love",
    text: "Love isn't a state of perfect caring. It is an active noun like struggle. To love someone is to strive to accept that person exactly the way he or she is, right here and now.",
    author: "Fred Rogers",
    authorTitle: "Educator & Television Host",
    category: "community_builder",
    themes: ["community", "relationships"],
    pageContexts: ["charlotte-chat"],
  },
  {
    id: "jj-cities",
    text: "Cities have the capability of providing something for everybody, only because, and only when, they are created by everybody.",
    author: "Jane Jacobs",
    authorTitle: "Urbanist & Author",
    category: "community_builder",
    themes: ["community", "local_media", "discovery"],
    pageContexts: ["activate", "claim", "charlotte-chat"],
  },
  {
    id: "jj-sidewalks",
    text: "There is no logic that can be superimposed on the city; people make it, and it is to them, not buildings, that we must fit our plans.",
    author: "Jane Jacobs",
    authorTitle: "Urbanist & Author",
    category: "community_builder",
    themes: ["community", "purpose"],
    pageContexts: ["activate", "charlotte-chat"],
  },
  {
    id: "ma-courage",
    text: "There is no greater agony than bearing an untold story inside you.",
    author: "Maya Angelou",
    authorTitle: "Poet & Civil Rights Activist",
    category: "community_builder",
    themes: ["storytelling", "purpose"],
    pageContexts: ["tell-your-story", "activate", "charlotte-chat"],
  },
  {
    id: "ma-people",
    text: "People will forget what you said, people will forget what you did, but people will never forget how you made them feel.",
    author: "Maya Angelou",
    authorTitle: "Poet & Civil Rights Activist",
    category: "community_builder",
    themes: ["relationships", "community"],
    pageContexts: ["activate", "claim", "charlotte-chat"],
  },
  {
    id: "cmh-not-ads",
    text: "The Hub isn't advertising. It's the living story of a city.",
    author: "City Metro Hub",
    authorTitle: "",
    category: "local_philosophy",
    themes: ["storytelling", "local_media", "community"],
    pageContexts: ["pricing", "activate", "claim", "charlotte-chat"],
  },
  {
    id: "cmh-local-media",
    text: "Local businesses deserve local media.",
    author: "City Metro Hub",
    authorTitle: "",
    category: "local_philosophy",
    themes: ["local_media", "community"],
    pageContexts: ["pricing", "activate", "claim", "charlotte-chat"],
  },
  {
    id: "cmh-own-story",
    text: "Instead of renting attention from social media platforms, the Hub creates a place where the community owns its stories.",
    author: "City Metro Hub",
    authorTitle: "",
    category: "local_philosophy",
    themes: ["local_media", "storytelling", "social_selling"],
    pageContexts: ["pricing", "activate", "claim", "hub-screens", "charlotte-chat"],
  },
  {
    id: "cmh-community-grows",
    text: "Communities grow when their stories are shared.",
    author: "City Metro Hub",
    authorTitle: "",
    category: "local_philosophy",
    themes: ["community", "storytelling"],
    pageContexts: ["activate", "claim", "tell-your-story", "charlotte-chat"],
  },
  {
    id: "cmh-neighborhood",
    text: "Every neighborhood has stories worth telling.",
    author: "City Metro Hub",
    authorTitle: "",
    category: "local_philosophy",
    themes: ["storytelling", "community", "discovery"],
    pageContexts: ["activate", "tell-your-story", "charlotte-chat"],
  },
  {
    id: "cmh-businesses-shape",
    text: "The businesses that shape a community are the ones whose stories people know.",
    author: "City Metro Hub",
    authorTitle: "",
    category: "local_philosophy",
    themes: ["storytelling", "community", "relationships"],
    pageContexts: ["pricing", "activate", "claim", "charlotte-chat"],
  },
  {
    id: "cmh-relationships",
    text: "The best businesses aren't built through ads. They are built through relationships, stories, and community trust.",
    author: "City Metro Hub",
    authorTitle: "",
    category: "local_philosophy",
    themes: ["relationships", "storytelling", "social_selling"],
    pageContexts: ["pricing", "activate", "claim", "charlotte-chat"],
  },
  {
    id: "cmh-purpose",
    text: "The Hub highlights the people and purpose behind local businesses and nonprofits.",
    author: "City Metro Hub",
    authorTitle: "",
    category: "local_philosophy",
    themes: ["purpose", "community", "storytelling"],
    pageContexts: ["activate", "claim", "charlotte-chat"],
  },
  {
    id: "cmh-lasting",
    text: "Businesses that become part of the community conversation build lasting relationships.",
    author: "City Metro Hub",
    authorTitle: "",
    category: "local_philosophy",
    themes: ["relationships", "community"],
    pageContexts: ["pricing", "claim", "charlotte-chat"],
  },
  {
    id: "cmh-discover",
    text: "Where stories connect people to businesses and events.",
    author: "City Metro Hub",
    authorTitle: "",
    category: "local_philosophy",
    themes: ["discovery", "community", "storytelling"],
    pageContexts: ["pricing", "activate", "hub-screens", "charlotte-chat"],
  },
  {
    id: "cmh-invitation",
    text: "We're inviting businesses, nonprofits, and community leaders who want to help shape the stories that define our city.",
    author: "City Metro Hub",
    authorTitle: "",
    category: "local_philosophy",
    themes: ["founder", "community", "storytelling"],
    pageContexts: ["activate", "claim", "charlotte-chat"],
  },
];

export const PLATFORM_TAGLINES = [
  "Where Local Stories Become Local Discovery",
  "The Living Story of Our City",
  "Local Voices. Local Stories. Local Discovery.",
  "Discover the Stories Behind the Businesses",
  "Your Community. Your Stories.",
  "Stories That Shape the City",
  "Where Communities Tell Their Stories",
  "Where Community Stories Become Discovery",
  "Discover Your City Through Local Stories",
  "The Stories That Shape a City",
];

export const FOUNDER_LANGUAGE = [
  "Founding Voices",
  "Community Builders",
  "Charter Contributors",
  "Original Story Partners",
  "Neighborhood Leaders",
  "City Story Partners",
];

const AUTHOR_ALIASES: Record<string, string[]> = {
  "Gary Vaynerchuk": ["gary vee", "gary v", "garyvee", "gary vaynerchuk", "vaynerchuk"],
  "Seth Godin": ["seth godin", "godin"],
  "Simon Sinek": ["simon sinek", "sinek"],
  "Peter Drucker": ["peter drucker", "drucker"],
  "Dr. Martin Luther King Jr.": ["mlk", "martin luther king", "dr. king", "dr king"],
  "Cesar Chavez": ["cesar chavez", "chavez"],
  "Dolores Huerta": ["dolores huerta", "huerta"],
  "Fred Rogers": ["mr. rogers", "mr rogers", "fred rogers", "mister rogers"],
  "Jane Jacobs": ["jane jacobs", "jacobs"],
  "Maya Angelou": ["maya angelou", "angelou"],
};

export function resolveInspirationAuthor(input: string): string | null {
  const lower = input.toLowerCase().trim();
  for (const [author, aliases] of Object.entries(AUTHOR_ALIASES)) {
    if (aliases.some((a) => lower.includes(a))) return author;
  }
  return null;
}

export function getQuotesForPage(
  pageContext: PageContext,
  inspirationName?: string | null
): InspirationQuote[] {
  let quotes = INSPIRATION_QUOTES.filter((q) =>
    q.pageContexts.includes(pageContext)
  );

  if (inspirationName) {
    const author = resolveInspirationAuthor(inspirationName);
    if (author) {
      const personalized = quotes.filter((q) => q.author === author);
      if (personalized.length > 0) return personalized;
    }
  }

  return quotes;
}

export function getRandomQuoteForPage(
  pageContext: PageContext,
  inspirationName?: string | null
): InspirationQuote | null {
  const quotes = getQuotesForPage(pageContext, inspirationName);
  if (quotes.length === 0) return null;
  return quotes[Math.floor(Math.random() * quotes.length)];
}

export function getQuotesByAuthor(authorName: string): InspirationQuote[] {
  const resolved = resolveInspirationAuthor(authorName);
  if (!resolved) return [];
  return INSPIRATION_QUOTES.filter((q) => q.author === resolved);
}

export function getRandomTagline(): string {
  return PLATFORM_TAGLINES[Math.floor(Math.random() * PLATFORM_TAGLINES.length)];
}

export function getQuotesForCharlotte(): InspirationQuote[] {
  return INSPIRATION_QUOTES.filter((q) =>
    q.pageContexts.includes("charlotte-chat")
  );
}
