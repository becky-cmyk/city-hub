import { db } from "../db";
import { zones } from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";

export async function resolveZipToZoneId(zipCode: string | null | undefined, cityId: string): Promise<string | null> {
  if (!zipCode) return null;
  const cleaned = zipCode.trim();
  if (!cleaned) return null;

  const results = await db
    .select({ id: zones.id })
    .from(zones)
    .where(
      and(
        eq(zones.cityId, cityId),
        eq(zones.type, "ZIP"),
        sql`${cleaned} = ANY(${zones.zipCodes})`
      )
    )
    .limit(1);

  return results.length > 0 ? results[0].id : null;
}

export interface RawBusinessFiling {
  businessName: string;
  filingDate?: string;
  stateCode?: string;
  filingExternalId?: string;
  status?: string;
  industryCode?: string;
  organizerName?: string;
  registeredAgent?: string;
  registeredAddress?: string;
  mailingAddress?: string;
  zipCode?: string;
  source?: string;
  sourceUrl?: string;
  notes?: string;
}

export interface NormalizedBusinessFiling {
  cityId: string;
  stateCode: string;
  filingExternalId: string | null;
  businessName: string;
  filingDate: string | null;
  status: string | null;
  industryCode: string | null;
  organizerName: string | null;
  registeredAgent: string | null;
  registeredAddress: string | null;
  mailingAddress: string | null;
  zoneId: string | null;
  source: string;
  sourceUrl: string | null;
  notes: string | null;
}

export async function normalizeBusinessFiling(
  raw: RawBusinessFiling,
  cityId: string
): Promise<NormalizedBusinessFiling> {
  const stateCode = (raw.stateCode || "NC").toUpperCase().trim();
  const businessName = (raw.businessName || "").trim();

  let filingDate: string | null = null;
  if (raw.filingDate) {
    const d = new Date(raw.filingDate);
    if (!isNaN(d.getTime())) {
      filingDate = d.toISOString().split("T")[0];
    } else {
      filingDate = raw.filingDate.trim();
    }
  }

  let zipCode: string | null = raw.zipCode || null;
  if (!zipCode && raw.registeredAddress) {
    const match = raw.registeredAddress.match(/\b(\d{5})\b/);
    if (match) zipCode = match[1];
  }

  const zoneId = await resolveZipToZoneId(zipCode, cityId);

  return {
    cityId,
    stateCode,
    filingExternalId: raw.filingExternalId?.trim() || null,
    businessName,
    filingDate,
    status: raw.status?.trim() || null,
    industryCode: raw.industryCode?.trim() || null,
    organizerName: raw.organizerName?.trim() || null,
    registeredAgent: raw.registeredAgent?.trim() || null,
    registeredAddress: raw.registeredAddress?.trim() || null,
    mailingAddress: raw.mailingAddress?.trim() || null,
    zoneId,
    source: raw.source?.trim() || "manual",
    sourceUrl: raw.sourceUrl?.trim() || null,
    notes: raw.notes?.trim() || null,
  };
}

export interface RawMultifamily {
  propertyName: string;
  address: string;
  city?: string;
  stateCode?: string;
  zipCode?: string;
  unitCount?: number | string;
  developer?: string;
  managementCompany?: string;
  completionDate?: string;
  leaseUpStatus?: string;
  rentLow?: number | string;
  rentHigh?: number | string;
  website?: string;
  phone?: string;
  source?: string;
  sourceUrl?: string;
  notes?: string;
}

export interface NormalizedMultifamily {
  cityId: string;
  propertyName: string;
  address: string;
  city: string | null;
  stateCode: string;
  zoneId: string | null;
  unitCount: number | null;
  developer: string | null;
  managementCompany: string | null;
  completionDate: string | null;
  leaseUpStatus: "planning" | "under_construction" | "lease_up" | "stabilized" | "unknown";
  rentLow: number | null;
  rentHigh: number | null;
  website: string | null;
  phone: string | null;
  source: string;
  sourceUrl: string | null;
  notes: string | null;
}

const VALID_LEASE_UP = ["planning", "under_construction", "lease_up", "stabilized", "unknown"] as const;

export async function normalizeMultifamily(
  raw: RawMultifamily,
  cityId: string
): Promise<NormalizedMultifamily> {
  const stateCode = (raw.stateCode || "NC").toUpperCase().trim();

  let zipCode: string | null = raw.zipCode || null;
  if (!zipCode && raw.address) {
    const match = raw.address.match(/\b(\d{5})\b/);
    if (match) zipCode = match[1];
  }

  const zoneId = await resolveZipToZoneId(zipCode, cityId);

  const unitCount = raw.unitCount != null ? parseInt(String(raw.unitCount), 10) : null;
  const rentLow = raw.rentLow != null ? parseInt(String(raw.rentLow), 10) : null;
  const rentHigh = raw.rentHigh != null ? parseInt(String(raw.rentHigh), 10) : null;

  let completionDate: string | null = null;
  if (raw.completionDate) {
    const d = new Date(raw.completionDate);
    if (!isNaN(d.getTime())) {
      completionDate = d.toISOString().split("T")[0];
    } else {
      completionDate = raw.completionDate.trim();
    }
  }

  let leaseUpStatus: NormalizedMultifamily["leaseUpStatus"] = "unknown";
  if (raw.leaseUpStatus) {
    const cleaned = raw.leaseUpStatus.toLowerCase().trim().replace(/[\s-]+/g, "_");
    if (VALID_LEASE_UP.includes(cleaned as any)) {
      leaseUpStatus = cleaned as NormalizedMultifamily["leaseUpStatus"];
    }
  }

  return {
    cityId,
    propertyName: raw.propertyName.trim(),
    address: raw.address.trim(),
    city: raw.city?.trim() || null,
    stateCode,
    zoneId,
    unitCount: unitCount && !isNaN(unitCount) ? unitCount : null,
    developer: raw.developer?.trim() || null,
    managementCompany: raw.managementCompany?.trim() || null,
    completionDate,
    leaseUpStatus,
    rentLow: rentLow && !isNaN(rentLow) ? rentLow : null,
    rentHigh: rentHigh && !isNaN(rentHigh) ? rentHigh : null,
    website: raw.website?.trim() || null,
    phone: raw.phone?.trim() || null,
    source: raw.source?.trim() || "manual",
    sourceUrl: raw.sourceUrl?.trim() || null,
    notes: raw.notes?.trim() || null,
  };
}
