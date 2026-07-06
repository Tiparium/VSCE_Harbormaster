import * as fs from 'fs/promises';
import * as path from 'path';
import type { AiTool, Branch } from '../types/global';
import { AI_TOOL_ENTRYPOINTS } from '../types/global';
import { CANONICAL_BRANCHES } from '../store/canonicalBranches';
import { DIRECTIVES_PATH, PROJECT_CONFIG_PATH, SHELF_PATH } from './paths';

export type MigrationMode = 'migrate' | 'rebuild' | 'exclude';

export type MigrationPolicy = {
  mode: MigrationMode;
  projectName?: string;
  activeTools?: AiTool[];
  /** Additional global branch IDs whose matching local definitions are duplicates. */
  globalBranchIds?: string[];
  reason?: string;
};

export type MigrationAction =
  | { kind: 'copy'; from: string; to: string; reason: string }
  | { kind: 'move'; from: string; to: string; reason: string }
  | { kind: 'delete'; path: string; reason: string }
  | { kind: 'create'; path: string; reason: string }
  | { kind: 'update'; path: string; reason: string }
  | { kind: 'activate-branch'; branchId: string; reason: string }
  | { kind: 'catalog-upsert'; path: string; reason: string }
  | { kind: 'catalog-remove'; path: string; reason: string }
  | { kind: 'review'; path: string; reason: string };

export type ProjectMigrationPlan = {
  projectPath: string;
  mode: MigrationMode;
  reason?: string;
  actions: MigrationAction[];
  archivedLocalBranches: string[];
  warnings: string[];
};

const CANONICAL_BRANCH_IDS = new Set(CANONICAL_BRANCHES.map((branch) => branch.id));
const CANONICAL_BRANCH_ALIASES = new Map<string, string>([
  ['brainstorm-session', 'brainstorm-session'],
  ['cookie-module', 'cookie-module'],
  ['shelf', 'shelf'],
]);

const LEGACY_CONTEXT_DIRS = ['.harbormaster/.context', '.context'];
const LEGACY_META_DIR = '.harbormaster/.meta';
const LEGACY_BRANCH_DIR = '.harbormaster/branches';

export class ProjectMigrationPlanner {
  constructor(readonly projectPath: string) {}

  async plan(policy: MigrationPolicy): Promise<ProjectMigrationPlan> {
    const plan: ProjectMigrationPlan = {
      projectPath: this.projectPath,
      mode: policy.mode,
      reason: policy.reason,
      actions: [],
      archivedLocalBranches: [],
      warnings: [],
    };

    if (policy.mode === 'exclude') {
      plan.actions.push({
        kind: 'review',
        path: this.projectPath,
        reason: policy.reason ?? 'Explicitly excluded from automated migration.',
      });
      return plan;
    }

    if (!(await exists(this.projectPath))) {
      plan.warnings.push('Project path does not exist.');
      plan.actions.push({ kind: 'catalog-remove', path: this.projectPath, reason: 'Project path is missing.' });
      return plan;
    }

    if (policy.mode === 'rebuild') {
      if (await exists(this.resolve('.harbormaster'))) {
        plan.actions.push({
          kind: 'move',
          from: '.harbormaster',
          to: '.harbormaster-rebuild-backup',
          reason: 'Preserve the previous Harbormaster directory before rebuilding.',
        });
      }
      if (await exists(this.resolve('.project.json'))) {
        plan.actions.push({
          kind: 'move',
          from: '.project.json',
          to: '.harbormaster-rebuild-backup/.project.json',
          reason: 'Preserve legacy project metadata before rebuilding.',
        });
      }
      this.addFreshProjectActions(plan, policy);
      return plan;
    }

    await this.planCanonicalCore(plan);
    await this.planCanonicalArtifacts(plan);
    await this.planLocalBranches(plan, new Set([...CANONICAL_BRANCH_IDS, ...(policy.globalBranchIds ?? [])]));
    await this.planLegacyArchive(plan);
    await this.planEntrypoints(plan, policy.activeTools ?? []);
    plan.actions.push({ kind: 'catalog-upsert', path: this.projectPath, reason: 'Register migrated project in the new catalog.' });
    return plan;
  }

