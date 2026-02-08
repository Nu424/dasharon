import type { TranscriptEntry } from "../store/useAppStore";

type TranscriptLogModalProps = {
  open: boolean;
  entries: TranscriptEntry[];
  onClose: () => void;
  onCopy: () => void;
  onClear: () => void;
};

/**
 * 文字起こしログの表示モーダル。
 */
export function TranscriptLogModal({ open, entries, onClose, onCopy, onClear }: TranscriptLogModalProps) {
  if (!open) return null;

  // 表示・コピー用にテキストをまとめる。
  const lines = entries
    .slice()
    .reverse()
    .map((entry) => {
      const date = new Date(entry.createdAt).toLocaleString();
      return `[${date}] (${entry.mode}) ${entry.text}`;
    });
  const combinedText = lines.join("\n");

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4 dark:bg-black/70">
      <div className="max-h-full w-full max-w-2xl overflow-auto rounded border border-slate-200 bg-white p-5 text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Transcript Logs</h2>
          <button
            className="rounded border border-slate-300 px-3 py-1 text-sm dark:border-slate-700"
            type="button"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-400">
          <span>{entries.length} entries</span>
          <div className="flex gap-2">
            <button
              className="rounded border border-slate-300 px-3 py-1 text-sm dark:border-slate-700"
              type="button"
              onClick={onCopy}
            >
              Copy
            </button>
            <button
              className="rounded border border-slate-300 px-3 py-1 text-sm dark:border-slate-700"
              type="button"
              onClick={onClear}
            >
              Clear
            </button>
          </div>
        </div>

        <textarea
          className="h-80 w-full resize-none rounded border border-slate-200 bg-white p-2 text-xs dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
          value={combinedText}
          readOnly
        />
      </div>
    </div>
  );
}
