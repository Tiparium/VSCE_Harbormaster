import * as fs from 'fs/promises';
import * as path from 'path';
import type { AiTool, Branch, BranchArtifacts } from '../types/global';
import { AI_TOOL_ENTRYPOINTS } from '../types/global';
import { CANONICAL_BRANCHES } from '../store/canonicalBranches';
import type { ProjectConfig } from '../types/project';
import {
  DIRECTIVES_PATH,
  LEGACY_DIRECTIVES_PATHS,
  LEGACY_PROJECT_CONFIG_PATHS,
  PROJECT_CONFIG_PATH,
  SHELF_PATH,
} from './paths';
import { withFileLock, writeJsonAtomic, writeTextAtomic } from '../utils/atomicFile';
import { DirectivesService } from './directivesService';

export const DIRECTIVES_TEMPLATE = `# Directives

## Operating loop
1. At session start, call \`harbormaster_full_context_get()\`.
2. Follow this project's operating rules and note which branches are active.
3. Before using an active branch workflow, call \`branch_get(id)\` for its full instructions.
4. Use Harbormaster MCP tools for project, branch, and branch-owned workflows when tools are available.
5. Fetch branch instructions only when needed; do not load the entire branch library into every session.

## Core Directives

## Branch behaviors
This project uses Harbormaster branches — modular behavior directives for specific workflows.
Branches require the Harbormaster MCP server. If MCP is unavailable, only the core directives in this file are available.

- To see which branches are active: \`project_branches_list()\`
- To get the full instructions for a branch before performing its workflow: \`branch_get(id)\`
- Shared branch definitions live in the global library; project-local branch definitions live in this project's Harbormaster config.
- Branch-owned project data lives under \`.harbormaster/\`.
- Deactivating a branch disables its behavior but does not delete its project data.

`;

export const SHELF_BRANCH_ID = 'shelf';

const BOOTSTRAP_START = '<!-- harbormaster:mcp-start -->';
const BOOTSTRAP_END = '<!-- harbormaster:mcp-end -->';

export function harbormasterBootstrap(projectName: string): string {
  return `# ${projectName}

${BOOTSTRAP_START}
## Harbormaster
At session start, call \`harbormaster_full_context_get()\` to load this project's directives and active branches.
Use Harbormaster MCP tools for project and branch workflows. If MCP is unavailable, read \`${DIRECTIVES_PATH}\` directly.
Project-specific core directives belong only in \`${DIRECTIVES_PATH}\`, never in this entrypoint file.
${BOOTSTRAP_END}
`;
}

export type AdoptionReport = {
  projectPath: string;
  created: string[];
  updated: string[];
  preserved: string[];
};

export class ProjectService {
  constructor(readonly workspacePath: string) {}

  async exists(): Promise<boolean> {
    return fileExists(this.resolve(PROJECT_CONFIG_PATH));
  }

  async hasHarbormasterFootprint(): Promise<boolean> {
    if (await fileExists(this.resolve('.harbormaster'))) return true;
    for (const legacyPath of LEGACY_PROJECT_CONFIG_PATHS) {
      if (await fileExists(this.resolve(legacyPath))) return true;
    }
    return false;
  }

  async detectAiTools(): Promise<AiTool[]> {
    const detected: AiTool[] = [];
    for (const [tool, entrypoint] of Object.entries(AI_TOOL_ENTRYPOINTS) as [AiTool, string][]) {
      if (await fileExists(this.resolve(entrypoint))) {
        detected.push(tool);
        continue;
      }
      if (tool === 'codex' && await fileExists(this.resolve('agents.md'))) detected.push(tool);
    }
    return detected;
  }

  async readConfig(): Promise<ProjectConfig | null> {
    const raw = await this.readRawConfig();
    if (!raw) return null;
    return normalizeProjectConfig(raw);
  }

  async readRawConfig(): Promise<Record<string, unknown> | null> {
    return readJsonObject(this.resolve(PROJECT_CONFIG_PATH));
  }

  async updateConfig(mutator: (config: Record<string, unknown>) => void): Promise<void> {
    const target = this.resolve(PROJECT_CONFIG_PATH);
    await withFileLock(target, async () => {
      const config = await this.readRawConfig();
      if (!config) throw new Error(`Harbormaster project config not found at ${target}`);
      mutator(config);
      await writeJsonAtomic(target, config);
    });
  }

  async readDirectives(): Promise<string> {
    return fs.readFile(this.resolve(DIRECTIVES_PATH), 'utf8');
  }

