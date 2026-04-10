import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { X, Send, Calendar, Store, Newspaper, Sparkles, Camera, ImageIcon, Upload, Video, ArrowUpCircle, Shield } from "lucide-react";
import { SiTiktok } from "react-icons/si";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { isTikTokUrl, parseTikTokUrl } from "@/lib/tiktok";
import type { PostingPermissions } from "@shared/schema";
import { useI18n, type TranslationKey } from "@/lib/i18n";

interface FeedSubmitProps {
  citySlug: string;
  cityId: string;
  onClose: () => void;
}

const POST_TYPE_KEYS: readonly { key: string; labelKey: TranslationKey; icon: typeof Camera; descKey: TranslationKey }[] = [
  { key: "photo", labelKey: "feedSubmit.photoPost", icon: Camera, descKey: "feedSubmit.photoDesc" },
  { key: "event_tip", labelKey: "feedSubmit.eventTip", icon: Calendar, descKey: "feedSubmit.eventDesc" },
  { key: "business_update", labelKey: "feedSubmit.businessShoutout", icon: Store, descKey: "feedSubmit.businessDesc" },
  { key: "post", labelKey: "feedSubmit.generalUpdate", icon: Sparkles, descKey: "feedSubmit.generalDesc" },
];

type PostType = typeof POST_TYPE_KEYS[number]["key"];

