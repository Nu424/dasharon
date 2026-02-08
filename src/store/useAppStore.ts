import { create } from "zustand";
import { persist } from "zustand/middleware";

/** 入力モード。 */
export type InputMode = "PTT" | "VAD";
/** 録音/待機の状態。 */
export type RecordingStatus = "idle" | "recording" | "grace" | "finalizing" | "listening";
/** テーマモード。 */
export type ThemeMode = "system" | "light" | "dark";

/** ユーザー設定。 */
export type Settings = {
  openRouterApiKey: string;
  sttModel: string;
  llmModel: string;
  inputMode: InputMode;
  theme: ThemeMode;
  graceMs: number;
  sttLanguage: string;
  summaryLanguage: string;
  memoStylePresetId: string;
  memoStyleCustomInstruction: string;
  timeoutMs: number;
  retryCount: number;
};

/** メモの状態。 */
export type MemoState = {
  markdown: string;
};

/** 文字起こしの1件分。 */
export type TranscriptEntry = {
  id: string;
  createdAt: number;
  text: string;
  mode: InputMode;
};

/** 文字起こしログの状態。 */
export type TranscriptState = {
  entries: TranscriptEntry[];
};

/** ランタイムエラー情報。 */
export type RuntimeError = {
  stage: "STT" | "LLM";
  message: string;
};

/** 実行中に変化する状態。 */
export type RuntimeState = {
  recording: {
    status: RecordingStatus;
    graceRemainingMs: number;
    vadHoldActive: boolean;
    vadBufferCount: number;
  };
  processing: {
    sttRunning: boolean;
    llmRunning: boolean;
    pendingTranscriptText: string;
    queueCount: number;
  };
  ui: {
    settingsOpen: boolean;
    editOpen: boolean;
    transcriptLogOpen: boolean;
    error?: RuntimeError;
  };
};

/** アプリ全体の状態と操作。 */
export type AppState = {
  settings: Settings;
  memo: MemoState;
  transcripts: TranscriptState;
  runtime: RuntimeState;
  actions: {
    setSettings: (partial: Partial<Settings>) => void;
    setMemo: (markdown: string) => void;
    resetMemo: () => void;
    addTranscriptEntry: (text: string, mode: InputMode) => TranscriptEntry;
    clearTranscripts: () => void;
    setRecording: (partial: Partial<RuntimeState["recording"]>) => void;
    setProcessing: (partial: Partial<RuntimeState["processing"]>) => void;
    appendPendingTranscript: (text: string) => void;
    clearPendingTranscript: () => void;
    setUi: (partial: Partial<RuntimeState["ui"]>) => void;
    setRuntimeError: (error: RuntimeError) => void;
    clearRuntimeError: () => void;
  };
};

// 文字起こしログの保持上限。
const MAX_TRANSCRIPT_ENTRIES = 300;

// 初期設定値。
const DEFAULT_SETTINGS: Settings = {
  openRouterApiKey: "",
  sttModel: "google/gemini-2.5-flash",
  llmModel: "google/gemini-2.5-flash",
  inputMode: "PTT",
  theme: "system",
  graceMs: 1000,
  sttLanguage: "ja",
  summaryLanguage: "ja",
  memoStylePresetId: "structured_minutes",
  memoStyleCustomInstruction: "",
  timeoutMs: 120_000,
  retryCount: 2,
};

// ランタイム初期値。
const DEFAULT_RUNTIME: RuntimeState = {
  recording: {
    status: "idle",
    graceRemainingMs: 0,
    vadHoldActive: false,
    vadBufferCount: 0,
  },
  processing: {
    sttRunning: false,
    llmRunning: false,
    pendingTranscriptText: "",
    queueCount: 0,
  },
  ui: {
    settingsOpen: false,
    editOpen: false,
    transcriptLogOpen: false,
    error: undefined,
  },
};

/** Zustandの永続ストア定義。 */
export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      settings: DEFAULT_SETTINGS,
      memo: { markdown: "" },
      transcripts: { entries: [] },
      runtime: DEFAULT_RUNTIME,
      actions: {
        /** 設定を部分更新する。 */
        setSettings: (partial) =>
          set((state) => ({ settings: { ...state.settings, ...partial } })),
        /** メモ本文を更新する。 */
        setMemo: (markdown) => set({ memo: { markdown } }),
        /** メモを初期化する。 */
        resetMemo: () => set({ memo: { markdown: "" } }),
        /** 文字起こしログを追加し、最新から保持する。 */
        addTranscriptEntry: (text, mode) => {
          const entry: TranscriptEntry = {
            id: crypto.randomUUID(),
            createdAt: Date.now(),
            text,
            mode,
          };
          set((state) => {
            const entries = [entry, ...state.transcripts.entries];
            return {
              transcripts: { entries: entries.slice(0, MAX_TRANSCRIPT_ENTRIES) },
            };
          });
          return entry;
        },
        /** 文字起こしログを全削除する。 */
        clearTranscripts: () => set({ transcripts: { entries: [] } }),
        /** 録音状態を部分更新する。 */
        setRecording: (partial) =>
          set((state) => ({
            runtime: { ...state.runtime, recording: { ...state.runtime.recording, ...partial } },
          })),
        /** 処理状態を部分更新する。 */
        setProcessing: (partial) =>
          set((state) => ({
            runtime: { ...state.runtime, processing: { ...state.runtime.processing, ...partial } },
          })),
        /** 追加で到着した文字起こしを連結する。 */
        appendPendingTranscript: (text) =>
          set((state) => ({
            runtime: {
              ...state.runtime,
              processing: {
                ...state.runtime.processing,
                pendingTranscriptText: `${state.runtime.processing.pendingTranscriptText}${text}`,
              },
            },
          })),
        /** 保留中の文字起こしをクリアする。 */
        clearPendingTranscript: () =>
          set((state) => ({
            runtime: {
              ...state.runtime,
              processing: { ...state.runtime.processing, pendingTranscriptText: "" },
            },
          })),
        /** UI状態を部分更新する。 */
        setUi: (partial) =>
          set((state) => ({ runtime: { ...state.runtime, ui: { ...state.runtime.ui, ...partial } } })),
        /** ランタイムエラーを設定する。 */
        setRuntimeError: (error) =>
          set((state) => ({ runtime: { ...state.runtime, ui: { ...state.runtime.ui, error } } })),
        /** ランタイムエラーをクリアする。 */
        clearRuntimeError: () =>
          set((state) => ({ runtime: { ...state.runtime, ui: { ...state.runtime.ui, error: undefined } } })),
      },
    }),
    {
      name: "dasharon-store",
      // 永続化する対象のみを保存する。
      partialize: (state) => ({
        settings: state.settings,
        memo: state.memo,
        transcripts: state.transcripts,
      }),
    },
  ),
);
