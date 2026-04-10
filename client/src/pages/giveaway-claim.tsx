import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { usePageMeta } from "@/hooks/use-page-meta";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Gift, Trophy, Clock, CheckCircle2, XCircle, Loader2 } from "lucide-react";

interface ClaimData {
  status: string;
  claimDeadline: string | null;
  claimedAt: string | null;
  giveaway: { title: string; slug: string; heroImageUrl: string | null } | null;
  prize: { name: string; description: string | null; imageUrl: string | null; value: string | null } | null;
  winner: { name: string; email?: string; phone?: string };
}

export default function GiveawayClaim({ token }: { token: string }) {
  const { toast } = useToast();
  const [claimForm, setClaimForm] = useState({
    confirmEmail: "",
    confirmPhone: "",
    quote: "",
    reviewText: "",
    businessMention: "",
    socialHandle: "",
    photoUrl: "",
    allowPhoto: false,
    allowName: false,
    allowReview: false,
    allowSocialShare: false,
  });

  const { data, isLoading, error } = useQuery<ClaimData>({
    queryKey: ["/api/giveaways/claim", token],
    queryFn: async () => {
      const res = await fetch(`/api/giveaways/claim/${token}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Invalid claim link" }));
        throw new Error(err.message);
      }
      return res.json();
    },
    enabled: !!token,
  });

  const claimMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/giveaways/claim/${token}`, {
        confirmEmail: claimForm.confirmEmail,
        confirmPhone: claimForm.confirmPhone,
        quote: claimForm.quote || undefined,
        reviewText: claimForm.reviewText || undefined,
        businessMention: claimForm.businessMention || undefined,
        socialHandle: claimForm.socialHandle || undefined,
        photoUrl: claimForm.photoUrl || undefined,
        permissions: {
          allowPhoto: claimForm.allowPhoto,
          allowName: claimForm.allowName,
          allowReview: claimForm.allowReview,
          allowSocialShare: claimForm.allowSocialShare,
        },
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/giveaways/claim", token] });
      toast({ title: "Prize claimed!", description: "Congratulations! You'll receive further instructions soon." });
    },
    onError: (err: Error) => {
      toast({ title: "Claim failed", description: err.message, variant: "destructive" });
    },
  });

  usePageMeta({
    title: data?.giveaway ? `Claim Your Prize - ${data.giveaway.title} | CLT Metro Hub` : "Claim Prize | CLT Metro Hub",
    description: "Claim your giveaway prize",
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-[#F2C230]" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center">
        <XCircle className="h-16 w-16 mx-auto mb-4 text-red-400" />
        <h1 className="text-2xl font-bold text-white mb-2">Invalid Claim Link</h1>
        <p className="text-neutral-400">{(error as Error)?.message || "This claim link is not valid or has expired."}</p>
      </div>
    );
  }

  const formatDeadline = (d: string | null) => {
    if (!d) return null;
    return new Date(d).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
  };

  const isPending = data.status === "pending" || data.status === "notified";

  return (
    <div className="max-w-lg mx-auto px-4 py-12">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-[#F2C230] to-[#e5a820] mb-4">
          <Trophy className="h-10 w-10 text-[#1a1a2e]" />
        </div>
        <h1 className="text-2xl md:text-3xl font-bold text-white" data-testid="text-claim-title">
          {data.status === "claimed" ? "Prize Claimed!" : data.status === "expired" ? "Claim Expired" : "Claim Your Prize"}
        </h1>
        {data.giveaway && <p className="text-neutral-300 mt-1">{data.giveaway.title}</p>}
      </div>

      <Card className="bg-[#1e1e3a] border-[#2a2a4a] mb-6">
        <CardContent className="p-6">
          <p className="text-neutral-400 text-sm mb-1">Winner</p>
          <p className="text-white font-semibold text-lg mb-4" data-testid="text-winner-name">{data.winner.name}</p>

          {data.prize && (
            <div className="bg-[#141432] rounded-lg p-4 mb-4">
              {data.prize.imageUrl && (
                <img src={data.prize.imageUrl} alt={data.prize.name} className="w-full h-40 object-cover rounded-lg mb-3" />
              )}
              <div className="flex items-center gap-2 mb-1">
                <Gift className="h-4 w-4 text-[#F2C230]" />
                <span className="text-[#F2C230] text-sm font-semibold">Your Prize</span>
              </div>
              <h3 className="text-white font-semibold text-lg" data-testid="text-prize-name">{data.prize.name}</h3>
              {data.prize.description && <p className="text-neutral-400 text-sm mt-1">{data.prize.description}</p>}
              {data.prize.value && <p className="text-[#F2C230] text-sm font-semibold mt-2">Value: ${Number(data.prize.value).toLocaleString()}</p>}
            </div>
          )}

          {isPending && (
            <div className="space-y-5">
              {data.claimDeadline && (
                <div className="flex items-center gap-2 text-sm text-neutral-400">
                  <Clock className="h-4 w-4" />
                  <span>Claim by: {formatDeadline(data.claimDeadline)}</span>
                </div>
              )}

              <div className="space-y-4 border-t border-[#2a2a4a] pt-4">
                <p className="text-sm text-neutral-300 font-semibold">Confirm Your Contact Info</p>
                <div>
                  <Label className="text-neutral-400 text-sm">Email</Label>
                  <Input
                    value={claimForm.confirmEmail}
                    onChange={e => setClaimForm(p => ({ ...p, confirmEmail: e.target.value }))}
                    placeholder={data.winner.email || "your@email.com"}
                    className="bg-[#141432] border-[#2a2a4a] text-white"
                    data-testid="input-claim-email"
                  />
                </div>
                <div>
                  <Label className="text-neutral-400 text-sm">Phone</Label>
                  <Input
                    value={claimForm.confirmPhone}
                    onChange={e => setClaimForm(p => ({ ...p, confirmPhone: e.target.value }))}
                    placeholder={data.winner.phone || "(555) 123-4567"}
                    className="bg-[#141432] border-[#2a2a4a] text-white"
                    data-testid="input-claim-phone"
                  />
                </div>
              </div>

              <div className="space-y-4 border-t border-[#2a2a4a] pt-4">
                <p className="text-sm text-neutral-300 font-semibold">Share Your Experience (optional)</p>
                <div>
                  <Label className="text-neutral-400 text-sm">Winner Quote</Label>
                  <Textarea
                    value={claimForm.quote}
                    onChange={e => setClaimForm(p => ({ ...p, quote: e.target.value }))}
                    placeholder="How does it feel to win?"
                    rows={2}
                    className="bg-[#141432] border-[#2a2a4a] text-white resize-none"
                    data-testid="input-claim-quote"
                  />
                </div>
                <div>
                  <Label className="text-neutral-400 text-sm">Quick Review / Feedback</Label>
                  <Textarea
                    value={claimForm.reviewText}
                    onChange={e => setClaimForm(p => ({ ...p, reviewText: e.target.value }))}
                    placeholder="Tell us about the sponsor or prize..."
                    rows={2}
                    className="bg-[#141432] border-[#2a2a4a] text-white resize-none"
                    data-testid="input-claim-review"
                  />
                </div>
                <div>
                  <Label className="text-neutral-400 text-sm">Business / Sponsor Mention</Label>
                  <Input
                    value={claimForm.businessMention}
                    onChange={e => setClaimForm(p => ({ ...p, businessMention: e.target.value }))}
                    placeholder="Shoutout to..."
                    className="bg-[#141432] border-[#2a2a4a] text-white"
                    data-testid="input-claim-business"
                  />
                </div>
                <div>
                  <Label className="text-neutral-400 text-sm">Social Media Handle</Label>
                  <Input
                    value={claimForm.socialHandle}
                    onChange={e => setClaimForm(p => ({ ...p, socialHandle: e.target.value }))}
                    placeholder="@yourhandle"
                    className="bg-[#141432] border-[#2a2a4a] text-white"
                    data-testid="input-claim-social-handle"
                  />
                </div>
                <div>
                  <Label className="text-neutral-400 text-sm">Photo URL (link to your winner photo)</Label>
                  <Input
                    value={claimForm.photoUrl}
                    onChange={e => setClaimForm(p => ({ ...p, photoUrl: e.target.value }))}
                    placeholder="https://..."
                    className="bg-[#141432] border-[#2a2a4a] text-white"
                    data-testid="input-claim-photo-url"
                  />
                </div>
              </div>

              <div className="space-y-3 border-t border-[#2a2a4a] pt-4">
                <p className="text-sm text-neutral-300 font-semibold">Permissions</p>
                <div className="flex items-center justify-between">
                  <Label className="text-neutral-400 text-sm">Display my full name publicly</Label>
                  <Switch checked={claimForm.allowName} onCheckedChange={v => setClaimForm(p => ({ ...p, allowName: v }))} data-testid="switch-allow-name" />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-neutral-400 text-sm">Allow photo usage in spotlight</Label>
                  <Switch checked={claimForm.allowPhoto} onCheckedChange={v => setClaimForm(p => ({ ...p, allowPhoto: v }))} data-testid="switch-allow-photo" />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-neutral-400 text-sm">Allow review to be shared</Label>
                  <Switch checked={claimForm.allowReview} onCheckedChange={v => setClaimForm(p => ({ ...p, allowReview: v }))} data-testid="switch-allow-review" />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-neutral-400 text-sm">Allow social media sharing</Label>
                  <Switch checked={claimForm.allowSocialShare} onCheckedChange={v => setClaimForm(p => ({ ...p, allowSocialShare: v }))} data-testid="switch-allow-social" />
                </div>
              </div>

              <Button
                className="w-full bg-[#F2C230] text-[#1a1a2e] font-bold hover:bg-[#e5b62e]"
                disabled={claimMutation.isPending}
                onClick={() => claimMutation.mutate()}
                data-testid="button-claim-prize"
              >
                {claimMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                Claim My Prize
              </Button>
            </div>
          )}

          {data.status === "claimed" && (
            <div className="flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4">
              <CheckCircle2 className="h-6 w-6 text-emerald-400" />
              <div>
                <p className="text-emerald-400 font-semibold">Prize Claimed</p>
                {data.claimedAt && <p className="text-neutral-400 text-sm">{formatDeadline(data.claimedAt)}</p>}
              </div>
            </div>
          )}

          {data.status === "expired" && (
            <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/30 rounded-lg p-4">
              <XCircle className="h-6 w-6 text-red-400" />
              <div>
                <p className="text-red-400 font-semibold">Claim Window Expired</p>
                <p className="text-neutral-400 text-sm">This prize can no longer be claimed.</p>
              </div>
            </div>
          )}

          {data.status !== "claimed" && data.status !== "expired" && !isPending && (
            <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/30 rounded-lg p-4">
              <XCircle className="h-6 w-6 text-red-400" />
              <div>
                <p className="text-red-400 font-semibold">Prize Unavailable</p>
                <p className="text-neutral-400 text-sm">This prize can no longer be claimed.</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
