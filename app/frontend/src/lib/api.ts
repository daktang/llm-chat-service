// ============================================
// LLM Chat Service - API Client
// ============================================
// 모든 API 요청은 Vite 프록시(/llm)를 통해 라우팅됩니다.
// 이를 통해 서버 터미널에 Request/Response 로그가 출력됩니다.
//
// 프록시 경로: /llm/v1/* → VITE_LITELLM_BASE_URL/v1/*
// ============================================

const API_KEY = import.meta.env.VITE_LITELLM_API_KEY || "";

// 개발 환경에서는 Vite 프록시를 통해 요청 (서버 터미널 로그 출력)
// 프로덕션 환경에서는 직접 LiteLLM 서버로 요청
const BASE_URL = import.meta.env.DEV
  ? "/llm"
  : (import.meta.env.VITE_LITELLM_BASE_URL || "https://openllm.net");

// 기본 타임아웃: 60초 (LLM 응답은 오래 걸릴 수 있음)
const DEFAULT_TIMEOUT_MS = 60_000;
// Chat completions는 더 긴 타임아웃: 120초
const CHAT_TIMEOUT_MS = 120_000;

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
  public readonly errorType: "NETWORK" | "HTTP" | "PARSE" | "TIMEOUT" | "UNKNOWN";
  public readonly timestamp: string;

  constructor(params: {
    message: string;
    status: number | null;
    statusText: string;
    url: string;
    method: string;
    responseBody: string | null;
    errorType: "NETWORK" | "HTTP" | "PARSE" | "TIMEOUT" | "UNKNOWN";
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

function logRequest(method: string, url: string, body?: unknown) {
  console.group(`📤 [API Request] ${method} ${url}`);
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

// ── Error Handlers ────────────────────────────

function createTimeoutError(method: string, url: string, timeoutMs: number): ApiError {
  return new ApiError({
    message: `요청 타임아웃: ${timeoutMs / 1000}초 내에 LLM 서버(${url})로부터 응답을 받지 못했습니다. 서버 상태를 확인하거나 나중에 다시 시도하세요.`,
    status: null,
    statusText: "Timeout",
    url,
    method,
    responseBody: null,
    errorType: "TIMEOUT",
  });
}

async function handleFetchError(
  method: string,
  url: string,
  error: unknown,
  timeoutMs: number,
): Promise<never> {
  // AbortError (timeout)
  if (error instanceof DOMException && error.name === "AbortError") {
    throw createTimeoutError(method, url, timeoutMs);
  }

  // Network error (DNS, CORS, connection refused, etc.)
  if (error instanceof TypeError) {
    const networkError = new ApiError({
      message: `네트워크 오류: LLM 서버에 연결할 수 없습니다. 원인: ${error.message}. 서버 주소, 네트워크 연결, CORS 설정을 확인하세요.`,
      status: null,
      statusText: "Network Error",
      url,
      method,
      responseBody: null,
      errorType: "NETWORK",
    });
    throw networkError;
  }

  // Already an ApiError, re-throw
  if (error instanceof ApiError) {
    throw error;
  }

  // Unknown error
  const unknownError = new ApiError({
    message: `알 수 없는 오류: ${error instanceof Error ? error.message : String(error)}`,
    status: null,
    statusText: "Unknown",
    url,
    method,
    responseBody: null,
    errorType: "UNKNOWN",
  });
  throw unknownError;
}

async function handleHttpError(
  method: string,
  url: string,
  response: Response,
): Promise<never> {
  let responseBody: string | null = null;
  try {
    responseBody = await response.text();
  } catch {
    responseBody = "(응답 본문을 읽을 수 없음)";
  }

  let detail = "";
  if (response.status === 401 || response.status === 403) {
    detail = "API 키가 올바르지 않거나 권한이 없습니다. VITE_LITELLM_API_KEY를 확인하세요.";
  } else if (response.status === 404) {
    detail = "요청한 엔드포인트를 찾을 수 없습니다. LLM 서버 URL을 확인하세요.";
  } else if (response.status === 429) {
    detail = "요청 제한(Rate Limit)에 도달했습니다. 잠시 후 다시 시도하세요.";
  } else if (response.status >= 500) {
    detail = "LLM 서버 내부 오류입니다. 서버 상태를 확인하세요.";
  } else {
    detail = "예상치 못한 HTTP 오류입니다.";
  }

  const httpError = new ApiError({
    message: `HTTP ${response.status} ${response.statusText}: ${detail}`,
    status: response.status,
    statusText: response.statusText,
    url,
    method,
    responseBody,
    errorType: "HTTP",
  });
  throw httpError;
}

// ── Core Fetch Wrapper ────────────────────────

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
  const startTime = performance.now();

  logRequest(method, url, options.body);

  // AbortController for timeout
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
    return handleFetchError(method, url, error, timeoutMs);
  }

  clearTimeout(timeoutId);
  const duration = Math.round(performance.now() - startTime);

  if (!response.ok) {
    logError(method, url, `HTTP ${response.status}`, duration);
    return handleHttpError(method, url, response);
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
    });
    logError(method, url, parseApiError, duration);
    throw parseApiError;
  }

  logResponse(method, url, response.status, response.statusText, data, duration);
  return data;
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
 * 프롬프트를 기반으로 텍스트를 생성합니다.
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
 * 유사도 검색, 클러스터링 등에 활용할 수 있습니다.
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
 * GET /v1/models를 호출하여 서버가 응답하는지 확인합니다.
 * 짧은 타임아웃(10초)을 사용합니다.
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