import * as vscode from 'vscode';
import * as os from 'os';
import * as path from 'path';

import { HarbormasterAppViewProvider } from './ui/appView';
import { StatusBarController } from './ui/statusBar';

const DEFAULT_HARBORMASTER_DIR = '.harbormaster';
const DEFAULT_META_DIR = `${DEFAULT_HARBORMASTER_DIR}/.meta`;
const DEFAULT_CONTEXT_DIR = '.harbormaster/.context';
const DEFAULT_CONFIG_FILE = `${DEFAULT_META_DIR}/project.json`;
const DEFAULT_PROJECT_KEY = 'project_name';
const DEFAULT_VERSION_KEY = 'project_version';
const DEFAULT_VERSION_MAJOR_KEY = 'version_major';
const DEFAULT_VERSION_MINOR_KEY = 'version_minor';
const DEFAULT_VERSION_PATCH_KEY = 'version_patch';
const DEFAULT_VERSION_PRERELEASE_KEY = 'version_prerelease';
const DEFAULT_WINDOW_ACCENT_KEY = 'window_accent';
const DEFAULT_WINDOW_ACCENT_SECTIONS_KEY = 'window_accent_sections';
const DEFAULT_WINDOW_ACCENT_GROUPS_KEY = 'window_accent_groups';
const DEFAULT_WINDOW_ACCENT_SECTIONS_INHERIT_KEY = 'window_accent_sections_inherit';
const DEFAULT_WINDOW_ACCENT_GROUPS_INHERIT_KEY = 'window_accent_groups_inherit';
const DEFAULT_WINDOW_ACCENT_OVERRIDES_KEY = 'window_accent_overrides';
const DEFAULT_WINDOW_ACCENT_HISTORY_KEY = 'window_accent_history';
const DEFAULT_WINDOW_ACCENT_BACKUP_KEY = 'window_accent_backup';
const DEFAULT_WINDOW_ACCENT_HIGHLIGHT_BOOST_KEY = 'window_accent_highlight_boost';
const DEFAULT_COLOR_PRESETS_FILE = 'color-presets.json';
const DEFAULT_TAGS_FILE = `${DEFAULT_META_DIR}/tags.json`;
const DEFAULT_PROJECTS_FILE = 'projects.json';
const REQUIRED_CONTEXT_FILES = [
  'DIRECTIVES.md',
  'PROJECT_STATE.md',
  'PERSONALITY.md',
  'DOCUMENTS.md',
  'SHELF.md',
];
const TEMPLATE_DIR = 'resources/templates';
const CONTEXT_TEMPLATE_FILES: Record<string, string> = {
  'DIRECTIVES.md': 'DIRECTIVES.md.template',
  'PROJECT_STATE.md': 'PROJECT_STATE.md.template',
  'PERSONALITY.md': 'PERSONALITY.md.template',
  'DOCUMENTS.md': 'DOCUMENTS.md.template',
  'SHELF.md': 'SHELF.md.template',
};
const AGENTS_TEMPLATE_FILE = 'AGENTS.md.template';
const LEGACY_CONFIG_FILE = '.project.json';
const LEGACY_META_DIR = '.harbormaster';
const LEGACY_CONTEXT_DIR = '.context';
const AGENTS_FILE_CANDIDATES = ['AGENTS.md', 'agents.md'];
const AGENTS_DIRECTIVES_MARKER = 'Harbormaster directives notice';
const AGENTS_DIRECTIVES_NOTICE = [
  `## ${AGENTS_DIRECTIVES_MARKER}`,
  'Move most directive content into `.harbormaster/.context/DIRECTIVES.md`,',
  'then remove those moved directives and this notice block from this file.',
  'Keep this file as the entrypoint that references DIRECTIVES.md.',
  'This is manual to avoid automation conflicts.',
  '',
].join('\n');
const DEFAULT_HEADLESS_PREFIX = '[Headless] ';
const DEFAULT_NAMED_FORMAT = '${projectName}';
const DEFAULT_VERSION_FORMAT = '${projectName} (${projectVersion})';
const DEFAULT_SHOW_VERSION = false;
const FALLBACK_TITLE_TEMPLATE = '${dirty}${activeEditorShort}${separator}${rootName}${separator}${appName}';
const DEFAULT_HIGHLIGHT_INHERIT_BOOST = 0.15;
const DEFAULT_PROJECT_CREATE_FOLDER = path.join(os.homedir(), 'Documents');
const ACCENT_SECTIONS = [
  { id: 'window', label: 'Window' },
  { id: 'highlights', label: 'Highlights' },
  { id: 'harbormaster', label: 'Harbormaster' },
  { id: 'other', label: 'Other' },
];
const ACCENT_GROUPS = [
  {
    id: 'titleBar',
    label: 'Title Bar',
    section: 'window',
    keys: [
      'titleBar.activeBackground',
      'titleBar.inactiveBackground',
      'titleBar.activeForeground',
      'titleBar.inactiveForeground',
    ],
  },
  {
    id: 'activityBar',
    label: 'Activity Bar',
    section: 'window',
    keys: [
      'activityBar.background',
      'activityBar.foreground',
      'activityBar.inactiveForeground',
    ],
  },
  {
    id: 'tabs',
    label: 'Tabs',
    section: 'highlights',
    keys: [
      'activityBar.activeBorder',
      'activityBar.activeFocusBorder',
      'tab.activeBorderTop',
      'tab.activeBorder',
      'tab.unfocusedActiveBorderTop',
      'tab.unfocusedActiveBorder',
      'tab.activeModifiedBorder',
      'panelTitle.activeBorder',
      'sideBarSectionHeader.border',
      'sideBarTitle.border',
    ],
  },
  {
    id: 'notifications',
    label: 'Notifications',
    section: 'highlights',
    keys: [
      'activityBarBadge.background',
      'activityBarBadge.foreground',
      'notificationCenterHeader.background',
      'notificationCenterHeader.foreground',
      'notificationLink.foreground',
      'notifications.background',
      'notifications.border',
    ],
  },
  {
    id: 'statusBar',
    label: 'Status Bar',
    section: 'highlights',
    keys: [
      'statusBar.background',
      'statusBar.foreground',
      'statusBar.debuggingBackground',
      'statusBar.debuggingForeground',
      'statusBarItem.hoverBackground',
      'statusBar.noFolderBackground',
    ],
  },
  {
    id: 'sidebar',
    label: 'Sidebar',
    section: 'other',
    keys: ['sideBar.background', 'sideBar.foreground', 'sideBar.border'],
  },
  {
    id: 'panel',
    label: 'Panel',
    section: 'other',
    keys: [
      'panel.background',
      'panel.border',
      'panelTitle.activeForeground',
      'panelTitle.inactiveForeground',
    ],
  },
  {
    id: 'editor',
    label: 'Editor',
    section: 'other',
    keys: [
      'editor.selectionBackground',
      'editor.selectionHighlightBackground',
      'editor.lineHighlightBackground',
      'editorCursor.foreground',
    ],
  },
  {
    id: 'lists',
    label: 'Lists',
    section: 'other',
    keys: [
      'list.activeSelectionBackground',
      'list.inactiveSelectionBackground',
      'list.hoverBackground',
      'list.focusBackground',
      'list.highlightForeground',
    ],
  },
  {
    id: 'buttons',
    label: 'Buttons',
    section: 'other',
    keys: ['button.background', 'button.hoverBackground', 'button.foreground'],
  },
  {
    id: 'badges',
    label: 'Badges',
    section: 'other',
    keys: ['badge.background', 'badge.foreground'],
  },
  {
    id: 'harbormaster',
    label: 'Harbormaster UI',
    section: 'harbormaster',
    keys: [
      'harbormaster.panelBackground',
      'harbormaster.cardBackground',
      'harbormaster.border',
      'harbormaster.accent',
      'harbormaster.text',
      'harbormaster.buttonBackground',
      'harbormaster.buttonHover',
      'harbormaster.pillBackground',
    ],
  },
];
const ACCENT_COLOR_KEYS = ACCENT_GROUPS.flatMap((group) => group.keys);

function isDevToolsEnabled(context: vscode.ExtensionContext): boolean {
  return process.env.HARBORMASTER_DEV_TOOLS === '1' || context.extensionMode === vscode.ExtensionMode.Development;
}

interface ExtensionSettings {
  configFile: string;
  tagsFile: string;
  projectsFile: string;
  projectNameKey: string;
  projectVersionKey: string;
  projectVersionMajorKey: string;
  projectVersionMinorKey: string;
  projectVersionPatchKey: string;
  projectVersionPrereleaseKey: string;
  showVersion: boolean;
  versionFormat: string;
  headlessPrefix: string;
  namedFormat: string;
  projectCreateDefaultFolder: string;
}

interface ProjectInfo {
  name?: string;
  version?: string;
  tags?: string[];
  windowAccent?: string;
  windowAccentSections?: Record<string, string>;
  windowAccentGroups?: Record<string, string>;
  windowAccentSectionsInherit?: Record<string, boolean>;
  windowAccentGroupsInherit?: Record<string, boolean>;
  windowAccentOverrides?: Record<string, string>;
  windowAccentHistory?: Record<string, string[]>;
  windowAccentHighlightBoost?: number;
}

type AccentPresetData = {
  window_accent?: string;
  window_accent_sections?: Record<string, string>;
  window_accent_groups?: Record<string, string>;
  window_accent_sections_inherit?: Record<string, boolean>;
  window_accent_groups_inherit?: Record<string, boolean>;
  window_accent_overrides?: Record<string, string>;
  window_accent_history?: Record<string, string[]>;
  window_accent_highlight_boost?: number;
};

type ColorPreset = {
  name: string;
  createdAt: string;
  updatedAt: string;
  data: AccentPresetData;
};

interface TagConfig {
  tags: string[];
}

interface CatalogProject {
  id: string;
  name: string;
  path: string;
  tags?: string[];
  createdAt: string;
  lastOpenedAt?: string;
  lastEditedAt?: string;
}

type Catalog = CatalogProject[];
interface CatalogQuickPickItem extends vscode.QuickPickItem {
  project?: CatalogProject;
  isSortOption?: boolean;
  sortKey?: string;
}

type HealthSnapshot = {
  missing: string[];
  corrupt: string[];
  legacy: string[];
};

let trackerSingleton: ProjectTracker | undefined;
let appViewProviderSingleton: HarbormasterAppViewProvider | undefined;

class ProjectTracker implements vscode.Disposable {
  private readonly onDidChangeEmitter = new vscode.EventEmitter<void>();
  readonly onDidChange = this.onDidChangeEmitter.event;
  private disposables: vscode.Disposable[] = [];
  private initialized = false;
  private watchers: vscode.FileSystemWatcher[] = [];
  private diagnostics?: vscode.DiagnosticCollection;
  private inputDiagnostics?: vscode.DiagnosticCollection;
  private lastHealth?: HealthSnapshot;
  private readonly warnedFiles = new Set<string>();
  private previewActive = false;

  constructor(private readonly context: vscode.ExtensionContext) {
    void this.ensureInitialized();
  }

  dispose(): void {
    this.onDidChangeEmitter.dispose();
    this.disposables.forEach((item) => item.dispose());
    this.watchers.forEach((w) => w.dispose());
  }

  async ensureInitialized(): Promise<void> {
    if (this.initialized) {
      return;
    }

    const folder = getPrimaryWorkspaceFolder();
    if (!folder) {
      return;
    }

    const settings = getExtensionSettings();
    await this.ensureGlobalTagsFile(settings);
    await this.migrateLegacyTagsToGlobal(folder, settings);
    await this.ensureCatalogFile(settings);
    await this.migrateWorkspaceCatalog(folder, settings);
    await this.upsertCatalogEntry(folder, settings, { silent: true });
    this.registerWatchers(folder, settings);
    await this.refreshHealth();
    this.initialized = true;
  }

  setHealthIndicators(diagnostics: vscode.DiagnosticCollection): void {
    this.diagnostics = diagnostics;
    void this.refreshHealth();
  }

  setInputDiagnostics(diagnostics: vscode.DiagnosticCollection): void {
    this.inputDiagnostics = diagnostics;
  }

  async reportInvalidAccentInput(scope: string, value: string): Promise<void> {
    if (!this.inputDiagnostics) {
      return;
    }
    const folder = getPrimaryWorkspaceFolder();
    if (!folder) {
      return;
    }
    const settings = getExtensionSettings();
    const configUri = vscode.Uri.joinPath(folder.uri, settings.configFile);
    const message = value
      ? `Harbormaster: invalid hex value "${value}" in ${scope}.`
      : `Harbormaster: invalid hex value in ${scope}.`;
    const diagnostic = new vscode.Diagnostic(
      new vscode.Range(0, 0, 0, 1),
      message,
      vscode.DiagnosticSeverity.Warning
    );
    this.inputDiagnostics.set(configUri, [diagnostic]);
  }

  async clearInvalidAccentInput(): Promise<void> {
    this.inputDiagnostics?.clear();
  }

  async getProjectTags(config: Record<string, unknown>): Promise<string[]> {
    const rawTags = Array.isArray(config.tags) ? config.tags : [];
    return dedupeTags(rawTags);
  }

  async getCurrentProjectInfo(settings: ExtensionSettings): Promise<ProjectInfo | undefined> {
    const folder = getPrimaryWorkspaceFolder();
    if (!folder) {
      return undefined;
    }
    await this.ensureInitialized();
    return readProjectInfo(folder, settings, this);
  }

  private buildAccentPresetData(config: Record<string, unknown>): AccentPresetData {
    const data: AccentPresetData = {};
    const base = normalizeAccentColor(coerceString(config?.[DEFAULT_WINDOW_ACCENT_KEY]));
    const sections = normalizeAccentSections(config?.[DEFAULT_WINDOW_ACCENT_SECTIONS_KEY]);
    const groups = normalizeAccentGroups(config?.[DEFAULT_WINDOW_ACCENT_GROUPS_KEY]);
    const sectionInherit = normalizeAccentSectionInherit(config?.[DEFAULT_WINDOW_ACCENT_SECTIONS_INHERIT_KEY]);
    const groupInherit = normalizeAccentGroupInherit(config?.[DEFAULT_WINDOW_ACCENT_GROUPS_INHERIT_KEY]);
    const overrides = normalizeAccentOverrides(config?.[DEFAULT_WINDOW_ACCENT_OVERRIDES_KEY]);
    const history = normalizeAccentHistory(config?.[DEFAULT_WINDOW_ACCENT_HISTORY_KEY]);
    const highlightBoost = normalizeAccentHighlightBoost(config?.[DEFAULT_WINDOW_ACCENT_HIGHLIGHT_BOOST_KEY]);

    if (base) data.window_accent = base;
    if (Object.keys(sections).length > 0) data.window_accent_sections = sections;
    if (Object.keys(groups).length > 0) data.window_accent_groups = groups;
    if (Object.keys(sectionInherit).length > 0) data.window_accent_sections_inherit = sectionInherit;
    if (Object.keys(groupInherit).length > 0) data.window_accent_groups_inherit = groupInherit;
    if (Object.keys(overrides).length > 0) data.window_accent_overrides = overrides;
    if (Object.keys(history).length > 0) data.window_accent_history = history;
    if (typeof highlightBoost === 'number') {
      data.window_accent_highlight_boost = highlightBoost;
    }
    return data;
  }

  private applyAccentPresetToConfig(config: Record<string, unknown>, preset: AccentPresetData): void {
    delete config[DEFAULT_WINDOW_ACCENT_KEY];
    delete config[DEFAULT_WINDOW_ACCENT_SECTIONS_KEY];
    delete config[DEFAULT_WINDOW_ACCENT_GROUPS_KEY];
    delete config[DEFAULT_WINDOW_ACCENT_SECTIONS_INHERIT_KEY];
    delete config[DEFAULT_WINDOW_ACCENT_GROUPS_INHERIT_KEY];
    delete config[DEFAULT_WINDOW_ACCENT_OVERRIDES_KEY];
    delete config[DEFAULT_WINDOW_ACCENT_HISTORY_KEY];
    delete config[DEFAULT_WINDOW_ACCENT_HIGHLIGHT_BOOST_KEY];

    if (preset.window_accent) config[DEFAULT_WINDOW_ACCENT_KEY] = preset.window_accent;
    if (preset.window_accent_sections) config[DEFAULT_WINDOW_ACCENT_SECTIONS_KEY] = preset.window_accent_sections;
    if (preset.window_accent_groups) config[DEFAULT_WINDOW_ACCENT_GROUPS_KEY] = preset.window_accent_groups;
    if (preset.window_accent_sections_inherit) {
      config[DEFAULT_WINDOW_ACCENT_SECTIONS_INHERIT_KEY] = preset.window_accent_sections_inherit;
    }
    if (preset.window_accent_groups_inherit) {
      config[DEFAULT_WINDOW_ACCENT_GROUPS_INHERIT_KEY] = preset.window_accent_groups_inherit;
    }
    if (preset.window_accent_overrides) config[DEFAULT_WINDOW_ACCENT_OVERRIDES_KEY] = preset.window_accent_overrides;
    if (preset.window_accent_history) config[DEFAULT_WINDOW_ACCENT_HISTORY_KEY] = preset.window_accent_history;
    if (typeof preset.window_accent_highlight_boost === 'number') {
      config[DEFAULT_WINDOW_ACCENT_HIGHLIGHT_BOOST_KEY] = preset.window_accent_highlight_boost;
    }
  }