  private async planCanonicalCore(plan: ProjectMigrationPlan): Promise<void> {
    const configSource = await firstExisting(this.projectPath, [
      PROJECT_CONFIG_PATH,
      '.harbormaster/.meta/project.json',
      '.project.json',
    ]);
    if (!configSource) {
      plan.actions.push({ kind: 'create', path: PROJECT_CONFIG_PATH, reason: 'Create missing canonical project metadata.' });
    } else if (configSource !== PROJECT_CONFIG_PATH) {
      plan.actions.push({ kind: 'copy', from: configSource, to: PROJECT_CONFIG_PATH, reason: 'Migrate project metadata.' });
    } else {
      plan.actions.push({ kind: 'update', path: PROJECT_CONFIG_PATH, reason: 'Normalize metadata and active branch IDs.' });
    }

    const directivesSource = await firstExisting(this.projectPath, [
      DIRECTIVES_PATH,
      '.harbormaster/.context/DIRECTIVES.md',
      '.context/DIRECTIVES.md',
    ]);
    if (!directivesSource) {
      plan.actions.push({ kind: 'create', path: DIRECTIVES_PATH, reason: 'Create missing canonical directives.' });
    } else if (directivesSource !== DIRECTIVES_PATH) {
      plan.actions.push({ kind: 'copy', from: directivesSource, to: DIRECTIVES_PATH, reason: 'Migrate project directives.' });
    }
  }

  private async planCanonicalArtifacts(plan: ProjectMigrationPlan): Promise<void> {
    const shelfSource = await firstExisting(this.projectPath, [
      SHELF_PATH,
      '.harbormaster/.context/SHELF.md',
      '.context/SHELF.md',
    ]);
    if (shelfSource) {
      if (shelfSource !== SHELF_PATH) {
        plan.actions.push({ kind: 'copy', from: shelfSource, to: SHELF_PATH, reason: 'Migrate Shelf branch state.' });
      }
      activate(plan, 'shelf', 'Existing Shelf state discovered.');
    }

    if (await exists(this.resolve('.harbormaster/brainstorm'))) {
      plan.actions.push({
        kind: 'copy',
        from: '.harbormaster/brainstorm',
        to: '.harbormaster/brainstorms',
        reason: 'Migrate Brainstorm Session collection.',
      });
      activate(plan, 'brainstorm-session', 'Existing brainstorm collection discovered.');
    } else if (await exists(this.resolve('.harbormaster/brainstorms'))) {
      activate(plan, 'brainstorm-session', 'Existing brainstorm collection discovered.');
    }

    if (await exists(this.resolve('.harbormaster/feedback'))) {
      activate(plan, 'cookie-module', 'Existing feedback data discovered.');
    }
  }

  private async planLocalBranches(plan: ProjectMigrationPlan, globalBranchIds: Set<string>): Promise<void> {
    const branchDir = this.resolve(LEGACY_BRANCH_DIR);
    if (!(await exists(branchDir))) return;
    for (const relative of await listFiles(branchDir)) {
      const source = path.posix.join(LEGACY_BRANCH_DIR, relative);
      if (!relative.endsWith('.branch')) {
        this.archive(plan, source, path.posix.join('branches', relative), 'Archive nonstandard local branch data.');
        continue;
      }
      const id = path.basename(relative, '.branch');
      const globalId = CANONICAL_BRANCH_ALIASES.get(id) ?? id;
      if (globalBranchIds.has(globalId)) {
        activate(plan, globalId, `Legacy local branch "${id}" matches a branch in the global library.`);
        plan.actions.push({ kind: 'delete', path: source, reason: 'Remove duplicate local definition after canonical activation.' });
      } else {
        this.archive(plan, source, path.posix.join('branches', relative), 'Archive project-local branch for later review.');
        plan.archivedLocalBranches.push(source);
      }
    }
  }

