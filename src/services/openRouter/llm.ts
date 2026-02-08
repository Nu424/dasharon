import { openRouterFetchJson } from "./openRouterFetch";

/** メモ更新に必要な入力。 */
type UpdateMemoParams = {
  apiKey: string;
  model: string;
  currentMemo: string;
  newTranscriptText: string;
  styleInstruction: string;
  summaryLanguage: string;
  timeoutMs: number;
  retryCount: number;
};

/** OpenRouterのチャット応答形。 */
type OpenRouterChatResponse = {
  choices: Array<{
    message: {
      role: string;
      content: string;
    };
  }>;
};

// メモ更新のためのシステム指示文。
const systemPrompt =
  "You are an editor of a discussion memo. Preserve existing structure, update only what is needed, and keep the memo readable.";

/** ユーザープロンプトを組み立てる。 */
const buildUserPrompt = ({
  currentMemo,
  newTranscriptText,
  styleInstruction,
  summaryLanguage,
}: Pick<UpdateMemoParams, "currentMemo" | "newTranscriptText" | "styleInstruction" | "summaryLanguage">) => {
  return [
    `Summary language: ${summaryLanguage}`,
    "Style instruction:",
    styleInstruction || "(none)",
    "Current memo:",
    currentMemo.trim() ? currentMemo : "(empty)",
    "New transcript:",
    newTranscriptText.trim(),
    "Constraints: Return the updated memo only. No code fences. No preface.",
  ].join("\n\n");
};

/**
 * 既存のメモと新規文字起こしから更新版メモを生成する。
 */
export async function updateMemo({
  apiKey,
  model,
  currentMemo,
  newTranscriptText,
  styleInstruction,
  summaryLanguage,
  timeoutMs,
  retryCount,
}: UpdateMemoParams): Promise<string> {
  const response = await openRouterFetchJson<OpenRouterChatResponse>({
    apiKey,
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: buildUserPrompt({ currentMemo, newTranscriptText, styleInstruction, summaryLanguage }),
        },
      ],
    }),
    timeoutMs,
    retryCount,
  });

  const content = response.choices?.[0]?.message?.content ?? "";
  return content.trim();
}
