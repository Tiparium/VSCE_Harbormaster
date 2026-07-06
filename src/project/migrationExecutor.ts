import * as fs from 'fs/promises';
import * as path from 'path';
import type { AiTool } from '../types/global';
import { AI_TOOL_ENTRYPOINTS } from '../types/global';
import { CANONICAL_BRANCHES } from '../store/canonicalBranches';
import { writeJsonAtomic, writeTextAtomic } from '../utils/atomicFile';
import { DIRECTIVES_PATH, PROJECT_CONFIG_PATH } from './paths';
import { DIRECTIVES_TEMPLATE, harbormasterBootstrap } from './projectService';
import type { MigrationAction, MigrationPolicy, ProjectMigrationPlan } from './migration';

export type ExecutionResult = {
  projectPath: string;
  completed: MigrationAction[];
  verified: string[];
};

export class ProjectMigrationExecutor {
  constructor(readonly projectPath: string) {}

  async execute(plan: ProjectMigrationPlan, policy: MigrationPolicy): Promise<ExecutionResult> {
    if (plan.projectPath !== this.projectPath) throw new Error('Migration plan path does not match executor path.');
    if (plan.mode === 'exclude') return { projectPath: this.projectPath, completed: [], verified: ['Excluded by policy.'] };

    const result: ExecutionResult = { projectPath: this.projectPath, completed: [], verified: [] };
    for (const action of plan.actions) {
      if (action.kind === 'catalog-upsert' || action.kind === 'catalog-remove' || action.kind === 'review') continue;
      await this.executeAction(action, policy);
      result.completed.push(action);
    }
    await this.verify(plan, policy, result);
    return result;
  }

  private async executeAction(action: MigrationAction, policy: MigrationPolicy): Promise<void> {
    switch (action.kind) {
      case 'copy':
        await copyMissing(this.resolve(action.from), this.resolve(action.to));
        return;
      case 'move':
        await moveWithVerification(this.resolve(action.from), this.resolve(action.to));
        return;
      case 'delete':
        await fs.rm(this.resolve(action.path), { recursive: true, force: true });
        return;
      case 'create':
        await this.create(action.path, policy);
        return;
      case 'update':
        await this.update(action.path, policy);
        return;
      case 'activate-branch':
        await this.activate(action.branchId);
        return;
      default:
        return;
    }
  }

  private async create(relativePath: string, policy: MigrationPolicy): Promise<void> {
    if (relativePath === PROJECT_CONFIG_PATH) {
      await writeJsonAtomic(this.resolve(relativePath), defaultConfig(policy.projectName ?? path.basename(this.projectPath)));
    } else if (relativePath === DIRECTIVES_PATH) {
      await writeTextAtomic(this.resolve(relativePath), DIRECTIVES_TEMPLATE);
    } else if (toolForEntrypoint(relativePath)) {
      await writeTextAtomic(this.resolve(relativePath), harbormasterBootstrap(policy.projectName ?? path.basename(this.projectPath)));
    }
  }

  private async update(relativePath: string, policy: MigrationPolicy): Promise<void> {
    if (relativePath === PROJECT_CONFIG_PATH) {
      const config = await readJsonObject(this.resolve(relativePath)) ?? {};
      applyDefaults(config, policy.projectName ?? path.basename(this.projectPath));
      await writeJsonAtomic(this.resolve(relativePath), config);
    } else if (toolForEntrypoint(relativePath)) {
      await writeTextAtomic(this.resolve(relativePath), harbormasterBootstrap(policy.projectName ?? path.basename(this.projectPath)));
    }
  }

