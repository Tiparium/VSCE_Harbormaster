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
  createdAt: string;
  updatedAt: string;
  activatedBy: string[];
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
      projectCreateDefaultFolder: '',
    },
    branches: [],
  };
}
