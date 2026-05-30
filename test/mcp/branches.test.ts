import { describe, it, expect, vi } from 'vitest';
import { BranchStore } from '../../src/store/branches';
import type { GlobalData } from '../../src/types/global';
import { defaultGlobalData } from '../../src/types/global';

function makeStore(initial?: Partial<GlobalData>) {
  let state: GlobalData = { ...defaultGlobalData(), ...initial };
  const store = {
    read: vi.fn(async () => ({
      ...state,
      branches: state.branches.map((b) => ({ ...b })),
    })),
    write: vi.fn(async (data: GlobalData) => { state = { ...data }; }),
  };
  return { store: store as any, getState: () => state };
}

describe('BranchStore', () => {
  it('list returns empty array initially', async () => {
    const { store } = makeStore();
    expect(await new BranchStore(store).list()).toEqual([]);
  });

  it('create adds a branch with score 0', async () => {
    const { store, getState } = makeStore();
    const branch = await new BranchStore(store).create({ name: 'Test', description: 'desc', directives: '## Rules' });
    expect(branch.score).toBe(0);
    expect(branch.id).toBeTruthy();
    expect(getState().branches).toHaveLength(1);
  });

  it('incrementScore increases score by 1', async () => {
    const { store, getState } = makeStore();
    const bs = new BranchStore(store);
    const b = await bs.create({ name: 'B', description: '', directives: '' });
    await bs.incrementScore(b.id);
    await bs.incrementScore(b.id);
    expect(getState().branches[0].score).toBe(2);
  });

  it('decrementScore decreases score but not below 0', async () => {
    const { store, getState } = makeStore();
    const bs = new BranchStore(store);
    const b = await bs.create({ name: 'B', description: '', directives: '' });
    await bs.incrementScore(b.id);
    await bs.decrementScore(b.id);
    await bs.decrementScore(b.id); // already 0
    expect(getState().branches[0].score).toBe(0);
  });

  it('update patches existing branch', async () => {
    const { store } = makeStore();
    const bs = new BranchStore(store);
    const b = await bs.create({ name: 'Old', description: 'old', directives: '' });
    const updated = await bs.update(b.id, { name: 'New' });
    expect(updated?.name).toBe('New');
    expect(updated?.description).toBe('old');
  });

  it('remove deletes non-canonical branch', async () => {
    const { store, getState } = makeStore();
    const bs = new BranchStore(store);
    const b = await bs.create({ name: 'B', description: '', directives: '' });
    expect(await bs.remove(b.id)).toBe(true);
    expect(getState().branches).toHaveLength(0);
  });

  it('remove refuses to delete canonical branches', async () => {
    const { store, getState } = makeStore();
    const bs = new BranchStore(store);
    const b = await bs.create({ name: 'C', description: '', directives: '', canonical: true });
    expect(await bs.remove(b.id)).toBe(false);
    expect(getState().branches).toHaveLength(1);
  });

  it('seed adds canonical branches that are not present', async () => {
    const { store, getState } = makeStore();
    const bs = new BranchStore(store);
    await bs.seed([
      { id: 'brainstorm-session', name: 'Brainstorm', description: '', directives: '', canonical: true },
      { id: 'cookie-module', name: 'Cookie', description: '', directives: '', canonical: true },
    ]);
    expect(getState().branches).toHaveLength(2);
  });

  it('seed does not duplicate existing branches', async () => {
    const { store, getState } = makeStore();
    const bs = new BranchStore(store);
    await bs.seed([{ id: 'brainstorm-session', name: 'Brainstorm', description: '', directives: '', canonical: true }]);
    await bs.seed([{ id: 'brainstorm-session', name: 'Brainstorm', description: '', directives: '', canonical: true }]);
    expect(getState().branches).toHaveLength(1);
  });

  it('summaries returns only summary fields', async () => {
    const { store } = makeStore();
    const bs = new BranchStore(store);
    const b = await bs.create({ name: 'B', description: 'desc', directives: 'long content here' });
    const summaries = bs.summaries([b]);
    expect(summaries[0]).not.toHaveProperty('directives');
    expect(summaries[0]).toHaveProperty('description');
    expect(summaries[0]).toHaveProperty('score');
  });
});
