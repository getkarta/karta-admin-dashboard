import { HttpErrorResponse } from '@angular/common/http';
import {
  Component,
  ElementRef,
  HostListener,
  OnInit,
  ViewChild
} from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ClientRow } from '../clients/clients.component';
import {
  ClientSettingsMetaService,
  DEFAULT_DATA_RESIDENCY_OPTIONS,
  DataResidencyOption,
  FeatureUnitTypeOption
} from '../services/client-settings-meta.service';
import {
  ApiService,
  VoiceClientConfigPatchRequest,
  VoiceClientConfigResponse,
  VoiceStack
} from '../services/api.service';

type PricingRule = {
  featureCode: string;
  unitType: string;
  creditPerUnit: number;
  rounding: string;
  intervalSeconds?: number;
  minimumSeconds?: number;
};

type VoiceStackSelectOption = {
  value: string;
  label: string;
};

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
    voiceStackId: string;
    billingTier: string;
    allowNegativeBalance: boolean;
    baseCreditUsagePromptBuilder: boolean;
    pricingRules: PricingRule[];
  } | null = null;
  /** Save (client PUT + billing PUT) from the actions below Pricing & Billing. */
  isSavingEntirePage = false;
  clientCode = '';
  errorMessage = '';
  successMessage = '';
  isSubmitting = false;
  isLoadingVoiceConcurrency = false;
  voiceConcurrencyLoadMessage = '';
  @ViewChild('voiceStackDropdownRoot')
  voiceStackDropdownRoot?: ElementRef<HTMLElement>;
  voiceStackMenuOpen = false;
  voiceStacks: VoiceStack[] = [];
  isLoadingVoiceStacks = false;
  effectiveVoiceStackId = '';
  private voiceConfigSnapshot: {
    maxConcurrentDials: number;
    voiceStackId: string | null;
  } | null = null;
  clientCredits: number | null = null;

  // Pricing: PUT /admin/billing/billing — body: clientCode, tier, allowNegativeBalance, customPricing, baseCreditUsage
  pricingErrorMessage = '';
  pricingSuccessMessage = '';
  isSavingPricing = false;
  billingTier = 'enterprise';
  allowNegativeBalance = true;
  /** Maps to `baseCreditUsage.prompt_builder` on the billing API */
  baseCreditUsagePromptBuilder = false;
  billingTierMenuOpen = false;
  /** Which pricing rule custom dropdown is open (feature / unit / rounding). */
  pricingDd: { row: number; field: 'feature' | 'unit' | 'rounding' } | null =
    null;
  /** Flat list of custom pricing rules; each row becomes customPricing[featureCode][unitType] */
  pricingRules: PricingRule[] = [];

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
  featureUnitTypeOptions: FeatureUnitTypeOption[] = [];
  isLoadingDataResidencyOptions = false;

  /** Suggested values for the voice concurrency number field (datalist). */
  readonly voiceConcurrencyOptions = [1, 2, 5, 10, 25, 50, 100] as const;

  clientForm: FormGroup;

  /** From `navigate(..., { state: { flashPricingError } })` after create + billing PUT failure. */
  private pendingClientRouteFlash = '';
  private pendingPricingRouteFlash = '';
  private pendingSuccessRouteFlash = '';

  /** Add credits popup (Update Client toolbar). */
  addCreditsModalOpen = false;
  addCreditsAmount = '';
  addCreditsFeatureCode = '';
  addCreditsExpiry = '';
  addCreditsFeatureMenuOpen = false;
  addCreditsError = '';
  addCreditsSubmitting = false;

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private api: ApiService,
    private clientSettingsMeta: ClientSettingsMetaService
  ) {
    const nav = this.router.getCurrentNavigation();
    const flash = nav?.extras?.state?.['flashPricingError'];
    if (typeof flash === 'string' && flash.trim()) {
      this.pendingPricingRouteFlash = flash.trim();
    }
    const clientFlash = nav?.extras?.state?.['flashClientError'];
    if (typeof clientFlash === 'string' && clientFlash.trim()) {
      this.pendingClientRouteFlash = clientFlash.trim();
    }
    const successFlash = nav?.extras?.state?.['flashSuccessMessage'];
    if (typeof successFlash === 'string' && successFlash.trim()) {
      this.pendingSuccessRouteFlash = successFlash.trim();
    }
    this.clientForm = this.fb.group({
      clientName: ['', [Validators.required, Validators.minLength(3)]],
      dataResidency: this.fb.nonNullable.control<string>('GLOBAL'),
      voiceConcurrency: this.fb.nonNullable.control<number>(10, [
        Validators.required,
        Validators.min(1),
        Validators.max(1000)
      ]),
      voiceStackId: this.fb.nonNullable.control<string>(''),
      enabledAgents: this.fb.nonNullable.control<string[]>(['chat'])
    });
  }

  get dataResidencyDisplayLabel(): string {
    const v = this.clientForm?.get('dataResidency')?.value as string | undefined;
    return (
      this.dataResidencyOptions.find((o) => o.value === v)?.label ?? v ?? ''
    );
  }

  get clientCreditsDisplayLabel(): string {
    if (this.clientCredits === null) {
      return 'Credits: -';
    }
    return `Credits: ${this.formatCreditAmount(this.clientCredits)}`;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(ev: MouseEvent): void {
    const t = ev.target as Node;
    if (this.dataResidencyMenuOpen) {
      if (!this.residencyDropdownRoot?.nativeElement?.contains(t)) {
        this.dataResidencyMenuOpen = false;
      }
    }
    if (this.voiceStackMenuOpen) {
      if (!this.voiceStackDropdownRoot?.nativeElement?.contains(t)) {
        this.voiceStackMenuOpen = false;
      }
    }
    const el = ev.target as HTMLElement;
    if (this.billingTierMenuOpen && !el.closest('.billing-tier-dd')) {
      this.billingTierMenuOpen = false;
    }
    if (this.pricingDd !== null && !el.closest('.pricing-rule-dd')) {
      this.pricingDd = null;
    }
    if (
      this.addCreditsModalOpen &&
      this.addCreditsFeatureMenuOpen &&
      !el.closest('.add-credits-feature-dd')
    ) {
      this.addCreditsFeatureMenuOpen = false;
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.addCreditsFeatureMenuOpen) {
      this.addCreditsFeatureMenuOpen = false;
      return;
    }
    if (this.addCreditsModalOpen) {
      this.closeAddCreditsModal();
      return;
    }
    this.dataResidencyMenuOpen = false;
    this.voiceStackMenuOpen = false;
    this.billingTierMenuOpen = false;
    this.pricingDd = null;
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

  get voiceStackSelectOptions(): VoiceStackSelectOption[] {
    const out: VoiceStackSelectOption[] = [];
    const defaultStack = this.defaultVoiceStack();

    if (this.isEditMode) {
      out.push({
        value: '',
        label: defaultStack ? `Default (${defaultStack.id})` : 'Default'
      });
    }

    for (const stack of this.voiceStacks) {
      const id = String(stack.id ?? '').trim();
      if (!id) continue;
      const parts = [id];
      if (stack.environment) parts.push(stack.environment);
      if (stack.isDefault) parts.push('default');
      out.push({
        value: id,
        label: parts.join(' - ')
      });
    }

    return out;
  }

  get voiceStackDisplayLabel(): string {
    const value = this.voiceStackFormValue();
    return (
      this.voiceStackSelectOptions.find((o) => o.value === value)?.label ??
      value ??
      ''
    );
  }

  get effectiveVoiceStackDisplayLabel(): string {
    if (!this.isEditMode) {
      return this.voiceStackFormValue() || this.defaultVoiceStack()?.id || '';
    }
    return this.effectiveVoiceStackId || this.defaultVoiceStack()?.id || '';
  }

  toggleVoiceStackMenu(ev: MouseEvent): void {
    ev.stopPropagation();
    if (
      this.pageFieldsReadOnly ||
      this.isLoadingVoiceStacks ||
      this.voiceStackSelectOptions.length === 0
    ) {
      return;
    }
    this.voiceStackMenuOpen = !this.voiceStackMenuOpen;
  }

  selectVoiceStack(value: string): void {
    if (this.pageFieldsReadOnly) return;
    this.clientForm.patchValue({ voiceStackId: value });
    this.voiceStackMenuOpen = false;
  }

  isVoiceStackSelected(value: string): boolean {
    return this.voiceStackFormValue() === value;
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
        this.pricingUnitOptionsForFeature(rule.featureCode).find(
          (o) => o.value === rule.unitType
        )?.label ??
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
    if (field === 'feature') {
      rule.featureCode = value;
      rule.unitType = this.defaultUnitTypeForPricingFeature(value);
    } else if (field === 'unit') {
      rule.unitType = value;
    } else {
      rule.rounding = value;
    }
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
    if (agentValue === 'voice') {
      if (checked) {
        this.ensureVoiceDefaultsForSelectedAgent();
        if (this.voiceStacks.length === 0 && !this.isLoadingVoiceStacks) {
          void this.loadVoiceStackOptions(
            this.isEditMode ? this.clientCode : 'new'
          );
        }
        if (this.isEditMode && !this.voiceConfigSnapshot) {
          void this.loadVoiceConfigForCurrentClient();
        }
      } else {
        this.voiceStackMenuOpen = false;
        this.clientForm.patchValue({ voiceConcurrency: 10 });
      }
    }
    this.syncPricingRulesWithEnabledAgents();
  }

  ngOnInit(): void {
    const code = this.route.snapshot.paramMap.get('code');

    this.clientPageViewOnly =
      ClientFormComponent.isDirectoryViewQuery(
        this.route.snapshot.queryParamMap.get('view')
      ) ||
      !!(typeof history !== 'undefined' && history.state?.viewOnly === true);

    if (!code) {
      this.ensureCreatePricingDefaults();
      void this.loadCreateFormMeta();
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
    if (this.pendingSuccessRouteFlash) {
      this.successMessage = this.pendingSuccessRouteFlash;
      this.pendingSuccessRouteFlash = '';
    }
    if (this.pendingClientRouteFlash) {
      this.errorMessage = this.pendingClientRouteFlash;
      this.pendingClientRouteFlash = '';
    }
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
    }
    // List rows can be partial or stale; always reload the full client before showing/editing.
    await this.loadClientByCode();
    await this.loadVoiceStackOptions(this.clientCode);
    await this.loadVoiceConfigForCurrentClient();
  }

  private applyDirectoryViewOnlyMode(): void {
    if (!this.clientPageViewOnly || !this.isEditMode) {
      return;
    }
    this.pageEditUnlocked = false;
    this.editPageCancelSnapshot = null;
    this.clientForm.disable({ emitEvent: false });
    this.dataResidencyMenuOpen = false;
    this.voiceStackMenuOpen = false;
    this.billingTierMenuOpen = false;
    this.pricingDd = null;
  }

  private ensureCreatePricingDefaults(): void {
    if (this.isEditMode || this.clientPageViewOnly || this.pricingRules.length > 0) {
      return;
    }
    this.syncPricingRulesWithEnabledAgents();
  }

  private async loadCreateFormMeta(): Promise<void> {
    await Promise.all([
      this.loadDataResidencyOptions(),
      this.loadVoiceStackOptions('new')
    ]);
    this.ensureVoiceDefaultsForSelectedAgent();
  }

  private voiceStackFormValue(): string {
    const raw = this.clientForm.get('voiceStackId')?.value;
    return typeof raw === 'string' ? raw.trim() : String(raw ?? '').trim();
  }

  private defaultVoiceStack(): VoiceStack | undefined {
    return (
      this.voiceStacks.find((stack) => stack.isDefault === true) ??
      this.voiceStacks[0]
    );
  }

  private ensureVoiceDefaultsForSelectedAgent(): void {
    if (!this.isAgentEnabled('voice')) {
      return;
    }

    const currentConcurrency = this.parseVoiceConcurrency(
      this.clientForm.get('voiceConcurrency')?.value
    );
    if (currentConcurrency === null) {
      this.clientForm.patchValue({ voiceConcurrency: 10 });
    }

    if (!this.isEditMode && !this.voiceStackFormValue()) {
      const defaultStackId = this.defaultVoiceStack()?.id?.trim();
      if (defaultStackId) {
        this.clientForm.patchValue({ voiceStackId: defaultStackId });
      }
    }
  }

  get pricingFeatureOptions(): Array<{ value: string; label: string }> {
    const allowed = this.allowedPricingFeatureCodes();
    const featureOptions = this.FEATURE_CODES.filter((f) =>
      allowed.includes(f.value)
    );
    const metaFeatureCodes = new Set(
      this.featureUnitTypeOptions
        .map((o) => this.pricingFeatureKeyFromApi(o.featureCode))
        .filter((value) => value.trim())
    );
    if (metaFeatureCodes.size === 0) {
      return featureOptions;
    }
    return featureOptions.filter((f) => metaFeatureCodes.has(f.value));
  }

  pricingUnitOptionsForRule(
    rule: Pick<PricingRule, 'featureCode'>
  ): Array<{ value: string; label: string }> {
    return this.pricingUnitOptionsForFeature(rule.featureCode);
  }

  get hasInvalidPricingCredits(): boolean {
    return this.pricingRules.some((rule) =>
      this.pricingRuleHasInvalidCredits(rule)
    );
  }

  pricingRuleHasInvalidCredits(rule: { creditPerUnit: unknown }): boolean {
    if (!this.isEditMode && !this.clientPageViewOnly) {
      return this.pricingRuleHasInvalidCreateCredits(rule);
    }
    const creditPerUnit = Number(rule.creditPerUnit);
    return !Number.isFinite(creditPerUnit) || creditPerUnit <= 0;
  }

  private pricingRuleHasInvalidCreateCredits(rule: {
    creditPerUnit: unknown;
  }): boolean {
    const raw = rule.creditPerUnit;
    if (raw === undefined || raw === null || raw === '') {
      return false;
    }
    const creditPerUnit = Number(raw);
    return !Number.isFinite(creditPerUnit) || creditPerUnit < 0;
  }

  private pricingRuleIsBillable(rule: { creditPerUnit: unknown }): boolean {
    const creditPerUnit = Number(rule.creditPerUnit);
    return Number.isFinite(creditPerUnit) && creditPerUnit > 0;
  }

  private allowedPricingFeatureCodes(): string[] {
    const selected =
      (this.clientForm?.get('enabledAgents')?.value as string[] | undefined) ??
      [];
    const selectedSet = new Set(
      selected.map((value) => this.normalizeAgentValue(value))
    );
    return ['chat', 'voice'].filter((featureCode) =>
      selectedSet.has(featureCode)
    );
  }

  private isPricingFeatureAllowed(featureCode: string): boolean {
    return this.allowedPricingFeatureCodes().includes(featureCode);
  }

  private defaultPricingFeatureCode(): string {
    return this.pricingFeatureOptions[0]?.value ?? 'chat';
  }

  private defaultUnitTypeForPricingFeature(featureCode: string): string {
    return (
      this.pricingUnitOptionsForFeature(featureCode)[0]?.value ??
      (featureCode === 'voice' ? 'minute' : 'message')
    );
  }

  private syncPricingRulesWithEnabledAgents(): void {
    const options = this.pricingFeatureOptions;
    const allowed = new Set(options.map((option) => option.value));

    if (allowed.size === 0) {
      this.pricingRules = [];
      this.pricingDd = null;
      return;
    }

    let nextRules = this.pricingRules.filter((rule) =>
      allowed.has(rule.featureCode)
    );

    if (!this.isEditMode && !this.clientPageViewOnly) {
      const defaultRules = this.defaultPricingRulesForCreate();
      const defaultKeys = new Set(
        defaultRules.map((rule) =>
          this.pricingRuleKey(rule.featureCode, rule.unitType)
        )
      );

      if (this.hasFeatureUnitTypeOptionsForSelectedAgents()) {
        nextRules = nextRules.filter((rule) =>
          defaultKeys.has(this.pricingRuleKey(rule.featureCode, rule.unitType))
        );
      }

      const nextKeys = new Set(
        nextRules.map((rule) =>
          this.pricingRuleKey(rule.featureCode, rule.unitType)
        )
      );
      for (const defaultRule of defaultRules) {
        const key = this.pricingRuleKey(
          defaultRule.featureCode,
          defaultRule.unitType
        );
        if (!nextKeys.has(key)) {
          nextRules.push(defaultRule);
          nextKeys.add(key);
        }
      }
    }

    if (nextRules.length !== this.pricingRules.length) {
      this.pricingDd = null;
    }
    this.pricingRules = nextRules;
  }

  private pricingUnitOptionsForFeature(
    featureCode: string
  ): Array<{ value: string; label: string }> {
    const featureOptions = this.featureUnitOptionsForFeature(featureCode);
    if (featureOptions.length === 0) {
      return this.UNIT_TYPES;
    }

    return featureOptions.map((option) => {
      const fallbackLabel =
        this.UNIT_TYPES.find((u) => u.value === option.unitType)?.label ??
        option.unitType;
      return {
        value: option.unitType,
        label: option.unitLabel ?? fallbackLabel
      };
    });
  }

  private featureUnitOptionsForFeature(
    featureCode: string
  ): FeatureUnitTypeOption[] {
    const normalizedFeatureCode = this.pricingFeatureKeyFromApi(featureCode);
    const seen = new Set<string>();
    const out: FeatureUnitTypeOption[] = [];

    for (const option of this.featureUnitTypeOptions) {
      const optionFeatureCode = this.pricingFeatureKeyFromApi(
        option.featureCode
      );
      const unitType = String(option.unitType ?? '').trim();
      if (optionFeatureCode !== normalizedFeatureCode || !unitType) {
        continue;
      }
      const key = this.pricingRuleKey(optionFeatureCode, unitType);
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      out.push({
        ...option,
        featureCode: optionFeatureCode,
        unitType
      });
    }

    return out;
  }

  private featureUnitOptionsForSelectedAgents(): FeatureUnitTypeOption[] {
    const allowed = new Set(this.allowedPricingFeatureCodes());
    const seen = new Set<string>();
    const out: FeatureUnitTypeOption[] = [];

    for (const option of this.featureUnitTypeOptions) {
      const featureCode = this.pricingFeatureKeyFromApi(option.featureCode);
      const unitType = String(option.unitType ?? '').trim();
      if (!allowed.has(featureCode) || !unitType) {
        continue;
      }
      const key = this.pricingRuleKey(featureCode, unitType);
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      out.push({
        ...option,
        featureCode,
        unitType
      });
    }

    return out;
  }

  private hasFeatureUnitTypeOptionsForSelectedAgents(): boolean {
    return this.featureUnitOptionsForSelectedAgents().length > 0;
  }

  private defaultPricingRulesForCreate(): PricingRule[] {
    const rulesFromMeta = this.featureUnitOptionsForSelectedAgents().map(
      (option) => this.createPricingRuleFromFeatureUnitOption(option)
    );
    if (rulesFromMeta.length > 0) {
      return rulesFromMeta;
    }
    return this.pricingFeatureOptions.map((option) =>
      this.createDefaultPricingRule(option.value)
    );
  }

  private createPricingRuleFromFeatureUnitOption(
    option: FeatureUnitTypeOption
  ): PricingRule {
    const rule: PricingRule = {
      featureCode: option.featureCode,
      unitType: option.unitType,
      creditPerUnit:
        typeof option.creditPerUnit === 'number' &&
        Number.isFinite(option.creditPerUnit)
          ? option.creditPerUnit
          : 0,
      rounding: option.rounding || 'ceil'
    };

    if (
      option.intervalSeconds !== undefined &&
      Number.isFinite(option.intervalSeconds)
    ) {
      rule.intervalSeconds = option.intervalSeconds;
    }
    if (
      option.minimumSeconds !== undefined &&
      Number.isFinite(option.minimumSeconds)
    ) {
      rule.minimumSeconds = option.minimumSeconds;
    }

    return rule;
  }

  private pricingRuleKey(featureCode: string, unitType: string): string {
    return `${String(featureCode ?? '').trim()}::${String(unitType ?? '').trim()}`;
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

  /** Billing overrides are optional during create; server defaults are used when empty. */
  get isCreateClientBlockedByPricing(): boolean {
    return false;
  }

  get clientFormPageDescription(): string {
    if (this.clientPageViewOnly) {
      return 'Read-only: review basic information and pricing below. Nothing on this page can be changed. Add or manage users from the Clients directory (user count).';
    }
    if (this.isEditMode) {
      return this.pageEditUnlocked
        ? 'You are editing this client. Use Save under Pricing & Billing to apply client details and pricing together, or Cancel to discard changes.'
        : 'Review client details and pricing. Click Edit above Basic information to make changes, then use Save and Cancel under Pricing & Billing to apply or discard edits together.';
    }
    return 'Create a new client record. Voice configuration and optional billing overrides are saved with the create request.';
  }

  private pickResidencyAndVoiceFromUnknown(
    src: Record<string, unknown>
  ): Partial<{
    dataResidency: string;
    voiceConcurrency: number;
    voiceStackId: string;
  }> {
    const out: Partial<{
      dataResidency: string;
      voiceConcurrency: number;
      voiceStackId: string;
    }> = {};
    const dr = src['dataResidency'] ?? src['data_residency'];
    if (typeof dr === 'string' && dr.trim()) {
      out.dataResidency = dr.trim();
    }
    const vc = src['voiceConcurrency'] ?? src['voice_concurrency'];
    const n = this.parseVoiceConcurrency(vc);
    if (n !== null) {
      out.voiceConcurrency = n;
    }
    const voiceStackId = src['voiceStackId'] ?? src['voice_stack_id'];
    if (typeof voiceStackId === 'string' && voiceStackId.trim()) {
      out.voiceStackId = voiceStackId.trim();
    }
    return out;
  }

  private setClientCreditsFromUnknown(
    src: Record<string, unknown> | null | undefined,
    clearWhenMissing: boolean
  ): void {
    const credits = this.extractClientCredits(src);
    if (credits !== null) {
      this.clientCredits = credits;
      return;
    }
    if (clearWhenMissing) {
      this.clientCredits = null;
    }
  }

  private extractClientCredits(
    src: Record<string, unknown> | null | undefined
  ): number | null {
    if (!src || typeof src !== 'object') {
      return null;
    }

    const direct = this.extractCreditNumberFromObject(src);
    if (direct !== null) {
      return direct;
    }

    const billing = src['billing'] ?? src['bi'];
    if (billing && typeof billing === 'object') {
      const billingCredits = this.extractCreditNumberFromObject(
        billing as Record<string, unknown>
      );
      if (billingCredits !== null) {
        return billingCredits;
      }
    }

    const credits = src['credits'] ?? src['credit'];
    if (credits && typeof credits === 'object') {
      return this.extractCreditNumberFromObject(
        credits as Record<string, unknown>
      );
    }

    return null;
  }

  private extractCreditNumberFromObject(
    src: Record<string, unknown>
  ): number | null {
    const keys = [
      'creditBalance',
      'credit_balance',
      'creditsBalance',
      'credits_balance',
      'remainingCredits',
      'remaining_credits',
      'availableCredits',
      'available_credits',
      'remaining',
      'balance',
      'credits'
    ];
    for (const key of keys) {
      const n = this.parseFiniteNumber(src[key]);
      if (n !== null) {
        return n;
      }
    }
    return null;
  }

  private parseFiniteNumber(value: unknown): number | null {
    if (value === undefined || value === null || value === '') {
      return null;
    }
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) {
        return null;
      }
      const n = Number(trimmed);
      return Number.isFinite(n) ? n : null;
    }
    const n = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(n) ? n : null;
  }

  private formatCreditAmount(value: number): string {
    return new Intl.NumberFormat('en-US', {
      maximumFractionDigits: 2
    }).format(value);
  }

  private extractEnabledAgents(src: Record<string, unknown>): string[] {
    const raw =
      src['enabledAgents'] ??
      src['enabled_agents'] ??
      src['agents'] ??
      src['agentTypes'] ??
      src['agent_types'];
    return this.normalizeEnabledAgents(raw);
  }

  private normalizeEnabledAgents(value: unknown): string[] {
    const known = new Set(this.availableAgents.map((a) => a.value));
    const out: string[] = [];
    const add = (raw: unknown) => {
      const normalized = this.normalizeAgentValue(raw);
      if (normalized && known.has(normalized) && !out.includes(normalized)) {
        out.push(normalized);
      }
    };

    if (Array.isArray(value)) {
      for (const item of value) {
        add(item);
      }
      return out;
    }

    if (typeof value === 'string') {
      for (const item of value.split(',')) {
        add(item);
      }
      return out;
    }

    if (value && typeof value === 'object') {
      for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
        if (typeof entry === 'boolean') {
          if (entry) add(key);
          continue;
        }
        if (typeof entry === 'string' || typeof entry === 'number') {
          add(entry);
          continue;
        }
        if (Array.isArray(entry)) {
          for (const item of entry) add(item);
          continue;
        }
        if (entry && typeof entry === 'object') {
          const enabled =
            (entry as { enabled?: unknown; active?: unknown }).enabled ??
            (entry as { enabled?: unknown; active?: unknown }).active;
          if (enabled !== false) add(key);
        }
      }
    }

    return out;
  }

  private normalizeAgentValue(value: unknown): string {
    if (value && typeof value === 'object') {
      const obj = value as Record<string, unknown>;
      value =
        obj['value'] ??
        obj['type'] ??
        obj['code'] ??
        obj['name'] ??
        obj['agent'] ??
        obj['agentType'] ??
        obj['agent_type'];
    }
    const raw = String(value ?? '').trim().toLowerCase();
    if (!raw) {
      return '';
    }
    const compact = raw
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/\bagents?\b/g, '')
      .trim();
    if (compact === 'chat' || compact === 'text') {
      return 'chat';
    }
    if (compact === 'voice' || compact === 'call' || compact === 'calls') {
      return 'voice';
    }
    if (compact === 'onboarding' || compact === 'kyc') {
      return 'onboarding';
    }
    if (compact === 'audit' || compact === 'qa' || compact === 'quality') {
      return 'audit';
    }
    return raw;
  }

  private parseVoiceConcurrency(value: unknown): number | null {
    if (value === undefined || value === null || value === '') {
      return null;
    }
    const n = typeof value === 'number' ? value : Number(value);
    if (Number.isFinite(n) && Number.isInteger(n) && n >= 1 && n <= 1000) {
      return n;
    }
    return null;
  }

  private shortClientIdForVoice(clientCode: string): string {
    return String(clientCode ?? '').trim();
  }

  private describeApiError(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      const body = error.error;
      if (body && typeof body === 'object') {
        const detail =
          (body as { detail?: unknown }).detail ??
          (body as { message?: unknown }).message ??
          (body as { title?: unknown }).title;
        if (typeof detail === 'string' && detail.trim()) {
          return detail.trim();
        }
      }
      if (typeof body === 'string' && body.trim()) {
        return body.trim();
      }
      return error.statusText || `HTTP ${error.status}`;
    }
    if (error instanceof Error && error.message.trim()) {
      return error.message.trim();
    }
    return 'Unknown error';
  }

  private async loadVoiceConfigForCurrentClient(): Promise<void> {
    if (!this.isEditMode || !this.clientCode?.trim()) {
      return;
    }
    if (!this.isAgentEnabled('voice')) {
      this.voiceConfigSnapshot = null;
      this.effectiveVoiceStackId = this.defaultVoiceStack()?.id ?? '';
      return;
    }
    const accessToken = localStorage.getItem('accessToken');
    if (!accessToken) {
      this.voiceConcurrencyLoadMessage = 'Session expired. Please log in again.';
      return;
    }
    const voiceClientId = this.shortClientIdForVoice(this.clientCode);
    if (!voiceClientId || voiceClientId === 'N/A') {
      this.voiceConcurrencyLoadMessage = 'Missing client code for voice config.';
      return;
    }

    this.isLoadingVoiceConcurrency = true;
    this.voiceConcurrencyLoadMessage = '';
    try {
      const res = await this.api.getClientVoiceConfig(
        voiceClientId,
        accessToken
      );
      this.applyVoiceConfigResponse(res);
    } catch (error) {
      if (error instanceof HttpErrorResponse && error.status === 404) {
        this.voiceConfigSnapshot = null;
        this.effectiveVoiceStackId = this.defaultVoiceStack()?.id ?? '';
        this.ensureVoiceDefaultsForSelectedAgent();
        return;
      }
      console.error('Failed to load voice config', error);
      this.voiceConcurrencyLoadMessage =
        `Could not load voice config (${this.describeApiError(error)}).`;
    } finally {
      this.isLoadingVoiceConcurrency = false;
    }
  }

  private async saveVoiceConfigForClient(
    clientCode: string,
    maxConcurrentDials: number,
    voiceStackIdValue: string,
    accessToken: string
  ): Promise<VoiceClientConfigResponse | null> {
    const voiceClientId = this.shortClientIdForVoice(clientCode);
    if (!voiceClientId || voiceClientId === 'N/A') {
      throw new Error('Missing client code for voice config.');
    }
    const voiceStackId = this.voiceStackIdForConfigApi(voiceStackIdValue);

    if (!this.voiceConfigSnapshot) {
      const body = {
        maxConcurrentDials,
        ...(voiceStackId === null ? {} : { voiceStackId })
      };
      const res = await this.api.postClientVoiceConfig(
        voiceClientId,
        body,
        accessToken
      );
      this.applyVoiceConfigResponse(res);
      return res;
    }

    const patch: VoiceClientConfigPatchRequest = {};
    if (maxConcurrentDials !== this.voiceConfigSnapshot.maxConcurrentDials) {
      patch.maxConcurrentDials = maxConcurrentDials;
    }
    if (voiceStackId !== this.voiceConfigSnapshot.voiceStackId) {
      patch.voiceStackId = voiceStackId;
    }

    if (Object.keys(patch).length === 0) {
      return null;
    }

    const res = await this.api.patchClientVoiceConfig(
      voiceClientId,
      patch,
      accessToken
    );
    this.applyVoiceConfigResponse(res);
    return res;
  }

  private voiceStackIdForConfigApi(value: string): string | null {
    const trimmed = String(value ?? '').trim();
    return trimmed ? trimmed : null;
  }

  private applyVoiceConfigResponse(res: VoiceClientConfigResponse): void {
    const n = this.parseVoiceConcurrency(res?.maxConcurrentDials);
    if (n === null) {
      this.voiceConcurrencyLoadMessage =
        'Voice config response did not include a valid concurrency value.';
      return;
    }
    const explicitStack =
      typeof res.voiceStackId === 'string' && res.voiceStackId.trim()
        ? res.voiceStackId.trim()
        : null;
    this.voiceConfigSnapshot = {
      maxConcurrentDials: n,
      voiceStackId: explicitStack
    };
    this.effectiveVoiceStackId =
      typeof res.effectiveVoiceStackId === 'string'
        ? res.effectiveVoiceStackId.trim()
        : '';
    this.clientForm.patchValue({
      voiceConcurrency: n,
      voiceStackId: explicitStack ?? ''
    });
    this.voiceConcurrencyLoadMessage = '';
  }

  private formatTelephonyMigrationMessage(migration: unknown): string {
    if (!migration || typeof migration !== 'object') {
      return '';
    }
    const m = migration as Record<string, unknown>;
    const migrated = this.parseFiniteNumber(m['migrated']);
    const failed = this.parseFiniteNumber(m['failed']);
    const parts: string[] = [];
    if (migrated !== null) parts.push(`${migrated} migrated`);
    if (failed !== null) parts.push(`${failed} failed`);
    const errors = m['errors'];
    if (Array.isArray(errors) && errors.length > 0) {
      parts.push(`${errors.length} error${errors.length === 1 ? '' : 's'}`);
    }
    return parts.length ? `Telephony migration: ${parts.join(', ')}.` : '';
  }

  private restoreVoiceConfigFormFromSnapshot(): void {
    const snapshot = this.voiceConfigSnapshot;
    if (!snapshot) {
      this.ensureVoiceDefaultsForSelectedAgent();
      return;
    }
    this.clientForm.patchValue({
      voiceConcurrency: snapshot.maxConcurrentDials,
      voiceStackId: snapshot.voiceStackId ?? ''
    });
  }

  private async loadVoiceStackOptions(clientCode: string): Promise<void> {
    const accessToken = localStorage.getItem('accessToken');
    if (!accessToken) {
      return;
    }

    const pathClientCode = String(clientCode || 'new').trim() || 'new';
    this.isLoadingVoiceStacks = true;
    try {
      const res = await this.api.getClientVoiceConfigMeta(
        pathClientCode,
        accessToken
      );
      this.voiceStacks = this.normalizeVoiceStacks(res?.voiceStacks);
      this.ensureVoiceDefaultsForSelectedAgent();
    } catch (error) {
      console.error('Failed to load voice stack meta', error);
      this.voiceStacks = [];
      if (this.isAgentEnabled('voice')) {
        this.voiceConcurrencyLoadMessage =
          `Could not load voice stacks (${this.describeApiError(error)}).`;
      }
    } finally {
      this.isLoadingVoiceStacks = false;
    }
  }

  private normalizeVoiceStacks(raw: unknown): VoiceStack[] {
    if (!Array.isArray(raw)) {
      return [];
    }

    const seen = new Set<string>();
    const out: VoiceStack[] = [];
    for (const item of raw) {
      if (!item || typeof item !== 'object') continue;
      const r = item as Record<string, unknown>;
      const id = typeof r['id'] === 'string' ? r['id'].trim() : '';
      if (!id || seen.has(id)) continue;
      seen.add(id);
      const stack: VoiceStack = { id };
      if (typeof r['environment'] === 'string' && r['environment'].trim()) {
        stack.environment = r['environment'].trim();
      }
      if (typeof r['isDefault'] === 'boolean') {
        stack.isDefault = r['isDefault'];
      }
      out.push(stack);
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
      this.featureUnitTypeOptions = meta.featureUnitTypeOptions ?? [];
      this.syncPricingRulesWithEnabledAgents();
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
        'GLOBAL';
      this.clientForm.patchValue({ dataResidency: preferred });
    }
  }

  private async bootstrapEditFormWithClient(client: ClientRow): Promise<void> {
    await this.hydrateResidencyOptionsOnly();
    this.setClientCreditsFromUnknown(
      client as unknown as Record<string, unknown>,
      false
    );
    this.clientForm.patchValue({
      clientName: client.clientName,
      enabledAgents: this.normalizeEnabledAgents(client.enabledAgents),
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
      this.featureUnitTypeOptions = meta.featureUnitTypeOptions ?? [];

      const globalOption = this.dataResidencyOptions.find(
        (o) => o.value.toLowerCase() === 'global'
      );
      if (globalOption) {
        this.clientForm.patchValue({ dataResidency: globalOption.value });
      } else {
        const preferred =
          meta.defaultDataResidency &&
          this.dataResidencyOptions.some(
            (o) => o.value === meta.defaultDataResidency
          )
            ? meta.defaultDataResidency
            : (this.dataResidencyOptions[0]?.value ?? 'GLOBAL');

        const current = this.clientForm.get('dataResidency')?.value as string;
        if (!this.dataResidencyOptions.some((o) => o.value === current)) {
          this.clientForm.patchValue({ dataResidency: preferred });
        }
      }
      this.syncPricingRulesWithEnabledAgents();
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
      const res = (await this.api.getClientByCode(
        this.clientCode,
        accessToken
      )) as any;
      const raw = res?.client ?? res;
      if (!raw) {
        this.errorMessage = 'Client not found.';
        return;
      }
      const rawObj = raw as Record<string, unknown>;
      this.setClientCreditsFromUnknown(rawObj, true);
      const loadedEnabledAgents = this.extractEnabledAgents(rawObj);
      const fallbackEnabledAgents =
        (this.clientForm.get('enabledAgents')?.value as string[] | undefined) ??
        [];
      const client: ClientRow = {
        clientName: raw.clientName ?? raw.name ?? 'Unnamed Client',
        clientCode:
          raw.clientID ?? raw.clientId ?? raw.clientCode ?? raw.cod ?? this.clientCode,
        enabledAgents:
          loadedEnabledAgents.length > 0
            ? loadedEnabledAgents
            : [...fallbackEnabledAgents],
        status: 'Active',
        owner: raw.owner ?? raw.createdBy ?? raw.email ?? 'Admin',
        createdOn: raw.createdOn ?? '',
        billing: raw.billing ?? raw.bi,
        creditBalance: this.clientCredits ?? undefined
      };
      this.clientForm.patchValue({
        clientName: client.clientName,
        enabledAgents: client.enabledAgents,
        ...this.pickResidencyAndVoiceFromUnknown(rawObj)
      });
      this.syncDataResidencyWithOptions();
      this.applyBillingFromClient(client);
    } catch {
      this.errorMessage = 'Could not load client. You can still update by filling the form.';
    }
  }

  private clientRowFromUnknown(
    res: unknown,
    fallbackCode: string,
    fallback: ClientRow
  ): ClientRow {
    const raw = ((res as any)?.client ?? res) as Record<string, unknown> | null;
    if (!raw || typeof raw !== 'object') {
      return fallback;
    }
    const loadedEnabledAgents = this.extractEnabledAgents(raw);
    const loadedCredits = this.extractClientCredits(raw);
    return {
      ...fallback,
      clientName:
        (typeof raw['clientName'] === 'string' && raw['clientName'].trim()) ||
        (typeof raw['name'] === 'string' && raw['name'].trim()) ||
        fallback.clientName,
      clientCode:
        (typeof raw['clientID'] === 'string' && raw['clientID'].trim()) ||
        (typeof raw['clientId'] === 'string' && raw['clientId'].trim()) ||
        (typeof raw['clientCode'] === 'string' && raw['clientCode'].trim()) ||
        (typeof raw['cod'] === 'string' && raw['cod'].trim()) ||
        fallbackCode,
      enabledAgents:
        loadedEnabledAgents.length > 0
          ? loadedEnabledAgents
          : [...(fallback.enabledAgents ?? [])],
      owner:
        (typeof raw['owner'] === 'string' && raw['owner'].trim()) ||
        (typeof raw['createdBy'] === 'string' && raw['createdBy'].trim()) ||
        (typeof raw['email'] === 'string' && raw['email'].trim()) ||
        fallback.owner,
      createdOn:
        (typeof raw['createdOn'] === 'string' && raw['createdOn'].trim()) ||
        (typeof raw['createdAt'] === 'string' && raw['createdAt'].trim()) ||
        fallback.createdOn,
      billing: (raw['billing'] ?? raw['bi'] ?? fallback.billing) as ClientRow['billing'],
      creditBalance:
        loadedCredits !== null
          ? loadedCredits
          : fallback.creditBalance
    };
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
    if (c === 'prompt_builder') {
      return 'agent_builder';
    }
    return this.normalizeAgentValue(c) || c;
  }

  private applyBillingFromClient(client: ClientRow): void {
    const billing = (client as any)?.billing ?? (client as any)?.bi;
    this.setClientCreditsFromUnknown(
      client as unknown as Record<string, unknown>,
      false
    );
    if (!billing) {
      this.billingTier = 'enterprise';
      this.allowNegativeBalance = true;
      this.pricingRules = [];
      this.syncPricingRulesWithEnabledAgents();
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
    this.syncPricingRulesWithEnabledAgents();
  }

  private isVoiceEnabledInAgents(enabledAgents: unknown): boolean {
    return this.normalizeEnabledAgents(enabledAgents).includes('voice');
  }

  private validateVoiceFields(
    formValue: {
      enabledAgents?: string[];
      voiceConcurrency?: unknown;
      voiceStackId?: unknown;
    },
    requireExplicitStack: boolean
  ): string | null {
    if (!this.isVoiceEnabledInAgents(formValue.enabledAgents)) {
      return null;
    }

    const concurrency = this.parseVoiceConcurrency(formValue.voiceConcurrency);
    if (concurrency === null) {
      return 'voiceConcurrency must be an integer between 1 and 1000.';
    }

    if (this.isLoadingVoiceStacks) {
      return 'Wait for voice stack options to finish loading before saving.';
    }

    if (this.voiceStacks.length === 0) {
      return 'Voice stack options could not be loaded.';
    }

    const voiceStackId =
      typeof formValue.voiceStackId === 'string'
        ? formValue.voiceStackId.trim()
        : String(formValue.voiceStackId ?? '').trim();
    if (requireExplicitStack && !voiceStackId) {
      return 'voiceStackId is required when voice is enabled.';
    }

    if (
      voiceStackId &&
      !this.voiceStacks.some((stack) => stack.id === voiceStackId)
    ) {
      return 'Select a valid voice stack.';
    }

    return null;
  }

  private buildCreateClientBody(formValue: {
    clientName: string;
    dataResidency: string;
    enabledAgents: string[];
    voiceConcurrency: unknown;
    voiceStackId: unknown;
  }): Parameters<ApiService['createClient']>[0] {
    const body: Parameters<ApiService['createClient']>[0] = {
      clientName: formValue.clientName,
      dataResidency: formValue.dataResidency,
      enabledAgents: formValue.enabledAgents,
      ...this.buildCreateBillingSettingsBody()
    };

    if (this.isVoiceEnabledInAgents(formValue.enabledAgents)) {
      const voiceConcurrency =
        this.parseVoiceConcurrency(formValue.voiceConcurrency) ?? 10;
      const voiceStackId = String(formValue.voiceStackId ?? '').trim();
      body.voiceConcurrency = voiceConcurrency;
      body.voiceStackId = voiceStackId;
    }

    return body;
  }

  private buildCreateBillingSettingsBody(): Partial<
    ReturnType<ClientFormComponent['buildBillingSettingsBody']>
  > {
    const billing = this.buildBillingSettingsBody(true);
    const hasCustomPricing = Object.keys(billing.customPricing).length > 0;
    const hasBillingOverride =
      hasCustomPricing ||
      this.billingTier !== 'enterprise' ||
      this.allowNegativeBalance !== true ||
      this.baseCreditUsagePromptBuilder !== false;

    return hasBillingOverride ? billing : {};
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

    if (!formValue.enabledAgents || formValue.enabledAgents.length === 0) {
      this.errorMessage = 'Select at least one enabled agent before creating.';
      this.isSubmitting = false;
      return;
    }

    const voiceErr = this.validateVoiceFields(formValue, true);
    if (voiceErr) {
      this.errorMessage = voiceErr;
      this.isSubmitting = false;
      return;
    }

    try {
      const pricingErr = this.validatePricingRulesForBilling({
        ignoreUnpricedRules: true
      });
      if (pricingErr) {
        this.pricingErrorMessage = pricingErr;
        return;
      }

      const createRes = await this.api.createClient(
        this.buildCreateClientBody(formValue),
        accessToken
      );

      const newCode = this.extractClientCodeFromCreateResponse(createRes);
      if (!newCode) {
        await this.router.navigate(['/clients'], {
          state: {
            listFlashMessage:
              'Client was created, but the server did not return a client code. Open the client from the list to review it.'
          }
        });
        return;
      }

      const voiceConcurrency =
        this.parseVoiceConcurrency(formValue.voiceConcurrency) ?? undefined;
      let createdClientSnapshot: ClientRow = {
        clientName: formValue.clientName,
        clientCode: newCode,
        enabledAgents: formValue.enabledAgents ?? [],
        status: 'Active',
        owner: '',
        createdOn: '',
        voiceConcurrency
      };
      try {
        createdClientSnapshot = this.clientRowFromUnknown(
          await this.api.getClientByCode(newCode, accessToken),
          newCode,
          createdClientSnapshot
        );
      } catch (loadErr) {
        console.error('Created client reload failed', loadErr);
      }

      await this.router.navigate(
        ['/clients', newCode, 'edit'],
        {
          state: {
            client: createdClientSnapshot,
            flashSuccessMessage:
              'Client created successfully. Voice configuration and billing settings were saved with the client.'
          }
        }
      );
    } catch (error) {
      console.error(error);
      this.errorMessage = 'Unable to create client right now.';
    } finally {
      this.isSubmitting = false;
    }
  }

  addPricingRule(): void {
    if (this.pageFieldsReadOnly) return;
    if (this.pricingFeatureOptions.length === 0) {
      this.pricingErrorMessage =
        'Select Chat Agent or Voice Agent before adding custom pricing.';
      return;
    }
    this.pricingDd = null;
    this.pricingRules.push(this.createDefaultPricingRule());
  }

  private createDefaultPricingRule(featureCode = this.defaultPricingFeatureCode()): {
    featureCode: string;
    unitType: string;
    creditPerUnit: number;
    rounding: string;
  } {
    return {
      featureCode,
      unitType: this.defaultUnitTypeForPricingFeature(featureCode),
      creditPerUnit: 0,
      rounding: 'ceil'
    };
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
  private validatePricingRulesForBilling(options?: {
    ignoreUnpricedRules?: boolean;
  }): string | null {
    for (const row of this.pricingRules) {
      if (options?.ignoreUnpricedRules && !this.pricingRuleIsBillable(row)) {
        if (this.pricingRuleHasInvalidCreateCredits(row)) {
          return `Credits must be 0 or greater for ${row.featureCode} / ${row.unitType}.`;
        }
        continue;
      }
      if (!row.featureCode?.trim() || !row.unitType?.trim()) {
        return 'Feature and unit type are required for each rule.';
      }
      if (!this.isPricingFeatureAllowed(row.featureCode)) {
        const featureLabel = this.pricingRuleFieldLabelForRule(row, 'feature');
        return `${featureLabel} pricing is not available for the selected agents.`;
      }
      if (this.pricingRuleHasInvalidCredits(row)) {
        return `Credits must be greater than 0 for ${row.featureCode} / ${row.unitType}.`;
      }
    }
    return null;
  }

  private buildBillingSettingsBody(onlyBillablePricingRules = false): {
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
      if (onlyBillablePricingRules && !this.pricingRuleIsBillable(row)) {
        continue;
      }
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
      tier: this.billingTier,
      allowNegativeBalance: this.allowNegativeBalance,
      customPricing,
      baseCreditUsage: {
        prompt_builder: this.baseCreditUsagePromptBuilder
      }
    };
  }

  private buildBillingPutBody(clientCode: string): ReturnType<
    ClientFormComponent['buildBillingSettingsBody']
  > & {
    clientCode: string;
  } {
    return {
      clientCode,
      ...this.buildBillingSettingsBody()
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
        ? (
            client['clientID'] ??
            client['clientId'] ??
            client['clientCode'] ??
            client['cod'] ??
            client['code']
          )
        : undefined;
    const direct =
      r['clientID'] ?? r['clientId'] ?? r['clientCode'] ?? r['cod'] ?? r['code'];
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
    return this.api.putBillingBilling(body, accessToken);
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
      voiceStackId: this.voiceStackFormValue(),
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
      voiceConcurrency: s.voiceConcurrency,
      voiceStackId: s.voiceStackId
    });
    this.billingTier = s.billingTier;
    this.allowNegativeBalance = s.allowNegativeBalance;
    this.baseCreditUsagePromptBuilder = s.baseCreditUsagePromptBuilder;
    this.pricingRules = s.pricingRules.map((r) => ({ ...r }));
    this.editPageCancelSnapshot = null;
  }

  get addCreditsFeatureDisplayLabel(): string {
    if (!this.addCreditsFeatureCode) {
      return 'All';
    }
    return (
      this.FEATURE_CODES.find((f) => f.value === this.addCreditsFeatureCode)
        ?.label ?? this.addCreditsFeatureCode
    );
  }

  openAddCreditsModal(): void {
    if (!this.isEditMode || this.clientPageViewOnly) {
      return;
    }
    this.resetAddCreditsModalFields();
    this.addCreditsModalOpen = true;
  }

  closeAddCreditsModal(force = false): void {
    if (!force && this.addCreditsSubmitting) {
      return;
    }
    this.addCreditsModalOpen = false;
    this.resetAddCreditsModalFields();
  }

  /** Clears add-credits form fields and dropdown state (safe to call when modal is closed). */
  private resetAddCreditsModalFields(): void {
    this.addCreditsAmount = '';
    this.addCreditsFeatureCode = '';
    this.addCreditsExpiry = '';
    this.addCreditsFeatureMenuOpen = false;
    this.addCreditsError = '';
    this.addCreditsSubmitting = false;
  }

  onAddCreditsBackdropClick(ev: MouseEvent): void {
    if (this.addCreditsSubmitting) {
      return;
    }
    if (ev.target === ev.currentTarget) {
      this.closeAddCreditsModal();
    }
  }

  toggleAddCreditsFeatureMenu(ev: MouseEvent): void {
    ev.stopPropagation();
    if (this.addCreditsSubmitting) {
      return;
    }
    this.addCreditsFeatureMenuOpen = !this.addCreditsFeatureMenuOpen;
  }

  selectAddCreditsFeature(value: string): void {
    if (this.addCreditsSubmitting) {
      return;
    }
    this.addCreditsFeatureCode = value;
    this.addCreditsFeatureMenuOpen = false;
  }

  async submitAddCredits(): Promise<void> {
    this.addCreditsError = '';
    const rawAmount = String(this.addCreditsAmount ?? '').trim();
    const n = Number(rawAmount);
    if (!Number.isFinite(n) || n <= 0) {
      this.addCreditsError = 'Enter a positive credit amount.';
      return;
    }
    const day = this.addCreditsExpiry.trim();
    let expiresAt: string | undefined;
    if (day) {
      const d = new Date(`${day}T12:00:00`);
      if (Number.isNaN(d.getTime())) {
        this.addCreditsError = 'Invalid expiry date.';
        return;
      }
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      if (d < start) {
        this.addCreditsError = 'Expiry date must be today or later.';
        return;
      }
      expiresAt = `${day}T23:59:59.000Z`;
    }

    const accessToken = localStorage.getItem('accessToken');
    if (!accessToken) {
      this.addCreditsError = 'Session expired. Please log in again.';
      return;
    }
    const code = this.clientCode?.trim();
    if (!code) {
      this.addCreditsError = 'Missing client code.';
      return;
    }

    const selectedFeatureCode = this.addCreditsFeatureCode.trim();
    const featureCode = selectedFeatureCode
      ? this.pricingFeatureKeyForApi(selectedFeatureCode)
      : undefined;
    const sourceRef =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? `admin-dashboard-${crypto.randomUUID()}`
        : `admin-dashboard-${Date.now()}`;

    this.addCreditsSubmitting = true;
    try {
      const res = await this.api.postBillingCredits(
        {
          clientCode: code,
          amount: n,
          sourceRef,
          kind: 'paid',
          ...(expiresAt ? { expiresAt } : {}),
          ...(featureCode ? { featureCode } : {}),
          isBackfill: false,
          customTimestamp: null
        },
        accessToken
      );

      if (!res?.ok) {
        this.addCreditsError = 'Credits request was not accepted.';
        return;
      }

      const remaining = res.remaining;
      if (typeof remaining === 'number' && Number.isFinite(remaining)) {
        this.clientCredits = remaining;
      }
      if (res.alreadyApplied) {
        this.successMessage =
          typeof remaining === 'number'
            ? `Credits were already applied. Remaining: ${remaining}.`
            : 'Credits were already applied.';
      } else {
        this.successMessage =
          typeof remaining === 'number'
            ? `Credits added. Remaining: ${remaining}.`
            : 'Credits added successfully.';
      }
      this.errorMessage = '';
      this.closeAddCreditsModal(true);
    } catch (error) {
      const msg =
        error instanceof HttpErrorResponse
          ? typeof error.error === 'string' && error.error.trim()
            ? error.error.trim()
            : error.error &&
                typeof error.error === 'object' &&
                typeof (error.error as { message?: string }).message === 'string'
              ? String((error.error as { message: string }).message)
              : error.statusText || 'Request failed.'
          : 'Unable to add credits. Try again.';
      this.addCreditsError = msg;
    } finally {
      this.addCreditsSubmitting = false;
    }
  }

  startPageEdit(): void {
    if (!this.isEditMode || this.clientPageViewOnly) {
      return;
    }
    if (this.isLoadingVoiceConcurrency) {
      this.errorMessage = 'Wait for voice config to finish loading before editing.';
      return;
    }
    this.captureEditPageSnapshot();
    this.pageEditUnlocked = true;
    this.errorMessage = '';
    this.successMessage = '';
    this.pricingErrorMessage = '';
    this.pricingSuccessMessage = '';
    this.dataResidencyMenuOpen = false;
    this.voiceStackMenuOpen = false;
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
    this.voiceStackMenuOpen = false;
    this.billingTierMenuOpen = false;
    this.pricingDd = null;
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

    const voiceErr = this.validateVoiceFields(formValue, false);
    if (voiceErr) {
      this.errorMessage = voiceErr;
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
      await this.api.updateClient(
        this.clientCode,
        {
          clientName: formValue.clientName,
          enabledAgents: formValue.enabledAgents,
          dataResidency: formValue.dataResidency
        },
        accessToken
      );

      let voiceConfigRes: VoiceClientConfigResponse | null = null;
      if (this.isVoiceEnabledInAgents(formValue.enabledAgents)) {
        const voiceConcurrency =
          this.parseVoiceConcurrency(formValue.voiceConcurrency) ?? 10;
        voiceConfigRes = await this.saveVoiceConfigForClient(
          this.clientCode,
          voiceConcurrency,
          String(formValue.voiceStackId ?? ''),
          accessToken
        );
        this.voiceConcurrencyLoadMessage = '';
      }

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
      this.successMessage =
        'Client, voice configuration, and pricing saved successfully.';
      const migrationMessage = this.formatTelephonyMigrationMessage(
        voiceConfigRes?.telephonyMigration
      );
      if (migrationMessage) {
        this.successMessage = `${this.successMessage} ${migrationMessage}`;
      }
      const billingMsg = billingRes?.message?.trim();
      if (billingMsg) {
        this.pricingSuccessMessage = billingMsg;
      }
    } catch (error) {
      console.error(error);
      if (error instanceof HttpErrorResponse && error.status === 409) {
        this.restoreVoiceConfigFormFromSnapshot();
      }
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
