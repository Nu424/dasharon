import { memoStylePresets } from "../../constants/memoStylePresets";
import { DEFAULT_LLM_SYSTEM_PROMPT_TEMPLATE } from "./promptTemplate";

type LegacySettings = {
  memoStylePresetId?: string;
  memoStyleCustomInstruction?: string;
  summaryLanguage?: string;
};

/**
 * 旧プリセット設定から初期テンプレートを生成する。
 */
export function buildTemplateFromLegacySettings(settings: LegacySettings): string {
  const presetInstruction =
    memoStylePresets.find((preset) => preset.id === settings.memoStylePresetId)?.instruction ?? "";
  const styleInstruction = [presetInstruction, settings.memoStyleCustomInstruction ?? ""]
    .filter(Boolean)
    .join("\n");

  if (!styleInstruction) {
    return DEFAULT_LLM_SYSTEM_PROMPT_TEMPLATE;
  }

  return DEFAULT_LLM_SYSTEM_PROMPT_TEMPLATE.replace(
    "Constraints: Return the updated memo only. No code fences. No preface.",
    `Style instruction:\n${styleInstruction}\n\nConstraints: Return the updated memo only. No code fences. No preface.`,
  );
}
