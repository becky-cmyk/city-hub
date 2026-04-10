import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Skeleton } from "@/components/ui/skeleton";
import { PhotoUpload } from "@/components/photo-upload";
import {
  PenTool, Plus, Edit, Trash2, Globe, Mail, Phone,
  Eye, EyeOff
} from "lucide-react";
import { useState } from "react";
import type { Author } from "@shared/schema";
import { useDefaultCityId } from "@/hooks/use-city";

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function AuthorForm({ author, onClose }: { author?: Author; onClose: () => void }) {
  const CITY_ID = useDefaultCityId();
  const { toast } = useToast();
  const [name, setName] = useState(author?.name || "");
  const [penName, setPenName] = useState(author?.penName || "");
  const [slug, setSlug] = useState(author?.slug || "");
  const [bio, setBio] = useState(author?.bio || "");
  const [photoUrl, setPhotoUrl] = useState(author?.photoUrl || "");
  const [roleTitle, setRoleTitle] = useState(author?.roleTitle || "");
  const [email, setEmail] = useState(author?.email || "");
  const [phone, setPhone] = useState(author?.phone || "");
  const [websiteUrl, setWebsiteUrl] = useState(author?.websiteUrl || "");
  const [socialTwitter, setSocialTwitter] = useState(author?.socialTwitter || "");
  const [socialLinkedin, setSocialLinkedin] = useState(author?.socialLinkedin || "");
  const [socialInstagram, setSocialInstagram] = useState(author?.socialInstagram || "");
  const [socialYoutube, setSocialYoutube] = useState(author?.socialYoutube || "");
  const [socialTiktok, setSocialTiktok] = useState(author?.socialTiktok || "");
  const [showEmail, setShowEmail] = useState(author?.showEmail ?? false);
  const [showPhone, setShowPhone] = useState(author?.showPhone ?? false);
  const [showSocials, setShowSocials] = useState(author?.showSocials ?? true);
  const [showBio, setShowBio] = useState(author?.showBio ?? true);
  const [isActive, setIsActive] = useState(author?.isActive ?? true);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        cityId: CITY_ID,
        name,
        penName: penName || null,
        slug: slug || slugify(name),
        bio: bio || null,
        photoUrl: photoUrl || null,
        roleTitle: roleTitle || null,
        email: email || null,
        phone: phone || null,
        websiteUrl: websiteUrl || null,
        socialTwitter: socialTwitter || null,
        socialLinkedin: socialLinkedin || null,
        socialInstagram: socialInstagram || null,
        socialYoutube: socialYoutube || null,
        socialTiktok: socialTiktok || null,
        showEmail,
        showPhone,
        showSocials,
        showBio,
        isActive,
      };
      if (author) {
        return apiRequest("PATCH", `/api/admin/authors/${author.id}`, payload);
      }
      return apiRequest("POST", "/api/admin/authors", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/authors"] });
      toast({ title: author ? "Author updated" : "Author created" });
      onClose();
    },
    onError: () => {
      toast({ title: "Error saving author", variant: "destructive" });
    },
  });

  return (
    <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>{author ? "Edit Author" : "New Author"}</DialogTitle>
      </DialogHeader>
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label>Photo</Label>
          <PhotoUpload currentUrl={photoUrl} onUploaded={setPhotoUrl} shape="circle" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Full Name *</Label>
            <Input
              value={name}
              onChange={(e) => { setName(e.target.value); if (!author) setSlug(slugify(e.target.value)); }}
              placeholder="Legal / real name"
              data-testid="input-author-name"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Pen Name</Label>
            <Input
              value={penName}
              onChange={(e) => setPenName(e.target.value)}
              placeholder="Display name (optional)"
              data-testid="input-author-pen-name"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Slug</Label>
          <Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="auto-generated-from-name" data-testid="input-author-slug" />
        </div>
        <div className="space-y-1.5">
          <Label>Role / Title</Label>
          <Input value={roleTitle} onChange={(e) => setRoleTitle(e.target.value)} placeholder="e.g. Staff Writer, Contributing Editor" data-testid="input-author-role" />
        </div>
        <div className="space-y-1.5">
          <Label>Bio</Label>
          <Textarea value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Short biography..." rows={3} data-testid="input-author-bio" />
        </div>

        <div className="border-t pt-3 space-y-3">
          <h4 className="text-sm font-semibold">Contact Information</h4>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="author@example.com" data-testid="input-author-email" />
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 (555) 123-4567" data-testid="input-author-phone" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Website</Label>
            <Input value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} placeholder="https://..." data-testid="input-author-website" />
          </div>
        </div>

        <div className="border-t pt-3 space-y-3">
          <h4 className="text-sm font-semibold">Social Media</h4>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Twitter / X</Label>
              <Input value={socialTwitter} onChange={(e) => setSocialTwitter(e.target.value)} placeholder="@handle" data-testid="input-author-twitter" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Instagram</Label>
              <Input value={socialInstagram} onChange={(e) => setSocialInstagram(e.target.value)} placeholder="@handle" data-testid="input-author-instagram" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">LinkedIn</Label>
              <Input value={socialLinkedin} onChange={(e) => setSocialLinkedin(e.target.value)} placeholder="URL" data-testid="input-author-linkedin" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">YouTube</Label>
              <Input value={socialYoutube} onChange={(e) => setSocialYoutube(e.target.value)} placeholder="Channel URL" data-testid="input-author-youtube" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">TikTok</Label>
              <Input value={socialTiktok} onChange={(e) => setSocialTiktok(e.target.value)} placeholder="@handle" data-testid="input-author-tiktok" />
            </div>
          </div>
        </div>

        <div className="border-t pt-3 space-y-3">
          <h4 className="text-sm font-semibold flex items-center gap-1.5">
            <Eye className="h-3.5 w-3.5" /> Public Visibility
          </h4>
          <p className="text-xs text-muted-foreground">Choose what appears on the public author card. Internal info stays visible only to admins.</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2">
              <Switch checked={showBio} onCheckedChange={setShowBio} data-testid="switch-show-bio" />
              <Label className="text-xs">Show Bio</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={showEmail} onCheckedChange={setShowEmail} data-testid="switch-show-email" />
              <Label className="text-xs">Show Email</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={showPhone} onCheckedChange={setShowPhone} data-testid="switch-show-phone" />
              <Label className="text-xs">Show Phone</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={showSocials} onCheckedChange={setShowSocials} data-testid="switch-show-socials" />
              <Label className="text-xs">Show Socials</Label>
            </div>
          </div>
        </div>

        <div className="border-t pt-3 flex items-center gap-2">
          <Switch checked={isActive} onCheckedChange={setIsActive} data-testid="switch-author-active" />
          <Label>Active</Label>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => saveMutation.mutate()} disabled={!name || saveMutation.isPending} data-testid="button-save-author">
            {saveMutation.isPending ? "Saving..." : author ? "Update Author" : "Create Author"}
          </Button>
        </div>
      </div>
    </DialogContent>
  );
}

