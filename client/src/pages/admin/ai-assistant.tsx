import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAdminCitySelection } from "@/hooks/use-city";
import {
  Bot, Send, Plus, Trash2, Upload, FileSpreadsheet,
  MessageSquare, Loader2, X, Bell, Inbox, Copy, Users
} from "lucide-react";

interface Conversation {
  id: number;
  title: string;
  createdAt: string;
}

interface Message {
  id: number;
  role: string;
  content: string;
  createdAt: string;
}

function MarkdownContent({ content }: { content: string }) {
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none break-words">
      {content.split("\n").map((line, i) => {
        if (line.startsWith("### ")) return <h4 key={i} className="text-sm font-bold mt-3 mb-1">{line.slice(4)}</h4>;
        if (line.startsWith("## ")) return <h3 key={i} className="text-base font-bold mt-3 mb-1">{line.slice(3)}</h3>;
        if (line.startsWith("# ")) return <h2 key={i} className="text-lg font-bold mt-3 mb-1">{line.slice(2)}</h2>;
        if (line.startsWith("- ") || line.startsWith("* ")) return <li key={i} className="ml-4 text-sm">{renderInline(line.slice(2))}</li>;
        if (/^\d+\.\s/.test(line)) return <li key={i} className="ml-4 text-sm list-decimal">{renderInline(line.replace(/^\d+\.\s/, ""))}</li>;
        if (line.startsWith("```")) return null;
        if (line.startsWith("|")) return <div key={i} className="text-xs font-mono bg-muted/50 px-2 py-0.5 border-b border-border">{line}</div>;
        if (line.trim() === "") return <br key={i} />;
        return <p key={i} className="text-sm mb-1">{renderInline(line)}</p>;
      })}
    </div>
  );
}