  private setColorSettingsBackup(config: Record<string, unknown>): void {
    delete config[DEFAULT_WINDOW_ACCENT_BACKUP_KEY];
    const data = this.buildAccentPresetData(config);
    config[DEFAULT_WINDOW_ACCENT_BACKUP_KEY] = data;
  }

  private getPresetsUri(): vscode.Uri {
    return vscode.Uri.joinPath(this.context.globalStorageUri, DEFAULT_COLOR_PRESETS_FILE);
  }

  private async readPresets(uri: vscode.Uri): Promise<ColorPreset[]> {
    try {
      const content = await vscode.workspace.fs.readFile(uri);
      const parsed = JSON.parse(Buffer.from(content).toString('utf8'));
      if (Array.isArray(parsed)) {
        return parsed as ColorPreset[];
      }
    } catch (error) {
      this.warnReadIssue(uri, error);
    }
    return [];
  }

  private async writePresets(presets: ColorPreset[], uri: vscode.Uri): Promise<void> {
    await this.ensureDirectory(uri);
    await vscode.workspace.fs.writeFile(uri, Buffer.from(JSON.stringify(presets, null, 2) + '\n', 'utf8'));
    this.onDidChangeEmitter.fire();
  }

  async addGlobalTag(): Promise<void> {
    const folder = getPrimaryWorkspaceFolder();
    if (!folder) {
      void vscode.window.showErrorMessage('Harbormaster: No workspace folder open.');
      return;
    }

    await this.ensureInitialized();
    const settings = getExtensionSettings();
    const tags = await this.readTagsFile(settings);
    const input = await vscode.window.showInputBox({
      prompt: 'Tag name',
      placeHolder: 'e.g. backend',
      ignoreFocusOut: true,
      validateInput: (value) => {
        const normalized = normalizeTag(value);
        if (!normalized) {
          return 'Tag cannot be empty';
        }
        if (tags.some((t) => t.toLowerCase() === normalized.toLowerCase())) {
          return 'Tag already exists';
        }
        return undefined;
      },
    });
    if (!input) {
      return;
    }

    const normalized = normalizeTag(input);
    tags.push(normalized);
    await this.writeTagsFile(settings, tags);
    this.onDidChangeEmitter.fire();
    void vscode.window.showInformationMessage(`Harbormaster: added tag "${normalized}".`);
  }

  async saveColorPreset(): Promise<void> {
    const folder = getPrimaryWorkspaceFolder();
    if (!folder) {
      void vscode.window.showErrorMessage('Harbormaster: No workspace folder open.');
      return;
    }
    await this.ensureInitialized();
    const settings = getExtensionSettings();
    const configUri = vscode.Uri.joinPath(folder.uri, settings.configFile);
    const config = await this.readConfig(configUri);
    const name = await vscode.window.showInputBox({
      prompt: 'Preset name',
      placeHolder: 'e.g., Ocean dusk',
    });
    if (!name) {
      return;
    }
    const presetsUri = this.getPresetsUri();
    const presets = await this.readPresets(presetsUri);
    const now = new Date().toISOString();
    const existingIndex = presets.findIndex((preset) => preset.name === name);
    const data = this.buildAccentPresetData(config);
    if (existingIndex >= 0) {
      const replace = await vscode.window.showWarningMessage(
        `Harbormaster: preset "${name}" already exists. Replace it?`,
        { modal: true },
        'Replace',
        'Cancel'
      );
      if (replace !== 'Replace') {
        return;
      }
      presets[existingIndex] = { ...presets[existingIndex], updatedAt: now, data };
    } else {
      presets.push({ name, createdAt: now, updatedAt: now, data });
    }
    await this.writePresets(presets, presetsUri);
    void vscode.window.showInformationMessage(`Harbormaster: saved preset "${name}".`);
  }

  async applyColorPreset(): Promise<void> {
    const folder = getPrimaryWorkspaceFolder();
    if (!folder) {
      void vscode.window.showErrorMessage('Harbormaster: No workspace folder open.');
      return;
    }
    await this.ensureInitialized();
    const settings = getExtensionSettings();
    const presetsUri = this.getPresetsUri();
    const presets = await this.readPresets(presetsUri);
    if (presets.length === 0) {
      void vscode.window.showInformationMessage('Harbormaster: No presets saved yet.');
      return;
    }
    const pick = await vscode.window.showQuickPick(
      presets.map((preset) => ({ label: preset.name, preset })),
      { placeHolder: 'Select a preset to apply' }
    );
    if (!pick) {
      return;
    }
    const configUri = vscode.Uri.joinPath(folder.uri, settings.configFile);
    const config = await this.readConfig(configUri);
    this.setColorSettingsBackup(config);
    this.applyAccentPresetToConfig(config, pick.preset.data);
    await this.writeConfig(configUri, config, settings.configFile);
    await this.applyWindowAccentConfig(folder, config);
    this.onDidChangeEmitter.fire();
    void vscode.window.showInformationMessage(`Harbormaster: applied preset "${pick.label}".`);
  }

  async removeGlobalTag(): Promise<void> {
    const folder = getPrimaryWorkspaceFolder();
    if (!folder) {
      void vscode.window.showErrorMessage('Harbormaster: No workspace folder open.');
      return;
    }

    await this.ensureInitialized();
    const settings = getExtensionSettings();
    const tags = await this.readTagsFile(settings);
    if (tags.length === 0) {
      void vscode.window.showInformationMessage('Harbormaster: No tags to remove.');
      return;
    }

    const pick = await vscode.window.showQuickPick(tags, {
      placeHolder: 'Select a tag to remove',
    });
    if (!pick) {
      return;
    }

    const remaining = tags.filter((t) => t !== pick);
    await this.writeTagsFile(settings, remaining);
    await this.removeTagFromProjectConfig(folder, settings, pick);
    this.onDidChangeEmitter.fire();
    void vscode.window.showInformationMessage(`Harbormaster: removed tag "${pick}".`);
  }

  async assignTagToProject(): Promise<void> {
    const folder = getPrimaryWorkspaceFolder();
    if (!folder) {
      void vscode.window.showErrorMessage('Harbormaster: No workspace folder open.');
      return;
    }

    await this.ensureInitialized();
    const settings = getExtensionSettings();
    const configUri = vscode.Uri.joinPath(folder.uri, settings.configFile);
    const tags = await this.readTagsFile(settings);
    if (tags.length === 0) {
      const create = await vscode.window.showWarningMessage('No tags exist. Create one first?', 'Create tag', 'Cancel');
      if (create === 'Create tag') {
        await this.addGlobalTag();
      }
      return;
    }

    const pick = await vscode.window.showQuickPick(tags, {
      placeHolder: 'Select a tag to assign',
    });
    if (!pick) {
      return;
    }

    const config = await this.readConfig(configUri);
    const currentTags = dedupeTags(Array.isArray(config.tags) ? config.tags : []);
    if (currentTags.some((t) => t.toLowerCase() === pick.toLowerCase())) {
      void vscode.window.showInformationMessage(`Harbormaster: project already has tag "${pick}".`);
      return;
    }

    currentTags.push(pick);
    config.tags = dedupeTags(currentTags);
    await this.writeConfig(configUri, config, settings.configFile);
    this.onDidChangeEmitter.fire();
    void vscode.window.showInformationMessage(`Harbormaster: assigned tag "${pick}" to project.`);
  }

  async removeProjectTag(): Promise<void> {
    const folder = getPrimaryWorkspaceFolder();
    if (!folder) {
      void vscode.window.showErrorMessage('Harbormaster: No workspace folder open.');
      return;
    }

    await this.ensureInitialized();
    const settings = getExtensionSettings();
    const configUri = vscode.Uri.joinPath(folder.uri, settings.configFile);
    const config = await this.readConfig(configUri);
    const currentTags = dedupeTags(Array.isArray(config.tags) ? config.tags : []);
    if (currentTags.length === 0) {
      void vscode.window.showInformationMessage('Harbormaster: Project has no tags.');
      return;
    }

    const pick = await vscode.window.showQuickPick(currentTags, {
      placeHolder: 'Select a tag to remove from this project',
    });
    if (!pick) {
      return;
    }

    const remaining = currentTags.filter((t) => t !== pick);
    config.tags = remaining;
    await this.writeConfig(configUri, config, settings.configFile);
    this.onDidChangeEmitter.fire();
    void vscode.window.showInformationMessage(`Harbormaster: removed tag "${pick}" from project.`);
  }

  async setWindowAccentColor(accent: string | undefined): Promise<void> {
    const folder = getPrimaryWorkspaceFolder();
    if (!folder) {
      void vscode.window.showErrorMessage('Harbormaster: No workspace folder open.');
      return;
    }

    await this.ensureInitialized();
    const settings = getExtensionSettings();
    const configUri = vscode.Uri.joinPath(folder.uri, settings.configFile);
    const config = await this.readConfig(configUri);
    if (accent) {
      config[DEFAULT_WINDOW_ACCENT_KEY] = accent;
    } else {
      delete config[DEFAULT_WINDOW_ACCENT_KEY];
    }
    await this.writeConfig(configUri, config, settings.configFile);
    await this.applyWindowAccentConfig(folder, config);
    this.onDidChangeEmitter.fire();
  }

  async setWindowAccentSectionInherit(sectionId: string, inherit: boolean): Promise<void> {
    if (!isAccentSectionId(sectionId)) {
      return;
    }
    const folder = getPrimaryWorkspaceFolder();
    if (!folder) {
      void vscode.window.showErrorMessage('Harbormaster: No workspace folder open.');
      return;
    }
    await this.ensureInitialized();
    const settings = getExtensionSettings();
    const configUri = vscode.Uri.joinPath(folder.uri, settings.configFile);
    const config = await this.readConfig(configUri);
    const inheritMap = normalizeAccentSectionInherit(config[DEFAULT_WINDOW_ACCENT_SECTIONS_INHERIT_KEY]);
    if (inherit) {
      inheritMap[sectionId] = true;
    } else {
      delete inheritMap[sectionId];
    }
    if (Object.keys(inheritMap).length > 0) {
      config[DEFAULT_WINDOW_ACCENT_SECTIONS_INHERIT_KEY] = inheritMap;
    } else {
      delete config[DEFAULT_WINDOW_ACCENT_SECTIONS_INHERIT_KEY];
    }
    await this.writeConfig(configUri, config, settings.configFile);
    await this.applyWindowAccentConfig(folder, config);
    this.onDidChangeEmitter.fire();
  }

  async setWindowAccentSection(sectionId: string, accent: string | undefined): Promise<void> {
    if (!isAccentSectionId(sectionId)) {
      return;
    }
    const folder = getPrimaryWorkspaceFolder();
    if (!folder) {
      void vscode.window.showErrorMessage('Harbormaster: No workspace folder open.');
      return;
    }

    await this.ensureInitialized();
    const settings = getExtensionSettings();
    const configUri = vscode.Uri.joinPath(folder.uri, settings.configFile);
    const config = await this.readConfig(configUri);
    const inheritMap = normalizeAccentSectionInherit(config[DEFAULT_WINDOW_ACCENT_SECTIONS_INHERIT_KEY]);
    const sections = normalizeAccentSections(config[DEFAULT_WINDOW_ACCENT_SECTIONS_KEY]);
    if (accent) {
      sections[sectionId] = accent;
      delete inheritMap[sectionId];
    } else {
      delete sections[sectionId];
    }
    if (Object.keys(sections).length > 0) {
      config[DEFAULT_WINDOW_ACCENT_SECTIONS_KEY] = sections;
    } else {
      delete config[DEFAULT_WINDOW_ACCENT_SECTIONS_KEY];
    }
    if (Object.keys(inheritMap).length > 0) {
      config[DEFAULT_WINDOW_ACCENT_SECTIONS_INHERIT_KEY] = inheritMap;
    } else {
      delete config[DEFAULT_WINDOW_ACCENT_SECTIONS_INHERIT_KEY];
    }
    await this.writeConfig(configUri, config, settings.configFile);
    await this.applyWindowAccentConfig(folder, config);
    this.onDidChangeEmitter.fire();
  }

  async setWindowAccentGroupInherit(groupId: string, inherit: boolean): Promise<void> {
    if (!isAccentGroupId(groupId)) {
      return;
    }
    const folder = getPrimaryWorkspaceFolder();
    if (!folder) {
      void vscode.window.showErrorMessage('Harbormaster: No workspace folder open.');
      return;
    }
    await this.ensureInitialized();
    const settings = getExtensionSettings();
    const configUri = vscode.Uri.joinPath(folder.uri, settings.configFile);
    const config = await this.readConfig(configUri);
    const inheritMap = normalizeAccentGroupInherit(config[DEFAULT_WINDOW_ACCENT_GROUPS_INHERIT_KEY]);
    if (inherit) {
      inheritMap[groupId] = true;
    } else {
      delete inheritMap[groupId];
    }
    if (Object.keys(inheritMap).length > 0) {
      config[DEFAULT_WINDOW_ACCENT_GROUPS_INHERIT_KEY] = inheritMap;
    } else {
      delete config[DEFAULT_WINDOW_ACCENT_GROUPS_INHERIT_KEY];
    }
    await this.writeConfig(configUri, config, settings.configFile);
    await this.applyWindowAccentConfig(folder, config);
    this.onDidChangeEmitter.fire();
  }

  async setWindowAccentGroup(groupId: string, accent: string | undefined): Promise<void> {
    if (!isAccentGroupId(groupId)) {
      return;
    }
    const folder = getPrimaryWorkspaceFolder();
    if (!folder) {
      void vscode.window.showErrorMessage('Harbormaster: No workspace folder open.');
      return;
    }

    await this.ensureInitialized();
    const settings = getExtensionSettings();
    const configUri = vscode.Uri.joinPath(folder.uri, settings.configFile);
    const config = await this.readConfig(configUri);
    const inheritMap = normalizeAccentGroupInherit(config[DEFAULT_WINDOW_ACCENT_GROUPS_INHERIT_KEY]);
    const groups = normalizeAccentGroups(config[DEFAULT_WINDOW_ACCENT_GROUPS_KEY]);
    if (accent) {
      groups[groupId] = accent;
      delete inheritMap[groupId];
    } else {
      delete groups[groupId];
    }
    if (Object.keys(groups).length > 0) {
      config[DEFAULT_WINDOW_ACCENT_GROUPS_KEY] = groups;
    } else {
      delete config[DEFAULT_WINDOW_ACCENT_GROUPS_KEY];
    }
    if (Object.keys(inheritMap).length > 0) {
      config[DEFAULT_WINDOW_ACCENT_GROUPS_INHERIT_KEY] = inheritMap;
    } else {
      delete config[DEFAULT_WINDOW_ACCENT_GROUPS_INHERIT_KEY];
    }
    await this.writeConfig(configUri, config, settings.configFile);
    await this.applyWindowAccentConfig(folder, config);
    this.onDidChangeEmitter.fire();
  }

