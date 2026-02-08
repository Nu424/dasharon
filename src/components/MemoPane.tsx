import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
import type { RuntimeError } from "../store/useAppStore";

type MemoPaneProps = {
  markdown: string;
  isEditing: boolean;
  isLocked: boolean;
  error?: RuntimeError;
  canRetryLLM: boolean;
  onRetryLLM: () => void;
  onToggleEdit: () => void;
  onChangeMarkdown: (value: string) => void;
  onCopy: () => void;
  onOpenSettings: () => void;
  onOpenTranscripts: () => void;
};

/**
 * メモ表示・編集ペイン。
 */
export function MemoPane({
  markdown,
  isEditing,
  isLocked,
  error,
  canRetryLLM,
  onRetryLLM,
  onToggleEdit,
  onChangeMarkdown,
  onCopy,
  onOpenSettings,
  onOpenTranscripts,
}: MemoPaneProps) {
  return (
    <section className="flex h-full flex-col gap-3">
      {/* ヘッダー操作 */}
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-lg font-semibold">Dasharon</h1>
        <div className="flex flex-wrap gap-2">
          <button
            className="rounded border border-slate-300 px-3 py-1 text-sm disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900/40"
            type="button"
            onClick={onCopy}
          >
            Copy
          </button>
          <button
            className="rounded border border-slate-300 px-3 py-1 text-sm disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900/40"
            type="button"
            onClick={onToggleEdit}
            disabled={isLocked}
          >
            {isEditing ? "Done" : "Edit"}
          </button>
          <button
            className="rounded border border-slate-300 px-3 py-1 text-sm disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900/40"
            type="button"
            onClick={onOpenTranscripts}
          >
            Logs
          </button>
          <button
            className="rounded border border-slate-300 px-3 py-1 text-sm disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900/40"
            type="button"
            onClick={onOpenSettings}
          >
            Settings
          </button>
        </div>
      </div>

      {/* エラー表示 */}
      {error ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded border border-red-400 bg-red-50 p-2 text-sm text-red-700 dark:border-red-500/60 dark:bg-red-950/40 dark:text-red-200">
          <div>
            <strong className="mr-2">{error.stage}</strong>
            <span>{error.message}</span>
          </div>
          {error.stage === "LLM" && canRetryLLM ? (
            <button
              className="rounded border border-red-400 px-3 py-1 text-xs dark:border-red-500/70"
              type="button"
              onClick={onRetryLLM}
            >
              Retry
            </button>
          ) : null}
        </div>
      ) : null}

      {/* メモ本文 */}
      <div className="min-h-0 flex-1 overflow-auto rounded border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        {isEditing ? (
          <textarea
            className="h-full w-full resize-none rounded border border-slate-200 bg-white p-2 text-sm focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
            value={markdown}
            onChange={(event) => onChangeMarkdown(event.target.value)}
          />
        ) : markdown.trim().length > 0 ? (
          <div
            className="prose prose-sm prose-slate max-w-none dark:prose-invert"
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.code !== "Space") return;
              event.preventDefault();
            }}
          >
            <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>
              {markdown}
            </ReactMarkdown>
          </div>
        ) : (
          <div
            className="text-sm text-slate-500 dark:text-slate-400"
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.code !== "Space") return;
              event.preventDefault();
            }}
          >
            No memo yet. Start talking to build it.
          </div>
        )}
      </div>
    </section>
  );
}