  async readShelf(): Promise<string> {
    return fs.readFile(this.resolve(SHELF_PATH), 'utf8');
  }

  async isBranchActive(id: string): Promise<boolean> {
    return (await this.getActiveBranchIds()).includes(id);
  }

  async ensureBranchArtifacts(branch: Pick<Branch, 'artifacts'>): Promise<void> {
    const artifacts = branch.artifacts;
    if (!artifacts) return;
    const artifactRoot = this.resolveArtifactRoot(artifacts.root);
    await fs.mkdir(artifactRoot, { recursive: true });
    for (const file of artifacts.initialFiles ?? []) {
      const target = resolveContainedPath(artifactRoot, file.path);
      if (!(await fileExists(target))) {
        await writeTextAtomic(target, file.content);
      }
    }
  }

  async getActiveBranchIds(): Promise<string[]> {
    const config = await this.readRawConfig();
    return Array.isArray(config?.activeBranches)
      ? config.activeBranches.filter((id): id is string => typeof id === 'string')
      : [];
  }

  async setActiveBranchIds(ids: string[]): Promise<void> {
    await this.updateConfig((config) => {
      config.activeBranches = [...new Set(ids)];
    });
  }

  async listLocalBranches(): Promise<Branch[]> {
    const config = await this.readRawConfig();
    if (!Array.isArray(config?.localBranches)) return [];
    return config.localBranches
      .filter(isBranchRecord)
      .map((branch) => ({ ...branch, local: true }));
  }

  async getLocalBranch(id: string): Promise<Branch | undefined> {
    return (await this.listLocalBranches()).find((branch) => branch.id === id);
  }

  async createLocalBranch(
    input: Pick<Branch, 'name' | 'description' | 'directives'> & Partial<Pick<Branch, 'artifacts' | 'forkedFrom'>>
  ): Promise<Branch> {
    const now = new Date().toISOString();
    let created!: Branch;
    await this.updateConfig((config) => {
      const localBranches = normalizeLocalBranches(config.localBranches);
      created = {
        id: generateLocalBranchId(localBranches),
        name: input.name,
        description: input.description,
        directives: input.directives,
        artifacts: input.artifacts,
        forkedFrom: input.forkedFrom,
        score: 0,
        local: true,
        createdAt: now,
        updatedAt: now,
      };
      localBranches.push(created);
      config.localBranches = localBranches;
    });
    return created;
  }

  async updateLocalBranch(id: string, patch: Partial<Pick<Branch, 'name' | 'description' | 'directives' | 'artifacts'>>): Promise<Branch | undefined> {
    let updated: Branch | undefined;
    await this.updateConfig((config) => {
      const localBranches = normalizeLocalBranches(config.localBranches);
      const index = localBranches.findIndex((branch) => branch.id === id);
      if (index < 0) {
        config.localBranches = localBranches;
        return;
      }
      localBranches[index] = { ...localBranches[index], ...patch, local: true, updatedAt: new Date().toISOString() };
      updated = localBranches[index];
      config.localBranches = localBranches;
    });
    return updated;
  }

  async adopt(projectName: string, activeTools: AiTool[]): Promise<AdoptionReport> {
    const report: AdoptionReport = { projectPath: this.workspacePath, created: [], updated: [], preserved: [] };
    const targetConfigPath = this.resolve(PROJECT_CONFIG_PATH);
    const targetExisted = await fileExists(targetConfigPath);
    const branchesWithExistingArtifacts: string[] = [];
    for (const branch of CANONICAL_BRANCHES) {
      if (branch.artifacts && await this.hasExistingBranchArtifacts(branch.artifacts)) {
        branchesWithExistingArtifacts.push(branch.id);
      }
    }
    await withFileLock(targetConfigPath, async () => {
      let config = await readJsonObject(targetConfigPath);
      if (!config) {
        for (const legacyPath of LEGACY_PROJECT_CONFIG_PATHS) {
          config = await readJsonObject(this.resolve(legacyPath));
          if (config) {
            report.preserved.push(legacyPath);
            break;
          }
        }
      }
      if (!config) config = {};
      applyConfigDefaults(config, projectName);
      config.activeBranches = (config.activeBranches as unknown[]).filter((id) => id !== 'core-directives');
      if (Array.isArray(config.activeBranches)) {
        for (const id of branchesWithExistingArtifacts) {
          if (!config.activeBranches.includes(id)) config.activeBranches.push(id);
        }
      }
      await writeJsonAtomic(targetConfigPath, config);
    });
    (targetExisted ? report.preserved : report.created).push(PROJECT_CONFIG_PATH);

    await this.copyFirstLegacyFile(DIRECTIVES_PATH, LEGACY_DIRECTIVES_PATHS, report);
    await this.ensureTextFile(DIRECTIVES_PATH, DIRECTIVES_TEMPLATE, report);
    if (await new DirectivesService(this.workspacePath).ensureCoreSection()) report.updated.push(DIRECTIVES_PATH);
    for (const branch of CANONICAL_BRANCHES) {
      if (branch.artifacts) await this.migrateBranchArtifacts(branch.artifacts, report);
    }
    await this.canonicalizeEntrypointCase(report);
    for (const tool of activeTools) {
      await this.ensureBootstrap(AI_TOOL_ENTRYPOINTS[tool], projectName, report);
    }

    return report;
  }

