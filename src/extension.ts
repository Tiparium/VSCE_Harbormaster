import * as vscode from 'vscode';

import { createGlobalStore } from './store/globalStore';
import { CANONICAL_BRANCHES } from './store/canonicalBranches';
import { ProjectStore } from './store/projectStore';
import { CatalogStore } from './store/catalog';
import { SettingsStore } from './store/settings';
import { BranchStore } from './store/branches';
import { AccentManager } from './color/accentManager';
import { TitleController } from './title/titleController';
import { ProjectScaffold } from './project/scaffold';
import { HealthChecker } from './project/health';
import { SidebarProvider } from './ui/sidebar/sidebarProvider';
import { SetupManager } from './setup/setupManager';
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
  const setupManager = new SetupManager(settings, context.extensionUri.fsPath);

  // ── UI ────────────────────────────────────────────────────────────────────
  const sidebar = new SidebarProvider(
    context.extensionUri,
    catalog,
    projectStore,
    settings
  );

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('harbormasterActions', sidebar),
    titleController
  );

  // ── Commands ──────────────────────────────────────────────────────────────
  registerCommands(context, { catalog, settings, projectStore, scaffold, sidebar, setupManager });

  // ── Startup work ──────────────────────────────────────────────────────────
  void branches.seed(CANONICAL_BRANCHES);
  void onActivate(folder, catalog, settings, scaffold, health, setupManager, sidebar);
}

async function onActivate(
  folder: vscode.WorkspaceFolder | undefined,
  catalog: CatalogStore,
  settings: SettingsStore,
  scaffold: ProjectScaffold,
  health: HealthChecker,
  setupManager: SetupManager,
  sidebar: SidebarProvider
): Promise<void> {
  // ── First-time / pending setup ────────────────────────────────────────────
  if (await setupManager.hasPendingSteps()) {
    const answer = await vscode.window.showInformationMessage(
      'Harbormaster needs a quick setup. Configure your AI tools and MCP server?',
      'Configure',
      'Later'
    );
    if (answer === 'Configure') {
      await setupManager.run();
    }
  }

  if (!folder) {
    sidebar.refresh();
    return;
  }

  // ── Register project in catalog ───────────────────────────────────────────
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

    // Ensure entrypoint files for any newly configured AI tools
    const activeTools = (await settings.read()).activeAiTools;
    await scaffold.ensureEntrypoints(folder.uri, config.project_name || folder.name, activeTools);
  }

  // ── Health check ──────────────────────────────────────────────────────────
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
