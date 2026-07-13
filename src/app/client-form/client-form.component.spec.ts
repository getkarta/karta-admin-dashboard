import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { ClientFormComponent } from './client-form.component';
import { ClientSettingsMetaService } from '../services/client-settings-meta.service';

describe('ClientFormComponent', () => {
  let component: ClientFormComponent;
  let fixture: ComponentFixture<ClientFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        HttpClientTestingModule,
        RouterTestingModule,
        FormsModule,
        ReactiveFormsModule
      ],
      declarations: [ClientFormComponent],
      providers: [
        {
          provide: ClientSettingsMetaService,
          useValue: {
            fetchMeta: async () => ({
              dataResidencyOptions: [{ value: 'GLOBAL', label: 'Global' }],
              featureUnitTypeOptions: [
                {
                  featureCode: 'chat',
                  unitType: 'ai_resolved_session',
                  unitLabel: 'AI resolved session'
                },
                {
                  featureCode: 'voice',
                  unitType: 'sip_seconds_inbound_call',
                  unitLabel: 'SIP seconds inbound'
                },
                {
                  featureCode: 'voice',
                  unitType: 'sip_seconds_outbound_call',
                  unitLabel: 'SIP seconds outbound'
                },
                {
                  featureCode: 'voice',
                  unitType: 'web_seconds_inbound_call',
                  unitLabel: 'Web seconds inbound'
                },
                {
                  featureCode: 'voice',
                  unitType: 'web_seconds_outbound_call',
                  unitLabel: 'Web seconds outbound'
                }
              ]
            })
          }
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ClientFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should default voice concurrency to ten', () => {
    expect(component.clientForm.get('voiceConcurrency')?.value).toBe(10);
  });

  it('should select chat agent by default', () => {
    expect(component.clientForm.get('enabledAgents')?.value).toEqual(['chat']);
  });

  it('should hide voice settings when only chat is selected', () => {
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector('.form-group--voice-concurrency')
    ).toBeNull();
    expect(
      fixture.nativeElement.querySelector('.form-group--voice-stack')
    ).toBeNull();
  });

  it('should populate create pricing rows from settings meta feature unit options', async () => {
    await fixture.whenStable();
    fixture.detectChanges();

    expect(
      component.pricingRules.map((rule) => ({
        featureCode: rule.featureCode,
        unitType: rule.unitType
      }))
    ).toEqual([{ featureCode: 'chat', unitType: 'ai_resolved_session' }]);
  });

  it('should add voice pricing rows from settings meta when voice is enabled', async () => {
    await fixture.whenStable();
    component.clientForm.patchValue({ enabledAgents: ['chat', 'voice'] });
    (component as any).syncPricingRulesWithEnabledAgents();
    fixture.detectChanges();

    expect(
      component.pricingRules.map((rule) => ({
        featureCode: rule.featureCode,
        unitType: rule.unitType
      }))
    ).toEqual([
      { featureCode: 'chat', unitType: 'ai_resolved_session' },
      { featureCode: 'voice', unitType: 'sip_seconds_inbound_call' },
      { featureCode: 'voice', unitType: 'sip_seconds_outbound_call' },
      { featureCode: 'voice', unitType: 'web_seconds_inbound_call' },
      { featureCode: 'voice', unitType: 'web_seconds_outbound_call' }
    ]);
  });

  it('should build create payload with camelCase voice config fields and omit unpriced default rules', async () => {
    await fixture.whenStable();
    component.clientForm.patchValue({
      clientName: 'Acme Corp',
      dataResidency: 'IN',
      enabledAgents: ['chat', 'voice'],
      voiceConcurrency: 10,
      voiceStackId: 'staging_current'
    });
    (component as any).syncPricingRulesWithEnabledAgents();

    expect(
      (component as any).buildCreateClientBody(
        component.clientForm.getRawValue()
      )
    ).toEqual({
      clientName: 'Acme Corp',
      dataResidency: 'IN',
      enabledAgents: ['chat', 'voice'],
      voiceConcurrency: 10,
      voiceStackId: 'staging_current'
    });
  });

  it('should build billing custom pricing payload in billing API format', () => {
    component.billingTier = 'basic';
    component.allowNegativeBalance = false;
    component.baseCreditUsagePromptBuilder = false;
    component.pricingRules = [
      {
        featureCode: 'voice',
        unitType: 'sip_seconds_inbound_call',
        creditPerUnit: 8,
        rounding: 'round',
        intervalSeconds: 60,
        minimumSeconds: 1
      },
      {
        featureCode: 'voice',
        unitType: 'web_seconds_outbound_call',
        creditPerUnit: 8,
        rounding: 'round',
        intervalSeconds: 60,
        minimumSeconds: 1
      }
    ];

    expect((component as any).buildBillingPutBody('tesYEB')).toEqual({
      clientCode: 'tesYEB',
      tier: 'basic',
      allowNegativeBalance: false,
      customPricing: {
        voice: {
          sip_seconds_inbound_call: {
            creditPerUnit: 8,
            rounding: 'round',
            intervalSeconds: 60,
            minimumSeconds: 1
          },
          web_seconds_outbound_call: {
            creditPerUnit: 8,
            rounding: 'round',
            intervalSeconds: 60,
            minimumSeconds: 1
          }
        }
      },
      baseCreditUsage: {
        prompt_builder: false
      }
    });
  });
});
