import type { MicrositeTemplate } from "@shared/schema";

export interface TemplateStyle {
  id: MicrositeTemplate;
  name: string;
  description: string;
  fontHeading: string;
  fontBody: string;
  sectionSpacing: string;
  heroLayout: "centered" | "left-aligned" | "split" | "overlay";
  borderRadius: string;
  buttonStyle: string;
  cardStyle: string;
  navStyle: string;
  sectionDivider: "none" | "line" | "gradient" | "wave";
  headingWeight: string;
  headingCase: "normal" | "uppercase" | "capitalize";
}

export const TEMPLATE_STYLES: Record<MicrositeTemplate, TemplateStyle> = {
  modern: {
    id: "modern",
    name: "Modern",
    description: "Clean, minimal, and contemporary",
    fontHeading: "'Inter', system-ui, sans-serif",
    fontBody: "'Inter', system-ui, sans-serif",
    sectionSpacing: "py-16 md:py-24",
    heroLayout: "centered",
    borderRadius: "rounded-md",
    buttonStyle: "rounded-md px-6 py-3 font-medium tracking-wide",
    cardStyle: "rounded-md border border-border/50",
    navStyle: "backdrop-blur-md bg-background/80",
    sectionDivider: "none",
    headingWeight: "font-bold",
    headingCase: "normal",
  },
  classic: {
    id: "classic",
    name: "Classic",
    description: "Traditional, warm, and inviting",
    fontHeading: "'Georgia', 'Times New Roman', serif",
    fontBody: "'Inter', system-ui, sans-serif",
    sectionSpacing: "py-14 md:py-20",
    heroLayout: "left-aligned",
    borderRadius: "rounded-md",
    buttonStyle: "rounded-md px-6 py-3 font-medium",
    cardStyle: "rounded-md border border-border",
    navStyle: "bg-background border-b border-border",
    sectionDivider: "line",
    headingWeight: "font-semibold",
    headingCase: "normal",
  },
  bold: {
    id: "bold",
    name: "Bold",
    description: "High-contrast, impactful, and energetic",
    fontHeading: "'Inter', system-ui, sans-serif",
    fontBody: "'Inter', system-ui, sans-serif",
    sectionSpacing: "py-16 md:py-24",
    heroLayout: "overlay",
    borderRadius: "rounded-md",
    buttonStyle: "rounded-md px-8 py-4 font-bold uppercase tracking-widest text-sm",
    cardStyle: "rounded-md border-2 border-border",
    navStyle: "bg-foreground text-background",
    sectionDivider: "gradient",
    headingWeight: "font-extrabold",
    headingCase: "uppercase",
  },
  elegant: {
    id: "elegant",
    name: "Elegant",
    description: "Refined, sophisticated, and luxurious",
    fontHeading: "'Georgia', 'Times New Roman', serif",
    fontBody: "'Georgia', 'Times New Roman', serif",
    sectionSpacing: "py-16 md:py-24",
    heroLayout: "split",
    borderRadius: "rounded-md",
    buttonStyle: "rounded-md px-8 py-3 font-medium tracking-wider text-sm border",
    cardStyle: "rounded-md border border-border/30",
    navStyle: "backdrop-blur-md bg-background/90 border-b border-border/30",
    sectionDivider: "wave",
    headingWeight: "font-semibold",
    headingCase: "capitalize",
  },
};

export function getTemplateStyle(template: string): TemplateStyle {
  return TEMPLATE_STYLES[template as MicrositeTemplate] || TEMPLATE_STYLES.modern;
}

export function getTemplateVars(template: string, accentColor?: string) {
  const style = getTemplateStyle(template);
  return {
    "--ms-font-heading": style.fontHeading,
    "--ms-font-body": style.fontBody,
    "--ms-accent": accentColor || "hsl(var(--primary))",
  } as Record<string, string>;
}
