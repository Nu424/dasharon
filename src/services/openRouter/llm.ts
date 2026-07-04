import { openRouterFetchJson } from "./openRouterFetch";
import {
  buildPromptTemplateVars,
  renderPromptTemplate,
  type PromptTemplateVars,
} from "./promptTemplate";

/** メモ更新に必要な入力。 */
type UpdateMemoParams = {
  apiKey: string;
  model: string;
  promptTemplate: string;
  templateVars: PromptTemplateVars;
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

/**
 * 既存のメモと新規文字起こしから更新版メモを生成する。
 */
export async function updateMemo({
  apiKey,
  model,
  promptTemplate,
  templateVars,
  timeoutMs,
  retryCount,
}: UpdateMemoParams): Promise<string> {
  const systemContent = renderPromptTemplate(
    promptTemplate,
    buildPromptTemplateVars(templateVars),
  );

  const response = await openRouterFetchJson<OpenRouterChatResponse>({
    apiKey,
    body: JSON.stringify({
      model,
      messages: [{ role: "system", content: systemContent }],
    }),
    timeoutMs,
    retryCount,
  });

  const content = response.choices?.[0]?.message?.content ?? "";
  return content.trim();
}
