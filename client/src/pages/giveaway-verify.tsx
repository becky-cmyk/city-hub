import { usePageMeta } from "@/hooks/use-page-meta";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, XCircle, Clock } from "lucide-react";
import { Link } from "wouter";

export default function GiveawayVerify({ citySlug }: { citySlug?: string }) {
  const params = new URLSearchParams(window.location.search);
  const status = params.get("status") || "invalid";
  const giveawaySlug = params.get("giveaway") || "";
  const giveawayTitle = params.get("title") || "";
  const entrantName = params.get("name") || "";
  const resolvedCity = citySlug || "charlotte";

  usePageMeta({
    title: status === "success" ? "Email Verified | CLT Metro Hub" : "Verification | CLT Metro Hub",
    description: "Verify your giveaway entry",
  });

  return (
    <div className="max-w-lg mx-auto px-4 py-16">
      <Card className="bg-[#1e1e3a] border-[#2a2a4a]">
        <CardContent className="p-8 text-center">
          {status === "success" && (
            <>
              <CheckCircle2 className="h-16 w-16 mx-auto mb-4 text-emerald-400" />
              <h1 className="text-2xl font-bold text-white mb-2" data-testid="text-verify-success">Email Verified</h1>
              <p className="text-neutral-300 mb-1">{entrantName ? `Hey ${entrantName}!` : "You're all set!"}</p>
              <p className="text-neutral-400 mb-6">
                Your entry for <strong className="text-white">{giveawayTitle || "the giveaway"}</strong> is confirmed. Good luck!
              </p>
              {giveawaySlug && (
                <Link href={`/${resolvedCity}/enter-to-win/${giveawaySlug}`}>
                  <span className="inline-block bg-[#F2C230] text-[#1a1a2e] font-semibold px-6 py-2 rounded-lg cursor-pointer" data-testid="link-back-to-giveaway">
                    View Giveaway
                  </span>
                </Link>
              )}
            </>
          )}

          {status === "already" && (
            <>
              <CheckCircle2 className="h-16 w-16 mx-auto mb-4 text-blue-400" />
              <h1 className="text-2xl font-bold text-white mb-2" data-testid="text-verify-already">Already Verified</h1>
              <p className="text-neutral-400 mb-6">This entry was already verified. You're good to go!</p>
              {giveawaySlug && (
                <Link href={`/${resolvedCity}/enter-to-win/${giveawaySlug}`}>
                  <span className="inline-block bg-[#F2C230] text-[#1a1a2e] font-semibold px-6 py-2 rounded-lg cursor-pointer" data-testid="link-back-to-giveaway">
                    View Giveaway
                  </span>
                </Link>
              )}
            </>
          )}

          {status === "expired" && (
            <>
              <Clock className="h-16 w-16 mx-auto mb-4 text-orange-400" />
              <h1 className="text-2xl font-bold text-white mb-2" data-testid="text-verify-expired">Link Expired</h1>
              <p className="text-neutral-400 mb-6">This verification link has expired. You may need to re-enter the giveaway.</p>
            </>
          )}

          {status === "invalid" && (
            <>
              <XCircle className="h-16 w-16 mx-auto mb-4 text-red-400" />
              <h1 className="text-2xl font-bold text-white mb-2" data-testid="text-verify-invalid">Invalid Link</h1>
              <p className="text-neutral-400 mb-6">This verification link is not valid. It may have already been used or does not exist.</p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
