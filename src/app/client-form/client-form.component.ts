import {
  HttpClient,
  HttpErrorResponse,
  HttpHeaders
} from '@angular/common/http';
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
  /** Treat common `view` query values as directory read-only mode. */
  private static isDirectoryViewQuery(
    value: string | null | undefined
  ): boolean {
    if (value == null) {
      return false;
    }
    const v = String(value).trim().toLowerCase();
    return v === '1' || v === 'true' || v === 'yes' || v === 'readonly';
  }
  @ViewChild('residencyDropdownRoot')
  residencyDropdownRoot?: ElementRef<HTMLElement>;

  @ViewChild('deleteUserEmailDropdownRoot')
  deleteUserEmailDropdownRoot?: ElementRef<HTMLElement>;

  /** Custom menu: native select dropdown is OS-drawn (width/corners misalign). */
  dataResidencyMenuOpen = false;

  isEditMode = false;
  /** Opened from directory in view mode (?view=1); all edits disabled. */
  clientPageViewOnly = false;
  /**
   * Update Client: fields start read-only; **Edit** unlocks editing until **Save** or **Cancel**
   * on the page toolbar. Create / directory view ignore this flag.
   */
  pageEditUnlocked = false;
  /** Snapshot for **Cancel** while `pageEditUnlocked` is true (edit mode only). */
  private editPageCancelSnapshot: {
    clientName: string;
    enabledAgents: string[];
    dataResidency: string;
    voiceConcurrency: number;
    billingTier: string;
    allowNegativeBalance: boolean;
    baseCreditUsagePromptBuilder: boolean;
    pricingRules: Array<{
      featureCode: string;
      unitType: string;
      creditPerUnit: number;
      rounding: string;
      intervalSeconds?: number;
      minimumSeconds?: number;
    }>;
  } | null = null;
  /** Save (client PUT + billing PUT) from the actions below Pricing & Billing. */
  isSavingEntirePage = false;
  clientCode = '';
  errorMessage = '';
  successMessage = '';
  isSubmitting = false;

  newUserEmail = '';
  newUserPassword = '';
  userErrorMessage = '';
  userSuccessMessage = '';
  isAddingUser = false;
  clientUsers: Array<{
    id: string;
    email: string;
    role: string;
    createdAt?: string;
  }> = [];
  isLoadingUsers = false;
  showAddUserModal = false;

  showDeleteUserModal = false;
  deleteUserEmail = '';
  deleteUserEmailMenuOpen = false;
  deleteUserErrorMessage = '';
  isDeletingUser = false;

  showEditUserModal = false;
  /** Target user id for PUT …/clients/{clientCode}/users/{userId} */
  editUserId = '';
  /** Original address (read-only in the modal). */
  editUserCurrentEmail = '';
  /** Sent as `email` on PUT …/users/{userId}. */
  editUserNewEmail = '';
  editUserNewPassword = '';
  editUserErrorMessage = '';
  isUpdatingUser = false;

  // Pricing: PUT /admin/billing/billing — body: clientCode, tier, allowNegativeBalance, customPricing, baseCreditUsage
  pricingErrorMessage = '';
  pricingSuccessMessage = '';
  isSavingPricing = false;
  billingTier = 'basic';
  allowNegativeBalance = false;
  /** Maps to `baseCreditUsage.prompt_builder` on the billing API */
  baseCreditUsagePromptBuilder = false;
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

  /** From `navigate(..., { state: { flashPricingError } })` after create + billing PUT failure. */
  private pendingPricingRouteFlash = '';

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private http: HttpClient,
    private clientSettingsMeta: ClientSettingsMetaService
  ) {
    const nav = this.router.getCurrentNavigation();
    const flash = nav?.extras?.state?.['flashPricingError'];
    if (typeof flash === 'string' && flash.trim()) {
      this.pendingPricingRouteFlash = flash.trim();
    }
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
    if (this.deleteUserEmailMenuOpen) {
      if (!this.deleteUserEmailDropdownRoot?.nativeElement?.contains(t)) {
        this.deleteUserEmailMenuOpen = false;
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
    this.deleteUserEmailMenuOpen = false;
    this.billingTierMenuOpen = false;
    this.pricingDd = null;
    if (this.showDeleteUserModal) {
      this.closeDeleteUserModal();
    }
  }

  toggleDataResidencyMenu(ev: MouseEvent): void {
    ev.stopPropagation();
    if (this.pageFieldsReadOnly || this.isLoadingDataResidencyOptions) return;
    this.dataResidencyMenuOpen = !this.dataResidencyMenuOpen;
  }

  selectDataResidency(value: string): void {
    if (this.pageFieldsReadOnly) return;
    this.clientForm.patchValue({ dataResidency: value });
    this.dataResidencyMenuOpen = false;
  }

  isDataResidencySelected(value: string): boolean {
    return this.clientForm.get('dataResidency')?.value === value;
  }

  get deleteUserEmailDisplayLabel(): string {
    const e = (this.deleteUserEmail ?? '').trim();
    return e || 'Select a user';
  }

  toggleDeleteUserEmailMenu(ev: MouseEvent): void {
    ev.stopPropagation();
    this.deleteUserEmailMenuOpen = !this.deleteUserEmailMenuOpen;
  }

  selectDeleteUserEmail(email: string): void {
    this.deleteUserEmail = email;
    this.deleteUserEmailMenuOpen = false;
  }

  isDeleteUserEmailSelected(email: string): boolean {
    return (this.deleteUserEmail ?? '').trim() === email.trim();
  }

  get billingTierDisplayLabel(): string {
    return (
      this.BILLING_TIERS.find((t) => t.value === this.billingTier)?.label ??
      this.billingTier
    );
  }

  toggleBillingTierMenu(ev: MouseEvent): void {
    ev.stopPropagation();
    if (this.pageFieldsReadOnly) return;
    this.pricingDd = null;
    this.billingTierMenuOpen = !this.billingTierMenuOpen;
  }

  selectBillingTier(value: string): void {
    if (this.pageFieldsReadOnly) return;
    this.billingTier = value;
    this.billingTierMenuOpen = false;
  }

  togglePricingDd(
    ev: MouseEvent,
    row: number,
    field: 'feature' | 'unit' | 'rounding'
  ): void {
    ev.stopPropagation();
    if (this.pageFieldsReadOnly) return;
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
    if (this.pageFieldsReadOnly) return;
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
    if (this.pageFieldsReadOnly) {
      return;
    }
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

    this.clientPageViewOnly =
      ClientFormComponent.isDirectoryViewQuery(
        this.route.snapshot.queryParamMap.get('view')
      ) ||
      !!(typeof history !== 'undefined' && history.state?.viewOnly === true);

    if (!code) {
      void this.loadDataResidencyOptions();
      return;
    }

    this.isEditMode = true;
    this.clientCode = code;

    const client = history.state?.client as ClientRow | undefined;
    void this.hydrateEditClient(client).then(() => {
      this.applyDirectoryViewOnlyMode();
      this.applyPendingPricingRouteFlash();
    });
  }

  private applyPendingPricingRouteFlash(): void {
    if (!this.pendingPricingRouteFlash) {
      return;
    }
    this.pricingErrorMessage = this.pendingPricingRouteFlash;
    this.pendingPricingRouteFlash = '';
  }

  private async hydrateEditClient(client: ClientRow | undefined): Promise<void> {
    if (this.isEditMode && !this.clientPageViewOnly) {
      this.pageEditUnlocked = false;
      this.editPageCancelSnapshot = null;
    }
    if (client) {
      await this.bootstrapEditFormWithClient(client);
      // Directory “View” often opens from list rows without full `billing`; reload from API so pricing table matches server.
      if (this.clientPageViewOnly) {
        await this.loadClientByCode();
      }
    } else {
      await this.loadClientByCode();
    }
    await this.loadClientUsers();
  }

  private applyDirectoryViewOnlyMode(): void {
    if (!this.clientPageViewOnly || !this.isEditMode) {
      return;
    }
    this.pageEditUnlocked = false;
    this.editPageCancelSnapshot = null;
    this.clientForm.disable({ emitEvent: false });
    this.dataResidencyMenuOpen = false;
    this.billingTierMenuOpen = false;
    this.pricingDd = null;
  }

  get clientFormPageTitle(): string {
    if (this.clientPageViewOnly) {
      return 'View client';
    }
    return this.isEditMode ? 'Update Client' : 'Create Client';
  }

  /** Basic info + pricing are read-only (directory view, or Update Client before Edit). */
  get pageFieldsReadOnly(): boolean {
    return this.clientPageViewOnly || (this.isEditMode && !this.pageEditUnlocked);
  }

  /** Add / delete / row-edit users only after Edit is clicked (never in directory view). */
  get canManageClientUsers(): boolean {
    return this.pageEditUnlocked && !this.clientPageViewOnly;
  }

  get clientFormPageDescription(): string {
    if (this.clientPageViewOnly) {
      return 'Read-only: review basic information, users, and pricing below. Nothing on this page can be changed.';
    }
    if (this.isEditMode) {
      return this.pageEditUnlocked
        ? 'You are editing this client. Use Save under Pricing & Billing to apply client details and pricing together, or Cancel to discard changes. User actions (add, delete, edit) are available while editing.'
        : 'Review client details, users, and pricing. Click Edit above Basic information to change anything—including users—then use Save and Cancel under Pricing & Billing to apply or discard all edits together.';
    }
    return 'Create a new client record. Configure optional pricing below; it is saved when you create the client. Agents can be enabled after the client is created.';
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

  /**
   * UI “Agent Builder” uses feature code `agent_builder`; billing `customPricing` uses `prompt_builder`.
   */
  private pricingFeatureKeyForApi(uiFeatureCode: string): string {
    const c = (uiFeatureCode ?? '').trim();
    return c === 'agent_builder' ? 'prompt_builder' : c;
  }

  private pricingFeatureKeyFromApi(apiFeatureKey: string): string {
    const c = (apiFeatureKey ?? '').trim();
    return c === 'prompt_builder' ? 'agent_builder' : c;
  }

  private applyBillingFromClient(client: ClientRow): void {
    const billing = (client as any)?.billing ?? (client as any)?.bi;
    if (!billing) {
      this.allowNegativeBalance = false;
      this.pricingRules = [];
      return;
    }
    this.billingTier = (billing.tier && billing.tier !== 'free') ? billing.tier : 'basic';
    this.allowNegativeBalance = billing.allowNegativeBalance === true;
    const bcu = billing.baseCreditUsage;
    if (bcu && typeof bcu === 'object' && typeof bcu.prompt_builder === 'boolean') {
      this.baseCreditUsagePromptBuilder = bcu.prompt_builder;
    } else {
      this.baseCreditUsagePromptBuilder = false;
    }
    const cp = billing.customPricing;
    this.pricingRules = [];
    if (cp && typeof cp === 'object') {
      for (const [featureCode, unitMap] of Object.entries(cp)) {
        if (!unitMap || typeof unitMap !== 'object') continue;
        for (const [unitType, rule] of Object.entries(unitMap)) {
          if (!rule || typeof rule !== 'object' || typeof rule.creditPerUnit !== 'number') continue;
          this.pricingRules.push({
            featureCode: this.pricingFeatureKeyFromApi(featureCode),
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
    if (this.clientPageViewOnly || this.isEditMode) {
      return;
    }
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
      const pricingErr = this.validatePricingRulesForBilling();
      if (pricingErr) {
        this.pricingErrorMessage = pricingErr;
        return;
      }

      const createRes = await firstValueFrom(
        this.http.post<unknown>(
          `${this.apiBase}/clients`,
          {
            clientName: formValue.clientName,
            dataResidency: formValue.dataResidency,
            voiceConcurrency
          },
          {
            headers: new HttpHeaders({
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            })
          }
        )
      );

      const newCode = this.extractClientCodeFromCreateResponse(createRes);
      if (!newCode) {
        await this.router.navigate(['/clients'], {
          state: {
            listFlashMessage:
              'Client was created, but the server did not return a client code, so pricing was not saved. Open the client from the list and use Edit to set billing.'
          }
        });
        return;
      }

      try {
        await this.putBillingBilling(
          this.buildBillingPutBody(newCode),
          accessToken
        );
      } catch (billingErr) {
        console.error(billingErr);
        const detail =
          billingErr instanceof HttpErrorResponse
            ? (typeof billingErr.error?.message === 'string'
                ? billingErr.error.message
                : billingErr.statusText)
            : 'Unknown error';
        await this.router.navigate(
          ['/clients', newCode, 'edit'],
          {
            state: {
              client: {
                clientName: formValue.clientName,
                clientCode: newCode,
                enabledAgents: [],
                status: 'Active',
                owner: '',
                createdOn: ''
              } as ClientRow,
              flashPricingError: `Client was created, but saving pricing failed (${detail}). Open the client, click Edit, then Save to set billing.`
            }
          }
        );
        return;
      }

      this.successMessage =
        'Client created successfully. Pricing and billing were saved.';

      await this.router.navigate(['/clients']);
    } catch (error) {
      console.error(error);
      this.errorMessage = 'Unable to create client right now.';
    } finally {
      this.isSubmitting = false;
    }
  }

  async addUser(): Promise<void> {
    if (!this.canManageClientUsers) {
      return;
    }
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
    if (!this.canManageClientUsers) return;
    this.closeDeleteUserModal();
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

  openDeleteUserModal(): void {
    if (!this.canManageClientUsers) return;
    this.showAddUserModal = false;
    this.showEditUserModal = false;
    this.userErrorMessage = '';
    this.deleteUserErrorMessage = '';
    this.deleteUserEmailMenuOpen = false;
    this.deleteUserEmail = this.clientUsers[0]?.email ?? '';
    this.showDeleteUserModal = true;
  }

  closeDeleteUserModal(): void {
    this.showDeleteUserModal = false;
    this.deleteUserEmail = '';
    this.deleteUserEmailMenuOpen = false;
    this.deleteUserErrorMessage = '';
  }

  async deleteUser(): Promise<void> {
    if (!this.canManageClientUsers) return;
    const email = this.deleteUserEmail.trim();
    if (!email) {
      this.deleteUserErrorMessage = 'Select a user to remove.';
      return;
    }
    if (
      !window.confirm(
        `Remove ${email} from this client? They will lose access.`
      )
    ) {
      return;
    }

    this.isDeletingUser = true;
    this.deleteUserErrorMessage = '';

    try {
      const accessToken = localStorage.getItem('accessToken');
      if (!accessToken) {
        this.deleteUserErrorMessage = 'Session expired. Please log in again.';
        return;
      }

      const row = this.clientUsers.find(
        (u) => u.email.trim().toLowerCase() === email.toLowerCase()
      );
      const userId = row?.id?.trim();
      if (!userId) {
        this.deleteUserErrorMessage =
          'Could not resolve this user’s id. Reload the page and try again.';
        return;
      }

      await firstValueFrom(
        this.http.delete<{
          message?: string;
          userId?: string;
        }>(`${this.apiBase}/clients/${this.clientCode}/users/${encodeURIComponent(userId)}`, {
          headers: new HttpHeaders({ Authorization: `Bearer ${accessToken}` })
        })
      );

      this.closeDeleteUserModal();
      await this.loadClientUsers();
    } catch (error) {
      console.error(error);
      this.deleteUserErrorMessage =
        (error as any)?.error?.message ?? 'Unable to delete user right now.';
    } finally {
      this.isDeletingUser = false;
    }
  }

  openEditUserModal(u: { id: string; email: string; role: string }): void {
    if (!this.canManageClientUsers) return;
    this.closeDeleteUserModal();
    this.userErrorMessage = '';
    this.editUserErrorMessage = '';
    const id = (u.id ?? '').trim();
    if (!id) {
      this.userErrorMessage =
        'Cannot edit this user: missing id from the server. Reload the page and try again.';
      return;
    }
    this.editUserId = id;
    this.editUserCurrentEmail = u.email;
    this.editUserNewEmail = u.email;
    this.editUserNewPassword = '';
    this.showEditUserModal = true;
  }

  closeEditUserModal(): void {
    this.showEditUserModal = false;
    this.editUserId = '';
    this.editUserCurrentEmail = '';
    this.editUserNewEmail = '';
    this.editUserNewPassword = '';
    this.editUserErrorMessage = '';
  }

  async updateUser(): Promise<void> {
    if (!this.canManageClientUsers) return;
    if (!this.editUserId.trim()) {
      this.editUserErrorMessage = 'User id is missing. Close this dialog and try again.';
      return;
    }
    const email = this.editUserNewEmail.trim();
    if (!email) {
      this.editUserErrorMessage = 'New email is required.';
      return;
    }
    const pwd = this.editUserNewPassword.trim();
    if (pwd && pwd.length < 6) {
      this.editUserErrorMessage =
        'New password must be at least 6 characters, or leave blank to keep the current password.';
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

      const body: { email: string; password?: string } = { email };
      if (pwd) {
        body.password = pwd;
      }

      await firstValueFrom(
        this.http.put<{
          message?: string;
          user?: { id: string; email: string; role: string; createdAt: string };
        }>(
          `${this.apiBase}/clients/${this.clientCode}/users/${encodeURIComponent(this.editUserId.trim())}`,
          body,
          {
            headers: new HttpHeaders({
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            })
          }
        )
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
        this.http.get<{
          users: Array<{
            id?: string;
            _id?: string;
            email: string;
            role: string;
            createdAt?: string;
          }>;
        }>(`${this.apiBase}/clients/${this.clientCode}/users`, {
          headers: new HttpHeaders({ Authorization: `Bearer ${accessToken}` })
        })
      );
      this.clientUsers = (res.users ?? []).map((u) => ({
        id: String(u.id ?? u._id ?? '').trim(),
        email: u.email,
        role: u.role,
        createdAt: u.createdAt
      }));
    } catch {
      this.clientUsers = [];
    } finally {
      this.isLoadingUsers = false;
    }
  }

  addPricingRule(): void {
    if (this.pageFieldsReadOnly) return;
    this.pricingDd = null;
    this.pricingRules.push({
      featureCode: 'chat',
      unitType: 'message',
      creditPerUnit: 1,
      rounding: 'ceil'
    });
  }

  removePricingRule(index: number): void {
    if (this.pageFieldsReadOnly) return;
    this.pricingRules.splice(index, 1);
    if (this.pricingDd?.row === index) {
      this.pricingDd = null;
    } else if (this.pricingDd !== null && this.pricingDd.row > index) {
      this.pricingDd = { ...this.pricingDd, row: this.pricingDd.row - 1 };
    }
  }

  /** Same payload shape as `PUT …/billing/billing` for create + edit flows. */
  private validatePricingRulesForBilling(): string | null {
    for (const row of this.pricingRules) {
      const creditPerUnit = Number(row.creditPerUnit);
      if (!Number.isFinite(creditPerUnit) || creditPerUnit <= 0) {
        return `Credit per unit must be a positive number for ${row.featureCode} / ${row.unitType}.`;
      }
      if (!row.featureCode?.trim() || !row.unitType?.trim()) {
        return 'Feature and unit type are required for each rule.';
      }
    }
    return null;
  }

  private buildBillingPutBody(clientCode: string): {
    clientCode: string;
    tier: string;
    allowNegativeBalance: boolean;
    customPricing: Record<
      string,
      Record<
        string,
        {
          creditPerUnit: number;
          unit?: string;
          rounding?: string;
          intervalSeconds?: number;
          minimumSeconds?: number;
        }
      >
    >;
    baseCreditUsage: { prompt_builder: boolean };
  } {
    const customPricing: Record<
      string,
      Record<
        string,
        {
          creditPerUnit: number;
          unit?: string;
          rounding?: string;
          intervalSeconds?: number;
          minimumSeconds?: number;
        }
      >
    > = {};
    for (const row of this.pricingRules) {
      const creditPerUnit = Number(row.creditPerUnit);
      const apiFeatureKey = this.pricingFeatureKeyForApi(row.featureCode);
      if (!customPricing[apiFeatureKey]) customPricing[apiFeatureKey] = {};
      const rule: {
        creditPerUnit: number;
        unit?: string;
        rounding?: string;
        intervalSeconds?: number;
        minimumSeconds?: number;
      } = {
        creditPerUnit,
        rounding: row.rounding || 'ceil'
      };
      if (row.featureCode === 'voice') {
        if (
          row.intervalSeconds != null &&
          Number.isFinite(Number(row.intervalSeconds)) &&
          Number(row.intervalSeconds) > 0
        ) {
          rule.intervalSeconds = Number(row.intervalSeconds);
        }
        if (
          row.minimumSeconds != null &&
          Number.isFinite(Number(row.minimumSeconds)) &&
          Number(row.minimumSeconds) >= 0
        ) {
          rule.minimumSeconds = Number(row.minimumSeconds);
        }
      }
      customPricing[apiFeatureKey][row.unitType] = rule;
    }
    return {
      clientCode,
      tier: this.billingTier,
      allowNegativeBalance: this.allowNegativeBalance,
      customPricing,
      baseCreditUsage: {
        prompt_builder: this.baseCreditUsagePromptBuilder
      }
    };
  }

  private extractClientCodeFromCreateResponse(res: unknown): string | null {
    const r = res as Record<string, unknown> | null;
    if (!r || typeof r !== 'object') {
      return null;
    }
    const client = r['client'] as Record<string, unknown> | undefined;
    const fromNested =
      client && typeof client === 'object'
        ? (client['clientCode'] ?? client['cod'] ?? client['code'])
        : undefined;
    const direct = r['clientCode'] ?? r['cod'] ?? r['code'];
    const raw = (fromNested ?? direct) as unknown;
    const s = typeof raw === 'string' ? raw.trim() : String(raw ?? '').trim();
    return s && s !== 'undefined' ? s : null;
  }

  private async putBillingBilling(
    body: ReturnType<ClientFormComponent['buildBillingPutBody']>,
    accessToken: string
  ): Promise<{
    message?: string;
    billing?: Record<string, unknown>;
  }> {
    return await firstValueFrom(
      this.http.put<{
        message?: string;
        billing?: Record<string, unknown>;
      }>(`${this.apiBase}/billing/billing`, body, {
        headers: new HttpHeaders({
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        })
      })
    );
  }

  async savePricing(): Promise<void> {
    if (this.pageFieldsReadOnly) {
      return;
    }
    const accessToken = localStorage.getItem('accessToken');
    if (!accessToken) {
      this.pricingErrorMessage = 'Session expired. Please log in again.';
      return;
    }
    if (!this.clientCode?.trim()) {
      this.pricingErrorMessage = 'Missing client code.';
      return;
    }

    const pricingErr = this.validatePricingRulesForBilling();
    if (pricingErr) {
      this.pricingErrorMessage = pricingErr;
      return;
    }

    this.isSavingPricing = true;
    this.pricingErrorMessage = '';
    this.pricingSuccessMessage = '';

    const body = this.buildBillingPutBody(this.clientCode.trim());

    try {
      const res = await this.putBillingBilling(body, accessToken);
      this.pricingSuccessMessage =
        res?.message?.trim() || 'Billing updated successfully.';
      if (res?.billing && typeof res.billing === 'object') {
        this.applyBillingFromClient({
          billing: res.billing
        } as unknown as ClientRow);
      }
    } catch (error) {
      console.error(error);
      this.pricingErrorMessage =
        (error as any)?.error?.message ?? 'Unable to save pricing right now.';
    } finally {
      this.isSavingPricing = false;
    }
  }

  private captureEditPageSnapshot(): void {
    const raw = this.clientForm.getRawValue();
    this.editPageCancelSnapshot = {
      clientName: String(raw.clientName ?? ''),
      enabledAgents: [...((raw.enabledAgents as string[]) ?? [])],
      dataResidency: String(raw.dataResidency ?? ''),
      voiceConcurrency: Number(raw.voiceConcurrency),
      billingTier: this.billingTier,
      allowNegativeBalance: this.allowNegativeBalance,
      baseCreditUsagePromptBuilder: this.baseCreditUsagePromptBuilder,
      pricingRules: this.pricingRules.map((r) => ({ ...r }))
    };
  }

  private restoreEditPageSnapshot(): void {
    const s = this.editPageCancelSnapshot;
    if (!s) {
      return;
    }
    this.clientForm.patchValue({
      clientName: s.clientName,
      enabledAgents: s.enabledAgents,
      dataResidency: s.dataResidency,
      voiceConcurrency: s.voiceConcurrency
    });
    this.billingTier = s.billingTier;
    this.allowNegativeBalance = s.allowNegativeBalance;
    this.baseCreditUsagePromptBuilder = s.baseCreditUsagePromptBuilder;
    this.pricingRules = s.pricingRules.map((r) => ({ ...r }));
    this.editPageCancelSnapshot = null;
  }

  startPageEdit(): void {
    if (!this.isEditMode || this.clientPageViewOnly) {
      return;
    }
    this.captureEditPageSnapshot();
    this.pageEditUnlocked = true;
    this.errorMessage = '';
    this.successMessage = '';
    this.pricingErrorMessage = '';
    this.pricingSuccessMessage = '';
    this.dataResidencyMenuOpen = false;
    this.billingTierMenuOpen = false;
    this.pricingDd = null;
  }

  cancelPageEdit(): void {
    if (!this.pageEditUnlocked || this.clientPageViewOnly || this.isSavingEntirePage) {
      return;
    }
    this.restoreEditPageSnapshot();
    this.pageEditUnlocked = false;
    this.errorMessage = '';
    this.successMessage = '';
    this.pricingErrorMessage = '';
    this.pricingSuccessMessage = '';
    this.dataResidencyMenuOpen = false;
    this.billingTierMenuOpen = false;
    this.pricingDd = null;
    this.closeAddUserModal();
    this.closeDeleteUserModal();
    this.closeEditUserModal();
  }

  async saveEntireEditPage(): Promise<void> {
    if (!this.isEditMode || this.clientPageViewOnly || !this.pageEditUnlocked) {
      return;
    }
    if (this.clientForm.invalid) {
      this.clientForm.markAllAsTouched();
      return;
    }

    const accessToken = localStorage.getItem('accessToken');
    if (!accessToken) {
      this.errorMessage = 'Session expired. Please log in again.';
      return;
    }

    const formValue = this.clientForm.getRawValue();
    if (!formValue.enabledAgents || formValue.enabledAgents.length === 0) {
      this.errorMessage = 'Select at least one enabled agent before saving.';
      return;
    }

    const voiceConcurrency = Number(formValue.voiceConcurrency);
    if (
      !Number.isFinite(voiceConcurrency) ||
      !Number.isInteger(voiceConcurrency) ||
      voiceConcurrency < 1
    ) {
      this.errorMessage = 'Voice concurrency must be a positive whole number.';
      return;
    }

    const pricingErr = this.validatePricingRulesForBilling();
    if (pricingErr) {
      this.pricingErrorMessage = pricingErr;
      return;
    }

    this.isSavingEntirePage = true;
    this.errorMessage = '';
    this.successMessage = '';
    this.pricingErrorMessage = '';
    this.pricingSuccessMessage = '';

    try {
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
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            })
          }
        )
      );

      const billingRes = await this.putBillingBilling(
        this.buildBillingPutBody(this.clientCode.trim()),
        accessToken
      );

      if (billingRes?.billing && typeof billingRes.billing === 'object') {
        this.applyBillingFromClient({
          billing: billingRes.billing
        } as unknown as ClientRow);
      }

      this.pageEditUnlocked = false;
      this.editPageCancelSnapshot = null;
      this.closeAddUserModal();
      this.closeDeleteUserModal();
      this.closeEditUserModal();
      this.successMessage = 'Client and pricing saved successfully.';
      const billingMsg = billingRes?.message?.trim();
      if (billingMsg) {
        this.pricingSuccessMessage = billingMsg;
      }
    } catch (error) {
      console.error(error);
      const msg =
        error instanceof HttpErrorResponse
          ? (typeof error.error?.message === 'string'
              ? error.error.message
              : error.statusText)
          : 'Unable to save. Check your connection and try again.';
      this.errorMessage = msg;
    } finally {
      this.isSavingEntirePage = false;
    }
  }

  onClientFormSubmit(event: Event): void {
    event.preventDefault();
    if (this.clientPageViewOnly || this.isEditMode) {
      return;
    }
    void this.onSubmit();
  }

  goBack(): void {
    void this.router.navigate(['/clients']);
  }
}
