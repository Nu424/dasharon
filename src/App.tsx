import { useCallback, useEffect, useMemo, useRef } from "react";
import { MemoPane } from "./components/MemoPane";
import { ControlBar } from "./components/ControlBar";
import { SettingsModal } from "./components/SettingsModal";
import { TranscriptLogModal } from "./components/TranscriptLogModal";
import { useGraceRelease } from "./hooks/useGraceRelease";
import { AudioRecorder } from "./modules/DataRecorder/AudioRecorder";
import { VadAudioRecorder } from "./modules/DataRecorder/VadAudioRecorder";
import { useAppStore } from "./store/useAppStore";
import { ProcessingPipeline } from "./services/pipeline/processingLoop";
import { VadBuffer } from "./services/vad/vadBuffer";

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
  const blockGlobalPtt = runtime.ui.editOpen || runtime.ui.settingsOpen || runtime.ui.transcriptLogOpen;

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
  // ---PTT
  // ----------
  /**
   * PTT録音の猶予後に録音を確定し、STTキューへ渡す。
   */
  const finalizePtt = useCallback(async () => {
    if (isFinalizingRef.current) return;
    const sessionToken = pttSessionRef.current;
    isFinalizingRef.current = true;
    actions.setRecording({ status: "finalizing", graceRemainingMs: 0 });
    try {
      const recorder = audioRecorderRef.current;
      if (!recorder) {
        actions.setRecording({ status: "idle", graceRemainingMs: 0 });
        return;
      }
      // ---recorderを停止し、audioManagerを取得する。
      const audioManager = await recorder.stopRecord(settings.graceMs);
      if (sessionToken !== pttSessionRef.current) return; // 録音セッションが変わっていたら破棄(猶予中にPTTを複数回押した場合など)
      if (audioManager) {
        // ---audioManagerをSTTキューへ渡す。
        pipelineRef.current?.enqueue({ audioManager, mode: "PTT" });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to finalize PTT audio.";
      actions.setRuntimeError({ stage: "STT", message });
    } finally {
      actions.setRecording({ status: "idle", graceRemainingMs: 0 });
      isFinalizingRef.current = false;
    }
  }, [actions, settings.graceMs]);

  // 猶予カウント制御。猶予カウントが終了したらPTT録音を確定する。
  const grace = useGraceRelease({
    graceMs: settings.graceMs,
    onGraceEnd: () => {
      void finalizePtt();
    },
  });

  /**
   * PTT録音を開始する。
   */
  const startPttRecording = useCallback(async () => {
    try {
      if (!audioRecorderRef.current) {
        audioRecorderRef.current = new AudioRecorder();
      }
      await audioRecorderRef.current.startRecord(250);
      pttSessionRef.current += 1; // セッションidをインクリメントする。
      actions.setRecording({ status: "recording", graceRemainingMs: 0 });
      actions.clearRuntimeError();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to start recording.";
      actions.setRuntimeError({ stage: "STT", message });
    }
  }, [actions]);

  /**
   * 即時にPTT録音を終了する。
   * @notes 即時PTT終了は、PTT録音中にメモ編集をしたり、入力方法を変えたりしたときに実行される。キャンセルではない
   */
  const stopPttImmediately = useCallback(async () => {
    grace.cancel();
    if (runtime.recording.status === "idle") return;
    actions.setRecording({ status: "finalizing", graceRemainingMs: 0 });
    try {
      const recorder = audioRecorderRef.current;
      if (!recorder) {
        actions.setRecording({ status: "idle", graceRemainingMs: 0 });
        return;
      }
      const audioManager = await recorder.stopRecord(0);
      if (audioManager) {
        // ---audioManagerをSTTキューへ渡す。
        pipelineRef.current?.enqueue({ audioManager, mode: "PTT" });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to stop recording.";
      actions.setRuntimeError({ stage: "STT", message });
    } finally {
      actions.setRecording({ status: "idle", graceRemainingMs: 0 });
    }
  }, [actions, grace, runtime.recording.status]);

  /**
   * PTT押下時の処理。
   */
  const handlePttPress = useCallback(() => {
    if (runtime.ui.editOpen) return;
    grace.press();
    if (runtime.recording.status === "idle") {
      void startPttRecording();
      return;
    }
    if (runtime.recording.status === "grace") {
      actions.setRecording({ status: "recording", graceRemainingMs: 0 });
    }
  }, [actions, grace, runtime.recording.status, runtime.ui.editOpen, startPttRecording]);

  /**
   * PTTを離した時の処理。
   */
  const handlePttRelease = useCallback(() => {
    if (runtime.recording.status !== "recording") return;
    actions.setRecording({ status: "grace" });
    grace.release(); // ここではrecorder.stopRecord()は呼ばない。最終的にはonGraceEnd()のほうでstopRecord()が呼ばれる
  }, [actions, grace, runtime.recording.status]);

  /**
   * PTT猶予中の送信をキャンセルして録音を破棄する。
   */
  const cancelPttGrace = useCallback(async () => {
    if (runtime.recording.status !== "grace") return;
    grace.cancel();
    pttSessionRef.current += 1;
    actions.setRecording({ status: "idle", graceRemainingMs: 0 });
    try {
      await audioRecorderRef.current?.cancelRecord();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to cancel recording.";
      actions.setRuntimeError({ stage: "STT", message });
    }
  }, [actions, grace, runtime.recording.status]);

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
      // ---VADが完了したときのコールバック
      vadBufferRef.current?.addSegment(audioManager);
      const holdActive = useAppStore.getState().runtime.recording.vadHoldActive;
      if (!holdActive) {
        // ---ホールドされてない場合は、バッファをflushし、STTキューへ送信する。
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
    // パイプラインとVADバッファを初期化する。
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
      onFlush: (audioManager) => pipelineRef.current?.enqueue({ audioManager, mode: "VAD" }), // VADバッファがflushされたときに、STTキューへ送信する。
      onCountChange: (count) => useAppStore.getState().actions.setRecording({ vadBufferCount: count }),
    });
    return () => {
      pipelineRef.current?.dispose();
      vadBufferRef.current?.clear();
    };
  }, []);

  useEffect(() => {
    // 猶予カウントの残り時間をUIに反映。
    if (runtime.recording.status === "grace") {
      actions.setRecording({ graceRemainingMs: grace.remainingMs });
    }
  }, [actions, grace.remainingMs, runtime.recording.status]);

  // ----------
  // ---キー入力
  // ----------
  useEffect(() => {
    /**
     * フォーム要素への入力時はグローバルPTTを無効にする。
     */
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

    /**
     * スペースキー押下でPTTを開始する。
     */
    const handleKeyDown = (event: KeyboardEvent) => {
      if (settings.inputMode !== "PTT") return;
      if (event.code === "Escape") { // 猶予中の場合、Escが押されたら、PTT録音をキャンセルする。
        if (runtime.recording.status !== "grace") return;
        event.preventDefault();
        void cancelPttGrace();
        return;
      }
      if (blockGlobalPtt) return;
      if (event.code !== "Space") return;
      if (event.repeat) return;
      if (isEditableTarget(event.target)) return;
      event.preventDefault();
      handlePttPress();
    };

    /**
     * スペースキー解除でPTTを終了する。
     */
    const handleKeyUp = (event: KeyboardEvent) => {
      if (settings.inputMode !== "PTT") return;
      if (event.code !== "Space") return;
      if (isEditableTarget(event.target)) return;
      event.preventDefault();
      handlePttRelease(); // handlePttRelease()を呼び、ボタンと同じようにPTT録音を終了する。
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [
    blockGlobalPtt,
    cancelPttGrace,
    handlePttPress,
    handlePttRelease,
    runtime.recording.status,
    settings.inputMode,
  ]);

  // ----------
  // ---メモ編集・入力モード切り替えで、録音を停止する
  // ----------
  useEffect(() => {
    // 編集中は録音を停止する。
    if (runtime.ui.editOpen) {
      if (runtime.recording.status === "listening") {
        void stopVadListening();
      }
      if (runtime.recording.status === "recording" || runtime.recording.status === "grace") {
        void stopPttImmediately();
      }
    }
  }, [runtime.ui.editOpen, runtime.recording.status, stopPttImmediately, stopVadListening]);

  useEffect(() => {
    // 入力モードの切替に合わせて不要な録音を停止する。
    if (settings.inputMode === "VAD") {
      if (runtime.recording.status === "recording" || runtime.recording.status === "grace") {
        void stopPttImmediately();
      }
    } else if (runtime.recording.status === "listening") {
      void stopVadListening();
    }
  }, [settings.inputMode, runtime.recording.status, stopPttImmediately, stopVadListening]);

  // UIのロック判定。
  const isEditLocked =
    runtime.recording.status !== "idle" || runtime.processing.sttRunning || runtime.processing.llmRunning;
  const isInputLocked = runtime.ui.editOpen;
  const canRetryLLM =
    runtime.ui.error?.stage === "LLM" && runtime.processing.pendingTranscriptText.trim().length > 0;

  // ログ表示用にテキストを整形。
  const transcriptText = useMemo(() => {
    return transcripts.entries
      .slice()
      .reverse()
      .map((entry) => `[${new Date(entry.createdAt).toLocaleString()}] (${entry.mode}) ${entry.text}`)
      .join("\n");
  }, [transcripts.entries]);

  // ----------
  // ---クリップボード操作
  // ----------
  /**
   * メモ本文をクリップボードにコピーする。
   */
  const handleCopyMemo = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(memo.markdown);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to copy memo.";
      actions.setRuntimeError({ stage: "LLM", message });
    }
  }, [actions, memo.markdown]);

  /**
   * 文字起こしログをクリップボードにコピーする。
   */
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
      {/* メインメモ領域 */}
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

      {/* 収録コントロール */}
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
        onToggleVadListening={toggleVadListening}
        onToggleVadHold={toggleVadHold}
      />

      {/* 設定モーダル */}
      <SettingsModal
        open={runtime.ui.settingsOpen}
        settings={settings}
        onClose={() => actions.setUi({ settingsOpen: false })}
        onChangeSettings={actions.setSettings}
        onClearMemo={actions.resetMemo}
        onOpenTranscripts={() => actions.setUi({ settingsOpen: false, transcriptLogOpen: true })}
        onClearTranscripts={actions.clearTranscripts}
      />

      {/* 文字起こしログモーダル */}
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
