import { useEffect } from "react";

interface PageMeta {
  title: string;
  description?: string;
  canonical?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  ogUrl?: string;
  ogType?: string;
  ogSiteName?: string;
  twitterCard?: string;
  twitterTitle?: string;
  twitterDescription?: string;
  twitterImage?: string;
  keywords?: string;
}

function setMeta(attr: string, attrValue: string, content: string): HTMLMetaElement {
  let el = document.querySelector(`meta[${attr}="${attrValue}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, attrValue);
    document.head.appendChild(el);
  }
  el.content = content;
  return el;
}

function clearMeta(attr: string, attrValue: string) {
  const el = document.querySelector(`meta[${attr}="${attrValue}"]`) as HTMLMetaElement | null;
  if (el) el.content = "";
}

function setHreflangLink(lang: string, href: string): HTMLLinkElement {
  let el = document.querySelector(`link[rel="alternate"][hreflang="${lang}"]`) as HTMLLinkElement | null;
  if (!el) {
    el = document.createElement("link");
    el.rel = "alternate";
    el.setAttribute("hreflang", lang);
    document.head.appendChild(el);
  }
  el.href = href;
  return el;
}

function removeHreflangLinks() {
  document.querySelectorAll('link[rel="alternate"][hreflang]').forEach(el => el.remove());
}

function buildHreflangUrls(canonical: string): { en: string; es: string } {
  const url = new URL(canonical, window.location.origin);
  const enUrl = new URL(url.toString());
  enUrl.searchParams.delete("lang");
  const esUrl = new URL(url.toString());
  esUrl.searchParams.set("lang", "es");
  return { en: enUrl.toString(), es: esUrl.toString() };
}

export function usePageMeta(meta: PageMeta) {
  useEffect(() => {
    document.title = meta.title;

    if (meta.description) setMeta("name", "description", meta.description);
    if (meta.keywords) setMeta("name", "keywords", meta.keywords);

    let linkCanon = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (meta.canonical) {
      if (!linkCanon) {
        linkCanon = document.createElement("link");
        linkCanon.rel = "canonical";
        document.head.appendChild(linkCanon);
      }
      linkCanon.href = meta.canonical;
    }

    const canonicalUrl = meta.canonical || meta.ogUrl || window.location.href;
    const hreflangUrls = buildHreflangUrls(canonicalUrl);
    setHreflangLink("en", hreflangUrls.en);
    setHreflangLink("es", hreflangUrls.es);
    setHreflangLink("x-default", hreflangUrls.en);

    if (meta.ogTitle || meta.title) setMeta("property", "og:title", meta.ogTitle || meta.title);
    if (meta.ogDescription || meta.description) setMeta("property", "og:description", meta.ogDescription || meta.description || "");
    if (meta.ogType) setMeta("property", "og:type", meta.ogType);
    if (meta.ogUrl || meta.canonical) setMeta("property", "og:url", meta.ogUrl || meta.canonical || "");
    if (meta.ogImage) setMeta("property", "og:image", meta.ogImage);
    setMeta("property", "og:site_name", meta.ogSiteName || "CLT Metro Hub");

    const tCard = meta.twitterCard || "summary_large_image";
    setMeta("name", "twitter:card", tCard);
    if (meta.twitterTitle || meta.ogTitle || meta.title) setMeta("name", "twitter:title", meta.twitterTitle || meta.ogTitle || meta.title);
    if (meta.twitterDescription || meta.ogDescription || meta.description) setMeta("name", "twitter:description", meta.twitterDescription || meta.ogDescription || meta.description || "");
    if (meta.twitterImage || meta.ogImage) setMeta("name", "twitter:image", meta.twitterImage || meta.ogImage || "");

    return () => {
      document.title = "CityMetroHub";
      clearMeta("name", "description");
      clearMeta("name", "keywords");
      if (linkCanon) linkCanon.href = "";
      removeHreflangLinks();
      clearMeta("property", "og:title");
      clearMeta("property", "og:description");
      clearMeta("property", "og:type");
      clearMeta("property", "og:url");
      clearMeta("property", "og:image");
      clearMeta("property", "og:site_name");
      clearMeta("name", "twitter:card");
      clearMeta("name", "twitter:title");
      clearMeta("name", "twitter:description");
      clearMeta("name", "twitter:image");
    };
  }, [meta.title, meta.description, meta.canonical, meta.ogTitle, meta.ogDescription, meta.ogImage, meta.ogUrl, meta.ogType, meta.ogSiteName, meta.twitterCard, meta.twitterTitle, meta.twitterDescription, meta.twitterImage, meta.keywords]);
}
