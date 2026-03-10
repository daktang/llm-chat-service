// ============================================
// LLM Chat Service - API Client
// ============================================
// 모든 API 요청은 Vite 프록시(/llm)를 통해 라우팅됩니다.
// 이를 통해 서버 터미널에 Request/Response 로그가 출력됩니다.
//
// 프록시 경로: /llm/v1/* → VITE_LITELLM_BASE_URL/v1/*
//
// ⚠️ 기본값 없음. .envrc에서 설정 필수.
// ============================================

function requireEnv(key: string): string {
  const value = import.meta.env[key];
  if (!value) {
    throw new Error(
      `❌ 환경변수 ${key}가 설정되지 않았습니다.\n` +
      `.envrc 파일에서 ${key}를 설정한 후 source .envrc를 실행하세요.`
    );
  }
  return value;
}

const API_KEY = requireEnv("VITE_LITELLM_API_KEY");

// 개발 환경에서는 Vite 프록시를 통해 요청 (서버 터미널 로그 출력)
// 프로덕션 환경에서는 직접 LiteLLM 서버로 요청
const BASE_URL = import.meta.env.DEV
  ? "/llm"
  : requireEnv("VITE_LITELLM_BASE_URL");

// 기본 타임아웃: 60초 (LLM 응답은 오래 걸릴 수 있음)
const DEFAULT_TIMEOUT_MS = 60_000;
// Chat completions는 더 긴 타임아웃: 120초
const CHAT_TIMEOUT_MS = 120_000;

// 재시도 설정
const MAX_RETRIES = 2;
const RETRY_BASE_DELAY_MS = 1_000; // 1초 → 2초 (지수 백오프)
// 재시도 대상 HTTP 상태 코드
const RETRYABLE_STATUS_CODES = new Set([408, 429, 500, 502, 503, 504]);

// ── Type Definitions ──────────────────────────

export interface Model {
  id: string;
  object: string;
  created: number;
  owned_by: string;
}

export interface ModelDetail extends Model {
  permission?: Record<string, unknown>[];
  root?: string;
  parent?: string | null;
}

export interface ModelsResponse {
  data: Model[];
  object: string;
}

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface ChatCompletionChoice {
  finish_reason: string;
  index: number;
  message: {
    content: string;
    role: string;
    reasoning_content?: string | null;
  };
}

export interface ChatCompletionResponse {
  id: string;
  created: number;
  model: string;
  object: string;
  choices: ChatCompletionChoice[];
  usage: {
    completion_tokens: number;
    prompt_tokens: number;
    total_tokens: number;
  };
}

export interface CompletionChoice {
  text: string;
  index: number;
  finish_reason: string;
}

