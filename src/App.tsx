import { useCallback, useEffect, useMemo, useRef } from "react";
import { MemoPane } from "./components/MemoPane";
import { ControlBar } from "./components/ControlBar";
import { SettingsModal } from "./components/SettingsModal";
import { TranscriptLogModal } from "./components/TranscriptLogModal";
import { useGraceRelease } from "./hooks/useGraceRelease";
import { AudioRecorder } from "./modules/DataRecorder/AudioRecorder";
import { VadAudioRecorder } from "./modules/DataRecorder/VadAudioRecorder";
import { useAppStore, type InputMode } from "./store/useAppStore";
import { ProcessingPipeline } from "./services/pipeline/processingLoop";
import { VadBuffer } from "./services/vad/vadBuffer";

type ContinuousInputMode = Extract<InputMode, "PTT" | "TOGGLE">;

/**
 * アプリのルートコンポーネント。
 */
function App() {
  // 永続設定とランタイム状態を取得。
  const settings = useAppStore((state) => state.settings);
  const memo = useAppStore((state) => state.memo);
  const transcripts = useAppStore((state) => state.transcripts);
  const runtime = useAppStore((state) => state.runtime);
  const actions = useAppStore((state) => state.actions);

  // ライフサイクルを跨ぐ参照を保持。
  const pipelineRef = useRef<ProcessingPipeline | null>(null);
  const audioRecorderRef = useRef<AudioRecorder | null>(null);
  const vadRecorderRef = useRef<VadAudioRecorder | null>(null);
  const vadBufferRef = useRef<VadBuffer | null>(null);
  const isFinalizingRef = useRef(false);
  const pttSessionRef = useRef(0);
  const continuousModeRef = useRef<ContinuousInputMode | null>(null);
  const blockGlobalShortcuts =
    runtime.ui.editOpen || runtime.ui.settingsOpen || runtime.ui.transcriptLogOpen;

  // ----------
  // ---テーマ
  // ----------
  useEffect(() => {
    // テーマ設定に応じてHTMLルートへクラスと配色を反映する。
    const root = document.documentElement;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const applyTheme = (isDark: boolean) => {
      root.classList.toggle("dark", isDark);
      root.style.colorScheme = isDark ? "dark" : "light";
    };
    const resolveDark = () => {
      if (settings.theme === "dark") return true;
      if (settings.theme === "light") return false;
      return media.matches;
    };

    applyTheme(resolveDark());

    if (settings.theme !== "system") return;
    const handleChange = (event: MediaQueryListEvent) => {
      applyTheme(event.matches);
    };
    media.addEventListener("change", handleChange);
    return () => media.removeEventListener("change", handleChange);
  }, [settings.theme]);

  // ----------
  // ---連続録音 (PTT / Toggle)
  // ----------
  /**
   * AudioRecorderを遅延初期化する。
   */
  const ensureAudioRecorder = useCallback(async () => {
    if (!audioRecorderRef.current) {
      audioRecorderRef.current = new AudioRecorder();
    }
    return audioRecorderRef.current;
  }, []);

  /**
   * 連続録音を確定し、STTキューへ渡す。
   */
  const finalizeContinuousRecording = useCallback(
    async (trimMs: number) => {
      if (isFinalizingRef.current) return;
      const sessionToken = pttSessionRef.current;
      const mode = continuousModeRef.current;
      if (!mode) return;

      isFinalizingRef.current = true;
      actions.setRecording({ status: "finalizing", graceRemainingMs: 0 });
      try {
        const recorder = audioRecorderRef.current;
        if (!recorder) {
          actions.setRecording({ status: "idle", graceRemainingMs: 0 });
          continuousModeRef.current = null;
          return;
        }
        const audioManager = await recorder.stopRecord(trimMs);
        if (mode === "PTT" && sessionToken !== pttSessionRef.current) return;
        if (audioManager) {
          pipelineRef.current?.enqueue({ audioManager, mode });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to finalize audio.";
        actions.setRuntimeError({ stage: "STT", message });
      } finally {
        actions.setRecording({ status: "idle", graceRemainingMs: 0 });
        continuousModeRef.current = null;
        isFinalizingRef.current = false;
      }
    },
    [actions],
  );

  /**
   * PTT録音の猶予後に録音を確定し、STTキューへ渡す。
   */
  const finalizePtt = useCallback(async () => {
    await finalizeContinuousRecording(settings.graceMs);
  }, [finalizeContinuousRecording, settings.graceMs]);

  // 猶予カウント制御。猶予カウントが終了したらPTT録音を確定する。
  const grace = useGraceRelease({
    graceMs: settings.graceMs,
    onGraceEnd: () => {
      void finalizePtt();
    },
  });

  /**
   * 連続録音を開始する。
   */
  const startContinuousRecording = useCallback(
    async (mode: ContinuousInputMode) => {
      try {
        const recorder = await ensureAudioRecorder();
        await recorder.startRecord(250);
        if (mode === "PTT") {
          pttSessionRef.current += 1;
        }
        continuousModeRef.current = mode;
        actions.setRecording({ status: "recording", graceRemainingMs: 0 });
        actions.clearRuntimeError();
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to start recording.";
        actions.setRuntimeError({ stage: "STT", message });
      }
    },
    [actions, ensureAudioRecorder],
  );

  /**
   * 即時に連続録音を終了する。
   */
  const stopContinuousRecordingImmediately = useCallback(async () => {
    grace.cancel();
    if (runtime.recording.status === "idle") return;
    await finalizeContinuousRecording(0);
  }, [finalizeContinuousRecording, grace, runtime.recording.status]);

  /**
   * PTT押下時の処理。
   */
  const handlePttPress = useCallback(() => {
    if (runtime.ui.editOpen) return;
    grace.press();
    if (runtime.recording.status === "idle") {
      void startContinuousRecording("PTT");
      return;
    }
    if (runtime.recording.status === "grace") {
      actions.setRecording({ status: "recording", graceRemainingMs: 0 });
    }
  }, [actions, grace, runtime.recording.status, runtime.ui.editOpen, startContinuousRecording]);

  /**
   * PTTを離した時の処理。
   */
  const handlePttRelease = useCallback(() => {
    if (runtime.recording.status !== "recording" || continuousModeRef.current !== "PTT") return;
    actions.setRecording({ status: "grace" });
    grace.release();
  }, [actions, grace, runtime.recording.status]);

  /**
   * PTT猶予中の送信をキャンセルして録音を破棄する。
   */
  const cancelPttGrace = useCallback(async () => {
    if (runtime.recording.status !== "grace") return;
    grace.cancel();
    pttSessionRef.current += 1;
    continuousModeRef.current = null;
    actions.setRecording({ status: "idle", graceRemainingMs: 0 });
    try {
      await audioRecorderRef.current?.cancelRecord();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to cancel recording.";
      actions.setRuntimeError({ stage: "STT", message });
    }
  }, [actions, grace, runtime.recording.status]);

  /**
   * トグル録音の開始/停止を切り替える。
   */
  const handleToggleRecording = useCallback(() => {
    if (runtime.ui.editOpen) return;
    if (runtime.recording.status === "recording" && continuousModeRef.current === "TOGGLE") {
      void finalizeContinuousRecording(0);
      return;
    }
    if (runtime.recording.status === "idle") {
      void startContinuousRecording("TOGGLE");
    }
  }, [
    finalizeContinuousRecording,
    runtime.recording.status,
    runtime.ui.editOpen,
    startContinuousRecording,
  ]);

  /**
   * LLMの再解析を要求する。
   */
  const handleRetryLLM = useCallback(() => {
    pipelineRef.current?.retryLLM();
  }, []);

  // ----------
  // ---VAD
  // ----------
  /**
   * VAD録音インスタンスを遅延初期化する。
   */
  const ensureVadRecorder = useCallback(async () => {
    if (vadRecorderRef.current) return;
    const recorder = new VadAudioRecorder((audioManager) => {
      vadBufferRef.current?.addSegment(audioManager);
      const holdActive = useAppStore.getState().runtime.recording.vadHoldActive;
      if (!holdActive) {
        void vadBufferRef.current?.flush();
      }
    });
    await recorder.init();
    vadRecorderRef.current = recorder;
  }, []);

  /**
   * VADのリスニングを開始する。
   */
  const startVadListening = useCallback(async () => {
    try {
      await ensureVadRecorder();
      await vadRecorderRef.current?.startRecord();
      actions.setRecording({ status: "listening" });
      actions.clearRuntimeError();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to start VAD.";
      actions.setRuntimeError({ stage: "STT", message });
    }
  }, [actions, ensureVadRecorder]);

  /**
   * VADのリスニングを停止する。
   */
  const stopVadListening = useCallback(async () => {
    try {
      await vadRecorderRef.current?.stopRecord();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to stop VAD.";
      actions.setRuntimeError({ stage: "STT", message });
    } finally {
      vadBufferRef.current?.clear();
      actions.setRecording({ status: "idle", vadHoldActive: false, vadBufferCount: 0 });
    }
  }, [actions]);

  /**
   * VADの開始/停止を切り替える。
   */
  const toggleVadListening = useCallback(() => {
    if (runtime.ui.editOpen) return;
    if (runtime.recording.status === "listening") {
      void stopVadListening();
      return;
    }
    void startVadListening();
  }, [runtime.recording.status, runtime.ui.editOpen, startVadListening, stopVadListening]);

  /**
   * VADホールドを切り替え、解除時は即フラッシュする。
   */
  const toggleVadHold = useCallback(() => {
    const next = !runtime.recording.vadHoldActive;
    actions.setRecording({ vadHoldActive: next });
    if (!next) {
      void vadBufferRef.current?.flush();
    }
  }, [actions, runtime.recording.vadHoldActive]);

  // ----------
  // ---初期化
  // ----------
  useEffect(() => {
    pipelineRef.current = new ProcessingPipeline({
      getSettings: () => useAppStore.getState().settings,
      getMemoMarkdown: () => useAppStore.getState().memo.markdown,
      getPendingTranscriptText: () => useAppStore.getState().runtime.processing.pendingTranscriptText,
      setMemoMarkdown: (markdown) => useAppStore.getState().actions.setMemo(markdown),
      addTranscriptEntry: (text, mode) => useAppStore.getState().actions.addTranscriptEntry(text, mode),
      appendPendingTranscript: (text) => useAppStore.getState().actions.appendPendingTranscript(text),
      clearPendingTranscript: () => useAppStore.getState().actions.clearPendingTranscript(),
      setProcessing: (partial) => useAppStore.getState().actions.setProcessing(partial),
      setRuntimeError: (error) => useAppStore.getState().actions.setRuntimeError(error),
      clearRuntimeError: () => useAppStore.getState().actions.clearRuntimeError(),
    });
    vadBufferRef.current = new VadBuffer({
      onFlush: (audioManager) => pipelineRef.current?.enqueue({ audioManager, mode: "VAD" }),
      onCountChange: (count) => useAppStore.getState().actions.setRecording({ vadBufferCount: count }),
    });
    return () => {
      pipelineRef.current?.dispose();
      vadBufferRef.current?.clear();
    };
  }, []);

  useEffect(() => {
    if (runtime.recording.status === "grace") {
      actions.setRecording({ graceRemainingMs: grace.remainingMs });
    }
  }, [actions, grace.remainingMs, runtime.recording.status]);

  // ----------
  // ---キー入力
  // ----------
  useEffect(() => {
    const isEditableTarget = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false;
      const tagName = target.tagName;
      return (
        target.isContentEditable ||
        tagName === "INPUT" ||
        tagName === "TEXTAREA" ||
        tagName === "SELECT" ||
        tagName === "BUTTON"
      );
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (settings.inputMode === "PTT") {
        if (event.code === "Escape") {
          if (runtime.recording.status !== "grace") return;
          event.preventDefault();
          void cancelPttGrace();
          return;
        }
        if (blockGlobalShortcuts) return;
        if (event.code !== "Space") return;
        if (event.repeat) return;
        if (isEditableTarget(event.target)) return;
        event.preventDefault();
        handlePttPress();
        return;
      }

      if (settings.inputMode === "TOGGLE") {
        if (blockGlobalShortcuts) return;
        if (event.code !== "Space") return;
        if (event.repeat) return;
        if (isEditableTarget(event.target)) return;
        event.preventDefault();
        handleToggleRecording();
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (settings.inputMode !== "PTT") return;
      if (event.code !== "Space") return;
      if (isEditableTarget(event.target)) return;
      event.preventDefault();
      handlePttRelease();
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [
    blockGlobalShortcuts,
    cancelPttGrace,
    handlePttPress,
    handlePttRelease,
    handleToggleRecording,
    runtime.recording.status,
    settings.inputMode,
  ]);

  // ----------
  // ---メモ編集・入力モード切り替えで、録音を停止する
  // ----------
  useEffect(() => {
    if (runtime.ui.editOpen) {
      if (runtime.recording.status === "listening") {
        void stopVadListening();
      }
      if (runtime.recording.status === "recording" || runtime.recording.status === "grace") {
        void stopContinuousRecordingImmediately();
      }
    }
  }, [runtime.ui.editOpen, runtime.recording.status, stopContinuousRecordingImmediately, stopVadListening]);

  useEffect(() => {
    const { status } = runtime.recording;
    if (settings.inputMode === "VAD") {
      if (status === "recording" || status === "grace") {
        void stopContinuousRecordingImmediately();
      }
      return;
    }
    if (status === "listening") {
      void stopVadListening();
      return;
    }
    const activeMode = continuousModeRef.current;
    if ((status === "recording" || status === "grace") && activeMode && activeMode !== settings.inputMode) {
      void stopContinuousRecordingImmediately();
    }
  }, [settings.inputMode, runtime.recording.status, stopContinuousRecordingImmediately, stopVadListening]);

  const isEditLocked =
    runtime.recording.status !== "idle" || runtime.processing.sttRunning || runtime.processing.llmRunning;
  const isInputLocked = runtime.ui.editOpen;
  const canRetryLLM =
    runtime.ui.error?.stage === "LLM" && runtime.processing.pendingTranscriptText.trim().length > 0;

  const transcriptText = useMemo(() => {
    return transcripts.entries
      .slice()
      .reverse()
      .map((entry) => `[${new Date(entry.createdAt).toLocaleString()}] (${entry.mode}) ${entry.text}`)
      .join("\n");
  }, [transcripts.entries]);

  const handleCopyMemo = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(memo.markdown);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to copy memo.";
      actions.setRuntimeError({ stage: "LLM", message });
    }
  }, [actions, memo.markdown]);

  const handleCopyTranscripts = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(transcriptText);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to copy transcript logs.";
      actions.setRuntimeError({ stage: "LLM", message });
    }
  }, [actions, transcriptText]);

  return (
    <div className="flex h-svh flex-col bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <main className="mx-auto flex min-h-0 w-full max-w-4xl flex-1 flex-col gap-4 p-4">
        <MemoPane
          markdown={memo.markdown}
          isEditing={runtime.ui.editOpen}
          isLocked={isEditLocked}
          error={runtime.ui.error}
          canRetryLLM={canRetryLLM}
          onRetryLLM={handleRetryLLM}
          onToggleEdit={() => actions.setUi({ editOpen: !runtime.ui.editOpen })}
          onChangeMarkdown={(value) => actions.setMemo(value)}
          onCopy={handleCopyMemo}
          onOpenSettings={() => actions.setUi({ settingsOpen: true })}
          onOpenTranscripts={() => actions.setUi({ transcriptLogOpen: true })}
        />
      </main>

      <ControlBar
        mode={settings.inputMode}
        recordingStatus={runtime.recording.status}
        graceRemainingMs={runtime.recording.graceRemainingMs}
        vadHoldActive={runtime.recording.vadHoldActive}
        sttRunning={runtime.processing.sttRunning}
        llmRunning={runtime.processing.llmRunning}
        queueCount={runtime.processing.queueCount}
        isLocked={isInputLocked}
        onPttPress={handlePttPress}
        onPttRelease={handlePttRelease}
        onPttGraceCancel={cancelPttGrace}
        onToggleRecording={handleToggleRecording}
        onToggleVadListening={toggleVadListening}
        onToggleVadHold={toggleVadHold}
      />

      <SettingsModal
        open={runtime.ui.settingsOpen}
        settings={settings}
        onClose={() => actions.setUi({ settingsOpen: false })}
        onChangeSettings={actions.setSettings}
        onClearMemo={actions.resetMemo}
        onOpenTranscripts={() => actions.setUi({ settingsOpen: false, transcriptLogOpen: true })}
        onClearTranscripts={actions.clearTranscripts}
      />

      <TranscriptLogModal
        open={runtime.ui.transcriptLogOpen}
        entries={transcripts.entries}
        onClose={() => actions.setUi({ transcriptLogOpen: false })}
        onCopy={handleCopyTranscripts}
        onClear={actions.clearTranscripts}
      />
    </div>
  );
}

export default App;
