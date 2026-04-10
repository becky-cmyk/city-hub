import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useCallback, useRef, useEffect } from "react";
import { Link, useParams, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Crown, Trophy, Vote, ChevronRight, Loader2, Award,
  Users, Star, ExternalLink, Check, Shield, Send,
  Calendar, Share2, Sparkles, PartyPopper, MessageSquare,
} from "lucide-react";
import charlotteAvatar from "@assets/charlotte-avatar-v2.png";
import type { CrownCategory, CrownParticipant } from "@shared/schema";

export function CrownOverview({ citySlug }: { citySlug: string }) {
  const { data: categories, isLoading } = useQuery<CrownCategory[]>({
    queryKey: [`/api/crown/${citySlug}/categories`],
  });

  return (
    <div className="space-y-8" data-testid="crown-overview-page">
      <div className="relative rounded-xl overflow-hidden bg-gradient-to-br from-amber-900 via-amber-800 to-yellow-900 p-8 md:p-12">
        <div className="absolute inset-0 bg-black/20" />
        <div className="relative z-10 text-center max-w-2xl mx-auto">
          <Crown className="h-12 w-12 text-amber-300 mx-auto mb-4" />
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-3" data-testid="text-crown-heading">
            The Crown Program
          </h1>
          <p className="text-amber-100 text-lg mb-6">
            Celebrating the best of our community. Vote for your favorites and help crown the winners.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link href={`/${citySlug}/crown/vote`}>
              <Button size="lg" className="bg-white text-amber-900 font-semibold" data-testid="button-vote-now">
                <Vote className="h-5 w-5 mr-2" /> Vote Now
              </Button>
            </Link>
            <Link href={`/${citySlug}/crown/rules`}>
              <Button size="lg" variant="outline" className="border-amber-300 text-amber-100" data-testid="button-view-rules">
                How It Works
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2" data-testid="text-categories-heading">
          <Award className="h-5 w-5" /> Award Categories
        </h2>
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-32" />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {categories?.map(cat => (
              <Link key={cat.id} href={`/${citySlug}/crown/vote?category=${cat.slug}`}>
                <Card className="cursor-pointer transition-shadow hover:shadow-md h-full" data-testid={`card-crown-category-${cat.slug}`}>
                  <CardContent className="p-5">
                    <div className="flex items-start gap-3">
                      <div className="h-10 w-10 rounded-full bg-amber-100 dark:bg-amber-900 flex items-center justify-center shrink-0">
                        <Crown className="h-5 w-5 text-amber-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold">{cat.name}</h3>
                        {cat.description && (
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{cat.description}</p>
                        )}
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant="outline" className="text-xs">{cat.competitionLevel}</Badge>
                          <span className="text-xs text-muted-foreground">{cat.voteThreshold} votes to qualify</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
        {categories && categories.length === 0 && (
          <p className="text-center text-muted-foreground py-12" data-testid="text-no-categories">
            Award categories coming soon.
          </p>
        )}
      </div>

      <Link href={`/${citySlug}/crown/winners`}>
        <Card className="cursor-pointer transition-shadow hover:shadow-md" data-testid="link-view-winners">
          <CardContent className="p-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Trophy className="h-6 w-6 text-amber-500" />
              <div>
                <p className="font-semibold">View Past Winners</p>
                <p className="text-sm text-muted-foreground">See who earned the Crown in previous seasons</p>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </CardContent>
        </Card>
      </Link>
    </div>
  );
}

