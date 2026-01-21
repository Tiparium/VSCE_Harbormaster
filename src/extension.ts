import * as vscode from 'vscode';

const DEFAULT_META_DIR = '.harbormaster/.meta';
const DEFAULT_CONTEXT_DIR = '.harbormaster/.context';
const DEFAULT_CONFIG_FILE = `${DEFAULT_META_DIR}/project.json`;
const DEFAULT_PROJECT_KEY = 'project_name';
const DEFAULT_VERSION_KEY = 'project_version';
const DEFAULT_VERSION_MAJOR_KEY = 'version_major';
const DEFAULT_VERSION_MINOR_KEY = 'version_minor';
const DEFAULT_VERSION_PRERELEASE_KEY = 'version_prerelease';
const DEFAULT_TAGS_FILE = `${DEFAULT_META_DIR}/tags.json`;
const DEFAULT_PROJECTS_FILE = 'projects.json';
const REQUIRED_CONTEXT_FILES = [
  'DIRECTIVES.md',
  'PROJECT_STATE.md',
  'PERSONALITY.md',
  'DOCUMENTS.md',
  'SHELF.md',
];
const LEGACY_CONFIG_FILE = '.project.json';
const LEGACY_META_DIR = '.harbormaster';
const LEGACY_CONTEXT_DIR = '.context';
const AGENTS_FILE_CANDIDATES = ['AGENTS.md', 'agents.md'];
const AGENTS_DIRECTIVES_MARKER = 'Harbormaster directives notice';
const DIRECTIVES_TEMPLATE = [
  '## Local "Working Memory" system (two files, stored in `.harbormaster/.context/`)',
  '* All important commands must be recorded in `.harbormaster/.context/DOCUMENTS.md`.',
  '',
  '### File 1: `PROJECT_STATE.md` (small, always read)',
  '',
  '**Purpose:** Current working context that should be loaded at the start of every session/task.',
  '',
  '**Hard rules:**',
  '',
  '* Keep this file **short** (aim ~10-40 lines). It is a snapshot, not a diary.',
  '* The agent must **read this file before doing any work**.',
  '* The agent should **update this file only when the project state changes** (goal/plan/constraints/etc.), not every message.',
  '',
  '**Suggested sections (keep terse):**',
  '',
  '* **Goal (current):** what we are trying to accomplish right now',
  '* **Constraints:** must-follow rules, naming conventions, environment notes',
  '* **Current plan:** 3-7 bullet steps',
  '* **Status:** what is done / what is next',
  '* **Open questions:** unknowns blocking progress',
  '* **Assumptions (active):** key assumptions currently being relied upon (bullets)',
  '',
  '### File 2: `DECISIONS_LOG.md` (append-only)',
  '',
  '**Purpose:** A durable record of important decisions so the project does not "forget why."',
  '',
  '**Rules:**',
  '',
  '* Append entries only when something is decided/changed that would matter later.',
  '* Each entry should be short and include:',
  '',
  '  * **Date**',
  '  * **Decision**',
  '  * **Reason**',
  '  * **Impact / files touched** (paths if relevant)',
  '',
  '**Format example:**',
  '',
  '* `2025-12-15 — Decision: Use dual-file memory. Reason: state stays small; decisions stay traceable. Impact: added PROJECT_STATE.md and DECISIONS_LOG.md.`',
  '',
  '---',
  '',
  '## Required behavior: Assumptions must be surfaced',
  '',
  'Whenever the agent takes an action **because of an assumption**, the agent must explicitly state it in its reply, e.g.:',
  '',
  '* **Assumption used:** "We are using Node 20 because the repo targets it."',
  '* **If unsure:** "This is an assumption—please confirm or correct."',
  '',
  'And if the assumption is new or changed, it must also be added/updated in:',
  '',
  '* `PROJECT_STATE.md` → **Assumptions (active)**',
  '* Any new CLI commands must be documented in `./run help`.',
  '',
  '## MISSING FILES',
  'If a file is in `.harbormaster/.context` that is not mentioned above, query the user as to its purpose.',
  '',
  '---',
  '',
  '## Operating loop',
  '',
  '1. **Start of session/task:** read `PROJECT_STATE.md`, `PERSONALITY.md`, and `DOCUMENTS.md` (once per session unless you need to edit it or are explicitly told to reread).',
  '2. Do the work.',
  '3. If state changed: update `PROJECT_STATE.md` (keep it compact).',
  '4. If a major notable decision was made (architecture/behavioral choices, not routine maintenance): append to `DECISIONS_LOG.md`.',
  '5. In replies: always surface any **Assumption used** that influenced the work.',
  '',
  '## Self-tracking reminders',
  '- Check `.harbormaster/.context/SHELF.md` occasionally and surface shelved items when working on related topics.',
  '',
  '## Instructions',
  '- Run a Self Check: reread all context files and summarize differences from working memory.',
  '',
  '## User-added directives',
  '- Add any directives you request here to keep them grouped and easy to find.',
  '',
].join('\n');
const AGENTS_TEMPLATE = [
  '# AGENTS',
  '',
  'Move most directive content into `.harbormaster/.context/DIRECTIVES.md`,',
  'then remove those moved directives and this notice block from this file.',
  'Keep this file as the entrypoint that references DIRECTIVES.md.',
  '',
  'See `.harbormaster/.context/DIRECTIVES.md` for most directives.',
  '',
].join('\n');
const AGENTS_DIRECTIVES_NOTICE = [
  `## ${AGENTS_DIRECTIVES_MARKER}`,
  'Move most directive content into `.harbormaster/.context/DIRECTIVES.md`,',
  'then remove those moved directives and this notice block from this file.',
  'Keep this file as the entrypoint that references DIRECTIVES.md.',
  'This is manual to avoid automation conflicts.',
  '',
].join('\n');
const DEFAULT_CONTEXT_FILE_CONTENTS: Record<string, string> = {
  'DIRECTIVES.md': DIRECTIVES_TEMPLATE,
  'PROJECT_STATE.md': [
    '# PROJECT STATE',
    '',
    '## Current goals',
    '- ',
    '',
    '## Constraints / assumptions',
    '- ',
    '',
    '## Plan',
    '- ',
    '',
    '## Status',
    '- ',
    '',
    '## Open questions',
    '- ',
    '',
    '## Active assumptions',
    '- ',
    '',
  ].join('\n'),
  'PERSONALITY.md': ['Tone: ', ''].join('\n'),
  'DOCUMENTS.md': ['# Command Reference', ''].join('\n'),
  'SHELF.md': [
    '## Shelf',
    '',
    '### Immediate Shelf',
    '0) #',
    '1) #',
    '2) #',
    '3) #',
    '4) #',
    '5) #',
    '6) #',
    '7) #',
    '8) #',
    '9) #',
    '',
    '### Top Shelf',
    '',
    '### Middle Shelf',
    '',
    '### Bottom Shelf',
    '',
    '### Long Term',
    '',
    '### Completed',
    '',
  ].join('\n'),
};
const DEFAULT_HEADLESS_PREFIX = '[Headless] ';
const DEFAULT_NAMED_FORMAT = '${projectName}';
const DEFAULT_VERSION_FORMAT = '${projectName} (${projectVersion})';
const DEFAULT_SHOW_VERSION = false;
const FALLBACK_TITLE_TEMPLATE = '${dirty}${activeEditorShort}${separator}${rootName}${separator}${appName}';

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
  projectVersionPrereleaseKey: string;
  showVersion: boolean;
  versionFormat: string;
  headlessPrefix: string;
  namedFormat: string;
}

