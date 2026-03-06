import { useEffect } from "react";
import { useChat } from "@/hooks/useChat";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ModelSelector() {
  const { models, selectedModel, setSelectedModel, loadModels, isLoadingModels } = useChat();

  useEffect(() => {
    loadModels();
  }, [loadModels]);

  return (
    <div className="flex items-center gap-2">
      <Select value={selectedModel} onValueChange={setSelectedModel}>
        <SelectTrigger className="w-[260px] bg-[#1a1a2e] border-[#2d2d44] text-slate-200 focus:ring-indigo-500">
          <SelectValue placeholder={isLoadingModels ? "Loading models..." : "Select a model"} />
        </SelectTrigger>
        <SelectContent className="bg-[#1a1a2e] border-[#2d2d44]">
          {models.map((model) => (
            <SelectItem
              key={model.id}
              value={model.id}
              className="text-slate-200 focus:bg-indigo-600 focus:text-white"
            >
              {model.id}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        variant="ghost"
        size="icon"
        onClick={loadModels}
        disabled={isLoadingModels}
        className="text-slate-400 hover:text-slate-200 hover:bg-[#2d2d44]"
      >
        <RefreshCw className={`h-4 w-4 ${isLoadingModels ? "animate-spin" : ""}`} />
      </Button>
    </div>
  );
}