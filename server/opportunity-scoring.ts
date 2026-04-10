import type { Business } from "@shared/schema";

type ProfileResponses = Record<string, { answer: string | string[]; answeredAt: string }>;

function getAnswer(responses: ProfileResponses, questionId: string): string | string[] | null {
  const entry = responses[questionId];
  return entry ? entry.answer : null;
}

function answerIs(responses: ProfileResponses, questionId: string, ...values: string[]): boolean {
  const a = getAnswer(responses, questionId);
  if (!a) return false;
  if (Array.isArray(a)) return a.some(v => values.includes(v));
  return values.includes(a);
}

function answerIncludes(responses: ProfileResponses, questionId: string, ...values: string[]): boolean {
  const a = getAnswer(responses, questionId);
  if (!a) return false;
  if (Array.isArray(a)) return a.some(v => values.includes(v));
  return values.includes(a);
}

function hasScreens(responses: ProfileResponses): boolean {
  return answerIs(responses, "screens_count", "1", "2-3", "4+");
}

export function computeOpportunityScores(
  business: Partial<Business>,
  responses: ProfileResponses
): { hubTv: number; listingUpgrade: number; adBuyer: number; eventPartner: number; overall: number } {
  let hubTv = 0;
  let listingUpgrade = 0;
  let adBuyer = 0;
  let eventPartner = 0;

  if (hasScreens(responses)) hubTv += 30;
  if (answerIs(responses, "screen_provider", "none", "other") || (!getAnswer(responses, "screen_provider") && business.venueScreenLikely)) hubTv += 25;
  if (answerIs(responses, "screen_switch", "yes")) hubTv += 25;
  else if (answerIs(responses, "screen_switch", "maybe")) hubTv += 12;
  if (business.venueScreenLikely) hubTv += 20;

  if (business.websiteUrl) listingUpgrade += 15;
  const rating = business.googleRating ? parseFloat(business.googleRating) : 0;
  if (rating >= 4) listingUpgrade += 15;
  if (!answerIs(responses, "ad_spend", "0") && getAnswer(responses, "ad_spend")) listingUpgrade += 20;
  if (answerIs(responses, "location_count", "2-3", "4-5", "6+")) listingUpgrade += 20;
  if (answerIncludes(responses, "biggest_need", "online-visibility")) listingUpgrade += 15;
  if (answerIs(responses, "hosts_events", "regularly", "occasionally")) listingUpgrade += 15;

  const adChannels = getAnswer(responses, "ad_channels");
  if (adChannels && Array.isArray(adChannels) && !adChannels.includes("none") && adChannels.length > 0) adBuyer += 30;
  if (answerIs(responses, "ad_spend", "200-500", "500-1000", "1000+")) adBuyer += 25;
  if (answerIs(responses, "location_count", "2-3", "4-5", "6+")) adBuyer += 20;
  if (answerIncludes(responses, "biggest_need", "foot-traffic")) adBuyer += 15;
  if (answerIncludes(responses, "biggest_need", "local-partnerships")) adBuyer += 10;

  if (answerIs(responses, "hosts_events", "regularly")) eventPartner += 40;
  else if (answerIs(responses, "hosts_events", "occasionally")) eventPartner += 20;
  else if (answerIs(responses, "hosts_events", "interested")) eventPartner += 10;
  if (answerIncludes(responses, "biggest_need", "event-promotion")) eventPartner += 25;
  if (business.venueScreenLikely) eventPartner += 15;

  hubTv = Math.min(hubTv, 100);
  listingUpgrade = Math.min(listingUpgrade, 100);
  adBuyer = Math.min(adBuyer, 100);
  eventPartner = Math.min(eventPartner, 100);

  const overall = Math.round(hubTv * 0.25 + listingUpgrade * 0.30 + adBuyer * 0.25 + eventPartner * 0.20);

  return { hubTv, listingUpgrade, adBuyer, eventPartner, overall };
}

export function getBestEntryPoint(scores: { hubTv: number; listingUpgrade: number; adBuyer: number; eventPartner: number }): string {
  const entries: [string, number][] = [
    ["Hub TV", scores.hubTv],
    ["Enhanced Listing", scores.listingUpgrade],
    ["Pulse Advertising", scores.adBuyer],
    ["Event Sponsorship", scores.eventPartner],
  ];
  entries.sort((a, b) => b[1] - a[1]);
  return entries[0][0];
}
