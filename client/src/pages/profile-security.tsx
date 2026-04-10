import { useState } from "react";
import { useAuth, User, UserHub } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Home,
  Briefcase,
  Gamepad2,
  Shield,
  Lock,
  Phone,
  Mail,
  MapPin,
  Trash2,
  Plus,
  Eye,
  EyeOff,
  Award,
  Star,
  Bookmark,
  FileText,
} from "lucide-react";

interface EngagementLevel {
  level: number;
  title: string;
  titleEs: string;
  savedCount: number;
  reviewCount: number;
  submissionCount: number;
  memberDays: number;
  nextLevel: { level: number; title: string; titleEs: string; requirements: string; requirementsEs: string } | null;
}

const LEVEL_STYLES: Record<number, string> = {
  1: "bg-muted text-muted-foreground",
  2: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  3: "bg-[#5B1D8F]/15 text-[#5B1D8F] dark:text-[#C084FC]",
  4: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
};

function computeProgressPercent(engagement: EngagementLevel): number {
  if (!engagement.nextLevel) return 100;
  const { level, savedCount, reviewCount, submissionCount, memberDays } = engagement;
  if (level === 1) {
    const savedProgress = Math.min(savedCount / 5, 1);
    const reviewProgress = Math.min(reviewCount / 1, 1);
    return Math.round(Math.max(savedProgress, reviewProgress) * 100);
  }
  if (level === 2) {
    const reviewProgress = Math.min(reviewCount / 3, 1);
    const submissionProgress = Math.min(submissionCount / 2, 1);
    return Math.round(Math.max(reviewProgress, submissionProgress) * 100);
  }
  if (level === 3) {
    const reviewProgress = Math.min(reviewCount / 10, 1);
    const daysProgress = Math.min(memberDays / 30, 1);
    return Math.round(((reviewProgress + daysProgress) / 2) * 100);
  }
  return 100;
}

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(1, "Please confirm your new password"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type ChangePasswordForm = z.infer<typeof changePasswordSchema>;

const HUB_ICONS: Record<string, typeof Home> = {
  HOME: Home,
  WORK: Briefcase,
  PLAY: Gamepad2,
};

const HUB_LABELS: Record<string, string> = {
  HOME: "Home",
  WORK: "Work",
  PLAY: "Play",
};

export default function ProfileSecurity({ citySlug }: { citySlug: string }) {
  const { user, isLoading, isLoggedIn } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [phoneInput, setPhoneInput] = useState("");
  const [recoveryEmailInput, setRecoveryEmailInput] = useState("");
  const [recoveryInitialized, setRecoveryInitialized] = useState(false);

  const [showAddHub, setShowAddHub] = useState(false);
  const [newHubType, setNewHubType] = useState("");
  const [newHubCity, setNewHubCity] = useState("");
  const [newHubZip, setNewHubZip] = useState("");
  const [newHubNeighborhood, setNewHubNeighborhood] = useState("");

  if (!recoveryInitialized && user?.recoveryEmail) {
    setRecoveryEmailInput(user.recoveryEmail);
    setRecoveryInitialized(true);
  }

  const passwordForm = useForm<ChangePasswordForm>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: async (data: ChangePasswordForm) => {
      await apiRequest("POST", "/api/auth/change-password", {
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      });
    },
    onSuccess: () => {
      toast({ title: "Password changed", description: "Your password has been updated successfully." });
      passwordForm.reset();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to change password", variant: "destructive" });
    },
  });

  const updatePhoneMutation = useMutation({
    mutationFn: async (phone: string | null) => {
      await apiRequest("POST", "/api/auth/update-phone", { phone });
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      toast({ title: "Phone updated", description: variables === null ? "Phone number removed." : "Phone number added." });
      setPhoneInput("");
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to update phone", variant: "destructive" });
    },
  });

  const updateRecoveryEmailMutation = useMutation({
    mutationFn: async (recoveryEmail: string) => {
      await apiRequest("POST", "/api/auth/update-recovery-email", { recoveryEmail });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      toast({ title: "Recovery email updated" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to update recovery email", variant: "destructive" });
    },
  });

  const deleteHubMutation = useMutation({
    mutationFn: async (hubType: string) => {
      await apiRequest("DELETE", `/api/auth/hubs/${hubType}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      toast({ title: "Hub removed" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to remove hub", variant: "destructive" });
    },
  });

  const addHubMutation = useMutation({
    mutationFn: async (data: { hubType: string; city: string; zip?: string; neighborhood?: string }) => {
      await apiRequest("POST", "/api/auth/hubs", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      toast({ title: "Hub added" });
      setShowAddHub(false);
      setNewHubType("");
      setNewHubCity("");
      setNewHubZip("");
      setNewHubNeighborhood("");
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to add hub", variant: "destructive" });
    },
  });

  const { data: engagement } = useQuery<EngagementLevel>({
    queryKey: ["/api/public/engagement-level"],
    enabled: isLoggedIn,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]" data-testid="loading-profile">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!isLoggedIn) {
    setLocation(`/${citySlug || ""}`);
    return null;
  }

  const hubs = user?.hubs || [];
  const usedHubTypes = hubs.map((h) => h.hubType);
  const availableHubTypes = (["WORK", "PLAY"] as const).filter((t) => !usedHubTypes.includes(t));

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center gap-3">
        <Shield className="h-7 w-7 text-[#5B1D8F]" />
        <h1 className="text-2xl font-bold" data-testid="text-page-title">Profile & Security</h1>
      </div>

      <Card className="p-6 space-y-3">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Mail className="h-5 w-5 text-[#5B1D8F]" />
          Account Info
        </h2>
        <div className="grid gap-2 text-sm">
          <div className="flex flex-wrap gap-2">
            <span className="text-muted-foreground">Name:</span>
            <span data-testid="text-display-name">{user?.displayName}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="text-muted-foreground">Email:</span>
            <span data-testid="text-email">{user?.email}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="text-muted-foreground">Account type:</span>
            <span data-testid="text-account-type">{user?.isAdmin ? "Admin" : "Member"}</span>
          </div>
        </div>
      </Card>

      {engagement && (
        <Card className="p-6 space-y-4" data-testid="card-your-impact">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Award className="h-5 w-5 text-[#5B1D8F]" />
            Your Impact
          </h2>
          <div className="flex items-center gap-3 flex-wrap">
            <Badge
              variant="secondary"
              className={`gap-1 ${LEVEL_STYLES[engagement.level] || ""}`}
              data-testid="badge-engagement-level"
            >
              <Award className="h-3 w-3" />
              Level {engagement.level}: {engagement.title}
            </Badge>
            <span className="text-sm text-muted-foreground" data-testid="text-member-days">
              Member for {engagement.memberDays} day{engagement.memberDays !== 1 ? "s" : ""}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="flex flex-col items-center gap-1 p-3 bg-muted/50 rounded-md" data-testid="stat-reviews">
              <Star className="h-4 w-4 text-amber-500" />
              <span className="text-xl font-bold">{engagement.reviewCount}</span>
              <span className="text-xs text-muted-foreground">Reviews</span>
            </div>
            <div className="flex flex-col items-center gap-1 p-3 bg-muted/50 rounded-md" data-testid="stat-saved">
              <Bookmark className="h-4 w-4 text-blue-500" />
              <span className="text-xl font-bold">{engagement.savedCount}</span>
              <span className="text-xs text-muted-foreground">Saved</span>
            </div>
            <div className="flex flex-col items-center gap-1 p-3 bg-muted/50 rounded-md" data-testid="stat-submissions">
              <FileText className="h-4 w-4 text-[#5B1D8F]" />
              <span className="text-xl font-bold">{engagement.submissionCount}</span>
              <span className="text-xs text-muted-foreground">Submissions</span>
            </div>
          </div>
          {engagement.nextLevel && (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="text-muted-foreground">
                  Next: <span className="font-medium text-foreground">{engagement.nextLevel.title}</span>
                </span>
                <span className="text-xs text-muted-foreground" data-testid="text-progress-percent">
                  {computeProgressPercent(engagement)}%
                </span>
              </div>
              <Progress value={computeProgressPercent(engagement)} className="h-2" data-testid="progress-next-level" />
              <p className="text-xs text-muted-foreground" data-testid="text-next-level-req">
                {engagement.nextLevel.requirements}
              </p>
            </div>
          )}
          {!engagement.nextLevel && (
            <p className="text-sm text-muted-foreground" data-testid="text-max-level">
              You've reached the highest level. Thank you for being an active community member!
            </p>
          )}
        </Card>
      )}

      <Card className="p-6 space-y-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Lock className="h-5 w-5 text-[#5B1D8F]" />
          Change Password
        </h2>
        <Form {...passwordForm}>
          <form
            onSubmit={passwordForm.handleSubmit((data) => changePasswordMutation.mutate(data))}
            className="space-y-4"
          >
            <FormField
              control={passwordForm.control}
              name="currentPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Current Password</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        type={showCurrentPassword ? "text" : "password"}
                        placeholder="Enter current password"
                        {...field}
                        data-testid="input-current-password"
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                        data-testid="button-toggle-current-password"
                        tabIndex={-1}
                      >
                        {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={passwordForm.control}
              name="newPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>New Password</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        type={showNewPassword ? "text" : "password"}
                        placeholder="Min 8 characters"
                        {...field}
                        data-testid="input-new-password"
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        data-testid="button-toggle-new-password"
                        tabIndex={-1}
                      >
                        {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={passwordForm.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirm New Password</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        type={showConfirmPassword ? "text" : "password"}
                        placeholder="Re-enter new password"
                        {...field}
                        data-testid="input-confirm-password"
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        data-testid="button-toggle-confirm-password"
                        tabIndex={-1}
                      >
                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button
              type="submit"
              disabled={changePasswordMutation.isPending}
              data-testid="button-change-password"
              className="bg-[#5B1D8F] hover:bg-[#5B1D8F]"
            >
              {changePasswordMutation.isPending ? "Updating..." : "Change Password"}
            </Button>
          </form>
        </Form>
      </Card>

      <Card className="p-6 space-y-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Phone className="h-5 w-5 text-[#5B1D8F]" />
          Phone Number
        </h2>
        {user?.phone ? (
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm" data-testid="text-phone">{user.phone}</span>
            <Button
              variant="destructive"
              size="sm"
              disabled={updatePhoneMutation.isPending}
              onClick={() => updatePhoneMutation.mutate(null)}
              data-testid="button-remove-phone"
            >
              Remove
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-3 flex-wrap">
            <Input
              type="tel"
              placeholder="Enter phone number"
              value={phoneInput}
              onChange={(e) => setPhoneInput(e.target.value)}
              className="max-w-xs"
              data-testid="input-phone"
            />
            <Button
              size="sm"
              disabled={!phoneInput || updatePhoneMutation.isPending}
              onClick={() => updatePhoneMutation.mutate(phoneInput)}
              data-testid="button-add-phone"
              className="bg-[#5B1D8F] hover:bg-[#5B1D8F]"
            >
              {updatePhoneMutation.isPending ? "Adding..." : "Add Phone"}
            </Button>
          </div>
        )}
        <p className="text-xs text-muted-foreground" data-testid="text-sms-note">SMS verification coming soon</p>
      </Card>

      <Card className="p-6 space-y-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Mail className="h-5 w-5 text-[#5B1D8F]" />
          Recovery Email
        </h2>
        <div className="flex items-center gap-3 flex-wrap">
          <Input
            type="email"
            placeholder="recovery@example.com"
            value={recoveryEmailInput}
            onChange={(e) => setRecoveryEmailInput(e.target.value)}
            className="max-w-xs"
            data-testid="input-recovery-email"
          />
          <Button
            size="sm"
            disabled={!recoveryEmailInput || updateRecoveryEmailMutation.isPending}
            onClick={() => updateRecoveryEmailMutation.mutate(recoveryEmailInput)}
            data-testid="button-update-recovery-email"
            className="bg-[#5B1D8F] hover:bg-[#5B1D8F]"
          >
            {updateRecoveryEmailMutation.isPending ? "Updating..." : "Update"}
          </Button>
        </div>
      </Card>

      <Card className="p-6 space-y-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <MapPin className="h-5 w-5 text-[#5B1D8F]" />
          My Hubs
        </h2>

        {hubs.length === 0 && (
          <p className="text-sm text-muted-foreground" data-testid="text-no-hubs">No hubs configured yet.</p>
        )}

        <div className="space-y-3">
          {hubs.map((hub) => {
            const Icon = HUB_ICONS[hub.hubType] || MapPin;
            return (
              <div
                key={hub.hubType}
                className="flex items-center gap-3 flex-wrap rounded-md border p-3"
                data-testid={`hub-item-${hub.hubType}`}
              >
                <Icon className="h-5 w-5 text-[#F2C230]" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm" data-testid={`text-hub-type-${hub.hubType}`}>
                      {HUB_LABELS[hub.hubType] || hub.hubType}
                    </span>
                    {hub.hubType === "HOME" && (
                      <Badge variant="secondary" className="text-xs" data-testid="badge-primary-hub">
                        Primary
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground" data-testid={`text-hub-location-${hub.hubType}`}>
                    {hub.city}
                    {hub.neighborhood ? ` \u00B7 ${hub.neighborhood}` : ""}
                  </p>
                </div>
                {hub.hubType !== "HOME" && (
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={deleteHubMutation.isPending}
                    onClick={() => deleteHubMutation.mutate(hub.hubType)}
                    data-testid={`button-remove-hub-${hub.hubType}`}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </div>
            );
          })}
        </div>

        {hubs.length < 3 && !showAddHub && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAddHub(true)}
            data-testid="button-show-add-hub"
          >
            <Plus className="h-4 w-4 mr-1" />
            Add Hub
          </Button>
        )}

        {showAddHub && (
          <div className="space-y-3 rounded-md border p-4" data-testid="form-add-hub">
            <div className="space-y-2">
              <label className="text-sm font-medium">Hub Type</label>
              <Select value={newHubType} onValueChange={setNewHubType}>
                <SelectTrigger data-testid="select-hub-type">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {availableHubTypes.map((t) => (
                    <SelectItem key={t} value={t} data-testid={`select-hub-type-option-${t}`}>
                      {HUB_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">City</label>
              <Input
                placeholder="City name"
                value={newHubCity}
                onChange={(e) => setNewHubCity(e.target.value)}
                data-testid="input-hub-city"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">ZIP (optional)</label>
              <Input
                placeholder="ZIP code"
                value={newHubZip}
                onChange={(e) => setNewHubZip(e.target.value)}
                data-testid="input-hub-zip"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Neighborhood (optional)</label>
              <Input
                placeholder="Neighborhood"
                value={newHubNeighborhood}
                onChange={(e) => setNewHubNeighborhood(e.target.value)}
                data-testid="input-hub-neighborhood"
              />
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <Button
                size="sm"
                disabled={!newHubType || !newHubCity || addHubMutation.isPending}
                onClick={() =>
                  addHubMutation.mutate({
                    hubType: newHubType,
                    city: newHubCity,
                    zip: newHubZip || undefined,
                    neighborhood: newHubNeighborhood || undefined,
                  })
                }
                data-testid="button-submit-add-hub"
                className="bg-[#5B1D8F] hover:bg-[#5B1D8F]"
              >
                {addHubMutation.isPending ? "Adding..." : "Add Hub"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowAddHub(false);
                  setNewHubType("");
                  setNewHubCity("");
                  setNewHubZip("");
                  setNewHubNeighborhood("");
                }}
                data-testid="button-cancel-add-hub"
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
