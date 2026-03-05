import { ChatProvider } from "@/context/ChatContext";
import ChatWindow from "@/components/ChatWindow";

export default function IndexPage() {
  return (
    <ChatProvider>
      <ChatWindow />
    </ChatProvider>
  );
}