  private async activate(branchId: string): Promise<void> {
    const config = await readJsonObject(this.resolve(PROJECT_CONFIG_PATH)) ?? defaultConfig(path.basename(this.projectPath));
    applyDefaults(config, path.basename(this.projectPath));
    const active = config.activeBranches as string[];
    if (!active.includes(branchId)) active.push(branchId);
    await writeJsonAtomic(this.resolve(PROJECT_CONFIG_PATH), config);
    const branch = CANONICAL_BRANCHES.find((candidate) => candidate.id === branchId);
    if (!branch?.artifacts) return;
    await fs.mkdir(this.resolve(branch.artifacts.root), { recursive: true });
    for (const file of branch.artifacts.initialFiles ?? []) {
      const target = this.resolve(path.posix.join(branch.artifacts.root, file.path));
      if (!(await exists(target))) await writeTextAtomic(target, file.content);
    }
  }

  private async verify(plan: ProjectMigrationPlan, policy: MigrationPolicy, result: ExecutionResult): Promise<void> {
    for (const required of [PROJECT_CONFIG_PATH, DIRECTIVES_PATH]) {
      if (!(await exists(this.resolve(required)))) throw new Error(`Missing ${required} after migration.`);
      result.verified.push(required);
    }
    for (const action of plan.actions) {
      if ((action.kind === 'move' || action.kind === 'copy') && !(await exists(this.resolve(action.to)))) {
        throw new Error(`Missing migration destination: ${action.to}`);
      }
      if (action.kind === 'activate-branch') {
        const config = await readJsonObject(this.resolve(PROJECT_CONFIG_PATH));
        if (!Array.isArray(config?.activeBranches) || !config.activeBranches.includes(action.branchId)) {
          throw new Error(`Branch not active after migration: ${action.branchId}`);
        }
      }
    }
    for (const tool of policy.activeTools ?? []) {
      if (!(await exists(this.resolve(AI_TOOL_ENTRYPOINTS[tool])))) throw new Error(`Missing entrypoint for ${tool}.`);
    }
  }

  private resolve(relativePath: string): string {
    return path.join(this.projectPath, relativePath);
  }
}

function toolForEntrypoint(relativePath: string): AiTool | undefined {
  return (Object.entries(AI_TOOL_ENTRYPOINTS) as [AiTool, string][]).find(([, entrypoint]) => entrypoint === relativePath)?.[0];
}

function defaultConfig(projectName: string): Record<string, unknown> {
  const config: Record<string, unknown> = {};
  applyDefaults(config, projectName);
  return config;
}

function applyDefaults(config: Record<string, unknown>, projectName: string): void {
  if (typeof config.version !== 'number') config.version = 1;
  if (typeof config.project_name !== 'string' || !config.project_name.trim()) config.project_name = projectName;
  if (typeof config.project_version !== 'string') config.project_version = '';
  if (typeof config.version_major !== 'number') config.version_major = 0;
  if (typeof config.version_minor !== 'number') config.version_minor = 0;
  if (typeof config.version_patch !== 'number') config.version_patch = 0;
  if (typeof config.version_prerelease !== 'string') config.version_prerelease = '';
  if (!Array.isArray(config.tags)) config.tags = [];
  if (!Array.isArray(config.activeBranches)) config.activeBranches = [];
}

async function copyMissing(source: string, target: string): Promise<void> {
  const stat = await fs.stat(source);
  if (stat.isDirectory()) {
    await fs.mkdir(target, { recursive: true });
    for (const entry of await fs.readdir(source)) await copyMissing(path.join(source, entry), path.join(target, entry));
  } else if (!(await exists(target))) {
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.copyFile(source, target);
  }
}

async function moveWithVerification(source: string, target: string): Promise<void> {
  if (!(await exists(source))) return;
  if (source.toLowerCase() === target.toLowerCase()) {
    const temporary = `${source}.harbormaster-case-migration`;
    await fs.rename(source, temporary);
    await fs.rename(temporary, target);
    return;
  }
  if (await exists(target)) throw new Error(`Migration destination already exists: ${target}`);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.rename(source, target);
  if (!(await exists(target))) throw new Error(`Unable to verify move destination: ${target}`);
}

async function readJsonObject(filePath: string): Promise<Record<string, unknown> | null> {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8')) as Record<string, unknown>;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}
