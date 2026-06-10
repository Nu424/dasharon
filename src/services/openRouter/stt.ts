import { AudioManager } from "../../modules/DataManager/AudioManager";
import { splitBase64 } from "../../modules/DataManager/util";
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
 * AudioBufferをモノラルPCMに合成する。
 * 複数チャンネルは平均化する。
 */
const mixToMono = (buffer: AudioBuffer) => {
  const { numberOfChannels, length } = buffer;
  if (numberOfChannels === 1) {
    return buffer.getChannelData(0);
  }
  const mono = new Float32Array(length);
  for (let channel = 0; channel < numberOfChannels; channel += 1) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < length; i += 1) {
      mono[i] += data[i];
    }
  }
  for (let i = 0; i < length; i += 1) {
    mono[i] /= numberOfChannels;
  }
  return mono;
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
    const wavManager = new AudioManager();
    await wavManager.fromPCMData(audioManager.pcmData, audioManager.pcmSampleRate);
    return wavManager;
  }
  if (!audioManager.audioBlob) {
    throw new Error("No audio data to convert.");
  }

  // Blob音声をデコードしてWAVに再エンコードする。
  const arrayBuffer = await audioManager.audioBlob.arrayBuffer();
  const audioContext = new AudioContext();
  try {
    const decoded = await audioContext.decodeAudioData(arrayBuffer.slice(0));
    const mono = mixToMono(decoded);
    const wavManager = new AudioManager();
    await wavManager.fromPCMData(mono, decoded.sampleRate);
    return wavManager;
  } finally {
    await audioContext.close();
  }
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
