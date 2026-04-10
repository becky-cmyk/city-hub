import { db } from "./db";
import { skillCategories, skillSubcategories, skills as skillsTable, credentialDirectory } from "@shared/schema";
import { sql } from "drizzle-orm";

const SKILL_TAXONOMY = [
  {
    name: "Communication", slug: "communication", subcategories: [
      { name: "Customer Communication", slug: "customer-communication", skills: [
        { name: "Phone Support", slug: "phone-support" },
        { name: "Email Support", slug: "email-support" },
        { name: "Live Chat", slug: "live-chat" },
        { name: "Bilingual Communication", slug: "bilingual-communication" },
      ]},
      { name: "Public Speaking", slug: "public-speaking", skills: [
        { name: "Presentations", slug: "presentations" },
        { name: "Training & Facilitation", slug: "training-facilitation" },
        { name: "Event Hosting", slug: "event-hosting" },
      ]},
    ],
  },
  {
    name: "Hospitality", slug: "hospitality", subcategories: [
      { name: "Food Service", slug: "food-service", skills: [
        { name: "Bartending", slug: "bartending" },
        { name: "Serving", slug: "serving" },
        { name: "Cooking / Line Cook", slug: "cooking-line-cook" },
        { name: "Barista", slug: "barista" },
        { name: "Catering", slug: "catering" },
      ]},
      { name: "Hotel Operations", slug: "hotel-operations", skills: [
        { name: "Front Desk", slug: "front-desk" },
        { name: "Housekeeping", slug: "housekeeping" },
        { name: "Concierge", slug: "concierge" },
        { name: "Event Coordination", slug: "event-coordination" },
      ]},
    ],
  },
  {
    name: "Trades", slug: "trades", subcategories: [
      { name: "Electrical", slug: "electrical", skills: [
        { name: "Residential Electrical", slug: "residential-electrical" },
        { name: "Commercial Electrical", slug: "commercial-electrical" },
        { name: "Wiring & Panel Work", slug: "wiring-panel-work" },
      ]},
      { name: "HVAC", slug: "hvac", skills: [
        { name: "HVAC Installation", slug: "hvac-installation" },
        { name: "HVAC Repair", slug: "hvac-repair" },
        { name: "Refrigeration", slug: "refrigeration" },
      ]},
      { name: "Plumbing", slug: "plumbing", skills: [
        { name: "Residential Plumbing", slug: "residential-plumbing" },
        { name: "Commercial Plumbing", slug: "commercial-plumbing" },
        { name: "Pipe Fitting", slug: "pipe-fitting" },
      ]},
    ],
  },
  {
    name: "Healthcare", slug: "healthcare", subcategories: [
      { name: "Clinical", slug: "clinical", skills: [
        { name: "Nursing", slug: "nursing" },
        { name: "Medical Assisting", slug: "medical-assisting" },
        { name: "Phlebotomy", slug: "phlebotomy" },
        { name: "Patient Care", slug: "patient-care" },
      ]},
      { name: "Administrative", slug: "healthcare-admin", skills: [
        { name: "Medical Billing", slug: "medical-billing" },
        { name: "Scheduling", slug: "scheduling" },
        { name: "Medical Records", slug: "medical-records" },
        { name: "Insurance Verification", slug: "insurance-verification" },
      ]},
    ],
  },
  {
    name: "Technology", slug: "technology", subcategories: [
      { name: "Software", slug: "software", skills: [
        { name: "Web Development", slug: "web-development" },
        { name: "Mobile Development", slug: "mobile-development" },
        { name: "Database Management", slug: "database-management" },
        { name: "Cloud Services", slug: "cloud-services" },
      ]},
      { name: "IT Support", slug: "it-support", skills: [
        { name: "Networking", slug: "networking" },
        { name: "Help Desk", slug: "help-desk" },
        { name: "System Administration", slug: "system-administration" },
        { name: "Cybersecurity", slug: "cybersecurity" },
      ]},
    ],
  },
  {
    name: "Transportation", slug: "transportation", subcategories: [
      { name: "CDL Driving", slug: "cdl-driving", skills: [
        { name: "Class A CDL", slug: "class-a-cdl" },
        { name: "Class B CDL", slug: "class-b-cdl" },
        { name: "Hazmat Transport", slug: "hazmat-transport" },
      ]},
      { name: "Logistics", slug: "logistics", skills: [
        { name: "Warehousing", slug: "warehousing" },
        { name: "Dispatch", slug: "dispatch" },
        { name: "Inventory Management", slug: "inventory-management" },
        { name: "Supply Chain", slug: "supply-chain" },
      ]},
    ],
  },
  {
    name: "Retail", slug: "retail", subcategories: [
      { name: "Sales", slug: "retail-sales", skills: [
        { name: "Cashier", slug: "cashier" },
        { name: "Floor Sales", slug: "floor-sales" },
        { name: "Visual Merchandising", slug: "visual-merchandising" },
        { name: "Customer Service", slug: "customer-service" },
      ]},
      { name: "Management", slug: "retail-management", skills: [
        { name: "Store Manager", slug: "store-manager" },
        { name: "Assistant Manager", slug: "assistant-manager" },
        { name: "Shift Lead", slug: "shift-lead" },
      ]},
    ],
  },
  {
    name: "Construction", slug: "construction", subcategories: [
      { name: "General", slug: "general-construction", skills: [
        { name: "Framing", slug: "framing" },
        { name: "Concrete", slug: "concrete" },
        { name: "Roofing", slug: "roofing" },
        { name: "Drywall", slug: "drywall" },
      ]},
      { name: "Heavy Equipment", slug: "heavy-equipment", skills: [
        { name: "Crane Operation", slug: "crane-operation" },
        { name: "Excavator Operation", slug: "excavator-operation" },
        { name: "Bulldozer Operation", slug: "bulldozer-operation" },
        { name: "Forklift Operation", slug: "forklift-operation" },
      ]},
    ],
  },
];

