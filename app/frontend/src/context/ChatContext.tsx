import React, { createContext, useState, useCallback, type ReactNode } from "react";
import { fetchModels, sendChatMessage, ApiError, type Model, type ChatMessage } from "@/lib/api";

export interface ChatContextType {
  models: Model[];
  selectedModel: string;
  messages: ChatMessage[];
  isLoading: boolean;
  isLoadingModels: boolean;
  error: string | null;
  errorDetail: string | null;
  setSelectedModel: (model: string) => void;
  loadModels: () => Promise<void>;
  sendMessage: (content: string) => Promise<void>;
  clearMessages: () => void;
  clearError: () => void;
}

export const ChatContext = createContext<ChatContextType | undefined>(undefined);

function extractErrorInfo(err: unknown): { message: string; detail: string | null } {
  if (err instanceof ApiError) {
    const statusLine = err.errorType === "TIMEOUT"
      ? "Status: TIMEOUT (응답 시간 초과)"
      : err.status
        ? `Status: ${err.status} ${err.statusText}`
        : "Status: N/A (연결 실패)";
    const detail = [
      `[${err.errorType}] ${err.timestamp}`,
      `${err.method} ${err.url}`,
      statusLine,
      err.responseBody ? `Server Response: ${err.responseBody.substring(0, 500)}` : null,
    ]
      .filter(Boolean)
      .join("\n");
    return { message: err.message, detail };
  }
  if (err instanceof Error) {
    return { message: err.message, detail: null };
  }
  return { message: String(err), detail: null };
}

export function ChatProvider({ children }: { children: ReactNode }) {
  const [models, setModels] = useState<Model[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);

  const clearError = useCallback(() => {
    setError(null);
    setErrorDetail(null);
  }, []);

  const loadModels = useCallback(async () => {
    setIsLoadingModels(true);
    clearError();
    try {
      const modelList = await fetchModels();
      setModels(modelList);
      if (modelList.length > 0 && !selectedModel) {
        setSelectedModel(modelList[0].id);
      }
    } catch (err) {
      const { message, detail } = extractErrorInfo(err);
      setError(message);
      setErrorDetail(detail);
    } finally {
      setIsLoadingModels(false);
    }
  }, [selectedModel, clearError]);

  const sendMessageHandler = useCallback(
    async (content: string) => {
      if (!selectedModel || !content.trim()) return;

      const userMessage: ChatMessage = { role: "user", content: content.trim() };
      const updatedMessages = [...messages, userMessage];
      setMessages(updatedMessages);
      setIsLoading(true);
      clearError();

      try {
        const response = await sendChatMessage(selectedModel, updatedMessages);
        const assistantContent =
          response.choices?.[0]?.message?.content || "No response received.";
        const assistantMessage: ChatMessage = {
          role: "assistant",
          content: assistantContent,
        };
        setMessages((prev) => [...prev, assistantMessage]);
      } catch (err) {
        const { message, detail } = extractErrorInfo(err);
        setError(message);
        setErrorDetail(detail);
      } finally {
        setIsLoading(false);
      }
    },
    [selectedModel, messages, clearError]
  );

  const clearMessages = useCallback(() => {
    setMessages([]);
    clearError();
  }, [clearError]);

  return (
    <ChatContext.Provider
      value={{
        models,
        selectedModel,
        messages,
        isLoading,
        isLoadingModels,
        error,
        errorDetail,
        setSelectedModel,
        loadModels,
        sendMessage: sendMessageHandler,
        clearMessages,
        clearError,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}