  async setWindowAccentOverride(key: string, accent: string | undefined): Promise<void> {
    if (!isAccentColorKey(key)) {
      return;
    }
    const folder = getPrimaryWorkspaceFolder();
    if (!folder) {
      void vscode.window.showErrorMessage('Harbormaster: No workspace folder open.');
      return;
    }
    await this.ensureInitialized();
    const settings = getExtensionSettings();
    const configUri = vscode.Uri.joinPath(folder.uri, settings.configFile);
    const config = await this.readConfig(configUri);
    const overrides = normalizeAccentOverrides(config[DEFAULT_WINDOW_ACCENT_OVERRIDES_KEY]);
    if (accent) {
      overrides[key] = accent;
    } else {
      delete overrides[key];
    }
    if (Object.keys(overrides).length > 0) {
      config[DEFAULT_WINDOW_ACCENT_OVERRIDES_KEY] = overrides;
    } else {
      delete config[DEFAULT_WINDOW_ACCENT_OVERRIDES_KEY];
    }
    await this.writeConfig(configUri, config, settings.configFile);
    await this.applyWindowAccentConfig(folder, config);
    this.onDidChangeEmitter.fire();
  }

  async setWindowAccentHighlightBoost(value: number | undefined, preview = false): Promise<void> {
    const folder = getPrimaryWorkspaceFolder();
    if (!folder) {
      void vscode.window.showErrorMessage('Harbormaster: No workspace folder open.');
      return;
    }
    await this.ensureInitialized();
    const settings = getExtensionSettings();
    const configUri = vscode.Uri.joinPath(folder.uri, settings.configFile);
    const config = await this.readConfig(configUri);
    const normalized = normalizeAccentHighlightBoost(value);
    if (!preview) {
      if (typeof normalized === 'number') {
        config[DEFAULT_WINDOW_ACCENT_HIGHLIGHT_BOOST_KEY] = normalized;
      } else {
        delete config[DEFAULT_WINDOW_ACCENT_HIGHLIGHT_BOOST_KEY];
      }
      await this.writeConfig(configUri, config, settings.configFile);
      await this.applyWindowAccentConfig(folder, config);
      return;
    }
    await this.applyWindowAccentConfig(folder, {
      ...config,
      ...(typeof normalized === 'number'
        ? { [DEFAULT_WINDOW_ACCENT_HIGHLIGHT_BOOST_KEY]: normalized }
        : {}),
    });
    this.onDidChangeEmitter.fire();
  }

  async clearWindowAccentLayers(): Promise<void> {
    const folder = getPrimaryWorkspaceFolder();
    if (!folder) {
      void vscode.window.showErrorMessage('Harbormaster: No workspace folder open.');
      return;
    }
    await this.ensureInitialized();
    const settings = getExtensionSettings();
    const configUri = vscode.Uri.joinPath(folder.uri, settings.configFile);
    const config = await this.readConfig(configUri);
    this.setColorSettingsBackup(config);
    delete config[DEFAULT_WINDOW_ACCENT_SECTIONS_KEY];
    delete config[DEFAULT_WINDOW_ACCENT_GROUPS_KEY];
    delete config[DEFAULT_WINDOW_ACCENT_SECTIONS_INHERIT_KEY];
    delete config[DEFAULT_WINDOW_ACCENT_GROUPS_INHERIT_KEY];
    delete config[DEFAULT_WINDOW_ACCENT_OVERRIDES_KEY];
    await this.writeConfig(configUri, config, settings.configFile);
    await this.applyWindowAccentConfig(folder, config);
    this.onDidChangeEmitter.fire();
  }

  async previewWindowAccentGroup(groupId: string, accent: string | undefined): Promise<void> {
    if (!isAccentGroupId(groupId)) {
      return;
    }
    const folder = getPrimaryWorkspaceFolder();
    if (!folder) {
      return;
    }
    this.previewActive = Boolean(accent);
    const workbenchConfig = vscode.workspace.getConfiguration('workbench', folder.uri);
    const existing = workbenchConfig.get<Record<string, unknown>>('colorCustomizations');
    const current = existing && typeof existing === 'object' ? { ...existing } : {};
    if (accent) {
      const previewMap = buildAccentColorMapForGroup(groupId, accent, {});
      const next = { ...current, ...previewMap };
      await workbenchConfig.update('colorCustomizations', next, vscode.ConfigurationTarget.Workspace);
      return;
    }
    const settings = getExtensionSettings();
    const configUri = vscode.Uri.joinPath(folder.uri, settings.configFile);
    const config = await this.readConfig(configUri);
    await this.applyWindowAccentConfig(folder, config);
    this.previewActive = false;
  }

  async previewWindowAccentSection(sectionId: string, accent: string | undefined): Promise<void> {
    if (!isAccentSectionId(sectionId)) {
      return;
    }
    const folder = getPrimaryWorkspaceFolder();
    if (!folder) {
      return;
    }
    this.previewActive = Boolean(accent);
    const workbenchConfig = vscode.workspace.getConfiguration('workbench', folder.uri);
    const existing = workbenchConfig.get<Record<string, unknown>>('colorCustomizations');
    const current = existing && typeof existing === 'object' ? { ...existing } : {};
    if (accent) {
      const previewMap = buildAccentColorMapForSection(sectionId, accent, {});
      const next = { ...current, ...previewMap };
      await workbenchConfig.update('colorCustomizations', next, vscode.ConfigurationTarget.Workspace);
      return;
    }
    const settings = getExtensionSettings();
    const configUri = vscode.Uri.joinPath(folder.uri, settings.configFile);
    const config = await this.readConfig(configUri);
    await this.applyWindowAccentConfig(folder, config);
    this.previewActive = false;
  }

  isPreviewActive(): boolean {
    return this.previewActive;
  }

  async recordWindowAccentHistory(groupId: string, accent: string): Promise<void> {
    const folder = getPrimaryWorkspaceFolder();
    if (!folder) {
      return;
    }
    await this.ensureInitialized();
    const settings = getExtensionSettings();
    const configUri = vscode.Uri.joinPath(folder.uri, settings.configFile);
    if (!(await fileExists(configUri))) {
      return;
    }
    const config = await this.readConfig(configUri);
    const history = normalizeAccentHistory(config[DEFAULT_WINDOW_ACCENT_HISTORY_KEY]);
    const key = groupId;
    const existing = history[key] ?? [];
    const normalized = normalizeAccentColor(accent);
    if (!normalized) {
      return;
    }
    const next = [normalized, ...existing.filter((value) => value !== normalized)].slice(0, 3);
    history[key] = next;
    config[DEFAULT_WINDOW_ACCENT_HISTORY_KEY] = history;
    await this.writeConfig(configUri, config, settings.configFile);
    this.onDidChangeEmitter.fire();
  }

  async resetWindowAccentColor(): Promise<void> {
    const folder = getPrimaryWorkspaceFolder();
    if (!folder) {
      void vscode.window.showErrorMessage('Harbormaster: No workspace folder open.');
      return;
    }

    await this.ensureInitialized();
    const settings = getExtensionSettings();
    const configUri = vscode.Uri.joinPath(folder.uri, settings.configFile);
    if (await fileExists(configUri)) {
      const config = await this.readConfig(configUri);
      this.setColorSettingsBackup(config);
      delete config[DEFAULT_WINDOW_ACCENT_KEY];
      delete config[DEFAULT_WINDOW_ACCENT_SECTIONS_KEY];
      delete config[DEFAULT_WINDOW_ACCENT_GROUPS_KEY];
      delete config[DEFAULT_WINDOW_ACCENT_SECTIONS_INHERIT_KEY];
      delete config[DEFAULT_WINDOW_ACCENT_GROUPS_INHERIT_KEY];
      delete config[DEFAULT_WINDOW_ACCENT_OVERRIDES_KEY];
      delete config[DEFAULT_WINDOW_ACCENT_HISTORY_KEY];
      await this.writeConfig(configUri, config, settings.configFile);
      await this.applyWindowAccentConfig(folder, config);
    }

    const workbenchConfig = vscode.workspace.getConfiguration('workbench', folder.uri);
    const existing = workbenchConfig.get<Record<string, unknown>>('colorCustomizations');
    const current = existing && typeof existing === 'object' ? { ...existing } : {};
    let mutated = false;
    for (const key of ACCENT_COLOR_KEYS) {
      if (key in current) {
        delete current[key];
        mutated = true;
      }
    }
    if (mutated) {
      await workbenchConfig.update('colorCustomizations', current, vscode.ConfigurationTarget.Workspace);
    }
    this.onDidChangeEmitter.fire();
  }

  async swapWindowAccentBackup(): Promise<boolean> {
    const folder = getPrimaryWorkspaceFolder();
    if (!folder) {
      void vscode.window.showErrorMessage('Harbormaster: No workspace folder open.');
      return false;
    }

    await this.ensureInitialized();
    const settings = getExtensionSettings();
    const configUri = vscode.Uri.joinPath(folder.uri, settings.configFile);
    const config = await this.readConfig(configUri);
    const backup = config[DEFAULT_WINDOW_ACCENT_BACKUP_KEY];
    if (!backup || typeof backup !== 'object' || Array.isArray(backup)) {
      return false;
    }

    const current = this.buildAccentPresetData(config);
    this.applyAccentPresetToConfig(config, backup as AccentPresetData);
    delete config[DEFAULT_WINDOW_ACCENT_BACKUP_KEY];
    config[DEFAULT_WINDOW_ACCENT_BACKUP_KEY] = current;
    await this.writeConfig(configUri, config, settings.configFile);
    await this.applyWindowAccentConfig(folder, config);
    this.onDidChangeEmitter.fire();
    return true;
  }

  private async applyWindowAccentConfig(folder: vscode.WorkspaceFolder, config: Record<string, unknown>): Promise<void> {
    const base = normalizeAccentColor(coerceString(config?.[DEFAULT_WINDOW_ACCENT_KEY]));
    const sections = normalizeAccentSections(config?.[DEFAULT_WINDOW_ACCENT_SECTIONS_KEY]);
    const groups = normalizeAccentGroups(config?.[DEFAULT_WINDOW_ACCENT_GROUPS_KEY]);
    const sectionInherit = normalizeAccentSectionInherit(config?.[DEFAULT_WINDOW_ACCENT_SECTIONS_INHERIT_KEY]);
    const groupInherit = normalizeAccentGroupInherit(config?.[DEFAULT_WINDOW_ACCENT_GROUPS_INHERIT_KEY]);
    const overrides = normalizeAccentOverrides(config?.[DEFAULT_WINDOW_ACCENT_OVERRIDES_KEY]);
    const highlightBoost = normalizeAccentHighlightBoost(config?.[DEFAULT_WINDOW_ACCENT_HIGHLIGHT_BOOST_KEY]);
    await applyWindowAccentToWorkspace(
      folder,
      base,
      sections,
      groups,
      sectionInherit,
      groupInherit,
      overrides,
      highlightBoost
    );
  }

  async rebuildHarbormasterState(): Promise<void> {
    const folder = getPrimaryWorkspaceFolder();
    if (!folder) {
      void vscode.window.showErrorMessage('Harbormaster: No workspace folder open.');
      return;
    }

    await this.ensureInitialized();
    const settings = getExtensionSettings();
    const created: string[] = [];
    const updated: string[] = [];
    const warnings: string[] = [];
    const deleted: string[] = [];

    const legacyResult = await this.mergeLegacyMetadata(folder, settings);
    created.push(...legacyResult.created);
    updated.push(...legacyResult.updated);
    warnings.push(...legacyResult.warnings);
    deleted.push(...legacyResult.deleted);

    const scaffolded = await this.scaffoldMissingFiles(folder, settings);
    created.push(...scaffolded.created);
    warnings.push(...scaffolded.warnings);

    await this.migrateLegacyContext(folder);
    await this.ensureAgentsDirectiveNotice(folder);
    await this.refreshHealth();
    this.onDidChangeEmitter.fire();

    if (created.length === 0 && updated.length === 0 && warnings.length === 0 && deleted.length === 0) {
      void vscode.window.showInformationMessage('Harbormaster: project state already complete.');
      return;
    }

    const details = [
      created.length ? `Created: ${created.join(', ')}` : undefined,
      updated.length ? `Updated: ${updated.join(', ')}` : undefined,
      deleted.length ? `Removed legacy: ${deleted.join(', ')}` : undefined,
      warnings.length ? `Warnings: ${warnings.join('; ')}` : undefined,
    ]
      .filter(Boolean)
      .join(' | ');
    void vscode.window.showInformationMessage(`Harbormaster: rebuild complete. ${details}`);
  }

  async scaffoldProjectState(options: { silent?: boolean } = {}): Promise<void> {
    const { silent = false } = options;
    const folder = getPrimaryWorkspaceFolder();
    if (!folder) {
      if (!silent) {
        void vscode.window.showErrorMessage('Harbormaster: No workspace folder open.');
      }
      return;
    }

    await this.ensureInitialized();
    const settings = getExtensionSettings();
    const scaffolded = await this.scaffoldMissingFiles(folder, settings);
    await this.ensureAgentsDirectiveNotice(folder);
    await this.refreshHealth();
    this.onDidChangeEmitter.fire();

    if (silent) {
      return;
    }
    if (scaffolded.created.length === 0 && scaffolded.warnings.length === 0) {
      void vscode.window.showInformationMessage('Harbormaster: project state already complete.');
      return;
    }
    const details = [
      scaffolded.created.length ? `Created: ${scaffolded.created.join(', ')}` : undefined,
      scaffolded.warnings.length ? `Warnings: ${scaffolded.warnings.join('; ')}` : undefined,
    ]
      .filter(Boolean)
      .join(' | ');
    void vscode.window.showInformationMessage(`Harbormaster: project state scaffolding complete. ${details}`);
  }

  async scaffoldProjectStateForFolder(targetUri: vscode.Uri, settings: ExtensionSettings): Promise<void> {
    const folder: vscode.WorkspaceFolder = {
      uri: targetUri,
      name: path.basename(targetUri.fsPath),
      index: 0,
    };
    const scaffolded = await this.scaffoldMissingFiles(folder, settings);
    await this.ensureAgentsDirectiveNotice(folder);
    await this.refreshHealth();
    this.onDidChangeEmitter.fire();
    if (scaffolded.created.length > 0 || scaffolded.warnings.length > 0) {
      const details = [
        scaffolded.created.length ? `Created: ${scaffolded.created.join(', ')}` : undefined,
        scaffolded.warnings.length ? `Warnings: ${scaffolded.warnings.join('; ')}` : undefined,
      ]
        .filter(Boolean)
        .join(' | ');
      void vscode.window.showInformationMessage(`Harbormaster: project state scaffolding complete. ${details}`);
    }
  }

  async addProjectToCatalog(): Promise<void> {
    const folder = getPrimaryWorkspaceFolder();
    if (!folder) {
      void vscode.window.showErrorMessage('Harbormaster: No workspace folder open.');
      return;
    }
    await this.ensureInitialized();
    const settings = getExtensionSettings();
    await this.upsertCatalogEntry(folder, settings);
  }

