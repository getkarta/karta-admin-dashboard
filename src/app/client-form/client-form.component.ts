import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { ClientRow } from '../clients/clients.component';
import { environment } from '../../config/environment';

@Component({
  selector: 'app-client-form',
  standalone: false,
  templateUrl: './client-form.component.html',
  styleUrl: './client-form.component.scss'
})
export class ClientFormComponent implements OnInit {
  isEditMode = false;
  clientCode = '';
  errorMessage = '';
  successMessage = '';
  isSubmitting = false;

  newUserEmail = '';
  newUserPassword = '';
  userErrorMessage = '';
  userSuccessMessage = '';
  isAddingUser = false;
  clientUsers: Array<{ email: string; role: string; createdAt?: string }> = [];
  isLoadingUsers = false;
  showAddUserModal = false;

  // Pricing properties (aligned with backend PUT /client/:clientCode billing payload)
  pricingErrorMessage = '';
  pricingSuccessMessage = '';
  isSavingPricing = false;
  billingTier = 'basic';
  allowNegativeBalance = false;
  /** Flat list of custom pricing rules; each row becomes customPricing[featureCode][unitType] */
  pricingRules: Array<{
    featureCode: string;
    unitType: string;
    creditPerUnit: number;
    rounding: string;
    intervalSeconds?: number;
    minimumSeconds?: number;
  }> = [];

  // Backend-aligned constants for dropdowns
  readonly BILLING_TIERS = [
    { value: 'free', label: 'Free' },
    { value: 'basic', label: 'Basic' },
    { value: 'enterprise', label: 'Enterprise' }
  ];
  readonly FEATURE_CODES = [
    { value: 'chat', label: 'Chat' },
    { value: 'voice', label: 'Voice' },
    { value: 'onboarding', label: 'Onboarding' },
    { value: 'audit', label: 'Audit' }
  ];
  readonly UNIT_TYPES = [
    { value: 'message', label: 'Message' },
    { value: 'minute', label: 'Minute' },
    { value: 'seconds', label: 'Seconds' },
    { value: 'seconds_inbound_call', label: 'Seconds (inbound call)' },
    { value: 'seconds_outbound_call', label: 'Seconds (outbound call)' },
    { value: 'session', label: 'Session' },
    { value: 'token', label: 'Token' },
    { value: 'token-gpt-4.0', label: 'Token GPT-4.0' },
    { value: 'token-gpt-5.0', label: 'Token GPT-5.0' },
    { value: 'private_note', label: 'Private note' },
    { value: 'new_conversation', label: 'New conversation' },
    { value: 'ai_resolved_session', label: 'AI resolved session' },
    { value: 'sip_seconds_inbound_call', label: 'SIP seconds inbound' },
    { value: 'sip_seconds_outbound_call', label: 'SIP seconds outbound' },
    { value: 'sip_seconds_supervisor_connect_call', label: 'SIP seconds supervisor connect' },
    { value: 'sip_seconds_supervisor_call', label: 'SIP seconds supervisor call' },
    { value: 'web_seconds_inbound_call', label: 'Web seconds inbound' },
    { value: 'web_seconds_outbound_call', label: 'Web seconds outbound' }
  ];
  readonly ROUNDING_TYPES = [
    { value: 'ceil', label: 'Ceil' },
    { value: 'floor', label: 'Floor' },
    { value: 'round', label: 'Round' }
  ];

  availableAgents = [
    { label: 'Chat Agent', value: 'chat' },
    { label: 'Voice Agent', value: 'voice' },
    { label: 'Onboarding Agent', value: 'onboarding' },
    { label: 'Audit Agent', value: 'audit' }
  ];

  clientForm: FormGroup;

