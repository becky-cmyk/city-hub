import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Mail, Send, MessageCircle, Bell, ShieldOff, FileText, Mic, Workflow, Activity } from "lucide-react";
import EmailTemplatesPanel from "./email-templates-panel";
import EmailCampaignsPanel from "./email-campaigns-panel";
import SmsConversationsPanel from "./sms-conversations-panel";
import WeeklyDigestPanel from "./weekly-digest-panel";
import EmailSuppressionPanel from "./email-suppression-panel";
import SmsTemplatesPanel from "./sms-templates-panel";
import VoicePromptsPanel from "./voice-prompts-panel";
import CommSequencesPanel from "./comm-sequences-panel";
import ChannelHealthPanel from "./channel-health-panel";

export default function CommunicationsHub({ cityId }: { cityId?: string }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" data-testid="text-communications-hub-title">
          Communications Hub
        </h1>
        <p className="text-sm text-muted-foreground" data-testid="text-communications-hub-subtitle">
          Multi-channel communication management — email, SMS, voice, sequences, and delivery health
        </p>
      </div>

      <Tabs defaultValue="channel-health" data-testid="tabs-communications-hub">
        <TabsList className="flex flex-wrap h-auto gap-1" data-testid="tabs-list-communications">
          <TabsTrigger value="channel-health" data-testid="tab-trigger-channel-health">
            <Activity className="h-4 w-4 mr-1.5" />
            Channels
          </TabsTrigger>
          <TabsTrigger value="templates" data-testid="tab-trigger-templates">
            <Mail className="h-4 w-4 mr-1.5" />
            Email Templates
          </TabsTrigger>
          <TabsTrigger value="campaigns" data-testid="tab-trigger-campaigns">
            <Send className="h-4 w-4 mr-1.5" />
            Campaigns
          </TabsTrigger>
          <TabsTrigger value="sms" data-testid="tab-trigger-sms">
            <MessageCircle className="h-4 w-4 mr-1.5" />
            SMS Conversations
          </TabsTrigger>
          <TabsTrigger value="sms-templates" data-testid="tab-trigger-sms-templates">
            <FileText className="h-4 w-4 mr-1.5" />
            SMS Templates
          </TabsTrigger>
          <TabsTrigger value="voice-prompts" data-testid="tab-trigger-voice-prompts">
            <Mic className="h-4 w-4 mr-1.5" />
            Voice Prompts
          </TabsTrigger>
          <TabsTrigger value="sequences" data-testid="tab-trigger-sequences">
            <Workflow className="h-4 w-4 mr-1.5" />
            Sequences
          </TabsTrigger>
          <TabsTrigger value="digest" data-testid="tab-trigger-digest">
            <Bell className="h-4 w-4 mr-1.5" />
            Weekly Digest
          </TabsTrigger>
          <TabsTrigger value="suppression" data-testid="tab-trigger-suppression">
            <ShieldOff className="h-4 w-4 mr-1.5" />
            Suppression
          </TabsTrigger>
        </TabsList>

        <TabsContent value="channel-health" data-testid="tab-content-channel-health">
          <ChannelHealthPanel />
        </TabsContent>
        <TabsContent value="templates" data-testid="tab-content-templates">
          <EmailTemplatesPanel />
        </TabsContent>
        <TabsContent value="campaigns" data-testid="tab-content-campaigns">
          <EmailCampaignsPanel />
        </TabsContent>
        <TabsContent value="sms" data-testid="tab-content-sms">
          <SmsConversationsPanel />
        </TabsContent>
        <TabsContent value="sms-templates" data-testid="tab-content-sms-templates">
          <SmsTemplatesPanel />
        </TabsContent>
        <TabsContent value="voice-prompts" data-testid="tab-content-voice-prompts">
          <VoicePromptsPanel />
        </TabsContent>
        <TabsContent value="sequences" data-testid="tab-content-sequences">
          <CommSequencesPanel />
        </TabsContent>
        <TabsContent value="digest" data-testid="tab-content-digest">
          <WeeklyDigestPanel />
        </TabsContent>
        <TabsContent value="suppression" data-testid="tab-content-suppression">
          <EmailSuppressionPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