  async openProjectFromCatalog(): Promise<void> {
    const folder = getPrimaryWorkspaceFolder();
    const settings = getExtensionSettings();
    if (folder) {
      await this.ensureInitialized();
    } else {
      await this.ensureCatalogFile(settings);
    }
    const catalogUri = this.getCatalogUri(settings);
    const catalog = await this.readCatalog(catalogUri);
    if (catalog.length === 0) {
      void vscode.window.showInformationMessage('Harbormaster: No catalog entries. Add the current project first.');
      return;
    }

    const quickPick = vscode.window.createQuickPick<CatalogQuickPickItem>();
    quickPick.matchOnDescription = true;
    quickPick.matchOnDetail = true;
    quickPick.title = 'Open Harbormaster project';
    quickPick.placeholder = 'Enter to open here. Use item buttons to pick window target.';

    const openHereItemButton: vscode.QuickInputButton = {
      iconPath: new vscode.ThemeIcon('window'),
      tooltip: 'Open here',
    };
    const openNewItemButton: vscode.QuickInputButton = {
      iconPath: new vscode.ThemeIcon('open-preview'),
      tooltip: 'Open in new window',
    };

    const sortOptions: { label: string; sort: string }[] = [
      { label: 'Last edited (desc)', sort: 'lastEdited' },
      { label: 'Last opened (desc)', sort: 'lastOpened' },
      { label: 'Created (desc)', sort: 'created' },
      { label: 'Name (A → Z)', sort: 'name' },
      { label: 'Tags (A → Z)', sort: 'tags' },
    ];

    let currentSort = 'lastEdited';

    const buildItems = (sortKey: string): CatalogQuickPickItem[] => {
      const sortedCatalog = this.sortCatalog(catalog, sortKey);
      const sortItems: CatalogQuickPickItem[] = sortOptions.map((o) => ({
        label: `${o.sort === sortKey ? '$(check) ' : ''}${o.label}`,
        description: '',
        isSortOption: true,
        sortKey: o.sort,
      }));

      const projectItems: CatalogQuickPickItem[] = sortedCatalog.map((p) => ({
        label: p.name,
        description: p.tags && p.tags.length ? `Tags: ${p.tags.join(', ')}` : 'No tags',
        detail: `Path: ${p.path} · Created: ${formatIsoDate(p.createdAt)}${
          p.lastEditedAt ? ` · Edited: ${formatIsoDate(p.lastEditedAt)}` : ''
        }${p.lastOpenedAt ? ` · Opened: ${formatIsoDate(p.lastOpenedAt)}` : ''}`,
        project: p,
        buttons: [openHereItemButton, openNewItemButton],
      }));

      return [
        { label: 'Sort by', kind: vscode.QuickPickItemKind.Separator } as CatalogQuickPickItem,
        ...sortItems,
        { label: 'Projects', kind: vscode.QuickPickItemKind.Separator } as CatalogQuickPickItem,
        ...projectItems,
      ];
    };

    quickPick.items = buildItems(currentSort);

    quickPick.onDidTriggerItemButton(async (event) => {
      if (event.item.isSortOption || !event.item.project) {
        return;
      }
      if (event.button === openHereItemButton) {
        await this.openCatalogProject(event.item.project, catalogUri, catalog, false);
        quickPick.hide();
        return;
      }
      if (event.button === openNewItemButton) {
        await this.openCatalogProject(event.item.project, catalogUri, catalog, true);
        quickPick.hide();
      }
    });

    quickPick.onDidAccept(async () => {
      const selection = quickPick.selectedItems[0];
      if (!selection) {
        quickPick.hide();
        return;
      }
      if (selection.isSortOption && selection.sortKey) {
        currentSort = selection.sortKey;
        quickPick.items = buildItems(currentSort);
        return;
      }
      if (!selection.project) {
        return;
      }
      await this.openCatalogProject(selection.project, catalogUri, catalog, false);
      quickPick.hide();
    });

    quickPick.show();
  }

  private sortCatalog(catalog: Catalog, sort: string): Catalog {
    const clone = [...catalog];
    switch (sort) {
      case 'name':
        clone.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'tags':
        clone.sort((a, b) => (a.tags ?? []).join(',').localeCompare((b.tags ?? []).join(',')));
        break;
      case 'lastEdited':
        clone.sort((a, b) => (b.lastEditedAt ?? b.createdAt ?? '').localeCompare(a.lastEditedAt ?? a.createdAt ?? ''));
        break;
      case 'created':
        clone.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        break;
      case 'lastOpened':
      default:
        clone.sort((a, b) => (b.lastOpenedAt ?? b.createdAt ?? '').localeCompare(a.lastOpenedAt ?? a.createdAt ?? ''));
        break;
    }
    return clone;
  }