  private async ensureTextFile(relativePath: string, content: string, report: AdoptionReport): Promise<void> {
    const target = this.resolve(relativePath);
    if (await fileExists(target)) {
      report.preserved.push(relativePath);
      return;
    }
    await writeTextAtomic(target, content);
    report.created.push(relativePath);
  }

  private async ensureBootstrap(relativePath: string, projectName: string, report: AdoptionReport): Promise<void> {
    const target = this.resolve(relativePath);
    const block = `${BOOTSTRAP_START}
## Harbormaster
At session start, call \`harbormaster_full_context_get()\` to load this project's directives and active branches.
Use Harbormaster MCP tools for project and branch workflows. If MCP is unavailable, read \`${DIRECTIVES_PATH}\` directly.
Project-specific core directives belong only in \`${DIRECTIVES_PATH}\`, never in this entrypoint file.
${BOOTSTRAP_END}`;

    let content = '';
    try {
      content = await fs.readFile(target, 'utf8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }

    if (!content) {
      await writeTextAtomic(target, `# ${projectName}\n\n${block}\n`);
      report.created.push(relativePath);
      return;
    }

    const next = replaceManagedBlock(content, block);
    if (next === content) {
      report.preserved.push(relativePath);
      return;
    }
    await writeTextAtomic(target, next);
    report.updated.push(relativePath);
  }

  private async canonicalizeEntrypointCase(report: AdoptionReport): Promise<void> {
    const entries = new Set(await fs.readdir(this.workspacePath));
    for (const [lowercase, canonical] of [['agents.md', 'AGENTS.md'], ['claude.md', 'CLAUDE.md']] as const) {
      if (!entries.has(lowercase)) continue;
      const lowerPath = this.resolve(lowercase);
      const canonicalPath = this.resolve(canonical);
      if (entries.has(canonical)) {
        await fs.rm(lowerPath);
      } else {
        const tempPath = this.resolve(`.${lowercase}.harbormaster-case-migration`);
        await fs.rename(lowerPath, tempPath);
        await fs.rename(tempPath, canonicalPath);
      }
      report.updated.push(lowercase);
    }
  }

  private async copyFirstLegacyFile(
    targetRelative: string,
    legacyPaths: readonly string[],
    report: AdoptionReport
  ): Promise<void> {
    const target = this.resolve(targetRelative);
    if (await fileExists(target)) return;
    for (const legacyRelative of legacyPaths) {
      const legacy = this.resolve(legacyRelative);
      if (!(await fileExists(legacy))) continue;
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.copyFile(legacy, target);
      report.created.push(targetRelative);
      report.preserved.push(legacyRelative);
      return;
    }
  }

  private async hasExistingBranchArtifacts(artifacts: BranchArtifacts): Promise<boolean> {
    if (await fileExists(this.resolveArtifactRoot(artifacts.root))) return true;
    for (const root of artifacts.legacyRoots ?? []) {
      if (await fileExists(this.resolve(root))) return true;
    }
    for (const file of artifacts.initialFiles ?? []) {
      for (const legacyPath of file.legacyPaths ?? []) {
        if (await fileExists(this.resolve(legacyPath))) return true;
      }
    }
    return false;
  }

  private async migrateBranchArtifacts(artifacts: BranchArtifacts, report: AdoptionReport): Promise<void> {
    const artifactRoot = this.resolveArtifactRoot(artifacts.root);
    for (const legacyRoot of artifacts.legacyRoots ?? []) {
      if (!(await fileExists(this.resolve(legacyRoot)))) continue;
      await copyDirectoryMissing(this.resolve(legacyRoot), artifactRoot);
      report.created.push(artifacts.root);
      report.preserved.push(legacyRoot);
    }
    for (const file of artifacts.initialFiles ?? []) {
      await this.copyFirstLegacyFile(
        path.join(artifacts.root, file.path),
        file.legacyPaths ?? [],
        report
      );
    }
  }

  private resolve(relativePath: string): string {
    return path.join(this.workspacePath, relativePath);
  }

  private resolveArtifactRoot(relativePath: string): string {
    const normalized = relativePath.split('\\').join('/');
    if (!normalized.startsWith('.harbormaster/') || normalized.includes('/../')) {
      throw new Error(`Branch artifact root must be inside .harbormaster: ${relativePath}`);
    }
    return resolveContainedPath(this.workspacePath, relativePath);
  }
}

export async function resolveProjectPath(startPath: string): Promise<string | null> {
  let current = path.resolve(startPath);
  while (true) {
    if (await fileExists(path.join(current, PROJECT_CONFIG_PATH))) return current;
    const parent = path.dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

function applyConfigDefaults(config: Record<string, unknown>, projectName: string): void {
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

function normalizeProjectConfig(raw: Record<string, unknown>): ProjectConfig {
  return {
    version: typeof raw.version === 'number' ? raw.version : 1,
    project_name: typeof raw.project_name === 'string' ? raw.project_name : '',
    project_version: typeof raw.project_version === 'string' ? raw.project_version : '',
    version_major: nonNegativeInt(raw.version_major),
    version_minor: nonNegativeInt(raw.version_minor),
    version_patch: nonNegativeInt(raw.version_patch),
    version_prerelease: typeof raw.version_prerelease === 'string' ? raw.version_prerelease : '',
    tags: Array.isArray(raw.tags) ? raw.tags.filter((tag): tag is string => typeof tag === 'string') : [],
    activeBranches: Array.isArray(raw.activeBranches)
      ? raw.activeBranches.filter((id): id is string => typeof id === 'string')
      : [],
    localBranches: Array.isArray(raw.localBranches) ? raw.localBranches.filter(isBranchRecord).map((branch) => ({ ...branch, local: true })) : [],
  };
}

function normalizeLocalBranches(value: unknown): Branch[] {
  return Array.isArray(value) ? value.filter(isBranchRecord).map((branch) => ({ ...branch, local: true })) : [];
}

function isBranchRecord(value: unknown): value is Branch {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const branch = value as Partial<Branch>;
  return typeof branch.id === 'string'
    && typeof branch.name === 'string'
    && typeof branch.description === 'string'
    && typeof branch.directives === 'string'
    && typeof branch.createdAt === 'string'
    && typeof branch.updatedAt === 'string'
    && typeof branch.score === 'number';
}

function nonNegativeInt(value: unknown): number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : 0;
}

function replaceManagedBlock(content: string, block: string): string {
  const start = content.indexOf(BOOTSTRAP_START);
  const end = content.indexOf(BOOTSTRAP_END);
  if (start >= 0 && end >= start) {
    return `${content.slice(0, start)}${block}${content.slice(end + BOOTSTRAP_END.length)}`;
  }
  const trimmed = content.trimEnd();
  return `${trimmed}\n\n${block}\n`;
}

async function readJsonObject(filePath: string): Promise<Record<string, unknown> | null> {
  try {
    const parsed: unknown = JSON.parse(await fs.readFile(filePath, 'utf8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('expected a JSON object');
    }
    return parsed as Record<string, unknown>;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw new Error(`Unable to read project config ${filePath}: ${String(error)}`);
  }
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function copyDirectoryMissing(source: string, target: string): Promise<void> {
  await fs.mkdir(target, { recursive: true });
  for (const entry of await fs.readdir(source, { withFileTypes: true })) {
    const sourcePath = path.join(source, entry.name);
    const targetPath = path.join(target, entry.name);
    if (entry.isDirectory()) {
      await copyDirectoryMissing(sourcePath, targetPath);
    } else if (entry.isFile() && !(await fileExists(targetPath))) {
      await fs.copyFile(sourcePath, targetPath);
    }
  }
}

function resolveContainedPath(root: string, relativePath: string): string {
  if (path.isAbsolute(relativePath)) throw new Error(`Expected a relative path: ${relativePath}`);
  const target = path.resolve(root, relativePath);
  const relative = path.relative(root, target);
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error(`Path escapes its owning directory: ${relativePath}`);
  }
  return target;
}

function generateLocalBranchId(existing: Branch[]): string {
  for (let attempt = 0; ; attempt++) {
    const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const id = attempt === 0 ? `local_branch_${suffix}` : `local_branch_${suffix}_${attempt}`;
    if (!existing.some((branch) => branch.id === id)) return id;
  }
}
