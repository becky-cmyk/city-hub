export interface VoiceProviderConfig {
  provider: string;
  apiKey?: string;
  region?: string;
  voiceId?: string;
}

export interface TTSRequest {
  text: string;
  voiceId?: string;
  speed?: number;
  pitch?: number;
}

export interface TTSResponse {
  audioData: Buffer;
  format: string;
  durationMs: number;
}

export interface STTRequest {
  audioData: Buffer;
  format: string;
  language?: string;
}

export interface STTResponse {
  transcript: string;
  confidence: number;
}

export interface DialerRequest {
  phoneNumber: string;
  callerId?: string;
  scriptId?: string;
  voiceProfileId?: string;
}

export interface DialerResponse {
  callId: string;
  status: string;
}

export interface VoiceProviderAdapter {
  name: string;
  isConfigured(): boolean;
  textToSpeech(request: TTSRequest): Promise<TTSResponse>;
  speechToText(request: STTRequest): Promise<STTResponse>;
  initiateCall(request: DialerRequest): Promise<DialerResponse>;
}

class StubVoiceProvider implements VoiceProviderAdapter {
  name = "stub";

  isConfigured(): boolean {
    return false;
  }

  async textToSpeech(_request: TTSRequest): Promise<TTSResponse> {
    throw new Error("Voice provider not configured. TTS is not available yet.");
  }

  async speechToText(_request: STTRequest): Promise<STTResponse> {
    throw new Error("Voice provider not configured. STT is not available yet.");
  }

  async initiateCall(_request: DialerRequest): Promise<DialerResponse> {
    throw new Error("Voice provider not configured. Dialer is not available yet.");
  }
}

let currentProvider: VoiceProviderAdapter = new StubVoiceProvider();

export function getVoiceProvider(): VoiceProviderAdapter {
  return currentProvider;
}

export function setVoiceProvider(provider: VoiceProviderAdapter): void {
  currentProvider = provider;
}

export function isVoiceProviderConfigured(): boolean {
  return currentProvider.isConfigured();
}