export function CrownVoting({ citySlug }: { citySlug: string }) {
  const { toast } = useToast();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const { data: categories, isLoading: catsLoading } = useQuery<CrownCategory[]>({
    queryKey: [`/api/crown/${citySlug}/categories`],
  });

  const selectedCatSlug = selectedCategory || categories?.[0]?.slug;

  const { data: nomineeData, isLoading: nomLoading } = useQuery<{ category: CrownCategory; nominees: CrownParticipant[] }>({
    queryKey: [`/api/crown/${citySlug}/categories/${selectedCatSlug}/nominees`],
    enabled: !!selectedCatSlug,
  });

  const voteMutation = useMutation({
    mutationFn: async (participantId: string) => {
      const r = await apiRequest("POST", `/api/crown/${citySlug}/vote`, {
        participantId,
      });
      return r.json();
    },
    onSuccess: (data: any) => {
      if (data.isFlagged) {
        toast({ title: "Vote recorded", description: "Your vote is under review" });
      } else {
        toast({ title: "Vote cast successfully" });
      }
      queryClient.invalidateQueries({ queryKey: [`/api/crown/${citySlug}/categories/${selectedCatSlug}/nominees`] });
    },
    onError: (e: any) => toast({ title: "Cannot vote", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-6" data-testid="crown-voting-page">
      <div className="flex items-center gap-2">
        <Link href={`/${citySlug}/crown`}>
          <span className="text-sm text-muted-foreground cursor-pointer">Crown Program</span>
        </Link>
        <ChevronRight className="h-3 w-3 text-muted-foreground" />
        <span className="text-sm font-medium">Vote</span>
      </div>

      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2 mb-2" data-testid="text-voting-title">
          <Vote className="h-6 w-6" /> Cast Your Vote
        </h1>
        <p className="text-muted-foreground">
          Choose a category and vote for your favorite. Verified accounts can vote once per category every 24 hours.
        </p>
      </div>

      {catsLoading ? (
        <Skeleton className="h-12" />
      ) : (
        <div className="flex flex-wrap gap-2" data-testid="category-filters">
          {categories?.map(cat => (
            <Badge
              key={cat.slug}
              variant={selectedCatSlug === cat.slug ? "default" : "outline"}
              className="cursor-pointer px-3 py-1.5 text-sm"
              onClick={() => setSelectedCategory(cat.slug)}
              data-testid={`filter-category-${cat.slug}`}
            >
              {cat.name}
            </Badge>
          ))}
        </div>
      )}

      {nomLoading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
      ) : nomineeData?.nominees && nomineeData.nominees.length > 0 ? (
        <div className="space-y-3" data-testid="nominees-list">
          {nomineeData.nominees.map((nominee, idx) => (
            <Card key={nominee.id} data-testid={`card-nominee-${nominee.id}`}>
              <CardContent className="p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-4 min-w-0">
                  <div className="text-lg font-bold text-muted-foreground w-8 text-center shrink-0">
                    {idx + 1}
                  </div>
                  {nominee.imageUrl ? (
                    <img src={nominee.imageUrl} alt={nominee.name}
                      className="h-12 w-12 rounded-full object-cover shrink-0" />
                  ) : (
                    <div className="h-12 w-12 rounded-full bg-amber-100 dark:bg-amber-900 flex items-center justify-center shrink-0">
                      <Crown className="h-6 w-6 text-amber-600" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{nominee.name}</p>
                    {nominee.bio && <p className="text-sm text-muted-foreground line-clamp-1">{nominee.bio}</p>}
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-muted-foreground">{nominee.voteCount} votes</span>
                      {nominee.status === "qualified_nominee" && (
                        <Badge variant="outline" className="text-[10px] border-green-300 text-green-700 dark:text-green-400">Qualified</Badge>
                      )}
                      {nominee.status === "crown_winner" && (
                        <Badge className="text-[10px] bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300">Winner</Badge>
                      )}
                    </div>
                  </div>
                </div>
                <Button
                  onClick={() => voteMutation.mutate(nominee.id)}
                  disabled={voteMutation.isPending || nominee.status === "crown_winner"}
                  data-testid={`button-vote-${nominee.id}`}
                >
                  {voteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Vote className="h-4 w-4 mr-1" />}
                  Vote
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <p className="text-center text-muted-foreground py-12" data-testid="text-no-nominees">
          No nominees in this category yet.
        </p>
      )}
    </div>
  );
}

export function CrownWinnersPage({ citySlug }: { citySlug: string }) {
  const { data: winners, isLoading } = useQuery<any[]>({
    queryKey: [`/api/crown/${citySlug}/winners`],
  });

  return (
    <div className="space-y-6" data-testid="crown-winners-page">
      <div className="flex items-center gap-2">
        <Link href={`/${citySlug}/crown`}>
          <span className="text-sm text-muted-foreground cursor-pointer">Crown Program</span>
        </Link>
        <ChevronRight className="h-3 w-3 text-muted-foreground" />
        <span className="text-sm font-medium">Winners</span>
      </div>

      <div className="text-center">
        <Trophy className="h-12 w-12 text-amber-500 mx-auto mb-3" />
        <h1 className="text-2xl font-bold" data-testid="text-winners-title">Crown Winners</h1>
        <p className="text-muted-foreground mt-1">The best of the best, as voted by the community</p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-32" />)}
        </div>
      ) : winners && winners.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4" data-testid="winners-grid">
          {winners.map(w => (
            <Card key={w.id} data-testid={`card-winner-${w.id}`}>
              <CardContent className="p-5">
                <div className="flex items-center gap-4">
                  {w.participantImage ? (
                    <img src={w.participantImage} alt={w.participantName}
                      className="h-16 w-16 rounded-full object-cover shrink-0" />
                  ) : (
                    <div className="h-16 w-16 rounded-full bg-amber-100 dark:bg-amber-900 flex items-center justify-center shrink-0">
                      <Trophy className="h-8 w-8 text-amber-600" />
                    </div>
                  )}
                  <div>
                    <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300 text-xs mb-1">
                      {w.categoryName}
                    </Badge>
                    <h3 className="font-bold text-lg">{w.participantName}</h3>
                    {w.participantBio && (
                      <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{w.participantBio}</p>
                    )}
                    {w.participantWebsite && (
                      <a href={w.participantWebsite} target="_blank" rel="noopener noreferrer"
                        className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1 mt-1"
                        data-testid={`link-winner-website-${w.id}`}>
                        <ExternalLink className="h-3 w-3" /> Website
                      </a>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <p className="text-center text-muted-foreground py-12" data-testid="text-no-winners">
          Winners will be announced soon.
        </p>
      )}
    </div>
  );
}

export function CrownRules({ citySlug }: { citySlug: string }) {
  return (
    <div className="space-y-6 max-w-7xl mx-auto" data-testid="crown-rules-page">
      <div className="flex items-center gap-2">
        <Link href={`/${citySlug}/crown`}>
          <span className="text-sm text-muted-foreground cursor-pointer">Crown Program</span>
        </Link>
        <ChevronRight className="h-3 w-3 text-muted-foreground" />
        <span className="text-sm font-medium">How It Works</span>
      </div>

      <div className="text-center">
        <Shield className="h-10 w-10 text-amber-500 mx-auto mb-3" />
        <h1 className="text-2xl font-bold" data-testid="text-rules-title">How The Crown Program Works</h1>
      </div>

      <div className="space-y-4">
        <Card>
          <CardContent className="p-6">
            <h3 className="font-semibold text-lg mb-2 flex items-center gap-2">
              <Badge variant="outline">1</Badge> Nomination
            </h3>
            <p className="text-sm text-muted-foreground">
              Local businesses, creators, and community organizations are nominated as candidates.
              Our team reviews nominations and sends invitations to qualified candidates.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <h3 className="font-semibold text-lg mb-2 flex items-center gap-2">
              <Badge variant="outline">2</Badge> Verification
            </h3>
            <p className="text-sm text-muted-foreground">
              Invited candidates accept their nomination and complete the Hub Presence verification.
              This ensures all participants are legitimate, active members of the community.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <h3 className="font-semibold text-lg mb-2 flex items-center gap-2">
              <Badge variant="outline">3</Badge> Public Voting
            </h3>
            <p className="text-sm text-muted-foreground">
              Verified community members can cast one vote per category every 24 hours.
              Our fraud detection system ensures fair and legitimate voting.
              Each category has a vote threshold that nominees must reach to qualify for the Crown.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <h3 className="font-semibold text-lg mb-2 flex items-center gap-2">
              <Badge variant="outline">4</Badge> Qualification
            </h3>
            <p className="text-sm text-muted-foreground">
              When a nominee reaches the vote threshold for their category, they become a Qualified Nominee.
              Thresholds vary by competition level: High (75 votes), Mid (40 votes), Community (25 votes).
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <h3 className="font-semibold text-lg mb-2 flex items-center gap-2">
              <Badge variant="outline">5</Badge> Winner Announcement
            </h3>
            <p className="text-sm text-muted-foreground">
              At the end of the voting period, Qualified Nominees with the highest vote counts in each
              category are declared Crown Winners. Winners receive the Crown badge and featured recognition.
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="text-center">
        <Link href={`/${citySlug}/crown/vote`}>
          <Button size="lg" data-testid="button-start-voting">
            <Vote className="h-5 w-5 mr-2" /> Start Voting
          </Button>
        </Link>
      </div>
    </div>
  );
}

export function CrownInvitation({ citySlug }: { citySlug: string }) {
  const params = useParams<{ token: string }>();
  const { toast } = useToast();
  const [chatMessages, setChatMessages] = useState<{ role: string; content: string }[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [flowSessionId, setFlowSessionId] = useState<string | null>(null);
  const [resolvedCityId, setResolvedCityId] = useState<string | null>(null);
  const [sessionStarting, setSessionStarting] = useState(false);
  const [onboardingComplete, setOnboardingComplete] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const chatSessionId = useRef(`crown-${Date.now()}-${Math.random().toString(36).slice(2)}`);

  const { data: invitation, isLoading, isError } = useQuery<any>({
    queryKey: [`/api/crown/invitation/${params.token}`],
  });

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatMessages]);

  useEffect(() => {
    if (!invitation || flowSessionId || sessionStarting) return;
    const completedStatuses = ["verified_participant", "nominee", "qualified_nominee", "crown_winner"];
    if (completedStatuses.includes(invitation.status)) {
      setOnboardingComplete(true);
      return;
    }
    setSessionStarting(true);

    fetch("/api/charlotte-public/crown-onboarding/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        inviteToken: params.token,
        chatSessionId: chatSessionId.current,
      }),
    })
      .then(r => {
        if (!r.ok) throw new Error("Failed to start onboarding session");
        return r.json();
      })
      .then(data => {
        if (data.sessionId && data.cityId) {
          setFlowSessionId(data.sessionId);
          setResolvedCityId(data.cityId);
          sendChatMessage("Hi, I just received my Crown Program nomination!", data.sessionId, data.cityId);
        } else {
          throw new Error("Invalid session response");
        }
      })
      .catch((err) => {
        setSessionStarting(false);
        toast({ title: "Connection Error", description: "Unable to start onboarding. Please refresh the page to try again.", variant: "destructive" });
      });
  }, [invitation, flowSessionId, sessionStarting]);

  const sendChatMessage = useCallback(async (userMsg: string, overrideSessionId?: string, overrideCityId?: string) => {
    const cityId = overrideCityId || resolvedCityId;
    if (!userMsg.trim() || streaming || !cityId) return;
    const activeSessionId = overrideSessionId || flowSessionId;
    if (!activeSessionId) return;

    setChatInput("");
    setChatMessages(prev => [...prev, { role: "user", content: userMsg }]);
    setStreaming(true);

    try {
      const res = await fetch("/api/charlotte-public/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMsg,
          sessionId: chatSessionId.current,
          cityId,
          pageContext: {
            page: "crown-invitation",
            flowType: "crown-onboarding",
            flowSessionId: activeSessionId,
            businessName: invitation?.name,
          },
          locale: "en",
        }),
      });

      if (!res.ok) throw new Error("Failed");
      const reader = res.body?.getReader();
      if (!reader) throw new Error("No reader");

      const decoder = new TextDecoder();
      let assistantContent = "";
      setChatMessages(prev => [...prev, { role: "assistant", content: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value);
        const lines = text.split("\n").filter(l => l.startsWith("data: "));
        for (const line of lines) {
          try {
            const parsed = JSON.parse(line.slice(6));
            if (parsed.content) {
              assistantContent += parsed.content;
              setChatMessages(prev => {
                const updated = [...prev];
                updated[updated.length - 1] = { role: "assistant", content: assistantContent };
                return updated;
              });
            }
            if (parsed.flowComplete) {
              setOnboardingComplete(true);
            }
          } catch {}
        }
      }
    } catch {
      setChatMessages(prev => [
        ...prev,
        { role: "assistant", content: "Sorry, something went wrong. Please try again." },
      ]);
    } finally {
      setStreaming(false);
    }
  }, [streaming, resolvedCityId, flowSessionId, invitation]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError || !invitation) {
    return (
      <div className="text-center py-20" data-testid="invitation-not-found">
        <Crown className="h-12 w-12 text-amber-400 mx-auto mb-4" />
        <h1 className="text-2xl font-bold mb-2">Invalid Invitation</h1>
        <p className="text-muted-foreground mb-4">This invitation link is not valid or has expired.</p>
        <Link href={`/${citySlug}/crown`}>
          <Button variant="outline" data-testid="link-back-crown">Back to Crown Program</Button>
        </Link>
      </div>
    );
  }

  if (onboardingComplete) {
    return (
      <div className="max-w-xl mx-auto space-y-6" data-testid="crown-onboarding-complete">
        <div className="relative rounded-xl overflow-hidden bg-gradient-to-br from-amber-900 via-amber-800 to-yellow-900 p-8 text-center">
          <div className="absolute inset-0 bg-black/20" />
          <div className="relative z-10">
            <PartyPopper className="h-12 w-12 text-amber-300 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-white mb-2" data-testid="text-onboarding-complete-title">
              Welcome to the Crown Program!
            </h1>
            <p className="text-amber-100">
              {invitation.name}, you are now a Verified Participant in the {invitation.categoryName} category.
            </p>
          </div>
        </div>

        <Card>
          <CardContent className="p-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Calendar className="h-4 w-4 text-amber-500" /> What Happens Next
            </h3>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="h-7 w-7 rounded-full bg-amber-100 dark:bg-amber-900 flex items-center justify-center shrink-0 text-xs font-bold text-amber-700">1</div>
                <div>
                  <p className="font-medium text-sm">Voting Opens Soon</p>
                  <p className="text-xs text-muted-foreground">Community members will be able to vote for you in your category. You'll be notified when voting begins.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="h-7 w-7 rounded-full bg-amber-100 dark:bg-amber-900 flex items-center justify-center shrink-0 text-xs font-bold text-amber-700">2</div>
                <div>
                  <p className="font-medium text-sm">Gather Support</p>
                  <p className="text-xs text-muted-foreground">Share your nomination with friends, family, and supporters to encourage votes.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="h-7 w-7 rounded-full bg-amber-100 dark:bg-amber-900 flex items-center justify-center shrink-0 text-xs font-bold text-amber-700">3</div>
                <div>
                  <p className="font-medium text-sm">Reach the Threshold</p>
                  <p className="text-xs text-muted-foreground">Once you reach the vote threshold for your category, you become a Qualified Nominee eligible for the Crown.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="h-7 w-7 rounded-full bg-amber-100 dark:bg-amber-900 flex items-center justify-center shrink-0 text-xs font-bold text-amber-700">4</div>
                <div>
                  <p className="font-medium text-sm">Crown Winner Announcement</p>
                  <p className="text-xs text-muted-foreground">The Qualified Nominee with the most votes earns the Crown and featured recognition.</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 text-center space-y-3">
            <Share2 className="h-6 w-6 text-amber-500 mx-auto" />
            <h3 className="font-semibold">Share Your Nomination</h3>
            <p className="text-sm text-muted-foreground">
              Let people know you've been nominated and ask for their vote!
            </p>
            <Button
              variant="outline"
              onClick={() => {
                const shareUrl = `${window.location.origin}/${citySlug}/crown/vote`;
                navigator.clipboard.writeText(shareUrl);
                toast({ title: "Link copied to clipboard" });
              }}
              data-testid="button-share-nomination"
            >
              <Share2 className="h-4 w-4 mr-2" /> Copy Voting Link
            </Button>
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Link href={`/${citySlug}/crown/vote`} className="flex-1">
            <Button className="w-full" data-testid="button-view-voting">
              <Vote className="h-4 w-4 mr-2" /> View Voting
            </Button>
          </Link>
          <Link href={`/${citySlug}/crown`} className="flex-1">
            <Button variant="outline" className="w-full" data-testid="button-back-crown-program">
              Crown Program
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6" data-testid="crown-invitation-page">
      <div className="relative rounded-xl overflow-hidden bg-gradient-to-br from-amber-900 via-amber-800 to-yellow-900 p-6 md:p-8">
        <div className="absolute inset-0 bg-black/20" />
        <div className="relative z-10 text-center">
          <Crown className="h-10 w-10 text-amber-300 mx-auto mb-3" />
          <h1 className="text-xl md:text-2xl font-bold text-white mb-1" data-testid="text-invitation-title">
            You've Been Nominated!
          </h1>
          <p className="text-amber-100 text-sm">
            {invitation.name}, someone in the community thinks you deserve recognition for <strong>{invitation.categoryName}</strong>.
          </p>
        </div>
      </div>

      <Card className="border-2 border-amber-200 dark:border-amber-800">
        <CardContent className="p-4 md:p-6">
          <div className="flex items-center gap-3 mb-4">
            <img
              src={charlotteAvatar}
              alt="Charlotte"
              className="h-10 w-10 rounded-full object-cover ring-2 ring-amber-400/30 shrink-0"
            />
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm" data-testid="text-charlotte-crown-title">Charlotte — Crown Program Guide</h3>
              <p className="text-xs text-muted-foreground">I'll walk you through accepting your nomination</p>
            </div>
            {onboardingComplete && (
              <Badge className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 shrink-0">
                <Check className="h-3 w-3 mr-1" /> Complete
              </Badge>
            )}
          </div>

          <div
            className="rounded-lg border bg-muted/20 overflow-y-auto space-y-3 p-3"
            style={{ maxHeight: "400px", minHeight: "200px" }}
            data-testid="crown-chat-area"
          >
            {chatMessages.length === 0 && !streaming && sessionStarting && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-amber-600" />
                <span className="text-sm text-muted-foreground ml-2">Charlotte is getting ready...</span>
              </div>
            )}

            {chatMessages.map((msg, i) => (
              <div key={i} className={`flex gap-2 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                {msg.role === "assistant" && (
                  <img
                    src={charlotteAvatar}
                    alt=""
                    className="h-6 w-6 rounded-full object-cover shrink-0 mt-0.5"
                  />
                )}
                <div
                  className={`rounded-xl px-3 py-2 text-sm leading-relaxed max-w-[85%] ${
                    msg.role === "user"
                      ? "rounded-tr-sm bg-amber-600 text-white"
                      : "rounded-tl-sm bg-amber-50 dark:bg-amber-950/30"
                  }`}
                  data-testid={`crown-message-${i}`}
                >
                  {msg.content || (streaming && i === chatMessages.length - 1 ? "..." : "")}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {!onboardingComplete && (
            <div className="flex gap-2 mt-3">
              <Input
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                placeholder="Type your response..."
                onKeyDown={e => e.key === "Enter" && !streaming && sendChatMessage(chatInput)}
                disabled={streaming || !flowSessionId}
                data-testid="input-crown-chat"
              />
              <Button
                size="icon"
                onClick={() => sendChatMessage(chatInput)}
                disabled={!chatInput.trim() || streaming || !flowSessionId}
                className="shrink-0 bg-amber-600 hover:bg-amber-700"
                data-testid="button-crown-send"
              >
                {streaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3 text-sm">
            <Shield className="h-5 w-5 text-amber-500 shrink-0" />
            <div>
              <p className="font-medium">What is the Crown Program?</p>
              <p className="text-xs text-muted-foreground">
                A community recognition program celebrating the best local businesses, creators, and organizations through public voting.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function CrownOnboarding({ citySlug }: { citySlug: string }) {
  const { toast } = useToast();
  const searchParams = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  const participantId = searchParams.get("participant");
  const inviteToken = searchParams.get("token");
  const checkoutStatus = searchParams.get("checkout");

  const [step, setStep] = useState(1);
  const [participantType, setParticipantType] = useState("");
  const [orgName, setOrgName] = useState("");
  const [locationName, setLocationName] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [isLocallyOwned, setIsLocallyOwned] = useState(true);

  const { data: participant } = useQuery<CrownParticipant>({
    queryKey: ["/api/crown/invitation", inviteToken],
    queryFn: async () => {
      if (!inviteToken) return null;
      const r = await fetch(`/api/crown/invitation/${inviteToken}`);
      if (!r.ok) return null;
      return r.json();
    },
    enabled: !!inviteToken,
  });

  const { data: categories } = useQuery<{ id: string; name: string; slug: string }[]>({
    queryKey: ["/api/crown", citySlug, "categories"],
    queryFn: async () => {
      const r = await fetch(`/api/crown/${citySlug}/categories`);
      return r.json();
    },
  });

  const payMutation = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("POST", "/api/crown/checkout", {
        participantId: participantId || participant?.id,
        citySlug,
        inviteToken: inviteToken || participant?.inviteToken,
      });
      return r.json();
    },
    onSuccess: (data: { url?: string }) => {
      if (data.url) window.location.href = data.url;
    },
    onError: (e: Error) => toast({ title: "Payment error", description: e.message, variant: "destructive" }),
  });

  if (checkoutStatus === "success") {
    return (
      <div className="max-w-xl mx-auto text-center py-12 space-y-4" data-testid="crown-checkout-success">
        <div className="h-16 w-16 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center mx-auto">
          <Check className="h-8 w-8 text-green-600" />
        </div>
        <h1 className="text-2xl font-bold">Hub Presence Active</h1>
        <p className="text-muted-foreground">
          Your Hub Presence subscription is now active. You are a verified participant in the Crown Program.
          Voting for your category will be open soon.
        </p>
        <Link href={`/${citySlug}/crown`}>
          <Button data-testid="button-back-to-crown">Back to Crown Program</Button>
        </Link>
      </div>
    );
  }

  const totalSteps = 4;
  const stepLabels = ["Participant Type", "Profile Details", "Hub Assignment", "Hub Presence"];

  return (
    <div className="max-w-xl mx-auto space-y-6" data-testid="crown-onboarding-page">
      <div className="text-center">
        <Shield className="h-10 w-10 text-amber-500 mx-auto mb-3" />
        <h1 className="text-2xl font-bold" data-testid="text-onboarding-title">Crown Program Onboarding</h1>
        <p className="text-muted-foreground mt-1">
          Step {step} of {totalSteps}: {stepLabels[step - 1]}
        </p>
      </div>

      <div className="flex gap-1 mb-4">
        {stepLabels.map((_, i) => (
          <div key={i} className={`h-1.5 flex-1 rounded-full ${i < step ? "bg-amber-500" : "bg-gray-200 dark:bg-gray-700"}`} />
        ))}
      </div>

      {step === 1 && (
        <Card>
          <CardContent className="p-6 space-y-4">
            <h2 className="font-semibold">Select your participant type</h2>
            <div className="grid grid-cols-1 gap-3">
              {[
                { value: "business", label: "Local Business", desc: "Restaurant, shop, brewery, or service provider" },
                { value: "creator", label: "Creator / Influencer", desc: "Content creator, photographer, podcaster" },
                { value: "networking_group", label: "Networking Group", desc: "Business networking organization with chapters" },
                { value: "community_org", label: "Community Organization", desc: "Nonprofit, volunteer group, or community connector" },
              ].map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setParticipantType(opt.value)}
                  className={`text-left p-4 border rounded-lg transition-colors ${participantType === opt.value ? "border-amber-500 bg-amber-50 dark:bg-amber-950" : "border-gray-200 dark:border-gray-700 hover:border-gray-300"}`}
                  data-testid={`button-type-${opt.value}`}
                >
                  <p className="font-medium text-sm">{opt.label}</p>
                  <p className="text-xs text-muted-foreground">{opt.desc}</p>
                </button>
              ))}
            </div>
            <Button
              className="w-full"
              onClick={() => setStep(2)}
              disabled={!participantType}
              data-testid="button-step1-next"
            >
              Continue
            </Button>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardContent className="p-6 space-y-4">
            <h2 className="font-semibold">
              {(participantType === "networking_group" || participantType === "community_org") ? "Organization Details" : "Profile Details"}
            </h2>
            {(participantType === "business" || participantType === "networking_group" || participantType === "community_org") && (
              <>
                <div>
                  <label className="text-sm font-medium">Organization / Business Name</label>
                  <Input value={orgName} onChange={e => setOrgName(e.target.value)} data-testid="input-org-name" />
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" checked={isLocallyOwned} onChange={e => setIsLocallyOwned(e.target.checked)} data-testid="checkbox-locally-owned" />
                  <label className="text-sm">Locally owned (not a franchise or chain)</label>
                </div>
              </>
            )}
            {(participantType === "networking_group" || participantType === "community_org") && (
              <>
                <div>
                  <label className="text-sm font-medium">Chapter / Location Name</label>
                  <Input value={locationName} onChange={e => setLocationName(e.target.value)} data-testid="input-location-name" />
                </div>
                <div>
                  <label className="text-sm font-medium">Neighborhood</label>
                  <Input value={neighborhood} onChange={e => setNeighborhood(e.target.value)} data-testid="input-neighborhood" />
                </div>
              </>
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(1)} data-testid="button-step2-back">Back</Button>
              <Button className="flex-1" onClick={() => setStep(3)} data-testid="button-step2-next">Continue</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 3 && (
        <Card>
          <CardContent className="p-6 space-y-4">
            <h2 className="font-semibold">Category Assignment</h2>
            <p className="text-sm text-muted-foreground">
              Your category has been assigned based on your nomination. Hub assignment is determined by your location within the city.
            </p>
            {participant && (
              <div className="border rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Participant</span>
                  <span className="font-medium" data-testid="text-participant-name">{participant.name}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Category</span>
                  <span className="font-medium" data-testid="text-category-assigned">
                    {categories?.find(c => c.id === participant.categoryId)?.name || "Assigned"}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Type</span>
                  <span className="font-medium">{participantType || participant.participantType}</span>
                </div>
              </div>
            )}
            {!participant && (
              <p className="text-sm text-center text-muted-foreground py-4">
                Category and hub assignment details will be confirmed after invitation acceptance.
              </p>
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(2)} data-testid="button-step3-back">Back</Button>
              <Button className="flex-1" onClick={() => setStep(4)} data-testid="button-step3-next">Continue to Payment</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 4 && (
        <Card>
          <CardContent className="p-6 space-y-4">
            <h2 className="font-semibold">Activate Hub Presence</h2>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <Check className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-sm">Verified Listing</p>
                  <p className="text-xs text-muted-foreground">Your business or profile gets verified status on the platform</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Check className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-sm">Crown Program Nominee</p>
                  <p className="text-xs text-muted-foreground">Eligible for community votes and the Crown award</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Check className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-sm">Enhanced Visibility</p>
                  <p className="text-xs text-muted-foreground">Featured placement across the platform</p>
                </div>
              </div>
            </div>
            <div className="border-t pt-4 text-center">
              <p className="text-2xl font-bold mb-1">$99/year</p>
              <p className="text-xs text-muted-foreground mb-4">Annual Hub Presence subscription</p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(3)} data-testid="button-step4-back">Back</Button>
                <Button
                  className="flex-1"
                  size="lg"
                  onClick={() => payMutation.mutate()}
                  disabled={!(participantId || participant?.id) || payMutation.isPending}
                  data-testid="button-pay-verification"
                >
                  {payMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Shield className="h-4 w-4 mr-1" />}
                  Activate Hub Presence
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
