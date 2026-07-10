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
              dataResidencyOptions: [{ value: 'global', label: 'Global' }],
              featureUnitTypeOptions: [
                {
                  featureCode: 'chat',
                  unitType: 'message',
                  unitLabel: 'Message'
                },
                {
                  featureCode: 'chat',
                  unitType: 'token',
                  unitLabel: 'Token'
                },
                {
                  featureCode: 'voice',
                  unitType: 'minute',
                  unitLabel: 'Minute'
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

  it('should default voice concurrency to zero', () => {
    expect(component.clientForm.get('voiceConcurrency')?.value).toBe(0);
  });

  it('should select voice agent by default', () => {
    expect(component.clientForm.get('enabledAgents')?.value).toEqual(['voice']);
  });

  it('should hide voice concurrency when only chat is selected', () => {
    component.clientForm.patchValue({ enabledAgents: ['chat'] });
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector('.form-group--voice-concurrency')
    ).toBeNull();
  });

  it('should create pricing rows from settings meta feature unit options', async () => {
    await fixture.whenStable();
    fixture.detectChanges();

    expect(
      component.pricingRules.map((rule) => ({
        featureCode: rule.featureCode,
        unitType: rule.unitType
      }))
    ).toEqual([{ featureCode: 'voice', unitType: 'minute' }]);
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
