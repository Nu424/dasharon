/** OpenRouter API呼び出しに必要なオプション。 */
type OpenRouterFetchOptions = {
  apiKey: string;
  url?: string;
  method?: string;
  headers?: HeadersInit;
  body?: string;
  timeoutMs: number;
  retryCount: number;
};

/** OpenRouter APIのエラー詳細。 */
type OpenRouterErrorDetails = {
  status?: number;
  body?: string;
};

/** OpenRouter API向けのエラー型。 */
export class OpenRouterError extends Error {
  status?: number;
  body?: string;
  constructor(message: string, details?: OpenRouterErrorDetails) {
    super(message);
    this.name = "OpenRouterError";
    this.status = details?.status;
    this.body = details?.body;
  }
}

export const OPENROUTER_CHAT_COMPLETIONS_URL = "https://openrouter.ai/api/v1/chat/completions";
export const OPENROUTER_AUDIO_TRANSCRIPTIONS_URL = "https://openrouter.ai/api/v1/audio/transcriptions";

/** 指定時間待機するユーティリティ。 */
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * OpenRouterのJSONレスポンスを取得する。
 * タイムアウトと指数バックオフ付きのリトライに対応。
 */
export async function openRouterFetchJson<T>({
  apiKey,
  url = OPENROUTER_CHAT_COMPLETIONS_URL,
  method = "POST",
  headers,
  body,
  timeoutMs,
  retryCount,
}: OpenRouterFetchOptions): Promise<T> {
  let lastError: unknown = null;

  for (let attempt = 0; attempt <= retryCount; attempt += 1) {
    // タイムアウト制御用のAbortController。
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          ...headers,
        },
        body,
        signal: controller.signal,
      });

      if (!response.ok) {
        const responseText = await response.text();
        throw new OpenRouterError(`OpenRouter error ${response.status}`, {
          status: response.status,
          body: responseText,
        });
      }
      return (await response.json()) as T;
    } catch (error) {
      // 4xx(429除く)は即時に失敗として扱う。
      if (error instanceof OpenRouterError && error.status && error.status < 500 && error.status !== 429) {
        throw error;
      }
      lastError = error;
      const isLast = attempt >= retryCount;
      if (isLast) {
        break;
      }
      // 5xx/429/ネットワークエラーは指数バックオフで再試行。
      const backoff = Math.min(8000, 1000 * 2 ** attempt);
      await sleep(backoff);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  if (lastError instanceof OpenRouterError) {
    throw lastError;
  }
  if (lastError instanceof Error) {
    throw lastError;
  }
  throw new Error("Unknown OpenRouter error");
}
