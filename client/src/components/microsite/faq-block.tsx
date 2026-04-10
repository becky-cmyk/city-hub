import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import type { MicrositeBlock } from "@shared/schema";
import type { TemplateStyle } from "./templates";
import { t, type Locale } from "./block-renderer";
import { JsonLd } from "@/components/json-ld";

interface FaqBlockProps {
  block: MicrositeBlock;
  template: TemplateStyle;
  accentColor: string;
  locale: Locale;
  businessFaqs?: { id: string; question: string; answer: string; sortOrder: number }[];
  businessName?: string;
}

export function FaqBlock({ block, template, accentColor, locale, businessFaqs, businessName }: FaqBlockProps) {
  const { headline, items } = block.content;
  const blockItems = (items || []).map((item: any, i: number) => ({
    id: `block-faq-${i}`,
    question: (t(item.question || item.q, locale) || "").trim(),
    answer: (t(item.answer || item.a, locale) || "").trim(),
  })).filter((item) => item.question && item.answer);

  const aeoItems = (businessFaqs || [])
    .filter((faq) => faq.question?.trim() && faq.answer?.trim())
    .map((faq) => ({
      id: faq.id,
      question: faq.question.trim(),
      answer: faq.answer.trim(),
    }));

  const blockQuestions = new Set(blockItems.map((item: any) => item.question.toLowerCase()));
  const dedupedAeoItems = aeoItems.filter(
    (item) => !blockQuestions.has(item.question.toLowerCase())
  );

  const allItems = [...blockItems, ...dedupedAeoItems];

  const defaultHeadline = businessName
    ? (locale === "es" ? `Preguntas Frecuentes sobre ${businessName}` : `Common Questions About ${businessName}`)
    : (locale === "es" ? "Preguntas Frecuentes" : "Frequently Asked Questions");
  const headlineText = t(headline, locale) || defaultHeadline;
  const headingClass = `${template.headingWeight} ${template.headingCase === "uppercase" ? "uppercase" : ""}`;

  if (allItems.length === 0) return null;

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: allItems.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };

  return (
    <section id="faq" className={`${template.sectionSpacing} px-6 md:px-8`} data-testid="block-faq">
      <div className="max-w-3xl mx-auto">
        <h2
          className={`text-3xl md:text-4xl ${headingClass} text-center mb-12`}
          style={{ fontFamily: template.fontHeading, color: accentColor }}
          data-testid="text-faq-headline"
        >
          {headlineText}
        </h2>
        <Accordion type="single" collapsible className="w-full">
          {allItems.map((item: any, i: number) => (
            <AccordionItem key={item.id} value={`faq-${i}`} data-testid={`faq-item-${i}`}>
              <AccordionTrigger className="text-left font-medium" style={{ fontFamily: template.fontHeading }}>
                {item.question}
              </AccordionTrigger>
              <AccordionContent>
                <p className="text-muted-foreground leading-relaxed" style={{ fontFamily: template.fontBody }}>
                  {item.answer}
                </p>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
      <JsonLd data={faqJsonLd} />
    </section>
  );
}
