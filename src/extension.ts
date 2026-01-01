import * as vscode from 'vscode';

const DEFAULT_CONFIG_FILE = '.harbormaster/project.json';
const DEFAULT_PROJECT_KEY = 'project_name';
const DEFAULT_VERSION_KEY = 'project_version';
const DEFAULT_VERSION_MAJOR_KEY = 'version_major';
const DEFAULT_VERSION_MINOR_KEY = 'version_minor';
const DEFAULT_VERSION_PRERELEASE_KEY = 'version_prerelease';
const DEFAULT_TAGS_FILE = '.harbormaster/tags.json';
const LEGACY_CONFIG_FILE = '.project.json';
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
    await this.migrateLegacyConfig(folder, settings);
    await this.backupTagsFile(folder, settings);
    await this.ensureTagsFile(folder, settings);
    this.registerWatchers(folder, settings);
    this.initialized = true;
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

  private async migrateLegacyConfig(folder: vscode.WorkspaceFolder, settings: ExtensionSettings): Promise<void> {
    if (settings.configFile !== DEFAULT_CONFIG_FILE) {
      return;
    }

    const newUri = vscode.Uri.joinPath(folder.uri, settings.configFile);
    const legacyUri = vscode.Uri.joinPath(folder.uri, LEGACY_CONFIG_FILE);

    // If the new file exists and the legacy file still lingers, remove the legacy copy.
    if (await fileExists(newUri)) {
      if (await fileExists(legacyUri)) {
        await vscode.workspace.fs.delete(legacyUri);
      }
      return;
    }

    if (!(await fileExists(legacyUri))) {
      return;
    }

    const legacy = await this.readConfig(legacyUri);
    legacy.tags = dedupeTags(Array.isArray(legacy.tags) ? legacy.tags : []);
    await this.ensureDirectory(newUri);
    await this.writeConfig(newUri, legacy, settings.configFile);
    await vscode.workspace.fs.delete(legacyUri);
  }

  private async ensureTagsFile(folder: vscode.WorkspaceFolder, settings: ExtensionSettings): Promise<void> {
    const tagsUri = vscode.Uri.joinPath(folder.uri, settings.tagsFile);
    if (await fileExists(tagsUri)) {
      return;
    }
    await this.ensureDirectory(tagsUri);
    await this.writeTagsFile(folder, settings, []);
  }

  private async readTagsFile(folder: vscode.WorkspaceFolder, settings: ExtensionSettings): Promise<string[]> {
    const tagsUri = vscode.Uri.joinPath(folder.uri, settings.tagsFile);
    try {
      const content = await vscode.workspace.fs.readFile(tagsUri);
      const parsed = JSON.parse(Buffer.from(content).toString('utf8')) as TagConfig;
      if (Array.isArray(parsed.tags)) {
        return dedupeTags(parsed.tags);
      }
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code && code !== 'ENOENT') {
        console.warn(`Harbormaster: unable to read tags file ${settings.tagsFile}:`, error);
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
      if (code && code !== 'ENOENT') {
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

  private async ensureDirectory(targetUri: vscode.Uri): Promise<void> {
    await ensureDirectoryForFile(targetUri);
  }

  private registerWatchers(folder: vscode.WorkspaceFolder, settings: ExtensionSettings): void {
    const patterns = [
      new vscode.RelativePattern(folder, settings.configFile),
      new vscode.RelativePattern(folder, settings.tagsFile),
      new vscode.RelativePattern(folder, LEGACY_CONFIG_FILE),
    ];

    for (const pattern of patterns) {
      const watcher = vscode.workspace.createFileSystemWatcher(pattern);
      this.watchers.push(watcher);
      this.disposables.push(
        watcher,
        watcher.onDidChange(() => this.onDidChangeEmitter.fire()),
        watcher.onDidCreate(() => this.onDidChangeEmitter.fire()),
        watcher.onDidDelete(() => this.onDidChangeEmitter.fire())
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
    } catch (error) {
      console.warn(`Harbormaster: unable to create tags backup ${backupName}:`, error);
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
    ];

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
  context.subscriptions.push(
    controller,
    tracker,
    vscode.commands.registerCommand('projectWindowTitle.createConfig', () => createProjectConfig()),
    vscode.commands.registerCommand('projectWindowTitle.openConfig', () => openProjectConfig()),
    vscode.commands.registerCommand('projectWindowTitle.showMenu', () => showMenu()),
    vscode.commands.registerCommand('projectWindowTitle.refresh', () => controller.refresh()),
    vscode.commands.registerCommand('projectWindowTitle.addGlobalTag', () => tracker.addGlobalTag()),
    vscode.commands.registerCommand('projectWindowTitle.removeGlobalTag', () => tracker.removeGlobalTag()),
    vscode.commands.registerCommand('projectWindowTitle.assignTag', () => tracker.assignTagToProject()),
    vscode.commands.registerCommand('projectWindowTitle.removeProjectTag', () => tracker.removeProjectTag()),
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

async function showMenu(): Promise<void> {
  if (!trackerSingleton) {
    void vscode.window.showErrorMessage('Harbormaster: tracker not initialized.');
    return;
  }

  const items: vscode.QuickPickItem[] = [
    { label: 'Create project config', description: 'Prompt for name/version and write .project.json' },
    { label: 'Open project config', description: 'Open or create the configured .project.json' },
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
