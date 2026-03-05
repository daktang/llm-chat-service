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

export async function fetchModels(): Promise<Model[]> {
  const response = await fetch(`${BASE_URL}/v1/models`, {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${API_KEY}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch models: ${response.status} ${response.statusText}`);
  }

  const data: ModelsResponse = await response.json();
  return data.data;
}

export async function sendChatMessage(
  model: string,
  messages: ChatMessage[]
): Promise<ChatCompletionResponse> {
  const response = await fetch(`${BASE_URL}/v1/chat/completions`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model,
      messages,
      stream: false,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to send message: ${response.status} ${response.statusText}`);
  }

  return response.json();
}