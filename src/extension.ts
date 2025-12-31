import * as vscode from 'vscode';
import { randomBytes, randomUUID } from 'crypto';

const DEFAULT_CONFIG_FILE = '.project.json';
const DEFAULT_PROJECT_KEY = 'project_name';
const DEFAULT_VERSION_KEY = 'project_version';
const DEFAULT_VERSION_MAJOR_KEY = 'version_major';
const DEFAULT_VERSION_MINOR_KEY = 'version_minor';
const DEFAULT_VERSION_PRERELEASE_KEY = 'version_prerelease';
const DEFAULT_TAGS_KEY = 'project_tags';
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
  orphaned?: boolean;
}

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

class ActionTreeProvider implements vscode.TreeDataProvider<ActionTreeItem> {
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<ActionTreeItem | undefined | null | void>();
  private readonly tracker: ProjectTracker;
  readonly onDidChangeTreeData: vscode.Event<void | ActionTreeItem | ActionTreeItem[] | null | undefined> =
    this._onDidChangeTreeData.event;
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

  getTreeItem(element: ActionTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(): Promise<ActionTreeItem[]> {
    const items: ActionTreeItem[] = [];
    const folder = getPrimaryWorkspaceFolder();
    const settings = getExtensionSettings();
    const configExists = folder ? await fileExists(vscode.Uri.joinPath(folder.uri, settings.configFile)) : false;
    const dbExists = await this.tracker.databaseExists();
    const orphaned = folder ? await this.tracker.isOrphaned(folder) : false;

    if (!configExists) {
      items.push(new ActionTreeItem('Create project config', 'projectWindowTitle.createConfig', 'file-add'));
    } else {
      items.push(new ActionTreeItem('Open project config', 'projectWindowTitle.openConfig', 'go-to-file'));
    }

    items.push(new ActionTreeItem('Refresh window title', 'projectWindowTitle.refresh', 'refresh'));

    if (dbExists) {
      items.push(new ActionTreeItem('Open project', 'projectWindowTitle.openProjectFromDatabase', 'folder-opened'));
    } else {
      items.push(new ActionTreeItem('Create database', 'projectWindowTitle.createDatabase', 'database'));
    }

    if (orphaned) {
      items.push(new ActionTreeItem('Reconnect project', 'projectWindowTitle.reconnectProject', 'plug'));
    }

    if (this.tracker.devToolsEnabled) {
      items.push(new ActionTreeItem('Batman (scramble path)', 'projectWindowTitle.devBatman', 'alert'));
    }

    items.push(new ActionTreeItem('Menu', 'projectWindowTitle.showMenu', 'list-unordered'));
    return items;
  }
}

class ActionTreeItem extends vscode.TreeItem {
  constructor(label: string, commandId: string, iconId: string) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.command = { command: commandId, title: label };
    this.iconPath = new vscode.ThemeIcon(iconId);
  }
}

export function activate(context: vscode.ExtensionContext): void {
  const devToolsEnabled = isDevToolsEnabled(context);
  const tracker = new ProjectTracker(context, devToolsEnabled);
  const controller = new TitleController(tracker);
  const version = context.extension.packageJSON.version as string;
  const actionsProvider = new ActionTreeProvider(tracker, version, devToolsEnabled);
  const treeView = vscode.window.createTreeView('harbormasterActions', { treeDataProvider: actionsProvider });
  treeView.description = actionsProvider.getDescription();
  context.subscriptions.push(
    controller,
    tracker,
    vscode.commands.registerCommand('projectWindowTitle.createConfig', () => createProjectConfig(tracker)),
    vscode.commands.registerCommand('projectWindowTitle.openConfig', () => openProjectConfig(tracker)),
    vscode.commands.registerCommand('projectWindowTitle.showMenu', () => showMenu(tracker)),
    vscode.commands.registerCommand('projectWindowTitle.refresh', () => controller.refresh()),
    vscode.commands.registerCommand('projectWindowTitle.createDatabase', () => tracker.createDatabaseWithPrompt(true)),
    vscode.commands.registerCommand('projectWindowTitle.openProjectFromDatabase', () => tracker.pickAndOpenProject()),
    vscode.commands.registerCommand('projectWindowTitle.reconnectProject', () => tracker.reconnectCurrentWorkspace()),
    ...(devToolsEnabled
      ? [
          vscode.commands.registerCommand('projectWindowTitle.devBatman', () => tracker.scrambleCurrentProjectPath()),
        ]
      : []),
    new StatusBarController(),
    treeView
  );

  void vscode.commands.executeCommand('setContext', 'harbormaster.devMode', devToolsEnabled);
  void tracker.ensurePromptedForDatabase();
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

async function createProjectConfig(tracker?: ProjectTracker): Promise<void> {
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
    version_scheme_note:
      'version = <major>.<minor>.<YY>-<prerelease>; YY is last two digits of build year (computed automatically); prerelease is optional.',
  };

  const content = Buffer.from(JSON.stringify(payload, null, 2) + '\n', 'utf8');
  await vscode.workspace.fs.writeFile(targetUri, content);
  void vscode.window.showInformationMessage(`Harbormaster: wrote ${settings.configFile}.`);

  if (tracker) {
    await tracker.addOrUpdateProjectFromWorkspace(folder, { name: payload.project_name });
  }
}

