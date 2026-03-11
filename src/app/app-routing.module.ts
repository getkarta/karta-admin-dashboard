import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { LoginComponent } from './login/login.component';
import { OnboardComponent } from './onboard/onboard.component';
import { TrainComponent } from './train/train.component';
import { HomeComponent } from './home/home.component';
import { AgentTestComponent } from './agent-test/agent-test.component';
import { ConversationsComponent } from './conversations/conversations.component';
import { InsightsComponent } from './insights/insights.component';
import { VoiceInsightsComponent } from './voice-insights/voice-insights.component';
import { IntegrationsComponent } from './train/integrations/integrations.component';
import { VoiceAgentComponent } from './voice-agent/voice-agent.component';
import { VoiceAgentDemoComponent } from './voice-agent-demo/voice-agent-demo.component';
import { DocsComponent } from './docs/docs.component';
import { NumbersComponent } from './numbers/numbers.component';
import { CallLogsComponent } from './call-logs/call-logs.component';
import { BatchUploadComponent } from './batch-upload/batch-upload.component';
import { CampaignsComponent } from './campaigns/campaigns.component';
import { AgentOnboardComponent } from './agent-onboard/agent-onboard.component';
import { SubscriptionComponent } from './subscription/subscription.component';
import { QualityAgentComponent } from './quality-agent/quality-agent.component';
import { QaAgentTestComponent } from './qa-agent-test/qa-agent-test.component';
import { SettingsComponent } from './settings/settings.component';
import { CommonComponentsComponent } from './common-components/common-components.component';
import { AddOnToolComponent } from './add-on-tool/add-on-tool.component';

export const routes: Routes = [
  {
      path: 'home',
      component: HomeComponent
  },
  {
      path: 'login',
      component: LoginComponent
  },
  {
      path: 'common-components',
      component: CommonComponentsComponent
  },
  {
    path: 'agent/compliance/:clientCode',
    component: AgentOnboardComponent
  },
  {
    path: 'agent/chat/:clientCode',
    component: TrainComponent
  },
  {
    path: 'agent/voice/:clientCode',
    component: VoiceAgentComponent
  },
  {
    path: 'test',
    component: AgentTestComponent
  },
  {
    path: 'conversations',
    component: ConversationsComponent
  },
  {
    path: 'integration',
    component: IntegrationsComponent
  },
  {
    path: 'insights',
    component: InsightsComponent
  },
  {
    path: 'voice-insights',
    component: VoiceInsightsComponent
  },
  {
    path: 'numbers',
    component: NumbersComponent
  },
  {
    path: 'call-logs',
    component: CallLogsComponent
  },
  {
    path: 'campaigns',
    component: CampaignsComponent
  },
  {
      path: 'Billing',
      component: SubscriptionComponent
  },
  {
    path: 'settings',
    component: SettingsComponent
  },
  {
    path: 'tools',
    component: AddOnToolComponent
  },
  {
    path: 'agent/audit/:clientCode',
    component: QualityAgentComponent
  },
  {
    path: 'qa-agent-test',
    component: QaAgentTestComponent
  },
  {
    path: 'demo/onboarding',
    component: DocsComponent
  },
  {
    path: 'demo/voice-agent',
    component: VoiceAgentDemoComponent
  },
  {
    path: 'batch-upload',
    component: BatchUploadComponent
  },
  {
    path: '',
    redirectTo: '/home',
    pathMatch: 'full'
  },
  
    
  {
    path: 'integration',
    component: IntegrationsComponent
  },
  {
    path: '**',
    redirectTo: '/home'
  }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