  private async openCatalogProject(
    project: CatalogProject,
    catalogUri: vscode.Uri,
    catalog: Catalog,
    forceNewWindow: boolean
  ): Promise<void> {
    let targetPath = project.path;
    let catalogCopy = [...catalog];
    const settings = getExtensionSettings();

    const metadataExists = async (folderPath: string): Promise<boolean> => {
      const folderUri = vscode.Uri.file(folderPath);
      const metaUri = vscode.Uri.joinPath(folderUri, settings.configFile);
      if (await fileExists(metaUri)) {
        return true;
      }
      const legacyMetaUri = vscode.Uri.joinPath(folderUri, LEGACY_META_DIR, 'project.json');
      if (await fileExists(legacyMetaUri)) {
        return true;
      }
      const legacyUri = vscode.Uri.joinPath(folderUri, LEGACY_CONFIG_FILE);
      return fileExists(legacyUri);
    };

    const pathExists = await fileExists(vscode.Uri.file(project.path));
    const metaExists = pathExists ? await metadataExists(project.path) : false;
    if (!pathExists || !metaExists) {
      const actions: vscode.MessageItem[] = [];
      actions.push({ title: 'Select folder with metadata' });
      const currentFolder = getPrimaryWorkspaceFolder();
      if (currentFolder) {
        actions.push({ title: 'Use current workspace' });
      }
      actions.push({ title: 'Remove from catalog' });
      const choice = await vscode.window.showWarningMessage<vscode.MessageItem>(
        `Project ${!pathExists ? 'path' : 'metadata'} not found:\n${project.path}`,
        { modal: true },
        ...actions
      );
      if (!choice) {
        return;
      }
      if (choice.title === 'Remove from catalog') {
        catalogCopy = catalog.filter((p) => p.id !== project.id);
        await this.writeCatalog(catalogCopy, catalogUri);
        return;
      }
      if (choice.title === 'Use current workspace') {
        const current = getPrimaryWorkspaceFolder();
        if (!current) {
          return;
        }
        targetPath = current.uri.fsPath;
      } else if (choice.title === 'Select folder with metadata') {
        const picked = await vscode.window.showOpenDialog({
          canSelectFiles: false,
          canSelectFolders: true,
          canSelectMany: false,
          openLabel: 'Use folder',
        });
        if (!picked || picked.length === 0) {
          return;
        }
        targetPath = picked[0].fsPath;
      }
      const hasMeta = await metadataExists(targetPath);
      if (!hasMeta) {
        void vscode.window.showWarningMessage(
          `Harbormaster metadata (${settings.configFile}) not found under:\n${targetPath}\nCatalog entry unchanged.`
        );
        return;
      }
      const now = new Date().toISOString();
      catalogCopy = catalog.map((p) =>
        p.id === project.id ? { ...p, path: targetPath, lastEditedAt: now } : p
      );
      await this.writeCatalog(catalogCopy, catalogUri);
    }

    await vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(targetPath), {
      forceNewWindow,
    });
    const now = new Date().toISOString();
    const updated = catalogCopy.map((p) => (p.id === project.id ? { ...p, lastOpenedAt: now } : p));
    await this.writeCatalog(updated, catalogUri);
  }

  async catalogExists(): Promise<boolean> {
    const settings = getExtensionSettings();
    const catalogUri = this.getCatalogUri(settings);
    return fileExists(catalogUri);
  }

  async isProjectInCatalog(folder: vscode.WorkspaceFolder, settings?: ExtensionSettings): Promise<boolean> {
    const resolvedSettings = settings ?? getExtensionSettings();
    const catalogUri = this.getCatalogUri(resolvedSettings);
    if (!(await fileExists(catalogUri))) {
      return false;
    }
    const catalog = await this.readCatalog(catalogUri);
    return catalog.some((p) => p.path === folder.uri.fsPath);
  }

  private async mergeLegacyMetadata(
    folder: vscode.WorkspaceFolder,
    settings: ExtensionSettings
  ): Promise<{ created: string[]; updated: string[]; warnings: string[]; deleted: string[] }> {
    const result = { created: [] as string[], updated: [] as string[], warnings: [] as string[], deleted: [] as string[] };
    if (settings.configFile !== DEFAULT_CONFIG_FILE || settings.tagsFile !== DEFAULT_TAGS_FILE) {
      return result;
    }

    const configUri = vscode.Uri.joinPath(folder.uri, settings.configFile);
    const legacyMetaConfigUri = vscode.Uri.joinPath(folder.uri, LEGACY_META_DIR, 'project.json');
    const legacyConfigUri = vscode.Uri.joinPath(folder.uri, LEGACY_CONFIG_FILE);
    const legacyTagsUri = vscode.Uri.joinPath(folder.uri, LEGACY_META_DIR, 'tags.json');
    const legacyWorkspaceTagsUri = vscode.Uri.joinPath(folder.uri, settings.tagsFile);

    const newConfigExists = await fileExists(configUri);
    const newConfigCorrupt = newConfigExists ? await this.isJsonCorrupt(configUri) : false;

    const newConfig = newConfigExists && !newConfigCorrupt ? await this.readConfig(configUri) : undefined;
    const newTags = await this.readTagsFile(settings);

    const legacyMetaConfigExists = await fileExists(legacyMetaConfigUri);
    const legacyConfigExists = await fileExists(legacyConfigUri);
    const legacyTagsExists = await fileExists(legacyTagsUri);
    const legacyWorkspaceTagsExists = await fileExists(legacyWorkspaceTagsUri);

    const legacyMetaConfigCorrupt = legacyMetaConfigExists ? await this.isJsonCorrupt(legacyMetaConfigUri) : false;
    const legacyConfigCorrupt = legacyConfigExists ? await this.isJsonCorrupt(legacyConfigUri) : false;
    const legacyTagsCorrupt = legacyTagsExists ? await this.isJsonCorrupt(legacyTagsUri) : false;
    const legacyWorkspaceTagsCorrupt = legacyWorkspaceTagsExists ? await this.isJsonCorrupt(legacyWorkspaceTagsUri) : false;

    if (newConfigCorrupt) {
      result.warnings.push(`${settings.configFile} is not valid JSON`);
    }
    if (legacyMetaConfigCorrupt) {
      result.warnings.push(`${LEGACY_META_DIR}/project.json is not valid JSON`);
    }
    if (legacyConfigCorrupt) {
      result.warnings.push(`${LEGACY_CONFIG_FILE} is not valid JSON`);
    }
    if (legacyTagsCorrupt) {
      result.warnings.push(`${LEGACY_META_DIR}/tags.json is not valid JSON`);
    }
    if (legacyWorkspaceTagsCorrupt) {
      result.warnings.push(`${settings.tagsFile} is not valid JSON`);
    }

    const legacyConfig =
      legacyMetaConfigExists && !legacyMetaConfigCorrupt
        ? await this.readConfig(legacyMetaConfigUri)
        : legacyConfigExists && !legacyConfigCorrupt
          ? await this.readConfig(legacyConfigUri)
          : undefined;
    const legacyTags = legacyTagsExists && !legacyTagsCorrupt ? await this.readTagsFile(settings, legacyTagsUri) : undefined;
    const legacyWorkspaceTags =
      legacyWorkspaceTagsExists && !legacyWorkspaceTagsCorrupt
        ? await this.readTagsFile(settings, legacyWorkspaceTagsUri)
        : undefined;

    const shouldWriteConfig = legacyConfig !== undefined || !newConfigExists;
    if (shouldWriteConfig) {
      const mergedConfig = this.mergeConfigPayload(folder, newConfig, legacyConfig);
      if (!newConfigExists || newConfigCorrupt) {
        result.created.push(settings.configFile);
      } else {
        result.updated.push(settings.configFile);
      }
      await this.writeConfig(configUri, mergedConfig, settings.configFile);
    }

    const mergedTags = dedupeTags([...(newTags ?? []), ...(legacyTags ?? []), ...(legacyWorkspaceTags ?? [])]);
    if (mergedTags.length > 0) {
      await this.writeTagsFile(settings, mergedTags);
      result.updated.push(`global:${settings.tagsFile}`);
    }

    if (legacyMetaConfigExists && !legacyMetaConfigCorrupt) {
      await vscode.workspace.fs.delete(legacyMetaConfigUri);
      result.deleted.push(`${LEGACY_META_DIR}/project.json`);
    }
    if (legacyConfigExists && !legacyConfigCorrupt) {
      await vscode.workspace.fs.delete(legacyConfigUri);
      result.deleted.push(LEGACY_CONFIG_FILE);
    }
    if (legacyTagsExists && !legacyTagsCorrupt) {
      await this.moveLegacyTagsToBackup(legacyTagsUri);
      result.deleted.push(`${LEGACY_META_DIR}/tags.json (moved to .bak)`);
    }
    if (legacyWorkspaceTagsExists && !legacyWorkspaceTagsCorrupt) {
      await this.moveLegacyTagsToBackup(legacyWorkspaceTagsUri);
      result.deleted.push(`${settings.tagsFile} (moved to .bak)`);
    }

    return result;
  }

  private async migrateLegacyContext(folder: vscode.WorkspaceFolder): Promise<void> {
    const legacyContextUri = vscode.Uri.joinPath(folder.uri, LEGACY_CONTEXT_DIR);
    const newContextUri = vscode.Uri.joinPath(folder.uri, DEFAULT_CONTEXT_DIR);
    await this.copyDirectoryContentsIfMissing(legacyContextUri, newContextUri);
  }

  private async createDefaultConfig(folder: vscode.WorkspaceFolder, settings: ExtensionSettings): Promise<void> {
    const payload = this.getDefaultConfigPayload(folder);
    const targetUri = vscode.Uri.joinPath(folder.uri, settings.configFile);
    await this.writeConfig(targetUri, payload, settings.configFile);
  }

  private getDefaultConfigPayload(folder: vscode.WorkspaceFolder): Record<string, any> {
    return {
      project_name: folder.name,
      project_version: '',
      version_major: 0,
      version_minor: 0,
      version_patch: 0,
      version_prerelease: '',
      tags: [],
      version_scheme_note:
        'version = <major>.<minor>.<patch>-<prerelease>; prerelease is optional.',
    };
  }

  private mergeConfigPayload(
    folder: vscode.WorkspaceFolder,
    newConfig?: Record<string, any>,
    legacyConfig?: Record<string, any>
  ): Record<string, any> {
    const base = this.getDefaultConfigPayload(folder);
    const merged = {
      ...base,
      ...(newConfig ?? {}),
      ...(legacyConfig ?? {}),
    };
    const legacyTags = Array.isArray(legacyConfig?.tags) ? legacyConfig?.tags : undefined;
    const newTags = Array.isArray(newConfig?.tags) ? newConfig?.tags : undefined;
    if (legacyTags) {
      merged.tags = dedupeTags(legacyTags);
    } else if (newTags) {
      merged.tags = dedupeTags(newTags);
    } else {
      merged.tags = [];
    }
    return merged;
  }

  private async ensureAgentsDirectiveNotice(folder: vscode.WorkspaceFolder): Promise<void> {
    const agentsUri = await this.findAgentsFile(folder);
    if (!agentsUri) {
      return;
    }
    const content = await vscode.workspace.fs.readFile(agentsUri);
    const text = Buffer.from(content).toString('utf8');
    if (text.includes(AGENTS_DIRECTIVES_MARKER) || text.includes('DIRECTIVES.md')) {
      return;
    }
    const trimmed = text.endsWith('\n') ? text : `${text}\n`;
    const updated = `${trimmed}\n${AGENTS_DIRECTIVES_NOTICE}`;
    await vscode.workspace.fs.writeFile(agentsUri, Buffer.from(updated, 'utf8'));
  }

  private async findAgentsFile(folder: vscode.WorkspaceFolder): Promise<vscode.Uri | undefined> {
    for (const candidate of AGENTS_FILE_CANDIDATES) {
      const uri = vscode.Uri.joinPath(folder.uri, candidate);
      if (await fileExists(uri)) {
        return uri;
      }
    }
    return undefined;
  }

  private async scaffoldMissingFiles(
    folder: vscode.WorkspaceFolder,
    settings: ExtensionSettings
  ): Promise<{ created: string[]; warnings: string[] }> {
    const created: string[] = [];
    const warnings: string[] = [];

    const configUri = vscode.Uri.joinPath(folder.uri, settings.configFile);
    if (!(await fileExists(configUri))) {
      await this.createDefaultConfig(folder, settings);
      created.push(settings.configFile);
    } else if (await this.isJsonCorrupt(configUri)) {
      warnings.push(`${settings.configFile} is not valid JSON`);
    }

    const tagsCreated = await this.ensureGlobalTagsFile(settings);
    if (tagsCreated) {
      created.push(`global:${settings.tagsFile}`);
    }

    for (const name of REQUIRED_CONTEXT_FILES) {
      const relativePath = `${DEFAULT_CONTEXT_DIR}/${name}`;
      const uri = vscode.Uri.joinPath(folder.uri, relativePath);
      if (await fileExists(uri)) {
        continue;
      }
      const templateName = CONTEXT_TEMPLATE_FILES[name];
      const payload = templateName ? await this.readTemplateFile(templateName) : '';
      await this.ensureDirectory(uri);
      await vscode.workspace.fs.writeFile(uri, Buffer.from(payload, 'utf8'));
      created.push(relativePath);
    }

    const agentsUri = await this.findAgentsFile(folder);
    if (!agentsUri) {
      const target = vscode.Uri.joinPath(folder.uri, AGENTS_FILE_CANDIDATES[0]);
      const payload = await this.readTemplateFile(AGENTS_TEMPLATE_FILE);
      await this.ensureDirectory(target);
      await vscode.workspace.fs.writeFile(target, Buffer.from(payload, 'utf8'));
      created.push(AGENTS_FILE_CANDIDATES[0]);
    }

    return { created, warnings };
  }

  private async readTemplateFile(templateName: string): Promise<string> {
    const uri = vscode.Uri.joinPath(this.context.extensionUri, TEMPLATE_DIR, templateName);
    try {
      const content = await vscode.workspace.fs.readFile(uri);
      return Buffer.from(content).toString('utf8');
    } catch (error) {
      console.warn(`Harbormaster: unable to read template ${templateName}`, error);
      return '';
    }
  }

  private async refreshHealth(): Promise<void> {
    const folder = getPrimaryWorkspaceFolder();
    if (!folder) {
      if (this.diagnostics) {
        this.diagnostics.clear();
      }
      this.lastHealth = undefined;
      return;
    }

    const settings = getExtensionSettings();
    const isHarbormaster = await this.isHarbormasterRoot(folder);
    if (!isHarbormaster) {
      if (this.diagnostics) {
        this.diagnostics.clear();
      }
      this.lastHealth = { missing: [], corrupt: [], legacy: [] };
      return;
    }
    const snapshot = await this.computeHealthSnapshot(folder, settings);
    this.lastHealth = snapshot;
    if (this.diagnostics) {
      this.updateDiagnostics(folder, snapshot.missing, snapshot.corrupt, snapshot.legacy);
    }
  }

  async getHealthSnapshot(): Promise<HealthSnapshot | undefined> {
    const folder = getPrimaryWorkspaceFolder();
    if (!folder) {
      return undefined;
    }
    if (!this.lastHealth) {
      await this.refreshHealth();
    }
    return this.lastHealth;
  }

  async isHarbormasterProject(settings: ExtensionSettings): Promise<boolean> {
    const folder = getPrimaryWorkspaceFolder();
    if (!folder) {
      return false;
    }
    return this.isHarbormasterRoot(folder);
  }

  async projectConfigExists(settings: ExtensionSettings): Promise<boolean> {
    const folder = getPrimaryWorkspaceFolder();
    if (!folder) {
      return false;
    }
    return fileExists(vscode.Uri.joinPath(folder.uri, settings.configFile));
  }

  async tagsFileExists(settings: ExtensionSettings): Promise<boolean> {
    return fileExists(this.getTagsUri(settings));
  }

  async isCurrentProjectInCatalog(settings: ExtensionSettings): Promise<boolean> {
    const folder = getPrimaryWorkspaceFolder();
    if (!folder) {
      return false;
    }
    return this.isProjectInCatalog(folder, settings);
  }

  async addProjectToCatalogByUri(
    folderUri: vscode.Uri,
    settings: ExtensionSettings,
    options: { silent?: boolean } = {}
  ): Promise<void> {
    const { silent = false } = options;
    await this.ensureCatalogFile(settings);
    const configUri = vscode.Uri.joinPath(folderUri, settings.configFile);
    if (!(await fileExists(configUri))) {
      if (!silent) {
        void vscode.window.showWarningMessage(`Harbormaster: ${settings.configFile} not found; cannot add to catalog.`);
      }
      return;
    }
    const config = await this.readConfig(configUri);
    const name = coerceString(config?.project_name) ?? path.basename(folderUri.fsPath);
    const tags = dedupeTags(Array.isArray(config?.tags) ? config.tags : []);
    const now = new Date().toISOString();
    const catalogUri = this.getCatalogUri(settings);
    const catalog = await this.readCatalog(catalogUri);
    const existingIndex = catalog.findIndex((p) => p.path === folderUri.fsPath);
    if (existingIndex >= 0) {
      const existing = catalog[existingIndex];
      catalog[existingIndex] = { ...existing, name, tags, lastEditedAt: now };
    } else {
      catalog.push({
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        name,
        path: folderUri.fsPath,
        tags,
        createdAt: now,
      });
    }
    await this.ensureDirectory(catalogUri);
    await this.writeCatalog(catalog, catalogUri);
    if (!silent) {
      void vscode.window.showInformationMessage(`Harbormaster: saved "${name}" to catalog.`);
    }
  }

  private async computeHealthSnapshot(
    folder: vscode.WorkspaceFolder,
    settings: ExtensionSettings
  ): Promise<HealthSnapshot> {
    if (!(await this.isHarbormasterRoot(folder))) {
      return { missing: [], corrupt: [], legacy: [] };
    }
    const missing = await this.getMissingRequiredFiles(folder, settings);
    const corrupt = await this.getCorruptJsonFiles(folder, settings);
    const legacy = await this.getLegacyMetadataFiles(folder, settings);
    return { missing, corrupt, legacy };
  }

  private async isHarbormasterRoot(folder: vscode.WorkspaceFolder): Promise<boolean> {
    const marker = vscode.Uri.joinPath(folder.uri, DEFAULT_HARBORMASTER_DIR);
    return fileExists(marker);
  }

  private async getMissingRequiredFiles(
    folder: vscode.WorkspaceFolder,
    settings: ExtensionSettings
  ): Promise<string[]> {
    const missing: string[] = [];
    const requiredPaths = [settings.configFile, ...REQUIRED_CONTEXT_FILES.map((name) => `${DEFAULT_CONTEXT_DIR}/${name}`)];

    for (const relativePath of requiredPaths) {
      const uri = vscode.Uri.joinPath(folder.uri, relativePath);
      if (!(await fileExists(uri))) {
        missing.push(relativePath);
      }
    }

    if (!(await this.findAgentsFile(folder))) {
      missing.push('AGENTS.md or agents.md');
    }

    return missing;
  }

  private async getCorruptJsonFiles(
    folder: vscode.WorkspaceFolder,
    settings: ExtensionSettings
  ): Promise<string[]> {
    const corrupt: string[] = [];
    const candidates = [settings.configFile];
    for (const relativePath of candidates) {
      const uri = vscode.Uri.joinPath(folder.uri, relativePath);
      if (!(await fileExists(uri))) {
        continue;
      }
      if (await this.isJsonCorrupt(uri)) {
        corrupt.push(relativePath);
      }
    }
    return corrupt;
  }

  private async getLegacyMetadataFiles(
    folder: vscode.WorkspaceFolder,
    settings: ExtensionSettings
  ): Promise<string[]> {
    if (settings.configFile !== DEFAULT_CONFIG_FILE || settings.tagsFile !== DEFAULT_TAGS_FILE) {
      return [];
    }
    const legacyPaths = [
      `${LEGACY_META_DIR}/project.json`,
      `${LEGACY_META_DIR}/tags.json`,
      LEGACY_CONFIG_FILE,
      settings.tagsFile,
    ];
    const found: string[] = [];
    for (const relativePath of legacyPaths) {
      const uri = vscode.Uri.joinPath(folder.uri, relativePath);
      if (await fileExists(uri)) {
        found.push(relativePath);
      }
    }
    return found;
  }

  private async isJsonCorrupt(uri: vscode.Uri): Promise<boolean> {
    try {
      const content = await vscode.workspace.fs.readFile(uri);
      JSON.parse(Buffer.from(content).toString('utf8'));
      return false;
    } catch {
      return true;
    }
  }

  private updateDiagnostics(folder: vscode.WorkspaceFolder, missing: string[], corrupt: string[], legacy: string[]): void {
    if (!this.diagnostics) {
      return;
    }
    this.diagnostics.clear();
    for (const relativePath of missing) {
      const uri =
        relativePath === 'AGENTS.md or agents.md'
          ? vscode.Uri.joinPath(folder.uri, AGENTS_FILE_CANDIDATES[0])
          : vscode.Uri.joinPath(folder.uri, relativePath);
      const diagnostic = new vscode.Diagnostic(
        new vscode.Range(0, 0, 0, 1),
        `Missing Harbormaster file: ${relativePath}`,
        vscode.DiagnosticSeverity.Warning
      );
      this.diagnostics.set(uri, [diagnostic]);
    }
    for (const relativePath of corrupt) {
      const uri = vscode.Uri.joinPath(folder.uri, relativePath);
      const diagnostic = new vscode.Diagnostic(
        new vscode.Range(0, 0, 0, 1),
        `Harbormaster file is not valid JSON: ${relativePath}`,
        vscode.DiagnosticSeverity.Warning
      );
      this.diagnostics.set(uri, [diagnostic]);
    }
    for (const relativePath of legacy) {
      const uri = vscode.Uri.joinPath(folder.uri, relativePath);
      const diagnostic = new vscode.Diagnostic(
        new vscode.Range(0, 0, 0, 1),
        `Legacy Harbormaster metadata detected: ${relativePath}. Run Rebuild project state to migrate.`,
        vscode.DiagnosticSeverity.Warning
      );
      this.diagnostics.set(uri, [diagnostic]);
    }
  }

  private async copyFileIfMissing(sourceUri: vscode.Uri, targetUri: vscode.Uri): Promise<boolean> {
    if (await fileExists(targetUri)) {
      return false;
    }
    const content = await vscode.workspace.fs.readFile(sourceUri);
    await this.ensureDirectory(targetUri);
    await vscode.workspace.fs.writeFile(targetUri, content);
    return true;
  }

  private async copyDirectoryContentsIfMissing(sourceDir: vscode.Uri, targetDir: vscode.Uri): Promise<void> {
    if (!(await this.directoryExists(sourceDir))) {
      return;
    }
    await vscode.workspace.fs.createDirectory(targetDir);
    const entries = await vscode.workspace.fs.readDirectory(sourceDir);
    for (const [name, type] of entries) {
      const sourceUri = vscode.Uri.joinPath(sourceDir, name);
      const targetUri = vscode.Uri.joinPath(targetDir, name);
      if (type === vscode.FileType.Directory) {
        await this.copyDirectoryContentsIfMissing(sourceUri, targetUri);
        continue;
      }
      await this.copyFileIfMissing(sourceUri, targetUri);
    }
  }

  private async directoryExists(uri: vscode.Uri): Promise<boolean> {
    try {
      const stat = await vscode.workspace.fs.stat(uri);
      return stat.type === vscode.FileType.Directory;
    } catch {
      return false;
    }
  }

  private async ensureGlobalTagsFile(settings: ExtensionSettings): Promise<boolean> {
    const tagsUri = this.getTagsUri(settings);
    if (await fileExists(tagsUri)) {
      return false;
    }
    await this.ensureDirectory(tagsUri);
    await this.writeTagsFile(settings, []);
    return true;
  }

  private async migrateLegacyTagsToGlobal(folder: vscode.WorkspaceFolder, settings: ExtensionSettings): Promise<void> {
    const legacyTags: string[] = [];
    const workspaceTagsUri = vscode.Uri.joinPath(folder.uri, settings.tagsFile);
    const legacyMetaTagsUri = vscode.Uri.joinPath(folder.uri, LEGACY_META_DIR, 'tags.json');

    if (await fileExists(workspaceTagsUri)) {
      const tags = await this.readTagsFile(settings, workspaceTagsUri);
      legacyTags.push(...tags);
    }
    if (await fileExists(legacyMetaTagsUri)) {
      const tags = await this.readTagsFile(settings, legacyMetaTagsUri);
      legacyTags.push(...tags);
    }
    if (legacyTags.length === 0) {
      return;
    }
    const globalTags = await this.readTagsFile(settings);
    const merged = dedupeTags([...globalTags, ...legacyTags]);
    await this.writeTagsFile(settings, merged);
    await this.moveLegacyTagsToBackup(workspaceTagsUri);
    await this.moveLegacyTagsToBackup(legacyMetaTagsUri);
  }

  private async readTagsFile(settings: ExtensionSettings, overrideUri?: vscode.Uri): Promise<string[]> {
    const tagsUri = overrideUri ?? this.getTagsUri(settings);
    try {
      const content = await vscode.workspace.fs.readFile(tagsUri);
      const parsed = JSON.parse(Buffer.from(content).toString('utf8')) as TagConfig;
      if (Array.isArray(parsed.tags)) {
        return dedupeTags(parsed.tags);
      }
    } catch (error) {
      this.warnReadIssue(tagsUri, error);
    }
    return [];
  }

  private async writeTagsFile(settings: ExtensionSettings, tags: string[]): Promise<void> {
    const tagsUri = this.getTagsUri(settings);
    await this.ensureDirectory(tagsUri);
    const payload: TagConfig = { tags: dedupeTags(tags).sort((a, b) => a.localeCompare(b)) };
    await vscode.workspace.fs.writeFile(tagsUri, Buffer.from(JSON.stringify(payload, null, 2) + '\n', 'utf8'));
  }

  private getTagsUri(settings: ExtensionSettings): vscode.Uri {
    return vscode.Uri.joinPath(this.context.globalStorageUri, settings.tagsFile);
  }

  private async moveLegacyTagsToBackup(sourceUri: vscode.Uri): Promise<void> {
    if (!(await fileExists(sourceUri))) {
      return;
    }
    const targetUri = await this.getBackupUri(sourceUri, 'bak');
    await this.ensureDirectory(targetUri);
    await vscode.workspace.fs.rename(sourceUri, targetUri, { overwrite: false });
  }

  private async getBackupUri(sourceUri: vscode.Uri, suffix: string): Promise<vscode.Uri> {
    const basePath = `${sourceUri.path}.${suffix}`;
    let targetUri = sourceUri.with({ path: basePath });
    if (!(await fileExists(targetUri))) {
      return targetUri;
    }
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    targetUri = sourceUri.with({ path: `${basePath}-${stamp}` });
    return targetUri;
  }

  private async removeTagFromProjectConfig(
    folder: vscode.WorkspaceFolder,
    settings: ExtensionSettings,
    tagToRemove: string
  ): Promise<void> {
    const configUri = vscode.Uri.joinPath(folder.uri, settings.configFile);
    if (!(await fileExists(configUri))) {
      return;
    }
    const config = await this.readConfig(configUri);
    if (!Array.isArray(config.tags)) {
      return;
    }
    const nextTags = config.tags.filter((t: unknown) => typeof t === 'string' && t !== tagToRemove);
    config.tags = nextTags;
    await this.writeConfig(configUri, config, settings.configFile);
  }

  private async readConfig(uri: vscode.Uri): Promise<Record<string, any>> {
    try {
      const content = await vscode.workspace.fs.readFile(uri);
      return JSON.parse(Buffer.from(content).toString('utf8'));
    } catch (error) {
      this.warnReadIssue(uri, error);
    }
    return {};
  }

  private warnReadIssue(uri: vscode.Uri, error: unknown): void {
    const code = (error as NodeJS.ErrnoException)?.code;
    if (code === 'ENOENT' || code === 'EntryNotFound' || code === 'FileNotFound') {
      return;
    }
    const key = uri.fsPath;
    if (!this.warnedFiles.has(key)) {
      this.warnedFiles.add(key);
      void vscode.window.showWarningMessage(`Harbormaster: unable to read ${key}.`);
    }
    console.warn(`Harbormaster: unable to read file ${key}:`, error);
  }

  private async writeConfig(uri: vscode.Uri, payload: Record<string, any>, label: string): Promise<void> {
    await this.ensureDirectory(uri);
    await vscode.workspace.fs.writeFile(uri, Buffer.from(JSON.stringify(payload, null, 2) + '\n', 'utf8'));
    this.onDidChangeEmitter.fire();
    if (label) {
      console.log(`Harbormaster: wrote ${label}`);
    }
  }

  private async readCatalog(uri: vscode.Uri): Promise<Catalog> {
    try {
      const content = await vscode.workspace.fs.readFile(uri);
      const parsed = JSON.parse(Buffer.from(content).toString('utf8'));
      if (Array.isArray(parsed)) {
        return parsed as Catalog;
      }
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code && code !== 'ENOENT') {
        console.warn(`Harbormaster: unable to read catalog ${uri.fsPath}:`, error);
      }
    }
    return [];
  }

  private async writeCatalog(catalog: Catalog, uri: vscode.Uri): Promise<void> {
    await this.ensureDirectory(uri);
    await vscode.workspace.fs.writeFile(uri, Buffer.from(JSON.stringify(catalog, null, 2) + '\n', 'utf8'));
    this.onDidChangeEmitter.fire();
  }

  private async ensureDirectory(targetUri: vscode.Uri): Promise<void> {
    await ensureDirectoryForFile(targetUri);
  }

  private registerWatchers(folder: vscode.WorkspaceFolder, settings: ExtensionSettings): void {
    const patterns = [
      new vscode.RelativePattern(folder, settings.configFile),
      new vscode.RelativePattern(folder, LEGACY_CONFIG_FILE),
      new vscode.RelativePattern(folder, `${LEGACY_META_DIR}/project.json`),
      new vscode.RelativePattern(folder, `${LEGACY_META_DIR}/tags.json`),
      ...REQUIRED_CONTEXT_FILES.map((name) => new vscode.RelativePattern(folder, `${DEFAULT_CONTEXT_DIR}/${name}`)),
      ...AGENTS_FILE_CANDIDATES.map((name) => new vscode.RelativePattern(folder, name)),
    ];

    for (const pattern of patterns) {
      const watcher = vscode.workspace.createFileSystemWatcher(pattern);
      const shouldAutoCatalog = pattern.pattern === settings.configFile || pattern.pattern === LEGACY_CONFIG_FILE;
      const syncCatalog = () => {
        if (shouldAutoCatalog) {
          void this.upsertCatalogEntry(folder, settings, { silent: true });
        }
      };
      this.watchers.push(watcher);
      this.disposables.push(
        watcher,
        watcher.onDidChange(() => {
          syncCatalog();
          this.onDidChangeEmitter.fire();
          void this.refreshHealth();
        }),
        watcher.onDidCreate(() => {
          syncCatalog();
          this.onDidChangeEmitter.fire();
          void this.refreshHealth();
        }),
        watcher.onDidDelete(() => {
          this.onDidChangeEmitter.fire();
          void this.refreshHealth();
        })
      );
    }

    const globalTagsPattern = new vscode.RelativePattern(this.context.globalStorageUri, settings.tagsFile);
    const globalTagsWatcher = vscode.workspace.createFileSystemWatcher(globalTagsPattern);
    this.watchers.push(globalTagsWatcher);
    this.disposables.push(
      globalTagsWatcher,
      globalTagsWatcher.onDidChange(() => {
        this.onDidChangeEmitter.fire();
      }),
      globalTagsWatcher.onDidCreate(() => {
        this.onDidChangeEmitter.fire();
      }),
      globalTagsWatcher.onDidDelete(() => {
        this.onDidChangeEmitter.fire();
      })
    );
  }

  private async backupTagsFile(folder: vscode.WorkspaceFolder, settings: ExtensionSettings): Promise<void> {
    const tagsUri = vscode.Uri.joinPath(folder.uri, settings.tagsFile);
    if (!(await fileExists(tagsUri))) {
      return;
    }

    const today = new Date();
    const stamp = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(
      today.getDate()
    ).padStart(2, '0')}`;
    const backupName = `${settings.tagsFile.replace(/\/?$/, '')}.bak-${stamp}`;
    const backupUri = vscode.Uri.joinPath(folder.uri, backupName);

    if (await fileExists(backupUri)) {
      return;
    }

    try {
      const content = await vscode.workspace.fs.readFile(tagsUri);
      await this.ensureDirectory(backupUri);
      await vscode.workspace.fs.writeFile(backupUri, content);
      await this.cleanupOldTagBackups(folder, settings, backupName, 1);
    } catch (error) {
      console.warn(`Harbormaster: unable to create tags backup ${backupName}:`, error);
    }
  }

  private async ensureCatalogFile(settings: ExtensionSettings): Promise<void> {
    const catalogUri = this.getCatalogUri(settings);
    if (await fileExists(catalogUri)) {
      return;
    }
    await this.ensureDirectory(catalogUri);
    await this.writeCatalog([], catalogUri);
  }

  private async upsertCatalogEntry(
    folder: vscode.WorkspaceFolder,
    settings: ExtensionSettings,
    options: { silent?: boolean } = {}
  ): Promise<void> {
    const { silent = false } = options;
    const catalogUri = this.getCatalogUri(settings);
    const configUri = vscode.Uri.joinPath(folder.uri, settings.configFile);
    if (!(await fileExists(configUri))) {
      if (!silent) {
        void vscode.window.showWarningMessage(`Harbormaster: ${settings.configFile} not found; cannot add to catalog.`);
      }
      return;
    }

    const config = await this.readConfig(configUri);
    const name = coerceString(config?.project_name) ?? folder.name;
    const tags = dedupeTags(Array.isArray(config?.tags) ? config.tags : []);
    const now = new Date().toISOString();

    const catalog = await this.readCatalog(catalogUri);
    const existingIndex = catalog.findIndex((p) => p.path === folder.uri.fsPath);
    if (existingIndex >= 0) {
      const existing = catalog[existingIndex];
      catalog[existingIndex] = {
        ...existing,
        name,
        tags,
        lastEditedAt: now,
      };
    } else {
      catalog.push({
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        name,
        path: folder.uri.fsPath,
        tags,
        createdAt: now,
      });
    }

    await this.ensureDirectory(catalogUri);
    await this.writeCatalog(catalog, catalogUri);
    if (!silent) {
      void vscode.window.showInformationMessage(`Harbormaster: saved "${name}" to catalog.`);
    }
  }

  private getCatalogUri(settings: ExtensionSettings): vscode.Uri {
    return vscode.Uri.joinPath(this.context.globalStorageUri, settings.projectsFile);
  }

  private async migrateWorkspaceCatalog(folder: vscode.WorkspaceFolder, settings: ExtensionSettings): Promise<void> {
    const legacyCatalogUri = vscode.Uri.joinPath(folder.uri, settings.projectsFile);
    if (!(await fileExists(legacyCatalogUri))) {
      return;
    }
    const catalogUri = this.getCatalogUri(settings);
    const legacy = await this.readCatalog(legacyCatalogUri);
    if (legacy.length === 0) {
      await vscode.workspace.fs.delete(legacyCatalogUri);
      return;
    }
    const existing = await this.readCatalog(catalogUri);
    const merged = [...existing];
    for (const entry of legacy) {
      const idx = merged.findIndex((p) => p.path === entry.path);
      if (idx >= 0) {
        merged[idx] = { ...merged[idx], ...entry };
      } else {
        merged.push(entry);
      }
    }
    await this.ensureDirectory(catalogUri);
    await this.writeCatalog(merged, catalogUri);
    await vscode.workspace.fs.delete(legacyCatalogUri);
  }

  private async cleanupOldTagBackups(
    folder: vscode.WorkspaceFolder,
    settings: ExtensionSettings,
    newestBackupName: string,
    keepCount = 1
  ): Promise<void> {
    try {
      const tagsUri = vscode.Uri.joinPath(folder.uri, settings.tagsFile);
      const segments = tagsUri.path.split('/');
      const fileName = segments.pop();
      const dirPath = segments.join('/') || '/';
      const dirUri = tagsUri.with({ path: dirPath });
      if (!fileName) {
        return;
      }

      const entries = await vscode.workspace.fs.readDirectory(dirUri);
      const backupPrefix = `${fileName}.bak-`;
      const backups = entries
        .filter(([name, type]) => type === vscode.FileType.File && name.startsWith(backupPrefix))
        .map(([name]) => name)
        .sort((a, b) => b.localeCompare(a)); // newest first by date string

      const toDelete = backups.filter((name) => name !== newestBackupName).slice(keepCount);
      for (const name of toDelete) {
        const target = vscode.Uri.joinPath(dirUri, name);
        await vscode.workspace.fs.delete(target);
      }
    } catch (error) {
      console.warn('Harbormaster: unable to clean old tag backups', error);
    }
  }
}

export function activate(context: vscode.ExtensionContext): void {
  let reportedPunycode = false;
  process.on('warning', (warning) => {
    if (warning.name === 'DeprecationWarning' && warning.message.includes('punycode')) {
      console.warn('Harbormaster: punycode deprecation warning stack:', warning.stack);
      if (reportedPunycode) {
        return;
      }
      reportedPunycode = true;
      void vscode.window.showWarningMessage(
        'Harbormaster: Node punycode deprecation is triggered by VS Code’s built-in Markdown Language Features extension (vscode.markdown-language-features). Disable it in this workspace if you want to silence the warning.'
      );
    }
  });
  const tracker = new ProjectTracker(context);
  trackerSingleton = tracker;
  const controller = new TitleController(tracker);
  const version = context.extension.packageJSON.version as string;
  const diagnostics = vscode.languages.createDiagnosticCollection('Harbormaster');
  const inputDiagnostics = vscode.languages.createDiagnosticCollection('Harbormaster Input');
  tracker.setHealthIndicators(diagnostics);
  tracker.setInputDiagnostics(inputDiagnostics);
  const appViewProvider = new HarbormasterAppViewProvider(
    tracker,
    getExtensionSettings,
    ACCENT_SECTIONS,
    ACCENT_GROUPS,
    normalizeAccentColor,
    normalizeAccentSections,
    normalizeAccentGroups,
    normalizeAccentSectionInherit,
    normalizeAccentGroupInherit,
    normalizeAccentOverrides,
    normalizeAccentHistory,
    version,
    isDevToolsEnabled(context),
    context.extensionUri
  );
  appViewProviderSingleton = appViewProvider;
  context.subscriptions.push(
    controller,
    tracker,
    diagnostics,
    inputDiagnostics,
    vscode.window.registerWebviewViewProvider('harbormasterActions', appViewProvider),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration('workbench.colorCustomizations') && !tracker.isPreviewActive()) {
        appViewProvider.notifyThemeDefaults();
      }
    }),
    vscode.commands.registerCommand('projectWindowTitle.createConfig', () => createProjectConfig()),
    vscode.commands.registerCommand('projectWindowTitle.openConfig', () => openProjectConfig()),
    vscode.commands.registerCommand('projectWindowTitle.showMenu', () => showMenu()),
    vscode.commands.registerCommand('projectWindowTitle.refresh', () => controller.refresh()),
    vscode.commands.registerCommand('projectWindowTitle.setWindowAccent', () => openWindowAccentPicker()),
    vscode.commands.registerCommand('projectWindowTitle.resetWindowAccent', () => resetWindowAccentColor()),
    vscode.commands.registerCommand('projectWindowTitle.rebuildState', () => tracker.rebuildHarbormasterState()),
    vscode.commands.registerCommand('projectWindowTitle.addGlobalTag', () => tracker.addGlobalTag()),
    vscode.commands.registerCommand('projectWindowTitle.removeGlobalTag', () => tracker.removeGlobalTag()),
    vscode.commands.registerCommand('projectWindowTitle.assignTag', () => tracker.assignTagToProject()),
    vscode.commands.registerCommand('projectWindowTitle.removeProjectTag', () => tracker.removeProjectTag()),
    vscode.commands.registerCommand('projectWindowTitle.addProjectToCatalog', () => tracker.addProjectToCatalog()),
    vscode.commands.registerCommand('projectWindowTitle.openProjectFromCatalog', () => tracker.openProjectFromCatalog()),
    vscode.commands.registerCommand('projectWindowTitle.openGlobalTags', () => openGlobalTagMenu()),
    vscode.commands.registerCommand('projectWindowTitle.createHarbormasterProject', () => createHarbormasterProject()),
    vscode.commands.registerCommand('projectWindowTitle.saveColorPreset', () => tracker.saveColorPreset()),
    vscode.commands.registerCommand('projectWindowTitle.applyColorPreset', () => tracker.applyColorPreset()),
    new StatusBarController()
  );
}

export function deactivate(): void {
  // Nothing to clean up beyond disposables.
}

class TitleController implements vscode.Disposable {
  private watcher?: vscode.FileSystemWatcher;
  private watcherSubscriptions: vscode.Disposable[] = [];
  private disposables: vscode.Disposable[] = [];
  private readonly tracker: ProjectTracker;

  constructor(tracker: ProjectTracker) {
    this.tracker = tracker;
    this.disposables.push(
      vscode.workspace.onDidChangeWorkspaceFolders(() => this.refresh()),
      vscode.workspace.onDidChangeConfiguration((event) => {
        if (event.affectsConfiguration('projectWindowTitle') || event.affectsConfiguration('window.title')) {
          this.refresh();
        }
      })
    );

    void this.refresh();
  }

  dispose(): void {
    this.resetWatcher();
    this.disposables.forEach((item) => item.dispose());
  }

  private resetWatcher(): void {
    this.watcherSubscriptions.forEach((item) => item.dispose());
    this.watcherSubscriptions = [];

    this.watcher?.dispose();
    this.watcher = undefined;
  }

  async refresh(): Promise<void> {
    this.resetWatcher();

    const folder = getPrimaryWorkspaceFolder();
    if (!folder) {
      return;
    }

    const settings = getExtensionSettings();
    const pattern = new vscode.RelativePattern(folder, settings.configFile);

    this.watcher = vscode.workspace.createFileSystemWatcher(pattern);
    this.watcherSubscriptions.push(
      this.watcher,
      this.watcher.onDidCreate(() => this.apply(settings, folder)),
      this.watcher.onDidChange(() => this.apply(settings, folder)),
      this.watcher.onDidDelete(() => this.apply(settings, folder))
    );

    await this.apply(settings, folder);
  }

  private async apply(settings: ExtensionSettings, folder: vscode.WorkspaceFolder): Promise<void> {
    const projectInfo = await readProjectInfo(folder, settings, this.tracker);
    const desiredTitle = buildTitle(projectInfo, settings);

    const windowConfig = vscode.workspace.getConfiguration('window', folder.uri);
    const inspected = windowConfig.inspect<string>('title');
    const currentTitle = inspected?.workspaceValue ?? inspected?.workspaceFolderValue;

    if (currentTitle !== desiredTitle) {
      await windowConfig.update('title', desiredTitle, vscode.ConfigurationTarget.Workspace);
    }
    await this.applyWindowAccent(
      folder,
      projectInfo.windowAccent,
      projectInfo.windowAccentSections,
      projectInfo.windowAccentGroups,
      projectInfo.windowAccentSectionsInherit,
      projectInfo.windowAccentGroupsInherit,
      projectInfo.windowAccentOverrides,
      projectInfo.windowAccentHighlightBoost
    );
  }

  private async applyWindowAccent(
    folder: vscode.WorkspaceFolder,
    accent: string | undefined,
    sectionAccents: Record<string, string> | undefined,
    groupAccents: Record<string, string> | undefined,
    sectionInherit: Record<string, boolean> | undefined,
    groupInherit: Record<string, boolean> | undefined,
    overrides: Record<string, string> | undefined,
    highlightBoost: number | undefined
  ): Promise<void> {
    const normalized = normalizeAccentColor(accent);
    const normalizedBoost = normalizeAccentHighlightBoost(highlightBoost);
    await applyWindowAccentToWorkspace(
      folder,
      normalized,
      sectionAccents,
      groupAccents,
      sectionInherit,
      groupInherit,
      overrides,
      normalizedBoost
    );
  }
}

function getPrimaryWorkspaceFolder(): vscode.WorkspaceFolder | undefined {
  const folders = vscode.workspace.workspaceFolders;
  return folders && folders.length > 0 ? folders[0] : undefined;
}

function getExtensionSettings(): ExtensionSettings {
  const config = vscode.workspace.getConfiguration('projectWindowTitle');
  return {
    configFile: config.get<string>('configFile', DEFAULT_CONFIG_FILE),
    tagsFile: config.get<string>('tagsFile', DEFAULT_TAGS_FILE),
    projectsFile: config.get<string>('projectsFile', DEFAULT_PROJECTS_FILE),
    projectNameKey: config.get<string>('projectNameKey', DEFAULT_PROJECT_KEY),
    projectVersionKey: config.get<string>('projectVersionKey', DEFAULT_VERSION_KEY),
    projectVersionMajorKey: config.get<string>('projectVersionMajorKey', DEFAULT_VERSION_MAJOR_KEY),
    projectVersionMinorKey: config.get<string>('projectVersionMinorKey', DEFAULT_VERSION_MINOR_KEY),
    projectVersionPatchKey: config.get<string>('projectVersionPatchKey', DEFAULT_VERSION_PATCH_KEY),
    projectVersionPrereleaseKey: config.get<string>('projectVersionPrereleaseKey', DEFAULT_VERSION_PRERELEASE_KEY),
    showVersion: config.get<boolean>('showVersion', DEFAULT_SHOW_VERSION),
    versionFormat: config.get<string>('versionFormat', DEFAULT_VERSION_FORMAT),
    headlessPrefix: config.get<string>('headlessPrefix', DEFAULT_HEADLESS_PREFIX),
    namedFormat: config.get<string>('namedFormat', DEFAULT_NAMED_FORMAT),
    projectCreateDefaultFolder: config.get<string>('projectCreateDefaultFolder', DEFAULT_PROJECT_CREATE_FOLDER),
  };
}

async function createProjectConfig(): Promise<void> {
  const folder = getPrimaryWorkspaceFolder();
  if (!folder) {
    void vscode.window.showErrorMessage('Harbormaster: No workspace folder open.');
    return;
  }

  const settings = getExtensionSettings();
  const targetUri = vscode.Uri.joinPath(folder.uri, settings.configFile);

  const projectName = await vscode.window.showInputBox({
    prompt: 'Project name (required)',
    placeHolder: 'My Project',
    ignoreFocusOut: true,
    validateInput: (value) => (value.trim().length === 0 ? 'Project name is required' : undefined),
  });
  if (projectName === undefined) {
    return;
  }

  const projectVersion = await vscode.window.showInputBox({
    prompt: 'Version (optional, will be stored even if empty)',
    placeHolder: 'e.g. 1.2.25-alpha',
    ignoreFocusOut: true,
  });
  if (projectVersion === undefined) {
    return;
  }


  let exists = false;
  try {
    await vscode.workspace.fs.stat(targetUri);
    exists = true;
  } catch {
    exists = false;
  }

  if (exists) {
    const overwrite = await vscode.window.showWarningMessage(
      `${settings.configFile} already exists. Overwrite?`,
      { modal: true },
      'Overwrite',
      'Cancel'
    );
    if (overwrite !== 'Overwrite') {
      return;
    }
  }

  const payload = buildProjectConfigPayload(projectName.trim(), projectVersion ?? '');

  await ensureDirectoryForFile(targetUri);
  const content = Buffer.from(JSON.stringify(payload, null, 2) + '\n', 'utf8');
  await vscode.workspace.fs.writeFile(targetUri, content);
  if (trackerSingleton) {
    await trackerSingleton.scaffoldProjectState({ silent: true });
  }
  void vscode.window.showInformationMessage(`Harbormaster: wrote ${settings.configFile}.`);
}

async function openWindowAccentPicker(): Promise<void> {
  await vscode.commands.executeCommand('workbench.view.extension.harbormaster');
  appViewProviderSingleton?.setMode('accent');
}

async function openGlobalTagMenu(): Promise<void> {
  void vscode.window.showInformationMessage('Harbormaster: Global tag menu coming soon.');
}

async function createHarbormasterProject(): Promise<void> {
  if (!trackerSingleton) {
    void vscode.window.showErrorMessage('Harbormaster: tracker not initialized.');
    return;
  }
  const settings = getExtensionSettings();
  const startUri = getCreateProjectDefaultUri(settings);
  const pick = await vscode.window.showOpenDialog({
    canSelectFiles: false,
    canSelectFolders: true,
    canSelectMany: false,
    defaultUri: startUri,
    openLabel: 'Create Harbormaster project',
  });
  if (!pick || pick.length === 0) {
    return;
  }
  const targetUri = pick[0];
  const folderName = path.basename(targetUri.fsPath);
  const metadata = await promptProjectMetadata(folderName);
  if (!metadata) {
    return;
  }
  const configUri = vscode.Uri.joinPath(targetUri, settings.configFile);
  if (await fileExists(configUri)) {
    const overwrite = await vscode.window.showWarningMessage(
      `${settings.configFile} already exists in this folder. Overwrite?`,
      { modal: true },
      'Overwrite',
      'Cancel'
    );
    if (overwrite !== 'Overwrite') {
      return;
    }
  }
  const payload = buildProjectConfigPayload(metadata.name, metadata.version);
  await ensureDirectoryForFile(configUri);
  await vscode.workspace.fs.writeFile(configUri, Buffer.from(JSON.stringify(payload, null, 2) + '\n', 'utf8'));
  await trackerSingleton.scaffoldProjectStateForFolder(targetUri, settings);
  await trackerSingleton.addProjectToCatalogByUri(targetUri, settings, { silent: true });

  const currentFolder = getPrimaryWorkspaceFolder();
  if (!currentFolder || currentFolder.uri.fsPath !== targetUri.fsPath) {
    await vscode.commands.executeCommand('vscode.openFolder', targetUri, { forceNewWindow: false });
  }
}

function getCreateProjectDefaultUri(settings: ExtensionSettings): vscode.Uri {
  const currentFolder = getPrimaryWorkspaceFolder();
  if (currentFolder) {
    return currentFolder.uri;
  }
  const configured = settings.projectCreateDefaultFolder?.trim();
  const fallback = DEFAULT_PROJECT_CREATE_FOLDER;
  const resolved = configured && configured.length > 0 ? configured : fallback;
  return vscode.Uri.file(resolved);
}

async function promptProjectMetadata(
  defaultName: string
): Promise<{ name: string; version: string | undefined } | undefined> {
  const name = await vscode.window.showInputBox({
    prompt: 'Project name',
    value: defaultName,
    ignoreFocusOut: true,
    validateInput: (value) => (value.trim().length ? undefined : 'Project name is required'),
  });
  if (!name) {
    return undefined;
  }
  const version = await vscode.window.showInputBox({
    prompt: 'Project version (optional)',
    placeHolder: 'e.g. 1.0.0-alpha',
    ignoreFocusOut: true,
  });
  return { name: name.trim(), version: version?.trim() || undefined };
}

function buildProjectConfigPayload(name: string, version?: string): Record<string, any> {
  return {
    project_name: name,
    project_version: version ?? '',
    version_major: 0,
    version_minor: 0,
    version_patch: 0,
    version_prerelease: '',
    tags: [],
    version_scheme_note: 'version = <major>.<minor>.<patch>-<prerelease>; prerelease is optional.',
  };
}


async function openProjectConfig(): Promise<void> {
  const folder = getPrimaryWorkspaceFolder();
  if (!folder) {
    void vscode.window.showErrorMessage('Harbormaster: No workspace folder open.');
    return;
  }

  const settings = getExtensionSettings();
  const targetUri = vscode.Uri.joinPath(folder.uri, settings.configFile);

  try {
    await vscode.workspace.fs.stat(targetUri);
  } catch {
    const create = await vscode.window.showWarningMessage(
      `${settings.configFile} does not exist. Create it?`,
      { modal: true },
      'Create',
      'Cancel'
    );
    if (create !== 'Create') {
      return;
    }
    await createProjectConfig();
    return;
  }

  const doc = await vscode.workspace.openTextDocument(targetUri);
  await vscode.window.showTextDocument(doc, { preview: false });
}

async function readProjectInfo(folder: vscode.WorkspaceFolder, settings: ExtensionSettings, tracker: ProjectTracker): Promise<ProjectInfo> {
  const targetUri = vscode.Uri.joinPath(folder.uri, settings.configFile);

  try {
    const content = await vscode.workspace.fs.readFile(targetUri);
    const parsed = JSON.parse(Buffer.from(content).toString('utf8'));
    const projectName = coerceString(parsed?.[settings.projectNameKey]);
    const explicitVersion = coerceString(parsed?.[settings.projectVersionKey]);
    const major = coerceNumber(parsed?.[settings.projectVersionMajorKey]);
    const minor = coerceNumber(parsed?.[settings.projectVersionMinorKey]);
    const patch = coerceNumber(parsed?.[settings.projectVersionPatchKey]);
    const prerelease = coerceString(parsed?.[settings.projectVersionPrereleaseKey]);
    const windowAccent = coerceString(parsed?.[DEFAULT_WINDOW_ACCENT_KEY]);
    const windowAccentSections = normalizeAccentSections(parsed?.[DEFAULT_WINDOW_ACCENT_SECTIONS_KEY]);
    const windowAccentGroups = normalizeAccentGroups(parsed?.[DEFAULT_WINDOW_ACCENT_GROUPS_KEY]);
    const windowAccentSectionsInherit = normalizeAccentSectionInherit(parsed?.[DEFAULT_WINDOW_ACCENT_SECTIONS_INHERIT_KEY]);
    const windowAccentGroupsInherit = normalizeAccentGroupInherit(parsed?.[DEFAULT_WINDOW_ACCENT_GROUPS_INHERIT_KEY]);
    const windowAccentOverrides = normalizeAccentOverrides(parsed?.[DEFAULT_WINDOW_ACCENT_OVERRIDES_KEY]);
    const windowAccentHistory = normalizeAccentHistory(parsed?.[DEFAULT_WINDOW_ACCENT_HISTORY_KEY]);
    const windowAccentHighlightBoost = normalizeAccentHighlightBoost(parsed?.[DEFAULT_WINDOW_ACCENT_HIGHLIGHT_BOOST_KEY]);
    const tags = await tracker.getProjectTags(parsed);
    const projectVersion = deriveVersion(explicitVersion, major, minor, patch, prerelease);

    return {
      name: projectName,
      version: projectVersion,
      tags,
      windowAccent,
      windowAccentSections,
      windowAccentGroups,
      windowAccentSectionsInherit,
      windowAccentGroupsInherit,
      windowAccentOverrides,
      windowAccentHistory,
      windowAccentHighlightBoost,
    };
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code && code !== 'ENOENT' && code !== 'EntryNotFound' && code !== 'FileNotFound') {
      console.warn(`Harbormaster: unable to read config file ${settings.configFile}:`, error);
    }
  }

  return {};
}

function coerceString(value: unknown): string | undefined {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  return undefined;
}

function coerceNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isInteger(value) && value >= 0) {
    return value;
  }

  if (typeof value === 'string' && /^[0-9]+$/.test(value)) {
    return Number.parseInt(value, 10);
  }

  return undefined;
}

function isAccentGroupId(groupId: string): boolean {
  return ACCENT_GROUPS.some((group) => group.id === groupId);
}

function isAccentSectionId(sectionId: string): boolean {
  return ACCENT_SECTIONS.some((section) => section.id === sectionId);
}

function isAccentColorKey(key: string): boolean {
  return ACCENT_COLOR_KEYS.includes(key);
}

function normalizeAccentColor(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return undefined;
  }
  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) {
    return trimmed.toUpperCase();
  }
  if (/^#[0-9a-fA-F]{3}$/.test(trimmed)) {
    const r = trimmed[1];
    const g = trimmed[2];
    const b = trimmed[3];
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }
  return undefined;
}

function normalizeAccentGroups(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object') {
    return {};
  }
  const source = value as Record<string, unknown>;
  const result: Record<string, string> = {};
  for (const group of ACCENT_GROUPS) {
    const normalized = normalizeAccentColor(coerceString(source[group.id]));
    if (normalized) {
      result[group.id] = normalized;
    }
  }
  return result;
}

function normalizeAccentSections(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object') {
    return {};
  }
  const source = value as Record<string, unknown>;
  const result: Record<string, string> = {};
  for (const section of ACCENT_SECTIONS) {
    const normalized = normalizeAccentColor(coerceString(source[section.id]));
    if (normalized) {
      result[section.id] = normalized;
    }
  }
  return result;
}

function normalizeAccentSectionInherit(value: unknown): Record<string, boolean> {
  if (!value || typeof value !== 'object') {
    return {};
  }
  const source = value as Record<string, unknown>;
  const result: Record<string, boolean> = {};
  for (const section of ACCENT_SECTIONS) {
    if (typeof source[section.id] === 'boolean') {
      result[section.id] = Boolean(source[section.id]);
    }
  }
  return result;
}

function normalizeAccentOverrides(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object') {
    return {};
  }
  const source = value as Record<string, unknown>;
  const result: Record<string, string> = {};
  for (const key of ACCENT_COLOR_KEYS) {
    const normalized = normalizeAccentColor(coerceString(source[key]));
    if (normalized) {
      result[key] = normalized;
    }
  }
  return result;
}

function normalizeAccentGroupInherit(value: unknown): Record<string, boolean> {
  if (!value || typeof value !== 'object') {
    return {};
  }
  const source = value as Record<string, unknown>;
  const result: Record<string, boolean> = {};
  for (const group of ACCENT_GROUPS) {
    if (typeof source[group.id] === 'boolean') {
      result[group.id] = Boolean(source[group.id]);
    }
  }
  return result;
}

function normalizeAccentHistory(value: unknown): Record<string, string[]> {
  if (!value || typeof value !== 'object') {
    return {};
  }
  const source = value as Record<string, unknown>;
  const result: Record<string, string[]> = {};
  for (const section of ACCENT_SECTIONS) {
    const raw = source[section.id];
    if (!Array.isArray(raw)) {
      continue;
    }
    const values = raw
      .map((entry) => normalizeAccentColor(coerceString(entry)))
      .filter((entry): entry is string => Boolean(entry));
    if (values.length > 0) {
      result[section.id] = values.slice(0, 3);
    }
  }
  for (const group of ACCENT_GROUPS) {
    const raw = source[group.id];
    if (!Array.isArray(raw)) {
      continue;
    }
    const values = raw
      .map((entry) => normalizeAccentColor(coerceString(entry)))
      .filter((entry): entry is string => Boolean(entry));
    if (values.length > 0) {
      result[group.id] = values.slice(0, 3);
    }
  }
  const baseRaw = source.base;
  if (Array.isArray(baseRaw)) {
    const values = baseRaw
      .map((entry) => normalizeAccentColor(coerceString(entry)))
      .filter((entry): entry is string => Boolean(entry));
    if (values.length > 0) {
      result.base = values.slice(0, 3);
    }
  }
  return result;
}

function applyAlpha(color: string, alpha: number): string {
  const clamped = Math.max(0, Math.min(1, alpha));
  const hexAlpha = Math.round(clamped * 255)
    .toString(16)
    .padStart(2, '0')
    .toUpperCase();
  return `${color}${hexAlpha}`;
}

function normalizeAccentHighlightBoost(value: unknown): number | undefined {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return undefined;
  }
  const clamped = Math.max(0, Math.min(0.4, value));
  return clamped;
}

function applySectionInheritBoost(color: string, sectionId: string, boost: number | undefined): string {
  const normalized = normalizeAccentColor(color);
  if (!normalized) {
    return color;
  }
  const factor = sectionId === 'highlights' ? boost ?? DEFAULT_HIGHLIGHT_INHERIT_BOOST : 0;
  if (!factor) {
    return normalized;
  }
  return adjustColorVivid(normalized, factor);
}

function adjustColorVivid(hex: string, factor: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) {
    return hex;
  }
  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
  const lift = Math.max(0, Math.min(0.5, factor));
  const nextLight = clamp01(hsl.l + lift * (1 - hsl.l));
  const nextSat = clamp01(hsl.s + lift * (1 - hsl.s));
  const adjusted = hslToRgb(hsl.h, nextSat, nextLight);
  return rgbToHex(adjusted.r, adjusted.g, adjusted.b);
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) {
    return null;
  }
  return {
    r: Number.parseInt(hex.slice(1, 3), 16),
    g: Number.parseInt(hex.slice(3, 5), 16),
    b: Number.parseInt(hex.slice(5, 7), 16),
  };
}

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (value: number) => Math.max(0, Math.min(255, Math.round(value)));
  return `#${clamp(r).toString(16).padStart(2, '0')}${clamp(g)
    .toString(16)
    .padStart(2, '0')}${clamp(b).toString(16).padStart(2, '0')}`.toUpperCase();
}

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (delta !== 0) {
    s = delta / (1 - Math.abs(2 * l - 1));
    switch (max) {
      case rn:
        h = ((gn - bn) / delta) % 6;
        break;
      case gn:
        h = (bn - rn) / delta + 2;
        break;
      default:
        h = (rn - gn) / delta + 4;
        break;
    }
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s, l };
}

function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h >= 0 && h < 60) {
    r = c;
    g = x;
  } else if (h >= 60 && h < 120) {
    r = x;
    g = c;
  } else if (h >= 120 && h < 180) {
    g = c;
    b = x;
  } else if (h >= 180 && h < 240) {
    g = x;
    b = c;
  } else if (h >= 240 && h < 300) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }
  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
  };
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function darkenColor(color: string, factor: number): string {
  const clamped = Math.max(0, Math.min(1, factor));
  const r = Math.round(Number.parseInt(color.slice(1, 3), 16) * clamped);
  const g = Math.round(Number.parseInt(color.slice(3, 5), 16) * clamped);
  const b = Math.round(Number.parseInt(color.slice(5, 7), 16) * clamped);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b
    .toString(16)
    .padStart(2, '0')}`.toUpperCase();
}

