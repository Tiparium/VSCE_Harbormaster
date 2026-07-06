import * as vscode from 'vscode';
import type { ProjectStore } from '../store/projectStore';
import type { AccentManager } from '../color/accentManager';

const HEADLESS_PREFIX = '[Headless] ';
const FALLBACK_TITLE = '${dirty}${activeEditorShort}${separator}${rootName}${separator}${appName}';

export class TitleController implements vscode.Disposable {
  private watcher?: vscode.FileSystemWatcher;
  private disposables: vscode.Disposable[] = [];

  constructor(
    private readonly projectStore: ProjectStore,
    private readonly accentManager: AccentManager
  ) {
    this.disposables.push(
      vscode.workspace.onDidChangeWorkspaceFolders(() => void this.refresh()),
      vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration('harbormaster') || e.affectsConfiguration('window.title')) {
          void this.refresh();
        }
      })
    );
    void this.refresh();
  }

  dispose(): void {
    this.watcher?.dispose();
    this.disposables.forEach((d) => d.dispose());
  }

  async refresh(): Promise<void> {
    this.watcher?.dispose();
    const folder = getPrimaryFolder();
    if (!folder) return;

    this.watcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(folder, this.projectStore.configRelativePath)
    );
    this.disposables.push(
      this.watcher,
      this.watcher.onDidChange(() => void this.apply(folder)),
      this.watcher.onDidCreate(() => void this.apply(folder)),
      this.watcher.onDidDelete(() => void this.apply(folder))
    );

    await this.apply(folder);
  }

  private async apply(folder: vscode.WorkspaceFolder): Promise<void> {
    const config = await this.projectStore.read();
    const title = buildTitle(config?.project_name);
    const windowConfig = vscode.workspace.getConfiguration('window', folder.uri);
    const current = windowConfig.inspect<string>('title')?.workspaceValue;
    if (current !== title) {
      await windowConfig.update('title', title, vscode.ConfigurationTarget.Workspace);
    }

    if (config?.accent) {
      await this.accentManager.apply(folder, config.accent);
    } else {
      await this.accentManager.clear(folder);
    }
  }
}

function buildTitle(projectName: string | undefined): string {
  if (projectName?.trim()) {
    return projectName.trim();
  }
  const base = vscode.workspace.getConfiguration('window').inspect<string>('title')?.defaultValue
    ?? FALLBACK_TITLE;
  return `${HEADLESS_PREFIX}${base}`;
}

function getPrimaryFolder(): vscode.WorkspaceFolder | undefined {
  return vscode.workspace.workspaceFolders?.[0];
}
