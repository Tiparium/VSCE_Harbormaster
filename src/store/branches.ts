import type { Branch } from '../types/global';
import type { GlobalStoreApi as GlobalStore } from './globalStore';

export type BranchSummary = Pick<Branch, 'id' | 'name' | 'description' | 'score' | 'canonical'>;

export class BranchStore {
  constructor(private readonly store: GlobalStore) {}

  async list(): Promise<Branch[]> {
    const data = await this.store.read();
    return data.branches;
  }

  async get(id: string): Promise<Branch | undefined> {
    const data = await this.store.read();
    return data.branches.find((b) => b.id === id);
  }

  async create(branch: Omit<Branch, 'id' | 'createdAt' | 'updatedAt' | 'score' | 'canonical'>): Promise<Branch> {
    const data = await this.store.read();
    const now = new Date().toISOString();
    const created: Branch = {
      id: generateId(),
      ...branch,
      score: 0,
      createdAt: now,
      updatedAt: now,
    };
    data.branches.push(created);
    await this.store.write(data);
    return created;
  }

  async update(id: string, patch: Partial<Pick<Branch, 'name' | 'description' | 'directives'>>): Promise<Branch | undefined> {
    const data = await this.store.read();
    const index = data.branches.findIndex((b) => b.id === id);
    if (index < 0) return undefined;
    data.branches[index] = { ...data.branches[index], ...patch, updatedAt: new Date().toISOString() };
    await this.store.write(data);
    return data.branches[index];
  }

  async remove(id: string): Promise<boolean> {
    const data = await this.store.read();
    const branch = data.branches.find((b) => b.id === id);
    if (!branch || branch.canonical) return false;
    data.branches = data.branches.filter((b) => b.id !== id);
    await this.store.write(data);
    return true;
  }

  async incrementScore(id: string): Promise<void> {
    const data = await this.store.read();
    const branch = data.branches.find((b) => b.id === id);
    if (!branch) return;
    branch.score = (branch.score ?? 0) + 1;
    branch.updatedAt = new Date().toISOString();
    await this.store.write(data);
  }

  async decrementScore(id: string): Promise<void> {
    const data = await this.store.read();
    const branch = data.branches.find((b) => b.id === id);
    if (!branch) return;
    branch.score = Math.max(0, (branch.score ?? 0) - 1);
    branch.updatedAt = new Date().toISOString();
    await this.store.write(data);
  }

  /** Seed canonical branches into the library if they are not already present. */
  async seed(canonicals: Omit<Branch, 'createdAt' | 'updatedAt' | 'score'>[]): Promise<void> {
    const data = await this.store.read();
    let changed = false;
    for (const canonical of canonicals) {
      if (!data.branches.some((b) => b.id === canonical.id)) {
        const now = new Date().toISOString();
        data.branches.push({ ...canonical, score: 0, createdAt: now, updatedAt: now });
        changed = true;
      }
    }
    if (changed) await this.store.write(data);
  }

  summaries(branches: Branch[]): BranchSummary[] {
    return branches.map(({ id, name, description, score, canonical }) => ({ id, name, description, score, canonical }));
  }
}

function generateId(): string {
  return `branch_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
