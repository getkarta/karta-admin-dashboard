import { HttpClient, HttpHeaders } from '@angular/common/http';
import {
  Component,
  ElementRef,
  HostListener,
  OnInit,
  ViewChild
} from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { ClientRow } from '../clients/clients.component';
import { environment } from '../../config/environment';
import {
  ClientSettingsMetaService,
  DEFAULT_DATA_RESIDENCY_OPTIONS,
  DataResidencyOption
} from '../services/client-settings-meta.service';

@Component({
  selector: 'app-client-form',
  standalone: false,
  templateUrl: './client-form.component.html',
  styleUrl: './client-form.component.scss'
})
export class ClientFormComponent implements OnInit {
  @ViewChild('residencyDropdownRoot')
  residencyDropdownRoot?: ElementRef<HTMLElement>;

  @ViewChild('editUserRoleDropdownRoot')
  editUserRoleDropdownRoot?: ElementRef<HTMLElement>;

  /** Custom menu: native select dropdown is OS-drawn (width/corners misalign). */
  dataResidencyMenuOpen = false;

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

  showEditUserModal = false;
  editUserEmail = '';
  editUserRole = '';
  editUserRoleOptions: Array<{ value: string; label: string }> = [];
  editUserNewPassword = '';
  editUserErrorMessage = '';
  isUpdatingUser = false;
  editUserRoleMenuOpen = false;

  /** Roles offered when editing; current role is always included if not listed. */
  readonly EDIT_USER_ROLE_OPTIONS = [
    { value: 'member', label: 'Member' },
    { value: 'admin', label: 'Admin' }
  ];

  // Pricing: saved via PUT /admin/clients/:clientCode/billing (tier, allowNegativeBalance, customPricing)
  pricingErrorMessage = '';
  pricingSuccessMessage = '';
  isSavingPricing = false;
  billingTier = 'basic';
  allowNegativeBalance = false;
  billingTierMenuOpen = false;
  /** Which pricing rule custom dropdown is open (feature / unit / rounding). */
  pricingDd: { row: number; field: 'feature' | 'unit' | 'rounding' } | null =
    null;
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
    { value: 'audit', label: 'Audit' },
    { value: 'agent_builder', label: 'Agent Builder' }
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

  dataResidencyOptions: DataResidencyOption[] = [
    ...DEFAULT_DATA_RESIDENCY_OPTIONS
  ];
  isLoadingDataResidencyOptions = false;

  /** Suggested values for the voice concurrency number field (datalist). */
  readonly voiceConcurrencyOptions = [1, 2, 5, 10, 25, 50, 100] as const;

  clientForm: FormGroup;

