import { openai } from "../lib/openai";
import { EMAIL_HTML_TRANSLATION_SYSTEM } from "../ai/prompts/platform-services";

export async function translateText(html: string): Promise<string> {
  if (!html || html.trim().length === 0) return "";
  if (!openai) {
    console.warn("[EmailTranslate] OpenAI client not available, skipping translation");
    return html;
  }

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: EMAIL_HTML_TRANSLATION_SYSTEM
        },
        { role: "user", content: html },
      ],
      temperature: 0.3,
      max_tokens: 4000,
    });

    return response.choices[0]?.message?.content?.trim() || html;
  } catch (err) {
    console.error("[EmailTranslate] GPT translation failed:", err);
    return html;
  }
}
