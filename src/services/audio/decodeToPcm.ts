import { AudioManager } from "../../modules/DataManager/AudioManager";

/** PCMデコード結果。 */
export type PcmAudio = {
  pcm: Float32Array;
  sampleRate: number;
};

/**
 * AudioBufferをモノラルPCMに合成する。
 * 複数チャンネルは平均化する。
 */
export const mixToMono = (buffer: AudioBuffer): Float32Array => {
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
 * AudioManagerからモノラルPCMを取得する。
 * すでにPCMキャッシュがあればそれを利用し、なければBlobをデコードする。
 */
export async function decodeToPcm(audioManager: AudioManager): Promise<PcmAudio> {
  if (audioManager.pcmData && audioManager.pcmSampleRate) {
    return {
      pcm: audioManager.pcmData,
      sampleRate: audioManager.pcmSampleRate,
    };
  }
  if (!audioManager.audioBlob) {
    throw new Error("No audio data to decode.");
  }

  const arrayBuffer = await audioManager.audioBlob.arrayBuffer();
  const audioContext = new AudioContext();
  try {
    const decoded = await audioContext.decodeAudioData(arrayBuffer.slice(0));
    return {
      pcm: mixToMono(decoded),
      sampleRate: decoded.sampleRate,
    };
  } finally {
    await audioContext.close();
  }
}

/**
 * PCMデータからWAV形式のAudioManagerを生成する。
 */
export async function pcmToWavAudioManager(pcm: Float32Array, sampleRate: number): Promise<AudioManager> {
  const wavManager = new AudioManager();
  await wavManager.fromPCMData(pcm, sampleRate);
  return wavManager;
}