function AuthorContactCard({ author }: { author: Author }) {
  const displayName = author.penName || author.name;
  const socialLinks = [
    author.socialTwitter && { label: "Twitter", url: author.socialTwitter.startsWith("http") ? author.socialTwitter : `https://twitter.com/${author.socialTwitter.replace("@", "")}` },
    author.socialInstagram && { label: "Instagram", url: author.socialInstagram.startsWith("http") ? author.socialInstagram : `https://instagram.com/${author.socialInstagram.replace("@", "")}` },
    author.socialLinkedin && { label: "LinkedIn", url: author.socialLinkedin.startsWith("http") ? author.socialLinkedin : `https://linkedin.com/in/${author.socialLinkedin}` },
    author.socialYoutube && { label: "YouTube", url: author.socialYoutube.startsWith("http") ? author.socialYoutube : `https://youtube.com/${author.socialYoutube}` },
    author.socialTiktok && { label: "TikTok", url: author.socialTiktok.startsWith("http") ? author.socialTiktok : `https://tiktok.com/@${author.socialTiktok.replace("@", "")}` },
  ].filter(Boolean) as { label: string; url: string }[];

  return (
    <div className="flex items-start gap-4">
      {author.photoUrl ? (
        <img src={author.photoUrl} alt="" className="h-14 w-14 rounded-full object-cover shrink-0 border-2 border-primary/20" />
      ) : (
        <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <PenTool className="h-5 w-5 text-primary" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="font-semibold text-sm">{displayName}</h3>
          {author.penName && author.name !== author.penName && (
            <span className="text-[10px] text-muted-foreground italic">({author.name})</span>
          )}
          {!author.isActive && <Badge variant="secondary" className="text-[10px]">Inactive</Badge>}
        </div>
        <p className="text-xs text-muted-foreground">
          {author.roleTitle || "Author"}
        </p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-[11px] text-muted-foreground">
          {author.email && (
            <span className="flex items-center gap-0.5">
              <Mail className="h-3 w-3" /> {author.email}
              {author.showEmail ? (
                <Eye className="h-2.5 w-2.5 text-green-500 ml-0.5" />
              ) : (
                <EyeOff className="h-2.5 w-2.5 text-muted-foreground/50 ml-0.5" />
              )}
            </span>
          )}
          {author.phone && (
            <span className="flex items-center gap-0.5">
              <Phone className="h-3 w-3" /> {author.phone}
              {author.showPhone ? (
                <Eye className="h-2.5 w-2.5 text-green-500 ml-0.5" />
              ) : (
                <EyeOff className="h-2.5 w-2.5 text-muted-foreground/50 ml-0.5" />
              )}
            </span>
          )}
        </div>
        {socialLinks.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
            {socialLinks.map((s) => (
              <a key={s.label} href={s.url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-primary hover:underline">
                {s.label}
              </a>
            ))}
            {author.showSocials ? (
              <Eye className="h-2.5 w-2.5 text-green-500" />
            ) : (
              <EyeOff className="h-2.5 w-2.5 text-muted-foreground/50" />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function AuthorsPanel({ cityId }: { cityId?: string }) {
  const CITY_ID = useDefaultCityId();
  const { toast } = useToast();
  const [editingAuthor, setEditingAuthor] = useState<Author | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const { data: authorsList, isLoading } = useQuery<Author[]>({
    queryKey: ["/api/admin/authors", `?cityId=${CITY_ID}`],
    enabled: !!CITY_ID,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/admin/authors/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/authors"] });
      toast({ title: "Author deleted" });
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-lg" data-testid="text-authors-title">Authors</h2>
          <p className="text-sm text-muted-foreground">Manage content authors and contributors</p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="gap-1" data-testid="button-create-author">
          <Plus className="h-4 w-4" /> Add Author
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full rounded-md" />)}
        </div>
      ) : authorsList && authorsList.length > 0 ? (
        <div className="space-y-3">
          {authorsList.map((author) => (
            <Card key={author.id} className="p-4" data-testid={`card-author-${author.id}`}>
              <div className="flex items-start justify-between gap-3">
                <AuthorContactCard author={author} />
                <div className="flex items-center gap-1 shrink-0">
                  {author.websiteUrl && (
                    <a href={author.websiteUrl} target="_blank" rel="noopener noreferrer">
                      <Button size="icon" variant="ghost"><Globe className="h-3.5 w-3.5" /></Button>
                    </a>
                  )}
                  <Button size="icon" variant="ghost" onClick={() => setEditingAuthor(author)} data-testid={`button-edit-author-${author.id}`}>
                    <Edit className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => deleteMutation.mutate(author.id)} data-testid={`button-delete-author-${author.id}`}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="p-8 text-center">
          <PenTool className="mx-auto h-10 w-10 text-muted-foreground/40 mb-3" />
          <h3 className="font-semibold mb-1">No authors yet</h3>
          <p className="text-sm text-muted-foreground">Add your first author to assign bylines to articles</p>
        </Card>
      )}

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        {showCreate && <AuthorForm onClose={() => setShowCreate(false)} />}
      </Dialog>

      <Dialog open={!!editingAuthor} onOpenChange={(open) => !open && setEditingAuthor(null)}>
        {editingAuthor && <AuthorForm author={editingAuthor} onClose={() => setEditingAuthor(null)} />}
      </Dialog>
    </div>
  );
}
