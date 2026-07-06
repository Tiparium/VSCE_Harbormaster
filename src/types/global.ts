import type { CatalogProject } from './project';

export const GLOBAL_DATA_VERSION = 1;

export type AiTool = 'claude' | 'codex' | 'cursor' | 'copilot' | 'windsurf';

export const AI_TOOL_ENTRYPOINTS: Record<AiTool, string> = {
  claude: 'CLAUDE.md',
  codex: 'AGENTS.md',
  cursor: '.cursorrules',
  copilot: '.github/copilot-instructions.md',
  windsurf: '.windsurfrules',
};

export type GlobalSettings = {
  activeAiTools: AiTool[];
  registeredMcpTools: AiTool[];
  projectCreateDefaultFolder: string;
};

export type ColorPreset = {
  name: string;
  createdAt: string;
  updatedAt: string;
  frame?: string;
  accent?: string;
  surface?: string;
};

export type Branch = {
  id: string;
  name: string;
  description: string;
  directives: string;
  /** Optional project-local data owned by this branch. */
  artifacts?: BranchArtifacts;
  createdAt: string;
  updatedAt: string;
  /** Number of projects currently using this branch. */
  score: number;
  /** Whether this branch ships with Harbormaster and cannot be deleted. */
  canonical?: boolean;
  /** Flagged for deletion by an agent in production mode; awaiting user confirmation in the UI. */
  pendingDeletion?: boolean;
  /** Created during a dev-mode session; eligible for hard deletion in dev mode. */
  devCreated?: boolean;
  /** Stored in one project's config instead of the global branch library. */
  local?: boolean;
  /** Global branch id this local branch was forked from. */
  forkedFrom?: string;
};

export type BranchArtifacts = {
  /** Directory relative to the project root. */
  root: string;
  /** Files created when the branch is first activated. */
  initialFiles?: BranchArtifactFile[];
  /** Previous directories copied into root during project adoption. */
  legacyRoots?: string[];
};

export type BranchArtifactFile = {
  /** File path relative to the artifact root. */
  path: string;
  content: string;
  /** Previous project-relative file paths copied during adoption. */
  legacyPaths?: string[];
};

export type GlobalData = {
  version: number;
  catalog: CatalogProject[];
  tags: string[];
  colorPresets: ColorPreset[];
  settings: GlobalSettings;
  branches: Branch[];
};

export function defaultGlobalData(): GlobalData {
  return {
    version: GLOBAL_DATA_VERSION,
    catalog: [],
    tags: [],
    colorPresets: [],
    settings: {
      activeAiTools: [],
      registeredMcpTools: [],
      projectCreateDefaultFolder: '',
    },
    branches: [],
  };
}
