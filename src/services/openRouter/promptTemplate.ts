/** LLMプロンプトテンプレートで使用できるプレースホルダー。 */
export const PROMPT_PLACEHOLDERS = [
  { key: "sttText", description: "Pending transcript text batched for LLM update" },
  { key: "currentMemo", description: "Current memo markdown" },
  { key: "summaryLanguage", description: "Summary language setting" },
] as const;

export type PromptPlaceholderKey = (typeof PROMPT_PLACEHOLDERS)[number]["key"];

export type PromptTemplateVars = Record<PromptPlaceholderKey, string>;

/** 既定のLLMシステムプロンプトテンプレート。 */
export const DEFAULT_LLM_SYSTEM_PROMPT_TEMPLATE = `You are an editor of a discussion memo. Preserve existing structure, update only what is needed, and keep the memo readable.

Summary language: {summaryLanguage}

Current memo:
{currentMemo}

New transcript:
{sttText}

Constraints: Return the updated memo only. No code fences. No preface.`;

const PLACEHOLDER_PATTERN = /\{([a-zA-Z][a-zA-Z0-9_]*)\}/g;
const ALLOWED_KEYS = new Set<string>(PROMPT_PLACEHOLDERS.map((item) => item.key));

/**
 * テンプレート内の未知プレースホルダーを検出する。
 */
export function findUnknownPlaceholders(template: string): string[] {
  const unknown = new Set<string>();
  for (const match of template.matchAll(PLACEHOLDER_PATTERN)) {
    const key = match[1];
    if (!ALLOWED_KEYS.has(key)) {
      unknown.add(key);
    }
  }
  return [...unknown];
}

/**
 * プロンプトテンプレートを展開する。
 */
export function renderPromptTemplate(template: string, vars: PromptTemplateVars): string {
  const unknown = findUnknownPlaceholders(template);
  if (unknown.length > 0) {
    throw new Error(`Unknown prompt placeholders: ${unknown.join(", ")}`);
  }

  return template.replace(PLACEHOLDER_PATTERN, (_match, key: string) => {
    if (!ALLOWED_KEYS.has(key)) {
      return _match;
    }
    return vars[key as PromptPlaceholderKey] ?? "";
  });
}

/**
 * テンプレート展開用の変数を組み立てる。
 */
export function buildPromptTemplateVars({
  sttText,
  currentMemo,
  summaryLanguage,
}: PromptTemplateVars): PromptTemplateVars {
  return {
    sttText: sttText.trim(),
    currentMemo: currentMemo.trim() ? currentMemo : "(empty)",
    summaryLanguage,
  };
}
