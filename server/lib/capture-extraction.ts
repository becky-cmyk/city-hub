import { openai } from "./openai";
import fs from "fs";
import path from "path";

const EXTRACTION_PROMPTS: Record<string, { system: string; user: string }> = {
  business_card: {
    system: `You extract contact information from business card photos. Return a JSON object with these fields (use empty string for missing fields):
{
  "name": "full name",
  "email": "email address",
  "phone": "phone number",
  "company": "company/employer name",
  "jobTitle": "job title/position",
  "website": "website url",
  "address": "full address"
}`,
    user: "Extract the contact information from this business card image. Return only valid JSON.",
  },
  handwritten_note: {
    system: `You extract text and contact information from handwritten notes. Return a JSON object with these fields (use empty string for missing fields):
{
  "rawText": "full transcription of the handwritten text",
  "name": "any person name found",
  "email": "any email address found",
  "phone": "any phone number found",
  "company": "any company name found",
  "jobTitle": "any job title found",
  "website": "any website url found",
  "address": "any address found",
  "notes": "any other relevant info"
}`,
    user: "Extract all text and contact information from this handwritten note. Return only valid JSON.",
  },
  ad_photo: {
    system: `You analyze photographs of competitor advertisements (billboards, flyers, social media ads, vehicle wraps, window signs, magazine ads, etc.) and extract the business information being advertised. Return a JSON object with these fields (use empty string for missing fields):
{
  "businessName": "the business name being advertised",
  "company": "the business name being advertised",
  "website": "any website URL shown in the ad",
  "phone": "any phone number shown in the ad",
  "email": "any email address shown in the ad",
  "address": "any physical address shown in the ad",
  "adMedium": "one of: billboard, flyer, magazine, vehicle_wrap, social_media, window_sign, poster, banner, newspaper, direct_mail, other",
  "adDescription": "brief description of what the ad is promoting",
  "tagline": "any slogan or tagline visible"
}`,
    user: "Analyze this advertisement photo. Extract the business information and identify the advertising medium. Return only valid JSON.",
  },
  booth_photo: {
    system: `Analyze this booth/storefront photo and extract any visible business information. Return a JSON object with these fields (use empty string for missing fields):
{
  "company": "business/company name",
  "website": "any website URL visible",
  "phone": "any phone number visible",
  "email": "any email visible",
  "tagline": "any slogan or tagline",
  "services": "services offered if visible"
}`,
    user: "Analyze this booth or storefront photo and extract business information. Return only valid JSON.",
  },
  document: {
    system: `Extract any business/contact information from this document image. Return a JSON object with these fields (use empty string for missing fields):
{
  "name": "any person name found",
  "email": "any email address found",
  "phone": "any phone number found",
  "company": "any company name found",
  "jobTitle": "any job title found",
  "website": "any website url found",
  "address": "any address found",
  "notes": "any other relevant info"
}`,
    user: "Extract all business and contact information from this document. Return only valid JSON.",
  },
};

export async function extractFromImage(
  itemType: string,
  imageDataUrl: string
): Promise<Record<string, any>> {
  if (!openai) throw new Error("OpenAI not configured");

  const prompts = EXTRACTION_PROMPTS[itemType] || EXTRACTION_PROMPTS.document;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: prompts.system },
      {
        role: "user",
        content: [
          { type: "text", text: prompts.user },
          { type: "image_url", image_url: { url: imageDataUrl } },
        ],
      },
    ],
    response_format: { type: "json_object" },
    temperature: 0.2,
  });

  const content = response.choices[0]?.message?.content || "{}";
  try {
    return JSON.parse(content);
  } catch {
    return { rawResponse: content };
  }
}

