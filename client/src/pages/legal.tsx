import { useEffect, useState, useRef, forwardRef } from "react";
import { usePageMeta } from "@/hooks/use-page-meta";
import { useI18n } from "@/lib/i18n";
import { useSmartBack } from "@/hooks/use-smart-back";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ChevronDown, ChevronRight } from "lucide-react";

const SECTIONS = [
  { id: "terms", title: "Terms of Service" },
  { id: "privacy", title: "Privacy Policy" },
  { id: "content-policy", title: "Content & Ownership Policy" },
  { id: "acceptable-use", title: "Acceptable Use Policy" },
  { id: "disclaimer", title: "Disclaimer" },
  { id: "monetization", title: "Monetization & Platform Rights" },
  { id: "termination", title: "Termination" },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

const ROUTE_TO_SECTION: Record<string, SectionId> = {
  terms: "terms",
  privacy: "privacy",
  "content-policy": "content-policy",
  "acceptable-use": "acceptable-use",
  disclaimer: "disclaimer",
};

function getEffectiveDate() {
  return new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function LegalPage({
  citySlug,
  section,
}: {
  citySlug: string;
  section?: string;
}) {
  const { t } = useI18n();
  usePageMeta({
    title: "CLT Hub Legal | Terms, Privacy & Policies",
    description:
      "CLT Hub legal policies including Terms of Service, Privacy Policy, Content & Ownership, Acceptable Use, Disclaimer, Monetization Rights, and Termination.",
  });

  const smartBack = useSmartBack(`/${citySlug}`);
  const [activeSection, setActiveSection] = useState<SectionId>("terms");
  const [expandedSections, setExpandedSections] = useState<Set<SectionId>>(
    new Set(SECTIONS.map((s) => s.id))
  );
  const [isMobile, setIsMobile] = useState(false);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    if (section) {
      const targetId = ROUTE_TO_SECTION[section] || section;
      const el = sectionRefs.current[targetId];
      if (el) {
        setTimeout(() => {
          el.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 100);
      }
    }
  }, [section]);

  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (hash) {
      const el = sectionRefs.current[hash];
      if (el) {
        setTimeout(() => {
          el.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 100);
      }
    }
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id as SectionId);
          }
        }
      },
      { rootMargin: "-80px 0px -60% 0px", threshold: 0.1 }
    );
    for (const s of SECTIONS) {
      const el = sectionRefs.current[s.id];
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, []);

  const toggleSection = (id: SectionId) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, id: SectionId) => {
    e.preventDefault();
    const el = sectionRefs.current[id];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      window.history.replaceState(null, "", `#${id}`);
      if (isMobile && !expandedSections.has(id)) {
        setExpandedSections((prev) => new Set(prev).add(id));
      }
    }
  };

  return (
    <div className="max-w-7xl mx-auto py-8 px-4" data-testid="legal-page">
      <div className="mb-4">
        <Button variant="ghost" size="sm" className="gap-1" onClick={smartBack} data-testid="link-back-legal">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
      </div>
      <div className="mb-8" data-testid="legal-header">
        <h1 className="text-3xl font-bold mb-1" data-testid="legal-title">
          CLT Hub Legal
        </h1>
        <p className="text-sm text-muted-foreground" data-testid="legal-effective-date">
          Effective Date: {getEffectiveDate()}
        </p>
      </div>

      <div className="flex flex-col md:flex-row gap-8">
        <nav
          className="hidden md:block md:w-64 shrink-0"
          data-testid="legal-sidebar"
        >
          <div className="sticky top-24 space-y-1">
            <p className="text-xs font-semibold uppercase text-muted-foreground mb-3 tracking-wider">
              Sections
            </p>
            {SECTIONS.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                onClick={(e) => handleNavClick(e, s.id)}
                className={`block px-3 py-2 rounded-md text-sm transition-colors ${
                  activeSection === s.id
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
                data-testid={`nav-link-${s.id}`}
              >
                {s.title}
              </a>
            ))}
          </div>
        </nav>

        <div className="md:hidden mb-4" data-testid="legal-mobile-nav">
          <select
            value={activeSection}
            onChange={(e) => {
              const id = e.target.value as SectionId;
              const el = sectionRefs.current[id];
              if (el) {
                el.scrollIntoView({ behavior: "smooth", block: "start" });
                if (!expandedSections.has(id)) {
                  setExpandedSections((prev) => new Set(prev).add(id));
                }
              }
            }}
            className="w-full border rounded-md px-3 py-2 text-sm bg-background"
            data-testid="select-legal-section"
          >
            {SECTIONS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>
        </div>

        <main className="flex-1 min-w-0" data-testid="legal-content">
          <div className="mb-8 text-sm leading-relaxed text-foreground/90">
            <p className="mb-4">
              CLT Hub ("Platform," "Site," "we," "our," or "us") is a
              digital commerce, publication, listing, and advertising platform
              managed and operated by City Metro Hub ("Owner").
            </p>
            <p className="mb-4">
              By accessing, submitting content, purchasing services, subscribing,
              advertising, claiming listings, or participating in any capacity,
              you agree to these Terms.
            </p>
            <p className="font-semibold">
              If you do not agree, do not use the Platform.
            </p>
          </div>

          <LegalSection
            id="terms"
            title="1. Terms of Service"
            expanded={!isMobile || expandedSections.has("terms")}
            onToggle={() => toggleSection("terms")}
            isMobile={isMobile}
            ref={(el) => { sectionRefs.current["terms"] = el; }}
          >
            <h4 className="font-semibold mb-2">Eligibility</h4>
            <p className="mb-4">
              You must be at least 18 years of age to use this Platform. By
              accessing or using CLT Hub, you represent and warrant that you
              are at least 18 years old and have the legal capacity to enter into
              these Terms. If you are using the Platform on behalf of a business
              or organization, you represent that you have authority to bind that
              entity to these Terms.
            </p>
            <p className="mb-4">
              By using CLT Hub, you agree to be bound by these Terms. These
              Terms apply to all users, including visitors, registered members,
              advertisers, listing owners, content contributors, and operators.
            </p>
            <h4 className="font-semibold mb-2">Account Verification</h4>
            <p className="mb-4">
              City Metro Hub reserves the right to verify any account at any
              time. We may request identity verification, proof of business
              ownership, or other documentation. Failure to provide requested
              verification may result in account suspension or termination.
              City Metro Hub has absolute platform control and may take any
              verification action with or without notice.
            </p>
            <h4 className="font-semibold mb-2">Platform Structure</h4>
            <p className="mb-3">
              CLT Hub operates under a centralized licensing model. City
              Metro Hub retains exclusive ownership of:
            </p>
            <Bullets
              items={[
                "All intellectual property",
                "All trademarks and branding",
                "All domains",
                "All technology and platform code",
                "All data",
                "All subscriber records",
                "All payment processing accounts",
                "All advertising systems",
                "All pricing authority",
              ]}
            />
            <p className="mb-4">
              Metro and Micro operators, where applicable, operate solely under
              limited, revocable licensing agreements. No ownership rights are
              transferred to any operator.
            </p>
            <h4 className="font-semibold mb-2">Non-Franchise Declaration</h4>
            <p className="mb-4">
              Nothing contained herein or in any related agreement shall be
              construed to create a franchise, partnership, joint venture,
              employment relationship, or agency relationship. All Metro and
              Micro operators are independent licensed operators. No franchise
              relationship is created or intended.
            </p>
            <h4 className="font-semibold mb-2">Territory & Licensing</h4>
            <p className="mb-3">Territory rights, where granted, are:</p>
            <Bullets
              items={[
                "Conditional",
                "Performance-based",
                "Revocable",
                "Non-transferable",
                "Non-assignable without written approval",
              ]}
            />
            <p className="mb-4">
              Territory rights do not constitute ownership. City Metro Hub may
              modify, reassign, divide, or revoke territory rights at its sole
              discretion in accordance with applicable agreements.
            </p>
            <h4 className="font-semibold mb-2">
              All Sales Final — Strict No Refund Policy
            </h4>
            <p className="mb-2 font-bold">ALL SALES ARE FINAL.</p>
            <p className="mb-3 font-bold">
              NO REFUNDS WILL BE ISSUED UNDER ANY CIRCUMSTANCES.
            </p>
            <p className="mb-3">This includes:</p>
            <Bullets
              items={[
                "Membership subscriptions",
                "Listing upgrades",
                "Advertising purchases",
                "Sponsored content",
                "Event promotions",
                "Activation fees",
                "Licensing fees",
                "Platform fees",
                "Digital services",
              ]}
            />
            <p className="mb-4">
              Cancellation prevents future billing only. No prorated refunds. No
              refunds for dissatisfaction, underperformance, or unused services.
            </p>
            <h4 className="font-semibold mb-2">
              Chargeback & Payment Disputes
            </h4>
            <p className="mb-3">By completing any purchase, you agree:</p>
            <Bullets
              items={[
                "You understand all sales are final.",
                "You will not initiate a chargeback without first contacting support.",
                "You authorize City Metro Hub to provide transaction records, service logs, IP records, agreement acceptance records, and proof of service to the payment processor (including Stripe).",
              ]}
            />
            <p className="mb-3">If a chargeback is initiated:</p>
            <Bullets
              items={[
                "Access may be suspended immediately.",
                "Listings may be removed.",
                "Territory rights may be revoked.",
                "We reserve the right to contest the dispute.",
                "We reserve the right to pursue recovery of disputed funds, processor fees, administrative costs, and legal expenses where permitted.",
              ]}
            />
            <p>
              Fraudulent disputes may result in permanent removal from the
              Platform.
            </p>
          </LegalSection>

          <LegalSection
            id="privacy"
            title="2. Privacy Policy"
            expanded={!isMobile || expandedSections.has("privacy")}
            onToggle={() => toggleSection("privacy")}
            isMobile={isMobile}
            ref={(el) => { sectionRefs.current["privacy"] = el; }}
          >
            <h4 className="font-semibold mb-2">Information We Collect</h4>
            <p className="mb-3">We may collect:</p>
            <Bullets
              items={[
                "Name",
                "Email",
                "Phone number",
                "Business information",
                "Payment information (processed by third-party processors such as Stripe)",
                "IP address",
                "Device data",
                "Usage analytics",
                "Cookies",
              ]}
            />
            <h4 className="font-semibold mb-2">Public Submissions</h4>
            <p className="mb-4">
              Any content, listings, reviews, or information you submit to the
              Platform may be displayed publicly. By submitting content, you
              acknowledge and consent to its public display on the Platform,
              affiliated websites, social media channels, marketing materials,
              and any other medium operated by or on behalf of City Metro Hub.
            </p>
            <p className="mb-4 font-semibold">
              We do not sell personal information.
            </p>
            <h4 className="font-semibold mb-2">Information Sharing</h4>
            <p className="mb-3">Information may be shared with:</p>
            <Bullets
              items={[
                "Payment processors",
                "Hosting providers",
                "Analytics providers",
                "Legal authorities if required",
                "Affiliated metro and micro operators (limited access only)",
              ]}
            />
            <p className="mb-4">
              We implement reasonable safeguards but cannot guarantee absolute
              security.
            </p>
            <h4 className="font-semibold mb-2">Data Ownership</h4>
            <p className="mb-3">All data, including:</p>
            <Bullets
              items={[
                "Listings",
                "Subscriber data",
                "CRM records",
                "Advertising data",
                "Analytics",
                "Operator data",
              ]}
            />
            <p className="mb-4">
              Remain the exclusive property of City Metro Hub. Operators receive
              limited access only and have no ownership rights. Upon termination
              of any license or account, access is revoked immediately.
            </p>
            <h4 className="font-semibold mb-2">Data Deletion & Retention</h4>
            <p className="mb-4">
              Users may request data correction or deletion where legally
              permitted. However, we do not guarantee deletion of data from
              backups, cached copies, archived versions, or third-party systems
              that may have received your data prior to the deletion request.
              Certain data may be retained as required by law or for legitimate
              business purposes.
            </p>
            <h4 className="font-semibold mb-2">Children's Privacy</h4>
            <p>
              The Platform is not intended for children under 13. We do not
              knowingly collect personal information from children under 13. If
              we become aware that we have collected information from a child
              under 13, we will take steps to delete it.
            </p>
          </LegalSection>

          <LegalSection
            id="content-policy"
            title="3. Content & Ownership Policy"
            expanded={!isMobile || expandedSections.has("content-policy")}
            onToggle={() => toggleSection("content-policy")}
            isMobile={isMobile}
            ref={(el) => { sectionRefs.current["content-policy"] = el; }}
          >
            <h4 className="font-semibold mb-2">
              Listings & Public Information
            </h4>
            <p className="mb-3">The Platform may display:</p>
            <Bullets
              items={[
                "Publicly available business information",
                "User-submitted information",
                "AI-enhanced descriptions",
                "Event details",
                'Editorial content ("Pulses")',
              ]}
            />
            <p className="mb-4">
              We do not guarantee accuracy, completeness, timeliness, or
              correctness.
            </p>
            <p className="mb-3">CLT Hub is not liable for:</p>
            <Bullets
              items={[
                "Incorrect business information",
                "Outdated contact details",
                "Misrepresentations by third parties",
                "AI-generated inaccuracies",
                "Event cancellations or changes",
              ]}
            />
            <p className="mb-4">
              Businesses are responsible for reviewing and updating their
              information.
            </p>
            <h4 className="font-semibold mb-2">Listing Ownership</h4>
            <p className="mb-4">
              All listings displayed on the Platform are the property of City
              Metro Hub. Claiming or managing a listing does not transfer
              ownership of the listing itself. City Metro Hub may edit, remove,
              merge, or reassign any listing at any time without notice.
            </p>
            <h4 className="font-semibold mb-2">
              AI & Automation Disclaimer
            </h4>
            <p className="mb-4">
              The Platform may use automated systems or artificial intelligence
              to enhance content. We make no guarantees regarding the accuracy of
              automated outputs. Users are responsible for reviewing and
              correcting information.
            </p>
            <h4 className="font-semibold mb-2">Intellectual Property</h4>
            <p className="mb-4">
              All content, branding, code, design, and data on the Platform are
              the exclusive property of City Metro Hub unless otherwise stated.
              Unauthorized reproduction, distribution, or use is prohibited.
            </p>
            <h4 className="font-semibold mb-2">Content License Grant</h4>
            <p className="mb-4">
              By submitting content to the Platform, you grant City Metro Hub a
              perpetual, irrevocable, worldwide, royalty-free, non-exclusive,
              sublicensable, and transferable license to use, reproduce, modify,
              adapt, publish, translate, create derivative works from, distribute,
              perform, and display such content in any and all media and
              distribution channels, including but not limited to: the website,
              mobile applications, print publications, social media, video, TV,
              radio, marketing materials, and any future medium now known or
              hereafter developed.
            </p>
            <p>
              This license survives the termination of your account or
              relationship with the Platform.
            </p>
          </LegalSection>

          <LegalSection
            id="acceptable-use"
            title="4. Acceptable Use Policy"
            expanded={!isMobile || expandedSections.has("acceptable-use")}
            onToggle={() => toggleSection("acceptable-use")}
            isMobile={isMobile}
            ref={(el) => { sectionRefs.current["acceptable-use"] = el; }}
          >
            <p className="mb-3">You agree not to use the Platform to:</p>
            <Bullets
              items={[
                "Submit false, misleading, or fraudulent information",
                "Harass, threaten, or defame others",
                "Distribute spam, malware, or unauthorized advertising",
                "Scrape, mine, or harvest data without permission",
                "Attempt to gain unauthorized access to any system or account",
                "Interfere with the operation or security of the Platform",
                "Violate any applicable local, state, or federal law",
                "Impersonate any person, business, or entity",
                "Circumvent any access controls, rate limits, or security measures",
                "Use the Platform for any unlawful or unauthorized purpose",
              ]}
            />
            <p className="mb-4">
              Violation of this policy may result in immediate suspension or
              termination of your account and access to the Platform, without
              refund.
            </p>
            <h4 className="font-semibold mb-2">Platform Discretion</h4>
            <p className="mb-3">City Metro Hub reserves the right to:</p>
            <Bullets
              items={[
                "Refuse service",
                "Remove content",
                "Suspend accounts",
                "Modify pricing",
                "Adjust revenue splits",
                "Update platform features",
                "Modify policies",
                "Revoke licenses",
              ]}
            />
            <p>
              At any time, with or without notice, and without refund. City
              Metro Hub exercises absolute platform control over all aspects of
              the Platform's operation.
            </p>
          </LegalSection>

          <LegalSection
            id="disclaimer"
            title="5. Disclaimer"
            expanded={!isMobile || expandedSections.has("disclaimer")}
            onToggle={() => toggleSection("disclaimer")}
            isMobile={isMobile}
            ref={(el) => { sectionRefs.current["disclaimer"] = el; }}
          >
            <h4 className="font-semibold mb-2">General Disclaimer</h4>
            <p className="mb-4">
              THE PLATFORM IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT
              WARRANTIES OF ANY KIND, WHETHER EXPRESS OR IMPLIED, INCLUDING BUT
              NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR
              A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
            </p>
            <h4 className="font-semibold mb-2">Advertising Disclaimer</h4>
            <p className="mb-3">
              Advertising is a promotional service only. We do not guarantee:
            </p>
            <Bullets
              items={[
                "Traffic",
                "Click-through rates",
                "Leads",
                "Sales",
                "Revenue",
                "Ranking placement",
                "Performance outcomes",
              ]}
            />
            <p className="mb-4">
              Rotational and dynamic placement means advertisement position may
              vary. Advertising dissatisfaction does not qualify for refund.
            </p>
            <h4 className="font-semibold mb-2">Events Disclaimer</h4>
            <p className="mb-3">
              The Platform may publish or promote events submitted by third
              parties. We are not responsible for:
            </p>
            <Bullets
              items={[
                "Event cancellations",
                "Safety conditions",
                "Ticketing disputes",
                "Refund disputes",
                "Venue changes",
                "Organizer conduct",
              ]}
            />
            <p className="mb-4">
              All disputes must be handled directly with the event organizer.
            </p>
            <h4 className="font-semibold mb-2">Limitation of Liability</h4>
            <p className="mb-3">
              To the maximum extent permitted by law, CLT Hub and City
              Metro Hub shall not be liable for:
            </p>
            <Bullets
              items={[
                "Lost revenue",
                "Lost profits",
                "Business interruption",
                "Reputational harm",
                "Indirect or consequential damages",
                "Listing inaccuracies",
                "Advertising outcomes",
                "Operator disputes",
                "User disputes",
              ]}
            />
            <p className="mb-4">
              Total liability shall not exceed the amount paid by the user within
              the previous twelve (12) months.
            </p>
            <h4 className="font-semibold mb-2">Indemnification</h4>
            <p className="mb-3">
              You agree to indemnify and hold harmless CLT Hub and City
              Metro Hub from any claims arising from:
            </p>
            <Bullets
              items={[
                "Your business practices",
                "Your advertising",
                "Your submitted content",
                "Your event promotion",
                "Your misuse of the Platform",
                "Your breach of these Terms",
              ]}
            />
          </LegalSection>

          <LegalSection
            id="monetization"
            title="6. Monetization & Platform Rights"
            expanded={!isMobile || expandedSections.has("monetization")}
            onToggle={() => toggleSection("monetization")}
            isMobile={isMobile}
            ref={(el) => { sectionRefs.current["monetization"] = el; }}
          >
            <p className="mb-4">
              City Metro Hub reserves all rights to monetize the Platform in any
              manner it sees fit, including but not limited to:
            </p>
            <Bullets
              items={[
                "Subscription fees and membership plans",
                "Listing upgrade fees",
                "Advertising and sponsored content fees",
                "Activation and onboarding fees",
                "Licensing and territory fees",
                "Premium features and tools",
                "Data and analytics products",
                "Third-party integrations and partnerships",
              ]}
            />
            <h4 className="font-semibold mb-2">Advertising & Sponsorship Placement</h4>
            <p className="mb-4">
              City Metro Hub reserves the right to place advertisements,
              sponsored content, affiliate links, and paid placements anywhere
              on the Platform, including but not limited to: within listings,
              search results, directory pages, event pages, editorial content,
              email communications, push notifications, and any other area of
              the Platform. Paid placement may influence visibility, ranking,
              and positioning of content on the Platform.
            </p>
            <h4 className="font-semibold mb-2">Affiliate & Revenue Programs</h4>
            <p className="mb-4">
              City Metro Hub may insert affiliate links, referral codes, and
              tracking mechanisms into any content on the Platform. Revenue
              generated from affiliate programs, referral partnerships, and
              third-party integrations belongs exclusively to City Metro Hub
              unless otherwise agreed in a separate, signed agreement.
            </p>
            <h4 className="font-semibold mb-2">Pricing Authority</h4>
            <p className="mb-4">
              Pricing, fee structures, and revenue sharing terms are set at City
              Metro Hub's sole discretion and may be changed at any time with or
              without notice.
            </p>
            <p>
              No operator, advertiser, or user is entitled to a fixed pricing
              model or revenue share unless specifically documented in a
              separate, signed agreement.
            </p>
          </LegalSection>

          <LegalSection
            id="termination"
            title="7. Termination"
            expanded={!isMobile || expandedSections.has("termination")}
            onToggle={() => toggleSection("termination")}
            isMobile={isMobile}
            ref={(el) => { sectionRefs.current["termination"] = el; }}
          >
            <p className="mb-4">
              City Metro Hub may terminate or suspend your access to the
              Platform at any time, for any reason, with or without cause and
              with or without notice. Reasons for termination may include but are
              not limited to:
            </p>
            <Bullets
              items={[
                "Violation of these Terms",
                "Breach of acceptable use policies",
                "Fraudulent activity",
                "Chargeback or payment disputes",
                "Inactivity",
                "Operator agreement termination",
                "Business decision at the sole discretion of City Metro Hub",
              ]}
            />
            <p className="mb-4">
              Upon termination, all rights granted to you will immediately cease.
              You must stop all use of the Platform and any related materials.
            </p>
            <p className="mb-4">
              No refunds will be issued upon termination. Any outstanding
              balances owed to City Metro Hub remain due and payable.
            </p>
            <h4 className="font-semibold mb-2">Survival</h4>
            <p className="mb-4">
              The following provisions survive termination: Content License
              Grant, Data Ownership, Limitation of Liability, Indemnification,
              Governing Law, and any other provision that by its nature should
              survive.
            </p>
            <h4 className="font-semibold mb-2">Governing Law</h4>
            <p className="mb-4">
              These Terms are governed by the laws of the State of North
              Carolina. Any disputes shall be resolved exclusively in North
              Carolina courts.
            </p>
            <h4 className="font-semibold mb-2">Modifications</h4>
            <p className="mb-4">
              We may update these Terms at any time. Continued use of the
              Platform constitutes acceptance of revised Terms.
            </p>
            <h4 className="font-semibold mb-2">Contact</h4>
            <p>
              All inquiries must be submitted through official contact methods
              listed on the Platform.
            </p>
          </LegalSection>
        </main>
      </div>
    </div>
  );
}

const LegalSection = forwardRef<
  HTMLElement,
  {
    id: string;
    title: string;
    expanded: boolean;
    onToggle: () => void;
    isMobile: boolean;
    children: React.ReactNode;
  }
>(function LegalSection({ id, title, expanded, onToggle, isMobile, children }, ref) {
  return (
    <section
      id={id}
      ref={ref}
      className="mb-8 scroll-mt-24"
      data-testid={`legal-section-${id}`}
    >
      <button
        onClick={isMobile ? onToggle : undefined}
        className={`flex items-center gap-2 w-full text-left text-lg font-bold mb-3 border-b pb-2 ${
          isMobile ? "cursor-pointer" : "cursor-default"
        }`}
        data-testid={`toggle-section-${id}`}
      >
        {isMobile &&
          (expanded ? (
            <ChevronDown className="h-5 w-5 shrink-0" />
          ) : (
            <ChevronRight className="h-5 w-5 shrink-0" />
          ))}
        <span>{title}</span>
      </button>
      {expanded && (
        <div className="text-sm leading-relaxed text-foreground/90">
          {children}
        </div>
      )}
    </section>
  );
});

function Bullets({ items }: { items: string[] }) {
  return (
    <ul className="list-disc list-inside mb-4 space-y-1">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}
