import type { BranchStore } from '../store/branches';
import type { Branch } from '../types/global';
import { ProjectService } from './projectService';

export class BranchService {
  constructor(
    private readonly branches: BranchStore,
    private readonly project: ProjectService | undefined,
    private readonly devMode: boolean
  ) {}

  listLibrary(): Promise<Branch[]> {
    return this.branches.list();
  }

  async listAvailable(): Promise<Branch[]> {
    const globals = await this.branches.list();
    if (!this.project) return globals;
    return [...globals, ...await this.project.listLocalBranches()];
  }

  async listLocal(): Promise<Branch[]> {
    return this.requireProject().listLocalBranches();
  }

  async get(id: string): Promise<Branch | undefined> {
    return await this.branches.get(id) ?? await this.project?.getLocalBranch(id);
  }

  async listActive(): Promise<Branch[]> {
    const project = this.requireProject();
    const ids = await project.getActiveBranchIds();
    const all = await this.listAvailable();
    return ids.map((id) => all.find((branch) => branch.id === id)).filter((branch): branch is Branch => !!branch);
  }

  async activate(id: string): Promise<Branch> {
    const branch = await this.requireBranch(id);
    const project = this.requireProject();
    const active = await project.getActiveBranchIds();
    if (!active.includes(id)) {
      await project.ensureBranchArtifacts(branch);
      await project.setActiveBranchIds([...active, id]);
      if (!branch.local) await this.branches.incrementScore(id);
    }
    return branch;
  }

  async deactivate(id: string): Promise<void> {
    const project = this.requireProject();
    const active = await project.getActiveBranchIds();
    if (active.includes(id)) {
      await project.setActiveBranchIds(active.filter((branchId) => branchId !== id));
      const branch = await project.getLocalBranch(id);
      if (!branch) await this.branches.decrementScore(id);
    }
  }

  create(input: Pick<Branch, 'name' | 'description' | 'directives'> & Partial<Pick<Branch, 'artifacts'>>): Promise<Branch> {
    return this.branches.create({ ...input, devCreated: this.devMode });
  }

  createLocal(input: Pick<Branch, 'name' | 'description' | 'directives'> & Partial<Pick<Branch, 'artifacts'>>): Promise<Branch> {
    return this.requireProject().createLocalBranch(input);
  }

  async forkLocal(id: string, overrides: Partial<Pick<Branch, 'name' | 'description' | 'directives' | 'artifacts'>>): Promise<Branch> {
    const source = await this.requireBranch(id);
    return this.requireProject().createLocalBranch({
      name: overrides.name ?? `${source.name} Fork`,
      description: overrides.description ?? source.description,
      directives: overrides.directives ?? source.directives,
      artifacts: overrides.artifacts ?? source.artifacts,
      forkedFrom: source.forkedFrom ?? source.id,
    });
  }

  update(id: string, patch: Partial<Pick<Branch, 'name' | 'description' | 'directives' | 'artifacts'>>): Promise<Branch | undefined> {
    return this.branches.update(id, patch);
  }

  async updateLocal(id: string, patch: Partial<Pick<Branch, 'name' | 'description' | 'directives' | 'artifacts'>>): Promise<Branch | undefined> {
    return this.requireProject().updateLocalBranch(id, patch);
  }

  async remove(id: string): Promise<'deleted' | 'flagged'> {
    const branch = await this.requireBranch(id);
    if (branch.canonical) throw new Error('Canonical branches cannot be deleted.');
    if (this.devMode) {
      if (!branch.devCreated) throw new Error('Branch was not created in this dev session and cannot be deleted.');
      await this.branches.remove(id);
      return 'deleted';
    }
    await this.branches.flagForDeletion(id);
    return 'flagged';
  }

  summaries(branches: Branch[]) {
    return this.branches.summaries(branches);
  }

  private async requireBranch(id: string): Promise<Branch> {
    const branch = await this.get(id);
    if (!branch) throw new Error(`Branch "${id}" not found.`);
    return branch;
  }

  private requireProject(): ProjectService {
    if (!this.project) throw new Error('This operation requires an open Harbormaster project.');
    return this.project;
  }
}
