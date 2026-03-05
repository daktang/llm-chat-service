import React, { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { fetchModels, sendChatMessage, type Model, type ChatMessage } from "@/lib/api";

interface ChatContextType {
  models: Model[];
  selectedModel: string;
  messages: ChatMessage[];
  isLoading: boolean;
  isLoadingModels: boolean;
  error: string | null;
  setSelectedModel: (model: string) => void;
  loadModels: () => Promise<void>;
  sendMessage: (content: string) => Promise<void>;
  clearMessages: () => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: ReactNode }) {
  const [models, setModels] = useState<Model[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadModels = useCallback(async () => {
    setIsLoadingModels(true);
    setError(null);
    try {
      const modelList = await fetchModels();
      setModels(modelList);
      if (modelList.length > 0 && !selectedModel) {
        setSelectedModel(modelList[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load models");
    } finally {
      setIsLoadingModels(false);
    }
  }, [selectedModel]);

  const sendMessageHandler = useCallback(
    async (content: string) => {
      if (!selectedModel || !content.trim()) return;

      const userMessage: ChatMessage = { role: "user", content: content.trim() };
      const updatedMessages = [...messages, userMessage];
      setMessages(updatedMessages);
      setIsLoading(true);
      setError(null);

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
        setError(err instanceof Error ? err.message : "Failed to send message");
      } finally {
        setIsLoading(false);
      }
    },
    [selectedModel, messages]
  );

  const clearMessages = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  return (
    <ChatContext.Provider
      value={{
        models,
        selectedModel,
        messages,
        isLoading,
        isLoadingModels,
        error,
        setSelectedModel,
        loadModels,
        sendMessage: sendMessageHandler,
        clearMessages,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error("useChat must be used within a ChatProvider");
  }
  return context;
}