function getContrastColor(hex: string): string {
  const r = Number.parseInt(hex.slice(1, 3), 16);
  const g = Number.parseInt(hex.slice(3, 5), 16);
  const b = Number.parseInt(hex.slice(5, 7), 16);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 140 ? '#000000' : '#FFFFFF';
}

function pickAccentOverrides(keys: string[], overrides: Record<string, string>): Record<string, string> {
  const entries: Record<string, string> = {};
  for (const key of keys) {
    if (overrides[key]) {
      entries[key] = overrides[key];
    }
  }
  return entries;
}

function buildAccentColorMapForGroup(
  groupId: string,
  accent: string | undefined,
  overrides: Record<string, string>
): Record<string, string> {
  const group = ACCENT_GROUPS.find((candidate) => candidate.id === groupId);
  if (!accent) {
    return group ? pickAccentOverrides(group.keys, overrides) : {};
  }
  const foreground = getContrastColor(accent);
  switch (groupId) {
    case 'titleBar':
      return {
        'titleBar.activeBackground': overrides['titleBar.activeBackground'] ?? accent,
        'titleBar.inactiveBackground': overrides['titleBar.inactiveBackground'] ?? applyAlpha(accent, 0.6),
        'titleBar.activeForeground': overrides['titleBar.activeForeground'] ?? foreground,
        'titleBar.inactiveForeground': overrides['titleBar.inactiveForeground'] ?? applyAlpha(foreground, 0.7),
      };
    case 'activityBar':
      return {
        'activityBar.background': overrides['activityBar.background'] ?? accent,
        'activityBar.foreground': overrides['activityBar.foreground'] ?? foreground,
        'activityBar.inactiveForeground': overrides['activityBar.inactiveForeground'] ?? applyAlpha(foreground, 0.6),
      };
    case 'tabs':
      return {
        'activityBar.activeBorder': overrides['activityBar.activeBorder'] ?? accent,
        'activityBar.activeFocusBorder': overrides['activityBar.activeFocusBorder'] ?? accent,
        'tab.activeBorderTop': overrides['tab.activeBorderTop'] ?? accent,
        'tab.activeBorder': overrides['tab.activeBorder'] ?? accent,
        'tab.unfocusedActiveBorderTop': overrides['tab.unfocusedActiveBorderTop'] ?? applyAlpha(accent, 0.6),
        'tab.unfocusedActiveBorder': overrides['tab.unfocusedActiveBorder'] ?? applyAlpha(accent, 0.6),
        'tab.activeModifiedBorder': overrides['tab.activeModifiedBorder'] ?? applyAlpha(accent, 0.8),
        'panelTitle.activeBorder': overrides['panelTitle.activeBorder'] ?? accent,
        'sideBarSectionHeader.border': overrides['sideBarSectionHeader.border'] ?? accent,
        'sideBarTitle.border': overrides['sideBarTitle.border'] ?? accent,
      };
    case 'notifications':
      return {
        'activityBarBadge.background': overrides['activityBarBadge.background'] ?? accent,
        'activityBarBadge.foreground': overrides['activityBarBadge.foreground'] ?? foreground,
        'notificationCenterHeader.background': overrides['notificationCenterHeader.background'] ?? accent,
        'notificationCenterHeader.foreground': overrides['notificationCenterHeader.foreground'] ?? foreground,
        'notificationLink.foreground': overrides['notificationLink.foreground'] ?? accent,
        'notifications.background': overrides['notifications.background'] ?? applyAlpha(accent, 0.08),
        'notifications.border': overrides['notifications.border'] ?? applyAlpha(accent, 0.4),
      };
    case 'statusBar':
      const darkened = darkenColor(accent, 0.65);
      const darkForeground = getContrastColor(darkened);
      return {
        'statusBar.background': overrides['statusBar.background'] ?? darkened,
        'statusBar.foreground': overrides['statusBar.foreground'] ?? darkForeground,
        'statusBar.debuggingBackground': overrides['statusBar.debuggingBackground'] ?? accent,
        'statusBar.debuggingForeground': overrides['statusBar.debuggingForeground'] ?? foreground,
        'statusBarItem.hoverBackground': overrides['statusBarItem.hoverBackground'] ?? applyAlpha(accent, 0.85),
        'statusBar.noFolderBackground': overrides['statusBar.noFolderBackground'] ?? darkened,
      };
    case 'sidebar':
      return {
        'sideBar.background': overrides['sideBar.background'] ?? accent,
        'sideBar.foreground': overrides['sideBar.foreground'] ?? foreground,
        'sideBar.border': overrides['sideBar.border'] ?? applyAlpha(accent, 0.4),
      };
    case 'panel':
      return {
        'panel.background': overrides['panel.background'] ?? applyAlpha(accent, 0.08),
        'panel.border': overrides['panel.border'] ?? applyAlpha(accent, 0.4),
        'panelTitle.activeForeground': overrides['panelTitle.activeForeground'] ?? foreground,
        'panelTitle.inactiveForeground': overrides['panelTitle.inactiveForeground'] ?? applyAlpha(foreground, 0.6),
      };
    case 'editor':
      return {
        'editor.selectionBackground': overrides['editor.selectionBackground'] ?? applyAlpha(accent, 0.35),
        'editor.selectionHighlightBackground': overrides['editor.selectionHighlightBackground'] ?? applyAlpha(accent, 0.2),
        'editor.lineHighlightBackground': overrides['editor.lineHighlightBackground'] ?? applyAlpha(accent, 0.08),
        'editorCursor.foreground': overrides['editorCursor.foreground'] ?? accent,
      };
    case 'lists':
      return {
        'list.activeSelectionBackground': overrides['list.activeSelectionBackground'] ?? applyAlpha(accent, 0.35),
        'list.inactiveSelectionBackground': overrides['list.inactiveSelectionBackground'] ?? applyAlpha(accent, 0.2),
        'list.hoverBackground': overrides['list.hoverBackground'] ?? applyAlpha(accent, 0.15),
        'list.focusBackground': overrides['list.focusBackground'] ?? applyAlpha(accent, 0.25),
        'list.highlightForeground': overrides['list.highlightForeground'] ?? accent,
      };
    case 'buttons':
      return {
        'button.background': overrides['button.background'] ?? accent,
        'button.hoverBackground': overrides['button.hoverBackground'] ?? applyAlpha(accent, 0.85),
        'button.foreground': overrides['button.foreground'] ?? foreground,
      };
    case 'badges':
      return {
        'badge.background': overrides['badge.background'] ?? accent,
        'badge.foreground': overrides['badge.foreground'] ?? foreground,
      };
    default:
      return {};
  }
}

