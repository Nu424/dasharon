import { AudioManager } from "../../modules/DataManager/AudioManager";
import { decodeToPcm, pcmToWavAudioManager } from "./decodeToPcm";

/** 無音分割の設定。 */
export type SplitOnSilenceOptions = {
  /** RMSがこの値未満なら無音とみなす（0〜1）。 */
  silenceThreshold: number;
  /** 無音と判定する最小継続時間（ms）。 */
  minSilenceMs: number;
  /** チャンクの最小長（ms）。これより短いチャンクは作らない。 */
  minChunkMs: number;
  /** チャンクの最大長（ms）。無音がなくてもここで強制分割する。 */
  maxChunkMs: number;
  /** チャンク境界の前後に付与するパディング（ms）。 */
  paddingMs: number;
  /** 解析に使うフレーム長（ms）。 */
  frameMs?: number;
};

const DEFAULT_FRAME_MS = 20;

/**
 * フレーム単位のRMSを計算する。
 */
const computeFrameRms = (pcm: Float32Array, start: number, end: number): number => {
  let sum = 0;
  const count = end - start;
  if (count <= 0) return 0;
  for (let i = start; i < end; i += 1) {
    const sample = pcm[i];
    sum += sample * sample;
  }
  return Math.sqrt(sum / count);
};

/**
 * モノラルPCMを無音位置で分割する。
 */
export function splitPcmOnSilence(
  pcm: Float32Array,
  sampleRate: number,
  options: SplitOnSilenceOptions,
): Float32Array[] {
  const frameMs = options.frameMs ?? DEFAULT_FRAME_MS;
  const frameSize = Math.max(1, Math.round((sampleRate * frameMs) / 1000));
  const minSilenceFrames = Math.max(1, Math.round((sampleRate * options.minSilenceMs) / 1000 / frameSize));
  const minChunkSamples = Math.max(frameSize, Math.round((sampleRate * options.minChunkMs) / 1000));
  const maxChunkSamples = Math.max(minChunkSamples, Math.round((sampleRate * options.maxChunkMs) / 1000));
  const paddingSamples = Math.max(0, Math.round((sampleRate * options.paddingMs) / 1000));

  const totalFrames = Math.ceil(pcm.length / frameSize);
  const isSilent: boolean[] = [];
  for (let frame = 0; frame < totalFrames; frame += 1) {
    const start = frame * frameSize;
    const end = Math.min(pcm.length, start + frameSize);
    isSilent.push(computeFrameRms(pcm, start, end) < options.silenceThreshold);
  }

  const chunks: Float32Array[] = [];
  let chunkStart = 0;

  const pushChunk = (start: number, end: number) => {
    const paddedStart = Math.max(0, start - paddingSamples);
    const paddedEnd = Math.min(pcm.length, end + paddingSamples);
    if (paddedEnd <= paddedStart) return;
    chunks.push(pcm.slice(paddedStart, paddedEnd));
  };

  let silenceRun = 0;
  let silenceRunStartFrame = 0;

  for (let frame = 0; frame < totalFrames; frame += 1) {
    const frameStartSample = frame * frameSize;
    const chunkLength = frameStartSample - chunkStart;

    if (isSilent[frame]) {
      if (silenceRun === 0) {
        silenceRunStartFrame = frame;
      }
      silenceRun += 1;
    } else {
      silenceRun = 0;
    }

    const reachedMax = chunkLength >= maxChunkSamples;
    const foundSilence =
      silenceRun >= minSilenceFrames && chunkLength >= minChunkSamples;

    if (foundSilence || reachedMax) {
      const splitFrame = foundSilence ? silenceRunStartFrame : frame;
      const splitSample = Math.min(pcm.length, splitFrame * frameSize);
      if (splitSample > chunkStart) {
        pushChunk(chunkStart, splitSample);
        chunkStart = splitSample;
      }
      silenceRun = 0;
    }
  }

  if (chunkStart < pcm.length) {
    pushChunk(chunkStart, pcm.length);
  }

  return chunks.length > 0 ? chunks : [pcm];
}

/**
 * AudioManagerを無音位置で分割し、WAV形式のAudioManager配列を返す。
 */
export async function splitAudioOnSilence(
  audioManager: AudioManager,
  options: SplitOnSilenceOptions,
): Promise<AudioManager[]> {
  const { pcm, sampleRate } = await decodeToPcm(audioManager);
  const chunks = splitPcmOnSilence(pcm, sampleRate, options);
  return Promise.all(chunks.map((chunk) => pcmToWavAudioManager(chunk, sampleRate)));
}
