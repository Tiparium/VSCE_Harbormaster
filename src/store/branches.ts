import type { Branch } from '../types/global';
import type { GlobalStore } from './globalStore';

const SCORE_MENTION_THRESHOLD = 3;

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

  async create(branch: Omit<Branch, 'id' | 'createdAt' | 'updatedAt' | 'activatedBy'>): Promise<Branch> {
    const data = await this.store.read();
    const now = new Date().toISOString();
    const created: Branch = {
      id: generateId(),
      ...branch,
      createdAt: now,
      updatedAt: now,
      activatedBy: [],
    };
    data.branches.push(created);
    await this.store.write(data);
    return created;
  }

  async update(id: string, patch: Partial<Pick<Branch, 'name' | 'description' | 'directives'>>): Promise<Branch | undefined> {
    const data = await this.store.read();
    const index = data.branches.findIndex((b) => b.id === id);
    if (index < 0) return undefined;
    data.branches[index] = {
      ...data.branches[index],
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    await this.store.write(data);
    return data.branches[index];
  }

  async remove(id: string): Promise<void> {
    const data = await this.store.read();
    data.branches = data.branches.filter((b) => b.id !== id);
    await this.store.write(data);
  }

  async activate(branchId: string, projectPath: string): Promise<void> {
    const data = await this.store.read();
    const branch = data.branches.find((b) => b.id === branchId);
    if (!branch) return;
    if (!branch.activatedBy.includes(projectPath)) {
      branch.activatedBy.push(projectPath);
      branch.updatedAt = new Date().toISOString();
      await this.store.write(data);
    }
  }

  async deactivate(branchId: string, projectPath: string): Promise<void> {
    const data = await this.store.read();
    const branch = data.branches.find((b) => b.id === branchId);
    if (!branch) return;
    branch.activatedBy = branch.activatedBy.filter((p) => p !== projectPath);
    branch.updatedAt = new Date().toISOString();
    await this.store.write(data);
  }

  async getActiveForProject(projectPath: string): Promise<Branch[]> {
    const data = await this.store.read();
    return data.branches.filter((b) => b.activatedBy.includes(projectPath));
  }

  /** Returns branches whose activation count exceeds the mention threshold. */
  getPromotionCandidates(branches: Branch[]): Branch[] {
    return branches.filter((b) => b.activatedBy.length >= SCORE_MENTION_THRESHOLD);
  }
}

function generateId(): string {
  return `branch_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
