import { Injectable } from '@angular/core';

import { ApiService } from './api.service';

export interface DataResidencyOption {
  value: string;
  label: string;
}

export interface FeatureUnitTypeOption {
  featureCode: string;
  unitType: string;
  featureLabel?: string;
  unitLabel?: string;
  creditPerUnit?: number;
  rounding?: string;
  intervalSeconds?: number;
  minimumSeconds?: number;
}

export interface ClientSettingsMeta {
  dataResidencyOptions: DataResidencyOption[];
  featureUnitTypeOptions: FeatureUnitTypeOption[];
  defaultFeatureUnitTypeOptions: FeatureUnitTypeOption[];
  unitTypeOptions: FeatureUnitTypeOption[];
  defaultDataResidency?: string;
}

export const DEFAULT_DATA_RESIDENCY_OPTIONS: DataResidencyOption[] = [
  { value: 'IN', label: 'IN' },
  { value: 'GLOBAL', label: 'Global' }
];

/** GET `{apiUrl}/clients/settings-meta` (e.g. …/admin/clients/settings-meta). */
@Injectable({ providedIn: 'root' })
export class ClientSettingsMetaService {
  constructor(private api: ApiService) {}

  async fetchMeta(): Promise<ClientSettingsMeta> {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      return {
        dataResidencyOptions: [...DEFAULT_DATA_RESIDENCY_OPTIONS],
        featureUnitTypeOptions: [],
        defaultFeatureUnitTypeOptions: [],
        unitTypeOptions: []
      };
    }

    try {
      const body = await this.api.getClientSettingsMeta(token);
      return normalizeClientSettingsMeta(body);
    } catch {
      return {
        dataResidencyOptions: [...DEFAULT_DATA_RESIDENCY_OPTIONS],
        featureUnitTypeOptions: [],
        defaultFeatureUnitTypeOptions: [],
        unitTypeOptions: []
      };
    }
  }
}

function normalizeClientSettingsMeta(body: unknown): ClientSettingsMeta {
  const defaultDataResidency = readDefaultDataResidency(body);
  const dataResidencyOptions = readDataResidencyOptions(body);
  const featureUnitTypeOptions = readFeatureUnitTypeOptions(body);
  const defaultFeatureUnitTypeOptionsFromMeta =
    readDefaultFeatureUnitTypeOptionsFromMeta(body);
  const unitTypeOptionsFromMeta = readUnitTypeOptionsFromMeta(body);
  const defaultFeatureUnitTypeOptions =
    defaultFeatureUnitTypeOptionsFromMeta.length > 0
      ? defaultFeatureUnitTypeOptionsFromMeta
      : featureUnitTypeOptions;
  const unitTypeOptions =
    unitTypeOptionsFromMeta.length > 0
      ? unitTypeOptionsFromMeta
      : featureUnitTypeOptions;

  if (dataResidencyOptions.length === 0) {
    return {
      dataResidencyOptions: [...DEFAULT_DATA_RESIDENCY_OPTIONS],
      featureUnitTypeOptions,
      defaultFeatureUnitTypeOptions,
      unitTypeOptions,
      defaultDataResidency
    };
  }

  return {
    dataResidencyOptions,
    featureUnitTypeOptions,
    defaultFeatureUnitTypeOptions,
    unitTypeOptions,
    defaultDataResidency
  };
}

function readDefaultDataResidency(body: unknown): string | undefined {
  if (!body || typeof body !== 'object') return undefined;
  const o = body as Record<string, unknown>;
  const nested = o['data'] ?? o['result'];
  if (nested && typeof nested === 'object') {
    const inner = readDefaultDataResidency(nested);
    if (inner) return inner;
  }
  const direct =
    o['defaultDataResidency'] ??
    o['dataResidencyDefault'] ??
    o['defaultResidency'];
  if (typeof direct === 'string' && direct.trim()) return direct.trim();

  const dr = o['dataResidency'];
  if (dr && typeof dr === 'object') {
    const d = (dr as Record<string, unknown>)['default'];
    if (typeof d === 'string' && d.trim()) return d.trim();
  }
  return undefined;
}

function readDataResidencyOptions(body: unknown): DataResidencyOption[] {
  if (!body || typeof body !== 'object') return [];

  const o = body as Record<string, unknown>;
  const nested = o['data'] ?? o['result'];
  if (nested && typeof nested === 'object' && nested !== o) {
    const fromNested = readDataResidencyOptions(nested);
    if (fromNested.length > 0) return fromNested;
  }

  const candidates: unknown[] = [
    o['dataResidencyOptions'],
    o['dataResidencies'],
    Array.isArray(o['dataResidency']) ? o['dataResidency'] : null,
    (o['dataResidency'] as Record<string, unknown> | undefined)?.['options'],
    (o['settings'] as Record<string, unknown> | undefined)?.[
      'dataResidencyOptions'
    ],
    (o['meta'] as Record<string, unknown> | undefined)?.[
      'dataResidencyOptions'
    ]
  ];

  for (const c of candidates) {
    const normalized = normalizeOptionArray(c);
    if (normalized.length > 0) return normalized;
  }

  return [];
}

