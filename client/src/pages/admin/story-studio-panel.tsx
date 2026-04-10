import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Plus, Copy, Trash2, Edit, Loader2, Search,
  Mic, FileText, Send, Eye, ChevronLeft, Image, Play, Pause, BookOpen,
  GripVertical, Globe, Save, FolderOpen,
} from "lucide-react";
import type { StoryInvitation, InterviewQuestionTemplate, IntakeResponse } from "@shared/schema";
import beckyBitmojiPath from "@assets/Bitmoji_Welcome_Becky_1774981046688.png";
import beckyQrPath from "@assets/Becky_Homko_qr_1774981065478.png";
import beckyPhotoPath from "@assets/2_1_2022,_12_29_13_PM_1774981099608.jpg";

type View = "list" | "create" | "review";

interface InvitationPayload {
  contactName: string;
  contactEmail: string | null;
  contactPhone: string | null;
  contactTitle: string | null;
  companyName: string | null;
  website: string | null;
  address: string | null;
  operatorName: string;
  operatorPhotoUrl: string;
  operatorGreeting: string;
  crmContactId: string | null;
  cityId: string;
  questionIds: string[];
}

interface QuestionPayload {
  questionText: string;
  displayOrder: number;
  isCustom: boolean;
  isDefault: boolean;
  templateSetName?: string;
}

interface CrmContact {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  title: string | null;
  company: string | null;
  website: string | null;
  address: string | null;
}

function SortableQuestionItem({ question, index, total, isEditing, editText, onStartEdit, onSaveEdit, onCancelEdit, onEditTextChange, onDelete }: {
  question: InterviewQuestionTemplate;
  index: number;
  total: number;
  isEditing: boolean;
  editText: string;
  onStartEdit: () => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onEditTextChange: (val: string) => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: question.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="flex items-start gap-2 p-3 rounded-lg border bg-background" data-testid={`question-item-${question.id}`}>
      <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing p-1 mt-0.5 text-muted-foreground hover:text-foreground" data-testid={`drag-handle-${question.id}`}>
        <GripVertical className="h-4 w-4" />
      </button>
      <span className="text-sm text-muted-foreground font-mono w-6 flex-shrink-0 pt-0.5">{index + 1}.</span>
      <div className="flex-1 min-w-0">
        {isEditing ? (
          <div className="flex gap-2 items-start">
            <Textarea value={editText} onChange={e => onEditTextChange(e.target.value)} rows={2} className="flex-1" />
            <Button size="sm" onClick={onSaveEdit}>Save</Button>
            <Button size="sm" variant="ghost" onClick={onCancelEdit}>Cancel</Button>
          </div>
        ) : (
          <p className="text-sm">{question.questionText}</p>
        )}
        {question.fieldMapping && <span className="text-xs text-muted-foreground">Maps to: {question.fieldMapping}</span>}
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onStartEdit} data-testid={`button-edit-question-${question.id}`}>
          <Edit className="h-3 w-3" />
        </Button>
        {question.isCustom && (
          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={onDelete} data-testid={`button-delete-question-${question.id}`}>
            <Trash2 className="h-3 w-3" />
          </Button>
        )}
      </div>
    </div>
  );
}

