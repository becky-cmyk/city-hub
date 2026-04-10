import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect, useRef } from "react";
import { Bot, Send, Loader2, Plus, Trash2, MessageSquare } from "lucide-react";

interface ChatThread {
  id: string;
  title: string;
  createdAt: string;
}

interface ChatMessage {
  id: string;
  threadId: string;
  role: string;
  content: string;
  toolCalls: any;
  createdAt: string;
}

function MessageBubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === "user";
  const isSystem = msg.role === "system";

  if (isSystem) return null;

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`} data-testid={`message-${msg.id}`}>
      <div
        className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted"
        }`}
      >
        {!isUser && (
          <div className="flex items-center gap-1 mb-1">
            <Bot className="h-3 w-3" />
            <span className="text-xs font-medium">Charlotte</span>
          </div>
        )}
        <div className="whitespace-pre-wrap">{msg.content}</div>
        {msg.toolCalls && Array.isArray(msg.toolCalls) && msg.toolCalls.length > 0 && (
          <div className="mt-2 pt-2 border-t border-border/50 space-y-1">
            {msg.toolCalls.map((tc: any, i: number) => (
              <div key={i} className="text-xs bg-background/50 rounded px-2 py-1">
                <span className="font-mono text-muted-foreground">{tc.function?.name || "tool"}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ChatView({ threadId, onBack }: { threadId: string; onBack: () => void }) {
  const { toast } = useToast();
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: messages, isLoading } = useQuery<ChatMessage[]>({
    queryKey: ["/api/admin/charlotte-chat/threads", threadId, "messages"],
    refetchInterval: 3000,
  });

  const sendMutation = useMutation({
    mutationFn: async () => {
      const trimmed = input.trim();
      if (!trimmed) return;
      await apiRequest("POST", `/api/admin/charlotte-chat/threads/${threadId}/messages`, {
        content: trimmed,
      });
    },
    onSuccess: () => {
      setInput("");
      queryClient.invalidateQueries({ queryKey: ["/api/admin/charlotte-chat/threads", threadId, "messages"] });
    },
    onError: (e: any) => {
      toast({ title: "Failed to send message", description: e.message, variant: "destructive" });
    },
  });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (input.trim()) sendMutation.mutate();
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-200px)]" data-testid="chat-view">
      <div className="flex items-center gap-2 pb-3 border-b mb-3">
        <Button size="sm" variant="ghost" onClick={onBack} data-testid="button-back-to-threads">
          Back
        </Button>
        <Bot className="h-4 w-4" />
        <span className="font-semibold text-sm">Charlotte AI Assistant</span>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-3 pb-3">
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-12 w-3/4" />
            <Skeleton className="h-12 w-2/3 ml-auto" />
          </div>
        ) : messages && messages.length > 0 ? (
          messages.map((msg) => <MessageBubble key={msg.id} msg={msg} />)
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <Bot className="mx-auto h-10 w-10 mb-3 opacity-40" />
            <p className="text-sm">Start a conversation with Charlotte.</p>
            <p className="text-xs mt-1">Ask her to import businesses, draft descriptions, or check import status.</p>
          </div>
        )}
      </div>

      <div className="flex gap-2 pt-3 border-t">
        <Input
          placeholder='Try: "Import 10 coffee shops in Charlotte"'
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={sendMutation.isPending}
          data-testid="input-chat-message"
        />
        <Button
          onClick={() => sendMutation.mutate()}
          disabled={!input.trim() || sendMutation.isPending}
          data-testid="button-send-message"
        >
          {sendMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}

export default function CharlotteChatPanel({ cityId }: { cityId?: string }) {
  const { toast } = useToast();
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);

  const { data: threads, isLoading } = useQuery<ChatThread[]>({
    queryKey: ["/api/admin/charlotte-chat/threads"],
  });

  const createThreadMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/charlotte-chat/threads", {
        title: `Chat ${new Date().toLocaleDateString()}`,
      });
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/charlotte-chat/threads"] });
      setActiveThreadId(data.id);
    },
  });

  const deleteThreadMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/admin/charlotte-chat/threads/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/charlotte-chat/threads"] });
      setActiveThreadId(null);
      toast({ title: "Thread deleted" });
    },
  });

  if (activeThreadId) {
    return <ChatView threadId={activeThreadId} onBack={() => setActiveThreadId(null)} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-lg flex items-center gap-2" data-testid="text-charlotte-chat-title">
            <Bot className="h-5 w-5" />
            Chat with Charlotte
          </h2>
          <p className="text-sm text-muted-foreground">AI assistant for imports, descriptions, and listing management</p>
        </div>
        <Button onClick={() => createThreadMutation.mutate()} disabled={createThreadMutation.isPending} data-testid="button-new-thread">
          {createThreadMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
          New Chat
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : !threads || threads.length === 0 ? (
        <Card className="p-8 text-center" data-testid="empty-threads">
          <Bot className="mx-auto h-10 w-10 text-muted-foreground/40 mb-3" />
          <h3 className="font-semibold mb-1">No conversations yet</h3>
          <p className="text-sm text-muted-foreground mb-4">Start a new chat to work with Charlotte</p>
          <Button onClick={() => createThreadMutation.mutate()} data-testid="button-start-first-chat">
            <Plus className="h-4 w-4 mr-2" />
            Start First Chat
          </Button>
        </Card>
      ) : (
        <div className="space-y-2">
          {threads.map((thread) => (
            <Card
              key={thread.id}
              className="p-3 flex items-center justify-between gap-3 cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => setActiveThreadId(thread.id)}
              data-testid={`card-thread-${thread.id}`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <MessageSquare className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{thread.title}</p>
                  <p className="text-xs text-muted-foreground">{new Date(thread.createdAt).toLocaleString()}</p>
                </div>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={(e) => { e.stopPropagation(); deleteThreadMutation.mutate(thread.id); }}
                data-testid={`button-delete-thread-${thread.id}`}
              >
                <Trash2 className="h-4 w-4 text-muted-foreground" />
              </Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