function renderInline(text: string) {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`)/).map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("`") && part.endsWith("`")) return <code key={i} className="bg-muted px-1 py-0.5 rounded text-xs">{part.slice(1, -1)}</code>;
    return <span key={i}>{part}</span>;
  });
}

function ConversationList({
  conversations,
  activeId,
  onSelect,
  onCreate,
  onDelete,
  isLoading,
}: {
  conversations: Conversation[];
  activeId: number | null;
  onSelect: (id: number) => void;
  onCreate: () => void;
  onDelete: (id: number) => void;
  isLoading: boolean;
}) {
  return (
    <div className="w-full md:w-64 shrink-0 border-r flex flex-col h-full">
      <div className="p-3 border-b flex items-center justify-between">
        <span className="text-sm font-semibold">Conversations</span>
        <Button size="sm" variant="ghost" onClick={onCreate} data-testid="button-new-chat">
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)
        ) : conversations.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">No conversations yet</p>
        ) : (
          conversations.map((c) => (
            <div
              key={c.id}
              className={`group flex items-center gap-2 rounded-md px-2 py-2 cursor-pointer text-sm transition-colors ${
                activeId === c.id ? "bg-primary/10 text-primary" : "hover:bg-muted"
              }`}
              onClick={() => onSelect(c.id)}
              data-testid={`conv-${c.id}`}
            >
              <MessageSquare className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate flex-1">{c.title}</span>
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6 opacity-0 group-hover:opacity-100 shrink-0"
                onClick={(e) => { e.stopPropagation(); onDelete(c.id); }}
                data-testid={`delete-conv-${c.id}`}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function ChatMessages({ messages, isStreaming, streamContent }: {
  messages: Message[];
  isStreaming: boolean;
  streamContent: string;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamContent]);

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {messages.length === 0 && !isStreaming && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Bot className="h-12 w-12 text-muted-foreground mb-3" />
          <h3 className="text-lg font-semibold mb-1">Admin AI Assistant</h3>
          <p className="text-sm text-muted-foreground max-w-sm">
            Ask me anything about managing your city hub. I can help with CSV imports, content review, data cleanup, and more.
          </p>
          <div className="flex flex-wrap gap-2 mt-4 justify-center">
            {["Analyze a CSV file", "Help me clean up business data", "Review pending submissions", "Draft an event description"].map((s) => (
              <Badge key={s} variant="outline" className="cursor-pointer hover:bg-muted text-xs">
                {s}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {messages.map((msg) => (
        <div
          key={msg.id}
          className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
        >
          <div
            className={`max-w-[85%] rounded-lg px-4 py-3 ${
              msg.role === "user"
                ? "bg-primary text-primary-foreground"
                : "bg-muted"
            }`}
            data-testid={`msg-${msg.id}`}
          >
            {msg.role === "user" ? (
              <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
            ) : (
              <MarkdownContent content={msg.content} />
            )}
          </div>
        </div>
      ))}

      {isStreaming && streamContent && (
        <div className="flex justify-start">
          <div className="max-w-[85%] rounded-lg px-4 py-3 bg-muted">
            <MarkdownContent content={streamContent} />
          </div>
        </div>
      )}

      {isStreaming && !streamContent && (
        <div className="flex justify-start">
          <div className="rounded-lg px-4 py-3 bg-muted flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm text-muted-foreground">Thinking...</span>
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}

export default function AiAssistant({ cityId }: { cityId?: string }) {
  const { selectedCitySlug } = useAdminCitySelection();
  const [activeConvId, setActiveConvId] = useState<number | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamContent, setStreamContent] = useState("");
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvInstructions, setCsvInstructions] = useState("");
  const [showCsvUpload, setShowCsvUpload] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: conversations = [], isLoading: convsLoading } = useQuery<Conversation[]>({
    queryKey: ["/api/admin/ai/conversations"],
  });

  const { data: activeConv } = useQuery<Conversation & { messages: Message[] }>({
    queryKey: ["/api/admin/ai/conversations", activeConvId],
    enabled: !!activeConvId,
  });

  const messages = activeConv?.messages || [];

  const createConvMutation = useMutation({
    mutationFn: async (title: string) => {
      const res = await apiRequest("POST", "/api/admin/ai/conversations", { title });
      return res.json();
    },
    onSuccess: (conv: Conversation) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/ai/conversations"] });
      setActiveConvId(conv.id);
    },
  });

  const deleteConvMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/admin/ai/conversations/${id}`);
    },
    onSuccess: (_: unknown, id: number) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/ai/conversations"] });
      if (activeConvId === id) setActiveConvId(null);
    },
  });

  const sendMessage = useCallback(async (content: string) => {
    if (!activeConvId || !content.trim() || isStreaming) return;

    setIsStreaming(true);
    setStreamContent("");
    setInputValue("");

    queryClient.setQueryData(
      ["/api/admin/ai/conversations", activeConvId],
      (old: any) => {
        if (!old) return old;
        return {
          ...old,
          messages: [
            ...old.messages,
            { id: Date.now(), role: "user", content, createdAt: new Date().toISOString() },
          ],
        };
      }
    );

    try {
      const response = await fetch(`/api/admin/ai/conversations/${activeConvId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ content, citySlug: selectedCitySlug || "" }),
      });

      if (!response.ok) throw new Error("Failed to send message");

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.content) {
                  accumulated += data.content;
                  setStreamContent(accumulated);
                }
                if (data.done) {
                  break;
                }
              } catch {}
            }
          }
        }
      }
    } catch (error) {
      console.error("Error streaming:", error);
    } finally {
      setIsStreaming(false);
      setStreamContent("");
      queryClient.invalidateQueries({ queryKey: ["/api/admin/ai/conversations", activeConvId] });
    }
  }, [activeConvId, isStreaming]);

  const handleCsvUpload = useCallback(async () => {
    if (!csvFile) return;

    const text = await csvFile.text();

    if (!activeConvId) {
      const res = await apiRequest("POST", "/api/admin/ai/conversations", { title: `CSV: ${csvFile.name}` });
      const conv = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/admin/ai/conversations"] });
      setActiveConvId(conv.id);

      setTimeout(async () => {
        setIsStreaming(true);
        setStreamContent("");

        queryClient.setQueryData(
          ["/api/admin/ai/conversations", conv.id],
          (old: any) => ({
            ...conv,
            messages: [
              { id: Date.now(), role: "user", content: `📄 Uploaded CSV: ${csvFile.name}\n\n${csvInstructions || "Please analyze this data and tell me what you see."}`, createdAt: new Date().toISOString() },
            ],
          })
        );

        try {
          const response = await fetch("/api/admin/ai/csv-analyze", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ csvData: text, instructions: csvInstructions, citySlug: selectedCitySlug || "" }),
          });

          const reader = response.body?.getReader();
          const decoder = new TextDecoder();
          let accumulated = "";

          if (reader) {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              const chunk = decoder.decode(value);
              for (const line of chunk.split("\n")) {
                if (line.startsWith("data: ")) {
                  try {
                    const data = JSON.parse(line.slice(6));
                    if (data.content) {
                      accumulated += data.content;
                      setStreamContent(accumulated);
                    }
                    if (data.done) break;
                  } catch {}
                }
              }
            }
          }
        } catch (error) {
          console.error("CSV analysis error:", error);
        } finally {
          setIsStreaming(false);
          setStreamContent("");
          queryClient.invalidateQueries({ queryKey: ["/api/admin/ai/conversations", conv.id] });
        }
      }, 100);
    } else {
      const prompt = `I'm uploading a CSV file named "${csvFile.name}".\n\n${csvInstructions || "Please analyze this data."}\n\nHere's the data:\n\`\`\`\n${text.substring(0, 15000)}\n\`\`\`${text.length > 15000 ? "\n(truncated)" : ""}`;
      sendMessage(prompt);
    }

    setCsvFile(null);
    setCsvInstructions("");
    setShowCsvUpload(false);
  }, [csvFile, csvInstructions, activeConvId, sendMessage]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(inputValue);
    }
  };

  const handleNewChat = () => {
    createConvMutation.mutate("New Chat");
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      <div className="flex items-center gap-2 px-4 py-3 border-b shrink-0">
        <Bot className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-bold" data-testid="text-ai-assistant-title">AI Assistant</h2>
        <Badge variant="outline" className="text-[10px]">Beta</Badge>
      </div>

      <div className="flex flex-1 min-h-0">
        <ConversationList
          conversations={conversations}
          activeId={activeConvId}
          onSelect={setActiveConvId}
          onCreate={handleNewChat}
          onDelete={(id) => deleteConvMutation.mutate(id)}
          isLoading={convsLoading}
        />

        <div className="flex-1 flex flex-col min-w-0">
          {!activeConvId ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
              <Bot className="h-16 w-16 text-muted-foreground mb-4" />
              <h3 className="text-xl font-semibold mb-2">Welcome to Admin AI Assistant</h3>
              <p className="text-sm text-muted-foreground max-w-md mb-6">
                Start a new conversation to get help managing your city hub. Upload CSV files, review data, clean up listings, and more.
              </p>
              <div className="flex gap-3 mb-6">
                <Button onClick={handleNewChat} className="gap-2" data-testid="button-start-chat">
                  <MessageSquare className="h-4 w-4" />
                  New Chat
                </Button>
                <Button
                  variant="outline"
                  className="gap-2"
                  onClick={() => { handleNewChat(); setShowCsvUpload(true); }}
                  data-testid="button-upload-csv-start"
                >
                  <Upload className="h-4 w-4" />
                  Upload CSV
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-2 max-w-md">
                {[
                  { label: "Who needs follow-up?", icon: Bell, msg: "Who needs follow-up today? Show me my nudge recommendations." },
                  { label: "Review inbox", icon: Inbox, msg: "Show me contacts in my inbox that need review, plus any pending content drafts." },
                  { label: "Find duplicates", icon: Copy, msg: "Help me find potential duplicate business listings that need cleanup." },
                  { label: "New referral", icon: Users, msg: "I want to create a new referral connecting two of my contacts." },
                ].map((action) => (
                  <Button
                    key={action.label}
                    variant="outline"
                    size="sm"
                    className="gap-2 text-xs justify-start h-9"
                    onClick={() => {
                      handleNewChat();
                      setTimeout(() => {
                        setInputValue(action.msg);
                      }, 300);
                    }}
                    data-testid={`quick-action-${action.label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
                  >
                    <action.icon className="h-3.5 w-3.5 shrink-0" />
                    {action.label}
                  </Button>
                ))}
              </div>
            </div>
          ) : (
            <>
              <ChatMessages
                messages={messages}
                isStreaming={isStreaming}
                streamContent={streamContent}
              />

              {showCsvUpload && (
                <div className="border-t p-4 bg-muted/30">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <FileSpreadsheet className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium">Upload CSV</span>
                    </div>
                    <Button size="icon" variant="ghost" onClick={() => { setShowCsvUpload(false); setCsvFile(null); }} className="h-6 w-6">
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="space-y-3">
                    <div
                      className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => fileInputRef.current?.click()}
                      data-testid="csv-drop-zone"
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".csv,.tsv,.txt"
                        className="hidden"
                        onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
                        data-testid="input-csv-file"
                      />
                      {csvFile ? (
                        <div className="flex items-center justify-center gap-2">
                          <FileSpreadsheet className="h-5 w-5 text-green-500" />
                          <span className="text-sm font-medium">{csvFile.name}</span>
                          <Badge variant="secondary" className="text-[10px]">
                            {(csvFile.size / 1024).toFixed(1)} KB
                          </Badge>
                        </div>
                      ) : (
                        <div>
                          <Upload className="h-6 w-6 mx-auto mb-1 text-muted-foreground" />
                          <p className="text-sm text-muted-foreground">Click to select a CSV file</p>
                        </div>
                      )}
                    </div>
                    <Input
                      placeholder="Instructions (optional): e.g., 'Clean up the addresses and match to zones'"
                      value={csvInstructions}
                      onChange={(e) => setCsvInstructions(e.target.value)}
                      data-testid="input-csv-instructions"
                    />
                    <Button
                      onClick={handleCsvUpload}
                      disabled={!csvFile || isStreaming}
                      className="w-full gap-2"
                      data-testid="button-analyze-csv"
                    >
                      <Bot className="h-4 w-4" />
                      Analyze with AI
                    </Button>
                  </div>
                </div>
              )}

              <div className="border-t p-3 shrink-0">
                <div className="flex items-end gap-2">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setShowCsvUpload(!showCsvUpload)}
                    className="shrink-0"
                    data-testid="button-toggle-csv"
                  >
                    <Upload className="h-4 w-4" />
                  </Button>
                  <Textarea
                    placeholder="Ask the AI assistant anything..."
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="min-h-[44px] max-h-32 resize-none"
                    rows={1}
                    disabled={isStreaming}
                    data-testid="input-chat-message"
                  />
                  <Button
                    size="icon"
                    onClick={() => sendMessage(inputValue)}
                    disabled={!inputValue.trim() || isStreaming}
                    className="shrink-0"
                    data-testid="button-send-message"
                  >
                    {isStreaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
