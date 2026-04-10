import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, Redirect } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { usePageMeta } from "@/hooks/use-page-meta";
import { useCity } from "@/hooks/use-city";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Gift, Clock, Users, Trophy, Share2, CheckCircle2, Copy, ExternalLink, Star, Loader2 } from "lucide-react";

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const entryFormSchema = z.object({
  name: z.string().min(1, "Name is required").max(255),
  email: z.string().email("Valid email required"),
  phone: z.string().optional(),
  zipcode: z.string().optional(),
  referralCode: z.string().optional(),
  businessName: z.string().max(255).optional(),
  acceptTerms: z.boolean().refine(v => v === true, "You must accept the rules to enter"),
  optInBusiness: z.boolean().optional(),
  honeypot: z.string().max(0).optional(),
});

type EntryFormValues = z.infer<typeof entryFormSchema>;

interface GiveawayPublic {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  heroImageUrl: string | null;
  rulesText: string | null;
  status: string;
  startsAt: string | null;
  endsAt: string | null;
  drawAt: string | null;
  isFeatured: boolean;
  requiresVerifiedEmail: boolean;
  requiresZipcode: boolean;
  maxEntriesPerUser: number;
  entryCount: number;
  prizes: Array<{ id: string; name: string; description: string | null; imageUrl: string | null; value: string | null; quantity: number }>;
  sponsors: Array<{ id: string; name: string; logoUrl: string | null; websiteUrl: string | null; tier: string }>;
  bonusActions: Array<{ id: string; bonusType: string; label: string; description: string | null; bonusAmount: number; actionUrl: string | null }>;
  winners: Array<{ name: string; prize: string | null }>;
}

interface EntryCheck {
  entered: boolean;
  entryId?: string;
  referralCode?: string;
  totalEntries?: number;
  bonusEntries?: number;
  completedBonusIds?: string[];
}