function normalizeOptionArray(raw: unknown): DataResidencyOption[] {
  if (!Array.isArray(raw)) return [];

  const out: DataResidencyOption[] = [];
  for (const item of raw) {
    if (item == null) continue;

    if (typeof item === 'string') {
      const v = item.trim();
      if (v) out.push({ value: v, label: formatLabel(v) });
      continue;
    }

    if (typeof item !== 'object') continue;
    const r = item as Record<string, unknown>;
    const value = firstString(r, ['value', 'code', 'id', 'key', 'region']);
    if (!value) continue;
    const label =
      firstString(r, ['label', 'name', 'title', 'displayName']) ??
      formatLabel(value);
    out.push({ value, label });
  }
  return out;
}

function readFeatureUnitTypeOptions(body: unknown): FeatureUnitTypeOption[] {
  return readFeatureUnitTypeOptionsFromKeys(body, [
    'featureUnitTypeOptions',
    'featureUnitTypes',
    'unitTypeOptionsByFeature'
  ]);
}

function readDefaultFeatureUnitTypeOptionsFromMeta(
  body: unknown
): FeatureUnitTypeOption[] {
  return readFeatureUnitTypeOptionsFromKeys(body, [
    'defaultFeatureUnitTypeOptions',
    'defaultFeatureUnitTypes',
    'defaultUnitTypeOptions',
    'defaultUnitTypes'
  ]);
}

function readUnitTypeOptionsFromMeta(body: unknown): FeatureUnitTypeOption[] {
  return readFeatureUnitTypeOptionsFromKeys(body, [
    'unitTypeOptions',
    'unitTypes',
    'unitTypeOptionsByFeature'
  ]);
}

function readFeatureUnitTypeOptionsFromKeys(
  body: unknown,
  keys: string[]
): FeatureUnitTypeOption[] {
  if (!body || typeof body !== 'object') return [];

  const o = body as Record<string, unknown>;
  const nested = o['data'] ?? o['result'];
  if (nested && typeof nested === 'object' && nested !== o) {
    const fromNested = readFeatureUnitTypeOptionsFromKeys(nested, keys);
    if (fromNested.length > 0) return fromNested;
  }

  const candidates: unknown[] = [...keys.map((key) => o[key])];
  for (const containerKey of ['billing', 'settings', 'meta', 'options']) {
    const container = o[containerKey];
    if (!container || typeof container !== 'object') continue;
    const containerRecord = container as Record<string, unknown>;
    candidates.push(...keys.map((key) => containerRecord[key]));
  }

  for (const c of candidates) {
    const normalized = normalizeFeatureUnitTypeOptions(c);
    if (normalized.length > 0) return normalized;
  }

  return [];
}

