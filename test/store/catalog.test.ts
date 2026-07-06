import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CatalogStore } from '../../src/store/catalog';
import type { GlobalData } from '../../src/types/global';
import { defaultGlobalData } from '../../src/types/global';

function makeStore(initial?: Partial<GlobalData>) {
  let state: GlobalData = { ...defaultGlobalData(), ...initial };
  const store = {
    read: vi.fn(async () => ({ ...state })),
    write: vi.fn(async (data: GlobalData) => { state = { ...data }; }),
    update: vi.fn(async <T>(mutator: (data: GlobalData) => T | Promise<T>) => {
      const data = { ...state, catalog: state.catalog.map((p) => ({ ...p })) };
      const result = await mutator(data);
      state = data;
      return result;
    }),
  };
  return { store: store as any, getState: () => state };
}

describe('CatalogStore', () => {
  it('list returns empty array when catalog is empty', async () => {
    const { store } = makeStore();
    const catalog = new CatalogStore(store);
    expect(await catalog.list()).toEqual([]);
  });

  it('upsert creates a new entry', async () => {
    const { store, getState } = makeStore();
    const catalog = new CatalogStore(store);
    const result = await catalog.upsert({ name: 'My Project', path: '/projects/my', tags: [] });
    expect(result.name).toBe('My Project');
    expect(result.id).toBeTruthy();
    expect(getState().catalog).toHaveLength(1);
  });

  it('upsert updates an existing entry matched by path', async () => {
    const existing = [{ id: 'abc', name: 'Old', path: '/foo', tags: [], createdAt: '2026-01-01' }];
    const { store, getState } = makeStore({ catalog: existing });
    const catalog = new CatalogStore(store);
    await catalog.upsert({ name: 'New', path: '/foo', tags: ['x'] });
    expect(getState().catalog).toHaveLength(1);
    expect(getState().catalog[0].name).toBe('New');
    expect(getState().catalog[0].tags).toEqual(['x']);
  });

  it('remove deletes by id', async () => {
    const existing = [{ id: 'abc', name: 'P', path: '/foo', tags: [], createdAt: '2026-01-01' }];
    const { store, getState } = makeStore({ catalog: existing });
    const catalog = new CatalogStore(store);
    await catalog.remove('abc');
    expect(getState().catalog).toHaveLength(0);
  });

  it('findByPath returns matching entry', async () => {
    const existing = [{ id: 'abc', name: 'P', path: '/foo', tags: [], createdAt: '2026-01-01' }];
    const { store } = makeStore({ catalog: existing });
    const catalog = new CatalogStore(store);
    const found = await catalog.findByPath('/foo');
    expect(found?.id).toBe('abc');
  });

  it('findByPath returns undefined for no match', async () => {
    const { store } = makeStore();
    const catalog = new CatalogStore(store);
    expect(await catalog.findByPath('/nope')).toBeUndefined();
  });

  describe('sort', () => {
    const items = [
      { id: '1', name: 'Banana', path: '/b', tags: ['z'], createdAt: '2026-01-02', lastEditedAt: '2026-01-05' },
      { id: '2', name: 'Apple', path: '/a', tags: ['a'], createdAt: '2026-01-01', lastEditedAt: '2026-01-03' },
      { id: '3', name: 'Cherry', path: '/c', tags: ['m'], createdAt: '2026-01-03', lastEditedAt: '2026-01-04' },
    ];

    it('sorts by name ascending', () => {
      const { store } = makeStore();
      const catalog = new CatalogStore(store);
      const sorted = catalog.sort(items, 'name');
      expect(sorted.map((p) => p.name)).toEqual(['Apple', 'Banana', 'Cherry']);
    });

    it('sorts by created descending', () => {
      const { store } = makeStore();
      const catalog = new CatalogStore(store);
      const sorted = catalog.sort(items, 'created');
      expect(sorted.map((p) => p.id)).toEqual(['3', '1', '2']);
    });

    it('sorts by lastEdited descending', () => {
      const { store } = makeStore();
      const catalog = new CatalogStore(store);
      const sorted = catalog.sort(items, 'lastEdited');
      expect(sorted.map((p) => p.id)).toEqual(['1', '3', '2']);
    });
  });
});
