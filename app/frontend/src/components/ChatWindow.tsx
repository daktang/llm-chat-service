import { useRef, useEffect } from "react";
import { useChat } from "@/context/ChatContext";
import ModelSelector from "@/components/ModelSelector";
import ChatMessage from "@/components/ChatMessage";
import ChatInput from "@/components/ChatInput";
import { Button } from "@/components/ui/button";
import { Trash2, MessageSquare, Loader2 } from "lucide-react";

export default function ChatWindow() {
  const { messages, isLoading, error, clearMessages } = useChat();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="flex flex-col h-screen bg-[#0f0f0f]">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-[#2d2d44] bg-[#0f0f0f]">
        <div className="flex items-center gap-3">
          <MessageSquare className="h-6 w-6 text-indigo-500" />
          <h1 className="text-lg font-bold text-slate-100">LLM Chat</h1>
        </div>
        <div className="flex items-center gap-3">
          <ModelSelector />
          <Button
            variant="ghost"
            size="icon"
            onClick={clearMessages}
            className="text-slate-400 hover:text-red-400 hover:bg-[#2d2d44]"
            title="대화 초기화"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-4">
            <MessageSquare className="h-16 w-16 text-[#2d2d44]" />
            <p className="text-lg">모델을 선택하고 대화를 시작하세요</p>
            <p className="text-sm text-slate-600">Shift + Enter로 줄바꿈, Enter로 전송</p>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto py-4 space-y-1">
            {messages.map((msg, idx) => (
              <ChatMessage key={idx} message={msg} />
            ))}
            {isLoading && (
              <div className="flex gap-3 px-4 py-3 justify-start">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center">
                  <Loader2 className="h-4 w-4 text-white animate-spin" />
                </div>
                <div className="bg-[#1e1e36] border border-[#2d2d44] rounded-2xl px-4 py-3 text-sm text-slate-400">
                  응답을 생성하고 있습니다...
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Error Banner */}
      {error && (
        <div className="px-6 py-2 bg-red-900/30 border-t border-red-800 text-red-300 text-sm text-center">
          {error}
        </div>
      )}

      {/* Input Area */}
      <ChatInput />
    </div>
  );
}