function normalizeFeatureUnitTypeOptions(
  raw: unknown
): FeatureUnitTypeOption[] {
  const out: FeatureUnitTypeOption[] = [];
  const seen = new Set<string>();

  const add = (
    featureCode: unknown,
    unitType: unknown,
    source?: Record<string, unknown>,
    featureLabel?: string,
    unitLabel?: string
  ) => {
    const feature = normalizeOptionValue(featureCode);
    const unit = normalizeOptionValue(unitType);
    if (!feature || !unit) return;

    const key = `${feature}::${unit}`;
    if (seen.has(key)) return;
    seen.add(key);

    const normalized: FeatureUnitTypeOption = {
      featureCode: feature,
      unitType: unit
    };
    if (featureLabel) normalized.featureLabel = featureLabel;
    if (unitLabel) normalized.unitLabel = unitLabel;

    if (source) {
      const creditPerUnit = firstFiniteNumber(source, [
        'creditPerUnit',
        'creditsPerUnit',
        'credits',
        'price',
        'defaultCreditPerUnit'
      ]);
      if (creditPerUnit !== undefined) normalized.creditPerUnit = creditPerUnit;

      const rounding = firstString(source, [
        'rounding',
        'roundingType',
        'rounding_type'
      ]);
      if (rounding) normalized.rounding = rounding;

      const intervalSeconds = firstFiniteNumber(source, [
        'intervalSeconds',
        'interval_seconds'
      ]);
      if (intervalSeconds !== undefined) {
        normalized.intervalSeconds = intervalSeconds;
      }

      const minimumSeconds = firstFiniteNumber(source, [
        'minimumSeconds',
        'minimum_seconds',
        'minSeconds',
        'min_seconds'
      ]);
      if (minimumSeconds !== undefined) {
        normalized.minimumSeconds = minimumSeconds;
      }
    }

    out.push(normalized);
  };

  const addUnitsForFeature = (
    featureCode: unknown,
    units: unknown,
    featureSource?: Record<string, unknown>
  ) => {
    const featureLabel = featureSource
      ? firstString(featureSource, [
          'featureLabel',
          'label',
          'name',
          'title',
          'displayName'
        ])
      : undefined;

    if (Array.isArray(units)) {
      for (const unit of units) {
        if (typeof unit === 'string' || typeof unit === 'number') {
          add(featureCode, unit, featureSource, featureLabel);
          continue;
        }
        if (!unit || typeof unit !== 'object') continue;
        const unitObj = unit as Record<string, unknown>;
        add(
          featureCode,
          firstString(unitObj, [
            'unitType',
            'unit',
            'value',
            'code',
            'id',
            'key',
            'type'
          ]),
          unitObj,
          featureLabel,
          firstString(unitObj, [
            'unitLabel',
            'label',
            'name',
            'title',
            'displayName'
          ])
        );
      }
      return;
    }

    if (!units || typeof units !== 'object') return;
    const unitObj = units as Record<string, unknown>;
    const nested =
      unitObj['unitTypes'] ??
      unitObj['unitTypeOptions'] ??
      unitObj['units'] ??
      unitObj['options'];
    if (nested !== undefined) {
      addUnitsForFeature(featureCode, nested, unitObj);
      return;
    }

    for (const [unitType, config] of Object.entries(unitObj)) {
      if (Array.isArray(config)) {
        addUnitsForFeature(featureCode, config, featureSource);
        continue;
      }
      if (config && typeof config === 'object') {
        const configObj = config as Record<string, unknown>;
        add(
          featureCode,
          firstString(configObj, [
            'unitType',
            'unit',
            'value',
            'code',
            'id',
            'key',
            'type'
          ]) ?? unitType,
          configObj,
          featureLabel,
          firstString(configObj, [
            'unitLabel',
            'label',
            'name',
            'title',
            'displayName'
          ])
        );
        continue;
      }
      add(featureCode, unitType, featureSource, featureLabel);
    }
  };

  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (!item || typeof item !== 'object') continue;
      const r = item as Record<string, unknown>;
      const featureCode = firstString(r, [
        'featureCode',
        'feature',
        'featureKey',
        'featureName',
        'agent',
        'agentType',
        'agent_type'
      ]);
      if (!featureCode) continue;

      const unitSource =
        r['unitTypes'] ?? r['unitTypeOptions'] ?? r['units'] ?? r['options'];
      if (unitSource !== undefined) {
        addUnitsForFeature(featureCode, unitSource, r);
        continue;
      }

      add(
        featureCode,
        firstString(r, ['unitType', 'unit', 'value', 'code', 'id', 'key']),
        r,
        firstString(r, [
          'featureLabel',
          'featureName',
          'featureDisplayName'
        ]),
        firstString(r, [
          'unitLabel',
          'label',
          'name',
          'title',
          'displayName'
        ])
      );
    }
    return out;
  }

  if (!raw || typeof raw !== 'object') return out;
  const record = raw as Record<string, unknown>;
  const singleFeatureCode = firstString(record, [
    'featureCode',
    'feature',
    'featureKey',
    'featureName'
  ]);
  const singleUnitType = firstString(record, [
    'unitType',
    'unit',
    'value',
    'code',
    'id',
    'key'
  ]);
  if (singleFeatureCode && singleUnitType) {
    add(singleFeatureCode, singleUnitType, record);
  }

  for (const [featureCode, units] of Object.entries(record)) {
    if (
      [
        'featureCode',
        'feature',
        'featureKey',
        'featureName',
        'unitType',
        'unit',
        'value',
        'code',
        'id',
        'key'
      ].includes(featureCode)
    ) {
      continue;
    }
    addUnitsForFeature(featureCode, units);
  }

  return out;
}

function firstString(
  o: Record<string, unknown>,
  keys: string[]
): string | undefined {
  for (const k of keys) {
    const v = o[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return undefined;
}

function firstFiniteNumber(
  o: Record<string, unknown>,
  keys: string[]
): number | undefined {
  for (const k of keys) {
    const raw = o[k];
    if (raw === undefined || raw === null || raw === '') continue;
    const n = typeof raw === 'number' ? raw : Number(raw);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

function normalizeOptionValue(value: unknown): string {
  const s = typeof value === 'string' ? value.trim() : String(value ?? '').trim();
  return s && s !== 'undefined' && s !== 'null' ? s : '';
}

function formatLabel(value: string): string {
  if (value.toLowerCase() === 'global') return 'Global';
  if (/^[A-Z0-9_ -]{1,4}$/.test(value)) return value;
  if (!/[_-]/.test(value)) return value;
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
}
