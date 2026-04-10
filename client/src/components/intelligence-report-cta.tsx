import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { BarChart3, CheckCircle, Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/lib/i18n";

interface IntelligenceReportCTAProps {
  citySlug: string;
  entityType: "BUSINESS" | "MULTIFAMILY";
  entityId: string;
  entityName: string;
}

const ROLE_KEYS = [
  { value: "OWNER", labelKey: "report.roleOwner" as const },
  { value: "MANAGER", labelKey: "report.roleManager" as const },
  { value: "MARKETER", labelKey: "report.roleMarketer" as const },
  { value: "LEASING", labelKey: "report.roleLeasing" as const },
  { value: "VENDOR", labelKey: "report.roleVendor" as const },
  { value: "OTHER", labelKey: "report.roleOther" as const },
];

const REASON_KEYS = [
  { value: "GROW_SALES", labelKey: "report.reasonGrowSales" as const },
  { value: "GET_MORE_LEADS", labelKey: "report.reasonMoreLeads" as const },
  { value: "UNDERSTAND_CUSTOMERS", labelKey: "report.reasonUnderstandCustomers" as const },
  { value: "LEASE_UP", labelKey: "report.reasonLeaseUp" as const },
  { value: "NEW_OPENING", labelKey: "report.reasonNewOpening" as const },
  { value: "OTHER", labelKey: "report.reasonOther" as const },
];

export default function IntelligenceReportCTA({ citySlug, entityType, entityId, entityName }: IntelligenceReportCTAProps) {
  const [open, setOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("");
  const [reason, setReason] = useState("");
  const [consent, setConsent] = useState(true);
  const { toast } = useToast();
  const { locale, t } = useI18n();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !role || !reason) {
      toast({ title: t("report.fillRequired"), variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      await apiRequest("POST", "/api/intelligence/request-report", {
        citySlug,
        entityType,
        entityId,
        requesterName: name.trim(),
        requesterEmail: email.trim(),
        requesterPhone: phone.trim() || undefined,
        requesterRole: role,
        preferredLanguage: locale,
        requestReason: reason,
        consentToContact: consent,
      });
      setSubmitted(true);
    } catch (err: any) {
      toast({ title: t("report.error"), description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Card className="p-5 border-purple-200 dark:border-purple-800 bg-gradient-to-br from-purple-50 to-white dark:from-purple-950/30 dark:to-background" data-testid="card-intelligence-report-cta">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-lg bg-purple-600 flex items-center justify-center shrink-0">
            <BarChart3 className="h-5 w-5 text-white" />
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-sm" data-testid="text-cta-heading">{t("report.requestTitle")}</h3>
            <p className="text-xs text-muted-foreground mt-1">{t("report.requestDesc")}</p>
          </div>
        </div>
        <Button
          className="w-full mt-4 bg-purple-600 hover:bg-purple-700 text-white"
          onClick={() => setOpen(true)}
          data-testid="button-request-report"
        >
          <BarChart3 className="h-4 w-4 mr-2" />
          {t("report.requestButton")}
        </Button>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md" data-testid="dialog-report-request">
          <DialogHeader>
            <DialogTitle>{t("report.dialogTitle")}</DialogTitle>
            <DialogDescription>
              {t("report.dialogDesc", { name: entityName })}
            </DialogDescription>
          </DialogHeader>

          {submitted ? (
            <div className="text-center py-6 space-y-3" data-testid="report-request-success">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto" />
              <h3 className="font-semibold text-lg">{t("report.thankYou")}</h3>
              <p className="text-sm text-muted-foreground">{t("report.emailWhenReady")}</p>
              <Button variant="outline" onClick={() => { setOpen(false); }} data-testid="button-close-success">{t("report.close")}</Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="report-name">{t("report.name")}</Label>
                <Input id="report-name" value={name} onChange={e => setName(e.target.value)} placeholder={t("report.namePlaceholder")} required data-testid="input-report-name" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="report-email">{t("report.email")}</Label>
                <Input id="report-email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder={t("report.emailPlaceholder")} required data-testid="input-report-email" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="report-phone">{t("report.phone")}</Label>
                <Input id="report-phone" type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder={t("report.phonePlaceholder")} data-testid="input-report-phone" />
              </div>

              <div className="space-y-2">
                <Label>{t("report.yourRole")}</Label>
                <Select value={role} onValueChange={setRole}>
                  <SelectTrigger data-testid="select-report-role">
                    <SelectValue placeholder={t("report.selectRole")} />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLE_KEYS.map(o => (
                      <SelectItem key={o.value} value={o.value}>{t(o.labelKey)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{t("report.whyReport")}</Label>
                <Select value={reason} onValueChange={setReason}>
                  <SelectTrigger data-testid="select-report-reason">
                    <SelectValue placeholder={t("report.selectReason")} />
                  </SelectTrigger>
                  <SelectContent>
                    {REASON_KEYS.map(o => (
                      <SelectItem key={o.value} value={o.value}>{t(o.labelKey)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <Checkbox id="report-consent" checked={consent} onCheckedChange={(c) => setConsent(c === true)} data-testid="checkbox-report-consent" />
                <Label htmlFor="report-consent" className="text-xs text-muted-foreground cursor-pointer">{t("report.consentLabel")}</Label>
              </div>

              <Button type="submit" disabled={submitting} className="w-full bg-purple-600 hover:bg-purple-700 text-white" data-testid="button-submit-report-request">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                {submitting ? t("report.submitting") : t("report.requestMyReport")}
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