export interface CompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: CompletionChoice[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface EmbeddingData {
  object: string;
  embedding: number[];
  index: number;
}

export interface EmbeddingResponse {
  object: string;
  data: EmbeddingData[];
  model: string;
  usage: {
    prompt_tokens: number;
    total_tokens: number;
  };
}

// ── Error Class ───────────────────────────────

/** Structured error with detailed diagnostic info */
export class ApiError extends Error {
  public readonly status: number | null;
  public readonly statusText: string;
  public readonly url: string;
  public readonly method: string;
  public readonly responseBody: string | null;
  public readonly errorType: "NETWORK" | "HTTP" | "PARSE" | "TIMEOUT" | "SERVER_TIMEOUT" | "UNKNOWN";
  public readonly timestamp: string;
  public readonly retryCount: number;

  constructor(params: {
    message: string;
    status: number | null;
    statusText: string;
    url: string;
    method: string;
    responseBody: string | null;
    errorType: "NETWORK" | "HTTP" | "PARSE" | "TIMEOUT" | "SERVER_TIMEOUT" | "UNKNOWN";
    retryCount?: number;
  }) {
    super(params.message);
    this.name = "ApiError";
    this.status = params.status;
    this.statusText = params.statusText;
    this.url = params.url;
    this.method = params.method;
    this.responseBody = params.responseBody;
    this.errorType = params.errorType;
    this.timestamp = new Date().toISOString();
    this.retryCount = params.retryCount ?? 0;
  }

  /** Human-readable diagnostic summary */
  toDiagnosticString(): string {
    const lines = [
      `═══════════════════════════════════════`,
      `🔴 API Error [${this.errorType}]`,
      `═══════════════════════════════════════`,
      `Timestamp : ${this.timestamp}`,
      `Method    : ${this.method}`,
      `URL       : ${this.url}`,
      `Status    : ${this.status ?? "N/A"} ${this.statusText}`,
      `Retries   : ${this.retryCount}/${MAX_RETRIES}`,
      `Message   : ${this.message}`,
    ];
    if (this.responseBody) {
      lines.push(`Response  : ${this.responseBody.substring(0, 1000)}`);
    }
    lines.push(`═══════════════════════════════════════`);
    return lines.join("\n");
  }
}

// ── Logging (Browser Console) ─────────────────

function logRequest(method: string, url: string, body?: unknown, retryAttempt?: number) {
  const retryLabel = retryAttempt ? ` [재시도 ${retryAttempt}/${MAX_RETRIES}]` : "";
  console.group(`📤 [API Request]${retryLabel} ${method} ${url}`);
  console.log("Timestamp:", new Date().toISOString());
  console.log("URL:", url);
  console.log("Method:", method);
  console.log("Headers:", {
    Accept: "application/json",
    "Content-Type": "application/json",
    Authorization: API_KEY ? `Bearer ${API_KEY.substring(0, 8)}...` : "(empty)",
  });
  if (body) {
    console.log("Body:", JSON.stringify(body, null, 2));
  }
  console.groupEnd();
}

function logResponse(method: string, url: string, status: number, statusText: string, body: unknown, durationMs: number) {
  console.group(`📥 [API Response] ${method} ${url} → ${status} ${statusText} (${durationMs}ms)`);
  console.log("Timestamp:", new Date().toISOString());
  console.log("Status:", status, statusText);
  console.log("Duration:", `${durationMs}ms`);
  console.log("Body:", body);
  console.groupEnd();
}

function logError(method: string, url: string, error: unknown, durationMs: number) {
  console.group(`🔴 [API Error] ${method} ${url} (${durationMs}ms)`);
  console.log("Timestamp:", new Date().toISOString());
  console.error("Error:", error);
  if (error instanceof ApiError) {
    console.error(error.toDiagnosticString());
  }
  console.groupEnd();
}

function logRetry(method: string, url: string, attempt: number, reason: string, delayMs: number) {
  console.warn(
    `🔄 [API Retry] ${method} ${url} - 재시도 ${attempt}/${MAX_RETRIES} (${delayMs}ms 후) - 사유: ${reason}`
  );
}

// ── Error Handlers ────────────────────────────

function createTimeoutError(method: string, url: string, timeoutMs: number, retryCount: number): ApiError {
  return new ApiError({
    message: `요청 타임아웃: ${timeoutMs / 1000}초 내에 LLM 서버(${url})로부터 응답을 받지 못했습니다. 서버 상태를 확인하거나 나중에 다시 시도하세요.`,
    status: null,
    statusText: "Timeout",
    url,
    method,
    responseBody: null,
    errorType: "TIMEOUT",
    retryCount,
  });
}

function createServerTimeoutError(
  method: string,
  url: string,
  responseBody: string | null,
  retryCount: number,
): ApiError {
  let serverTimeout = "알 수 없음";
  if (responseBody) {
    const match = responseBody.match(/timeout value=([0-9.]+)/);
    if (match) {
      serverTimeout = `${match[1]}초`;
    }
  }

  return new ApiError({
    message: `LLM 서버 타임아웃 (408): 서버 측 timeout 설정이 너무 짧습니다 (현재: ${serverTimeout}). ` +
      `${retryCount}회 재시도했으나 동일한 오류가 발생했습니다. ` +
      `LiteLLM 관리자에게 request_timeout 또는 timeout 값을 늘려달라고 요청하세요. ` +
      `(예: litellm --request_timeout 300)`,
    status: 408,
    statusText: "Request Timeout",
    url,
    method,
    responseBody,
    errorType: "SERVER_TIMEOUT",
    retryCount,
  });
}

async function handleFetchError(
  method: string,
  url: string,
  error: unknown,
  timeoutMs: number,
  retryCount: number,
): Promise<never> {
  if (error instanceof DOMException && error.name === "AbortError") {
    throw createTimeoutError(method, url, timeoutMs, retryCount);
  }

  if (error instanceof TypeError) {
    const networkError = new ApiError({
      message: `네트워크 오류: LLM 서버에 연결할 수 없습니다. 원인: ${error.message}. 서버 주소, 네트워크 연결, CORS 설정을 확인하세요.`,
      status: null,
      statusText: "Network Error",
      url,
      method,
      responseBody: null,
      errorType: "NETWORK",
      retryCount,
    });
    throw networkError;
  }

  if (error instanceof ApiError) {
    throw error;
  }

  const unknownError = new ApiError({
    message: `알 수 없는 오류: ${error instanceof Error ? error.message : String(error)}`,
    status: null,
    statusText: "Unknown",
    url,
    method,
    responseBody: null,
    errorType: "UNKNOWN",
    retryCount,
  });
  throw unknownError;
}

async function buildHttpError(
  method: string,
  url: string,
  response: Response,
  retryCount: number,
): Promise<ApiError> {
  let responseBody: string | null = null;
  try {
    responseBody = await response.text();
  } catch {
    responseBody = "(응답 본문을 읽을 수 없음)";
  }

  if (response.status === 408) {
    return createServerTimeoutError(method, url, responseBody, retryCount);
  }

  let detail = "";
  if (response.status === 401 || response.status === 403) {
    detail = "API 키가 올바르지 않거나 권한이 없습니다. VITE_LITELLM_API_KEY를 확인하세요.";
  } else if (response.status === 404) {
    detail = "요청한 엔드포인트를 찾을 수 없습니다. VITE_LITELLM_BASE_URL을 확인하세요.";
  } else if (response.status === 429) {
    detail = "요청 제한(Rate Limit)에 도달했습니다. 잠시 후 다시 시도하세요.";
  } else if (response.status >= 500) {
    detail = "LLM 서버 내부 오류입니다. 서버 상태를 확인하세요.";
  } else {
    detail = "예상치 못한 HTTP 오류입니다.";
  }

  return new ApiError({
    message: `HTTP ${response.status} ${response.statusText}: ${detail}`,
    status: response.status,
    statusText: response.statusText,
    url,
    method,
    responseBody,
    errorType: "HTTP",
    retryCount,
  });
}

// ── Utility ───────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── Core Fetch Wrapper with Retry ─────────────

async function apiFetch<T>(
  method: string,
  path: string,
  options: {
    body?: unknown;
    timeoutMs?: number;
  } = {},
): Promise<T> {
  const url = `${BASE_URL}${path}`;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  let lastError: ApiError | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const startTime = performance.now();
    const isRetry = attempt > 0;

    if (isRetry) {
      const delayMs = RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1);
      logRetry(method, url, attempt, lastError?.message ?? "unknown", delayMs);
      await sleep(delayMs);
    }

    logRequest(method, url, options.body, isRetry ? attempt : undefined);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    let response: Response;
    try {
      response = await fetch(url, {
        method,
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Bearer ${API_KEY}`,
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
        signal: controller.signal,
      });
    } catch (error) {
      clearTimeout(timeoutId);
      const duration = Math.round(performance.now() - startTime);
      logError(method, url, error, duration);

      if (attempt < MAX_RETRIES && (error instanceof TypeError || (error instanceof DOMException && error.name === "AbortError"))) {
        lastError = error instanceof DOMException
          ? createTimeoutError(method, url, timeoutMs, attempt)
          : new ApiError({
              message: `네트워크 오류: ${error.message}`,
              status: null,
              statusText: "Network Error",
              url,
              method,
              responseBody: null,
              errorType: "NETWORK",
              retryCount: attempt,
            });
        continue;
      }

      return handleFetchError(method, url, error, timeoutMs, attempt);
    }

    clearTimeout(timeoutId);
    const duration = Math.round(performance.now() - startTime);

    if (!response.ok) {
      const httpError = await buildHttpError(method, url, response, attempt);
      logError(method, url, `HTTP ${response.status}`, duration);

      if (attempt < MAX_RETRIES && RETRYABLE_STATUS_CODES.has(response.status)) {
        lastError = httpError;
        continue;
      }

      throw httpError;
    }

    let data: T;
    try {
      data = await response.json();
    } catch (parseError) {
      const parseApiError = new ApiError({
        message: `응답 파싱 오류: LLM 서버에서 유효하지 않은 JSON 응답을 반환했습니다. ${parseError instanceof Error ? parseError.message : ""}`,
        status: response.status,
        statusText: response.statusText,
        url,
        method,
        responseBody: null,
        errorType: "PARSE",
        retryCount: attempt,
      });
      logError(method, url, parseApiError, duration);
      throw parseApiError;
    }

    logResponse(method, url, response.status, response.statusText, data, duration);
    return data;
  }

  throw lastError ?? new ApiError({
    message: "모든 재시도가 실패했습니다.",
    status: null,
    statusText: "Retry Exhausted",
    url,
    method,
    responseBody: null,
    errorType: "UNKNOWN",
    retryCount: MAX_RETRIES,
  });
}

// ── API Functions ─────────────────────────────

/**
 * GET /v1/models
 * 사용 가능한 모델 목록을 조회합니다.
 */
export async function fetchModels(): Promise<Model[]> {
  const data = await apiFetch<ModelsResponse>("GET", "/v1/models");
  return data.data;
}

/**
 * GET /v1/models/{model_id}
 * 특정 모델의 상세 정보를 조회합니다.
 */
export async function fetchModelDetail(modelId: string): Promise<ModelDetail> {
  const data = await apiFetch<ModelDetail>("GET", `/v1/models/${encodeURIComponent(modelId)}`);
  return data;
}

/**
 * POST /v1/chat/completions
 * 채팅 메시지를 전송하고 AI 응답을 받습니다.
 */
export async function sendChatMessage(
  model: string,
  messages: ChatMessage[],
  options?: {
    temperature?: number;
    max_tokens?: number;
    top_p?: number;
    frequency_penalty?: number;
    presence_penalty?: number;
    stop?: string[];
  },
): Promise<ChatCompletionResponse> {
  const requestBody = {
    model,
    messages,
    stream: false,
    ...options,
  };
  return apiFetch<ChatCompletionResponse>("POST", "/v1/chat/completions", {
    body: requestBody,
    timeoutMs: CHAT_TIMEOUT_MS,
  });
}

/**
 * POST /v1/completions
 * 텍스트 완성 (Text Completion) 요청을 보냅니다.
 */
export async function sendCompletion(
  model: string,
  prompt: string,
  options?: {
    max_tokens?: number;
    temperature?: number;
    top_p?: number;
    n?: number;
    stop?: string[];
    echo?: boolean;
  },
): Promise<CompletionResponse> {
  const requestBody = {
    model,
    prompt,
    ...options,
  };
  return apiFetch<CompletionResponse>("POST", "/v1/completions", {
    body: requestBody,
    timeoutMs: CHAT_TIMEOUT_MS,
  });
}

/**
 * POST /v1/embeddings
 * 텍스트를 벡터 임베딩으로 변환합니다.
 */
export async function createEmbedding(
  model: string,
  input: string | string[],
): Promise<EmbeddingResponse> {
  const requestBody = { model, input };
  return apiFetch<EmbeddingResponse>("POST", "/v1/embeddings", {
    body: requestBody,
  });
}

/**
 * 서버 연결 상태를 확인합니다.
 */
export async function healthCheck(): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
  const startTime = performance.now();
  try {
    await apiFetch<ModelsResponse>("GET", "/v1/models", { timeoutMs: 10_000 });
    return { ok: true, latencyMs: Math.round(performance.now() - startTime) };
  } catch (err) {
    return {
      ok: false,
      latencyMs: Math.round(performance.now() - startTime),
      error: err instanceof ApiError ? err.message : String(err),
    };
  }
}