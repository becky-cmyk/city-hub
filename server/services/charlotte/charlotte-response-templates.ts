import type { ConciergeDomain } from "../../charlotte-recommendation-connector";

export interface DomainTemplate {
  introPatterns: string[];
  followUpQuestions: string[];
  topPickIntro: string[];
  emptyResultMessages: string[];
  toneModifiers: {
    returning: string;
    newUser: string;
  };
  defaultActions: string[];
}

const diningTemplate: DomainTemplate = {
  introPatterns: [
    "Here are some great dining spots that match what you're looking for:",
    "I found some places you'll love — Charlotte's food scene has a lot to offer:",
    "Great taste! Here's what I found for you in the Charlotte dining scene:",
  ],
  followUpQuestions: [
    "Are you looking for a specific cuisine?",
    "Do you have a seating preference — patio, bar, or indoor?",
    "What's the vibe you're after — casual, upscale, or family-friendly?",
    "Any dietary preferences I should know about?",
    "Are you planning a date night or a group outing?",
  ],
  topPickIntro: [
    "My top pick for you would be",
    "I'd especially recommend",
    "If I had to pick one, I'd say check out",
  ],
  emptyResultMessages: [
    "I don't have specific restaurant matches for that right now, but Charlotte's dining scene is always growing.",
    "I couldn't find an exact match, but let me help narrow it down.",
  ],
  toneModifiers: {
    returning: "Welcome back! Ready to explore something new?",
    newUser: "Welcome to Charlotte's food scene — let me help you discover some favorites.",
  },
  defaultActions: ["view_profile", "make_reservation", "view_menu", "get_directions"],
};

const servicesTemplate: DomainTemplate = {
  introPatterns: [
    "Here are some trusted local service providers:",
    "I found some highly-rated options in your area:",
    "Charlotte has some great professionals for that — here's who I'd suggest:",
  ],
  followUpQuestions: [
    "Do you need someone available right away or can it wait?",
    "Are you looking for a specific type of service?",
    "Do you have a budget range in mind?",
    "Would you prefer someone in a particular neighborhood?",
    "Do you need a licensed or certified professional?",
  ],
  topPickIntro: [
    "I'd start with",
    "A standout option is",
    "One of the most trusted providers is",
  ],
  emptyResultMessages: [
    "I don't have a match for that service right now, but I can help you search differently.",
    "That's a tricky one — let me help narrow down what you need.",
  ],
  toneModifiers: {
    returning: "Good to see you again! Let me find the right person for the job.",
    newUser: "Let me connect you with some of Charlotte's most trusted service providers.",
  },
  defaultActions: ["view_profile", "contact", "book_appointment", "get_directions"],
};

const shoppingTemplate: DomainTemplate = {
  introPatterns: [
    "Here are some local shops worth checking out:",
    "Charlotte's got some great spots for that — take a look:",
    "I found some shops you might enjoy:",
  ],
  followUpQuestions: [
    "Are you shopping for something specific?",
    "Do you prefer local boutiques or larger retailers?",
    "Any particular neighborhood you'd like to shop in?",
    "Are you looking for gifts or something for yourself?",
  ],
  topPickIntro: [
    "A local favorite is",
    "You should definitely check out",
    "One spot I'd highlight is",
  ],
  emptyResultMessages: [
    "I couldn't find specific shops for that, but Charlotte has a vibrant retail scene.",
    "No exact matches right now — want to try a broader search?",
  ],
  toneModifiers: {
    returning: "Back for more shopping? Here's what I found:",
    newUser: "Charlotte has some amazing local shops — let me show you around.",
  },
  defaultActions: ["view_profile", "shop_online", "get_directions", "view_on_map"],
};

const housingTemplate: DomainTemplate = {
  introPatterns: [
    "Here's what I found in the Charlotte housing market:",
    "Let me help you explore some neighborhoods and options:",
    "Charlotte has a lot to offer — here are some housing options:",
  ],
  followUpQuestions: [
    "Are you looking to buy or rent?",
    "What's your budget range?",
    "How many bedrooms do you need?",
    "Are schools important for your decision?",
    "Do you prefer urban, suburban, or somewhere in between?",
    "Which neighborhoods are you most interested in?",
  ],
  topPickIntro: [
    "One area I'd recommend is",
    "A great option to consider is",
    "Based on what you're looking for, check out",
  ],
  emptyResultMessages: [
    "I don't have specific listings for that right now, but Charlotte's market is active.",
    "Let me help you refine your housing search — what matters most to you?",
  ],
  toneModifiers: {
    returning: "Still house hunting? Let's narrow it down:",
    newUser: "Welcome! Charlotte is a great place to call home — let me help you explore.",
  },
  defaultActions: ["view_profile", "schedule_tour", "contact", "view_on_map"],
};

const jobsTemplate: DomainTemplate = {
  introPatterns: [
    "Here are some job opportunities in Charlotte:",
    "I found some positions that might be a good fit:",
    "Charlotte's job market is active — here's what matches your search:",
  ],
  followUpQuestions: [
    "Are you looking for full-time, part-time, or freelance work?",
    "What's your experience level in this field?",
    "Do you have a salary range in mind?",
    "Are you open to remote or hybrid positions?",
    "Would you like to set up job alerts for this type of role?",
  ],
  topPickIntro: [
    "A standout opportunity is",
    "I'd highlight this one",
    "One role worth a closer look is",
  ],
  emptyResultMessages: [
    "I didn't find job matches for that specific search, but new positions are posted regularly.",
    "No exact matches right now — want me to broaden the search or set up an alert?",
  ],
  toneModifiers: {
    returning: "Welcome back! Let's see what's new on the job front:",
    newUser: "Charlotte has a thriving job market — let me help you find your next opportunity.",
  },
  defaultActions: ["apply", "save_job", "view_details", "set_alert"],
};

