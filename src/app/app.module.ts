import { CUSTOM_ELEMENTS_SCHEMA, NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { HTTP_INTERCEPTORS } from '@angular/common/http';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { NgxEchartsModule } from 'ngx-echarts';
import * as echarts from 'echarts/core';
import { ToastrModule } from 'ngx-toastr';
import { NgxMaterialTimepickerModule } from 'ngx-material-timepicker';
import { SidebarComponent } from './sidebar/sidebar.component';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { MatSlideToggle, MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSidenav, MatSidenavContainer, MatSidenavContent, MatSidenavModule } from '@angular/material/sidenav';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatList, MatListModule } from '@angular/material/list';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { ContentComponent } from './content/content.component';
import { MatIcon, MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatMenuModule } from '@angular/material/menu';
import { DashboardComponent } from './dashboard/dashboard.component';
import { OnboardComponent } from './onboard/onboard.component';
import { TrainComponent } from './train/train.component';
import { VoiceAgentComponent } from './voice-agent/voice-agent.component';
import { LivekitComponent } from './agent-test/livekit.component';
import { KnowledgeBaseComponent } from './train/knowledge-base/knowledge-base.component';
import { MatTab, MatTabGroup, MatTabsModule } from '@angular/material/tabs';
import { CustomInputComponent } from './custom-input/custom-input.component';
import { MatGridList, MatGridListModule, MatGridTile } from '@angular/material/grid-list';
import { HttpclientService } from './services/httpclient.service';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { AgentTestComponent } from './agent-test/agent-test.component';
import { ConversationsComponent } from './conversations/conversations.component';
import { NgxSkeletonLoaderModule } from 'ngx-skeleton-loader';
import { SwaggerService } from './services/swagger.service';
import { DataService } from './services/data.service';
import { LoginComponent } from './login/login.component';
import { ClickOutsideModule } from 'ng-click-outside';
import { MarkdownModule } from 'ngx-markdown';
import { QuillModule } from 'ngx-quill';
import { IntegrationsComponent } from './train/integrations/integrations.component';
import { MermaidComponent } from './mermaid.component'; // ✅ Import as a standalone component
import { InfiniteScrollModule } from 'ngx-infinite-scroll';
import { NgxLoggerLevel, LoggerModule } from 'ngx-logger';
import { ClickOutsideDirective } from './directives/clickOutSide.directive';
import { AuthInterceptor } from './services/auth.interceptor';
import { HomeComponent } from './home/home.component';
import { AddOnToolsComponent } from './train/add-on-tools/add-on-tools.component';
import { MatSelectModule } from '@angular/material/select';
import { MatOptionModule } from '@angular/material/core';
import { MatRadioModule } from '@angular/material/radio';
import { RunService } from './services/run.service';
import { CommonTableComponent } from './ui/common-table/common-table.component';
import { EditableTableComponent } from './ui/editable-table/editable-table.component';
import { EditableTableExampleComponent } from './ui/editable-table/editable-table-example.component';
import { GlossaryComponent } from './train/glossary/glossary.component';
import { ScenariosListComponent } from './train/scenarios-list/scenarios-list.component';
import { ColorPickerModule } from 'ngx-color-picker';
import 'quill/dist/quill.snow.css';
import 'quill/dist/quill.bubble.css';
import { SuggestionsComponent } from './insights/suggestions/suggestions.component';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { CkEditorComponent } from './ui/ckEditor/ckeditor.component';
import { ToolsComponent } from './train/tools/tools.component';
import { ChatComponent } from './train/chat/chat.component';
import { ScenariosComponent } from './train/scenarios/scenarios.component';
import { HotTableModule } from '@handsontable/angular';
// @ts-ignore

import { registerAllModules } from 'handsontable/registry';
import { CommonInputComponent } from './ui/common-input/common-input.component';
import { CommonButtonComponent } from './ui/common-button/common-button.component';
import { CommonTabsComponent } from './ui/common-tabs/common-tabs.component';
import { CommonTabDirective } from './ui/common-tabs/common-tab.directive';
import { CommonDropdownComponent } from './ui/common-dropdown/common-dropdown.component';
import { CommonLargeDropdownComponent } from './ui/common-large-dropdown/common-large-dropdown.component';
import { CommonDatePickerComponent } from './ui/common-date-picker/common-date-picker.component';
import { SummaryCardComponent } from './ui/summary-card/summary-card.component';
import { DrawerComponent } from './ui/drawer/drawer.component';
import { MatSliderModule } from '@angular/material/slider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DocsComponent } from './docs/docs.component';
import { NumbersComponent } from './numbers/numbers.component';
import { CallLogsComponent } from './call-logs/call-logs.component';
import { VoiceAgentDemoComponent } from './voice-agent-demo/voice-agent-demo.component';
import { LivekitDemoComponent } from './voice-agent-demo/live-kit-demo/livekit.component';
import { BatchUploadComponent } from './batch-upload/batch-upload.component';
import { CampaignsComponent } from './campaigns/campaigns.component';
import { AgentOnboardComponent } from './agent-onboard/agent-onboard.component';
import { SubscriptionComponent } from './subscription/subscription.component';
import { QualityAgentComponent } from './quality-agent/quality-agent.component';
import { QaAgentTestComponent } from './qa-agent-test/qa-agent-test.component';
import { SettingsComponent } from './settings/settings.component';
import { AddOnToolComponent } from './add-on-tool/add-on-tool.component';
import { ToolFormComponent } from './add-on-tool/tool-form/tool-form.component';
import { CommonComponentsComponent } from './common-components/common-components.component';
import { CommonAccordionComponent } from './ui/common-accordion/common-accordion.component';
registerAllModules();

