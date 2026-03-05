const BASE_URL = import.meta.env.VITE_LITELLM_BASE_URL || "https://openllm.net";
const API_KEY = import.meta.env.VITE_LITELLM_API_KEY || "";

export interface Model {
  id: string;
  object: string;
  created: number;
  owned_by: string;
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

/** Structured error with detailed diagnostic info */
export class ApiError extends Error {
  public readonly status: number | null;
  public readonly statusText: string;
  public readonly url: string;
  public readonly method: string;
  public readonly responseBody: string | null;
  public readonly errorType: "NETWORK" | "HTTP" | "PARSE" | "UNKNOWN";
  public readonly timestamp: string;

  constructor(params: {
    message: string;
    status: number | null;
    statusText: string;
    url: string;
    method: string;
    responseBody: string | null;
    errorType: "NETWORK" | "HTTP" | "PARSE" | "UNKNOWN";
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

async function handleFetchError(
  method: string,
  url: string,
  error: unknown,
): Promise<never> {
  // Network error (DNS, CORS, connection refused, timeout, etc.)
  if (error instanceof TypeError) {
    const networkError = new ApiError({
      message: `네트워크 오류: LLM 서버(${BASE_URL})에 연결할 수 없습니다. 원인: ${error.message}. 서버 주소, 네트워크 연결, CORS 설정을 확인하세요.`,
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

export async function fetchModels(): Promise<Model[]> {
  const url = `${BASE_URL}/v1/models`;
  const method = "GET";
  const startTime = performance.now();

  logRequest(method, url);

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${API_KEY}`,
      },
    });
  } catch (error) {
    const duration = Math.round(performance.now() - startTime);
    logError(method, url, error, duration);
    return handleFetchError(method, url, error);
  }

  const duration = Math.round(performance.now() - startTime);

  if (!response.ok) {
    logError(method, url, `HTTP ${response.status}`, duration);
    return handleHttpError(method, url, response);
  }

  let data: ModelsResponse;
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
  return data.data;
}

export async function sendChatMessage(
  model: string,
  messages: ChatMessage[]
): Promise<ChatCompletionResponse> {
  const url = `${BASE_URL}/v1/chat/completions`;
  const method = "POST";
  const requestBody = { model, messages, stream: false };
  const startTime = performance.now();

  logRequest(method, url, requestBody);

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify(requestBody),
    });
  } catch (error) {
    const duration = Math.round(performance.now() - startTime);
    logError(method, url, error, duration);
    return handleFetchError(method, url, error);
  }

  const duration = Math.round(performance.now() - startTime);

  if (!response.ok) {
    logError(method, url, `HTTP ${response.status}`, duration);
    return handleHttpError(method, url, response);
  }

  let data: ChatCompletionResponse;
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