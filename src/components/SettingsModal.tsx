import { DEFAULT_SETTINGS } from "../store/useAppStore";
import type { Settings } from "../store/useAppStore";
import {
  findUnknownPlaceholders,
  PROMPT_PLACEHOLDERS,
} from "../services/openRouter/promptTemplate";

type SettingsModalProps = {
  open: boolean;
  settings: Settings;
  onClose: () => void;
  onChangeSettings: (partial: Partial<Settings>) => void;
  onClearMemo: () => void;
  onOpenTranscripts: () => void;
  onClearTranscripts: () => void;
};

/** 数値入力を安全にパースする。 */
const parseNumber = (value: string, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

/**
 * 設定モーダル。
 */
export function SettingsModal({
  open,
  settings,
  onClose,
  onChangeSettings,
  onClearMemo,
  onOpenTranscripts,
  onClearTranscripts,
}: SettingsModalProps) {
  if (!open) return null;

  const graceSeconds = (settings.graceMs / 1000).toFixed(1);
  const timeoutSeconds = Math.round(settings.timeoutMs / 1000);
  const unknownPlaceholders = findUnknownPlaceholders(settings.llmSystemPromptTemplate);

  const handleResetPromptTemplate = () => {
    const confirmed = window.confirm(
      "Reset the prompt template to the default? This cannot be undone except by editing again.",
    );
    if (!confirmed) return;
    onChangeSettings({ llmSystemPromptTemplate: DEFAULT_SETTINGS.llmSystemPromptTemplate });
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4 dark:bg-black/70">
      <div className="max-h-full w-full max-w-2xl overflow-auto rounded border border-slate-200 bg-white p-5 text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100">
        {/* ヘッダー */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Settings</h2>
          <button
            className="rounded border border-slate-300 px-3 py-1 text-sm dark:border-slate-700"
            type="button"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <div className="space-y-6 text-sm">
          {/* API設定 */}
          <section className="space-y-2">
            <h3 className="font-semibold">API</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              API key is stored in localStorage as plain text.
            </p>
            <input
              className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              type="password"
              placeholder="OpenRouter API Key"
              value={settings.openRouterApiKey}
              onChange={(event) => onChangeSettings({ openRouterApiKey: event.target.value })}
            />
          </section>

          {/* モデル・音声設定 */}
          <section className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <h3 className="font-semibold">Models</h3>
              <label className="block">
                <span className="text-xs text-slate-600 dark:text-slate-400">STT Model</span>
                <input
                  className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  type="text"
                  value={settings.sttModel}
                  onChange={(event) => onChangeSettings({ sttModel: event.target.value })}
                />
              </label>
              <label className="block">
                <span className="text-xs text-slate-600 dark:text-slate-400">LLM Model</span>
                <input
                  className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  type="text"
                  value={settings.llmModel}
                  onChange={(event) => onChangeSettings({ llmModel: event.target.value })}
                />
              </label>
            </div>

            <div className="space-y-2">
              <h3 className="font-semibold">Audio</h3>
              <label className="block">
                <span className="text-xs text-slate-600 dark:text-slate-400">Input Mode</span>
                <select
                  className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  value={settings.inputMode}
                  onChange={(event) =>
                    onChangeSettings({ inputMode: event.target.value as Settings["inputMode"] })
                  }
                >
                  <option value="PTT">PTT</option>
                  <option value="TOGGLE">Toggle</option>
                  <option value="VAD">VAD</option>
                </select>
              </label>
              {settings.inputMode === "PTT" ? (
                <label className="block">
                  <span className="text-xs text-slate-600 dark:text-slate-400">Grace (seconds)</span>
                  <input
                    className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                    type="number"
                    min={0}
                    step={0.1}
                    value={graceSeconds}
                    onChange={(event) =>
                      onChangeSettings({ graceMs: Math.max(0, parseNumber(event.target.value)) * 1000 })
                    }
                  />
                </label>
              ) : null}
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={settings.sttChunkingEnabled}
                  onChange={(event) => onChangeSettings({ sttChunkingEnabled: event.target.checked })}
                />
                <span className="text-xs text-slate-600 dark:text-slate-400">
                  Split long audio on silence before STT
                </span>
              </label>
            </div>
          </section>

          {/* 言語・外観設定 */}
          <section className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <h3 className="font-semibold">Language</h3>
              <label className="block">
                <span className="text-xs text-slate-600 dark:text-slate-400">Summary Language</span>
                <input
                  className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  list="summary-language-options"
                  value={settings.summaryLanguage}
                  onChange={(event) => onChangeSettings({ summaryLanguage: event.target.value })}
                />
                <datalist id="summary-language-options">
                  <option value="ja" />
                  <option value="en" />
                </datalist>
              </label>
            </div>

            <div className="space-y-2">
              <h3 className="font-semibold">Appearance</h3>
              <label className="block">
                <span className="text-xs text-slate-600 dark:text-slate-400">Theme</span>
                <select
                  className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  value={settings.theme}
                  onChange={(event) =>
                    onChangeSettings({ theme: event.target.value as Settings["theme"] })
                  }
                >
                  <option value="system">System</option>
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                </select>
              </label>
            </div>
          </section>

          {/* LLMプロンプト設定 */}
          <section className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-semibold">LLM Prompt Template</h3>
              <button
                className="rounded border border-slate-300 px-3 py-1 text-xs dark:border-slate-700"
                type="button"
                onClick={handleResetPromptTemplate}
              >
                Reset to default
              </button>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              This template is sent as the system message. It is saved in localStorage.
            </p>
            <div className="rounded border border-slate-200 bg-slate-50 p-2 text-xs dark:border-slate-800 dark:bg-slate-950/40">
              <div className="font-medium text-slate-700 dark:text-slate-300">Available placeholders</div>
              <ul className="mt-1 space-y-1 text-slate-600 dark:text-slate-400">
                {PROMPT_PLACEHOLDERS.map((placeholder) => (
                  <li key={placeholder.key}>
                    <code>{`{${placeholder.key}}`}</code> — {placeholder.description}
                  </li>
                ))}
              </ul>
            </div>
            <label className="block">
              <span className="text-xs text-slate-600 dark:text-slate-400">System prompt template</span>
              <textarea
                className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1 font-mono text-xs dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                rows={12}
                value={settings.llmSystemPromptTemplate}
                onChange={(event) => onChangeSettings({ llmSystemPromptTemplate: event.target.value })}
              />
            </label>
            {unknownPlaceholders.length > 0 ? (
              <p className="text-xs text-amber-700 dark:text-amber-300">
                Unknown placeholders: {unknownPlaceholders.map((key) => `{${key}}`).join(", ")}
              </p>
            ) : null}
          </section>

          {/* データ設定 */}
          <section className="space-y-2">
            <h3 className="font-semibold">Data</h3>
            <div className="flex flex-wrap gap-2">
              <button
                className="rounded border border-slate-300 px-3 py-1 text-sm dark:border-slate-700"
                type="button"
                onClick={onClearMemo}
              >
                Clear Memo
              </button>
              <button
                className="rounded border border-slate-300 px-3 py-1 text-sm dark:border-slate-700"
                type="button"
                onClick={onOpenTranscripts}
              >
                View Logs
              </button>
              <button
                className="rounded border border-slate-300 px-3 py-1 text-sm dark:border-slate-700"
                type="button"
                onClick={onClearTranscripts}
              >
                Clear Logs
              </button>
            </div>
          </section>

          {/* 詳細設定 */}
          <details className="rounded border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-800 dark:bg-slate-950/40">
            <summary className="cursor-pointer font-semibold text-slate-700 dark:text-slate-300">
              Advanced
            </summary>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <h4 className="font-semibold">Network</h4>
                <label className="block">
                  <span className="text-xs text-slate-600 dark:text-slate-400">Timeout (seconds)</span>
                  <input
                    className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                    type="number"
                    min={10}
                    step={1}
                    value={timeoutSeconds}
                    onChange={(event) =>
                      onChangeSettings({
                        timeoutMs: Math.max(0, parseNumber(event.target.value)) * 1000,
                      })
                    }
                  />
                </label>
                <label className="block">
                  <span className="text-xs text-slate-600 dark:text-slate-400">Retry Count</span>
                  <input
                    className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                    type="number"
                    min={0}
                    step={1}
                    value={settings.retryCount}
                    onChange={(event) =>
                      onChangeSettings({
                        retryCount: Math.max(0, Math.floor(parseNumber(event.target.value))),
                      })
                    }
                  />
                </label>
              </div>
              <div className="space-y-2">
                <h4 className="font-semibold">STT Chunking</h4>
                <label className="block">
                  <span className="text-xs text-slate-600 dark:text-slate-400">Max chunk (seconds)</span>
                  <input
                    className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                    type="number"
                    min={5}
                    step={1}
                    value={Math.round(settings.sttMaxChunkMs / 1000)}
                    onChange={(event) =>
                      onChangeSettings({
                        sttMaxChunkMs: Math.max(5_000, parseNumber(event.target.value) * 1000),
                      })
                    }
                  />
                </label>
                <label className="block">
                  <span className="text-xs text-slate-600 dark:text-slate-400">Min silence (ms)</span>
                  <input
                    className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                    type="number"
                    min={100}
                    step={50}
                    value={settings.sttMinSilenceMs}
                    onChange={(event) =>
                      onChangeSettings({
                        sttMinSilenceMs: Math.max(100, parseNumber(event.target.value)),
                      })
                    }
                  />
                </label>
                <label className="block">
                  <span className="text-xs text-slate-600 dark:text-slate-400">Silence threshold (0-1)</span>
                  <input
                    className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                    type="number"
                    min={0.001}
                    max={1}
                    step={0.001}
                    value={settings.sttSilenceThreshold}
                    onChange={(event) =>
                      onChangeSettings({
                        sttSilenceThreshold: Math.min(1, Math.max(0.001, parseNumber(event.target.value))),
                      })
                    }
                  />
                </label>
                <label className="block">
                  <span className="text-xs text-slate-600 dark:text-slate-400">Min chunk (ms)</span>
                  <input
                    className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                    type="number"
                    min={200}
                    step={100}
                    value={settings.sttMinChunkMs}
                    onChange={(event) =>
                      onChangeSettings({
                        sttMinChunkMs: Math.max(200, parseNumber(event.target.value)),
                      })
                    }
                  />
                </label>
                <label className="block">
                  <span className="text-xs text-slate-600 dark:text-slate-400">Padding (ms)</span>
                  <input
                    className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                    type="number"
                    min={0}
                    step={50}
                    value={settings.sttPaddingMs}
                    onChange={(event) =>
                      onChangeSettings({
                        sttPaddingMs: Math.max(0, parseNumber(event.target.value)),
                      })
                    }
                  />
                </label>
              </div>
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}
