import { useEffect, useRef } from "react";
import { useI18n } from "@/lib/i18n";

let cachedCityId: string | null = null;

async function getCityId(): Promise<string | null> {
  if (cachedCityId) return cachedCityId;
  try {
    const res = await fetch("/api/cities/charlotte");
    if (res.ok) {
      const data = await res.json();
      cachedCityId = data.id;
      return data.id;
    }
  } catch {}
  return null;
}

export function usePageLogger(pageType: string, pageRefId?: string | null) {
  const { locale } = useI18n();
  const logged = useRef(false);

  useEffect(() => {
    if (logged.current) return;
    logged.current = true;

    (async () => {
      try {
        const cityId = await getCityId();
        if (!cityId) return;
        fetch("/api/log/page-view", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            cityId,
            pageType,
            pageRefId: pageRefId || undefined,
            language: locale,
          }),
        }).catch(() => {});
      } catch {}
    })();
  }, [pageType, pageRefId, locale]);
}

export async function logLanguageToggle(newLanguage: string, pageType?: string) {
  try {
    const cityId = await getCityId();
    if (!cityId) return;
    fetch("/api/log/language-toggle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cityId,
        pageType: pageType || "unknown",
        language: newLanguage,
      }),
    }).catch(() => {});
  } catch {}
}

export async function logSearch(queryText: string, language: string, categoryId?: string) {
  try {
    const cityId = await getCityId();
    if (!cityId) return;
    fetch("/api/log/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cityId,
        language,
        queryText,
        categoryId: categoryId || undefined,
      }),
    }).catch(() => {});
  } catch {}
}
