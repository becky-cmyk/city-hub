import { writeFile, mkdir } from "fs/promises";
import { randomUUID } from "crypto";
import { join } from "path";

export function generateVttFromText(narrationText: string, durationSec: number): string {
  const words = narrationText.trim().split(/\s+/);
  if (words.length === 0) return "WEBVTT\n";

  const wordsPerSegment = 8;
  const segments: string[] = [];
  const totalSegments = Math.ceil(words.length / wordsPerSegment);
  const segmentDuration = durationSec / totalSegments;

  for (let i = 0; i < totalSegments; i++) {
    const segmentWords = words.slice(i * wordsPerSegment, (i + 1) * wordsPerSegment);
    const startTime = i * segmentDuration;
    const endTime = Math.min((i + 1) * segmentDuration, durationSec);
    segments.push(`${formatVttTime(startTime)} --> ${formatVttTime(endTime)}\n${segmentWords.join(" ")}`);
  }

  return `WEBVTT\n\n${segments.join("\n\n")}\n`;
}

function formatVttTime(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}.${String(ms).padStart(3, "0")}`;
}

export function estimateDurationFromText(text: string, wordsPerMinute = 150): number {
  const wordCount = text.trim().split(/\s+/).length;
  return Math.max(3, Math.ceil((wordCount / wordsPerMinute) * 60));
}

export async function generateAndSaveCaptions(
  narrationText: string,
  durationSec?: number
): Promise<{ captionUrl: string; filePath: string; vttContent: string }> {
  const duration = durationSec || estimateDurationFromText(narrationText);
  const vttContent = generateVttFromText(narrationText, duration);

  const dir = join("uploads", "tv-captions");
  await mkdir(dir, { recursive: true });

  const filename = `caption-${randomUUID()}.vtt`;
  const filePath = join(dir, filename);
  await writeFile(filePath, vttContent, "utf-8");

  const captionUrl = `/uploads/tv-captions/${filename}`;
  return { captionUrl, filePath, vttContent };
}
