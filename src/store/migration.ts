import type { GlobalData } from '../types/global';
import { GLOBAL_DATA_VERSION, defaultGlobalData } from '../types/global';

type LegacyGlobalFiles = {
  catalog?: unknown;
  tags?: unknown;
  colorPresets?: unknown;
};

export function migrateGlobalData(raw: unknown, legacy?: LegacyGlobalFiles): GlobalData {
  if (!raw || typeof raw !== 'object') {
    return buildFromLegacy(legacy);
  }

  const record = raw as Record<string, unknown>;
  const version = typeof record.version === 'number' ? record.version : 0;

  let data = version === 0 ? buildFromLegacy(legacy, record) : (raw as GlobalData);

  // Migration chain: apply each step in order
  if (data.version < GLOBAL_DATA_VERSION) {
    data = applyMigrations(data);
  }

  return normalizeGlobalData(data);
}

function applyMigrations(data: GlobalData): GlobalData {
  // Version 0 → 1 is handled by buildFromLegacy.
  // Future: if (data.version < 2) { data = migrateV1toV2(data); }
  return { ...data, version: GLOBAL_DATA_VERSION };
}

function normalizeGlobalData(data: GlobalData): GlobalData {
  const defaults = defaultGlobalData();
  return {
    ...defaults,
    ...data,
    catalog: Array.isArray(data.catalog) ? data.catalog : [],
    tags: Array.isArray(data.tags) ? data.tags : [],
    colorPresets: Array.isArray(data.colorPresets) ? data.colorPresets : [],
    branches: Array.isArray(data.branches) ? data.branches : [],
    settings: {
      ...defaults.settings,
      ...(data.settings ?? {}),
      activeAiTools: Array.isArray(data.settings?.activeAiTools) ? data.settings.activeAiTools : [],
      registeredMcpTools: Array.isArray(data.settings?.registeredMcpTools) ? data.settings.registeredMcpTools : [],
    },
  };
}

function buildFromLegacy(legacy?: LegacyGlobalFiles, existing?: Record<string, unknown>): GlobalData {
  const base = defaultGlobalData();

  const catalogSource = existing?.catalog ?? legacy?.catalog;
  if (Array.isArray(catalogSource)) {
    base.catalog = catalogSource as GlobalData['catalog'];
  }

  const tagsSource = existing?.tags ?? legacy?.tags;
  if (Array.isArray(tagsSource)) {
    base.tags = tagsSource.filter((t): t is string => typeof t === 'string');
  } else if (tagsSource && typeof tagsSource === 'object') {
    const wrapped = (tagsSource as Record<string, unknown>).tags;
    if (Array.isArray(wrapped)) {
      base.tags = wrapped.filter((t): t is string => typeof t === 'string');
    }
  }

  const presetsSource = existing?.colorPresets ?? legacy?.colorPresets;
  if (Array.isArray(presetsSource)) {
    base.colorPresets = presetsSource as GlobalData['colorPresets'];
  }

  return base;
}

export const PROJECT_CONFIG_VERSION = 1;

export function migrateProjectConfig(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== 'object') {
    return { version: PROJECT_CONFIG_VERSION };
  }
  const record = raw as Record<string, unknown>;
  if (!record.version) {
    record.version = PROJECT_CONFIG_VERSION;
  }
  return record;
}
