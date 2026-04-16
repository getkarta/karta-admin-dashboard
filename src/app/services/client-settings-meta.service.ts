import { Injectable } from '@angular/core';

import { ApiService } from './api.service';

export interface DataResidencyOption {
  value: string;
  label: string;
}

export interface ClientSettingsMeta {
  dataResidencyOptions: DataResidencyOption[];
  defaultDataResidency?: string;
}

export const DEFAULT_DATA_RESIDENCY_OPTIONS: DataResidencyOption[] = [
  { value: 'global', label: 'Global' },
  { value: 'IN', label: 'IN' }
];

/** GET `{apiUrl}/clients/settings-meta` (e.g. …/admin/clients/settings-meta). */
@Injectable({ providedIn: 'root' })
export class ClientSettingsMetaService {
  constructor(private api: ApiService) {}

  async fetchMeta(): Promise<ClientSettingsMeta> {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      return { dataResidencyOptions: [...DEFAULT_DATA_RESIDENCY_OPTIONS] };
    }

    try {
      const body = await this.api.getClientSettingsMeta(token);
      return normalizeClientSettingsMeta(body);
    } catch {
      return { dataResidencyOptions: [...DEFAULT_DATA_RESIDENCY_OPTIONS] };
    }
  }
}

function normalizeClientSettingsMeta(body: unknown): ClientSettingsMeta {
  const defaultDataResidency = readDefaultDataResidency(body);
  const dataResidencyOptions = readDataResidencyOptions(body);

  if (dataResidencyOptions.length === 0) {
    return {
      dataResidencyOptions: [...DEFAULT_DATA_RESIDENCY_OPTIONS],
      defaultDataResidency
    };
  }

  return { dataResidencyOptions, defaultDataResidency };
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

function formatLabel(value: string): string {
  if (value.toLowerCase() === 'global') return 'Global';
  return value;
}