interface ProjectInfo {
  name?: string;
  version?: string;
  tags?: string[];
}

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

let trackerSingleton: ProjectTracker | undefined;

class StatusBarController implements vscode.Disposable {
  private readonly item: vscode.StatusBarItem;

  constructor() {
    this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    this.item.text = '$(symbol-misc) Harbormaster';
    this.item.command = 'projectWindowTitle.showMenu';
    this.item.tooltip = 'Harbormaster menu';
    this.item.show();
  }

  dispose(): void {
    this.item.dispose();
  }
}

class ProjectTracker implements vscode.Disposable {
  private readonly onDidChangeEmitter = new vscode.EventEmitter<void>();
  readonly onDidChange = this.onDidChangeEmitter.event;
  private disposables: vscode.Disposable[] = [];
  private initialized = false;
  private watchers: vscode.FileSystemWatcher[] = [];
  private diagnostics?: vscode.DiagnosticCollection;
  private treeView?: vscode.TreeView<TreeNode>;

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
    await this.backupTagsFile(folder, settings);
    await this.ensureCatalogFile(settings);
    await this.migrateWorkspaceCatalog(folder, settings);
    await this.upsertCatalogEntry(folder, settings, { silent: true });
    this.registerWatchers(folder, settings);
    await this.refreshHealth();
    this.initialized = true;
  }

  setHealthIndicators(view: vscode.TreeView<TreeNode>, diagnostics: vscode.DiagnosticCollection): void {
    this.treeView = view;
    this.diagnostics = diagnostics;
    void this.refreshHealth();
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

  async addGlobalTag(): Promise<void> {
    const folder = getPrimaryWorkspaceFolder();
    if (!folder) {
      void vscode.window.showErrorMessage('Harbormaster: No workspace folder open.');
      return;
    }

    await this.ensureInitialized();
    const settings = getExtensionSettings();
    const tags = await this.readTagsFile(folder, settings);
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
    await this.writeTagsFile(folder, settings, tags);
    this.onDidChangeEmitter.fire();
    void vscode.window.showInformationMessage(`Harbormaster: added tag "${normalized}".`);
  }

  async removeGlobalTag(): Promise<void> {
    const folder = getPrimaryWorkspaceFolder();
    if (!folder) {
      void vscode.window.showErrorMessage('Harbormaster: No workspace folder open.');
      return;
    }

    await this.ensureInitialized();
    const settings = getExtensionSettings();
    const tags = await this.readTagsFile(folder, settings);
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
    await this.writeTagsFile(folder, settings, remaining);
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
    const tags = await this.readTagsFile(folder, settings);
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
    const tagsUri = vscode.Uri.joinPath(folder.uri, settings.tagsFile);
    const legacyMetaConfigUri = vscode.Uri.joinPath(folder.uri, LEGACY_META_DIR, 'project.json');
    const legacyConfigUri = vscode.Uri.joinPath(folder.uri, LEGACY_CONFIG_FILE);
    const legacyTagsUri = vscode.Uri.joinPath(folder.uri, LEGACY_META_DIR, 'tags.json');

    const newConfigExists = await fileExists(configUri);
    const newTagsExists = await fileExists(tagsUri);
    const newConfigCorrupt = newConfigExists ? await this.isJsonCorrupt(configUri) : false;
    const newTagsCorrupt = newTagsExists ? await this.isJsonCorrupt(tagsUri) : false;

    const newConfig = newConfigExists && !newConfigCorrupt ? await this.readConfig(configUri) : undefined;
    const newTags = newTagsExists && !newTagsCorrupt ? await this.readTagsFile(folder, settings) : undefined;

    const legacyMetaConfigExists = await fileExists(legacyMetaConfigUri);
    const legacyConfigExists = await fileExists(legacyConfigUri);
    const legacyTagsExists = await fileExists(legacyTagsUri);

    const legacyMetaConfigCorrupt = legacyMetaConfigExists ? await this.isJsonCorrupt(legacyMetaConfigUri) : false;
    const legacyConfigCorrupt = legacyConfigExists ? await this.isJsonCorrupt(legacyConfigUri) : false;
    const legacyTagsCorrupt = legacyTagsExists ? await this.isJsonCorrupt(legacyTagsUri) : false;

    if (newConfigCorrupt) {
      result.warnings.push(`${settings.configFile} is not valid JSON`);
    }
    if (newTagsCorrupt) {
      result.warnings.push(`${settings.tagsFile} is not valid JSON`);
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

    const legacyConfig =
      legacyMetaConfigExists && !legacyMetaConfigCorrupt
        ? await this.readConfig(legacyMetaConfigUri)
        : legacyConfigExists && !legacyConfigCorrupt
          ? await this.readConfig(legacyConfigUri)
          : undefined;
    const legacyTags = legacyTagsExists && !legacyTagsCorrupt ? await this.readTagsFile(folder, settings, legacyTagsUri) : undefined;

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

    const shouldWriteTags = legacyTags !== undefined || !newTagsExists;
    if (shouldWriteTags) {
      const mergedTags = legacyTags ?? newTags ?? [];
      if (!newTagsExists || newTagsCorrupt) {
        result.created.push(settings.tagsFile);
      } else {
        result.updated.push(settings.tagsFile);
      }
      await this.writeTagsFile(folder, settings, mergedTags);
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
      await vscode.workspace.fs.delete(legacyTagsUri);
      result.deleted.push(`${LEGACY_META_DIR}/tags.json`);
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
      version_prerelease: '',
      tags: [],
      version_scheme_note:
        'version = <major>.<minor>.<YY>-<prerelease>; YY is last two digits of build year (computed automatically); prerelease is optional.',
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

    const tagsUri = vscode.Uri.joinPath(folder.uri, settings.tagsFile);
    if (!(await fileExists(tagsUri))) {
      await this.ensureTagsFile(folder, settings);
      created.push(settings.tagsFile);
    } else if (await this.isJsonCorrupt(tagsUri)) {
      warnings.push(`${settings.tagsFile} is not valid JSON`);
    }

    for (const name of REQUIRED_CONTEXT_FILES) {
      const relativePath = `${DEFAULT_CONTEXT_DIR}/${name}`;
      const uri = vscode.Uri.joinPath(folder.uri, relativePath);
      if (await fileExists(uri)) {
        continue;
      }
      const payload = DEFAULT_CONTEXT_FILE_CONTENTS[name] ?? '';
      await this.ensureDirectory(uri);
      await vscode.workspace.fs.writeFile(uri, Buffer.from(payload, 'utf8'));
      created.push(relativePath);
    }

    const agentsUri = await this.findAgentsFile(folder);
    if (!agentsUri) {
      const target = vscode.Uri.joinPath(folder.uri, AGENTS_FILE_CANDIDATES[0]);
      await this.ensureDirectory(target);
      await vscode.workspace.fs.writeFile(target, Buffer.from(AGENTS_TEMPLATE, 'utf8'));
      created.push(AGENTS_FILE_CANDIDATES[0]);
    }

    return { created, warnings };
  }

  private async refreshHealth(): Promise<void> {
    if (!this.diagnostics) {
      return;
    }
    const folder = getPrimaryWorkspaceFolder();
    if (!folder) {
      this.diagnostics.clear();
      if (this.treeView) {
        this.treeView.badge = undefined;
      }
      return;
    }

    const settings = getExtensionSettings();
    const missing = await this.getMissingRequiredFiles(folder, settings);
    const corrupt = await this.getCorruptJsonFiles(folder, settings);
    const legacy = await this.getLegacyMetadataFiles(folder, settings);
    this.updateDiagnostics(folder, missing, corrupt, legacy);
    if (this.treeView) {
      const issues = [
        ...(missing.length ? [`Missing Harbormaster files:\n- ${missing.join('\n- ')}`] : []),
        ...(corrupt.length ? [`Corrupt JSON:\n- ${corrupt.join('\n- ')}`] : []),
        ...(legacy.length ? [`Legacy Harbormaster metadata:\n- ${legacy.join('\n- ')}`] : []),
      ];
      this.treeView.badge =
        issues.length > 0
          ? {
              value: missing.length + corrupt.length + legacy.length,
              tooltip: issues.join('\n'),
            }
          : undefined;
    }
  }

  private async getMissingRequiredFiles(
    folder: vscode.WorkspaceFolder,
    settings: ExtensionSettings
  ): Promise<string[]> {
    const missing: string[] = [];
    const requiredPaths = [
      settings.configFile,
      settings.tagsFile,
      ...REQUIRED_CONTEXT_FILES.map((name) => `${DEFAULT_CONTEXT_DIR}/${name}`),
    ];

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
    const candidates = [settings.configFile, settings.tagsFile];
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

  private async ensureTagsFile(folder: vscode.WorkspaceFolder, settings: ExtensionSettings): Promise<void> {
    const tagsUri = vscode.Uri.joinPath(folder.uri, settings.tagsFile);
    if (await fileExists(tagsUri)) {
      return;
    }
    await this.ensureDirectory(tagsUri);
    await this.writeTagsFile(folder, settings, []);
  }

  private async readTagsFile(
    folder: vscode.WorkspaceFolder,
    settings: ExtensionSettings,
    overrideUri?: vscode.Uri
  ): Promise<string[]> {
    const tagsUri = overrideUri ?? vscode.Uri.joinPath(folder.uri, settings.tagsFile);
    try {
      const content = await vscode.workspace.fs.readFile(tagsUri);
      const parsed = JSON.parse(Buffer.from(content).toString('utf8')) as TagConfig;
      if (Array.isArray(parsed.tags)) {
        return dedupeTags(parsed.tags);
      }
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code && code !== 'ENOENT') {
        console.warn(`Harbormaster: unable to read tags file ${tagsUri.fsPath}:`, error);
      }
    }
    return [];
  }

  private async writeTagsFile(folder: vscode.WorkspaceFolder, settings: ExtensionSettings, tags: string[]): Promise<void> {
    const tagsUri = vscode.Uri.joinPath(folder.uri, settings.tagsFile);
    await this.ensureDirectory(tagsUri);
    const payload: TagConfig = { tags: dedupeTags(tags).sort((a, b) => a.localeCompare(b)) };
    await vscode.workspace.fs.writeFile(tagsUri, Buffer.from(JSON.stringify(payload, null, 2) + '\n', 'utf8'));
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
      const code = (error as NodeJS.ErrnoException).code;
      if (code && code !== 'ENOENT' && code !== 'EntryNotFound') {
        console.warn(`Harbormaster: unable to read file ${uri.fsPath}:`, error);
      }
    }
    return {};
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
      new vscode.RelativePattern(folder, settings.tagsFile),
      new vscode.RelativePattern(folder, LEGACY_CONFIG_FILE),
      new vscode.RelativePattern(folder, `${LEGACY_META_DIR}/project.json`),
      new vscode.RelativePattern(folder, `${LEGACY_META_DIR}/tags.json`),
      ...REQUIRED_CONTEXT_FILES.map((name) => new vscode.RelativePattern(folder, `${DEFAULT_CONTEXT_DIR}/${name}`)),
      ...AGENTS_FILE_CANDIDATES.map((name) => new vscode.RelativePattern(folder, name)),
    ];

    for (const pattern of patterns) {
      const watcher = vscode.workspace.createFileSystemWatcher(pattern);
      const shouldAutoCatalog =
        pattern.pattern === settings.configFile || pattern.pattern === settings.tagsFile || pattern.pattern === LEGACY_CONFIG_FILE;
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

class ActionTreeProvider implements vscode.TreeDataProvider<TreeNode> {
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<TreeNode | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<void | TreeNode | TreeNode[] | null | undefined> =
    this._onDidChangeTreeData.event;
  private readonly tracker: ProjectTracker;
  private readonly viewDescription: string;

  constructor(tracker: ProjectTracker, version: string, devToolsEnabled: boolean) {
    this.tracker = tracker;
    this.tracker.onDidChange(() => this.refresh());
    this.viewDescription = `${version}${devToolsEnabled ? ' [DEV]' : ''}`;
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getDescription(): string {
    return this.viewDescription;
  }

  getTreeItem(element: TreeNode): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: TreeNode): Promise<TreeNode[]> {
    if (element instanceof SectionTreeItem) {
      return element.items;
    }

    const sections: SectionTreeItem[] = [];
    const folder = getPrimaryWorkspaceFolder();
    const settings = getExtensionSettings();
    const configExists = folder ? await fileExists(vscode.Uri.joinPath(folder.uri, settings.configFile)) : false;
    const tagsExists = folder ? await fileExists(vscode.Uri.joinPath(folder.uri, settings.tagsFile)) : false;
    const projectsExists = await this.tracker.catalogExists();
    const inCatalog = folder ? await this.tracker.isProjectInCatalog(folder, settings) : false;

    const info = await this.tracker.getCurrentProjectInfo(settings);
    const infoItems: ActionTreeItem[] = [
      new ActionTreeItem(`Name: ${info?.name ?? 'Not set'}`, '', 'account'),
      new ActionTreeItem(`Version: ${info?.version ?? 'Not set'}`, '', 'versions'),
      new ActionTreeItem(`Tags: ${info?.tags && info.tags.length ? info.tags.join(', ') : 'None'}`, '', 'tag'),
    ].map((item) => {
      item.contextValue = 'infoItem';
      item.command = undefined;
      return item;
    });

    const projectItems: ActionTreeItem[] = [
      configExists
        ? new ActionTreeItem('Open project config', 'projectWindowTitle.openConfig', 'go-to-file')
        : new ActionTreeItem('Create project config', 'projectWindowTitle.createConfig', 'file-add'),
      new ActionTreeItem('Refresh window title', 'projectWindowTitle.refresh', 'refresh'),
      new ActionTreeItem('Rebuild project state', 'projectWindowTitle.rebuildState', 'tools'),
    ];
    if (!inCatalog && folder) {
      projectItems.push(new ActionTreeItem('Add current project to catalog', 'projectWindowTitle.addProjectToCatalog', 'add'));
    }

    const globalTagItems: ActionTreeItem[] = [
      new ActionTreeItem('Add global tag', 'projectWindowTitle.addGlobalTag', 'add'),
      ...(tagsExists
        ? [new ActionTreeItem('Remove global tag', 'projectWindowTitle.removeGlobalTag', 'trash')]
        : []),
    ];

    const projectTagItems: ActionTreeItem[] = tagsExists
      ? [
          new ActionTreeItem('Assign tag to project', 'projectWindowTitle.assignTag', 'tag'),
          new ActionTreeItem('Remove tag from project', 'projectWindowTitle.removeProjectTag', 'discard'),
        ]
      : [];

    const utilityItems: ActionTreeItem[] = [
      new ActionTreeItem('Command palette (menu)', 'projectWindowTitle.showMenu', 'list-selection'),
    ];

    sections.push(
      new SectionTreeItem(
        'Projects',
        [
          new ActionTreeItem('Open project from catalog', 'projectWindowTitle.openProjectFromCatalog', 'folder-opened'),
          ...(inCatalog || !folder
            ? []
            : [new ActionTreeItem('Add current project to catalog', 'projectWindowTitle.addProjectToCatalog', 'add')]),
        ],
        'repo',
        projectsExists ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.Collapsed
      )
    );
    sections.push(new SectionTreeItem('Info', infoItems, 'info'));
    sections.push(new SectionTreeItem('Project', projectItems, 'briefcase'));
    sections.push(
      new SectionTreeItem(
        'Tags',
        [
          new SectionTreeItem('Global tags', globalTagItems, 'organization', vscode.TreeItemCollapsibleState.Expanded),
          new SectionTreeItem(
            'Project tags',
            projectTagItems.length ? projectTagItems : [new ActionTreeItem('No tags assigned', '', 'tag')],
            'tag',
            vscode.TreeItemCollapsibleState.Expanded
          ),
        ],
        'tag'
      )
    );
    sections.push(new SectionTreeItem('Utility', utilityItems, 'settings-gear', vscode.TreeItemCollapsibleState.Collapsed));

    return sections;
  }
}

class ActionTreeItem extends vscode.TreeItem {
  constructor(label: string, commandId: string, iconId: string) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.command = { command: commandId, title: label };
    this.iconPath = new vscode.ThemeIcon(iconId);
  }
}

type TreeNode = ActionTreeItem | SectionTreeItem;

class SectionTreeItem extends vscode.TreeItem {
  constructor(
    label: string,
    public readonly items: TreeNode[],
    iconId: string,
    collapsibleState: vscode.TreeItemCollapsibleState = vscode.TreeItemCollapsibleState.Expanded
  ) {
    super(label, collapsibleState);
    this.iconPath = new vscode.ThemeIcon(iconId);
    this.contextValue = 'harbormasterSection';
  }
}

export function activate(context: vscode.ExtensionContext): void {
  const tracker = new ProjectTracker(context);
  trackerSingleton = tracker;
  const controller = new TitleController(tracker);
  const version = context.extension.packageJSON.version as string;
  const actionsProvider = new ActionTreeProvider(tracker, version, isDevToolsEnabled(context));
  const treeView = vscode.window.createTreeView('harbormasterActions', { treeDataProvider: actionsProvider });
  treeView.description = actionsProvider.getDescription();
  const diagnostics = vscode.languages.createDiagnosticCollection('Harbormaster');
  tracker.setHealthIndicators(treeView, diagnostics);
  context.subscriptions.push(
    controller,
    tracker,
    diagnostics,
    vscode.commands.registerCommand('projectWindowTitle.createConfig', () => createProjectConfig()),
    vscode.commands.registerCommand('projectWindowTitle.openConfig', () => openProjectConfig()),
    vscode.commands.registerCommand('projectWindowTitle.showMenu', () => showMenu()),
    vscode.commands.registerCommand('projectWindowTitle.refresh', () => controller.refresh()),
    vscode.commands.registerCommand('projectWindowTitle.rebuildState', () => tracker.rebuildHarbormasterState()),
    vscode.commands.registerCommand('projectWindowTitle.addGlobalTag', () => tracker.addGlobalTag()),
    vscode.commands.registerCommand('projectWindowTitle.removeGlobalTag', () => tracker.removeGlobalTag()),
    vscode.commands.registerCommand('projectWindowTitle.assignTag', () => tracker.assignTagToProject()),
    vscode.commands.registerCommand('projectWindowTitle.removeProjectTag', () => tracker.removeProjectTag()),
    vscode.commands.registerCommand('projectWindowTitle.addProjectToCatalog', () => tracker.addProjectToCatalog()),
    vscode.commands.registerCommand('projectWindowTitle.openProjectFromCatalog', () => tracker.openProjectFromCatalog()),
    new StatusBarController(),
    treeView
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

    if (currentTitle === desiredTitle) {
      return;
    }

    await windowConfig.update('title', desiredTitle, vscode.ConfigurationTarget.Workspace);
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
    projectVersionPrereleaseKey: config.get<string>('projectVersionPrereleaseKey', DEFAULT_VERSION_PRERELEASE_KEY),
    showVersion: config.get<boolean>('showVersion', DEFAULT_SHOW_VERSION),
    versionFormat: config.get<string>('versionFormat', DEFAULT_VERSION_FORMAT),
    headlessPrefix: config.get<string>('headlessPrefix', DEFAULT_HEADLESS_PREFIX),
    namedFormat: config.get<string>('namedFormat', DEFAULT_NAMED_FORMAT),
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

  const payload = {
    project_name: projectName.trim(),
    project_version: (projectVersion ?? '').trim(),
    version_major: 0,
    version_minor: 0,
    version_prerelease: '',
    tags: [],
    version_scheme_note:
      'version = <major>.<minor>.<YY>-<prerelease>; YY is last two digits of build year (computed automatically); prerelease is optional.',
  };

  await ensureDirectoryForFile(targetUri);
  const content = Buffer.from(JSON.stringify(payload, null, 2) + '\n', 'utf8');
  await vscode.workspace.fs.writeFile(targetUri, content);
  if (trackerSingleton) {
    await trackerSingleton.scaffoldProjectState({ silent: true });
  }
  void vscode.window.showInformationMessage(`Harbormaster: wrote ${settings.configFile}.`);
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
    const prerelease = coerceString(parsed?.[settings.projectVersionPrereleaseKey]);
    const tags = await tracker.getProjectTags(parsed);
    const projectVersion = deriveVersion(explicitVersion, major, minor, prerelease);

    return { name: projectName, version: projectVersion, tags };
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code && code !== 'ENOENT' && code !== 'EntryNotFound') {
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

function deriveVersion(explicit: string | undefined, major: number | undefined, minor: number | undefined, prerelease: string | undefined): string | undefined {
  const yearPatch = getYearPatch();
  const normalizedMajor = major ?? 0;
  const normalizedMinor = minor ?? 0;
  const baseVersion = `${normalizedMajor}.${normalizedMinor}.${yearPatch}`;
  const composed = prerelease ? `${baseVersion}-${prerelease}` : baseVersion;

  if (explicit && isSemverCompliant(explicit)) {
    return explicit;
  }

  if (isSemverCompliant(composed)) {
    return composed;
  }

  return undefined;
}

function getYearPatch(): number {
  const now = new Date();
  return now.getFullYear() % 100;
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