function resolveImageDataUrl(imageBase64?: string, imageUrl?: string): string | null {
  if (imageBase64) {
    if (imageBase64.startsWith("data:")) return imageBase64;
    return `data:image/jpeg;base64,${imageBase64}`;
  }

  if (!imageUrl) return null;

  if (imageUrl.startsWith("data:") || imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {
    return imageUrl;
  }

  if (imageUrl.startsWith("/uploads/") || imageUrl.startsWith("uploads/")) {
    try {
      const ALLOWED_IMAGE_EXTS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".heic", ".heif"]);
      const uploadsRoot = path.resolve(process.cwd(), "uploads");
      const rawPath = imageUrl.startsWith("/") ? imageUrl.slice(1) : imageUrl;
      const filePath = path.resolve(process.cwd(), rawPath);

      if (!filePath.startsWith(uploadsRoot + path.sep) && filePath !== uploadsRoot) {
        console.warn("[CaptureExtraction] Path traversal blocked:", imageUrl);
        return null;
      }

      const ext = path.extname(filePath).toLowerCase();
      if (!ALLOWED_IMAGE_EXTS.has(ext)) {
        console.warn("[CaptureExtraction] Non-image extension rejected:", ext);
        return null;
      }

      if (fs.existsSync(filePath)) {
        const fileBuffer = fs.readFileSync(filePath);
        const mimeMap: Record<string, string> = {
          ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
          ".webp": "image/webp", ".gif": "image/gif", ".heic": "image/heic", ".heif": "image/heif",
        };
        const mime = mimeMap[ext] || "image/jpeg";
        return `data:${mime};base64,${fileBuffer.toString("base64")}`;
      }
    } catch (err) {
      console.error("[CaptureExtraction] Failed to read local file:", imageUrl, err);
    }
  }

  return null;
}

export async function extractDataFromItem(
  itemType: string,
  imageBase64?: string,
  imageUrl?: string,
  rawInput?: Record<string, any>
): Promise<Record<string, any>> {
  const hasImage = imageBase64 || imageUrl;

  if (rawInput && Object.keys(rawInput).length > 0 && !hasImage) {
    const textContent = rawInput.notes || rawInput.transcript || rawInput.rawText || "";
    if (textContent && typeof textContent === "string" && textContent.length > 5) {
      const textFields = extractContactFieldsFromText(textContent);
      const merged = { ...rawInput };
      for (const [k, v] of Object.entries(textFields)) {
        if (!merged[k]) merged[k] = v;
      }
      return merged;
    }
    return rawInput;
  }

  if (!hasImage || !openai) {
    return rawInput || {};
  }

  const imageDataUrl = resolveImageDataUrl(imageBase64, imageUrl);
  if (!imageDataUrl) {
    console.warn("[CaptureExtraction] Could not resolve image to data URL:", imageUrl);
    return rawInput || {};
  }

  try {
    const extracted = await extractFromImage(itemType, imageDataUrl);
    const merged = { ...extracted, ...(rawInput || {}) };
    const textContent = merged.rawText || merged.notes || merged.rawResponse || "";
    if (textContent && typeof textContent === "string" && textContent.length > 5) {
      const textFields = extractContactFieldsFromText(textContent);
      for (const [k, v] of Object.entries(textFields)) {
        if (!merged[k]) merged[k] = v;
      }
    }
    return merged;
  } catch (err) {
    console.error("[CaptureExtraction] AI extraction error:", err);
    return rawInput || {};
  }
}

export function extractContactFieldsFromText(text: string): Record<string, string> {
  const result: Record<string, string> = {};
  if (!text) return result;

  const emailMatch = text.match(/[\w.+-]+@[\w.-]+\.\w{2,}/i);
  if (emailMatch) result.email = emailMatch[0];

  const phonePatterns = [
    /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/,
    /\d{3}[-.\s]\d{3}[-.\s]\d{4}/,
  ];
  for (const pattern of phonePatterns) {
    const match = text.match(pattern);
    if (match) { result.phone = match[0]; break; }
  }

  const websiteMatch = text.match(/(?:https?:\/\/)?(?:www\.)?[\w-]+\.(?:com|org|net|io|co|biz|info|us)(?:\/[\w.-]*)?/i);
  if (websiteMatch) result.website = websiteMatch[0];

  return result;
}

export function parseVcard(text: string): Record<string, any> {
  const result: Record<string, any> = {};
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;
    const key = line.substring(0, colonIdx).split(";")[0].toUpperCase();
    const value = line.substring(colonIdx + 1).trim();
    if (!value) continue;

    switch (key) {
      case "FN":
        result.name = value;
        break;
      case "N": {
        const parts = value.split(";");
        if (!result.name && parts.length >= 2) {
          result.name = `${parts[1]} ${parts[0]}`.trim();
        }
        break;
      }
      case "EMAIL":
        result.email = value;
        break;
      case "TEL":
        result.phone = value;
        break;
      case "ORG":
        result.company = value.split(";")[0];
        break;
      case "TITLE":
        result.jobTitle = value;
        break;
      case "URL":
        result.website = value;
        break;
      case "ADR": {
        const addrParts = value.split(";").filter(Boolean);
        result.address = addrParts.join(", ");
        break;
      }
    }
  }
  return result;
}