export function FeedSubmit({ citySlug, cityId, onClose }: FeedSubmitProps) {
  const { toast } = useToast();
  const { t } = useI18n();
  const [step, setStep] = useState<"type" | "form">("type");
  const [selectedType, setSelectedType] = useState<PostType | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [postAsBusinessId, setPostAsBusinessId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    body: "",
    coverImageUrl: "",
    videoUrl: "",
  });
  const [tiktokPreview, setTiktokPreview] = useState<{ embedUrl: string; videoId: string } | null>(null);

  const { data: permsData } = useQuery<{ user: PostingPermissions; businesses: (PostingPermissions & { businessId: string; name: string; handle: string | null })[] }>({
    queryKey: ["/api/auth/my-permissions"],
  });

  const activePerms = postAsBusinessId
    ? permsData?.businesses?.find(b => b.businessId === postAsBusinessId) || permsData?.user
    : permsData?.user;

  const uploadImage = async (file: File) => {
    setIsUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const resp = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await resp.json();
      if (data.url) {
        setFormData(p => ({ ...p, coverImageUrl: data.url }));
        setImagePreview(data.url);
      }
    } catch {
      toast({ title: t("feedSubmit.uploadFailed"), description: t("feedSubmit.tryAgainLater"), variant: "destructive" });
    }
    setIsUploading(false);
  };

  const submitMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/moderation/submit-post", {
        title: formData.title,
        body: formData.body || undefined,
        coverImageUrl: formData.coverImageUrl || undefined,
        videoUrl: formData.videoUrl || undefined,
        postType: selectedType,
        cityId,
        postAsBusinessId: postAsBusinessId || undefined,
      });
    },
    onSuccess: (res: any) => {
      const isAutoApproved = activePerms && !activePerms.requiresModeration;
      toast({
        title: isAutoApproved ? t("feedSubmit.published") : t("feedSubmit.submittedForReview"),
        description: isAutoApproved
          ? t("feedSubmit.postLive")
          : t("feedSubmit.postReviewed"),
      });
      queryClient.invalidateQueries({ queryKey: ["/api/feed"] });
      onClose();
    },
    onError: (err: any) => {
      const message = err?.message?.includes("Login") ? t("feedSubmit.signInToSubmit") : t("feedSubmit.tryAgainLater");
      toast({ title: t("feedSubmit.submissionFailed"), description: message, variant: "destructive" });
    },
  });

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/80" onClick={onClose} />
      <div className="fixed inset-x-0 bottom-0 z-[60] max-h-[85vh] overflow-y-auto rounded-t-3xl bg-gray-950 border-t border-white/10 pb-[env(safe-area-inset-bottom,16px)] md:inset-x-auto md:inset-y-8 md:left-1/2 md:-translate-x-1/2 md:w-full md:max-w-md md:rounded-2xl md:border md:pb-0" data-testid="feed-submit-modal">
        <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 bg-gray-950 border-b border-white/5">
          <h3 className="text-sm font-bold text-white">{t("feedSubmit.createPost")}</h3>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-white/60 hover:text-white hover:bg-white/10 transition-colors"
            data-testid="feed-submit-close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-4">
          {permsData && permsData.businesses && permsData.businesses.length > 0 && step === "type" && (
            <div className="mb-4 space-y-2">
              <p className="text-xs text-white/60">{t("feedSubmit.postAs")}</p>
              <div className="flex flex-wrap gap-2">
                <button
                  className={`rounded-full px-3 py-1.5 text-xs font-medium border transition-colors ${!postAsBusinessId ? "border-purple-500 bg-purple-500/20 text-purple-300" : "border-white/10 text-white/60 hover:border-white/20"}`}
                  onClick={() => setPostAsBusinessId(null)}
                  data-testid="post-as-self"
                >
                  {t("feedSubmit.yourself")}
                </button>
                {permsData.businesses.map(b => (
                  <button
                    key={b.businessId}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium border transition-colors ${postAsBusinessId === b.businessId ? "border-purple-500 bg-purple-500/20 text-purple-300" : "border-white/10 text-white/60 hover:border-white/20"}`}
                    onClick={() => setPostAsBusinessId(b.businessId)}
                    data-testid={`post-as-business-${b.businessId}`}
                  >
                    <Store className="inline h-3 w-3 mr-1" />
                    {b.handle ? `@${b.handle}` : b.name}
                  </button>
                ))}
              </div>
            </div>
          )}
          {activePerms && (
            <div className="mb-3 flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2">
              <Shield className="h-3.5 w-3.5 text-purple-400 shrink-0" />
              <span className="text-xs text-white/60">
                {activePerms.requiresModeration
                  ? t("feedSubmit.modReview")
                  : t("feedSubmit.goLive")}
              </span>
            </div>
          )}
          {step === "type" && (
            <div className="space-y-2">
              <p className="text-xs text-white/60 mb-3">{t("feedSubmit.whatKind")}</p>
              {POST_TYPE_KEYS.map((pt) => {
                const Icon = pt.icon;
                return (
                  <button
                    key={pt.key}
                    className="w-full flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-left hover:bg-white/10 hover:border-purple-500/30 transition-all"
                    onClick={() => {
                      setSelectedType(pt.key);
                      setStep("form");
                    }}
                    data-testid={`submit-type-${pt.key}`}
                  >
                    <div className="rounded-lg bg-purple-600/20 p-2">
                      <Icon className="h-5 w-5 text-purple-400" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-white">{t(pt.labelKey)}</div>
                      <div className="text-[10px] text-white/50">{t(pt.descKey)}</div>
                    </div>
                  </button>
                );
              })}
              <p className="text-[10px] text-white/40 mt-3 text-center">
                {t("feedSubmit.allReviewed")}
              </p>
            </div>
          )}

          {step === "form" && selectedType && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                submitMutation.mutate();
              }}
              className="space-y-3"
            >
              <button
                type="button"
                className="text-xs text-purple-400 hover:text-purple-300 mb-1"
                onClick={() => setStep("type")}
                data-testid="button-change-type"
              >
                {t("feedSubmit.changeType")}
              </button>

              {imagePreview ? (
                <div className="relative">
                  <img
                    src={imagePreview}
                    alt="Upload preview"
                    className="w-full h-40 object-cover rounded-xl"
                    data-testid="img-upload-preview"
                  />
                  <button
                    type="button"
                    className="absolute top-2 right-2 rounded-full bg-black/60 p-1.5 text-white/80 hover:text-white"
                    onClick={() => { setImagePreview(null); setFormData(p => ({ ...p, coverImageUrl: "" })); }}
                    data-testid="button-remove-image"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <label
                  className="flex flex-col items-center justify-center gap-2 w-full h-32 rounded-xl border-2 border-dashed border-white/10 bg-white/5 cursor-pointer hover:bg-white/10 hover:border-purple-500/30 transition-all"
                  data-testid="label-upload-image"
                >
                  {isUploading ? (
                    <div className="text-purple-400 text-xs animate-pulse">{t("feedSubmit.uploading")}</div>
                  ) : (
                    <>
                      <Upload className="h-6 w-6 text-white/30" />
                      <span className="text-xs text-white/40">{t("feedSubmit.addPhoto")}</span>
                    </>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) uploadImage(file);
                    }}
                    data-testid="input-file-upload"
                  />
                </label>
              )}

              <div>
                <label className="text-xs font-medium text-white/70 mb-1 block">
                  {selectedType === "event_tip" ? t("feedSubmit.eventName") : selectedType === "business_update" ? t("feedSubmit.businessName") : t("feedSubmit.titleLabel")}
                </label>
                <Input
                  value={formData.title}
                  onChange={(e) => setFormData(p => ({ ...p, title: e.target.value }))}
                  required
                  placeholder={selectedType === "event_tip" ? "Art Walk in NoDa" : selectedType === "business_update" ? "Amazing coffee shop!" : "What's happening?"}
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
                  data-testid="submit-title"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-white/70 mb-1 block">
                  <span className="flex items-center gap-1.5">
                    <Video className="h-3 w-3" />
                    {t("feedSubmit.videoUrlLabel")}
                  </span>
                </label>
                <Input
                  value={formData.videoUrl}
                  onChange={(e) => {
                    const val = e.target.value;
                    setFormData(p => ({ ...p, videoUrl: val }));
                    if (isTikTokUrl(val)) {
                      const parsed = parseTikTokUrl(val);
                      setTiktokPreview(parsed);
                    } else {
                      setTiktokPreview(null);
                    }
                  }}
                  placeholder="https://www.tiktok.com/@user/video/..."
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
                  data-testid="submit-video-url"
                />
                {tiktokPreview && (
                  <div className="mt-2 rounded-xl border border-white/10 bg-white/5 p-3 flex items-center gap-2" data-testid="tiktok-preview">
                    <SiTiktok className="h-5 w-5 text-white/80 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-white/80 truncate">{t("feedSubmit.tiktokDetected")}</p>
                      <p className="text-[10px] text-white/40 truncate">{t("feedSubmit.autoEmbed")}</p>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="text-xs font-medium text-white/70 mb-1 block">{t("feedSubmit.details")}</label>
                <Textarea
                  value={formData.body}
                  onChange={(e) => setFormData(p => ({ ...p, body: e.target.value }))}
                  rows={3}
                  placeholder={t("feedSubmit.detailsPlaceholder")}
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/30 resize-none"
                  data-testid="submit-body"
                />
              </div>

              <Button
                type="submit"
                disabled={submitMutation.isPending || !formData.title.trim()}
                className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-semibold mt-2"
                data-testid="submit-btn"
              >
                <Send className="h-4 w-4 mr-2" />
                {submitMutation.isPending ? t("feedSubmit.submitting") : t("feedSubmit.submitForReview")}
              </Button>

              <p className="text-[10px] text-white/40 text-center">
                {t("feedSubmit.reviewedNote")}
              </p>
            </form>
          )}
        </div>
      </div>
    </>
  );
}
