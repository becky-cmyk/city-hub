import { useState, useEffect } from "react";
import { Quote } from "lucide-react";
import {
  getQuotesForPage,
  type PageContext,
  type InspirationQuote,
} from "@shared/inspirational-quotes";

interface InspirationQuoteBlockProps {
  pageContext: PageContext;
  inspirationName?: string | null;
  variant?: "default" | "dark" | "subtle";
  className?: string;
}

export function InspirationQuoteBlock({
  pageContext,
  inspirationName,
  variant = "default",
  className = "",
}: InspirationQuoteBlockProps) {
  const [quote, setQuote] = useState<InspirationQuote | null>(null);

  useEffect(() => {
    const quotes = getQuotesForPage(pageContext, inspirationName);
    if (quotes.length > 0) {
      setQuote(quotes[Math.floor(Math.random() * quotes.length)]);
    }
  }, [pageContext, inspirationName]);

  if (!quote) return null;

  if (variant === "dark") {
    return (
      <div
        className={`relative py-6 px-6 sm:px-8 ${className}`}
        data-testid="inspiration-quote-block"
      >
        <div className="max-w-2xl mx-auto flex items-start gap-3">
          <Quote className="h-5 w-5 text-white/20 shrink-0 mt-0.5" />
          <div className="space-y-1.5">
            <p
              className="text-sm sm:text-base text-white/70 italic leading-relaxed"
              data-testid="text-quote-content"
            >
              {quote.text}
            </p>
            <p
              className="text-xs text-white/40"
              data-testid="text-quote-author"
            >
              — {quote.author}
              {quote.authorTitle ? `, ${quote.authorTitle}` : ""}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (variant === "subtle") {
    return (
      <div
        className={`py-4 px-4 ${className}`}
        data-testid="inspiration-quote-block"
      >
        <div className="max-w-xl mx-auto flex items-start gap-2.5">
          <Quote className="h-4 w-4 text-muted-foreground/30 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p
              className="text-xs sm:text-sm text-muted-foreground italic leading-relaxed"
              data-testid="text-quote-content"
            >
              {quote.text}
            </p>
            <p
              className="text-[11px] text-muted-foreground/60"
              data-testid="text-quote-author"
            >
              — {quote.author}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`py-5 px-4 ${className}`}
      data-testid="inspiration-quote-block"
    >
      <div className="max-w-2xl mx-auto rounded-md border border-[#5B1D8F]/10 bg-[#5B1D8F]/[0.03] dark:bg-[#5B1D8F]/[0.08] px-5 py-4">
        <div className="flex items-start gap-3">
          <Quote className="h-5 w-5 text-[#5B1D8F]/30 shrink-0 mt-0.5" />
          <div className="space-y-1.5">
            <p
              className="text-sm sm:text-base text-foreground/80 italic leading-relaxed"
              data-testid="text-quote-content"
            >
              {quote.text}
            </p>
            <p
              className="text-xs text-muted-foreground"
              data-testid="text-quote-author"
            >
              — {quote.author}
              {quote.authorTitle ? `, ${quote.authorTitle}` : ""}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
