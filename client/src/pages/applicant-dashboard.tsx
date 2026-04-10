import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { usePageMeta } from "@/hooks/use-page-meta";
import { DarkPageShell } from "@/components/dark-page-shell";
import {
  User, Briefcase, Award, FileText, Settings, Clock, Eye, EyeOff, Star,
  Plus, Trash2, Upload, Loader2, Search, ChevronRight, Sparkles, MapPin, Shield, Receipt, DollarSign,
  type LucideIcon
} from "lucide-react";

interface TaxonomySkill { id: string; name: string }
interface TaxonomySubcategory { id: string; name: string; skills: TaxonomySkill[] }
interface TaxonomyCategory { id: string; name: string; subcategories: TaxonomySubcategory[] }
interface ApplicantProfile {
  id: string; headline: string | null; summary: string | null; desiredRoles: string[] | null;
  yearsExperience: number | null; highestEducation: string | null; visibilityLevel: string;
  availabilityType: string; remotePreference: string | null; desiredPayMin: number | null;
  desiredPayMax: number | null; desiredPayUnit: string | null; shiftPreferences: string[] | null;
  daysAvailable: string[] | null; portfolioUrl: string | null; linkedinUrl: string | null;
  websiteUrl: string | null; userId: string; zoneId: string | null;
  desiredIndustries: string[] | null; willingToRelocate: boolean;
}
interface CredentialDirectoryEntry { id: string; name: string; issuingBody: string | null; category: string | null }
interface SkillRecord { id: string; skillName: string; subcategoryName: string; categoryName: string; level: string; yearsUsed: number | null; isTopSkill: boolean }
interface ResumeRecord { id: string; fileName: string; fileUrl: string; isPrimary: boolean }
interface ApplicationRecord { id: string; jobListingId: string; status: string; appliedAt: string }

type TabKey = "profile" | "resumes" | "skills" | "credentials" | "preferences" | "applications" | "payments";

