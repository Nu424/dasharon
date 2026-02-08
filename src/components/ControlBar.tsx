import type { InputMode, RecordingStatus } from "../store/useAppStore";

type ControlBarProps = {
  mode: InputMode;
  recordingStatus: RecordingStatus;
  graceRemainingMs: number;
  vadHoldActive: boolean;
  sttRunning: boolean;
  llmRunning: boolean;
  queueCount: number;
  isLocked: boolean;
  onPttPress: () => void;
  onPttRelease: () => void;
  onPttGraceCancel: () => void;
  onToggleVadListening: () => void;
  onToggleVadHold: () => void;
};

/** 猶予時間を表示用に整形する。 */
const formatGrace = (ms: number) => `${Math.max(0, ms / 1000).toFixed(1)}s`;

/**
 * 録音入力のコントロールバー。
 */
export function ControlBar({
  mode,
  recordingStatus,
  graceRemainingMs,
  vadHoldActive,
  sttRunning,
  llmRunning,
  queueCount,
  isLocked,
  onPttPress,
  onPttRelease,
  onPttGraceCancel,
  onToggleVadListening,
  onToggleVadHold,
}: ControlBarProps) {
  const isListening = recordingStatus === "listening";
  // ステータス表示用の文言を組み立てる。
  const statusParts = [
    recordingStatus === "recording" && "Recording",
    recordingStatus === "grace" && `Grace ${formatGrace(graceRemainingMs)}`,
    recordingStatus === "finalizing" && "Finalizing",
    recordingStatus === "listening" && "Listening",
    recordingStatus === "idle" && "Idle",
    sttRunning && "STT",
    llmRunning && "LLM",
    queueCount > 0 && `Queue ${queueCount}`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <section className="fixed bottom-0 left-0 right-0 border-t border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950">
      <div className="mx-auto flex max-w-4xl flex-col gap-2">
        <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
          <span>{mode}</span>
          <span>{statusParts || "Idle"}</span>
        </div>

        {mode === "PTT" ? (
          // PTT操作
          <div className="flex gap-2">
            <button
              type="button"
              className="h-14 flex-1 rounded-full bg-slate-900 text-sm font-semibold text-white disabled:opacity-40 dark:bg-slate-100 dark:text-slate-900"
              disabled={isLocked}
              onPointerDown={(event) => {
                event.preventDefault();
                onPttPress();
              }}
              onPointerUp={(event) => {
                event.preventDefault();
                onPttRelease();
              }}
              onPointerLeave={(event) => {
                event.preventDefault();
                onPttRelease();
              }}
              onPointerCancel={(event) => {
                event.preventDefault();
                onPttRelease();
              }}
            >
              Hold to Talk
            </button>
            {recordingStatus === "grace" ? (
              <button
                type="button"
                className="h-14 rounded-full border border-slate-300 px-4 text-sm font-semibold text-slate-700 disabled:opacity-40 dark:border-slate-700 dark:text-slate-100"
                disabled={isLocked}
                onClick={onPttGraceCancel}
              >
                Cancel
              </button>
            ) : null}
          </div>
        ) : (
          // VAD操作
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              className="h-12 rounded border border-slate-300 text-sm font-semibold disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900/40"
              disabled={isLocked}
              onClick={onToggleVadListening}
            >
              {isListening ? "Mic On" : "Mic Off"}
            </button>
            <button
              type="button"
              className="h-12 rounded border border-slate-300 text-sm font-semibold disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900/40"
              disabled={isLocked || !isListening}
              onClick={onToggleVadHold}
            >
              {vadHoldActive ? "Hold On" : "Hold Off"}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
