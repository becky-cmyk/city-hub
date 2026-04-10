import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Mail, MessageCircle, Phone, AlertTriangle, CheckCircle2, Users } from "lucide-react";

type ChannelHealth = {
  channels: {
    email: { enabled: boolean; recentSent: number; contactsReachable: number };
    sms: { enabled: boolean; recentSent: number; contactsReachable: number };
    voice: { enabled: boolean; recentSent: number; contactsReachable: number };
  };
  templates: { sms: number; voicePrompts: number };
  sequences: number;
  delivery: { failed: number };
};

const CHANNEL_CONFIG = [
  { key: "email" as const, label: "Email", icon: Mail },
  { key: "sms" as const, label: "SMS", icon: MessageCircle },
  { key: "voice" as const, label: "Voice", icon: Phone },
];

export default function ChannelHealthPanel() {
  const { data, isLoading } = useQuery<ChannelHealth>({
    queryKey: ["/api/admin/comm/channel-health"],
  });

  if (isLoading) {
    return <div className="flex items-center justify-center p-12 text-muted-foreground" data-testid="loading-channel-health">Loading channel health...</div>;
  }

  if (!data) {
    return <div className="text-center p-12 text-muted-foreground" data-testid="error-channel-health">Unable to load channel data</div>;
  }

  return (
    <div className="space-y-6" data-testid="panel-channel-health">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {CHANNEL_CONFIG.map(({ key, label, icon: Icon }) => {
          const ch = data.channels[key];
          return (
            <Card key={key} data-testid={`card-channel-${key}`}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4" />
                    <CardTitle className="text-sm font-medium" data-testid={`text-channel-label-${key}`}>{label}</CardTitle>
                  </div>
                  {ch.enabled ? (
                    <Badge variant="outline" className="bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400" data-testid={`badge-channel-enabled-${key}`}>
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Enabled
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-yellow-50 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" data-testid={`badge-channel-pending-${key}`}>
                      Pending Setup
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Sent</span>
                  <span className="font-medium" data-testid={`text-channel-sent-${key}`}>{ch.recentSent}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Users className="h-3 w-3" />
                    Reachable
                  </div>
                  <span className="font-medium" data-testid={`text-channel-reachable-${key}`}>{ch.contactsReachable}</span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card data-testid="card-template-stats">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">SMS Templates</CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-bold" data-testid="text-sms-template-count">{data.templates.sms}</span>
            <span className="text-sm text-muted-foreground ml-1">active</span>
          </CardContent>
        </Card>
        <Card data-testid="card-voice-stats">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Voice Prompts</CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-bold" data-testid="text-voice-prompt-count">{data.templates.voicePrompts}</span>
            <span className="text-sm text-muted-foreground ml-1">active</span>
          </CardContent>
        </Card>
        <Card data-testid="card-sequence-stats">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Sequences</CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-bold" data-testid="text-sequence-count">{data.sequences}</span>
            <span className="text-sm text-muted-foreground ml-1">configured</span>
          </CardContent>
        </Card>
      </div>

      {data.delivery.failed > 0 && (
        <Card className="border-destructive" data-testid="card-delivery-failures">
          <CardContent className="flex items-center gap-3 py-4">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <div>
              <p className="text-sm font-medium" data-testid="text-failed-count">{data.delivery.failed} failed deliveries</p>
              <p className="text-xs text-muted-foreground">Check the comms log for details</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