const eventsTemplate: DomainTemplate = {
  introPatterns: [
    "Here's what's happening in Charlotte:",
    "I found some events you might enjoy:",
    "Charlotte always has something going on — here's what I found:",
  ],
  followUpQuestions: [
    "Are you looking for something this weekend or further out?",
    "What kind of events interest you — music, food, sports, art?",
    "Are you going solo or with a group?",
    "Do you prefer indoor or outdoor events?",
    "Any particular neighborhood or venue you'd like to be near?",
  ],
  topPickIntro: [
    "Don't miss",
    "A highlight coming up is",
    "I'd especially recommend",
  ],
  emptyResultMessages: [
    "I don't have events matching that right now, but Charlotte's calendar fills up fast.",
    "Nothing specific came up — want to browse by category or date?",
  ],
  toneModifiers: {
    returning: "Looking for your next event? Here's what's coming up:",
    newUser: "Charlotte is always buzzing with events — let me show you what's happening.",
  },
  defaultActions: ["view_details", "rsvp", "add_to_calendar", "share"],
};

const marketplaceTemplate: DomainTemplate = {
  introPatterns: [
    "Here's what I found on the Charlotte marketplace:",
    "Check out these local listings:",
    "I found some marketplace items that match your search:",
  ],
  followUpQuestions: [
    "What's your budget for this?",
    "Are you looking for new or used items?",
    "Do you need it delivered or are you okay with pickup?",
    "Would you like to see more options in a specific category?",
  ],
  topPickIntro: [
    "A great find is",
    "Worth checking out:",
    "One listing that stands out is",
  ],
  emptyResultMessages: [
    "No marketplace listings matched that search, but new items are posted daily.",
    "I couldn't find exactly that — want to try a different category?",
  ],
  toneModifiers: {
    returning: "Back on the marketplace? Here's what's new:",
    newUser: "The Charlotte marketplace has all kinds of local finds — let's take a look.",
  },
  defaultActions: ["view_listing", "contact_seller", "save", "share"],
};

const creatorsTemplate: DomainTemplate = {
  introPatterns: [
    "Here are some talented local creators:",
    "Charlotte has an amazing creative community — here's who I found:",
    "Check out these local creators and artists:",
  ],
  followUpQuestions: [
    "What type of creative work are you looking for?",
    "Are you looking to hire or collaborate?",
    "Do you have a specific style or medium in mind?",
    "Would you like to see their portfolio first?",
  ],
  topPickIntro: [
    "Someone really worth checking out is",
    "A standout creator is",
    "I'd recommend taking a look at",
  ],
  emptyResultMessages: [
    "I didn't find creators matching that exactly, but Charlotte's creative scene is rich.",
    "No exact matches — can you tell me more about the type of creative work you need?",
  ],
  toneModifiers: {
    returning: "Looking for creative talent again? Here's who's making waves:",
    newUser: "Charlotte's creative community is thriving — let me introduce you to some talent.",
  },
  defaultActions: ["view_profile", "view_portfolio", "contact", "book"],
};

const expertsTemplate: DomainTemplate = {
  introPatterns: [
    "Here are some local experts who can help:",
    "I found some professionals with strong credentials:",
    "Charlotte has knowledgeable experts in that area — here's who I found:",
  ],
  followUpQuestions: [
    "What specific expertise are you looking for?",
    "Do you need a one-time consultation or ongoing support?",
    "Are certifications or specific credentials important?",
    "Would you prefer in-person or virtual meetings?",
  ],
  topPickIntro: [
    "A highly regarded expert is",
    "I'd recommend reaching out to",
    "Someone with excellent credentials is",
  ],
  emptyResultMessages: [
    "I didn't find a specific expert match, but let me help refine the search.",
    "No exact matches — what specific qualifications are you looking for?",
  ],
  toneModifiers: {
    returning: "Need expert advice again? Here's who's available:",
    newUser: "Let me connect you with some of Charlotte's most knowledgeable professionals.",
  },
  defaultActions: ["view_profile", "book_consultation", "contact", "read_story"],
};

const generalTemplate: DomainTemplate = {
  introPatterns: [
    "Here's what I found for you in Charlotte:",
    "Let me share some options I discovered:",
    "I pulled together some results that might help:",
  ],
  followUpQuestions: [
    "Can you tell me a bit more about what you're looking for?",
    "Is there a specific area of Charlotte you're interested in?",
    "Would you like me to narrow this down by category?",
    "Is there anything specific I should prioritize?",
  ],
  topPickIntro: [
    "One option I'd highlight is",
    "Worth a closer look:",
    "I'd suggest starting with",
  ],
  emptyResultMessages: [
    "I wasn't able to find specific results for that, but I'm here to help narrow things down.",
    "That's a broad one — can you give me a bit more detail so I can find the right match?",
  ],
  toneModifiers: {
    returning: "Welcome back! What can I help you find today?",
    newUser: "I'm Charlotte — your local guide. Let me help you discover what this city has to offer.",
  },
  defaultActions: ["view_profile", "view_on_map", "contact"],
};

const templateMap: Record<string, DomainTemplate> = {
  dining: diningTemplate,
  services: servicesTemplate,
  shopping: shoppingTemplate,
  housing: housingTemplate,
  jobs: jobsTemplate,
  events: eventsTemplate,
  marketplace: marketplaceTemplate,
  creators: creatorsTemplate,
  experts: expertsTemplate,
  general: generalTemplate,
  "things-to-do": eventsTemplate,
  attractions: eventsTemplate,
};

export function getDomainTemplate(domain: string): DomainTemplate {
  return templateMap[domain] || generalTemplate;
}

export function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
