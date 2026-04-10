import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShieldCheck } from "lucide-react";
import { Link } from "wouter";
import { VerifiedBadge } from "@/components/verified-badge";
import { useQuery } from "@tanstack/react-query";

export default function VerificationSuccess({ citySlug }: { citySlug: string }) {
  const { data: status } = useQuery<{
    isVerifiedContributor: boolean;
    verificationTier: string | null;
  }>({
    queryKey: ["/api/contributor/status"],
  });

  return (
    <div className="max-w-xl mx-auto py-12">
      <Card className="p-8 text-center" data-testid="verification-success-card">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 mb-4">
          <ShieldCheck className="h-8 w-8 text-green-600" />
        </div>
        <h1 className="text-2xl font-bold mb-2" data-testid="text-verification-title">
          You're Verified
        </h1>
        {status?.isVerifiedContributor && (
          <div className="flex justify-center mb-3">
            <VerifiedBadge tier={status.verificationTier} size="md" showLabel />
          </div>
        )}
        <p className="text-muted-foreground mb-6">
          Thank you for supporting the community. Your contributions will now receive priority review,
          and your verified badge will appear on all your submissions.
        </p>
        <div className="space-y-3">
          <Link href={`/${citySlug}/submit`}>
            <Button className="w-full" data-testid="button-go-submit">Start Contributing</Button>
          </Link>
          <Link href={`/${citySlug}`}>
            <Button variant="ghost" className="w-full" data-testid="button-go-home">Back to Home</Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}
