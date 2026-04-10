import { useState, useRef, useEffect, useCallback } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  X, Send, Loader2, Plus, Trash2, MessageSquare,
  Download, ClipboardList, FileText, Search, Sparkles,
  Bell, Inbox, Copy, Users, Paperclip, Image, File
} from "lucide-react";
import charlotteAvatar from "@assets/charlotte-avatar-v2.png";

interface ChatAttachment {
  url: string;
  filename: string;
  mimeType: string;
  size: number;
}

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
  attachments?: ChatAttachment[] | null;
  createdAt: string;
}

function MarkdownContent({ content }: { content: string }) {
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none break-words">
      {content.split("\n").map((line, i) => {
        if (line.startsWith("### ")) return <h4 key={i} className="text-xs font-bold mt-2 mb-0.5">{line.slice(4)}</h4>;
        if (line.startsWith("## ")) return <h3 key={i} className="text-sm font-bold mt-2 mb-0.5">{line.slice(3)}</h3>;
        if (line.startsWith("# ")) return <h2 key={i} className="text-base font-bold mt-2 mb-0.5">{line.slice(2)}</h2>;
        if (line.startsWith("- ") || line.startsWith("* ")) return <li key={i} className="ml-3 text-xs">{renderInline(line.slice(2))}</li>;
        if (/^\d+\.\s/.test(line)) return <li key={i} className="ml-3 text-xs list-decimal">{renderInline(line.replace(/^\d+\.\s/, ""))}</li>;
        if (line.startsWith("```")) return null;
        if (line.startsWith("|")) return <div key={i} className="text-[10px] font-mono bg-muted/50 px-1 py-0.5 border-b border-border">{line}</div>;
        if (line.trim() === "") return <br key={i} />;
        return <p key={i} className="text-xs mb-0.5">{renderInline(line)}</p>;
      })}
    </div>
  );
}

function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("*") && part.endsWith("*")) return <em key={i}>{part.slice(1, -1)}</em>;
    if (part.startsWith("`") && part.endsWith("`")) return <code key={i} className="bg-muted px-0.5 rounded text-[10px]">{part.slice(1, -1)}</code>;
    return part;
  });
}

const QUICK_ACTIONS = [
  { label: "Who needs follow-up?", icon: Bell, message: "Who needs follow-up today? Show me my nudge recommendations." },
  { label: "Review inbox", icon: Inbox, message: "Show me contacts in my inbox that need review, plus any pending content drafts." },
  { label: "Find duplicates", icon: Copy, message: "Help me find potential duplicate business listings that need cleanup." },
  { label: "New referral", icon: Users, message: "I want to create a new referral connecting two of my contacts." },
  { label: "Import listings", icon: Download, message: "Help me import new business listings from Google Places" },
  { label: "Check pending", icon: ClipboardList, message: "What submissions are pending review?" },
];

