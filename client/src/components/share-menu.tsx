import { Copy, Mail, MessageCircle, Share2, Twitter, Download } from "lucide-react";
import { SiFacebook, SiWhatsapp, SiTiktok, SiLinkedin, SiReddit, SiNextdoor } from "react-icons/si";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/lib/i18n";
import { apiRequest } from "@/lib/queryClient";
import { useState, useEffect } from "react";

interface ShareMenuProps {
  title: string;
  url?: string;
  type: "business" | "event" | "article" | "microsite" | "post" | "reel";
  slug: string;
  eventId?: string;
  trigger?: React.ReactNode;
  triggerClassName?: string;
}

function isMobileDevice(): boolean {
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

export function ShareMenu({ title, url, type, slug, eventId, trigger, triggerClassName }: ShareMenuProps) {
  const { t, locale } = useI18n();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setIsMobile(isMobileDevice());
  }, []);

  const shareUrl = url || window.location.href;
  const shareText = locale === "es"
    ? `${title} — Descubre en CLT Metro Hub`
    : `${title} — Discover on CLT Metro Hub`;
  const shareSubject = locale === "es"
    ? `Mira esto en CLT Metro Hub: ${title}`
    : `Check this out on CLT Metro Hub: ${title}`;

  const trackShare = (channel: string) => {
    apiRequest("POST", "/api/track-share", { type, slug, channel }).catch(() => {});
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast({ title: t("share.linkCopied") });
      trackShare("copy");
      setOpen(false);
    } catch {
      toast({ title: t("toast.error"), variant: "destructive" });
    }
  };

  const handleWhatsApp = () => {
    trackShare("whatsapp");
    window.open(`https://wa.me/?text=${encodeURIComponent(`${shareText}\n${shareUrl}`)}`, "_blank");
    setOpen(false);
  };

  const handleFacebook = () => {
    trackShare("facebook");
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`, "_blank");
    setOpen(false);
  };

  const handleTwitter = () => {
    trackShare("twitter");
    window.open(`https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`, "_blank");
    setOpen(false);
  };

  const handleEmail = () => {
    trackShare("email");
    window.location.href = `mailto:?subject=${encodeURIComponent(shareSubject)}&body=${encodeURIComponent(`${shareText}\n\n${shareUrl}`)}`;
    setOpen(false);
  };

  const handleSms = () => {
    trackShare("sms");
    window.location.href = `sms:?body=${encodeURIComponent(`${shareText} ${shareUrl}`)}`;
    setOpen(false);
  };

  const handleLinkedIn = () => {
    trackShare("linkedin");
    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`, "_blank");
    setOpen(false);
  };

  const handleReddit = () => {
    trackShare("reddit");
    window.open(`https://www.reddit.com/submit?url=${encodeURIComponent(shareUrl)}&title=${encodeURIComponent(title)}`, "_blank");
    setOpen(false);
  };

  const handleTikTok = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast({ title: locale === "es" ? "Enlace copiado — pega en TikTok" : "Link copied — paste in TikTok" });
      trackShare("tiktok");
      setOpen(false);
    } catch {
      toast({ title: t("toast.error"), variant: "destructive" });
    }
  };

  const handleNextdoor = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast({ title: locale === "es" ? "Enlace copiado — pega en Nextdoor" : "Link copied — paste in Nextdoor" });
      trackShare("nextdoor");
      setOpen(false);
    } catch {
      toast({ title: t("toast.error"), variant: "destructive" });
    }
  };

  const handleCalendarDownload = () => {
    if (eventId) {
      trackShare("ics");
      window.open(`/api/events/${eventId}/calendar.ics`, "_blank");
      setOpen(false);
    }
  };

  const channels = [
    { key: "copy", label: t("share.copyLink"), icon: Copy, onClick: handleCopyLink },
    { key: "whatsapp", label: "WhatsApp", icon: SiWhatsapp, onClick: handleWhatsApp },
    { key: "facebook", label: "Facebook", icon: SiFacebook, onClick: handleFacebook },
    { key: "twitter", label: "X / Twitter", icon: Twitter, onClick: handleTwitter },
    { key: "linkedin", label: "LinkedIn", icon: SiLinkedin, onClick: handleLinkedIn },
    { key: "reddit", label: "Reddit", icon: SiReddit, onClick: handleReddit },
    { key: "tiktok", label: "TikTok", icon: SiTiktok, onClick: handleTikTok },
    { key: "nextdoor", label: "Nextdoor", icon: SiNextdoor, onClick: handleNextdoor },
    { key: "email", label: t("share.email"), icon: Mail, onClick: handleEmail },
    ...(isMobile ? [{ key: "sms", label: t("share.sms"), icon: MessageCircle, onClick: handleSms }] : []),
    ...(type === "event" && eventId ? [{ key: "calendar", label: locale === "es" ? "Descargar .ics" : "Add to Calendar", icon: Download, onClick: handleCalendarDownload }] : []),
  ];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {trigger || (
          <Button variant="outline" size="icon" className={triggerClassName} data-testid="button-share">
            <Share2 className="h-4 w-4" />
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56 p-2 max-h-80 overflow-y-auto">
        <p className="text-xs font-semibold text-muted-foreground px-2 py-1.5 uppercase" data-testid="text-share-heading">
          {t("share.title")}
        </p>
        <div className="space-y-0.5">
          {channels.map((ch) => (
            <button
              key={ch.key}
              onClick={ch.onClick}
              className="flex items-center gap-2.5 w-full px-2 py-2 text-sm rounded-md hover-elevate transition-colors"
              data-testid={`button-share-${ch.key}`}
            >
              <ch.icon className="h-4 w-4 shrink-0" />
              <span>{ch.label}</span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
