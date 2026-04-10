import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ZoneSelect } from "@/components/zone-select";
import { useState, useMemo, useCallback } from "react";
import { useLocation } from "wouter";
import { useI18n } from "@/lib/i18n";

interface SearchBarProps {
  citySlug: string;
  placeholder?: string;
  className?: string;
  size?: "default" | "large";
  zones?: { id: string; slug: string; name: string }[];
  categories?: { id: string; slug: string; name: string; parentCategoryId?: string | null }[];
  showFilters?: boolean;
  mode?: "quick" | "directory";
}

export function SearchBar({ citySlug, placeholder, className = "", size = "default", zones, categories, showFilters, mode = "quick" }: SearchBarProps) {
  const [query, setQuery] = useState("");
  const [selectedZone, setSelectedZone] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedSubcategory, setSelectedSubcategory] = useState("");
  const [selectedSubtype, setSelectedSubtype] = useState("");
  const [, setLocation] = useLocation();
  const { t } = useI18n();
  const resolvedPlaceholder = placeholder || t("search.placeholder");

  const parentCategories = useMemo(() =>
    categories?.filter((c) => !c.parentCategoryId) || [],
    [categories]
  );

  const subcategories = useMemo(() => {
    if (!selectedCategory || selectedCategory === "all" || !categories) return [];
    const parent = categories.find((c) => c.slug === selectedCategory && !c.parentCategoryId);
    if (!parent) return [];
    return categories.filter((c) => c.parentCategoryId === parent.id);
  }, [selectedCategory, categories]);

  const subtypes = useMemo(() => {
    if (!selectedSubcategory || selectedSubcategory === "all" || !categories) return [];
    const sub = categories.find((c) => c.slug === selectedSubcategory);
    if (!sub) return [];
    return categories.filter((c) => c.parentCategoryId === sub.id);
  }, [selectedSubcategory, categories]);

  const handleCategoryChange = useCallback((val: string) => {
    setSelectedCategory(val);
    setSelectedSubcategory("");
    setSelectedSubtype("");
  }, []);

  const handleSubcategoryChange = useCallback((val: string) => {
    setSelectedSubcategory(val);
    setSelectedSubtype("");
  }, []);

  const handleSearch = useCallback(() => {
    const q = query.trim();
    if (mode === "directory") {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (selectedZone && selectedZone !== "all") params.set("zone", selectedZone);
      if (selectedCategory && selectedCategory !== "all") params.set("category", selectedCategory);
      if (selectedSubcategory && selectedSubcategory !== "all") params.set("subcategory", selectedSubcategory);
      if (selectedSubtype && selectedSubtype !== "all") params.set("subtype", selectedSubtype);
      const qs = params.toString();
      setLocation(`/${citySlug}/directory${qs ? `?${qs}` : ""}`);
    } else {
      if (q) {
        window.dispatchEvent(new CustomEvent("open-quick-search", { detail: { query: q } }));
        setQuery("");
      } else {
        window.dispatchEvent(new CustomEvent("open-quick-search"));
      }
    }
    if (q) {
      const deepestCategory = (selectedSubtype && selectedSubtype !== "all")
        ? selectedSubtype
        : (selectedSubcategory && selectedSubcategory !== "all")
          ? selectedSubcategory
          : selectedCategory;
      try {
        fetch("/api/log/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cityId: citySlug, language: document.documentElement.lang || "en", queryText: q, categoryId: deepestCategory !== "all" ? deepestCategory : undefined }),
        }).catch(() => {});
      } catch {}
    }
  }, [query, selectedZone, selectedCategory, selectedSubcategory, selectedSubtype, citySlug, mode, setLocation]);

  const isLarge = size === "large";

  return (
    <div className={className}>
      {showFilters && (zones || categories) && (
        <div className="flex gap-2 mb-2 justify-center flex-wrap">
          {zones && zones.length > 0 && (
            <ZoneSelect zones={zones} value={selectedZone} onValueChange={setSelectedZone} triggerClassName="w-[160px] h-9 bg-white/90 dark:bg-background/90 text-sm border-white/30" testId="select-hero-zone" />
          )}
          {parentCategories.length > 0 && (
            <Select value={selectedCategory} onValueChange={handleCategoryChange}>
              <SelectTrigger className="w-[170px] h-9 bg-white/90 dark:bg-background/90 text-sm border-white/30" data-testid="select-hero-category">
                <SelectValue placeholder={t("directory.allCategories")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("directory.allCategories")}</SelectItem>
                {parentCategories.map((c) => (
                  <SelectItem key={c.id} value={c.slug}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {subcategories.length > 0 && (
            <Select value={selectedSubcategory} onValueChange={handleSubcategoryChange}>
              <SelectTrigger className="w-[170px] h-9 bg-white/90 dark:bg-background/90 text-sm border-white/30" data-testid="select-hero-subcategory">
                <SelectValue placeholder={t("map.allSubcategories")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("map.allSubcategories")}</SelectItem>
                {subcategories.map((c) => (
                  <SelectItem key={c.id} value={c.slug}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {subtypes.length > 0 && (
            <Select value={selectedSubtype} onValueChange={setSelectedSubtype}>
              <SelectTrigger className="w-[170px] h-9 bg-white/90 dark:bg-background/90 text-sm border-white/30" data-testid="select-hero-subtype">
                <SelectValue placeholder={t("map.allSubtypes")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("map.allSubtypes")}</SelectItem>
                {subtypes.map((c) => (
                  <SelectItem key={c.id} value={c.slug}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      )}
      <div className="relative">
        <Search className={`absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground ${isLarge ? "h-5 w-5" : "h-4 w-4"}`} />
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          placeholder={resolvedPlaceholder}
          className={`${isLarge ? "h-12 pl-11 pr-12 text-base border-border/80 shadow-sm focus-visible:shadow-md" : "h-9 pl-9 pr-10 text-sm"}`}
          data-testid="input-search"
        />
        {query && (
          <button
            onClick={() => setQuery("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            data-testid="button-clear-search"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
