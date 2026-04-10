import { openai } from "../lib/openai";
import { writeFile, mkdir } from "fs/promises";
import { randomUUID } from "crypto";
import { join } from "path";

export interface ITtsProvider {
  generateSpeech(text: string, voiceProfile: string): Promise<Buffer>;
}

const VOICE_PROFILE_MAP: Record<string, "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer"> = {
  warm_local_host: "nova",
  upbeat_event_host: "echo",
  calm_waiting_room: "alloy",
  nightlife_host: "onyx",
};

function resolveVoice(voiceProfile: string): "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer" {
  return VOICE_PROFILE_MAP[voiceProfile] || "alloy";
}

export class OpenAITtsProvider implements ITtsProvider {
  async generateSpeech(text: string, voiceProfile: string): Promise<Buffer> {
    if (!openai) {
      throw new Error("OpenAI API key not configured. Set Open_AI_Key or OPENAI_API_KEY in secrets.");
    }
    const voice = resolveVoice(voiceProfile);
    const response = await openai.audio.speech.create({
      model: "tts-1",
      voice,
      input: text,
      response_format: "mp3",
    });
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }
}

const ttsProvider = new OpenAITtsProvider();

export async function generateAndSaveNarration(
  text: string,
  voiceProfile: string
): Promise<{ audioUrl: string; filePath: string }> {
  const audioBuffer = await ttsProvider.generateSpeech(text, voiceProfile);

  const dir = join("uploads", "tv-narration");
  await mkdir(dir, { recursive: true });

  const filename = `narration-${randomUUID()}.mp3`;
  const filePath = join(dir, filename);
  await writeFile(filePath, audioBuffer);

  const audioUrl = `/uploads/tv-narration/${filename}`;
  return { audioUrl, filePath };
}

export { VOICE_PROFILE_MAP };
