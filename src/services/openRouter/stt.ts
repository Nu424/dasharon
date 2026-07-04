import { AudioManager } from "../../modules/DataManager/AudioManager";
import { splitBase64 } from "../../modules/DataManager/util";
import { decodeToPcm, pcmToWavAudioManager } from "../audio/decodeToPcm";
import {
  OPENROUTER_AUDIO_TRANSCRIPTIONS_URL,
  openRouterFetchJson,
} from "./openRouterFetch";

/** 文字起こしに必要な入力。 */
type TranscribeAudioParams = {
  audioManager: AudioManager;
  apiKey: string;
  model: string;
  timeoutMs: number;
  retryCount: number;
};

/** OpenRouter STT APIのレスポンス形。 */
type OpenRouterTranscriptionResponse = {
  text: string;
};

/**
 * 入力音声をWAV形式に正規化する。
 * すでにWAVまたはPCMがあればそのまま利用する。
 */
const toWavAudioManager = async (audioManager: AudioManager): Promise<AudioManager> => {
  if (audioManager.audioBlob?.type === "audio/wav") {
    return audioManager;
  }
  if (audioManager.pcmData && audioManager.pcmSampleRate) {
    return pcmToWavAudioManager(audioManager.pcmData, audioManager.pcmSampleRate);
  }
  const { pcm, sampleRate } = await decodeToPcm(audioManager);
  return pcmToWavAudioManager(pcm, sampleRate);
};

/**
 * OpenRouter STT APIに音声を送信して文字起こし結果を取得する。
 */
export async function transcribeAudio({
  audioManager,
  apiKey,
  model,
  timeoutMs,
  retryCount,
}: TranscribeAudioParams): Promise<string> {
  const wavManager = await toWavAudioManager(audioManager);
  const dataUrl = await wavManager.toBase64();
  const { base64Data } = splitBase64(dataUrl);

  const response = await openRouterFetchJson<OpenRouterTranscriptionResponse>({
    apiKey,
    url: OPENROUTER_AUDIO_TRANSCRIPTIONS_URL,
    body: JSON.stringify({
      model,
      input_audio: {
        data: base64Data,
        format: "wav",
      },
    }),
    timeoutMs,
    retryCount,
  });

  return response.text?.trim() ?? "";
}