function AttachmentChip({ attachment, onRemove }: { attachment: ChatAttachment; onRemove?: () => void }) {
  const isImage = attachment.mimeType.startsWith("image/");
  return (
    <div className="flex items-center gap-1.5 bg-muted rounded px-2 py-1 text-[10px]" data-testid={`attachment-chip-${attachment.filename}`}>
      {isImage ? <Image className="h-3 w-3 shrink-0 text-muted-foreground" /> : <File className="h-3 w-3 shrink-0 text-muted-foreground" />}
      <span className="truncate max-w-[120px]">{attachment.filename}</span>
      <span className="text-muted-foreground">{(attachment.size / 1024).toFixed(0)}KB</span>
      {onRemove && (
        <button onClick={onRemove} className="ml-0.5 text-muted-foreground hover:text-foreground">
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

function MessageAttachments({ attachments }: { attachments: ChatAttachment[] }) {
  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {attachments.map((att, i) => {
        if (att.mimeType.startsWith("image/")) {
          return (
            <a key={i} href={att.url} target="_blank" rel="noopener noreferrer" data-testid={`attachment-preview-${i}`}>
              <img src={att.url} alt={att.filename} className="rounded max-h-24 max-w-[160px] object-cover border border-white/20" />
            </a>
          );
        }
        return (
          <div key={i} className="flex items-center gap-1 bg-white/10 rounded px-2 py-1 text-[10px]" data-testid={`attachment-file-${i}`}>
            <File className="h-3 w-3 shrink-0" />
            <span className="truncate max-w-[100px]">{att.filename}</span>
          </div>
        );
      })}
    </div>
  );
}

export function AdminCharlotteSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { toast } = useToast();
  const [activeThread, setActiveThread] = useState<ChatThread | null>(null);
  const [input, setInput] = useState("");
  const [showThreads, setShowThreads] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<ChatAttachment[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: threads = [] } = useQuery<ChatThread[]>({
    queryKey: ["/api/admin/charlotte-chat/threads"],
    enabled: open,
  });

  const { data: messages = [], isLoading: messagesLoading } = useQuery<ChatMessage[]>({
    queryKey: ["/api/admin/charlotte-chat/threads", activeThread?.id, "messages"],
    enabled: !!activeThread,
    queryFn: async () => {
      if (!activeThread) return [];
      const res = await fetch(`/api/admin/charlotte-chat/threads/${activeThread.id}/messages`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load messages");
      return res.json();
    },
  });

  const createThreadMut = useMutation({
    mutationFn: async (title: string) => {
      const res = await apiRequest("POST", "/api/admin/charlotte-chat/threads", { title });
      return res.json();
    },
    onSuccess: (thread: ChatThread) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/charlotte-chat/threads"] });
      setActiveThread(thread);
      setShowThreads(false);
    },
  });

  const deleteThreadMut = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/admin/charlotte-chat/threads/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/charlotte-chat/threads"] });
      if (activeThread) setActiveThread(null);
    },
  });

  const sendMessageMut = useMutation({
    mutationFn: async ({ threadId, content, attachments }: { threadId: string; content: string; attachments?: ChatAttachment[] }) => {
      const body: Record<string, unknown> = { content };
      if (attachments && attachments.length > 0) body.attachments = attachments;
      const res = await apiRequest("POST", `/api/admin/charlotte-chat/threads/${threadId}/messages`, body);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/charlotte-chat/threads", activeThread?.id, "messages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/charlotte-chat/threads"] });
      setIsTyping(false);
    },
    onError: (err: any) => {
      setIsTyping(false);
      toast({ title: "Charlotte ran into an issue", description: err.message, variant: "destructive" });
    },
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  useEffect(() => {
    if (open && !activeThread && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 200);
    }
  }, [open, activeThread]);

  const handleFileSelect = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setIsUploading(true);
    try {
      const formData = new FormData();
      for (let i = 0; i < Math.min(files.length, 5); i++) {
        formData.append("files", files[i]);
      }
      const res = await fetch("/api/admin/charlotte-chat/upload", {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Upload failed" }));
        toast({ title: "Upload failed", description: err.message, variant: "destructive" });
        return;
      }
      const data = await res.json();
      setPendingFiles((prev) => [...prev, ...data.attachments]);
    } catch {
      toast({ title: "Upload failed", description: "Could not upload file", variant: "destructive" });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [toast]);

  const handleSend = useCallback(async (messageText?: string) => {
    const content = messageText || input.trim();
    if (!content && pendingFiles.length === 0) return;
    const messageContent = content || (pendingFiles.length > 0 ? `Attached ${pendingFiles.length} file(s)` : "");

    let thread = activeThread;
    if (!thread) {
      try {
        const res = await apiRequest("POST", "/api/admin/charlotte-chat/threads", { title: messageContent.substring(0, 50) });
        thread = await res.json();
        queryClient.invalidateQueries({ queryKey: ["/api/admin/charlotte-chat/threads"] });
        setActiveThread(thread);
      } catch {
        toast({ title: "Error", description: "Couldn't start a conversation", variant: "destructive" });
        return;
      }
    }

    const attachments = pendingFiles.length > 0 ? [...pendingFiles] : undefined;
    setInput("");
    setPendingFiles([]);
    setIsTyping(true);

    queryClient.setQueryData(
      ["/api/admin/charlotte-chat/threads", thread!.id, "messages"],
      (old: ChatMessage[] | undefined) => [
        ...(old || []),
        { id: `temp-${Date.now()}`, threadId: thread!.id, role: "user", content: messageContent, toolCalls: null, attachments: attachments || null, createdAt: new Date().toISOString() },
      ]
    );

    sendMessageMut.mutate({ threadId: thread!.id, content: messageContent, attachments });
  }, [input, activeThread, pendingFiles, sendMessageMut, toast]);

  const handleNewChat = () => {
    setActiveThread(null);
    setShowThreads(false);
    setInput("");
    setPendingFiles([]);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const visibleMessages = messages.filter((m) => m.role !== "system");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:w-[400px] md:w-[440px] p-0 flex flex-col" data-testid="admin-charlotte-panel">
        <div className="flex items-center gap-2 px-4 py-3 shrink-0 border-b" style={{ background: "hsl(273 66% 34%)" }}>
          <img src={charlotteAvatar} alt="Charlotte" className="h-8 w-8 rounded-full object-cover ring-2 ring-white/30" />
          <div className="flex-1 min-w-0">
            <SheetTitle className="text-white font-semibold text-sm m-0">Charlotte</SheetTitle>
            <div className="text-white/70 text-[10px]">Your admin AI assistant</div>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={() => setShowThreads(!showThreads)} className="h-7 w-7 text-white/70 hover:text-white hover:bg-white/10" data-testid="button-charlotte-threads">
              <MessageSquare className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={handleNewChat} className="h-7 w-7 text-white/70 hover:text-white hover:bg-white/10" data-testid="button-charlotte-new-chat">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {showThreads ? (
          <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Conversations</div>
            {threads.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">No conversations yet</p>}
            {threads.map((t) => (
              <div
                key={t.id}
                className={`flex items-center gap-2 px-2.5 py-2 rounded-lg cursor-pointer text-sm transition-colors ${activeThread?.id === t.id ? "bg-primary/10" : "hover:bg-muted"}`}
                data-testid={`thread-${t.id}`}
              >
                <MessageSquare className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="flex-1 truncate text-xs" onClick={() => { setActiveThread(t); setShowThreads(false); }}>{t.title}</span>
                <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive" onClick={() => deleteThreadMut.mutate(t.id)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <>
            <ScrollArea className="flex-1 min-h-0">
              <div className="p-3 space-y-3">
                {!activeThread && visibleMessages.length === 0 && (
                  <div className="space-y-3">
                    <div className="flex items-start gap-2">
                      <img src={charlotteAvatar} alt="Charlotte" className="h-6 w-6 rounded-full object-cover shrink-0 mt-0.5" />
                      <div className="bg-muted rounded-lg px-3 py-2 text-xs leading-relaxed max-w-[85%]">
                        Hey y'all! I'm Charlotte, your admin assistant. I can help you import listings, draft content, check on submissions, and more. What can I help with?
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Quick Actions</p>
                      <div className="flex flex-wrap gap-1.5">
                        {QUICK_ACTIONS.map((action) => (
                          <Button
                            key={action.label}
                            variant="outline"
                            size="sm"
                            onClick={() => handleSend(action.message)}
                            className="rounded-full gap-1.5 text-[11px] h-7"
                            data-testid={`quick-action-${action.label.toLowerCase().replace(/\s/g, "-")}`}
                          >
                            <action.icon className="h-3 w-3 shrink-0" style={{ color: "hsl(273 66% 34%)" }} />
                            {action.label}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {visibleMessages.map((msg) => (
                  <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} gap-2`} data-testid={`message-${msg.id}`}>
                    {msg.role !== "user" && (
                      <img src={charlotteAvatar} alt="Charlotte" className="h-5 w-5 rounded-full object-cover shrink-0 mt-0.5" />
                    )}
                    <div
                      className={`max-w-[80%] rounded-lg px-3 py-2 ${
                        msg.role === "user"
                          ? "text-primary-foreground text-xs"
                          : "bg-muted"
                      }`}
                      style={msg.role === "user" ? { background: "hsl(273 66% 34%)" } : undefined}
                    >
                      {msg.role === "user" ? (
                        <p className="text-xs">{msg.content}</p>
                      ) : (
                        <MarkdownContent content={msg.content} />
                      )}
                      {msg.attachments && msg.attachments.length > 0 && (
                        <MessageAttachments attachments={msg.attachments} />
                      )}
                    </div>
                  </div>
                ))}

                {isTyping && (
                  <div className="flex items-start gap-2">
                    <img src={charlotteAvatar} alt="Charlotte" className="h-5 w-5 rounded-full object-cover shrink-0 mt-0.5" />
                    <div className="bg-muted rounded-lg px-3 py-2">
                      <div className="flex gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "0ms" }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "150ms" }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "300ms" }} />
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            <div className="border-t p-2 shrink-0">
              {pendingFiles.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-1.5 px-0.5">
                  {pendingFiles.map((f, i) => (
                    <AttachmentChip
                      key={`${f.filename}-${i}`}
                      attachment={f}
                      onRemove={() => setPendingFiles((prev) => prev.filter((_, idx) => idx !== i))}
                    />
                  ))}
                </div>
              )}
              <form
                onSubmit={(e) => { e.preventDefault(); handleSend(); }}
                className="flex items-center gap-1.5"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif,.csv,.tsv,.txt,.pdf"
                  multiple
                  className="hidden"
                  onChange={(e) => handleFileSelect(e.target.files)}
                  data-testid="input-charlotte-file"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 rounded-full text-muted-foreground"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isTyping || isUploading}
                  data-testid="button-charlotte-attach"
                >
                  {isUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Paperclip className="h-3.5 w-3.5" />}
                </Button>
                <Input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={pendingFiles.length > 0 ? "Add a message about these files..." : "Ask Charlotte anything..."}
                  className="flex-1 text-xs h-8"
                  disabled={isTyping}
                  data-testid="input-charlotte-message"
                />
                <Button
                  type="submit"
                  size="icon"
                  className="h-8 w-8 shrink-0 rounded-full"
                  style={{ background: "hsl(273 66% 34%)" }}
                  disabled={isTyping || (!input.trim() && pendingFiles.length === 0)}
                  data-testid="button-charlotte-send"
                >
                  {isTyping ? <Loader2 className="h-3.5 w-3.5 animate-spin text-white" /> : <Send className="h-3.5 w-3.5 text-white" />}
                </Button>
              </form>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
