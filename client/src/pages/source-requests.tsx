import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams } from "wouter";
import { usePageMeta } from "@/hooks/use-page-meta";
import { DarkPageShell } from "@/components/dark-page-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  FileQuestion,
  Clock,
  Mail,
  User,
  Plus,
  MessageSquare,
  CalendarDays,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface SourceRequest {
  id: string;
  title: string;
  description: string | null;
  requestType: string;
  categorySlug: string | null;
  contactEmail: string | null;
  contactName: string | null;
  deadline: string | null;
  status: string;
  responseCount: number;
  createdAt: string;
}

const REQUEST_TYPES = [
  { value: "expert_quote", label: "Expert Quote" },
  { value: "business_feature", label: "Business Feature" },
  { value: "event_coverage", label: "Event Coverage" },
  { value: "community_story", label: "Community Story" },
  { value: "data_request", label: "Data / Research" },
];

function getTypeLabel(type: string) {
  return REQUEST_TYPES.find(t => t.value === type)?.label || type;
}

function getTypeColor(type: string) {
  switch (type) {
    case "expert_quote": return "bg-blue-500/20 text-blue-400 border-blue-500/30";
    case "business_feature": return "bg-green-500/20 text-green-400 border-green-500/30";
    case "event_coverage": return "bg-purple-500/20 text-purple-400 border-purple-500/30";
    case "community_story": return "bg-amber-500/20 text-amber-400 border-amber-500/30";
    case "data_request": return "bg-red-500/20 text-red-400 border-red-500/30";
    default: return "bg-gray-500/20 text-gray-400 border-gray-500/30";
  }
}

