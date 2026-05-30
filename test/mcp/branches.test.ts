import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BranchStore } from '../../src/store/branches';
import type { GlobalData } from '../../src/types/global';
import { defaultGlobalData } from '../../src/types/global';

function makeStore(initial?: Partial<GlobalData>) {
  let state: GlobalData = { ...defaultGlobalData(), ...initial };
  const store = {
    read: vi.fn(async () => ({ ...state, branches: state.branches.map((b) => ({ ...b, activatedBy: [...b.activatedBy] })) })),
    write: vi.fn(async (data: GlobalData) => { state = { ...data }; }),
  };
  return { store: store as any, getState: () => state };
}

describe('BranchStore', () => {
  it('list returns empty array initially', async () => {
    const { store } = makeStore();
    const branches = new BranchStore(store);
    expect(await branches.list()).toEqual([]);
  });

  it('create adds a branch with generated id and timestamps', async () => {
    const { store, getState } = makeStore();
    const branches = new BranchStore(store);
    const branch = await branches.create({ name: 'Test', description: 'A test branch', directives: '## Rules\n- Do stuff' });
    expect(branch.id).toBeTruthy();
    expect(branch.name).toBe('Test');
    expect(branch.activatedBy).toEqual([]);
    expect(getState().branches).toHaveLength(1);
  });

  it('update patches existing branch', async () => {
    const { store } = makeStore();
    const branches = new BranchStore(store);
    const created = await branches.create({ name: 'Old', description: 'Old desc', directives: '' });
    const updated = await branches.update(created.id, { name: 'New', description: 'New desc' });
    expect(updated?.name).toBe('New');
    expect(updated?.description).toBe('New desc');
  });

  it('update returns undefined for missing id', async () => {
    const { store } = makeStore();
    const branches = new BranchStore(store);
    expect(await branches.update('nope', { name: 'x' })).toBeUndefined();
  });

  it('activate adds projectPath to activatedBy', async () => {
    const { store, getState } = makeStore();
    const branches = new BranchStore(store);
    const created = await branches.create({ name: 'B', description: '', directives: '' });
    await branches.activate(created.id, '/projects/foo');
    expect(getState().branches[0].activatedBy).toContain('/projects/foo');
  });

  it('activate is idempotent', async () => {
    const { store, getState } = makeStore();
    const branches = new BranchStore(store);
    const created = await branches.create({ name: 'B', description: '', directives: '' });
    await branches.activate(created.id, '/projects/foo');
    await branches.activate(created.id, '/projects/foo');
    expect(getState().branches[0].activatedBy).toHaveLength(1);
  });

  it('deactivate removes projectPath', async () => {
    const { store, getState } = makeStore();
    const branches = new BranchStore(store);
    const created = await branches.create({ name: 'B', description: '', directives: '' });
    await branches.activate(created.id, '/projects/foo');
    await branches.deactivate(created.id, '/projects/foo');
    expect(getState().branches[0].activatedBy).toHaveLength(0);
  });

  it('getPromotionCandidates returns branches at or above threshold', async () => {
    const { store } = makeStore();
    const branches = new BranchStore(store);
    const b1 = await branches.create({ name: 'Low', description: '', directives: '' });
    const b2 = await branches.create({ name: 'High', description: '', directives: '' });
    await branches.activate(b2.id, '/p/1');
    await branches.activate(b2.id, '/p/2');
    await branches.activate(b2.id, '/p/3');
    const list = await branches.list();
    const candidates = branches.getPromotionCandidates(list);
    expect(candidates.map((b) => b.id)).not.toContain(b1.id);
    expect(candidates.map((b) => b.id)).toContain(b2.id);
  });

  it('remove deletes branch by id', async () => {
    const { store, getState } = makeStore();
    const branches = new BranchStore(store);
    const created = await branches.create({ name: 'B', description: '', directives: '' });
    await branches.remove(created.id);
    expect(getState().branches).toHaveLength(0);
  });
});