function CountdownTimer({ endsAt }: { endsAt: string }) {
  const [timeLeft, setTimeLeft] = useState("");

  useEffect(() => {
    const update = () => {
      const end = new Date(endsAt).getTime();
      const now = Date.now();
      const diff = end - now;
      if (diff <= 0) { setTimeLeft("Ended"); return; }
      const days = Math.floor(diff / 86400000);
      const hours = Math.floor((diff % 86400000) / 3600000);
      const mins = Math.floor((diff % 3600000) / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      if (days > 0) setTimeLeft(`${days}d ${hours}h ${mins}m`);
      else setTimeLeft(`${hours}h ${mins}m ${secs}s`);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [endsAt]);

  return <span data-testid="text-countdown">{timeLeft}</span>;
}

export default function GiveawayEntry({ citySlug, slug }: { citySlug: string; slug?: string }) {
  const { toast } = useToast();
  const [location] = useLocation();
  const { data: city } = useCity(citySlug);
  const [enteredEmail, setEnteredEmail] = useState("");
  const [showRules, setShowRules] = useState(false);

  const searchParams = new URLSearchParams(window.location.search);
  const refCode = searchParams.get("ref") || "";
  const verified = searchParams.get("verified");

  useEffect(() => {
    if (verified === "success") {
      toast({ title: "Email Verified", description: "Your entry has been confirmed!" });
    }
  }, [verified, toast]);

  const { data: giveaway, isLoading, error } = useQuery<GiveawayPublic>({
    queryKey: ["/api/giveaways", slug],
    queryFn: async () => {
      const res = await fetch(`/api/giveaways/${slug}`);
      if (!res.ok) throw new Error("Giveaway not found");
      return res.json();
    },
    enabled: !!slug,
  });

  const { data: entryCheck, refetch: refetchEntry } = useQuery<EntryCheck>({
    queryKey: ["/api/giveaways", slug, "check-entry", enteredEmail],
    queryFn: async () => {
      const res = await fetch(`/api/giveaways/${slug}/check-entry?email=${encodeURIComponent(enteredEmail)}`);
      if (!res.ok) throw new Error("Check failed");
      return res.json();
    },
    enabled: !!slug && !!enteredEmail,
  });

  useEffect(() => {
    if (giveaway?.id) {
      fetch(`/api/admin/giveaways/${giveaway.id}/track-view`, { method: "POST" }).catch(() => {});
    }
  }, [giveaway?.id]);

  usePageMeta({
    title: giveaway ? `${giveaway.title} - Enter to Win | CLT Metro Hub` : "Enter to Win | CLT Metro Hub",
    description: giveaway?.description || "Enter for a chance to win prizes from local Charlotte businesses",
    ogImage: giveaway?.heroImageUrl || undefined,
    ogType: "website",
  });

  const form = useForm<EntryFormValues>({
    resolver: zodResolver(entryFormSchema),
    defaultValues: { name: "", email: "", phone: "", zipcode: "", referralCode: refCode, businessName: "", acceptTerms: false, optInBusiness: false, honeypot: "" },
  });

  const entryMutation = useMutation({
    mutationFn: async (values: EntryFormValues) => {
      const res = await apiRequest("POST", `/api/giveaways/${slug}/enter`, values);
      return res.json();
    },
    onSuccess: (data) => {
      setEnteredEmail(form.getValues("email"));
      queryClient.invalidateQueries({ queryKey: ["/api/giveaways", slug, "check-entry"] });
      queryClient.invalidateQueries({ queryKey: ["/api/giveaways", slug] });
      if (data.requiresVerification) {
        toast({ title: "Check your email", description: "We sent a verification link to confirm your entry." });
      } else {
        toast({ title: "You're entered!", description: "Good luck in the drawing!" });
      }
    },
    onError: (err: Error) => {
      toast({ title: "Entry failed", description: err.message, variant: "destructive" });
    },
  });

  const bonusMutation = useMutation({
    mutationFn: async ({ actionId, entryId }: { actionId: string; entryId: string }) => {
      const res = await apiRequest("POST", `/api/giveaways/${slug}/bonus/${actionId}`, { entryId });
      return res.json();
    },
    onSuccess: () => {
      refetchEntry();
      toast({ title: "Bonus entries added!" });
    },
    onError: (err: Error) => {
      toast({ title: "Bonus failed", description: err.message, variant: "destructive" });
    },
  });

  const copyReferralLink = useCallback(() => {
    if (!entryCheck?.referralCode || !giveaway) return;
    const url = `${window.location.origin}/${citySlug}/enter-to-win/${giveaway.slug}?ref=${entryCheck.referralCode}`;
    navigator.clipboard.writeText(url);
    toast({ title: "Link copied!" });
  }, [entryCheck?.referralCode, giveaway, citySlug, toast]);

  const onSubmit = (values: EntryFormValues) => entryMutation.mutate(values);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-[#F2C230]" />
      </div>
    );
  }

  if (error || !giveaway) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <Gift className="h-16 w-16 mx-auto mb-4 text-neutral-400" />
        <h1 className="text-2xl font-bold text-white mb-2">Giveaway Not Found</h1>
        <p className="text-neutral-400">This giveaway may have ended or the link is invalid.</p>
      </div>
    );
  }

  const isActive = giveaway.status === "active";
  const isEnded = giveaway.status === "completed";
  const isDrawing = giveaway.status === "drawing";
  const hasEntered = entryCheck?.entered;

  if (isEnded && !verified) {
    return <Redirect to={`/${citySlug}/enter-to-win/${giveaway.slug}/results`} />;
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {giveaway.heroImageUrl && (
        <div className="relative rounded-xl overflow-hidden mb-8 aspect-[2/1]">
          <img
            src={giveaway.heroImageUrl}
            alt={giveaway.title}
            className="w-full h-full object-cover"
            data-testid="img-giveaway-hero"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-6">
            <div className="flex items-center gap-2 mb-2">
              {giveaway.isFeatured && <Badge className="bg-[#F2C230] text-[#1a1a2e]" data-testid="badge-featured">Featured</Badge>}
              <Badge variant="outline" className="border-white/30 text-white" data-testid="badge-status">{giveaway.status}</Badge>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-white" data-testid="text-giveaway-title">{giveaway.title}</h1>
          </div>
        </div>
      )}

      {!giveaway.heroImageUrl && (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            {giveaway.isFeatured && <Badge className="bg-[#F2C230] text-[#1a1a2e]" data-testid="badge-featured">Featured</Badge>}
            <Badge variant="outline" data-testid="badge-status">{giveaway.status}</Badge>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-white" data-testid="text-giveaway-title">{giveaway.title}</h1>
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-4 mb-8">
        {giveaway.endsAt && (
          <Card className="bg-[#1e1e3a] border-[#2a2a4a]">
            <CardContent className="p-4 flex items-center gap-3">
              <Clock className="h-5 w-5 text-[#F2C230] shrink-0" />
              <div>
                <p className="text-xs text-neutral-400 uppercase tracking-wider">Time Left</p>
                <p className="text-lg font-semibold text-white"><CountdownTimer endsAt={giveaway.endsAt} /></p>
              </div>
            </CardContent>
          </Card>
        )}
        <Card className="bg-[#1e1e3a] border-[#2a2a4a]">
          <CardContent className="p-4 flex items-center gap-3">
            <Users className="h-5 w-5 text-[#F2C230] shrink-0" />
            <div>
              <p className="text-xs text-neutral-400 uppercase tracking-wider">Entries</p>
              <p className="text-lg font-semibold text-white" data-testid="text-entry-count">{giveaway.entryCount.toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-[#1e1e3a] border-[#2a2a4a]">
          <CardContent className="p-4 flex items-center gap-3">
            <Trophy className="h-5 w-5 text-[#F2C230] shrink-0" />
            <div>
              <p className="text-xs text-neutral-400 uppercase tracking-wider">Prizes</p>
              <p className="text-lg font-semibold text-white" data-testid="text-prize-count">{giveaway.prizes.length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-[1fr_380px] gap-8">
        <div className="space-y-8">
          {giveaway.description && (
            <div>
              <h2 className="text-xl font-bold text-white mb-3">About This Giveaway</h2>
              <p className="text-neutral-300 leading-relaxed whitespace-pre-wrap" data-testid="text-description">{giveaway.description}</p>
            </div>
          )}

          {giveaway.prizes.length > 0 && (
            <div>
              <h2 className="text-xl font-bold text-white mb-4">Prizes</h2>
              <div className="grid gap-4">
                {giveaway.prizes.map((prize, i) => (
                  <Card key={prize.id} className="bg-[#1e1e3a] border-[#2a2a4a] overflow-hidden" data-testid={`card-prize-${prize.id}`}>
                    <CardContent className="p-0">
                      <div className="flex">
                        {prize.imageUrl && (
                          <div className="w-28 h-28 shrink-0">
                            <img src={prize.imageUrl} alt={prize.name} className="w-full h-full object-cover" />
                          </div>
                        )}
                        <div className="p-4 flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Star className="h-4 w-4 text-[#F2C230]" />
                            <span className="text-sm text-[#F2C230] font-semibold">{i === 0 ? "Grand Prize" : `Prize ${i + 1}`}</span>
                          </div>
                          <h3 className="text-white font-semibold">{prize.name}</h3>
                          {prize.description && <p className="text-neutral-400 text-sm mt-1">{prize.description}</p>}
                          {prize.value && <p className="text-[#F2C230] text-sm font-semibold mt-1">Value: ${Number(prize.value).toLocaleString()}</p>}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {giveaway.sponsors.length > 0 && (
            <div>
              <h2 className="text-xl font-bold text-white mb-4">Sponsors</h2>
              <div className="flex flex-wrap gap-4">
                {giveaway.sponsors.map(sponsor => (
                  <a
                    key={sponsor.id}
                    href={sponsor.websiteUrl || "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 bg-[#1e1e3a] border border-[#2a2a4a] rounded-lg px-4 py-3 hover:border-[#F2C230]/40 transition-colors"
                    data-testid={`link-sponsor-${sponsor.id}`}
                  >
                    {sponsor.logoUrl && <img src={sponsor.logoUrl} alt={sponsor.name} className="h-8 w-8 rounded object-contain" />}
                    <span className="text-white text-sm font-medium">{sponsor.name}</span>
                  </a>
                ))}
              </div>
            </div>
          )}

          {(isEnded || isDrawing) && giveaway.winners.length > 0 && (
            <div>
              <h2 className="text-xl font-bold text-white mb-4">Winners</h2>
              <div className="space-y-2">
                {giveaway.winners.map((w, i) => (
                  <div key={i} className="flex items-center gap-3 bg-[#1e1e3a] border border-[#2a2a4a] rounded-lg p-3" data-testid={`text-winner-${i}`}>
                    <Trophy className="h-5 w-5 text-[#F2C230]" />
                    <span className="text-white font-medium">{w.name}</span>
                    {w.prize && <Badge variant="outline" className="ml-auto text-[#F2C230] border-[#F2C230]/30">{w.prize}</Badge>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {giveaway.rulesText && (
            <div>
              <button
                onClick={() => setShowRules(!showRules)}
                className="text-sm text-neutral-400 hover:text-white transition-colors"
                data-testid="button-toggle-rules"
              >
                {showRules ? "Hide Rules" : "View Official Rules"}
              </button>
              {showRules && (
                <div className="mt-3 p-4 bg-[#1e1e3a] border border-[#2a2a4a] rounded-lg text-neutral-300 text-sm whitespace-pre-wrap leading-relaxed">
                  {giveaway.rulesText}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="space-y-6">
          {isActive && !hasEntered && (
            <Card className="bg-[#1e1e3a] border-[#2a2a4a] sticky top-4">
              <CardContent className="p-6">
                <h2 className="text-xl font-bold text-white mb-4">Enter to Win</h2>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-neutral-300">Full Name</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Your name" className="bg-[#141432] border-[#2a2a4a] text-white" data-testid="input-name" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-neutral-300">Email</FormLabel>
                          <FormControl>
                            <Input {...field} type="email" placeholder="you@email.com" className="bg-[#141432] border-[#2a2a4a] text-white" data-testid="input-email" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-neutral-300">Phone (optional)</FormLabel>
                          <FormControl>
                            <Input {...field} type="tel" placeholder="(555) 123-4567" className="bg-[#141432] border-[#2a2a4a] text-white" data-testid="input-phone" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    {giveaway.requiresZipcode && (
                      <FormField
                        control={form.control}
                        name="zipcode"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-neutral-300">Zipcode</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="28202" className="bg-[#141432] border-[#2a2a4a] text-white" data-testid="input-zipcode" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}
                    {refCode && (
                      <input type="hidden" {...form.register("referralCode")} />
                    )}
                    <div className="sr-only" aria-hidden="true">
                      <input tabIndex={-1} autoComplete="off" {...form.register("honeypot")} data-testid="input-honeypot" />
                    </div>
                    <FormField
                      control={form.control}
                      name="acceptTerms"
                      render={({ field }) => (
                        <FormItem className="flex items-start gap-2">
                          <FormControl>
                            <Checkbox checked={field.value} onCheckedChange={field.onChange} data-testid="checkbox-terms" />
                          </FormControl>
                          <div className="leading-none">
                            <FormLabel className="text-neutral-300 text-sm">
                              I agree to the {giveaway.rulesText ? (
                                <button type="button" onClick={() => setShowRules(true)} className="underline text-[#F2C230]" data-testid="button-view-rules-inline">official rules</button>
                              ) : "official rules"} and am 18+ years of age
                            </FormLabel>
                            <FormMessage />
                          </div>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="optInBusiness"
                      render={({ field }) => (
                        <FormItem className="flex items-start gap-2">
                          <FormControl>
                            <Checkbox checked={field.value} onCheckedChange={field.onChange} data-testid="checkbox-business-optin" />
                          </FormControl>
                          <div className="leading-none">
                            <FormLabel className="text-neutral-300 text-sm">
                              I own or represent a local business and would like to be featured
                            </FormLabel>
                          </div>
                        </FormItem>
                      )}
                    />
                    {form.watch("optInBusiness") && (
                      <FormField
                        control={form.control}
                        name="businessName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-neutral-300">Business Name</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Your business name" className="bg-[#1e1e3a] border-[#2a2a4a] text-white" data-testid="input-business-name" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}
                    <Button
                      type="submit"
                      disabled={entryMutation.isPending || !form.watch("acceptTerms")}
                      className="w-full bg-[#F2C230] text-[#1a1a2e] font-bold hover:bg-[#e5b62e]"
                      data-testid="button-submit-entry"
                    >
                      {entryMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Gift className="h-4 w-4 mr-2" />}
                      Enter Now
                    </Button>
                    {giveaway.requiresVerifiedEmail && (
                      <p className="text-xs text-neutral-400 text-center">Email verification required to confirm your entry</p>
                    )}
                  </form>
                </Form>
              </CardContent>
            </Card>
          )}

          {isActive && hasEntered && entryCheck && (
            <Card className="bg-[#1e1e3a] border-[#2a2a4a] sticky top-4">
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-6 w-6 text-emerald-400" />
                  <h2 className="text-xl font-bold text-white">You're Entered!</h2>
                </div>
                <div className="bg-[#141432] rounded-lg p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-neutral-400">Total Entries</span>
                    <span className="text-white font-semibold" data-testid="text-my-entries">{entryCheck.totalEntries}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-neutral-400">Bonus Entries</span>
                    <span className="text-[#F2C230] font-semibold">{entryCheck.bonusEntries}</span>
                  </div>
                </div>

                {giveaway.bonusActions.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-neutral-300 mb-3">Earn Bonus Entries</h3>
                    <div className="space-y-2">
                      {giveaway.bonusActions.map(action => {
                        const completed = entryCheck.completedBonusIds?.includes(action.id);
                        return (
                          <div key={action.id} className="flex items-center gap-3 bg-[#141432] rounded-lg p-3" data-testid={`bonus-action-${action.id}`}>
                            <div className="flex-1">
                              <p className="text-white text-sm font-medium">{action.label}</p>
                              <p className="text-xs text-neutral-400">+{action.bonusAmount} {action.bonusAmount === 1 ? "entry" : "entries"}</p>
                            </div>
                            {completed ? (
                              <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                className="border-[#F2C230]/30 text-[#F2C230]"
                                disabled={bonusMutation.isPending}
                                onClick={() => {
                                  if (action.actionUrl) window.open(action.actionUrl, "_blank");
                                  bonusMutation.mutate({ actionId: action.id, entryId: entryCheck.entryId! });
                                }}
                                data-testid={`button-bonus-${action.id}`}
                              >
                                {action.actionUrl ? <ExternalLink className="h-3 w-3 mr-1" /> : null}
                                Complete
                              </Button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <Separator className="bg-[#2a2a4a]" />

                <div>
                  <h3 className="text-sm font-semibold text-neutral-300 mb-2">Share for More Entries</h3>
                  <div className="flex gap-2">
                    <Input
                      readOnly
                      value={`${window.location.origin}/${citySlug}/enter-to-win/${giveaway.slug}?ref=${entryCheck.referralCode}`}
                      className="bg-[#141432] border-[#2a2a4a] text-white text-xs flex-1"
                      data-testid="input-referral-link"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-[#F2C230]/30 text-[#F2C230] shrink-0"
                      onClick={copyReferralLink}
                      data-testid="button-copy-referral"
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {isDrawing && (
            <Card className="bg-[#1e1e3a] border-[#2a2a4a]">
              <CardContent className="p-6 text-center">
                <Trophy className="h-12 w-12 mx-auto mb-3 text-[#F2C230]" />
                <h2 className="text-xl font-bold text-white mb-2">Drawing In Progress</h2>
                <p className="text-neutral-400">This giveaway is currently in the drawing phase. Winners will be announced soon.</p>
              </CardContent>
            </Card>
          )}

          {!isActive && !isEnded && !isDrawing && (
            <Card className="bg-[#1e1e3a] border-[#2a2a4a]">
              <CardContent className="p-6 text-center">
                <Clock className="h-12 w-12 mx-auto mb-3 text-neutral-400" />
                <h2 className="text-xl font-bold text-white mb-2">Not Yet Open</h2>
                <p className="text-neutral-400">This giveaway is not currently accepting entries.</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
