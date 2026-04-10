import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { MessageCircle, Send, Search, User, Phone, ExternalLink, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";

interface ConversationSummary {
  contactId: string;
  lastMessage: string;
  lastAt: string;
  contactName: string | null;
  contactPhone: string;
  unreadCount: number;
}

interface SmsMessage {
  id: string;
  contactId: string;
  direction: "inbound" | "outbound";
  body: string;
  fromNumber: string;
  toNumber: string;
  status: "sent" | "delivered" | "failed" | "received";
  twilioSid: string;
  createdAt: string;
}

function formatTimeAgo(dateStr: string): string {
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const diffMs = now - date;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay === 1) return "Yesterday";
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function statusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "delivered":
      return "default";
    case "sent":
      return "secondary";
    case "failed":
      return "destructive";
    default:
      return "outline";
  }
}

export default function SmsConversationsPanel({ cityId }: { cityId?: string } = {}) {
  const { toast } = useToast();
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [messageText, setMessageText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const conversationsUrl = cityId
    ? `/api/admin/sms/conversations?cityId=${cityId}`
    : "/api/admin/sms/conversations";
  const { data: conversations = [], isLoading: conversationsLoading } = useQuery<ConversationSummary[]>({
    queryKey: ["/api/admin/sms/conversations", cityId],
    queryFn: () => fetch(conversationsUrl, { credentials: "include" }).then(r => r.json()),
  });

  const selectedConversation = conversations.find((c) => c.contactId === selectedContactId);

  const { data: messages = [], isLoading: messagesLoading } = useQuery<SmsMessage[]>({
    queryKey: ["/api/admin/sms/conversations", selectedContactId],
    enabled: !!selectedContactId,
  });

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const sendMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/admin/sms/send", {
        contactId: selectedContactId,
        body: messageText,
        toNumber: selectedConversation?.contactPhone,
        cityId: cityId || undefined,
      });
    },
    onSuccess: () => {
      setMessageText("");
      queryClient.invalidateQueries({ queryKey: ["/api/admin/sms/conversations", selectedContactId] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/sms/conversations"] });
    },
    onError: () => {
      toast({ title: "Failed to send message", variant: "destructive" });
    },
  });

  const filteredConversations = conversations.filter((c) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (c.contactName && c.contactName.toLowerCase().includes(q)) ||
      c.contactPhone.toLowerCase().includes(q)
    );
  });

  const handleSend = () => {
    if (!messageText.trim() || !selectedContactId) return;
    sendMutation.mutate();
  };

  return (
    <div className="flex h-[calc(100vh-8rem)] border rounded-md overflow-hidden" data-testid="sms-conversations-panel">
      <div className="w-80 border-r flex flex-col">
        <div className="p-3 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search contacts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
              data-testid="input-search-contacts"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {conversationsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin" data-testid="loader-conversations" />
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground" data-testid="text-no-conversations">
              No conversations found
            </div>
          ) : (
            filteredConversations.map((conv) => (
              <div
                key={conv.contactId}
                className={`p-3 cursor-pointer border-b hover-elevate ${
                  selectedContactId === conv.contactId ? "bg-muted" : ""
                }`}
                onClick={() => setSelectedContactId(conv.contactId)}
                data-testid={`card-conversation-${conv.contactId}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="flex-shrink-0 h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                      <User className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate" data-testid={`text-contact-name-${conv.contactId}`}>
                        {conv.contactName || conv.contactPhone}
                      </p>
                      <p className="text-xs text-muted-foreground truncate" data-testid={`text-last-message-${conv.contactId}`}>
                        {conv.lastMessage.length > 40
                          ? conv.lastMessage.slice(0, 40) + "..."
                          : conv.lastMessage}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatTimeAgo(conv.lastAt)}
                    </span>
                    {conv.unreadCount > 0 && (
                      <Badge variant="default" className="text-xs" data-testid={`badge-unread-${conv.contactId}`}>
                        {conv.unreadCount}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col">
        {!selectedContactId ? (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground" data-testid="empty-state">
            <MessageCircle className="h-12 w-12 mb-3" />
            <p className="text-lg font-medium">Select a conversation</p>
            <p className="text-sm">Choose a contact from the left to view messages</p>
          </div>
        ) : (
          <>
            <div className="p-4 border-b flex items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center">
                  <User className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-medium" data-testid="text-active-contact-name">
                    {selectedConversation?.contactName || selectedConversation?.contactPhone}
                  </p>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Phone className="h-3 w-3" />
                    <span data-testid="text-active-contact-phone">{selectedConversation?.contactPhone}</span>
                  </div>
                </div>
              </div>
              <Button
                size="icon"
                variant="ghost"
                asChild
                data-testid="link-contact-profile"
              >
                <a href={`/admin/contacts?id=${selectedContactId}`} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messagesLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-5 w-5 animate-spin" data-testid="loader-messages" />
                </div>
              ) : messages.length === 0 ? (
                <div className="text-center text-sm text-muted-foreground py-12" data-testid="text-no-messages">
                  No messages yet
                </div>
              ) : (
                messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.direction === "outbound" ? "justify-end" : "justify-start"}`}
                    data-testid={`message-bubble-${msg.id}`}
                  >
                    <div
                      className={`max-w-[70%] rounded-md px-3 py-2 ${
                        msg.direction === "outbound"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap" data-testid={`text-message-body-${msg.id}`}>
                        {msg.body}
                      </p>
                      <div className={`flex items-center gap-2 mt-1 ${
                        msg.direction === "outbound" ? "justify-end" : "justify-start"
                      }`}>
                        <span className={`text-xs ${
                          msg.direction === "outbound" ? "text-primary-foreground/70" : "text-muted-foreground"
                        }`}>
                          {formatTimeAgo(msg.createdAt)}
                        </span>
                        {msg.direction === "outbound" && (
                          <Badge
                            variant={statusVariant(msg.status)}
                            className="text-[10px] px-1 py-0"
                            data-testid={`badge-status-${msg.id}`}
                          >
                            {msg.status}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="p-3 border-t flex items-center gap-2">
              <Input
                placeholder="Type a message..."
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                data-testid="input-message-text"
              />
              <Button
                onClick={handleSend}
                disabled={!messageText.trim() || sendMutation.isPending}
                data-testid="button-send-message"
              >
                {sendMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}