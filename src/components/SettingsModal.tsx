import { memoStylePresets } from "../constants/memoStylePresets";
import type { Settings } from "../store/useAppStore";

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
  const selectedPreset = memoStylePresets.find((preset) => preset.id === settings.memoStylePresetId);
  const presetInstruction = selectedPreset?.instruction ?? "";
  const combinedInstruction = [presetInstruction, settings.memoStyleCustomInstruction]
    .filter(Boolean)
    .join("\n\n");

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
                  <option value="VAD">VAD</option>
                </select>
              </label>
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
            </div>
          </section>

          {/* 言語・外観設定 */}
          <section className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <h3 className="font-semibold">Language</h3>
              <label className="block">
                <span className="text-xs text-slate-600 dark:text-slate-400">STT Language</span>
                <input
                  className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  list="stt-language-options"
                  value={settings.sttLanguage}
                  onChange={(event) => onChangeSettings({ sttLanguage: event.target.value })}
                />
                <datalist id="stt-language-options">
                  <option value="ja" />
                  <option value="en" />
                  <option value="auto" />
                </datalist>
              </label>
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

          {/* メモスタイル設定 */}
          <section className="space-y-2">
            <h3 className="font-semibold">Memo Style</h3>
            <label className="block">
              <span className="text-xs text-slate-600 dark:text-slate-400">Preset</span>
              <select
                className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                value={settings.memoStylePresetId}
                onChange={(event) => onChangeSettings({ memoStylePresetId: event.target.value })}
              >
                {memoStylePresets.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs text-slate-600 dark:text-slate-400">Custom Instruction</span>
              <textarea
                className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                rows={3}
                value={settings.memoStyleCustomInstruction}
                onChange={(event) =>
                  onChangeSettings({ memoStyleCustomInstruction: event.target.value })
                }
              />
            </label>
            <details className="rounded border border-slate-200 bg-slate-50 p-2 text-xs dark:border-slate-800 dark:bg-slate-950/40">
              <summary className="cursor-pointer text-slate-600 dark:text-slate-400">
                Show instructions
              </summary>
              <div className="mt-2 space-y-2">
                <div>
                  <div className="text-slate-600 dark:text-slate-400">Preset instruction</div>
                  <textarea
                    className="mt-1 w-full rounded border border-slate-200 bg-white px-2 py-1 text-xs dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                    rows={3}
                    value={presetInstruction || "(none)"}
                    readOnly
                  />
                </div>
                <div>
                  <div className="text-slate-600 dark:text-slate-400">Combined instruction</div>
                  <textarea
                    className="mt-1 w-full rounded border border-slate-200 bg-white px-2 py-1 text-xs dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                    rows={4}
                    value={combinedInstruction || "(none)"}
                    readOnly
                  />
                </div>
              </div>
            </details>
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
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}
