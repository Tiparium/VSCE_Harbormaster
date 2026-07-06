import type { Branch } from '../types/global';
import type { GlobalStoreApi as GlobalStore } from './globalStore';

export type BranchSummary = Pick<Branch, 'id' | 'name' | 'description' | 'score' | 'canonical' | 'pendingDeletion' | 'local' | 'forkedFrom'>;

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

  async create(branch: Omit<Branch, 'id' | 'createdAt' | 'updatedAt' | 'score' | 'canonical' | 'pendingDeletion'>): Promise<Branch> {
    return this.store.update((data) => {
      const now = new Date().toISOString();
      const created: Branch = {
        id: generateId(),
        ...branch,
        score: 0,
        createdAt: now,
        updatedAt: now,
      };
      data.branches.push(created);
      return created;
    });
  }

  async update(id: string, patch: Partial<Pick<Branch, 'name' | 'description' | 'directives' | 'artifacts'>>): Promise<Branch | undefined> {
    return this.store.update((data) => {
      const index = data.branches.findIndex((b) => b.id === id);
      if (index < 0) return undefined;
      data.branches[index] = { ...data.branches[index], ...patch, updatedAt: new Date().toISOString() };
      return data.branches[index];
    });
  }

  async remove(id: string): Promise<boolean> {
    return this.store.update((data) => {
      const branch = data.branches.find((b) => b.id === id);
      if (!branch || branch.canonical) return false;
      data.branches = data.branches.filter((b) => b.id !== id);
      return true;
    });
  }

  async flagForDeletion(id: string): Promise<boolean> {
    return this.store.update((data) => {
      const branch = data.branches.find((b) => b.id === id);
      if (!branch || branch.canonical) return false;
      branch.pendingDeletion = true;
      branch.updatedAt = new Date().toISOString();
      return true;
    });
  }

  async incrementScore(id: string): Promise<void> {
    await this.store.update((data) => {
      const branch = data.branches.find((b) => b.id === id);
      if (!branch) return;
      branch.score = (branch.score ?? 0) + 1;
      branch.updatedAt = new Date().toISOString();
    });
  }

  async decrementScore(id: string): Promise<void> {
    await this.store.update((data) => {
      const branch = data.branches.find((b) => b.id === id);
      if (!branch) return;
      branch.score = Math.max(0, (branch.score ?? 0) - 1);
      branch.updatedAt = new Date().toISOString();
    });
  }

  /** Seed canonical branches into the library if they are not already present. */
  async seed(canonicals: Omit<Branch, 'createdAt' | 'updatedAt' | 'score'>[]): Promise<void> {
    await this.store.update((data) => {
      for (const canonical of canonicals) {
        const existing = data.branches.find((b) => b.id === canonical.id);
        if (!existing) {
          const now = new Date().toISOString();
          data.branches.push({ ...canonical, score: 0, createdAt: now, updatedAt: now });
        } else {
          existing.name = canonical.name;
          existing.description = canonical.description;
          existing.directives = canonical.directives;
          existing.artifacts = canonical.artifacts;
          existing.canonical = canonical.canonical;
          existing.updatedAt = new Date().toISOString();
        }
      }
    });
  }

  async retire(ids: readonly string[]): Promise<void> {
    await this.store.update((data) => {
      data.branches = data.branches.filter((branch) => !ids.includes(branch.id));
    });
  }

  summaries(branches: Branch[]): BranchSummary[] {
    return branches.map(({ id, name, description, score, canonical, pendingDeletion, local, forkedFrom }) => ({
      id,
      name,
      description,
      score,
      canonical,
      pendingDeletion,
      local,
      forkedFrom,
    }));
  }
}

function generateId(): string {
  return `branch_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