function buildAccentColorMapForSection(
  sectionId: string,
  accent: string | undefined,
  overrides: Record<string, string>
): Record<string, string> {
  const map: Record<string, string> = {};
  for (const group of ACCENT_GROUPS) {
    if (group.section !== sectionId) {
      continue;
    }
    Object.assign(map, buildAccentColorMapForGroup(group.id, accent, overrides));
  }
  return map;
}

function buildAccentColorMapFromConfig(
  baseAccent: string | undefined,
  sectionAccents: Record<string, string> | undefined,
  groupAccents: Record<string, string> | undefined,
  sectionInherit: Record<string, boolean> | undefined,
  groupInherit: Record<string, boolean> | undefined,
  overrides: Record<string, string> | undefined,
  highlightBoost: number | undefined
): Record<string, string> {
  const map: Record<string, string> = {};
  for (const group of ACCENT_GROUPS) {
    if (group.section === 'harbormaster') {
      continue;
    }
    const explicitSection = sectionAccents?.[group.section];
    const sectionUsesInherit = Boolean(sectionInherit?.[group.section]) || !explicitSection;
    const sectionBase =
      baseAccent && sectionUsesInherit
        ? applySectionInheritBoost(baseAccent, group.section, highlightBoost)
        : undefined;
    const sectionColor = sectionUsesInherit ? sectionBase : explicitSection;
    const explicitGroup = groupAccents?.[group.id];
    const groupUsesInherit = Boolean(groupInherit?.[group.id]) || !explicitGroup;
    const groupColor = groupUsesInherit ? sectionColor : explicitGroup;
    const color = groupColor ?? sectionColor ?? baseAccent;
    const hasOverrides = group.keys.some((key) => overrides?.[key]);
    if (!color && !hasOverrides) {
      continue;
    }
    Object.assign(map, buildAccentColorMapForGroup(group.id, color, overrides ?? {}));
  }
  return map;
}