@NgModule({
  declarations: [
    AppComponent,
    SidebarComponent,
    ContentComponent,
    DashboardComponent,
    OnboardComponent,
    VoiceAgentComponent,
    TrainComponent,
    AddOnToolsComponent,
    CustomInputComponent,
    AgentTestComponent,
    ConversationsComponent,
    LoginComponent,
    HomeComponent,
    ToolsComponent,
    LivekitComponent,
    ChatComponent,
    ScenariosComponent,
    IntegrationsComponent,
    KnowledgeBaseComponent,
    DocsComponent,
    NumbersComponent,
    CallLogsComponent,
    VoiceAgentDemoComponent,
    LivekitDemoComponent,
    BatchUploadComponent,
    CampaignsComponent,
    AgentOnboardComponent,
    SubscriptionComponent,
    QualityAgentComponent,
    QaAgentTestComponent,
    SettingsComponent,
    AddOnToolComponent,
    ToolFormComponent,
    CommonComponentsComponent,
    CommonAccordionComponent
  ],
      imports: [
    LoggerModule.forRoot({
      level: NgxLoggerLevel.INFO, // Set logging level
      serverLogLevel: NgxLoggerLevel.ERROR,
      disableConsoleLogging: false
    }),
    NgxMaterialTimepickerModule,
    CommonTableComponent,
    EditableTableComponent,
    GlossaryComponent,
    ScenariosListComponent,
    CommonInputComponent,
    CommonButtonComponent,
    CommonTabsComponent,
    CommonTabDirective,
    CommonDropdownComponent,
    CommonLargeDropdownComponent,
    CommonDatePickerComponent,
    SummaryCardComponent,
    DrawerComponent,
    ClickOutsideDirective,
    HotTableModule,
    CkEditorComponent,
    MatDatepickerModule,
    MatNativeDateModule,
    NgxEchartsModule.forRoot({ echarts }),
    BrowserModule,
    NgxSkeletonLoaderModule.forRoot(),
    InfiniteScrollModule,
    MermaidComponent,
    QuillModule.forRoot(),
    AppRoutingModule,
    CommonModule,
    FormsModule,
    BrowserAnimationsModule,
    ToastrModule.forRoot({
      timeOut: 3000,
      positionClass: 'toast-top-right',
      preventDuplicates: true,
    }), // ToastrModule added
    HttpClientModule,
    ColorPickerModule,
    MatSidenavModule,
    ClickOutsideModule,
    MarkdownModule.forRoot({
      loader: HttpClient, // Provide HttpClient for markdown loading
    }),
    MatList,
    MatIcon,
    MatSlideToggleModule,
    MatSidenavContainer,
    MatSidenavContent,
    MatSidenav,
    MatToolbarModule,
    MatSidenavModule,
    MatListModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatButtonModule,
    MatToolbarModule,
    MatSidenavModule,
    MatListModule,
    MatProgressSpinnerModule,
    MatExpansionModule,
    MatMenuModule,
    MatSidenavModule,
    MatToolbarModule,
    MatListModule,
    MatTabsModule,
    MatInputModule,
    MatFormFieldModule,
    MatGridList,
    MatGridTile,
    MatSlideToggle,
    MatSelectModule,
    MatOptionModule,
    MatRadioModule,
    MatSliderModule,
    MatTooltipModule,
    SuggestionsComponent
  ],
  exports: [
  ],
  providers: [
    provideAnimationsAsync(),

    HttpClient,
    HttpclientService,
   
    SwaggerService,
    DataService,
    RunService,


    {
      provide: HTTP_INTERCEPTORS,
      useClass: AuthInterceptor,
      multi: true
    }
  ],
  bootstrap: [AppComponent],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class AppModule { }
