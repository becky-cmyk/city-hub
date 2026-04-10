import OpenAI from "openai";

const directKey = process.env.Open_AI_Key || process.env.OPENAI_API_KEY;
const replitBaseUrl = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
const replitKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;

let openai: OpenAI | null = null;

if (directKey) {
  openai = new OpenAI({ apiKey: directKey });
  console.log("[OpenAI] Using direct OpenAI API key");
} else if (replitBaseUrl && replitKey) {
  openai = new OpenAI({ apiKey: replitKey, baseURL: replitBaseUrl });
  console.log("[OpenAI] Using Replit AI integration proxy (fallback)");
} else {
  console.warn("[OpenAI] No API key found. OpenAI features will be unavailable.");
}

export { openai };