  private readonly apiBase = environment.apiUrl.replace(/\/$/, '');

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private http: HttpClient
  ) {
    this.clientForm = this.fb.group({
      clientName: ['', [Validators.required, Validators.minLength(3)]],
      enabledAgents: this.fb.nonNullable.control<string[]>([])
    });
  }

  ngOnInit(): void {
    const code = this.route.snapshot.paramMap.get('code');

    if (!code) {
      return;
    }

    this.isEditMode = true;
    this.clientCode = code;
    this.loadClientUsers();

    const client = history.state?.client as ClientRow | undefined;
    if (client) {
      this.clientForm.patchValue({
        clientName: client.clientName,
        enabledAgents: client.enabledAgents || []
      });
      this.applyBillingFromClient(client);
    } else {
      void this.loadClientByCode();
    }
  }

  private async loadClientByCode(): Promise<void> {
    const accessToken = localStorage.getItem('accessToken');
    if (!accessToken) {
      this.errorMessage = 'Session expired. Please log in again.';
      return;
    }
    try {
      const res = await firstValueFrom(
        this.http.get<any>(`${this.apiBase}/admin/clients/${this.clientCode}`, {
          headers: new HttpHeaders({ Authorization: `Bearer ${accessToken}` })
        })
      );
      const raw = res?.client ?? res;
      if (!raw) {
        this.errorMessage = 'Client not found.';
        return;
      }
      const client: ClientRow = {
        clientName: raw.clientName ?? raw.name ?? 'Unnamed Client',
        clientCode: raw.clientCode ?? raw.cod ?? this.clientCode,
        enabledAgents: Array.isArray(raw.enabledAgents) ? raw.enabledAgents : [],
        status: 'Active',
        owner: raw.owner ?? raw.createdBy ?? raw.email ?? 'Admin',
        createdOn: raw.createdOn ?? '',
        billing: raw.billing ?? raw.bi
      };
      this.clientForm.patchValue({
        clientName: client.clientName,
        enabledAgents: client.enabledAgents || []
      });
      this.applyBillingFromClient(client);
    } catch {
      this.errorMessage = 'Could not load client. You can still update by filling the form.';
    }
  }

  private applyBillingFromClient(client: ClientRow): void {
    const billing = (client as any)?.billing ?? (client as any)?.bi;
    if (!billing) {
      this.allowNegativeBalance = false;
      return;
    }
    this.billingTier = (billing.tier && billing.tier !== 'free') ? billing.tier : 'basic';
    this.allowNegativeBalance = billing.allowNegativeBalance === true;
    const cp = billing.customPricing;
    if (cp && typeof cp === 'object') {
      this.pricingRules = [];
      for (const [featureCode, unitMap] of Object.entries(cp)) {
        if (!unitMap || typeof unitMap !== 'object') continue;
        for (const [unitType, rule] of Object.entries(unitMap)) {
          if (!rule || typeof rule !== 'object' || typeof rule.creditPerUnit !== 'number') continue;
          this.pricingRules.push({
            featureCode,
            unitType,
            creditPerUnit: rule.creditPerUnit,
            rounding: rule.rounding ?? 'ceil',
            intervalSeconds: rule.intervalSeconds,
            minimumSeconds: rule.minimumSeconds
          });
        }
      }
    }
  }

  async onSubmit(): Promise<void> {
    if (this.clientForm.invalid) {
      this.clientForm.markAllAsTouched();
      return;
    }

    const accessToken = localStorage.getItem('accessToken');
    if (!accessToken) {
      this.errorMessage = 'Session expired. Please log in again.';
      return;
    }

    this.isSubmitting = true;
    this.errorMessage = '';
    this.successMessage = '';

    const formValue = this.clientForm.getRawValue();

    if (this.isEditMode && (!formValue.enabledAgents || formValue.enabledAgents.length === 0)) {
      this.errorMessage = 'Select at least one enabled agent before updating this client.';
      this.isSubmitting = false;
      return;
    }

    try {
      if (this.isEditMode) {
        await firstValueFrom(
          this.http.put(
            `${this.apiBase}/admin/clients/${this.clientCode}`,
            {
              clientName: formValue.clientName,
              enabledAgents: formValue.enabledAgents
            },
            {
              headers: new HttpHeaders({
                Authorization: `Bearer ${accessToken}`
              })
            }
          )
        );

        this.successMessage = 'Client updated successfully.';
      } else {
        await firstValueFrom(
          this.http.post(
            `${this.apiBase}/admin/clients`,
            {
              clientName: formValue.clientName
            },
            {
              headers: new HttpHeaders({
                Authorization: `Bearer ${accessToken}`
              })
            }
          )
        );

        this.successMessage = 'Client created successfully.';
      }

      await this.router.navigate(['/clients']);
    } catch (error) {
      console.error(error);
      this.errorMessage = this.isEditMode
        ? 'Unable to update client right now.'
        : 'Unable to create client right now.';
    } finally {
      this.isSubmitting = false;
    }
  }

  async addUser(): Promise<void> {
    if (!this.newUserEmail.trim() || !this.newUserPassword.trim()) {
      this.userErrorMessage = 'Email and password are required.';
      return;
    }
  
    if (this.newUserPassword.trim().length < 6) {
      this.userErrorMessage = 'Password must be at least 6 characters long.';
      return;
    }
  
    this.isAddingUser = true;
    this.userErrorMessage = '';
    this.userSuccessMessage = '';
  
    try {
      await firstValueFrom(
        this.http.post(
          `${this.apiBase}/user/register`,
          {
            email: this.newUserEmail.trim(),
            password: this.newUserPassword,
            clientCode: this.clientCode
          }
        )
      );
  
      this.userSuccessMessage = 'User added successfully.';
      this.newUserEmail = '';
      this.newUserPassword = '';
      this.showAddUserModal = false;
      await this.loadClientUsers();
    } catch (error) {
      console.error(error);
      this.userErrorMessage = (error as any)?.error?.message ?? 'Unable to add user right now.';
    } finally {
      this.isAddingUser = false;
    }
  }

  openAddUserModal(): void {
    this.userErrorMessage = '';
    this.userSuccessMessage = '';
    this.showAddUserModal = true;
  }

  closeAddUserModal(): void {
    this.showAddUserModal = false;
    this.newUserEmail = '';
    this.newUserPassword = '';
    this.userErrorMessage = '';
    this.userSuccessMessage = '';
  }

  async loadClientUsers(): Promise<void> {
    const accessToken = localStorage.getItem('accessToken');
    if (!accessToken || !this.clientCode) return;
    this.isLoadingUsers = true;
    try {
      const res = await firstValueFrom(
        this.http.get<{ users: Array<{ email: string; role: string; createdAt?: string }> }>(
          `${this.apiBase}/admin/clients/${this.clientCode}/users`,
          { headers: new HttpHeaders({ Authorization: `Bearer ${accessToken}` }) }
        )
      );
      this.clientUsers = res.users ?? [];
    } catch {
      this.clientUsers = [];
    } finally {
      this.isLoadingUsers = false;
    }
  }

  addPricingRule(): void {
    this.pricingRules.push({
      featureCode: 'chat',
      unitType: 'message',
      creditPerUnit: 1,
      rounding: 'ceil'
    });
  }

  removePricingRule(index: number): void {
    this.pricingRules.splice(index, 1);
  }

  async savePricing(): Promise<void> {
    const accessToken = localStorage.getItem('accessToken');
    if (!accessToken) {
      this.pricingErrorMessage = 'Session expired. Please log in again.';
      return;
    }

    const customPricing: Record<string, Record<string, { creditPerUnit: number; unit?: string; rounding?: string; intervalSeconds?: number; minimumSeconds?: number }>> = {};
    for (const row of this.pricingRules) {
      const creditPerUnit = Number(row.creditPerUnit);
      if (!Number.isFinite(creditPerUnit) || creditPerUnit <= 0) {
        this.pricingErrorMessage = `Credit per unit must be a positive number for ${row.featureCode} / ${row.unitType}.`;
        return;
      }
      if (!row.featureCode?.trim() || !row.unitType?.trim()) {
        this.pricingErrorMessage = 'Feature and unit type are required for each rule.';
        return;
      }
      if (!customPricing[row.featureCode]) customPricing[row.featureCode] = {};
      const rule: { creditPerUnit: number; unit?: string; rounding?: string; intervalSeconds?: number; minimumSeconds?: number } = {
        creditPerUnit,
        rounding: row.rounding || 'ceil'
      };
      // Only voice uses interval/min; chat, onboarding, audit do not
      if (row.featureCode === 'voice') {
        if (row.intervalSeconds != null && Number.isFinite(Number(row.intervalSeconds)) && Number(row.intervalSeconds) > 0) {
          rule.intervalSeconds = Number(row.intervalSeconds);
        }
        if (row.minimumSeconds != null && Number.isFinite(Number(row.minimumSeconds)) && Number(row.minimumSeconds) >= 0) {
          rule.minimumSeconds = Number(row.minimumSeconds);
        }
      }
      customPricing[row.featureCode][row.unitType] = rule;
    }

    this.isSavingPricing = true;
    this.pricingErrorMessage = '';
    this.pricingSuccessMessage = '';

    try {
      await firstValueFrom(
        this.http.put(
          `${this.apiBase}/admin/clients/${this.clientCode}`,
          {
            billing: {
              tier: this.billingTier,
              allowNegativeBalance: this.allowNegativeBalance,
              ...(Object.keys(customPricing).length > 0 ? { customPricing } : {})
            }
          },
          {
            headers: new HttpHeaders({
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            })
          }
        )
      );
      this.pricingSuccessMessage = 'Pricing saved successfully.';
    } catch (error) {
      console.error(error);
      this.pricingErrorMessage = (error as any)?.error?.message ?? 'Unable to save pricing right now.';
    } finally {
      this.isSavingPricing = false;
    }
  }

  goBack(): void {
    void this.router.navigate(['/clients']);
  }
}
