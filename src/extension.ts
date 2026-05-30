import * as vscode from 'vscode';

import { createGlobalStore } from './store/globalStore';
import { ProjectStore } from './store/projectStore';
import { CatalogStore } from './store/catalog';
import { SettingsStore } from './store/settings';
import { BranchStore } from './store/branches';
import { AccentManager } from './color/accentManager';
import { TitleController } from './title/titleController';
import { ProjectScaffold } from './project/scaffold';
import { HealthChecker } from './project/health';
import { SidebarProvider } from './ui/sidebar/sidebarProvider';
import { registerCommands } from './commands/index';
import { getPrimaryFolder } from './utils/fileUtils';

export function activate(context: vscode.ExtensionContext): void {
  // ── Data layer ────────────────────────────────────────────────────────────
  const globalStore = createGlobalStore(context);
  const catalog = new CatalogStore(globalStore);
  const settings = new SettingsStore(globalStore);
  const branches = new BranchStore(globalStore);

  const folder = getPrimaryFolder();
  const configPath = vscode.workspace.getConfiguration('harbormaster').get<string>('projectConfigFile');
  const projectStore = new ProjectStore(folder?.uri ?? vscode.Uri.file('/'), configPath);

  // ── Domain ────────────────────────────────────────────────────────────────
  const accentManager = new AccentManager();
  const scaffold = new ProjectScaffold();
  const health = new HealthChecker(projectStore);
  const titleController = new TitleController(projectStore, accentManager);

  // ── UI ────────────────────────────────────────────────────────────────────
  const sidebar = new SidebarProvider(
    context.extensionUri,
    catalog,
    projectStore
  );

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('harbormasterActions', sidebar),
    titleController
  );

  // ── Commands ──────────────────────────────────────────────────────────────
  registerCommands(context, { catalog, settings, projectStore, scaffold, sidebar });

  // ── Startup work ──────────────────────────────────────────────────────────
  void onActivate(folder, catalog, settings, scaffold, health, sidebar);
}

async function onActivate(
  folder: vscode.WorkspaceFolder | undefined,
  catalog: CatalogStore,
  settings: SettingsStore,
  scaffold: ProjectScaffold,
  health: HealthChecker,
  sidebar: SidebarProvider
): Promise<void> {
  if (!folder) return;

  // Register project in catalog
  const projectStore = new ProjectStore(folder.uri);
  const config = await projectStore.read();
  if (config) {
    await catalog.upsert({
      name: config.project_name || folder.name,
      path: folder.uri.fsPath,
      tags: config.tags,
    });
    await catalog.recordOpened(
      (await catalog.findByPath(folder.uri.fsPath))?.id ?? ''
    );
  }

  // Ensure entrypoint files for any newly configured AI tools
  if (config) {
    const activeTools = (await settings.read()).activeAiTools;
    await scaffold.ensureEntrypoints(folder.uri, config.project_name || folder.name, activeTools);
  }

  // Health check — show diagnostics if needed
  const snapshot = await health.check(folder.uri);
  if (!health.isHealthy(snapshot)) {
    const msg = [
      snapshot.missing.length ? `Missing: ${snapshot.missing.join(', ')}` : '',
      snapshot.corrupt.length ? `Corrupt: ${snapshot.corrupt.join(', ')}` : '',
    ].filter(Boolean).join(' | ');
    void vscode.window.showWarningMessage(`Harbormaster: ${msg}. Run "Rebuild project state" to fix.`);
  }

  sidebar.refresh();
}

export function deactivate(): void {
  // Disposables handled via context.subscriptions.
}
