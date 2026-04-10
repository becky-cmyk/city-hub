export const PROFILE_TYPES = [
  "resident",
  "business",
  "creator",
  "expert",
  "employer",
  "organization",
] as const;

export type ProfileType = typeof PROFILE_TYPES[number];

export const PROFILE_TYPE_MODULES: Record<ProfileType, string[]> = {
  resident: [
    "directory_listing",
    "community_posting",
    "events",
    "saved_items",
    "reviews",
    "feed",
  ],
  business: [
    "directory_listing",
    "basic_profile",
    "claim_management",
    "community_posting",
    "microsite",
    "gallery",
    "media_blocks",
    "badges",
    "priority_ranking",
    "custom_domain",
    "faq",
    "internal_reviews",
    "external_reviews",
    "marketplace",
    "storefront",
  ],
  creator: [
    "community_posting",
    "video_channel",
    "podcast_channel",
    "creator_tools",
    "feed",
    "gallery",
    "media_blocks",
  ],
  expert: [
    "community_posting",
    "expert_qa_hosting",
    "expert_qa",
    "feed",
  ],
  employer: [
    "jobs",
    "job_board",
    "community_posting",
    "feed",
  ],
  organization: [
    "directory_listing",
    "basic_profile",
    "claim_management",
    "community_posting",
    "events",
    "event_hosting",
    "feed",
  ],
};

export function getVisibleModulesForProfileTypes(profileTypes: ProfileType[]): string[] {
  const modules = new Set<string>();
  for (const pt of profileTypes) {
    const ptModules = PROFILE_TYPE_MODULES[pt];
    if (ptModules) {
      for (const m of ptModules) {
        modules.add(m);
      }
    }
  }
  return Array.from(modules);
}

export function getVisibleModulesForActiveType(activeType: ProfileType): string[] {
  return PROFILE_TYPE_MODULES[activeType] || [];
}

export function isModuleVisibleForProfileTypes(profileTypes: ProfileType[], moduleKey: string): boolean {
  if (profileTypes.length === 0) return true;
  return getVisibleModulesForProfileTypes(profileTypes).includes(moduleKey);
}

export function isModuleVisibleForActiveType(activeType: ProfileType, moduleKey: string): boolean {
  const modules = PROFILE_TYPE_MODULES[activeType];
  return modules ? modules.includes(moduleKey) : false;
}
