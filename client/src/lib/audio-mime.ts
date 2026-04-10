const MIME_CANDIDATES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/ogg;codecs=opus",
  "audio/ogg",
  "audio/wav",
];

export function getSupportedAudioMimeType(): string {
  for (const mime of MIME_CANDIDATES) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(mime)) return mime;
  }
  return "";
}

export function createRecorderWithFallback(stream: MediaStream): { recorder: MediaRecorder; mimeType: string } {
  const mimeType = getSupportedAudioMimeType();
  const opts: MediaRecorderOptions = mimeType ? { mimeType } : {};
  const recorder = new MediaRecorder(stream, opts);
  return { recorder, mimeType: recorder.mimeType || mimeType || "audio/webm" };
}
