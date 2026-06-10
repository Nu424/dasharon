import { AudioManager } from "../../modules/DataManager/AudioManager";
import type { InputMode, RuntimeError, Settings } from "../../store/useAppStore";
import { transcribeAudio } from "../openRouter/stt";
import { updateMemo } from "../openRouter/llm";
import { memoStylePresets } from "../../constants/memoStylePresets";

/** STT対象の音声セグメント。 */
export type AudioSegment = {
  audioManager: AudioManager;
  mode: InputMode;
};

/** パイプラインが参照するストア操作。 */
type PipelineStore = {
  getSettings: () => Settings;
  getMemoMarkdown: () => string;
  getPendingTranscriptText: () => string;
  setMemoMarkdown: (markdown: string) => void;
  addTranscriptEntry: (text: string, mode: InputMode) => void;
  appendPendingTranscript: (text: string) => void;
  clearPendingTranscript: () => void;
  setProcessing: (partial: { sttRunning?: boolean; llmRunning?: boolean; queueCount?: number }) => void;
  setRuntimeError: (error: RuntimeError) => void;
  clearRuntimeError: () => void;
};

/**
 * 音声セグメントのSTT→LLM処理を逐次化するパイプライン。
 */
export class ProcessingPipeline {
  private queue: AudioSegment[] = [];
  private sttLoopActive = false;
  private llmActive = false;
  private llmBlocked = false;
  private disposed = false;
  private store: PipelineStore;

  /** ストアを受け取り、パイプラインを初期化する。 */
  constructor(store: PipelineStore) {
    this.store = store;
  }

  /** STTキューに音声セグメントを追加する。 */
  enqueue(segment: AudioSegment) {
    if (this.disposed) return;
    // 追加後にループを起動して順次処理する。
    this.queue.push(segment);
    this.store.setProcessing({ queueCount: this.queue.length });
    void this.runSttLoop();
  }

  /** LLM再試行フラグを解除して再開する。 */
  retryLLM() {
    if (this.disposed) return;
    this.llmBlocked = false;
    this.store.clearRuntimeError();
    void this.runLlmIfNeeded();
  }

  /** パイプラインの処理を停止し、キューを破棄する。 */
  dispose() {
    this.disposed = true;
    this.queue = [];
    this.store.setProcessing({ queueCount: 0, sttRunning: false, llmRunning: false });
  }

  /**
   * STTの逐次ループを実行する。
   * キューが空になるまで順番に処理する。
   */
  private async runSttLoop() {
    if (this.sttLoopActive || this.disposed) return; // すでにループが実行中、または破棄されていたら終了
    this.sttLoopActive = true;
    this.store.setProcessing({ sttRunning: true });

    try {
      while (this.queue.length > 0 && !this.disposed) {
        // 先頭を取り出してSTT処理へ進む。
        const segment = this.queue.shift();
        this.store.setProcessing({ queueCount: this.queue.length });
        if (!segment) break;
        await this.handleSegment(segment);
      }
    } finally {
      this.sttLoopActive = false;
      this.store.setProcessing({ sttRunning: false });
    }
  }

  /**
   * 1セグメント分のSTTを実行し、必要ならLLM更新へつなぐ。
   */
  private async handleSegment(segment: AudioSegment) {
    const settings = this.store.getSettings();
    if (!settings.openRouterApiKey) {
      this.store.setRuntimeError({ stage: "STT", message: "OpenRouter API key is missing." });
      return;
    }

    try {
      // STTでテキスト化。
      const transcript = await transcribeAudio({
        audioManager: segment.audioManager,
        apiKey: settings.openRouterApiKey,
        model: settings.sttModel,
        timeoutMs: settings.timeoutMs,
        retryCount: settings.retryCount,
      });

      if (!transcript) return;
      // ログとpendingに反映してLLM処理へ。
      this.store.addTranscriptEntry(transcript, segment.mode);
      this.store.appendPendingTranscript(`${transcript}\n`);
      this.store.clearRuntimeError();
      await this.runLlmIfNeeded();
    } catch (error) {
      const message = error instanceof Error ? error.message : "STT failed.";
      this.store.setRuntimeError({ stage: "STT", message });
    }
  }

  /**
   * pendingがある場合のみLLMを実行する。
   * 実行中は重複起動しない。
   */
  private async runLlmIfNeeded() {
    if (this.llmActive || this.llmBlocked || this.disposed) return;
    const pending = this.store.getPendingTranscriptText().trim();
    if (!pending) return;

    const settings = this.store.getSettings();
    // プリセット + カスタム指示を結合する。
    const presetInstruction =
      memoStylePresets.find((preset) => preset.id === settings.memoStylePresetId)?.instruction ?? "";
    const styleInstruction = [presetInstruction, settings.memoStyleCustomInstruction]
      .filter(Boolean)
      .join("\n");
    if (!settings.openRouterApiKey) {
      this.store.setRuntimeError({ stage: "LLM", message: "OpenRouter API key is missing." });
      this.llmBlocked = true;
      return;
    }

    this.llmActive = true;
    this.store.setProcessing({ llmRunning: true });
    try {
      // LLMにまとめを依頼し、メモを更新する。
      const updatedMemo = await updateMemo({
        apiKey: settings.openRouterApiKey,
        model: settings.llmModel,
        currentMemo: this.store.getMemoMarkdown(),
        newTranscriptText: pending,
        styleInstruction,
        summaryLanguage: settings.summaryLanguage,
        timeoutMs: settings.timeoutMs,
        retryCount: settings.retryCount,
      });
      if (updatedMemo) {
        this.store.setMemoMarkdown(updatedMemo);
      }
      // 成功時はpendingをクリアして次の処理へ。
      this.store.clearPendingTranscript();
      this.store.clearRuntimeError();
    } catch (error) {
      const message = error instanceof Error ? error.message : "LLM failed.";
      this.store.setRuntimeError({ stage: "LLM", message });
      this.llmBlocked = true;
      return;
    } finally {
      this.llmActive = false;
      this.store.setProcessing({ llmRunning: false });
    }

    // 追加のpendingがあれば連続で処理する。
    if (this.store.getPendingTranscriptText().trim().length > 0) {
      await this.runLlmIfNeeded();
    }
  }
}