function ProfileTab({ citySlug }: { citySlug: string }) {
  const { toast } = useToast();
  const { data: profile, isLoading } = useQuery<ApplicantProfile | null>({
    queryKey: ["/api/workforce/applicant-profile"],
    queryFn: async () => {
      const r = await fetch("/api/workforce/applicant-profile");
      if (r.status === 404) return null;
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
  });

  const { data: zones } = useQuery<{ id: string; name: string; slug: string }[]>({
    queryKey: ["/api/cities", citySlug, "zones"],
    queryFn: async () => {
      const r = await fetch(`/api/cities/${citySlug}/zones`);
      if (!r.ok) return [];
      return r.json();
    },
  });

  const [headline, setHeadline] = useState("");
  const [summary, setSummary] = useState("");
  const [desiredRoles, setDesiredRoles] = useState("");
  const [yearsExperience, setYearsExperience] = useState("");
  const [highestEducation, setHighestEducation] = useState("");
  const [visibilityLevel, setVisibilityLevel] = useState("PUBLIC");
  const [availabilityType, setAvailabilityType] = useState("FULL_TIME");
  const [zoneId, setZoneId] = useState("");
  useEffect(() => {
    if (profile) {
      setHeadline(profile.headline || "");
      setSummary(profile.summary || "");
      setDesiredRoles((profile.desiredRoles || []).join(", "));
      setYearsExperience(String(profile.yearsExperience || ""));
      setHighestEducation(profile.highestEducation || "");
      setVisibilityLevel(profile.visibilityLevel || "PUBLIC");
      setAvailabilityType(profile.availabilityType || "FULL_TIME");
      setZoneId(profile.zoneId || "");
    }
  }, [profile]);

  const createMutation = useMutation({
    mutationFn: async () => apiRequest("POST", "/api/workforce/applicant-profile", { headline, summary }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workforce/applicant-profile"] });
      toast({ title: "Profile created" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async () => apiRequest("PATCH", "/api/workforce/applicant-profile", {
      headline, summary,
      desiredRoles: desiredRoles.split(",").map(r => r.trim()).filter(Boolean),
      yearsExperience: yearsExperience ? parseInt(yearsExperience) : null,
      highestEducation: highestEducation || null,
      visibilityLevel,
      availabilityType,
      zoneId: zoneId && zoneId !== "none" ? zoneId : null,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workforce/applicant-profile"] });
      toast({ title: "Profile updated" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  if (isLoading) return <Skeleton className="h-40 bg-white/10 rounded-xl" />;

  if (!profile) {
    return (
      <Card className="bg-white/10 border-white/10">
        <CardContent className="p-8 text-center">
          <User className="mx-auto h-12 w-12 text-white/20 mb-4" />
          <h3 className="font-semibold text-lg text-white mb-2" data-testid="text-no-profile">Create Your Workforce Profile</h3>
          <p className="text-white/50 text-sm mb-4">Set up your profile to start connecting with employers</p>
          <div className="max-w-md mx-auto space-y-3 text-left">
            <Input value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder="Professional headline"
              className="bg-white/5 border-white/10 text-white" data-testid="input-create-headline" />
            <Textarea value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="Brief professional summary..."
              className="bg-white/5 border-white/10 text-white min-h-[80px]" data-testid="input-create-summary" />
            <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending} className="w-full" data-testid="button-create-profile">
              {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
              Create Profile
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {visibilityLevel === "PUBLIC" && <Badge className="bg-green-500/20 text-green-300 border-0"><Eye className="h-3 w-3 mr-1" />Public</Badge>}
          {visibilityLevel === "VISIBLE_WHEN_APPLYING" && <Badge className="bg-yellow-500/20 text-yellow-300 border-0"><Eye className="h-3 w-3 mr-1" />Visible When Applying</Badge>}
          {visibilityLevel === "PRIVATE" && <Badge className="bg-red-500/20 text-red-300 border-0"><EyeOff className="h-3 w-3 mr-1" />Private</Badge>}
        </div>
        <div className="flex items-center gap-2 p-2 rounded-lg bg-purple-500/10 border border-purple-500/20">
          <Sparkles className="h-4 w-4 text-purple-400" />
          <span className="text-xs text-purple-300">Charlotte AI can help complete your profile</span>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <label className="text-sm font-medium text-white/70 mb-1 block">Headline</label>
          <Input value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder="e.g. Experienced Marketing Professional"
            className="bg-white/5 border-white/10 text-white" data-testid="input-headline" />
        </div>
        <div>
          <label className="text-sm font-medium text-white/70 mb-1 block">Summary</label>
          <Textarea value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="Tell employers about yourself..."
            className="bg-white/5 border-white/10 text-white min-h-[100px]" data-testid="input-summary" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium text-white/70 mb-1 block">Availability</label>
            <Select value={availabilityType} onValueChange={setAvailabilityType}>
              <SelectTrigger className="bg-white/5 border-white/10 text-white" data-testid="select-availability">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="FULL_TIME">Full-Time</SelectItem>
                <SelectItem value="PART_TIME">Part-Time</SelectItem>
                <SelectItem value="CONTRACT">Contract</SelectItem>
                <SelectItem value="SEASONAL">Seasonal</SelectItem>
                <SelectItem value="FLEXIBLE">Flexible</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium text-white/70 mb-1 block">Visibility</label>
            <Select value={visibilityLevel} onValueChange={setVisibilityLevel}>
              <SelectTrigger className="bg-white/5 border-white/10 text-white" data-testid="select-visibility">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PUBLIC">Public</SelectItem>
                <SelectItem value="VISIBLE_WHEN_APPLYING">Visible When Applying</SelectItem>
                <SelectItem value="PRIVATE">Private</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div>
          <label className="text-sm font-medium text-white/70 mb-1 block">Desired Roles (comma-separated)</label>
          <Input value={desiredRoles} onChange={(e) => setDesiredRoles(e.target.value)} placeholder="Marketing Manager, Content Strategist"
            className="bg-white/5 border-white/10 text-white" data-testid="input-desired-roles" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium text-white/70 mb-1 block">Years of Experience</label>
            <Input type="number" value={yearsExperience} onChange={(e) => setYearsExperience(e.target.value)}
              className="bg-white/5 border-white/10 text-white" data-testid="input-years-experience" />
          </div>
          <div>
            <label className="text-sm font-medium text-white/70 mb-1 block">Highest Education</label>
            <Input value={highestEducation} onChange={(e) => setHighestEducation(e.target.value)} placeholder="e.g. Bachelor's Degree"
              className="bg-white/5 border-white/10 text-white" data-testid="input-education" />
          </div>
        </div>
        <div>
          <label className="text-sm font-medium text-white/70 mb-1 block">Hub / Zone Location</label>
          <Select value={zoneId} onValueChange={setZoneId}>
            <SelectTrigger className="bg-white/5 border-white/10 text-white" data-testid="select-zone">
              <SelectValue placeholder="Select your area" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No zone selected</SelectItem>
              {(zones || []).map((z) => (
                <SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-white/30 mt-1">Your neighborhood / hub helps match with local opportunities</p>
        </div>
        <Button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending} className="w-full" data-testid="button-save-profile">
          {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Save Profile
        </Button>
      </div>
    </div>
  );
}

function ResumesTab() {
  const { toast } = useToast();
  const { data: resumes, isLoading } = useQuery<ResumeRecord[]>({
    queryKey: ["/api/workforce/applicant-resumes"],
  });

  const [title, setTitle] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = { current: null as HTMLInputElement | null };

  const handleFileUpload = async (file: File) => {
    if (!title) { toast({ title: "Enter a resume title first", variant: "destructive" }); return; }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const uploadRes = await fetch("/api/upload", { method: "POST", body: formData });
      if (!uploadRes.ok) throw new Error("Upload failed");
      const { url } = await uploadRes.json();
      await apiRequest("POST", "/api/workforce/applicant-resumes", { fileName: title, fileUrl: url });
      queryClient.invalidateQueries({ queryKey: ["/api/workforce/applicant-resumes"] });
      toast({ title: "Resume uploaded" });
      setTitle("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (e) {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Upload failed", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const setPrimaryMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("POST", `/api/workforce/applicant-resumes/${id}/set-primary`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/workforce/applicant-resumes"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/workforce/applicant-resumes/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workforce/applicant-resumes"] });
      toast({ title: "Resume deleted" });
    },
  });

  if (isLoading) return <Skeleton className="h-40 bg-white/10 rounded-xl" />;

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-white/5 border border-white/10 p-4 space-y-3">
        <h3 className="text-sm font-medium text-white/70">Upload Resume</h3>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Resume title (e.g. Marketing Resume 2026)"
          className="bg-white/5 border-white/10 text-white" data-testid="input-resume-title" />
        <div className="flex items-center gap-2">
          <input
            type="file"
            accept=".pdf,.doc,.docx,.txt"
            ref={(el) => { fileInputRef.current = el; }}
            onChange={(e) => { if (e.target.files?.[0]) handleFileUpload(e.target.files[0]); }}
            className="text-sm text-white/60 file:mr-2 file:rounded file:border-0 file:bg-purple-600 file:px-3 file:py-1 file:text-sm file:text-white hover:file:bg-purple-500"
            data-testid="input-resume-file"
            disabled={uploading}
          />
          {uploading && <Loader2 className="h-4 w-4 animate-spin text-purple-400" />}
        </div>
        <p className="text-xs text-white/30">Accepted: PDF, DOC, DOCX, TXT (max 25MB)</p>
      </div>

      {(!resumes || resumes.length === 0) ? (
        <p className="text-white/40 text-sm text-center py-4">No resumes uploaded yet</p>
      ) : (
        <div className="space-y-2">
          {resumes!.map((r: ResumeRecord) => (
            <div key={r.id} className="flex items-center justify-between rounded-lg bg-white/5 border border-white/10 p-3" data-testid={`card-resume-${r.id}`}>
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-purple-400" />
                <a href={r.fileUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-white hover:text-purple-300 underline" data-testid={`link-resume-${r.id}`}>
                  {r.fileName}
                </a>
                {r.isPrimary && <Badge className="bg-purple-500/20 text-purple-300 border-0 text-[10px]">Primary</Badge>}
              </div>
              <div className="flex items-center gap-1">
                {!r.isPrimary && (
                  <Button variant="ghost" size="sm" onClick={() => setPrimaryMutation.mutate(r.id)} className="text-white/60 text-xs" data-testid={`button-set-primary-${r.id}`}>
                    Set Primary
                  </Button>
                )}
                <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(r.id)} className="text-red-400 h-8 w-8" data-testid={`button-delete-resume-${r.id}`}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SkillsTab() {
  const { toast } = useToast();
  const { data: taxonomy } = useQuery<TaxonomyCategory[]>({ queryKey: ["/api/workforce/skill-taxonomy"] });
  const { data: mySkills, isLoading } = useQuery<SkillRecord[]>({ queryKey: ["/api/workforce/applicant-skills"] });

  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedSubcategory, setSelectedSubcategory] = useState("");
  const [selectedSkillId, setSelectedSkillId] = useState("");
  const [level, setLevel] = useState("INTERMEDIATE");
  const [yearsUsed, setYearsUsed] = useState("");

  const addMutation = useMutation({
    mutationFn: async () => apiRequest("POST", "/api/workforce/applicant-skills", {
      skillId: selectedSkillId, level, yearsUsed: yearsUsed ? parseInt(yearsUsed) : null,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workforce/applicant-skills"] });
      toast({ title: "Skill added" });
      setSelectedSkillId("");
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const toggleTopMutation = useMutation({
    mutationFn: async ({ id, isTopSkill }: { id: string; isTopSkill: boolean }) =>
      apiRequest("PATCH", `/api/workforce/applicant-skills/${id}`, { isTopSkill }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/workforce/applicant-skills"] }),
  });

  const removeMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/workforce/applicant-skills/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workforce/applicant-skills"] });
      toast({ title: "Skill removed" });
    },
  });

  const selectedCat = taxonomy?.find((c) => c.id === selectedCategory);
  const selectedSub = selectedCat?.subcategories?.find((s) => s.id === selectedSubcategory);

  if (isLoading) return <Skeleton className="h-40 bg-white/10 rounded-xl" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 p-2 rounded-lg bg-purple-500/10 border border-purple-500/20">
        <Sparkles className="h-4 w-4 text-purple-400" />
        <span className="text-xs text-purple-300">Charlotte AI can suggest skills based on your experience</span>
      </div>

      <div className="rounded-xl bg-white/5 border border-white/10 p-4 space-y-3">
        <h3 className="text-sm font-medium text-white/70">Add Skill (L1 → L2 → L3)</h3>
        <div className="grid grid-cols-3 gap-2">
          <Select value={selectedCategory} onValueChange={(v) => { setSelectedCategory(v); setSelectedSubcategory(""); setSelectedSkillId(""); }}>
            <SelectTrigger className="bg-white/5 border-white/10 text-white text-xs" data-testid="select-skill-category">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              {(taxonomy || []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={selectedSubcategory} onValueChange={(v) => { setSelectedSubcategory(v); setSelectedSkillId(""); }} disabled={!selectedCategory}>
            <SelectTrigger className="bg-white/5 border-white/10 text-white text-xs" data-testid="select-skill-subcategory">
              <SelectValue placeholder="Subcategory" />
            </SelectTrigger>
            <SelectContent>
              {(selectedCat?.subcategories || []).map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={selectedSkillId} onValueChange={setSelectedSkillId} disabled={!selectedSubcategory}>
            <SelectTrigger className="bg-white/5 border-white/10 text-white text-xs" data-testid="select-skill">
              <SelectValue placeholder="Skill" />
            </SelectTrigger>
            <SelectContent>
              {(selectedSub?.skills || []).map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Select value={level} onValueChange={setLevel}>
            <SelectTrigger className="bg-white/5 border-white/10 text-white text-xs" data-testid="select-skill-level">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="BEGINNER">Beginner</SelectItem>
              <SelectItem value="INTERMEDIATE">Intermediate</SelectItem>
              <SelectItem value="ADVANCED">Advanced</SelectItem>
              <SelectItem value="EXPERT">Expert</SelectItem>
            </SelectContent>
          </Select>
          <Input type="number" value={yearsUsed} onChange={(e) => setYearsUsed(e.target.value)} placeholder="Years"
            className="bg-white/5 border-white/10 text-white text-xs" data-testid="input-skill-years" />
          <Button onClick={() => addMutation.mutate()} disabled={!selectedSkillId || addMutation.isPending} size="sm" data-testid="button-add-skill">
            <Plus className="h-3.5 w-3.5 mr-1" /> Add
          </Button>
        </div>
      </div>

      {(!mySkills || mySkills.length === 0) ? (
        <p className="text-white/40 text-sm text-center py-4">No skills added yet. Use the taxonomy browser above to add skills.</p>
      ) : (
        <div className="space-y-2">
          {mySkills!.map((s) => (
            <div key={s.id} className="flex items-center justify-between rounded-lg bg-white/5 border border-white/10 p-3" data-testid={`card-skill-${s.id}`}>
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <button onClick={() => toggleTopMutation.mutate({ id: s.id, isTopSkill: !s.isTopSkill })}
                  className={`shrink-0 ${s.isTopSkill ? "text-yellow-400" : "text-white/20"}`} data-testid={`button-toggle-top-${s.id}`}>
                  <Star className="h-4 w-4" fill={s.isTopSkill ? "currentColor" : "none"} />
                </button>
                <div className="min-w-0">
                  <span className="text-sm text-white font-medium">{s.skillName}</span>
                  <span className="text-xs text-white/40 ml-2">{s.categoryName} → {s.subcategoryName}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge className="bg-white/10 text-white/60 border-0 text-[10px]">{s.level}</Badge>
                {s.yearsUsed && <span className="text-xs text-white/40">{s.yearsUsed}yr</span>}
                <Button variant="ghost" size="icon" onClick={() => removeMutation.mutate(s.id)} className="text-red-400 h-7 w-7" data-testid={`button-remove-skill-${s.id}`}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface CredentialRecord {
  id: string;
  credentialName: string;
  credentialId: string | null;
  verificationStatus: string;
  issuedDate: string | null;
  expirationDate: string | null;
  jurisdiction: string | null;
  credentialNumber: string | null;
  documentUrl: string | null;
  isCustom: boolean;
  customName: string | null;
  customIssuingBody: string | null;
}

interface JurisdictionRecord {
  id: string;
  credentialRecordId: string;
  state: string;
  licenseNumber: string | null;
  status: string | null;
  issuedDate: string | null;
  expirationDate: string | null;
}

function CredentialCard({ credential, onDelete, getExpirationBadge }: { credential: CredentialRecord; onDelete: () => void; getExpirationBadge: (d: string | null) => JSX.Element | null }) {
  const { toast } = useToast();
  const [showJurisdictions, setShowJurisdictions] = useState(false);
  const [newState, setNewState] = useState("");
  const [newLicNum, setNewLicNum] = useState("");

  const { data: jurisdictions, isLoading: jLoading } = useQuery<JurisdictionRecord[]>({
    queryKey: ["/api/workforce/credential-jurisdictions", credential.id],
    queryFn: async () => {
      const r = await fetch(`/api/workforce/credential-jurisdictions/${credential.id}`);
      if (!r.ok) throw new Error("Failed to load jurisdictions");
      return r.json();
    },
    enabled: showJurisdictions,
  });

  const addJurisdictionMutation = useMutation({
    mutationFn: async () => apiRequest("POST", "/api/workforce/credential-jurisdictions", {
      credentialRecordId: credential.id,
      state: newState,
      licenseNumber: newLicNum || null,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workforce/credential-jurisdictions", credential.id] });
      toast({ title: "Jurisdiction added" });
      setNewState("");
      setNewLicNum("");
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const removeJurisdictionMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/workforce/credential-jurisdictions/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workforce/credential-jurisdictions", credential.id] });
      toast({ title: "Jurisdiction removed" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const c = credential;

  return (
    <div className="rounded-lg bg-white/5 border border-white/10 p-3" data-testid={`card-credential-${c.id}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-purple-400" />
          <span className="text-sm text-white font-medium">{c.credentialName}</span>
          {c.isCustom && <Badge className="bg-white/10 text-white/50 border-0 text-[10px]">Custom</Badge>}
          {getExpirationBadge(c.expirationDate)}
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setShowJurisdictions(!showJurisdictions)}
            className="text-xs text-purple-300 px-2 py-1 rounded hover:bg-white/5" data-testid={`button-toggle-jurisdictions-${c.id}`}>
            <MapPin className="h-3 w-3 inline mr-1" />{showJurisdictions ? "Hide" : "States"}
          </button>
          <Button variant="ghost" size="icon" onClick={onDelete} className="text-red-400 h-7 w-7" data-testid={`button-remove-cred-${c.id}`}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      <div className="flex items-center gap-3 mt-1 text-xs text-white/40">
        {c.jurisdiction && <span>Primary: {c.jurisdiction}</span>}
        {c.credentialNumber && <span>#{c.credentialNumber}</span>}
        {c.documentUrl && (
          <a href={c.documentUrl} target="_blank" rel="noopener noreferrer" className="text-purple-300 hover:text-purple-200 underline" data-testid={`link-cred-doc-${c.id}`}>
            <FileText className="h-3 w-3 inline mr-0.5" />Proof
          </a>
        )}
        <Badge className={`border-0 text-[10px] ${
          c.verificationStatus === "VERIFIED" ? "bg-green-500/20 text-green-300" :
          c.verificationStatus === "EXPIRED" ? "bg-red-500/20 text-red-300" :
          "bg-yellow-500/20 text-yellow-300"
        }`}>{c.verificationStatus}</Badge>
      </div>

      {showJurisdictions && (
        <div className="mt-2 pt-2 border-t border-white/10 space-y-2">
          <p className="text-xs text-white/50 font-medium">Additional Jurisdictions / States</p>
          {jLoading ? (
            <Skeleton className="h-8 bg-white/10 rounded" />
          ) : (
            <>
              {(!jurisdictions || jurisdictions.length === 0) && (
                <p className="text-xs text-white/30 italic" data-testid={`text-no-jurisdictions-${c.id}`}>No additional jurisdictions yet</p>
              )}
              {jurisdictions && jurisdictions.length > 0 && (
                <div className="space-y-1">
                  {jurisdictions.map((j) => (
                    <div key={j.id} className="flex items-center justify-between bg-white/5 rounded px-2 py-1" data-testid={`jurisdiction-${j.id}`}>
                      <div className="flex items-center gap-2 text-xs text-white/60">
                        <MapPin className="h-3 w-3" />
                        <span className="font-medium">{j.state}</span>
                        {j.licenseNumber && <span>#{j.licenseNumber}</span>}
                        {j.status && <Badge className="bg-white/10 text-white/50 border-0 text-[9px]">{j.status}</Badge>}
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => removeJurisdictionMutation.mutate(j.id)}
                        className="text-red-400 h-6 w-6" data-testid={`button-remove-jurisdiction-${j.id}`}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-2">
                <Input value={newState} onChange={(e) => setNewState(e.target.value)} placeholder="State (e.g. NC, SC)"
                  className="bg-white/5 border-white/10 text-white text-xs h-7 w-20" data-testid={`input-jurisdiction-state-${c.id}`} />
                <Input value={newLicNum} onChange={(e) => setNewLicNum(e.target.value)} placeholder="License #"
                  className="bg-white/5 border-white/10 text-white text-xs h-7 flex-1" data-testid={`input-jurisdiction-license-${c.id}`} />
                <Button onClick={() => addJurisdictionMutation.mutate()} disabled={!newState || addJurisdictionMutation.isPending}
                  size="sm" className="h-7 text-xs" data-testid={`button-add-jurisdiction-${c.id}`}>
                  <Plus className="h-3 w-3 mr-1" /> Add
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function CredentialsTab() {
  const { toast } = useToast();
  const { data: directory } = useQuery<CredentialDirectoryEntry[]>({ queryKey: ["/api/workforce/credential-directory"] });
  const { data: myCredentials, isLoading } = useQuery<CredentialRecord[]>({ queryKey: ["/api/workforce/applicant-credentials"] });

  const [searchQ, setSearchQ] = useState("");
  const [selectedCredId, setSelectedCredId] = useState("");
  const [isCustom, setIsCustom] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customIssuing, setCustomIssuing] = useState("");
  const [credNumber, setCredNumber] = useState("");
  const [jurisdiction, setJurisdiction] = useState("");
  const [issuedDate, setIssuedDate] = useState("");
  const [expirationDate, setExpirationDate] = useState("");
  const [documentUrl, setDocumentUrl] = useState("");
  const [credUploading, setCredUploading] = useState(false);

  const handleCredProofUpload = async (file: File) => {
    setCredUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const uploadRes = await fetch("/api/upload", { method: "POST", body: formData });
      if (!uploadRes.ok) throw new Error("Upload failed");
      const { url } = await uploadRes.json();
      setDocumentUrl(url);
      toast({ title: "Proof document uploaded" });
    } catch (e) {
      toast({ title: "Upload failed", description: e instanceof Error ? e.message : "Error", variant: "destructive" });
    } finally {
      setCredUploading(false);
    }
  };

  const addMutation = useMutation({
    mutationFn: async () => apiRequest("POST", "/api/workforce/applicant-credentials", {
      credentialId: isCustom ? null : selectedCredId,
      isCustom,
      customName: isCustom ? customName : null,
      customIssuingBody: isCustom ? customIssuing : null,
      credentialNumber: credNumber || null,
      jurisdiction: jurisdiction || null,
      issuedDate: issuedDate || null,
      expirationDate: expirationDate || null,
      documentUrl: documentUrl || null,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workforce/applicant-credentials"] });
      toast({ title: "Credential added" });
      setSelectedCredId(""); setCustomName(""); setCustomIssuing(""); setCredNumber(""); setJurisdiction(""); setIssuedDate(""); setExpirationDate(""); setDocumentUrl("");
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/workforce/applicant-credentials/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workforce/applicant-credentials"] });
      toast({ title: "Credential removed" });
    },
  });

  const filteredDir = (directory || []).filter((d) =>
    !searchQ || d.name.toLowerCase().includes(searchQ.toLowerCase()) || (d.category || "").toLowerCase().includes(searchQ.toLowerCase())
  );

  function getExpirationBadge(expDate: string | null) {
    if (!expDate) return null;
    const exp = new Date(expDate);
    const now = new Date();
    const daysUntil = Math.floor((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (daysUntil < 0) return <Badge className="bg-red-500/20 text-red-300 border-0 text-[10px]">Expired</Badge>;
    if (daysUntil < 30) return <Badge className="bg-yellow-500/20 text-yellow-300 border-0 text-[10px]">Expires Soon</Badge>;
    return <Badge className="bg-green-500/20 text-green-300 border-0 text-[10px]">Active</Badge>;
  }

  if (isLoading) return <Skeleton className="h-40 bg-white/10 rounded-xl" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 p-2 rounded-lg bg-purple-500/10 border border-purple-500/20">
        <Sparkles className="h-4 w-4 text-purple-400" />
        <span className="text-xs text-purple-300">Charlotte AI can recommend credentials for your career goals</span>
      </div>

      <div className="rounded-xl bg-white/5 border border-white/10 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-white/70">Add Credential</h3>
          <button onClick={() => setIsCustom(!isCustom)} className="text-xs text-purple-300" data-testid="button-toggle-custom-cred">
            {isCustom ? "Search Directory" : "Custom Entry"}
          </button>
        </div>

        {isCustom ? (
          <div className="space-y-2">
            <Input value={customName} onChange={(e) => setCustomName(e.target.value)} placeholder="Credential name"
              className="bg-white/5 border-white/10 text-white" data-testid="input-custom-cred-name" />
            <Input value={customIssuing} onChange={(e) => setCustomIssuing(e.target.value)} placeholder="Issuing organization"
              className="bg-white/5 border-white/10 text-white" data-testid="input-custom-cred-issuer" />
          </div>
        ) : (
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/40" />
              <Input value={searchQ} onChange={(e) => setSearchQ(e.target.value)} placeholder="Search credentials..."
                className="pl-9 bg-white/5 border-white/10 text-white text-sm" data-testid="input-search-credentials" />
            </div>
            <Select value={selectedCredId} onValueChange={setSelectedCredId}>
              <SelectTrigger className="bg-white/5 border-white/10 text-white text-xs" data-testid="select-credential">
                <SelectValue placeholder="Select from directory" />
              </SelectTrigger>
              <SelectContent>
                {filteredDir.slice(0, 20).map((d) => (
                  <SelectItem key={d.id} value={d.id}>{d.name} {d.issuingBody ? `(${d.issuingBody})` : ""}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <Input value={credNumber} onChange={(e) => setCredNumber(e.target.value)} placeholder="Credential #"
            className="bg-white/5 border-white/10 text-white text-sm" data-testid="input-cred-number" />
          <Input value={jurisdiction} onChange={(e) => setJurisdiction(e.target.value)} placeholder="Jurisdiction (e.g. NC)"
            className="bg-white/5 border-white/10 text-white text-sm" data-testid="input-cred-jurisdiction" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-white/50">Issue Date</label>
            <Input type="date" value={issuedDate} onChange={(e) => setIssuedDate(e.target.value)}
              className="bg-white/5 border-white/10 text-white text-sm" data-testid="input-cred-issued" />
          </div>
          <div>
            <label className="text-xs text-white/50">Expiration Date</label>
            <Input type="date" value={expirationDate} onChange={(e) => setExpirationDate(e.target.value)}
              className="bg-white/5 border-white/10 text-white text-sm" data-testid="input-cred-expiration" />
          </div>
        </div>
        <div>
          <label className="text-xs text-white/50">Proof Document</label>
          <div className="flex items-center gap-2">
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
              onChange={(e) => { if (e.target.files?.[0]) handleCredProofUpload(e.target.files[0]); }}
              className="text-xs text-white/60 file:mr-2 file:rounded file:border-0 file:bg-purple-600 file:px-2 file:py-1 file:text-xs file:text-white hover:file:bg-purple-500"
              data-testid="input-cred-document-file"
              disabled={credUploading}
            />
            {credUploading && <Loader2 className="h-3.5 w-3.5 animate-spin text-purple-400" />}
            {documentUrl && <Badge className="bg-green-500/20 text-green-300 border-0 text-[9px]">Uploaded</Badge>}
          </div>
        </div>
        <Button onClick={() => addMutation.mutate()} disabled={(!isCustom && !selectedCredId) || (isCustom && !customName) || addMutation.isPending}
          size="sm" data-testid="button-add-credential">
          <Plus className="h-3.5 w-3.5 mr-1" /> Add Credential
        </Button>
      </div>

      {(!myCredentials || myCredentials.length === 0) ? (
        <p className="text-white/40 text-sm text-center py-4">No credentials added yet</p>
      ) : (
        <div className="space-y-2">
          {myCredentials!.map((c: CredentialRecord) => (
            <CredentialCard key={c.id} credential={c} onDelete={() => deleteMutation.mutate(c.id)} getExpirationBadge={getExpirationBadge} />
          ))}
        </div>
      )}
    </div>
  );
}

function PreferencesTab() {
  const { toast } = useToast();
  const { data: profile, isLoading } = useQuery<ApplicantProfile | null>({
    queryKey: ["/api/workforce/applicant-profile"],
    queryFn: async () => {
      const r = await fetch("/api/workforce/applicant-profile");
      if (r.status === 404) return null;
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
  });

  const [remotePreference, setRemotePreference] = useState("NO_PREFERENCE");
  const [desiredPayMin, setDesiredPayMin] = useState("");
  const [desiredPayMax, setDesiredPayMax] = useState("");
  const [desiredPayUnit, setDesiredPayUnit] = useState("HOURLY");
  const [shiftPrefs, setShiftPrefs] = useState("");
  const [daysAvail, setDaysAvail] = useState("");
  const [desiredIndustries, setDesiredIndustries] = useState("");
  const [willingToRelocate, setWillingToRelocate] = useState(false);

  useEffect(() => {
    if (profile) {
      setRemotePreference(profile.remotePreference || "NO_PREFERENCE");
      setDesiredPayMin(String(profile.desiredPayMin || ""));
      setDesiredPayMax(String(profile.desiredPayMax || ""));
      setDesiredPayUnit(profile.desiredPayUnit || "HOURLY");
      setShiftPrefs((profile.shiftPreferences || []).join(", "));
      setDaysAvail((profile.daysAvailable || []).join(", "));
      setDesiredIndustries((profile.desiredIndustries || []).join(", "));
      setWillingToRelocate(profile.willingToRelocate || false);
    }
  }, [profile]);

  const saveMutation = useMutation({
    mutationFn: async () => apiRequest("PATCH", "/api/workforce/applicant-profile", {
      remotePreference,
      desiredPayMin: desiredPayMin ? parseInt(desiredPayMin) : null,
      desiredPayMax: desiredPayMax ? parseInt(desiredPayMax) : null,
      desiredPayUnit,
      shiftPreferences: shiftPrefs.split(",").map(s => s.trim()).filter(Boolean),
      daysAvailable: daysAvail.split(",").map(s => s.trim()).filter(Boolean),
      desiredIndustries: desiredIndustries.split(",").map(s => s.trim()).filter(Boolean),
      willingToRelocate,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workforce/applicant-profile"] });
      toast({ title: "Preferences saved" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  if (isLoading) return <Skeleton className="h-40 bg-white/10 rounded-xl" />;
  if (!profile) return <p className="text-white/40 text-sm text-center py-8">Create your profile first</p>;

  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium text-white/70 mb-1 block">Work Location Preference</label>
        <Select value={remotePreference} onValueChange={setRemotePreference}>
          <SelectTrigger className="bg-white/5 border-white/10 text-white" data-testid="select-remote-pref">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ONSITE">On-site</SelectItem>
            <SelectItem value="REMOTE">Remote</SelectItem>
            <SelectItem value="HYBRID">Hybrid</SelectItem>
            <SelectItem value="NO_PREFERENCE">No Preference</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="text-sm font-medium text-white/70 mb-1 block">Pay Min</label>
          <Input type="number" value={desiredPayMin} onChange={(e) => setDesiredPayMin(e.target.value)} placeholder="15"
            className="bg-white/5 border-white/10 text-white" data-testid="input-pay-min" />
        </div>
        <div>
          <label className="text-sm font-medium text-white/70 mb-1 block">Pay Max</label>
          <Input type="number" value={desiredPayMax} onChange={(e) => setDesiredPayMax(e.target.value)} placeholder="30"
            className="bg-white/5 border-white/10 text-white" data-testid="input-pay-max" />
        </div>
        <div>
          <label className="text-sm font-medium text-white/70 mb-1 block">Pay Unit</label>
          <Select value={desiredPayUnit} onValueChange={setDesiredPayUnit}>
            <SelectTrigger className="bg-white/5 border-white/10 text-white" data-testid="select-pay-unit">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="HOURLY">Hourly</SelectItem>
              <SelectItem value="WEEKLY">Weekly</SelectItem>
              <SelectItem value="MONTHLY">Monthly</SelectItem>
              <SelectItem value="ANNUALLY">Annually</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div>
        <label className="text-sm font-medium text-white/70 mb-1 block">Shift Preferences (comma-separated)</label>
        <Input value={shiftPrefs} onChange={(e) => setShiftPrefs(e.target.value)} placeholder="Day, Evening, Night, Weekends"
          className="bg-white/5 border-white/10 text-white" data-testid="input-shift-prefs" />
      </div>
      <div>
        <label className="text-sm font-medium text-white/70 mb-1 block">Days Available (comma-separated)</label>
        <Input value={daysAvail} onChange={(e) => setDaysAvail(e.target.value)} placeholder="Monday, Tuesday, Wednesday"
          className="bg-white/5 border-white/10 text-white" data-testid="input-days-available" />
      </div>
      <div>
        <label className="text-sm font-medium text-white/70 mb-1 block">Preferred Industries (comma-separated)</label>
        <Input value={desiredIndustries} onChange={(e) => setDesiredIndustries(e.target.value)} placeholder="Healthcare, Technology, Finance"
          className="bg-white/5 border-white/10 text-white" data-testid="input-desired-industries" />
      </div>
      <div className="flex items-center gap-3 rounded-lg bg-white/5 border border-white/10 p-3">
        <input type="checkbox" checked={willingToRelocate} onChange={(e) => setWillingToRelocate(e.target.checked)}
          className="h-4 w-4 rounded border-white/20" data-testid="checkbox-willing-relocate" />
        <label className="text-sm text-white/70">Willing to relocate</label>
      </div>
      <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="w-full" data-testid="button-save-preferences">
        {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
        Save Preferences
      </Button>
    </div>
  );
}

function ApplicationsTab() {
  const { data: applications, isLoading } = useQuery<ApplicationRecord[]>({
    queryKey: ["/api/workforce/my-applications"],
  });

  if (isLoading) return <Skeleton className="h-40 bg-white/10 rounded-xl" />;

  return (
    <div className="space-y-4">
      <p className="text-white/50 text-sm">Track your job applications here.</p>
      {(!applications || applications.length === 0) ? (
        <Card className="bg-white/10 border-white/10">
          <CardContent className="p-8 text-center">
            <Briefcase className="mx-auto h-10 w-10 text-white/20 mb-3" />
            <p className="text-white/40 text-sm">No applications yet. Browse jobs to start applying!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {applications!.map((app: ApplicationRecord) => (
            <div key={app.id} className="rounded-lg bg-white/5 border border-white/10 p-3" data-testid={`card-my-app-${app.id}`}>
              <div className="flex items-center justify-between">
                <span className="text-sm text-white">{app.jobListingId}</span>
                <Badge className="bg-white/10 text-white/60 border-0 text-[10px]">{app.status}</Badge>
              </div>
              <p className="text-xs text-white/40 mt-1">Applied {new Date(app.appliedAt).toLocaleDateString()}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface UserPayment {
  id: string;
  date: string;
  type: string;
  amount: number;
  status: string;
  tier: string | null;
  notes: string | null;
}

interface UserEntitlement {
  id: string;
  productType: string;
  status: string;
  startAt: string | null;
  endAt: string | null;
  metadata: Record<string, string> | null;
}

function formatCentsUser(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDateUser(dateStr: string | null): string {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function PaymentsTab() {
  const { data, isLoading } = useQuery<{ payments: UserPayment[]; entitlements: UserEntitlement[] }>({
    queryKey: ["/api/public-user/payments"],
  });

  const productLabels: Record<string, string> = {
    LISTING_TIER: "Listing Tier",
    FEATURED_PLACEMENT: "Featured Placement",
    SPONSORSHIP: "Sponsorship",
    SPOTLIGHT: "Spotlight",
    CONTRIBUTOR_PACKAGE: "Contributor Package",
    VERIFIED_CONTRIBUTOR: "Verified Contributor",
    PREMIUM_PROFILE: "Premium Profile",
  };

  const entitlementStatusLabels: Record<string, string> = {
    ACTIVE: "Active",
    EXPIRED: "Expired",
    CANCELED: "Canceled",
    GRACE: "Grace Period",
  };

  const statusColors: Record<string, string> = {
    completed: "bg-green-500/20 text-green-300 border-0",
    pending: "bg-yellow-500/20 text-yellow-300 border-0",
    failed: "bg-red-500/20 text-red-300 border-0",
    refunded: "bg-white/10 text-white/60 border-0",
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-16 w-full bg-white/5" />
        <Skeleton className="h-12 w-full bg-white/5" />
        <Skeleton className="h-12 w-full bg-white/5" />
      </div>
    );
  }

  const payments = data?.payments || [];
  const entitlements = data?.entitlements || [];

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-4" data-testid="text-payments-title">
          <DollarSign className="h-5 w-5 text-purple-400" />
          Payment History
        </h3>
        {payments.length === 0 ? (
          <Card className="bg-white/5 border-white/10">
            <CardContent className="py-8 text-center">
              <Receipt className="mx-auto h-10 w-10 text-white/20 mb-3" />
              <p className="text-white/40 text-sm">No payments recorded yet</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {payments.map(p => (
              <Card key={p.id} className="bg-white/5 border-white/10" data-testid={`row-payment-${p.id}`}>
                <CardContent className="py-3 px-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-white">{p.type}</p>
                    <p className="text-xs text-white/40 mt-0.5">{formatDateUser(p.date)}</p>
                    {p.tier && <Badge className="bg-purple-500/20 text-purple-300 border-0 text-[10px] mt-1">{p.tier}</Badge>}
                  </div>
                  <div className="text-right flex items-center gap-3">
                    <p className="text-sm font-semibold text-white" data-testid={`text-payment-amount-${p.id}`}>{formatCentsUser(p.amount)}</p>
                    <Badge className={statusColors[p.status] || "bg-white/10 text-white/60 border-0"} data-testid={`badge-payment-status-${p.id}`}>
                      {p.status}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {entitlements.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
            <Shield className="h-5 w-5 text-purple-400" />
            Active Entitlements
          </h3>
          <div className="space-y-2">
            {entitlements.map(e => (
              <Card key={e.id} className="bg-white/5 border-white/10" data-testid={`row-entitlement-${e.id}`}>
                <CardContent className="py-3 px-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-white">{productLabels[e.productType] || e.productType}</p>
                    <p className="text-xs text-white/40 mt-0.5">
                      {formatDateUser(e.startAt)} - {e.endAt ? formatDateUser(e.endAt) : "Ongoing"}
                    </p>
                  </div>
                  <Badge className={e.status === "ACTIVE" ? "bg-green-500/20 text-green-300 border-0" : "bg-white/10 text-white/60 border-0"} data-testid={`badge-entitlement-status-${e.id}`}>
                    {entitlementStatusLabels[e.status] || e.status}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const TABS: { key: TabKey; label: string; icon: LucideIcon }[] = [
  { key: "profile", label: "Profile", icon: User },
  { key: "resumes", label: "Resumes", icon: FileText },
  { key: "skills", label: "Skills", icon: Award },
  { key: "credentials", label: "Credentials", icon: Shield },
  { key: "preferences", label: "Preferences", icon: Settings },
  { key: "applications", label: "Applications", icon: Briefcase },
  { key: "payments", label: "Payments", icon: Receipt },
];

export default function ApplicantDashboard({ citySlug }: { citySlug: string }) {
  usePageMeta({
    title: "Workforce Profile — CLT Metro Hub",
    description: "Manage your workforce profile, skills, credentials, and job preferences.",
  });

  const { isLoggedIn } = useAuth();
  const [activeTab, setActiveTab] = useState<TabKey>("profile");

  if (!isLoggedIn) {
    return (
      <DarkPageShell fillHeight>
        <div className="text-center py-16">
          <User className="mx-auto h-12 w-12 text-white/20 mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Workforce Profile</h2>
          <p className="text-white/50 text-sm mb-4">Sign in to manage your workforce profile</p>
        </div>
      </DarkPageShell>
    );
  }

  return (
    <DarkPageShell fillHeight maxWidth="wide">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 text-white" data-testid="text-applicant-dashboard-title">
            <User className="h-6 w-6 text-purple-400" />
            Workforce Profile
          </h1>
          <p className="text-white/50 text-sm mt-1">Manage your profile, skills, and credentials</p>
        </div>

        <div className="flex items-center gap-1 overflow-x-auto pb-1">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                activeTab === tab.key
                  ? "bg-purple-500/20 text-purple-300"
                  : "text-white/50 hover:text-white/70 hover:bg-white/5"
              }`}
              data-testid={`tab-${tab.key}`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </div>

        <div>
          {activeTab === "profile" && <ProfileTab citySlug={citySlug} />}
          {activeTab === "resumes" && <ResumesTab />}
          {activeTab === "skills" && <SkillsTab />}
          {activeTab === "credentials" && <CredentialsTab />}
          {activeTab === "preferences" && <PreferencesTab />}
          {activeTab === "applications" && <ApplicationsTab />}
          {activeTab === "payments" && <PaymentsTab />}
        </div>
      </div>
    </DarkPageShell>
  );
}