  /**
   * Base `…/admin`. Client endpoints:
   * POST `…/clients`, PUT `…/clients/{clientCode}`; single-client GET uses `…/clients/:code` when needed.
   */
  private readonly apiBase = environment.apiUrl.replace(/\/$/, '');

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private http: HttpClient,
    private clientSettingsMeta: ClientSettingsMetaService
  ) {
    this.clientForm = this.fb.group({
      clientName: ['', [Validators.required, Validators.minLength(3)]],
      dataResidency: this.fb.nonNullable.control<string>('global'),
      voiceConcurrency: this.fb.nonNullable.control<number>(1, [
        Validators.required,
        Validators.min(1)
      ]),
      enabledAgents: this.fb.nonNullable.control<string[]>([])
    });
  }

  get dataResidencyDisplayLabel(): string {
    const v = this.clientForm?.get('dataResidency')?.value as string | undefined;
    return (
      this.dataResidencyOptions.find((o) => o.value === v)?.label ?? v ?? ''
    );
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(ev: MouseEvent): void {
    const t = ev.target as Node;
    if (this.dataResidencyMenuOpen) {
      if (!this.residencyDropdownRoot?.nativeElement?.contains(t)) {
        this.dataResidencyMenuOpen = false;
      }
    }
    if (this.editUserRoleMenuOpen) {
      if (!this.editUserRoleDropdownRoot?.nativeElement?.contains(t)) {
        this.editUserRoleMenuOpen = false;
      }
    }
    const el = ev.target as HTMLElement;
    if (this.billingTierMenuOpen && !el.closest('.billing-tier-dd')) {
      this.billingTierMenuOpen = false;
    }
    if (this.pricingDd !== null && !el.closest('.pricing-rule-dd')) {
      this.pricingDd = null;
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.dataResidencyMenuOpen = false;
    this.editUserRoleMenuOpen = false;
    this.billingTierMenuOpen = false;
    this.pricingDd = null;
  }

  toggleDataResidencyMenu(ev: MouseEvent): void {
    ev.stopPropagation();
    if (this.isLoadingDataResidencyOptions) return;
    this.dataResidencyMenuOpen = !this.dataResidencyMenuOpen;
  }

  selectDataResidency(value: string): void {
    this.clientForm.patchValue({ dataResidency: value });
    this.dataResidencyMenuOpen = false;
  }

  isDataResidencySelected(value: string): boolean {
    return this.clientForm.get('dataResidency')?.value === value;
  }

  get editUserRoleDisplayLabel(): string {
    const v = this.editUserRole ?? '';
    const opt = this.editUserRoleOptions.find(
      (o) => o.value.toLowerCase() === v.trim().toLowerCase()
    );
    return opt?.label ?? v;
  }

  toggleEditUserRoleMenu(ev: MouseEvent): void {
    ev.stopPropagation();
    this.editUserRoleMenuOpen = !this.editUserRoleMenuOpen;
  }

  selectEditUserRole(value: string): void {
    this.editUserRole = value;
    this.editUserRoleMenuOpen = false;
  }

  isEditUserRoleSelected(value: string): boolean {
    return (
      (this.editUserRole ?? '').trim().toLowerCase() ===
      value.trim().toLowerCase()
    );
  }

  get billingTierDisplayLabel(): string {
    return (
      this.BILLING_TIERS.find((t) => t.value === this.billingTier)?.label ??
      this.billingTier
    );
  }

  toggleBillingTierMenu(ev: MouseEvent): void {
    ev.stopPropagation();
    this.pricingDd = null;
    this.billingTierMenuOpen = !this.billingTierMenuOpen;
  }

  selectBillingTier(value: string): void {
    this.billingTier = value;
    this.billingTierMenuOpen = false;
  }

  togglePricingDd(
    ev: MouseEvent,
    row: number,
    field: 'feature' | 'unit' | 'rounding'
  ): void {
    ev.stopPropagation();
    this.billingTierMenuOpen = false;
    if (
      this.pricingDd?.row === row &&
      this.pricingDd?.field === field
    ) {
      this.pricingDd = null;
    } else {
      this.pricingDd = { row, field };
    }
  }

  isPricingDdOpen(
    row: number,
    field: 'feature' | 'unit' | 'rounding'
  ): boolean {
    return (
      this.pricingDd?.row === row && this.pricingDd?.field === field
    );
  }

  pricingRuleFieldLabelForRule(
    rule: {
      featureCode: string;
      unitType: string;
      rounding: string;
    },
    field: 'feature' | 'unit' | 'rounding'
  ): string {
    if (field === 'feature') {
      return (
        this.FEATURE_CODES.find((o) => o.value === rule.featureCode)
          ?.label ?? rule.featureCode
      );
    }
    if (field === 'unit') {
      return (
        this.UNIT_TYPES.find((o) => o.value === rule.unitType)?.label ??
        rule.unitType
      );
    }
    return (
      this.ROUNDING_TYPES.find((o) => o.value === rule.rounding)?.label ??
      rule.rounding
    );
  }

  selectPricingRuleDropdown(
    row: number,
    field: 'feature' | 'unit' | 'rounding',
    value: string
  ): void {
    const rule = this.pricingRules[row];
    if (!rule) return;
    if (field === 'feature') rule.featureCode = value;
    else if (field === 'unit') rule.unitType = value;
    else rule.rounding = value;
    this.pricingDd = null;
  }

  isAgentEnabled(agentValue: string): boolean {
    const list = this.clientForm.get('enabledAgents')?.value as string[] | undefined;
    return (list ?? []).includes(agentValue);
  }

  toggleEnabledAgent(agentValue: string, ev: Event): void {
    const checked = (ev.target as HTMLInputElement).checked;
    const ctrl = this.clientForm.get('enabledAgents');
    const current = [...((ctrl?.value as string[] | undefined) ?? [])];
    if (checked) {
      if (!current.includes(agentValue)) current.push(agentValue);
    } else {
      const i = current.indexOf(agentValue);
      if (i >= 0) current.splice(i, 1);
    }
    ctrl?.patchValue(current);
  }

  ngOnInit(): void {
    const code = this.route.snapshot.paramMap.get('code');

    if (!code) {
      void this.loadDataResidencyOptions();
      return;
    }

    this.isEditMode = true;
    this.clientCode = code;
    this.loadClientUsers();

    const client = history.state?.client as ClientRow | undefined;
    if (client) {
      void this.bootstrapEditFormWithClient(client);
    } else {
      void this.loadClientByCode();
    }
  }

  private pickResidencyAndVoiceFromUnknown(
    src: Record<string, unknown>
  ): Partial<{ dataResidency: string; voiceConcurrency: number }> {
    const out: Partial<{ dataResidency: string; voiceConcurrency: number }> =
      {};
    const dr = src['dataResidency'] ?? src['data_residency'];
    if (typeof dr === 'string' && dr.trim()) {
      out.dataResidency = dr.trim();
    }
    const vc = src['voiceConcurrency'] ?? src['voice_concurrency'];
    if (vc !== undefined && vc !== null && vc !== '') {
      const n = typeof vc === 'number' ? vc : Number(vc);
      if (Number.isFinite(n) && Number.isInteger(n) && n >= 1) {
        out.voiceConcurrency = n;
      }
    }
    return out;
  }

  private async hydrateResidencyOptionsOnly(): Promise<void> {
    this.isLoadingDataResidencyOptions = true;
    try {
      const meta = await this.clientSettingsMeta.fetchMeta();
      this.dataResidencyOptions =
        meta.dataResidencyOptions.length > 0
          ? meta.dataResidencyOptions
          : [...DEFAULT_DATA_RESIDENCY_OPTIONS];
    } finally {
      this.isLoadingDataResidencyOptions = false;
    }
  }

  private syncDataResidencyWithOptions(): void {
    const current = this.clientForm.get('dataResidency')?.value as string;
    if (!this.dataResidencyOptions.some((o) => o.value === current)) {
      const preferred =
        this.dataResidencyOptions.find(
          (o) => o.value.toLowerCase() === 'global'
        )?.value ??
        this.dataResidencyOptions[0]?.value ??
        'global';
      this.clientForm.patchValue({ dataResidency: preferred });
    }
  }

  private async bootstrapEditFormWithClient(client: ClientRow): Promise<void> {
    await this.hydrateResidencyOptionsOnly();
    this.clientForm.patchValue({
      clientName: client.clientName,
      enabledAgents: client.enabledAgents || [],
      ...this.pickResidencyAndVoiceFromUnknown(
        client as unknown as Record<string, unknown>
      )
    });
    this.applyBillingFromClient(client);
    this.syncDataResidencyWithOptions();
  }

  private async loadDataResidencyOptions(): Promise<void> {
    this.isLoadingDataResidencyOptions = true;
    try {
      const meta = await this.clientSettingsMeta.fetchMeta();
      this.dataResidencyOptions =
        meta.dataResidencyOptions.length > 0
          ? meta.dataResidencyOptions
          : [...DEFAULT_DATA_RESIDENCY_OPTIONS];

      const globalOption = this.dataResidencyOptions.find(
        (o) => o.value.toLowerCase() === 'global'
      );
      if (globalOption) {
        this.clientForm.patchValue({ dataResidency: globalOption.value });
        return;
      }

      const preferred =
        meta.defaultDataResidency &&
        this.dataResidencyOptions.some(
          (o) => o.value === meta.defaultDataResidency
        )
          ? meta.defaultDataResidency
          : (this.dataResidencyOptions[0]?.value ?? 'global');

      const current = this.clientForm.get('dataResidency')?.value as string;
      if (!this.dataResidencyOptions.some((o) => o.value === current)) {
        this.clientForm.patchValue({ dataResidency: preferred });
      }
    } finally {
      this.isLoadingDataResidencyOptions = false;
    }
  }

  private async loadClientByCode(): Promise<void> {
    const accessToken = localStorage.getItem('accessToken');
    if (!accessToken) {
      this.errorMessage = 'Session expired. Please log in again.';
      return;
    }
    await this.hydrateResidencyOptionsOnly();
    try {
      const res = await firstValueFrom(
        this.http.get<any>(`${this.apiBase}/clients/${this.clientCode}`, {
          headers: new HttpHeaders({ Authorization: `Bearer ${accessToken}` })
        })
      );
      const raw = res?.client ?? res;
      if (!raw) {
        this.errorMessage = 'Client not found.';
        return;
      }
      const rawObj = raw as Record<string, unknown>;
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
        enabledAgents: client.enabledAgents || [],
        ...this.pickResidencyAndVoiceFromUnknown(rawObj)
      });
      this.syncDataResidencyWithOptions();
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

    const voiceConcurrency = Number(formValue.voiceConcurrency);
    if (
      !Number.isFinite(voiceConcurrency) ||
      !Number.isInteger(voiceConcurrency) ||
      voiceConcurrency < 1
    ) {
      this.errorMessage = 'Voice concurrency must be a positive whole number.';
      this.isSubmitting = false;
      return;
    }

    try {
      if (this.isEditMode) {
        await firstValueFrom(
          this.http.put(
            `${this.apiBase}/clients/${this.clientCode}`,
            {
              clientName: formValue.clientName,
              enabledAgents: formValue.enabledAgents,
              dataResidency: formValue.dataResidency,
              voiceConcurrency
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
            `${this.apiBase}/clients`,
            {
              clientName: formValue.clientName,
              dataResidency: formValue.dataResidency,
              voiceConcurrency
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
      const accessToken = localStorage.getItem('accessToken');
      if (!accessToken) {
        this.userErrorMessage = 'Session expired. Please log in again.';
        return;
      }

      await firstValueFrom(
        this.http.post(
          `${this.apiBase}/users`,
          {
            email: this.newUserEmail.trim(),
            password: this.newUserPassword,
            clientCode: this.clientCode
          },
          {
            headers: new HttpHeaders({
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            })
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

  openEditUserModal(u: { email: string; role: string }): void {
    this.editUserErrorMessage = '';
    this.editUserEmail = u.email;
    const role = (u.role ?? '').trim() || 'member';
    const base = [...this.EDIT_USER_ROLE_OPTIONS];
    const hasKnown = base.some((o) => o.value.toLowerCase() === role.toLowerCase());
    this.editUserRoleOptions = hasKnown
      ? base
      : [{ value: role, label: role }, ...base];
    this.editUserRole = role;
    this.editUserNewPassword = '';
    this.editUserRoleMenuOpen = false;
    this.showEditUserModal = true;
  }

  closeEditUserModal(): void {
    this.showEditUserModal = false;
    this.editUserRoleMenuOpen = false;
    this.editUserEmail = '';
    this.editUserRole = '';
    this.editUserRoleOptions = [];
    this.editUserNewPassword = '';
    this.editUserErrorMessage = '';
  }

  async updateUser(): Promise<void> {
    if (!this.editUserEmail.trim()) {
      this.editUserErrorMessage = 'User email is missing.';
      return;
    }
    if (!this.editUserRole.trim()) {
      this.editUserErrorMessage = 'Role is required.';
      return;
    }
    const pwd = this.editUserNewPassword.trim();
    if (pwd && pwd.length < 6) {
      this.editUserErrorMessage = 'New password must be at least 6 characters, or leave blank to keep the current password.';
      return;
    }

    this.isUpdatingUser = true;
    this.editUserErrorMessage = '';

    try {
      const accessToken = localStorage.getItem('accessToken');
      if (!accessToken) {
        this.editUserErrorMessage = 'Session expired. Please log in again.';
        return;
      }

      const body: { email: string; clientCode: string; role: string; password?: string } = {
        email: this.editUserEmail.trim(),
        clientCode: this.clientCode,
        role: this.editUserRole.trim()
      };
      if (pwd) body.password = pwd;

      await firstValueFrom(
        this.http.patch(`${this.apiBase}/users`, body, {
          headers: new HttpHeaders({
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          })
        })
      );

      this.closeEditUserModal();
      await this.loadClientUsers();
    } catch (error) {
      console.error(error);
      this.editUserErrorMessage =
        (error as any)?.error?.message ?? 'Unable to update user right now.';
    } finally {
      this.isUpdatingUser = false;
    }
  }

  async loadClientUsers(): Promise<void> {
    const accessToken = localStorage.getItem('accessToken');
    if (!accessToken || !this.clientCode) return;
    this.isLoadingUsers = true;
    try {
      const res = await firstValueFrom(
        this.http.get<{ users: Array<{ email: string; role: string; createdAt?: string }> }>(
          `${this.apiBase}/clients/${this.clientCode}/users`,
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
    this.pricingDd = null;
    this.pricingRules.push({
      featureCode: 'chat',
      unitType: 'message',
      creditPerUnit: 1,
      rounding: 'ceil'
    });
  }

  removePricingRule(index: number): void {
    this.pricingRules.splice(index, 1);
    if (this.pricingDd?.row === index) {
      this.pricingDd = null;
    } else if (this.pricingDd !== null && this.pricingDd.row > index) {
      this.pricingDd = { ...this.pricingDd, row: this.pricingDd.row - 1 };
    }
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
          `${this.apiBase}/clients/${this.clientCode}/billing`,
          {
            tier: this.billingTier,
            allowNegativeBalance: this.allowNegativeBalance,
            ...(Object.keys(customPricing).length > 0 ? { customPricing } : {})
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