function removeAccentCustomizations(current: Record<string, unknown>): { mutated: boolean; next: Record<string, unknown> } {
  let mutated = false;
  const next = { ...current };
  for (const key of ACCENT_COLOR_KEYS) {
    if (key in next) {
      delete next[key];
      mutated = true;
    }
  }
  return { mutated, next };
}

function deriveVersion(
  explicit: string | undefined,
  major: number | undefined,
  minor: number | undefined,
  patch: number | undefined,
  prerelease: string | undefined
): string | undefined {
  const normalizedMajor = major ?? 0;
  const normalizedMinor = minor ?? 0;
  const normalizedPatch = patch ?? 0;
  const baseVersion = `${normalizedMajor}.${normalizedMinor}.${normalizedPatch}`;
  const composed = prerelease ? `${baseVersion}-${prerelease}` : baseVersion;

  if (explicit && isSemverCompliant(explicit)) {
    return explicit;
  }

  if (isSemverCompliant(composed)) {
    return composed;
  }

  return undefined;
}

function isSemverCompliant(version: string): boolean {
  return /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-.]+)?(?:\+[0-9A-Za-z-.]+)?$/.test(version);
}

async function showMenu(): Promise<void> {
  if (!trackerSingleton) {
    void vscode.window.showErrorMessage('Harbormaster: tracker not initialized.');
    return;
  }

  const items: vscode.QuickPickItem[] = [
    { label: 'Create project config', description: 'Prompt for name/version and write .harbormaster/.meta/project.json' },
    { label: 'Open project config', description: 'Open or create the configured .harbormaster/.meta/project.json' },
    { label: 'Color settings', description: 'Open the accent color settings view' },
    { label: 'Clear color settings', description: 'Clear accent color customizations' },
    { label: 'Rebuild project state', description: 'Create missing Harbormaster files and migrate legacy metadata' },
    { label: 'Add project to catalog', description: 'Save current project entry to the catalog' },
    { label: 'Open project from catalog', description: 'Pick and open a saved Harbormaster project' },
    { label: 'Add global tag', description: 'Create a tag available to all projects' },
    { label: 'Assign tag to project', description: 'Attach an existing tag to this project' },
    { label: 'Remove tag from project', description: 'Detach an assigned tag' },
    { label: 'Remove global tag', description: 'Delete a tag from the registry (removes from projects)' },
  ];

  const selection = await vscode.window.showQuickPick(items, {
    placeHolder: 'Harbormaster actions',
    canPickMany: false,
  });

  if (!selection) {
    return;
  }

  if (selection.label === 'Create project config') {
    await createProjectConfig();
    return;
  }

  if (selection.label === 'Open project config') {
    await openProjectConfig();
    return;
  }

  if (selection.label === 'Color settings') {
    await openWindowAccentPicker();
    return;
  }

  if (selection.label === 'Clear color settings') {
    await resetWindowAccentColor();
    return;
  }

  if (selection.label === 'Rebuild project state') {
    await trackerSingleton.rebuildHarbormasterState();
    return;
  }

  if (selection.label === 'Add project to catalog') {
    await trackerSingleton.addProjectToCatalog();
    return;
  }

  if (selection.label === 'Open project from catalog') {
    await trackerSingleton.openProjectFromCatalog();
    return;
  }

  if (selection.label === 'Add global tag') {
    await trackerSingleton.addGlobalTag();
    return;
  }

  if (selection.label === 'Assign tag to project') {
    await trackerSingleton.assignTagToProject();
    return;
  }

  if (selection.label === 'Remove tag from project') {
    await trackerSingleton.removeProjectTag();
    return;
  }

  if (selection.label === 'Remove global tag') {
    await trackerSingleton.removeGlobalTag();
    return;
  }
}


async function resetWindowAccentColor(): Promise<void> {
  if (!trackerSingleton) {
    void vscode.window.showErrorMessage('Harbormaster: tracker not initialized.');
    return;
  }
  await trackerSingleton.resetWindowAccentColor();
  void vscode.window.showInformationMessage('Harbormaster: reset window accent.');
}

async function applyWindowAccentToWorkspace(
  folder: vscode.WorkspaceFolder,
  baseAccent: string | undefined,
  sectionAccents: Record<string, string> | undefined,
  groupAccents: Record<string, string> | undefined,
  sectionInherit: Record<string, boolean> | undefined,
  groupInherit: Record<string, boolean> | undefined,
  overrides: Record<string, string> | undefined,
  highlightBoost: number | undefined
): Promise<void> {
  const normalizedBase = normalizeAccentColor(baseAccent);
  const normalizedSections = normalizeAccentSections(sectionAccents);
  const normalizedGroups = normalizeAccentGroups(groupAccents);
  const normalizedSectionInherit = normalizeAccentSectionInherit(sectionInherit);
  const normalizedGroupInherit = normalizeAccentGroupInherit(groupInherit);
  const normalizedOverrides = normalizeAccentOverrides(overrides);
  const normalizedHighlightBoost = normalizeAccentHighlightBoost(highlightBoost);
  const accentMap = buildAccentColorMapFromConfig(
    normalizedBase,
    normalizedSections,
    normalizedGroups,
    normalizedSectionInherit,
    normalizedGroupInherit,
    normalizedOverrides,
    normalizedHighlightBoost
  );
  const workbenchConfig = vscode.workspace.getConfiguration('workbench', folder.uri);
  const existing = workbenchConfig.get<Record<string, unknown>>('colorCustomizations');
  const current = existing && typeof existing === 'object' ? { ...existing } : {};
  if (Object.keys(accentMap).length === 0) {
    const cleaned = removeAccentCustomizations(current);
    if (cleaned.mutated) {
      await workbenchConfig.update('colorCustomizations', cleaned.next, vscode.ConfigurationTarget.Workspace);
    }
    return;
  }
  const next: Record<string, unknown> = { ...current };
  for (const key of ACCENT_COLOR_KEYS) {
    if (!(key in accentMap) && key in next) {
      delete next[key];
    }
  }
  Object.assign(next, accentMap);

  const changed = Object.keys(next).some((key) => current[key] !== next[key]) || Object.keys(current).some((key) => !(key in next));
  if (!changed) {
    return;
  }
  await workbenchConfig.update('colorCustomizations', next, vscode.ConfigurationTarget.Workspace);
}

function buildTitle(projectInfo: ProjectInfo, settings: ExtensionSettings): string {
  const { name, version } = projectInfo;

  if (name) {
    const useVersion = settings.showVersion && Boolean(version);
    const template = useVersion ? settings.versionFormat : settings.namedFormat;
    return applyTemplate(template, name, version);
  }

  const baseTemplate = getBaseTitleTemplate();
  return `${settings.headlessPrefix}${baseTemplate}`;
}

function applyTemplate(template: string, name: string, version?: string): string {
  return template
    .replace(/\${projectName}/g, name)
    .replace(/\${projectVersion}/g, version ?? '');
}

function getBaseTitleTemplate(): string {
  const windowConfig = vscode.workspace.getConfiguration('window');
  const inspected = windowConfig.inspect<string>('title');

  if (inspected?.globalValue) {
    return inspected.globalValue;
  }

  if (inspected?.defaultValue) {
    return inspected.defaultValue;
  }

  return FALLBACK_TITLE_TEMPLATE;
}

async function fileExists(uri: vscode.Uri): Promise<boolean> {
  try {
    await vscode.workspace.fs.stat(uri);
    return true;
  } catch {
    return false;
  }
}

async function ensureDirectoryForFile(targetUri: vscode.Uri): Promise<void> {
  const segments = targetUri.path.split('/');
  if (segments.length <= 1) {
    return;
  }
  segments.pop();
  const dirPath = segments.join('/') || '/';
  const dirUri = targetUri.with({ path: dirPath });
  await vscode.workspace.fs.createDirectory(dirUri);
}

function normalizeTag(value: string | undefined): string {
  return (value ?? '').trim();
}

function dedupeTags(tags: unknown[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const tag of tags) {
    if (typeof tag !== 'string') {
      continue;
    }
    const normalized = normalizeTag(tag);
    if (!normalized) {
      continue;
    }
    const key = normalized.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      result.push(normalized);
    }
  }
  return result;
}

function formatIsoDate(value: string | undefined): string {
  if (!value) {
    return 'N/A';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString();
}
