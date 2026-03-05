import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { MessageSquare } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#0f0f0f] text-slate-200 gap-6">
      <MessageSquare className="h-16 w-16 text-[#2d2d44]" />
      <h1 className="text-4xl font-bold">404</h1>
      <p className="text-slate-400">페이지를 찾을 수 없습니다</p>
      <Link to="/">
        <Button className="bg-indigo-600 hover:bg-indigo-500 text-white">
          홈으로 돌아가기
        </Button>
      </Link>
    </div>
  );
}