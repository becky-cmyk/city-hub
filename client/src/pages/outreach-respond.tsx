import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
  FormDescription,
} from "@/components/ui/form";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle, Loader2 } from "lucide-react";

const responseSchema = z.object({
  name: z.string().min(1, "Name is required"),
  businessPhone: z.string().optional(),
  personalPhone: z.string().optional(),
  email: z.string().email("Valid email required").optional().or(z.literal("")),
  zip: z.string().optional(),
  bestContactMethod: z.enum(["email", "text", "phone"]).optional(),
  role: z.enum(["owner", "manager", "teammate"]).optional(),
  submitterIsContact: z.boolean().default(true),
  contactPersonName: z.string().optional(),
  contactPersonEmail: z.string().optional(),
  contactPersonPhone: z.string().optional(),
  storyInterest: z.string().optional(),
  consentTerms: z.boolean().refine(v => v === true, "Required"),
  consentContact: z.boolean().refine(v => v === true, "Required"),
  consentPublish: z.boolean().default(false),
});

type ResponseFormData = z.infer<typeof responseSchema>;

interface OutreachRespondProps {
  citySlug: string;
  token: string;
}

export default function OutreachRespond({ citySlug, token }: OutreachRespondProps) {
  const [submitted, setSubmitted] = useState(false);

  const { data, isLoading, error } = useQuery<{
    businessName: string;
    businessPhone: string | null;
    businessAddress: string | null;
    variant: string;
    contact: { name?: string; email?: string; phone?: string; jobTitle?: string };
  }>({
    queryKey: ["/api/respond", token],
    queryFn: async () => {
      const res = await fetch(`/api/respond/${token}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to load");
      }
      return res.json();
    },
  });

  const form = useForm<ResponseFormData>({
    resolver: zodResolver(responseSchema),
    defaultValues: {
      name: "",
      businessPhone: "",
      personalPhone: "",
      email: "",
      zip: "",
      bestContactMethod: undefined,
      role: undefined,
      submitterIsContact: true,
      contactPersonName: "",
      contactPersonEmail: "",
      contactPersonPhone: "",
      storyInterest: "",
      consentTerms: false,
      consentContact: false,
      consentPublish: false,
    },
  });

  const submitterIsContact = form.watch("submitterIsContact");

  const submitMutation = useMutation({
    mutationFn: async (values: ResponseFormData) => {
      const res = await apiRequest("POST", `/api/respond/${token}`, values);
      return res.json();
    },
    onSuccess: () => setSubmitted(true),
  });

  useEffect(() => {
    if (data && !form.formState.isDirty && data.contact?.name && !form.getValues("name")) {
      form.reset({
        ...form.getValues(),
        name: data.contact.name || "",
        email: data.contact.email || "",
        personalPhone: data.contact.phone || "",
        businessPhone: data.businessPhone || "",
      });
    }
  }, [data, form]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900" data-testid="loading-outreach">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (error) {
    const errMsg = error instanceof Error ? error.message : "Something went wrong";
    const alreadyDone = errMsg.includes("Already responded");
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 px-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-8 pb-8 text-center">
            {alreadyDone ? (
              <>
                <CheckCircle className="h-12 w-12 text-emerald-500 mx-auto mb-4" />
                <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100 mb-2" data-testid="text-already-responded">Thank you!</h2>
                <p className="text-slate-600 dark:text-slate-400" data-testid="text-already-responded-msg">You've already submitted your response. We'll be in touch soon.</p>
              </>
            ) : (
              <>
                <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100 mb-2" data-testid="text-error-title">Link Not Found</h2>
                <p className="text-slate-600 dark:text-slate-400" data-testid="text-error-msg">This link may have expired or is no longer valid.</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 px-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-8 pb-8 text-center">
            <CheckCircle className="h-12 w-12 text-emerald-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100 mb-2" data-testid="text-thank-you">Thank you!</h2>
            <p className="text-slate-600 dark:text-slate-400 mb-1" data-testid="text-confirmation">We received your details and will be reaching out soon to get started on your story.</p>
            <p className="text-slate-500 dark:text-slate-500 text-sm mt-4">You can close this page.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 py-8 px-4">
      <div className="max-w-lg mx-auto">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2" data-testid="text-page-title">
            Confirm Your Details
          </h1>
          {data?.businessName && (
            <p className="text-slate-600 dark:text-slate-400" data-testid="text-business-name">
              for {data.businessName}
            </p>
          )}
        </div>

        <Card>
          <CardContent className="pt-6">
            <Form {...form}>
              <form onSubmit={form.handleSubmit((v) => submitMutation.mutate(v))} className="space-y-5">

                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Your Name</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Full name" data-testid="input-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="businessPhone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Business Phone</FormLabel>
                      <FormDescription>This may appear on your public profile</FormDescription>
                      <FormControl>
                        <Input {...field} placeholder="(555) 123-4567" data-testid="input-business-phone" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="personalPhone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Personal Phone</FormLabel>
                      <FormDescription>Private — will not be displayed publicly</FormDescription>
                      <FormControl>
                        <Input {...field} placeholder="(555) 987-6543" data-testid="input-personal-phone" />
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
                      <FormLabel>Email</FormLabel>
                      <FormDescription>Private — used for communication only</FormDescription>
                      <FormControl>
                        <Input {...field} type="email" placeholder="you@example.com" data-testid="input-email" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="zip"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Business ZIP Code</FormLabel>
                      <FormDescription>Helps us connect you with your local neighborhood hub</FormDescription>
                      <FormControl>
                        <Input {...field} placeholder="28202" maxLength={10} data-testid="input-zip" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="bestContactMethod"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Best Way to Reach You</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-contact-method">
                            <SelectValue placeholder="Select..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="email">Email</SelectItem>
                          <SelectItem value="text">Text</SelectItem>
                          <SelectItem value="phone">Phone Call</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Your Role</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-role">
                            <SelectValue placeholder="Select..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="owner">Owner</SelectItem>
                          <SelectItem value="manager">Manager</SelectItem>
                          <SelectItem value="teammate">Team Member</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="submitterIsContact"
                  render={({ field }) => (
                    <FormItem className="flex items-start gap-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="checkbox-is-contact"
                        />
                      </FormControl>
                      <div className="leading-none">
                        <FormLabel className="text-sm">I am the person to contact about this story</FormLabel>
                      </div>
                    </FormItem>
                  )}
                />

                {!submitterIsContact && (
                  <div className="space-y-3 pl-4 border-l-2 border-slate-200 dark:border-slate-700">
                    <FormField
                      control={form.control}
                      name="contactPersonName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Contact Person Name</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Name" data-testid="input-contact-person-name" />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="contactPersonEmail"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Contact Person Email</FormLabel>
                          <FormControl>
                            <Input {...field} type="email" placeholder="Email" data-testid="input-contact-person-email" />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="contactPersonPhone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Contact Person Phone</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Phone" data-testid="input-contact-person-phone" />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                )}

                <FormField
                  control={form.control}
                  name="storyInterest"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Anything you'd like us to know about your story?</FormLabel>
                      <FormControl>
                        <Textarea {...field} placeholder="Optional — tell us anything about your business, a cause you support, or what you'd like to share" rows={3} data-testid="textarea-story-interest" />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <div className="space-y-3 pt-2">
                  <FormField
                    control={form.control}
                    name="consentTerms"
                    render={({ field }) => (
                      <FormItem className="flex items-start gap-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            data-testid="checkbox-consent-terms"
                          />
                        </FormControl>
                        <div className="leading-none">
                          <FormLabel className="text-sm">I agree to the terms of service</FormLabel>
                          <FormMessage />
                        </div>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="consentContact"
                    render={({ field }) => (
                      <FormItem className="flex items-start gap-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            data-testid="checkbox-consent-contact"
                          />
                        </FormControl>
                        <div className="leading-none">
                          <FormLabel className="text-sm">I consent to being contacted via email, text, or phone</FormLabel>
                          <FormMessage />
                        </div>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="consentPublish"
                    render={({ field }) => (
                      <FormItem className="flex items-start gap-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            data-testid="checkbox-consent-publish"
                          />
                        </FormControl>
                        <div className="leading-none">
                          <FormLabel className="text-sm">I give permission for CLT Hub to publish about my business</FormLabel>
                        </div>
                      </FormItem>
                    )}
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={submitMutation.isPending}
                  data-testid="button-submit-response"
                >
                  {submitMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : null}
                  Confirm & Submit
                </Button>

                {submitMutation.isError && (
                  <p className="text-red-500 text-sm text-center" data-testid="text-submit-error">
                    {submitMutation.error instanceof Error ? submitMutation.error.message : "Failed to submit"}
                  </p>
                )}
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export function OutreachDecline({ citySlug, token }: OutreachRespondProps) {
  const { data, isLoading } = useQuery<{ declined: boolean; businessName: string }>({
    queryKey: ["/api/respond", token, "decline"],
    queryFn: async () => {
      const res = await fetch(`/api/respond/${token}/decline`);
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 px-4">
      <Card className="max-w-md w-full">
        <CardContent className="pt-8 pb-8 text-center">
          <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100 mb-3" data-testid="text-decline-title">
            No problem at all
          </h2>
          <p className="text-slate-600 dark:text-slate-400 mb-1" data-testid="text-decline-message">
            We'll check back another time. If you change your mind, just let us know.
          </p>
          <p className="text-slate-500 dark:text-slate-500 text-sm mt-4">You can close this page.</p>
        </CardContent>
      </Card>
    </div>
  );
}
