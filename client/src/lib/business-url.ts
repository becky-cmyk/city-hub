export function getBusinessUrl(
  citySlug: string,
  businessSlug: string,
  categoryIds: string[],
  categories?: { id: string; slug: string }[]
): string {
  if (categories && categoryIds.length > 0) {
    const primaryCat = categories.find((c) => categoryIds.includes(c.id));
    if (primaryCat) {
      return `/${citySlug}/${primaryCat.slug}/${businessSlug}`;
    }
  }
  return `/${citySlug}/directory/${businessSlug}`;
}

export function getBusinessCanonicalUrl(
  origin: string,
  citySlug: string,
  businessSlug: string,
  categorySlug?: string
): string {
  if (categorySlug) {
    return `${origin}/${citySlug}/${categorySlug}/${businessSlug}`;
  }
  return `${origin}/${citySlug}/directory/${businessSlug}`;
}
