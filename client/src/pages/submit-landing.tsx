import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useCategories, useCityZones } from "@/hooks/use-city";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Building2, Calendar, FileText, Newspaper, Megaphone, MessageSquare, CheckCircle, Upload, X, FileIcon, Repeat } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { AuthDialog } from "@/components/auth-dialog";

const SUBMISSION_TYPES = [
  { value: "ACTIVATE", label: "Commerce / Org", icon: Building2, color: "hsl(174 62% 44%)", redirectToActivate: true },
  { value: "EVENT", label: "Event", icon: Calendar, color: "hsl(14 77% 54%)" },
  { value: "ARTICLE_PITCH", label: "Article", icon: FileText, color: "hsl(211 55% 55%)" },
  { value: "PRESS_RELEASE", label: "Press Release", icon: Newspaper, color: "hsl(273 66% 45%)" },
  { value: "HUB_SHOUT_OUT", label: "Shout-Out", icon: Megaphone, color: "hsl(46 88% 50%)" },
  { value: "MEDIA_MENTION", label: "Media Mention", icon: MessageSquare, color: "hsl(152 30% 48%)" },
];

interface UploadedFile {
  url: string;
  filename: string;
  mimetype: string;
  isImage: boolean;
}

export default function SubmitLanding({ citySlug }: { citySlug: string }) {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const { user, isLoading: authLoading } = useAuth();
  const [showAuthDialog, setShowAuthDialog] = useState(false);
  const { data: categories } = useCategories();
  const { data: zones } = useCityZones(citySlug);
  const [submitted, setSubmitted] = useState(false);
  const [submissionType, setSubmissionType] = useState("");

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zip, setZip] = useState("");
  const [phone, setPhone] = useState("");
  const [zoneId, setZoneId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [submitterName, setSubmitterName] = useState("");
  const [submitterEmail, setSubmitterEmail] = useState("");

  const [startDateTime, setStartDateTime] = useState("");
  const [endDateTime, setEndDateTime] = useState("");
  const [locationName, setLocationName] = useState("");
  const [costText, setCostText] = useState("");

  const [title, setTitle] = useState("");
  const [excerpt, setExcerpt] = useState("");


  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrencePattern, setRecurrencePattern] = useState("");

  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [uploading, setUploading] = useState(false);


  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    for (const file of Array.from(files)) {
      const formData = new FormData();
      formData.append("file", file);
      try {
        const resp = await fetch("/api/upload", { method: "POST", body: formData });
        if (resp.ok) {
          const data = await resp.json();
          setUploadedFiles(prev => [...prev, data]);
        } else {
          toast({ title: "Upload failed", description: `Could not upload ${file.name}`, variant: "destructive" });
        }
      } catch {
        toast({ title: "Upload failed", variant: "destructive" });
      }
    }
    setUploading(false);
    e.target.value = "";
  };

  const removeFile = (idx: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== idx));
  };

  const mutation = useMutation({
    mutationFn: async () => {
      const payload: Record<string, any> = { submitterName, submitterEmail };
      const attachments = uploadedFiles.map(f => f.url);

      if (submissionType === "EVENT") {
        Object.assign(payload, {
          title: name || title, description, startDateTime, endDateTime,
          locationName, address, city, state, zip, costText,
          isRecurring, recurrencePattern: isRecurring ? recurrencePattern : undefined,
          categoryIds: categoryId ? [categoryId] : [],
        });
      } else if (submissionType === "ARTICLE_PITCH") {
        Object.assign(payload, { title: name || title, excerpt: description || excerpt });
      } else {
        Object.assign(payload, { title: name || title, description, content: description });
      }

      if (attachments.length > 0) {
        payload.attachments = attachments;
        payload.imageUrl = uploadedFiles.find(f => f.isImage)?.url;
      }

      await apiRequest("POST", `/api/cities/${citySlug}/submissions`, {
        type: submissionType,
        payload,
        submitterName,
        submitterEmail,
        zoneId: zoneId || undefined,
      });
    },
    onSuccess: () => setSubmitted(true),
    onError: () => toast({ title: "Error", description: "Could not submit. Please try again.", variant: "destructive" }),
  });

  if (!authLoading && !user) {
    return (
      <div className="max-w-xl mx-auto">
        <Card className="p-8 text-center">
          <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Sign in to Submit Content</h2>
          <p className="text-sm text-muted-foreground mb-6">Create a free account to submit events, stories, and more to CLT Metro Hub.</p>
          <Button onClick={() => setShowAuthDialog(true)} data-testid="button-auth-submit-landing">Sign In / Create Account</Button>
          <AuthDialog open={showAuthDialog} onOpenChange={setShowAuthDialog} defaultTab="register" />
        </Card>
      </div>
    );
  }

  const isEvent = submissionType === "EVENT";
  const isArticle = submissionType === "ARTICLE_PITCH";
  const isSimple = ["PRESS_RELEASE", "HUB_SHOUT_OUT", "MEDIA_MENTION"].includes(submissionType);

  const canSubmit = submitterName.trim() && submitterEmail.trim() && submissionType &&
    ((isEvent && (name.trim() || title.trim()) && description.trim() && startDateTime) ||
     (isArticle && (name.trim() || title.trim()) && (description.trim() || excerpt.trim())) ||
     (isSimple && (name.trim() || title.trim()) && description.trim()));

  if (submitted) {
    return (
      <div className="max-w-xl mx-auto py-12">
        <Card className="p-8 text-center">
          <CheckCircle className="mx-auto h-12 w-12 text-green-500 mb-4" />
          <h2 className="text-xl font-bold mb-2">Submission Received!</h2>
          <p className="text-muted-foreground mb-4">
            Thank you for submitting to the Hub. Our team will review it shortly.
          </p>
          <div className="flex gap-3 justify-center">
            <Button onClick={() => { setSubmitted(false); setSubmissionType(""); setName(""); setDescription(""); setUploadedFiles([]); }} variant="outline" data-testid="button-submit-another">
              Submit Another
            </Button>
            <Link href={`/${citySlug}`}>
              <Button data-testid="button-back-home">Back to Home</Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold md:text-3xl mb-2" data-testid="text-submit-title">
          Submit to the Hub
        </h1>
        <p className="text-muted-foreground max-w-xl mx-auto text-sm">
          Share an event, article, or more with the Charlotte community.
          For commerce and organizations, use the Activate flow. All submissions are reviewed before publication.
        </p>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2" data-testid="submit-type-selector">
        {SUBMISSION_TYPES.map((type) => {
          const isActive = submissionType === type.value;
          return (
            <button
              key={type.value}
              onClick={() => {
                if ((type as any).redirectToActivate) {
                  navigate(`/${citySlug}/activate`);
                  return;
                }
                setSubmissionType(type.value);
              }}
              className={`flex flex-col items-center gap-1.5 rounded-lg p-3 border-2 transition-all text-center ${
                isActive ? "border-primary bg-primary/5 shadow-md" : "border-border hover:border-primary/40"
              }`}
              data-testid={`submit-type-${type.value.toLowerCase()}`}
            >
              <type.icon className="h-5 w-5" style={{ color: type.color }} />
              <span className="text-[11px] font-medium leading-tight">{type.label}</span>
            </button>
          );
        })}
      </div>

      {submissionType && (
        <Card className="p-5 space-y-5">
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">
                Title <span className="text-red-500">*</span>
              </label>
              <Input
                value={name || title}
                onChange={(e) => { setName(e.target.value); setTitle(e.target.value); }}
                placeholder="Enter a title"
                data-testid="input-submit-name"
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-1.5 block">
                {isArticle ? "Summary / Pitch" : "Description"} <span className="text-red-500">*</span>
              </label>
              <Textarea
                value={description || excerpt}
                onChange={(e) => { setDescription(e.target.value); setExcerpt(e.target.value); }}
                placeholder={isArticle ? "Describe your article idea..." : "Tell us about it..."}
                rows={3}
                data-testid="input-submit-description"
              />
            </div>

            {isEvent && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Venue / Location</label>
                  <Input value={locationName} onChange={(e) => setLocationName(e.target.value)} placeholder="Venue name" data-testid="input-submit-location" />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Address</label>
                  <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Street address" data-testid="input-submit-address" />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">City</label>
                  <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Charlotte" data-testid="input-submit-city" />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">State</label>
                  <Input value={state} onChange={(e) => setState(e.target.value)} placeholder="NC" data-testid="input-submit-state" />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">ZIP</label>
                  <Input value={zip} onChange={(e) => setZip(e.target.value)} placeholder="28202" data-testid="input-submit-zip" />
                </div>
              </div>
            )}

            {isEvent && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Start Date/Time <span className="text-red-500">*</span></label>
                    <Input type="datetime-local" value={startDateTime} onChange={(e) => setStartDateTime(e.target.value)} data-testid="input-submit-start" />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">End Date/Time</label>
                    <Input type="datetime-local" value={endDateTime} onChange={(e) => setEndDateTime(e.target.value)} data-testid="input-submit-end" />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Cost</label>
                    <Input value={costText} onChange={(e) => setCostText(e.target.value)} placeholder="Free, $10, etc." data-testid="input-submit-cost" />
                  </div>
                </div>
                <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <Checkbox checked={isRecurring} onCheckedChange={(checked) => setIsRecurring(!!checked)} data-testid="checkbox-submit-recurring" />
                    <div className="flex items-center gap-2">
                      <Repeat className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">This is a recurring event</span>
                    </div>
                  </label>
                  {isRecurring && (
                    <div>
                      <label className="text-sm font-medium mb-1.5 block">How often does it repeat?</label>
                      <Select value={recurrencePattern} onValueChange={setRecurrencePattern}>
                        <SelectTrigger data-testid="select-submit-recurrence"><SelectValue placeholder="Select frequency" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="weekly">Weekly</SelectItem>
                          <SelectItem value="biweekly">Every 2 Weeks</SelectItem>
                          <SelectItem value="monthly">Monthly</SelectItem>
                          <SelectItem value="first_of_month">First of Every Month</SelectItem>
                          <SelectItem value="last_of_month">Last of Every Month</SelectItem>
                          <SelectItem value="quarterly">Quarterly</SelectItem>
                          <SelectItem value="other">Other (describe in description)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              </>
            )}

            {isEvent && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Category</label>
                  <Select value={categoryId} onValueChange={setCategoryId}>
                    <SelectTrigger data-testid="select-submit-category">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories?.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Neighborhood</label>
                  <Select value={zoneId} onValueChange={setZoneId}>
                    <SelectTrigger data-testid="select-submit-zone">
                      <SelectValue placeholder="Select neighborhood" />
                    </SelectTrigger>
                    <SelectContent>
                      {zones?.map((z) => (
                        <SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            <div>
              <label className="text-sm font-medium mb-1.5 block">Attachments</label>
              <p className="text-xs text-muted-foreground mb-2">
                Upload images (jpg, png), documents (pdf, doc, docx), or text files. Max 15MB each.
              </p>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 px-4 py-2 rounded-lg border border-dashed border-primary/40 cursor-pointer hover:bg-primary/5 transition-colors text-sm" data-testid="button-upload-file">
                  <Upload className="h-4 w-4 text-primary" />
                  <span>{uploading ? "Uploading..." : "Choose Files"}</span>
                  <input
                    type="file"
                    multiple
                    accept="image/*,.pdf,.doc,.docx,.txt"
                    onChange={handleFileUpload}
                    className="hidden"
                    disabled={uploading}
                  />
                </label>
              </div>
              {uploadedFiles.length > 0 && (
                <div className="mt-2 space-y-1.5">
                  {uploadedFiles.map((file, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-sm bg-muted/50 rounded-md px-3 py-1.5">
                      {file.isImage ? (
                        <img src={file.url} alt="" className="h-8 w-8 rounded object-cover" />
                      ) : (
                        <FileIcon className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span className="flex-1 truncate text-xs">{file.filename}</span>
                      <button onClick={() => removeFile(idx)} className="text-muted-foreground hover:text-red-500">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="border-t pt-4 space-y-3">
            <h3 className="text-sm font-semibold">Your Information</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Name <span className="text-red-500">*</span></label>
                <Input value={submitterName} onChange={(e) => setSubmitterName(e.target.value)} placeholder="Your name" data-testid="input-submitter-name" />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Email <span className="text-red-500">*</span></label>
                <Input type="email" value={submitterEmail} onChange={(e) => setSubmitterEmail(e.target.value)} placeholder="your@email.com" data-testid="input-submitter-email" />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Phone <span className="text-red-500">*</span></label>
                <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(555) 123-4567" data-testid="input-submitter-phone" />
              </div>
            </div>
          </div>

          <Button
            className="w-full"
            disabled={!canSubmit || mutation.isPending}
            onClick={() => mutation.mutate()}
            data-testid="button-submit-form"
          >
            {mutation.isPending ? "Submitting..." : "Submit to Hub"}
          </Button>

          <p className="text-[10px] text-muted-foreground text-center">
            All submissions are reviewed prior to publication. Content may be edited for clarity and alignment with Hub guidelines.
          </p>
        </Card>
      )}
    </div>
  );
}