  private async planLegacyArchive(plan: ProjectMigrationPlan): Promise<void> {
    for (const contextDir of LEGACY_CONTEXT_DIRS) {
      if (!(await exists(this.resolve(contextDir)))) continue;
      for (const relative of await listFiles(this.resolve(contextDir))) {
        if (relative === 'DIRECTIVES.md' || relative === 'SHELF.md') {
          plan.actions.push({
            kind: 'delete',
            path: path.posix.join(contextDir, relative),
            reason: 'Remove migrated canonical legacy file after verification.',
          });
        } else {
          this.archive(
            plan,
            path.posix.join(contextDir, relative),
            path.posix.join('context', relative),
            'Archive retired context content.'
          );
        }
      }
    }

    if (await exists(this.resolve(LEGACY_META_DIR))) {
      for (const relative of await listFiles(this.resolve(LEGACY_META_DIR))) {
        this.archive(
          plan,
          path.posix.join(LEGACY_META_DIR, relative),
          path.posix.join('meta', relative),
          'Archive retired metadata layout.'
        );
      }
    }

    for (const legacy of ['.harbormaster/brainstorm']) {
      if (await exists(this.resolve(legacy))) {
        plan.actions.push({ kind: 'delete', path: legacy, reason: 'Remove migrated canonical artifact directory after verification.' });
      }
    }

    for (const entry of await listTopLevel(this.resolve('.harbormaster'))) {
      if (['.context', '.meta', '.old', 'project.json', 'DIRECTIVES.md', 'shelf', 'brainstorm', 'brainstorms', 'feedback', 'branches'].includes(entry)) {
        continue;
      }
      this.archive(plan, `.harbormaster/${entry}`, `other/${entry}`, 'Archive noncanonical Harbormaster content.');
    }
  }

  private async planEntrypoints(plan: ProjectMigrationPlan, activeTools: AiTool[]): Promise<void> {
    const entries = new Set(await fs.readdir(this.projectPath));
    for (const [lowercase, canonical] of [['agents.md', 'AGENTS.md'], ['claude.md', 'CLAUDE.md']] as const) {
      if (!entries.has(lowercase)) continue;
      if (entries.has(canonical)) {
        plan.actions.push({ kind: 'delete', path: lowercase, reason: 'Remove duplicate deprecated lowercase AI entrypoint.' });
      } else {
        plan.actions.push({
          kind: 'move',
          from: lowercase,
          to: canonical,
          reason: 'Canonicalize AI entrypoint casing before installing the MCP bootstrap.',
        });
        entries.delete(lowercase);
        entries.add(canonical);
      }
    }

    const selected = new Set(activeTools);
    if (entries.has('AGENTS.md') || entries.has('agents.md')) selected.add('codex');
    if (entries.has('CLAUDE.md') || entries.has('claude.md')) selected.add('claude');
    for (const tool of selected) {
      plan.actions.push({
        kind: entries.has(AI_TOOL_ENTRYPOINTS[tool]) ? 'update' : 'create',
        path: AI_TOOL_ENTRYPOINTS[tool],
        reason: 'Install the canonical Harbormaster MCP bootstrap.',
      });
    }
  }

  private addFreshProjectActions(plan: ProjectMigrationPlan, policy: MigrationPolicy): void {
    plan.actions.push({ kind: 'create', path: PROJECT_CONFIG_PATH, reason: 'Create fresh project metadata.' });
    plan.actions.push({ kind: 'create', path: DIRECTIVES_PATH, reason: 'Create fresh project directives.' });
    for (const tool of policy.activeTools ?? []) {
      plan.actions.push({ kind: 'create', path: AI_TOOL_ENTRYPOINTS[tool], reason: 'Create canonical Harbormaster MCP bootstrap.' });
    }
    plan.actions.push({ kind: 'catalog-upsert', path: this.projectPath, reason: 'Register rebuilt project in the new catalog.' });
  }

  private archive(plan: ProjectMigrationPlan, from: string, relativeArchivePath: string, reason: string): void {
    plan.actions.push({
      kind: 'move',
      from,
      to: path.posix.join('.harbormaster/.old', relativeArchivePath),
      reason,
    });
  }

  private resolve(relativePath: string): string {
    return path.join(this.projectPath, relativePath);
  }
}

function activate(plan: ProjectMigrationPlan, branchId: string, reason: string): void {
  if (!plan.actions.some((action) => action.kind === 'activate-branch' && action.branchId === branchId)) {
    plan.actions.push({ kind: 'activate-branch', branchId, reason });
  }
}

async function firstExisting(root: string, candidates: string[]): Promise<string | undefined> {
  for (const candidate of candidates) {
    if (await exists(path.join(root, candidate))) return candidate;
  }
  return undefined;
}

async function listFiles(root: string, relative = ''): Promise<string[]> {
  const result: string[] = [];
  for (const entry of await fs.readdir(root, { withFileTypes: true })) {
    const child = path.join(root, entry.name);
    const childRelative = path.posix.join(relative, entry.name);
    if (entry.isDirectory()) result.push(...await listFiles(child, childRelative));
    else if (entry.isFile()) result.push(childRelative);
  }
  return result;
}

async function listTopLevel(root: string): Promise<string[]> {
  if (!(await exists(root))) return [];
  return (await fs.readdir(root)).sort();
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}
