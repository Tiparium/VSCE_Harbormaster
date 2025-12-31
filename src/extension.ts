import * as vscode from 'vscode';

const DEFAULT_CONFIG_FILE = '.project.json';
const DEFAULT_PROJECT_KEY = 'project_name';
const DEFAULT_VERSION_KEY = 'project_version';
const DEFAULT_VERSION_MAJOR_KEY = 'version_major';
const DEFAULT_VERSION_MINOR_KEY = 'version_minor';
const DEFAULT_VERSION_PRERELEASE_KEY = 'version_prerelease';
const DEFAULT_HEADLESS_PREFIX = '[Headless] ';
const DEFAULT_NAMED_FORMAT = '${projectName}';
const DEFAULT_VERSION_FORMAT = '${projectName} (${projectVersion})';
const DEFAULT_SHOW_VERSION = false;
const FALLBACK_TITLE_TEMPLATE = '${dirty}${activeEditorShort}${separator}${rootName}${separator}${appName}';

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
}

export function activate(context: vscode.ExtensionContext): void {
  const controller = new TitleController();
  context.subscriptions.push(controller);
}

export function deactivate(): void {
  // Nothing to clean up beyond disposables.
}

class TitleController implements vscode.Disposable {
  private watcher?: vscode.FileSystemWatcher;
  private watcherSubscriptions: vscode.Disposable[] = [];
  private disposables: vscode.Disposable[] = [];

  constructor() {
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

  private async refresh(): Promise<void> {
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
    const projectInfo = await readProjectInfo(folder, settings);
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

async function readProjectInfo(folder: vscode.WorkspaceFolder, settings: ExtensionSettings): Promise<ProjectInfo> {
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

    return { name: projectName, version: projectVersion };
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
