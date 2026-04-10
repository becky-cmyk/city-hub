import { useMutation } from "@tanstack/react-query";
import { useCategories, useCityZones } from "@/hooks/use-city";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { eventSubmissionSchema, type EventSubmission } from "@shared/schema";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { ArrowLeft, Calendar, CheckCircle, Repeat } from "lucide-react";
import { useSmartBack } from "@/hooks/use-smart-back";
import { Link } from "wouter";
import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { AuthDialog } from "@/components/auth-dialog";
import { VerificationCTA } from "@/components/verification-cta";
import { useI18n } from "@/lib/i18n";

export default function SubmitEvent({ citySlug }: { citySlug: string }) {
  const { toast } = useToast();
  const { t } = useI18n();
  const smartBack = useSmartBack(`/${citySlug}/submit`);
  const { user, isLoading: authLoading } = useAuth();
  const [showAuthDialog, setShowAuthDialog] = useState(false);
  const { data: categories } = useCategories();
  const { data: zones } = useCityZones(citySlug);
  const [submitted, setSubmitted] = useState(false);

  const form = useForm<EventSubmission>({
    resolver: zodResolver(eventSubmissionSchema),
    defaultValues: {
      title: "",
      description: "",
      startDateTime: "",
      endDateTime: "",
      locationName: "",
      address: "",
      city: "",
      state: "",
      zip: "",
      costText: "",
      isRecurring: false,
      recurrencePattern: "",
      categoryIds: [],
      zoneId: "",
      submitterName: "",
      submitterEmail: "",
      submitterPhone: "",
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: EventSubmission) => {
      await apiRequest("POST", `/api/cities/${citySlug}/submissions`, {
        type: "EVENT",
        payload: data,
        submitterName: data.submitterName,
        submitterEmail: data.submitterEmail,
        zoneId: data.zoneId,
      });
    },
    onSuccess: () => setSubmitted(true),
    onError: () => {
      toast({ title: t("submitEvent.error"), description: t("submitEvent.couldNotSubmit"), variant: "destructive" });
    },
  });

  if (!authLoading && !user) {
    return (
      <div className="max-w-xl mx-auto">
        <Card className="p-8 text-center">
          <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">{t("submitEvent.signInTitle")}</h2>
          <p className="text-sm text-muted-foreground mb-6">{t("submitEvent.signInDesc")}</p>
          <Button onClick={() => setShowAuthDialog(true)} data-testid="button-auth-submit-event">{t("submitEvent.signInButton")}</Button>
          <AuthDialog open={showAuthDialog} onOpenChange={setShowAuthDialog} defaultTab="register" />
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="max-w-xl mx-auto">
        <Card className="p-8 text-center">
          <CheckCircle className="mx-auto h-12 w-12 text-green-500 mb-4" />
          <h2 className="text-xl font-bold mb-2">{t("submitEvent.submitted")}</h2>
          <p className="text-muted-foreground mb-4">{t("submitEvent.reviewShortly")}</p>
          <Link href={`/${citySlug}`}>
            <Button data-testid="button-back-home">{t("submitEvent.backToHome")}</Button>
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Button variant="ghost" size="sm" className="gap-1" onClick={smartBack}><ArrowLeft className="h-4 w-4" /> {t("submitEvent.back")}</Button>
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2 mb-1" data-testid="text-submit-event-title">
          <Calendar className="h-6 w-6 text-primary" />
          {t("submitEvent.title")}
        </h1>
        <p className="text-muted-foreground text-sm">{t("submitEvent.moderated")}</p>
      </div>
      {user && <VerificationCTA compact />}
      <Card className="p-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit((data) => mutation.mutate(data))} className="space-y-4">
            <FormField control={form.control} name="title" render={({ field }) => (
              <FormItem><FormLabel>{t("submitEvent.eventTitle")}</FormLabel><FormControl><Input {...field} data-testid="input-event-title" /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="description" render={({ field }) => (
              <FormItem><FormLabel>{t("submitEvent.description")}</FormLabel><FormControl><Textarea {...field} data-testid="input-event-description" /></FormControl><FormMessage /></FormItem>
            )} />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField control={form.control} name="startDateTime" render={({ field }) => (
                <FormItem><FormLabel>{t("submitEvent.startDate")}</FormLabel><FormControl><Input type="datetime-local" {...field} data-testid="input-event-start" /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="endDateTime" render={({ field }) => (
                <FormItem><FormLabel>{t("submitEvent.endDate")}</FormLabel><FormControl><Input type="datetime-local" {...field} data-testid="input-event-end" /></FormControl><FormMessage /></FormItem>
              )} />
            </div>
            <FormField control={form.control} name="locationName" render={({ field }) => (
              <FormItem><FormLabel>{t("submitEvent.venue")}</FormLabel><FormControl><Input {...field} data-testid="input-event-venue" /></FormControl><FormMessage /></FormItem>
            )} />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField control={form.control} name="address" render={({ field }) => (
                <FormItem><FormLabel>{t("submitEvent.address")}</FormLabel><FormControl><Input {...field} data-testid="input-event-address" /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="city" render={({ field }) => (
                <FormItem><FormLabel>{t("submitEvent.city")}</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="state" render={({ field }) => (
                <FormItem><FormLabel>{t("submitEvent.state")}</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="zip" render={({ field }) => (
                <FormItem><FormLabel>{t("submitEvent.zip")}</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
            </div>
            <FormField control={form.control} name="costText" render={({ field }) => (
              <FormItem><FormLabel>{t("submitEvent.cost")}</FormLabel><FormControl><Input placeholder="e.g. Free, $10, $25-50" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
              <FormField control={form.control} name="isRecurring" render={({ field }) => (
                <FormItem className="flex items-center gap-3">
                  <FormControl>
                    <Checkbox checked={field.value} onCheckedChange={field.onChange} data-testid="checkbox-event-recurring" />
                  </FormControl>
                  <div className="flex items-center gap-2">
                    <Repeat className="h-4 w-4 text-muted-foreground" />
                    <FormLabel className="!mt-0">{t("submitEvent.isRecurring")}</FormLabel>
                  </div>
                </FormItem>
              )} />
              {form.watch("isRecurring") && (
                <FormField control={form.control} name="recurrencePattern" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("submitEvent.howOften")}</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl><SelectTrigger data-testid="select-event-recurrence"><SelectValue placeholder={t("submitEvent.selectFrequency")} /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="weekly">{t("submitEvent.weekly")}</SelectItem>
                        <SelectItem value="biweekly">{t("submitEvent.biweekly")}</SelectItem>
                        <SelectItem value="monthly">{t("submitEvent.monthly")}</SelectItem>
                        <SelectItem value="first_of_month">{t("submitEvent.firstOfMonth")}</SelectItem>
                        <SelectItem value="last_of_month">{t("submitEvent.lastOfMonth")}</SelectItem>
                        <SelectItem value="quarterly">{t("submitEvent.quarterly")}</SelectItem>
                        <SelectItem value="other">{t("submitEvent.other")}</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              )}
            </div>
            <FormField control={form.control} name="zoneId" render={({ field }) => (
              <FormItem>
                <FormLabel>{t("submitEvent.neighborhood")}</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl><SelectTrigger data-testid="select-event-zone"><SelectValue placeholder={t("submitEvent.selectNeighborhood")} /></SelectTrigger></FormControl>
                  <SelectContent>{zones?.map((z) => (<SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>))}</SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="categoryIds" render={({ field }) => (
              <FormItem>
                <FormLabel>{t("submitEvent.categories")}</FormLabel>
                <div className="flex flex-wrap gap-3">
                  {categories?.map((cat) => (
                    <label key={cat.id} className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox checked={field.value.includes(cat.id)} onCheckedChange={(checked) => {
                        if (checked) field.onChange([...field.value, cat.id]);
                        else field.onChange(field.value.filter((id: string) => id !== cat.id));
                      }} />
                      {cat.name}
                    </label>
                  ))}
                </div>
                <FormMessage />
              </FormItem>
            )} />
            <div className="border-t pt-4 space-y-4">
              <h3 className="font-semibold text-sm">{t("submitEvent.yourInfo")}</h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField control={form.control} name="submitterName" render={({ field }) => (
                  <FormItem><FormLabel>{t("submitEvent.yourName")}</FormLabel><FormControl><Input {...field} data-testid="input-submitter-name" /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="submitterEmail" render={({ field }) => (
                  <FormItem><FormLabel>{t("submitEvent.yourEmail")}</FormLabel><FormControl><Input type="email" {...field} data-testid="input-submitter-email" /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="submitterPhone" render={({ field }) => (
                  <FormItem><FormLabel>{t("submitEvent.yourPhone")}</FormLabel><FormControl><Input type="tel" placeholder="(555) 123-4567" {...field} data-testid="input-submitter-phone" /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={mutation.isPending} data-testid="button-submit-event">
              {mutation.isPending ? t("submitEvent.submitting") : t("submitEvent.submit")}
            </Button>
          </form>
        </Form>
      </Card>
    </div>
  );
}