export default function StoryStudioPanel({ cityId }: { cityId: string }) {
  const { toast } = useToast();
  const [view, setView] = useState<View>("list");
  const [selectedInvitationId, setSelectedInvitationId] = useState<string | null>(null);
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [editQuestionText, setEditQuestionText] = useState("");
  const [newQuestionText, setNewQuestionText] = useState("");
  const [showAddQuestion, setShowAddQuestion] = useState(false);

  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactTitle, setContactTitle] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [website, setWebsite] = useState("");
  const [address, setAddress] = useState("");
  const [operatorName, setOperatorName] = useState("Becky Homko");
  const [operatorPhotoUrl, setOperatorPhotoUrl] = useState(beckyPhotoPath);
  const [operatorGreeting, setOperatorGreeting] = useState("Hi! I'd love to hear your story and share it with our community. Take your time answering these questions — you can use voice, text, or both!");
  const [placesQuery, setPlacesQuery] = useState("");
  const [crmContactId, setCrmContactId] = useState<string | null>(null);
  const [crmSearchQuery, setCrmSearchQuery] = useState("");
  const [crmSearchResults, setCrmSearchResults] = useState<CrmContact[]>([]);
  const [crmSearching, setCrmSearching] = useState(false);
  const [websiteCrawlUrl, setWebsiteCrawlUrl] = useState("");
  const [crawling, setCrawling] = useState(false);

  const [templateSetName, setTemplateSetName] = useState("");
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);

  const [operatorBitmojiUrl, setOperatorBitmojiUrl] = useState(beckyBitmojiPath);
  const [operatorQrUrl, setOperatorQrUrl] = useState(beckyQrPath);
  const [showBrandingEdit, setShowBrandingEdit] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const { data: invitations = [], isLoading: invLoading } = useQuery<StoryInvitation[]>({
    queryKey: ["/api/story-studio/invitations"],
  });

  const { data: questions = [] } = useQuery<InterviewQuestionTemplate[]>({
    queryKey: ["/api/story-studio/questions"],
  });

  const { data: templateSets = [] } = useQuery<string[]>({
    queryKey: ["/api/story-studio/template-sets"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: InvitationPayload) => {
      const res = await apiRequest("POST", "/api/story-studio/invitations", data);
      return res.json();
    },
    onSuccess: (inv: StoryInvitation) => {
      queryClient.invalidateQueries({ queryKey: ["/api/story-studio/invitations"] });
      const url = `${window.location.origin}/story-intake/${inv.token}`;
      navigator.clipboard.writeText(url).catch(() => {});
      toast({ title: "Invite link created!", description: "Link copied to clipboard." });
      setView("list");
      resetForm();
    },
  });

  const addQuestionMutation = useMutation({
    mutationFn: async (data: QuestionPayload) => {
      const res = await apiRequest("POST", "/api/story-studio/questions", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/story-studio/questions"] });
      setNewQuestionText("");
      setShowAddQuestion(false);
    },
  });

  const updateQuestionMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { questionText: string } }) => {
      const res = await apiRequest("PATCH", `/api/story-studio/questions/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/story-studio/questions"] });
      setEditingQuestionId(null);
    },
  });

  const deleteQuestionMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/story-studio/questions/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/story-studio/questions"] });
    },
  });

  const reorderMutation = useMutation({
    mutationFn: async (orderedIds: string[]) => {
      await apiRequest("POST", "/api/story-studio/questions/reorder", { orderedIds });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/story-studio/questions"] });
    },
  });

  const saveTemplateMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await apiRequest("POST", "/api/story-studio/template-sets", { name, questionIds: questions.map(q => q.id) });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/story-studio/template-sets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/story-studio/questions"] });
      setShowSaveTemplate(false);
      setTemplateSetName("");
      toast({ title: "Template set saved!" });
    },
  });

  const loadTemplateMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await apiRequest("POST", "/api/story-studio/template-sets/load", { name });
      return res.json() as Promise<InterviewQuestionTemplate[]>;
    },
    onSuccess: (loadedQuestions: InterviewQuestionTemplate[]) => {
      queryClient.setQueryData(["/api/story-studio/questions"], loadedQuestions);
      toast({ title: "Template loaded!", description: `${loadedQuestions.length} questions loaded` });
    },
  });

  function resetForm() {
    setContactName(""); setContactEmail(""); setContactPhone(""); setContactTitle("");
    setCompanyName(""); setWebsite(""); setAddress(""); setPlacesQuery("");
    setCrmContactId(null); setCrmSearchQuery(""); setCrmSearchResults([]);
    setWebsiteCrawlUrl("");
  }

  const crmSearchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function searchCrmContacts(query: string) {
    if (crmSearchTimerRef.current) clearTimeout(crmSearchTimerRef.current);
    if (!query || query.length < 2) { setCrmSearchResults([]); setCrmSearching(false); return; }
    setCrmSearching(true);
    crmSearchTimerRef.current = setTimeout(async () => {
      try {
        const res = await apiRequest("GET", `/api/crm/contacts?search=${encodeURIComponent(query)}&limit=5`);
        const result = await res.json();
        const contacts = Array.isArray(result) ? result : result.data || [];
        setCrmSearchResults(contacts as CrmContact[]);
      } catch {
        setCrmSearchResults([]);
      } finally {
        setCrmSearching(false);
      }
    }, 300);
  }

  function prefillFromCrmContact(contact: CrmContact) {
    setContactName(contact.name || "");
    setContactEmail(contact.email || "");
    setContactPhone(contact.phone || "");
    setContactTitle(contact.title || "");
    setCompanyName(contact.company || "");
    setWebsite(contact.website || "");
    setAddress(contact.address || "");
    setCrmContactId(contact.id);
    setCrmSearchResults([]);
    setCrmSearchQuery("");
    toast({ title: "Contact loaded", description: `Prefilled from ${contact.name}` });
  }

  async function crawlWebsite() {
    if (!websiteCrawlUrl) return;
    setCrawling(true);
    try {
      const res = await apiRequest("POST", "/api/story-studio/crawl-website", { url: websiteCrawlUrl });
      const data = await res.json();
      if (data.name) setCompanyName(data.name);
      if (data.description) setOperatorGreeting(prev => prev);
      if (data.phone) setContactPhone(data.phone);
      if (data.email) setContactEmail(data.email);
      if (data.address) setAddress(data.address);
      toast({ title: "Website info extracted", description: data.name || "Data pulled from website" });
    } catch (err: unknown) {
      toast({ title: "Could not crawl website", description: err instanceof Error ? err.message : "Failed to extract info", variant: "destructive" });
    } finally {
      setCrawling(false);
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = questions.findIndex(q => q.id === active.id);
    const newIndex = questions.findIndex(q => q.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const newOrder = arrayMove(questions.map(q => q.id), oldIndex, newIndex);
    reorderMutation.mutate(newOrder);
  }

  const statusColors: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
    in_progress: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    submitted: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    listing_created: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
    archived: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
  };

  if (view === "review" && selectedInvitationId) {
    return <SubmissionReview invitationId={selectedInvitationId} onBack={() => { setView("list"); setSelectedInvitationId(null); }} />;
  }

  if (view === "create") {
    return (
      <div className="space-y-6 p-4" data-testid="story-studio-create">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setView("list")} data-testid="button-back-list">
            <ChevronLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <h2 className="text-xl font-bold">New Story Invite</h2>
        </div>

        <Card className="p-6 space-y-4">
          <h3 className="font-semibold text-lg">Pull from CRM</h3>
          <div className="flex gap-2">
            <Input
              value={crmSearchQuery}
              onChange={e => { setCrmSearchQuery(e.target.value); searchCrmContacts(e.target.value); }}
              placeholder="Search CRM contacts by name, business, email..."
              data-testid="input-crm-search"
            />
            {crmSearching && <Loader2 className="h-5 w-5 animate-spin flex-shrink-0 mt-2" />}
          </div>
          {crmSearchResults.length > 0 && (
            <div className="border rounded-lg divide-y max-h-48 overflow-y-auto">
              {crmSearchResults.map((c) => (
                <button
                  key={c.id}
                  className="w-full text-left p-3 hover:bg-muted/50 transition-colors"
                  onClick={() => prefillFromCrmContact(c)}
                  data-testid={`crm-result-${c.id}`}
                >
                  <p className="font-medium text-sm">{c.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {[c.company, c.email, c.phone].filter(Boolean).join(" · ")}
                  </p>
                </button>
              ))}
            </div>
          )}
          {crmContactId && (
            <Badge variant="secondary" className="text-xs">Linked to CRM contact: {crmContactId.slice(0, 8)}...</Badge>
          )}
        </Card>

        <Card className="p-6 space-y-4">
          <h3 className="font-semibold text-lg">Contact & Business Info</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Contact Name *</Label>
              <Input value={contactName} onChange={e => setContactName(e.target.value)} placeholder="Jane Smith" data-testid="input-contact-name" />
            </div>
            <div>
              <Label>Title / Role</Label>
              <Input value={contactTitle} onChange={e => setContactTitle(e.target.value)} placeholder="Owner, Manager..." data-testid="input-contact-title" />
            </div>
            <div>
              <Label>Company / Business</Label>
              <Input value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="Acme Coffee" data-testid="input-company-name" />
            </div>
            <div>
              <Label>Email</Label>
              <Input type="email" value={contactEmail} onChange={e => setContactEmail(e.target.value)} placeholder="jane@example.com" data-testid="input-contact-email" />
            </div>
            <div>
              <Label>Phone</Label>
              <Input value={contactPhone} onChange={e => setContactPhone(e.target.value)} placeholder="(704) 555-1234" data-testid="input-contact-phone" />
            </div>
            <div>
              <Label>Website</Label>
              <Input value={website} onChange={e => setWebsite(e.target.value)} placeholder="https://..." data-testid="input-website" />
            </div>
            <div className="md:col-span-2">
              <Label>Address</Label>
              <Input value={address} onChange={e => setAddress(e.target.value)} placeholder="123 Main St, Charlotte, NC 28202" data-testid="input-address" />
            </div>
          </div>

          <div className="border-t pt-4 mt-4 space-y-3">
            <Label className="text-sm text-muted-foreground">Google Places Lookup</Label>
            <div className="flex gap-2">
              <Input value={placesQuery} onChange={e => setPlacesQuery(e.target.value)} placeholder="Search for a business on Google..." data-testid="input-places-search" />
              <Button variant="outline" size="sm" disabled={!placesQuery} data-testid="button-places-search"
                onClick={async () => {
                  try {
                    const res = await apiRequest("POST", "/api/admin/claim-lookup", { input: placesQuery });
                    const data = await res.json();
                    if (data.name) setCompanyName(data.name);
                    if (data.phone) setContactPhone(data.phone);
                    if (data.website) setWebsite(data.website);
                    if (data.address) setAddress(data.address);
                    toast({ title: "Business found!", description: data.name });
                  } catch (err: unknown) {
                    toast({ title: "Not found", description: err instanceof Error ? err.message : "Search failed", variant: "destructive" });
                  }
                }}>
                <Search className="h-4 w-4" />
              </Button>
            </div>

            <Label className="text-sm text-muted-foreground">Website Crawl</Label>
            <div className="flex gap-2">
              <Input value={websiteCrawlUrl} onChange={e => setWebsiteCrawlUrl(e.target.value)} placeholder="https://theirbusiness.com" data-testid="input-website-crawl" />
              <Button variant="outline" size="sm" disabled={!websiteCrawlUrl || crawling} onClick={crawlWebsite} data-testid="button-crawl-website">
                {crawling ? <Loader2 className="h-4 w-4 animate-spin" /> : <Globe className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </Card>

        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-lg">Your Branding</h3>
            <Button variant="outline" size="sm" onClick={() => setShowBrandingEdit(!showBrandingEdit)} data-testid="button-toggle-branding">
              <Edit className="h-4 w-4 mr-1" /> {showBrandingEdit ? "Done" : "Edit"}
            </Button>
          </div>
          <div className="flex items-center gap-6 flex-wrap">
            <div className="text-center">
              <img src={operatorBitmojiUrl} alt="Bitmoji" className="w-20 h-20 rounded-full object-cover mx-auto" />
              <p className="text-xs text-muted-foreground mt-1">Bitmoji</p>
            </div>
            <div className="text-center">
              <img src={operatorPhotoUrl} alt="Professional" className="w-20 h-20 rounded-full object-cover mx-auto" />
              <p className="text-xs text-muted-foreground mt-1">Photo</p>
            </div>
            <div className="text-center">
              <img src={operatorQrUrl} alt="QR Code" className="w-20 h-20 object-contain mx-auto" />
              <p className="text-xs text-muted-foreground mt-1">QR Code</p>
            </div>
          </div>
          {showBrandingEdit && (
            <div className="space-y-3 border-t pt-4">
              <div>
                <Label>Operator Name</Label>
                <Input value={operatorName} onChange={e => setOperatorName(e.target.value)} data-testid="input-operator-name" />
              </div>
              <div>
                <Label>Professional Photo URL</Label>
                <Input value={operatorPhotoUrl} onChange={e => setOperatorPhotoUrl(e.target.value)} data-testid="input-operator-photo" />
              </div>
              <div>
                <Label>Bitmoji URL</Label>
                <Input value={operatorBitmojiUrl} onChange={e => setOperatorBitmojiUrl(e.target.value)} data-testid="input-operator-bitmoji" />
              </div>
              <div>
                <Label>QR Code URL</Label>
                <Input value={operatorQrUrl} onChange={e => setOperatorQrUrl(e.target.value)} data-testid="input-operator-qr" />
              </div>
              <div>
                <Label>Personal Greeting</Label>
                <Textarea value={operatorGreeting} onChange={e => setOperatorGreeting(e.target.value)} rows={3} data-testid="input-operator-greeting" />
              </div>
            </div>
          )}
        </Card>

        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-lg">Interview Questions</h3>
            <div className="flex gap-2">
              {templateSets.length > 0 && (
                <div className="flex gap-1">
                  {templateSets.map(name => (
                    <Button key={name} variant="outline" size="sm" onClick={() => loadTemplateMutation.mutate(name)} data-testid={`button-load-template-${name}`}>
                      <FolderOpen className="h-3 w-3 mr-1" /> {name}
                    </Button>
                  ))}
                </div>
              )}
              <Button variant="outline" size="sm" onClick={() => setShowSaveTemplate(!showSaveTemplate)} data-testid="button-save-template-set">
                <Save className="h-4 w-4 mr-1" /> Save Set
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowAddQuestion(true)} data-testid="button-add-question">
                <Plus className="h-4 w-4 mr-1" /> Add Custom
              </Button>
            </div>
          </div>

          {showSaveTemplate && (
            <div className="flex gap-2 items-center border-b pb-3">
              <Input
                value={templateSetName}
                onChange={e => setTemplateSetName(e.target.value)}
                placeholder="Template set name (e.g., Restaurant, Retail)"
                className="flex-1"
                data-testid="input-template-set-name"
              />
              <Button size="sm" disabled={!templateSetName || saveTemplateMutation.isPending}
                onClick={() => saveTemplateMutation.mutate(templateSetName)}
                data-testid="button-confirm-save-template">
                {saveTemplateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
              </Button>
            </div>
          )}

          {showAddQuestion && (
            <div className="flex gap-2 items-start">
              <Textarea
                value={newQuestionText}
                onChange={e => setNewQuestionText(e.target.value)}
                placeholder="Your custom question..."
                rows={2}
                className="flex-1"
                data-testid="input-new-question"
              />
              <Button size="sm" disabled={!newQuestionText || addQuestionMutation.isPending}
                onClick={() => addQuestionMutation.mutate({ questionText: newQuestionText, displayOrder: questions.length, isCustom: true, isDefault: true })}
                data-testid="button-save-question">
                {addQuestionMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}
              </Button>
            </div>
          )}

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={questions.map(q => q.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-2">
                {questions.map((q, i) => (
                  <SortableQuestionItem
                    key={q.id}
                    question={q}
                    index={i}
                    total={questions.length}
                    isEditing={editingQuestionId === q.id}
                    editText={editQuestionText}
                    onStartEdit={() => { setEditingQuestionId(q.id); setEditQuestionText(q.questionText); }}
                    onSaveEdit={() => updateQuestionMutation.mutate({ id: q.id, data: { questionText: editQuestionText } })}
                    onCancelEdit={() => setEditingQuestionId(null)}
                    onEditTextChange={setEditQuestionText}
                    onDelete={() => deleteQuestionMutation.mutate(q.id)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </Card>

        <Button
          size="lg"
          className="w-full"
          disabled={!contactName || createMutation.isPending}
          data-testid="button-generate-link"
          onClick={() => createMutation.mutate({
            contactName,
            contactEmail: contactEmail || null,
            contactPhone: contactPhone || null,
            contactTitle: contactTitle || null,
            companyName: companyName || null,
            website: website || null,
            address: address || null,
            operatorName,
            operatorPhotoUrl,
            operatorGreeting,
            crmContactId: crmContactId || null,
            cityId,
            questionIds: questions.map(q => q.id),
          })}
        >
          {createMutation.isPending ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <Send className="h-5 w-5 mr-2" />}
          Generate Invite Link
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4" data-testid="story-studio-list">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Story Studio</h2>
          <p className="text-sm text-muted-foreground">Create and manage story intake invitations</p>
        </div>
        <Button onClick={() => setView("create")} data-testid="button-new-invite">
          <Plus className="h-4 w-4 mr-1" /> New Invite
        </Button>
      </div>

      {invLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : invitations.length === 0 ? (
        <Card className="p-12 text-center">
          <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="font-semibold text-lg mb-2">No invitations yet</h3>
          <p className="text-muted-foreground mb-4">Create your first story intake invitation to get started.</p>
          <Button onClick={() => setView("create")} data-testid="button-create-first">
            <Plus className="h-4 w-4 mr-1" /> Create First Invite
          </Button>
        </Card>
      ) : (
        <div className="space-y-3">
          {invitations.map(inv => (
            <Card key={inv.id} className="p-4 hover:shadow-md transition-shadow cursor-pointer" data-testid={`invitation-card-${inv.id}`}
              onClick={() => {
                if (inv.status === "submitted" || inv.status === "listing_created") {
                  setSelectedInvitationId(inv.id); setView("review");
                }
              }}>
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold truncate" data-testid={`text-contact-name-${inv.id}`}>{inv.contactName}</h3>
                    {inv.companyName && <span className="text-sm text-muted-foreground">— {inv.companyName}</span>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Created {new Date(inv.createdAt).toLocaleDateString()}
                    {inv.submittedAt && ` · Submitted ${new Date(inv.submittedAt).toLocaleDateString()}`}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Badge className={statusColors[inv.status] || ""} data-testid={`status-badge-${inv.id}`}>
                    {inv.status.replace(/_/g, " ")}
                  </Badge>
                  {(inv.status === "pending" || inv.status === "in_progress") && (
                    <Button variant="outline" size="sm" data-testid={`button-copy-link-${inv.id}`}
                      onClick={e => {
                        e.stopPropagation();
                        const url = `${window.location.origin}/story-intake/${inv.token}`;
                        navigator.clipboard.writeText(url);
                        toast({ title: "Link copied!" });
                      }}>
                      <Copy className="h-3 w-3 mr-1" /> Copy Link
                    </Button>
                  )}
                  {(inv.status === "submitted" || inv.status === "listing_created") && (
                    <Button variant="outline" size="sm" data-testid={`button-review-${inv.id}`}
                      onClick={e => {
                        e.stopPropagation();
                        setSelectedInvitationId(inv.id); setView("review");
                      }}>
                      <Eye className="h-3 w-3 mr-1" /> Review
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function SubmissionReview({ invitationId, onBack }: { invitationId: string; onBack: () => void }) {
  const { toast } = useToast();
  const [draftTitle, setDraftTitle] = useState("");
  const [draftContent, setDraftContent] = useState("");
  const [operatorNotes, setOperatorNotes] = useState("");
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const { data, isLoading } = useQuery<{ invitation: StoryInvitation; responses: IntakeResponse[] }>({
    queryKey: ["/api/story-studio/invitations", invitationId],
  });

  const draftMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/story-studio/invitations/${invitationId}/draft`, { notes: operatorNotes });
      return res.json();
    },
    onSuccess: (draft: { title: string; content: string }) => {
      setDraftTitle(draft.title);
      setDraftContent(draft.content);
      toast({ title: "Draft generated!" });
    },
    onError: (err: Error) => {
      toast({ title: "Error generating draft", description: err.message, variant: "destructive" });
    },
  });

  const publishMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/story-studio/invitations/${invitationId}/publish`, { title: draftTitle, content: draftContent });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Article published!" });
      queryClient.invalidateQueries({ queryKey: ["/api/story-studio/invitations"] });
      onBack();
    },
    onError: (err: Error) => {
      toast({ title: "Publishing failed", description: err.message, variant: "destructive" });
    },
  });

  const toggleAudio = useCallback(async (url: string) => {
    if (audioRef.current) {
      if (playingAudio === url) {
        audioRef.current.pause();
        audioRef.current = null;
        setPlayingAudio(null);
        return;
      }
      audioRef.current.pause();
      audioRef.current = null;
    }
    const audio = new Audio(url);
    audioRef.current = audio;
    audio.onended = () => { audioRef.current = null; setPlayingAudio(null); };
    audio.onerror = () => { audioRef.current = null; setPlayingAudio(null); toast({ title: "Playback error", variant: "destructive" }); };
    try {
      await audio.play();
      setPlayingAudio(url);
    } catch {
      audioRef.current = null;
      toast({ title: "Could not play audio", variant: "destructive" });
    }
  }, [playingAudio, toast]);

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (!data) return <div className="p-4">Submission not found</div>;

  const { invitation: inv, responses } = data;
  const photos = (inv.photoUrls as string[]) || [];

  return (
    <div className="space-y-6 p-4" data-testid="submission-review">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack} data-testid="button-back-review">
          <ChevronLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <div>
          <h2 className="text-xl font-bold">Review: {inv.contactName}</h2>
          {inv.companyName && <p className="text-sm text-muted-foreground">{inv.companyName}</p>}
        </div>
      </div>

      <Card className="p-6 space-y-4">
        <h3 className="font-semibold text-lg flex items-center gap-2">
          <FileText className="h-5 w-5" /> Responses ({responses.length})
        </h3>
        <div className="space-y-4">
          {responses.map(r => (
            <div key={r.id} className="border rounded-lg p-4" data-testid={`response-item-${r.id}`}>
              <p className="font-medium text-sm mb-2">{r.questionText}</p>
              {r.answerText && <p className="text-sm whitespace-pre-wrap">{r.answerText}</p>}
              {r.audioUrl && (
                <div className="mt-2 flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => toggleAudio(r.audioUrl!)} data-testid={`button-play-audio-${r.id}`}>
                    {playingAudio === r.audioUrl ? <Pause className="h-3 w-3 mr-1" /> : <Play className="h-3 w-3 mr-1" />}
                    {playingAudio === r.audioUrl ? "Pause" : "Play Recording"}
                  </Button>
                  {r.transcription && r.transcription !== r.answerText && (
                    <Badge variant="secondary" className="text-xs"><Mic className="h-3 w-3 mr-1" /> Transcribed</Badge>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>

      {photos.length > 0 && (
        <Card className="p-6 space-y-4">
          <h3 className="font-semibold text-lg flex items-center gap-2">
            <Image className="h-5 w-5" /> Photos ({photos.length})
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {photos.map((url, i) => (
              <img key={i} src={url} alt={`Upload ${i + 1}`} className="rounded-lg w-full h-40 object-cover" data-testid={`photo-${i}`} />
            ))}
          </div>
        </Card>
      )}

      <Card className="p-6 space-y-4">
        <h3 className="font-semibold text-lg">Draft with Charlotte</h3>
        <div>
          <Label>Your notes (optional)</Label>
          <Textarea value={operatorNotes} onChange={e => setOperatorNotes(e.target.value)}
            placeholder="Add any context, notes from your meeting, or tone preferences..."
            rows={3} data-testid="input-operator-notes" />
        </div>
        <Button onClick={() => draftMutation.mutate()} disabled={draftMutation.isPending} data-testid="button-draft-charlotte">
          {draftMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <BookOpen className="h-4 w-4 mr-2" />}
          Draft with Charlotte
        </Button>

        {(draftTitle || draftContent) && (
          <div className="border-t pt-4 space-y-3">
            <div>
              <Label>Title</Label>
              <Input value={draftTitle} onChange={e => setDraftTitle(e.target.value)} data-testid="input-draft-title" />
            </div>
            <div>
              <Label>Article Content</Label>
              <Textarea value={draftContent} onChange={e => setDraftContent(e.target.value)} rows={12} data-testid="input-draft-content" />
            </div>
            <Button onClick={() => publishMutation.mutate()} disabled={publishMutation.isPending || !draftTitle || !draftContent} className="w-full" data-testid="button-publish-article">
              {publishMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
              Publish Article
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