async function openProjectConfig(tracker?: ProjectTracker): Promise<void> {
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

  if (tracker) {
    const parsed = await readProjectInfo(folder, getExtensionSettings(), tracker);
    await tracker.addOrUpdateProjectFromWorkspace(folder, { name: parsed.name, tags: parsed.tags });
  }
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
    const projectVersion = deriveVersion(explicitVersion, major, minor, prerelease);
    const tags = coerceTags(parsed?.[DEFAULT_TAGS_KEY]);
    const orphaned = await tracker.isOrphaned(folder, projectName);

    if (projectName) {
      await tracker.addOrUpdateProjectFromWorkspace(folder, { name: projectName, tags });
    }

    return { name: projectName, version: projectVersion, tags, orphaned };
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code && code !== 'ENOENT') {
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

async function showMenu(tracker?: ProjectTracker): Promise<void> {
  const items: vscode.QuickPickItem[] = [
    { label: 'Create project config', description: 'Prompt for name/version and write .project.json' },
    { label: 'Open project config', description: 'Open or create the configured .project.json' },
    { label: 'Open project from database', description: 'Pick a saved project to open' },
    { label: 'Create projects database', description: 'Set up Harbormaster projects database' },
    { label: 'Reconnect current project', description: 'Update database entry to current path' },
  ];
  if (tracker?.devToolsEnabled) {
    items.push({ label: 'Batman (scramble path)', description: 'Dev: scramble stored path to force orphaning' });
  }

  const selection = await vscode.window.showQuickPick(items, {
    placeHolder: 'Harbormaster actions',
    canPickMany: false,
  });

  if (!selection) {
    return;
  }

  if (selection.label === 'Create project config') {
    await createProjectConfig(tracker);
    return;
  }

  if (selection.label === 'Open project config') {
    await openProjectConfig(tracker);
    return;
  }

  if (selection.label === 'Open project from database' && tracker) {
    await tracker.pickAndOpenProject();
    return;
  }

  if (selection.label === 'Create projects database' && tracker) {
    await tracker.createDatabaseWithPrompt(true);
    return;
  }

  if (selection.label === 'Reconnect current project' && tracker) {
    await tracker.reconnectCurrentWorkspace();
    return;
  }

  if (selection.label === 'Batman (scramble path)' && tracker?.devToolsEnabled) {
    await tracker.scrambleCurrentProjectPath();
    return;
  }
}

function buildTitle(projectInfo: ProjectInfo, settings: ExtensionSettings): string {
  const { name, version } = projectInfo;
  if (projectInfo.orphaned) {
    const baseTemplate = name ? applyTemplate(settings.namedFormat, name, version) : getBaseTitleTemplate();
    return `[Orphaned] ${baseTemplate}`;
  }

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

function coerceTags(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const tags = value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter((item) => item.length > 0);
  return tags.length > 0 ? Array.from(new Set(tags)) : undefined;
}

async function fileExists(uri: vscode.Uri): Promise<boolean> {
  try {
    await vscode.workspace.fs.stat(uri);
    return true;
  } catch {
    return false;
  }
}

interface ProjectRecord {
  id: string;
  name: string;
  path: string;
  tags: string[];
  group?: string;
  lastOpened?: number;
  addedAt: number;
  orphaned?: boolean;
}

interface ProjectDatabase {
  version: number;
  projects: ProjectRecord[];
  tags: string[];
}

class ProjectTracker implements vscode.Disposable {
  private readonly context: vscode.ExtensionContext;
  private disposed = false;
  private readonly dbFile: vscode.Uri;
  private ready = false;
  private readonly promptKey = 'harbormaster.db.prompted';
  private readonly enabledKey = 'harbormaster.db.enabled';
  private readonly _onDidChange = new vscode.EventEmitter<void>();
  readonly onDidChange = this._onDidChange.event;
  readonly devToolsEnabled: boolean;

  constructor(context: vscode.ExtensionContext, devToolsEnabled: boolean) {
    this.context = context;
    this.dbFile = vscode.Uri.joinPath(context.globalStorageUri, 'projects.json');
    this.devToolsEnabled = devToolsEnabled;
  }

  dispose(): void {
    this.disposed = true;
    this._onDidChange.dispose();
  }

  async ensurePromptedForDatabase(): Promise<void> {
    const alreadyPrompted = this.context.globalState.get<boolean>(this.promptKey, false);
    if (alreadyPrompted) {
      return;
    }
    this.context.globalState.update(this.promptKey, true);

    const choice = await vscode.window.showInformationMessage(
      'Harbormaster can keep a projects database for quick access. Create it now?',
      'Create database',
      'Not now'
    );
    if (choice === 'Create database') {
      await this.createDatabaseWithPrompt(false);
    }
  }

  async createDatabaseWithPrompt(showResult: boolean): Promise<void> {
    const created = await this.ensureDatabase();
    if (showResult && created) {
      void vscode.window.showInformationMessage('Harbormaster projects database created.');
    } else if (showResult && !created) {
      void vscode.window.showInformationMessage('Harbormaster projects database already exists.');
    }
  }

  async isOrphaned(folder: vscode.WorkspaceFolder, projectName?: string): Promise<boolean> {
    const db = await this.tryLoadDatabase();
    if (!db) {
      return false;
    }

    const currentPath = folder.uri.fsPath;
    const byPath = db.projects.find((p) => p.path === currentPath);
    if (byPath) {
      return false;
    }

    if (projectName) {
      const byName = db.projects.find((p) => p.name === projectName);
      return Boolean(byName);
    }

    return false;
  }

  async addOrUpdateProjectFromWorkspace(
    folder: vscode.WorkspaceFolder,
    info: { name?: string; tags?: string[] }
  ): Promise<void> {
    if (!info.name) {
      return;
    }
    const db = await this.ensureDatabase();
    if (!db) {
      return;
    }

    const path = folder.uri.fsPath;
    const now = Date.now();
    const existing = db.projects.find((p) => p.path === path || p.name === info.name);
    if (existing) {
      existing.name = info.name;
      existing.path = path;
      existing.orphaned = false;
      existing.lastOpened = now;
      if (info.tags && info.tags.length > 0) {
        existing.tags = mergeTags(existing.tags, info.tags);
        db.tags = mergeTags(db.tags, info.tags);
      }
    } else {
      const tags = info.tags ?? [];
      const record: ProjectRecord = {
        id: cryptoRandomId(),
        name: info.name,
        path,
        tags,
        addedAt: now,
        lastOpened: now,
      };
      db.projects.push(record);
      if (tags.length > 0) {
        db.tags = mergeTags(db.tags, tags);
      }
    }

    await this.saveDatabase(db);
  }

  async reconnectCurrentWorkspace(): Promise<void> {
    const folder = getPrimaryWorkspaceFolder();
    if (!folder) {
      void vscode.window.showErrorMessage('Harbormaster: No workspace folder open.');
      return;
    }

    const settings = getExtensionSettings();
    const info = await readProjectInfo(folder, settings, this);
    if (!info.name) {
      void vscode.window.showErrorMessage('Harbormaster: No project name found to reconnect.');
      return;
    }

    const db = await this.ensureDatabase();
    if (!db) {
      void vscode.window.showErrorMessage('Harbormaster: Projects database not created yet.');
      return;
    }

    const currentPath = folder.uri.fsPath;
    const existing = db.projects.find((p) => p.name === info.name);
    if (existing) {
      existing.path = currentPath;
      existing.orphaned = false;
      existing.lastOpened = Date.now();
    } else {
      db.projects.push({
        id: cryptoRandomId(),
        name: info.name,
        path: currentPath,
        tags: info.tags ?? [],
        addedAt: Date.now(),
        lastOpened: Date.now(),
      });
    }

    await this.saveDatabase(db);
    void vscode.window.showInformationMessage(`Harbormaster: Reconnected ${info.name} to the projects database.`);
  }

  async pickAndOpenProject(): Promise<void> {
    const db = await this.tryLoadDatabase();
    if (!db || db.projects.length === 0) {
      void vscode.window.showInformationMessage('Harbormaster: No projects in database. Create one first.');
      return;
    }

    const items = db.projects
      .sort((a, b) => (b.lastOpened ?? 0) - (a.lastOpened ?? 0))
      .map((proj) => {
        const tagSuffix = proj.tags.length > 0 ? ` [${proj.tags.join(', ')}]` : '';
        return {
          label: proj.name,
          description: proj.path,
          detail: tagSuffix,
          project: proj,
        };
      });

    const picked = await vscode.window.showQuickPick(items, {
      placeHolder: 'Select a Harbormaster project to open',
      matchOnDescription: true,
      matchOnDetail: true,
    });

    if (!picked) {
      return;
    }

    const uri = vscode.Uri.file(picked.project.path);
    await vscode.commands.executeCommand('vscode.openFolder', uri, true);
    picked.project.lastOpened = Date.now();
    await this.saveDatabase(db);
  }

  async databaseExists(): Promise<boolean> {
    const db = await this.tryLoadDatabase();
    return Boolean(db);
  }

  async scrambleCurrentProjectPath(): Promise<void> {
    if (!this.devToolsEnabled) {
      return;
    }
    const folder = getPrimaryWorkspaceFolder();
    if (!folder) {
      void vscode.window.showErrorMessage('Harbormaster: No workspace folder open.');
      return;
    }
    const settings = getExtensionSettings();
    const info = await readProjectInfo(folder, settings, this);
    if (!info.name) {
      void vscode.window.showErrorMessage('Harbormaster: No project name found to scramble.');
      return;
    }
    const db = await this.ensureDatabase();
    if (!db) {
      void vscode.window.showErrorMessage('Harbormaster: Projects database not created yet.');
      return;
    }
    const entry = db.projects.find((p) => p.name === info.name);
    if (!entry) {
      void vscode.window.showWarningMessage('Harbormaster: Project not in database; adding first.');
      await this.addOrUpdateProjectFromWorkspace(folder, { name: info.name, tags: info.tags });
      return this.scrambleCurrentProjectPath();
    }
    entry.path = `${entry.path}-batman-${cryptoRandomId().slice(0, 6)}`;
    entry.orphaned = true;
    await this.saveDatabase(db);
    void vscode.window.showInformationMessage(`Harbormaster: Scrambled path for ${info.name} (orphaned).`);
  }

  private async ensureDatabase(): Promise<ProjectDatabase | undefined> {
    await vscode.workspace.fs.createDirectory(this.context.globalStorageUri);

    let db = await this.tryLoadDatabase();
    if (db) {
      this.ready = true;
      await this.context.globalState.update(this.enabledKey, true);
      return db;
    }

    const initial: ProjectDatabase = { version: 1, projects: [], tags: [] };
    await this.saveDatabase(initial);
    this.ready = true;
    await this.context.globalState.update(this.enabledKey, true);
    this._onDidChange.fire();
    return initial;
  }

  private async tryLoadDatabase(): Promise<ProjectDatabase | undefined> {
    try {
      const raw = await vscode.workspace.fs.readFile(this.dbFile);
      const parsed = JSON.parse(Buffer.from(raw).toString('utf8')) as ProjectDatabase;
      if (!parsed.projects) {
        throw new Error('invalid');
      }
      return parsed;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === 'ENOENT') {
        return undefined;
      }
      console.warn('Harbormaster: failed to read projects database:', error);
      return undefined;
    }
  }

  private async saveDatabase(db: ProjectDatabase): Promise<void> {
    if (this.disposed) {
      return;
    }
    const payload = Buffer.from(JSON.stringify(db, null, 2) + '\n', 'utf8');
    const tmp = vscode.Uri.joinPath(this.context.globalStorageUri, 'projects.tmp');
    await vscode.workspace.fs.writeFile(tmp, payload);
    await vscode.workspace.fs.rename(tmp, this.dbFile, { overwrite: true });
    this._onDidChange.fire();
  }
}

function cryptoRandomId(): string {
  if (typeof randomUUID === 'function') {
    return randomUUID();
  }
  const buf = randomBytes(16);
  return buf.toString('hex');
}

function mergeTags(existing: string[], incoming: string[]): string[] {
  const merged = new Set<string>();
  existing.forEach((t) => merged.add(t));
  incoming.forEach((t) => merged.add(t));
  return Array.from(merged);
}
