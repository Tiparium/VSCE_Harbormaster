import { describe, it, expect } from 'vitest';
import { migrateGlobalData, migrateProjectConfig } from '../../src/store/migration';
import { GLOBAL_DATA_VERSION, defaultGlobalData } from '../../src/types/global';

describe('migrateGlobalData', () => {
  it('returns default data when given null', () => {
    const result = migrateGlobalData(null);
    expect(result).toEqual(defaultGlobalData());
  });

  it('returns default data when given non-object', () => {
    const result = migrateGlobalData('bad input');
    expect(result).toEqual(defaultGlobalData());
  });

  it('migrates legacy catalog array into catalog field', () => {
    const catalog = [{ id: '1', name: 'Test', path: '/foo', tags: [], createdAt: '2026-01-01' }];
    const result = migrateGlobalData(null, { catalog });
    expect(result.catalog).toEqual(catalog);
    expect(result.version).toBe(GLOBAL_DATA_VERSION);
  });

  it('migrates legacy tags object ({ tags: [...] }) into tags array', () => {
    const result = migrateGlobalData(null, { tags: { tags: ['foo', 'bar'] } });
    expect(result.tags).toEqual(['foo', 'bar']);
  });

  it('migrates legacy tags plain array', () => {
    const result = migrateGlobalData(null, { tags: ['alpha', 'beta'] });
    expect(result.tags).toEqual(['alpha', 'beta']);
  });

  it('passes through current-version data unchanged (except version stamp)', () => {
    const data = { ...defaultGlobalData(), tags: ['x'], version: GLOBAL_DATA_VERSION };
    const result = migrateGlobalData(data);
    expect(result.tags).toEqual(['x']);
    expect(result.version).toBe(GLOBAL_DATA_VERSION);
  });

  it('stamps version on version-0 raw object', () => {
    const result = migrateGlobalData({ catalog: [], tags: [], colorPresets: [], settings: { activeAiTools: [], projectCreateDefaultFolder: '' }, branches: [] });
    expect(result.version).toBe(GLOBAL_DATA_VERSION);
  });
});

describe('migrateProjectConfig', () => {
  it('returns object with version when given null', () => {
    const result = migrateProjectConfig(null);
    expect(result.version).toBe(1);
  });

  it('stamps version on config missing it', () => {
    const result = migrateProjectConfig({ project_name: 'Test' });
    expect(result.version).toBe(1);
    expect(result.project_name).toBe('Test');
  });

  it('preserves existing version', () => {
    const result = migrateProjectConfig({ version: 1, project_name: 'Foo' });
    expect(result.version).toBe(1);
  });
});
