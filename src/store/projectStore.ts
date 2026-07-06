import * as vscode from 'vscode';
import type { ProjectConfig, ProjectAccent } from '../types/project';
import { migrateProjectConfig } from './migration';

const DEFAULT_CONFIG_PATH = '.harbormaster/project.json';

export class ProjectStore {
  constructor(
    private readonly workspaceUri: vscode.Uri,
    private readonly configPath = DEFAULT_CONFIG_PATH
  ) {}

  get configUri(): vscode.Uri {
    return vscode.Uri.joinPath(this.workspaceUri, this.configPath);
  }

  get workspacePath(): string {
    return this.workspaceUri.fsPath;
  }

  get configRelativePath(): string {
    return this.configPath;
  }

  async read(): Promise<ProjectConfig | null> {
    try {
      const content = await vscode.workspace.fs.readFile(this.configUri);
      const raw = JSON.parse(Buffer.from(content).toString('utf8'));
      const migrated = migrateProjectConfig(raw);
      return normalizeProjectConfig(migrated);
    } catch {
      return null;
    }
  }

  async exists(): Promise<boolean> {
    try {
      await vscode.workspace.fs.stat(this.configUri);
      return true;
    } catch {
      return false;
    }
  }

  async isCorrupt(): Promise<boolean> {
    try {
      const content = await vscode.workspace.fs.readFile(this.configUri);
      JSON.parse(Buffer.from(content).toString('utf8'));
      return false;
    } catch {
      return true;
    }
  }

}

function normalizeProjectConfig(raw: Record<string, unknown>): ProjectConfig {
  const accent = normalizeAccent(raw.accent) ?? normalizeLegacyAccent(raw);
  return {
    version: typeof raw.version === 'number' ? raw.version : 1,
    project_name: coerceString(raw.project_name) ?? '',
    project_version: coerceString(raw.project_version) ?? '',
    version_major: coerceInt(raw.version_major) ?? 0,
    version_minor: coerceInt(raw.version_minor) ?? 0,
    version_patch: coerceInt(raw.version_patch) ?? 0,
    version_prerelease: coerceString(raw.version_prerelease) ?? '',
    tags: Array.isArray(raw.tags) ? raw.tags.filter((t): t is string => typeof t === 'string') : [],
    activeBranches: Array.isArray(raw.activeBranches)
      ? raw.activeBranches.filter((b): b is string => typeof b === 'string')
      : [],
    ...(accent ? { accent } : {}),
  };
}

function normalizeLegacyAccent(raw: Record<string, unknown>): ProjectAccent | undefined {
  const sections = isRecord(raw.window_accent_sections) ? raw.window_accent_sections : {};
  const groups = isRecord(raw.window_accent_groups) ? raw.window_accent_groups : {};
  const frame = firstString(sections.window, raw.window_accent);
  const accent = firstString(sections.highlights, sections.harbormaster, sections.other, raw.window_accent);
  const surface = firstString(groups.sidebar, groups.panel);
  const result: ProjectAccent = {};
  if (frame) result.frame = frame;
  if (accent) result.accent = accent;
  if (surface) result.surface = surface;
  return Object.keys(result).length ? result : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function firstString(...values: unknown[]): string | undefined {
  return values.find((value): value is string => typeof value === 'string' && value.trim().length > 0);
}

function normalizeAccent(raw: unknown): ProjectAccent | undefined {
  if (!raw || typeof raw !== 'object') {
    return undefined;
  }
  const obj = raw as Record<string, unknown>;
  const result: ProjectAccent = {};
  if (typeof obj.frame === 'string') result.frame = obj.frame;
  if (typeof obj.accent === 'string') result.accent = obj.accent;
  if (typeof obj.surface === 'string') result.surface = obj.surface;
  return Object.keys(result).length > 0 ? result : undefined;
}

function coerceString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function coerceInt(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isInteger(value) && value >= 0) return value;
  if (typeof value === 'string' && /^\d+$/.test(value)) return parseInt(value, 10);
  return undefined;
}