const CREDENTIAL_ENTRIES = [
  { name: "ServSafe Food Handler", slug: "servsafe-food-handler", issuingBody: "National Restaurant Association", category: "Food Safety", typicalExpirationYears: 5, requiresJurisdiction: false, description: "Food safety certification for food service workers" },
  { name: "ServSafe Manager", slug: "servsafe-manager", issuingBody: "National Restaurant Association", category: "Food Safety", typicalExpirationYears: 5, requiresJurisdiction: false, description: "Advanced food safety certification for managers" },
  { name: "CPR/First Aid", slug: "cpr-first-aid", issuingBody: "American Red Cross / AHA", category: "Health & Safety", typicalExpirationYears: 2, requiresJurisdiction: false, description: "CPR and First Aid certification" },
  { name: "OSHA 10-Hour", slug: "osha-10-hour", issuingBody: "OSHA", category: "Workplace Safety", typicalExpirationYears: null, requiresJurisdiction: false, description: "10-hour OSHA safety training for general industry or construction" },
  { name: "OSHA 30-Hour", slug: "osha-30-hour", issuingBody: "OSHA", category: "Workplace Safety", typicalExpirationYears: null, requiresJurisdiction: false, description: "30-hour OSHA safety training for supervisors and managers" },
  { name: "State Insurance License", slug: "state-insurance-license", issuingBody: "State Department of Insurance", category: "Insurance", typicalExpirationYears: 2, requiresJurisdiction: true, description: "License to sell insurance products in a specific state" },
  { name: "Real Estate License", slug: "real-estate-license", issuingBody: "State Real Estate Commission", category: "Real Estate", typicalExpirationYears: 2, requiresJurisdiction: true, description: "License to practice real estate in a specific jurisdiction" },
  { name: "Forklift Certification", slug: "forklift-certification", issuingBody: "Employer / OSHA-compliant trainer", category: "Equipment Operation", typicalExpirationYears: 3, requiresJurisdiction: false, description: "Certification to operate powered industrial trucks" },
  { name: "Commercial Driver's License (CDL)", slug: "cdl", issuingBody: "State DMV", category: "Transportation", typicalExpirationYears: 5, requiresJurisdiction: true, description: "License for commercial motor vehicle operation" },
  { name: "CNA Certification", slug: "cna-certification", issuingBody: "State Nursing Board", category: "Healthcare", typicalExpirationYears: 2, requiresJurisdiction: true, description: "Certified Nursing Assistant certification" },
  { name: "EMT Certification", slug: "emt-certification", issuingBody: "NREMT / State EMS Office", category: "Healthcare", typicalExpirationYears: 2, requiresJurisdiction: true, description: "Emergency Medical Technician certification" },
  { name: "CompTIA A+", slug: "comptia-a-plus", issuingBody: "CompTIA", category: "Technology", typicalExpirationYears: 3, requiresJurisdiction: false, description: "IT support and hardware/software troubleshooting certification" },
  { name: "Security Guard License", slug: "security-guard-license", issuingBody: "State regulatory agency", category: "Security", typicalExpirationYears: 2, requiresJurisdiction: true, description: "License to work as a security guard" },
  { name: "Barber License", slug: "barber-license", issuingBody: "State Board of Barber Examiners", category: "Personal Services", typicalExpirationYears: 2, requiresJurisdiction: true, description: "License to practice barbering" },
  { name: "Cosmetology License", slug: "cosmetology-license", issuingBody: "State Board of Cosmetology", category: "Personal Services", typicalExpirationYears: 2, requiresJurisdiction: true, description: "License to practice cosmetology services" },
  { name: "HVAC EPA 608 Certification", slug: "hvac-epa-608", issuingBody: "EPA", category: "Trades", typicalExpirationYears: null, requiresJurisdiction: false, description: "Certification for handling refrigerants under Section 608 of the Clean Air Act" },
];

export async function seedWorkforceData() {
  const existingCats = await db.select({ id: skillCategories.id }).from(skillCategories).limit(1);
  if (existingCats.length > 0) {
    console.log("[Workforce Seed] Skill taxonomy already seeded, skipping");
  } else {
    console.log("[Workforce Seed] Seeding skill taxonomy...");
    let catOrder = 0;
    for (const cat of SKILL_TAXONOMY) {
      const [catRow] = await db.insert(skillCategories).values({
        name: cat.name,
        slug: cat.slug,
        sortOrder: catOrder++,
      }).returning();

      let subOrder = 0;
      for (const sub of cat.subcategories) {
        const [subRow] = await db.insert(skillSubcategories).values({
          categoryId: catRow.id,
          name: sub.name,
          slug: sub.slug,
          sortOrder: subOrder++,
        }).returning();

        let skillOrder = 0;
        for (const skill of sub.skills) {
          await db.insert(skillsTable).values({
            subcategoryId: subRow.id,
            name: skill.name,
            slug: skill.slug,
            sortOrder: skillOrder++,
          });
        }
      }
    }
    console.log("[Workforce Seed] Skill taxonomy seeded successfully");
  }

  const existingCreds = await db.select({ id: credentialDirectory.id }).from(credentialDirectory).limit(1);
  if (existingCreds.length > 0) {
    console.log("[Workforce Seed] Credential directory already seeded, skipping");
  } else {
    console.log("[Workforce Seed] Seeding credential directory...");
    for (const cred of CREDENTIAL_ENTRIES) {
      await db.insert(credentialDirectory).values(cred);
    }
    console.log("[Workforce Seed] Credential directory seeded successfully");
  }
}