export default function SourceRequestsPage() {
  const { citySlug } = useParams<{ citySlug: string }>();
  const [searchTerm, setSearchTerm] = useState("");
  const [showSubmit, setShowSubmit] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newType, setNewType] = useState("expert_quote");
  const [newContactName, setNewContactName] = useState("");
  const [newContactEmail, setNewContactEmail] = useState("");
  const [newDeadline, setNewDeadline] = useState("");
  const { toast } = useToast();

  usePageMeta({
    title: "Source Requests | Charlotte Hub",
    description: "Find sources, experts, and stories for your content. Post requests for the Charlotte community.",
  });

  const { data: requests = [], isLoading } = useQuery<SourceRequest[]>({
    queryKey: [`/api/cities/${citySlug}/source-requests`],
  });

  const submitMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", `/api/cities/${citySlug}/source-requests`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/cities/${citySlug}/source-requests`] });
      toast({ title: "Request submitted" });
      setShowSubmit(false);
      setNewTitle("");
      setNewDescription("");
      setNewType("expert_quote");
      setNewContactName("");
      setNewContactEmail("");
      setNewDeadline("");
    },
    onError: () => {
      toast({ title: "Failed to submit", variant: "destructive" });
    },
  });

  const filtered = searchTerm
    ? requests.filter(r =>
        r.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (r.description || "").toLowerCase().includes(searchTerm.toLowerCase())
      )
    : requests;

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }

  return (
    <DarkPageShell maxWidth="wide" fillHeight>
      <div className="px-4 py-8 mx-auto">
        <div className="flex items-start justify-between mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <FileQuestion className="w-8 h-8 text-amber-400" />
              <h1 className="text-3xl font-bold text-white" data-testid="text-source-requests-title">
                Source Requests
              </h1>
            </div>
            <p className="text-gray-400 text-lg">
              Looking for an expert, business, or story lead? Browse open requests or post your own.
            </p>
          </div>
          <Button
            data-testid="button-new-source-request"
            className="bg-amber-500 text-black font-semibold shrink-0"
            onClick={() => setShowSubmit(true)}
          >
            <Plus className="w-4 h-4 mr-2" />
            New Request
          </Button>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <Input
              data-testid="input-source-search"
              placeholder="Search requests..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-gray-900 border-gray-700 text-white"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-32 rounded-lg bg-gray-800" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <FileQuestion className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400 text-lg">No open requests</p>
            <p className="text-gray-500 text-sm mt-1">Be the first to post a source request</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(request => (
              <Card
                key={request.id}
                data-testid={`card-source-request-${request.id}`}
                className="bg-gray-900 border-gray-800 p-5"
              >
                <div className="flex items-start justify-between gap-4 mb-3">
                  <h3 className="text-lg font-semibold text-white">
                    {request.title}
                  </h3>
                  <Badge className={`shrink-0 text-xs ${getTypeColor(request.requestType)}`}>
                    {getTypeLabel(request.requestType)}
                  </Badge>
                </div>
                {request.description && (
                  <p className="text-gray-400 text-sm mb-3 line-clamp-3">
                    {request.description}
                  </p>
                )}
                <div className="flex items-center gap-4 text-xs text-gray-500 flex-wrap">
                  {request.contactName && (
                    <span className="flex items-center gap-1">
                      <User className="w-3 h-3" />
                      {request.contactName}
                    </span>
                  )}
                  {request.deadline && (
                    <span className="flex items-center gap-1">
                      <CalendarDays className="w-3 h-3" />
                      Deadline: {formatDate(request.deadline)}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatDate(request.createdAt)}
                  </span>
                  <span className="flex items-center gap-1">
                    <MessageSquare className="w-3 h-3" />
                    {request.responseCount} responses
                  </span>
                </div>
                {request.contactEmail && (
                  <div className="mt-3">
                    <a href={`mailto:${request.contactEmail}`} data-testid={`link-contact-${request.id}`}>
                      <Button variant="outline" className="border-gray-700 text-gray-300 text-sm">
                        <Mail className="w-3.5 h-3.5 mr-1.5" />
                        Respond
                      </Button>
                    </a>
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={showSubmit} onOpenChange={setShowSubmit}>
        <DialogContent className="max-w-lg bg-gray-950 border-gray-800">
          <DialogHeader>
            <DialogTitle className="text-white">New Source Request</DialogTitle>
            <DialogDescription className="text-gray-400">
              Post a request for an expert quote, business feature, or community story.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-gray-300">Title</Label>
              <Input
                data-testid="input-request-title"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="What are you looking for?"
                className="bg-gray-900 border-gray-700 text-white"
              />
            </div>
            <div>
              <Label className="text-gray-300">Description</Label>
              <textarea
                data-testid="input-request-description"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Provide details about your request..."
                className="w-full min-h-[100px] rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white"
              />
            </div>
            <div>
              <Label className="text-gray-300">Request Type</Label>
              <Select value={newType} onValueChange={setNewType}>
                <SelectTrigger className="bg-gray-900 border-gray-700 text-white" data-testid="select-request-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REQUEST_TYPES.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-gray-300">Your Name</Label>
                <Input
                  data-testid="input-request-name"
                  value={newContactName}
                  onChange={(e) => setNewContactName(e.target.value)}
                  className="bg-gray-900 border-gray-700 text-white"
                />
              </div>
              <div>
                <Label className="text-gray-300">Your Email</Label>
                <Input
                  data-testid="input-request-email"
                  value={newContactEmail}
                  onChange={(e) => setNewContactEmail(e.target.value)}
                  type="email"
                  className="bg-gray-900 border-gray-700 text-white"
                />
              </div>
            </div>
            <div>
              <Label className="text-gray-300">Deadline</Label>
              <Input
                data-testid="input-request-deadline"
                type="date"
                value={newDeadline}
                onChange={(e) => setNewDeadline(e.target.value)}
                className="bg-gray-900 border-gray-700 text-white"
              />
            </div>
            <Button
              data-testid="button-submit-request"
              className="w-full bg-amber-500 text-black font-semibold"
              disabled={!newTitle.trim() || submitMutation.isPending}
              onClick={() => submitMutation.mutate({
                title: newTitle.trim(),
                description: newDescription.trim() || null,
                requestType: newType,
                contactName: newContactName.trim() || null,
                contactEmail: newContactEmail.trim() || null,
                deadline: newDeadline || null,
              })}
            >
              {submitMutation.isPending ? "Submitting..." : "Submit Request"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </DarkPageShell>
  );
}
