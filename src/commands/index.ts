import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
import type { CatalogStore } from '../store/catalog';
import type { SettingsStore } from '../store/settings';
import type { ProjectStore } from '../store/projectStore';
import type { ProjectScaffold } from '../project/scaffold';
import type { SidebarProvider } from '../ui/sidebar/sidebarProvider';
import type { SetupManager } from '../setup/setupManager';
import { getPrimaryFolder } from '../utils/fileUtils';
import { isGitRepo, snapshotHarbormaster } from '../utils/gitUtils';
import { AI_TOOL_ENTRYPOINTS } from '../types/global';
import type { AiTool } from '../types/global';
import { ProjectService } from '../project/projectService';
import { ProjectMigrationPlanner } from '../project/migration';

export type CommandDeps = {
  catalog: CatalogStore;
  settings: SettingsStore;
  projectStore: ProjectStore;
  scaffold: ProjectScaffold;
  sidebar?: SidebarProvider;
  setupManager?: SetupManager;
};

export function registerCommands(
  context: vscode.ExtensionContext,
  deps: CommandDeps
): void {
  const { catalog, settings, projectStore, scaffold, sidebar, setupManager } = deps;

  context.subscriptions.push(
    vscode.commands.registerCommand('harbormaster.openCatalog', async () => {
      await openProjectFromCatalog(catalog);
    }),

    vscode.commands.registerCommand('harbormaster.createProject', async () => {
      await createProject(context, catalog, settings, scaffold);
    }),

    vscode.commands.registerCommand('harbormaster.openConfig', async () => {
      const folder = getPrimaryFolder();
      if (!folder) {
        void vscode.window.showErrorMessage('Harbormaster: No workspace folder open.');
        return;
      }
      const uri = projectStore.configUri;
      const doc = await vscode.workspace.openTextDocument(uri);
      await vscode.window.showTextDocument(doc, { preview: false });
    }),

    vscode.commands.registerCommand('harbormaster.rebuildState', async () => {
      const folder = getPrimaryFolder();
      if (!folder) {
        void vscode.window.showErrorMessage('Harbormaster: No workspace folder open.');
        return;
      }
      const config = await projectStore.read();
      const activeTools = (await settings.read()).activeAiTools;
      const result = await scaffold.ensureEntrypoints(folder.uri, config?.project_name ?? folder.name, activeTools);
      const changed = [...result.created, ...result.updated];
      const msg = changed.length
        ? `Updated: ${changed.join(', ')}`
        : 'Project state already complete.';
      void vscode.window.showInformationMessage(`Harbormaster: ${msg}`);
    }),

    vscode.commands.registerCommand('harbormaster.setAccent', () => {
      void vscode.commands.executeCommand('workbench.view.extension.harbormaster');
    }),

    vscode.commands.registerCommand('harbormaster.clearAccent', async () => {
      const folder = getPrimaryFolder();
      if (!folder) return;
      await new ProjectService(folder.uri.fsPath).updateConfig((config) => {
        delete config.accent;
      });
      void vscode.window.showInformationMessage('Harbormaster: accent colors cleared.');
    }),

    vscode.commands.registerCommand('harbormaster.refresh', () => {
      sidebar?.refresh();
    }),

    vscode.commands.registerCommand('harbormaster.runSetup', async () => {
      if (setupManager) await setupManager.run();
    }),

    vscode.commands.registerCommand('harbormaster.manageAiTools', async () => {
      if (setupManager) await setupManager.reconfigureAiTools();
    }),

    vscode.commands.registerCommand('harbormaster.manageMcp', async () => {
      if (setupManager) await setupManager.reconfigureMcp();
    }),

    vscode.commands.registerCommand('harbormaster.reviewMigration', async () => {
      const folder = getPrimaryFolder();
      if (!folder) {
        void vscode.window.showErrorMessage('Harbormaster: No workspace folder open.');
        return;
      }
      const activeTools = (await settings.read()).activeAiTools;
      const plan = await new ProjectMigrationPlanner(folder.uri.fsPath).plan({
        mode: 'migrate',
        activeTools,
      });
      const document = await vscode.workspace.openTextDocument({
        language: 'json',
        content: JSON.stringify(plan, null, 2),
      });
      await vscode.window.showTextDocument(document, { preview: false });
    }),

    vscode.commands.registerCommand('harbormaster.snapshotState', async () => {
      const folder = getPrimaryFolder();
      if (!folder) {
        void vscode.window.showErrorMessage('Harbormaster: No workspace folder open.');
        return;
      }
      const hasGit = await isGitRepo(folder.uri.fsPath);
      if (!hasGit) {
        void vscode.window.showWarningMessage('Harbormaster: No git repository found — snapshot not available.');
        return;
      }
      const result = await snapshotHarbormaster(folder.uri.fsPath);
      if (result.success) {
        void vscode.window.showInformationMessage(`Harbormaster: ${result.message}`);
      } else {
        void vscode.window.showErrorMessage(`Harbormaster snapshot failed: ${result.message}`);
      }
    })
  );
}

// ── Catalog picker ────────────────────────────────────────────────────────

import type { CatalogProject } from '../types/project';

interface CatalogPickItem extends vscode.QuickPickItem {
  project?: CatalogProject;
  isSortOption?: boolean;
  sortKey?: string;
  stale?: boolean;
}

async function openProjectFromCatalog(catalog: CatalogStore): Promise<void> {
  const projects = await catalog.list();
  if (projects.length === 0) {
    void vscode.window.showInformationMessage('Harbormaster: No projects in catalog. Create one first.');
    return;
  }

  // Validate all entries in parallel before opening the picker.
  // A project is stale if either its folder or its Harbormaster config is missing.
  const staleIds = new Set<string>();
  await Promise.all(
    projects.map(async (p) => {
      const folderUri = vscode.Uri.file(p.path);
      const configUri = vscode.Uri.joinPath(folderUri, '.harbormaster/project.json');
      if (!(await fileExists(folderUri)) || !(await fileExists(configUri))) {
        staleIds.add(p.id);
      }
    })
  );

  const openHereButton: vscode.QuickInputButton = {
    iconPath: new vscode.ThemeIcon('window'),
    tooltip: 'Open here',
  };
  const openNewButton: vscode.QuickInputButton = {
    iconPath: new vscode.ThemeIcon('open-preview'),
    tooltip: 'Open in new window',
  };

  const sortOptions = [
    { label: 'Last edited', sort: 'lastEdited' as const },
    { label: 'Last opened', sort: 'lastOpened' as const },
    { label: 'Created', sort: 'created' as const },
    { label: 'Name (A → Z)', sort: 'name' as const },
  ];

  let currentSort: import('../store/catalog').CatalogSortKey = 'lastEdited';

  const quickPick = vscode.window.createQuickPick<CatalogPickItem>();
  quickPick.matchOnDescription = true;
  quickPick.matchOnDetail = true;
  quickPick.title = 'Open Harbormaster project';
  quickPick.placeholder = 'Enter to open here · Use buttons to choose window';

  function buildItems(sortKey: typeof currentSort): CatalogPickItem[] {
    const sorted = catalog.sort(projects, sortKey);
    const sortItems: CatalogPickItem[] = sortOptions.map((o) => ({
      label: `${o.sort === sortKey ? '$(check) ' : ''}${o.label}`,
      description: '',
      isSortOption: true,
      sortKey: o.sort,
    }));
    const projectItems: CatalogPickItem[] = sorted.map((p) => {
      const stale = staleIds.has(p.id);
      return {
        label: stale ? `$(warning) ${p.name}` : p.name,
        description: stale
          ? 'Path not found'
          : (p.tags.length ? p.tags.join(', ') : undefined),
        detail: `$(folder) ${p.path}`,
        project: p,
        stale,
        buttons: stale ? [] : [openHereButton, openNewButton],
      };
    });
    return [
      { label: 'Sort by', kind: vscode.QuickPickItemKind.Separator },
      ...sortItems,
      { label: 'Projects', kind: vscode.QuickPickItemKind.Separator },
      ...projectItems,
    ];
  }

  quickPick.items = buildItems(currentSort);

  quickPick.onDidTriggerItemButton(async (e) => {
    if (e.item.isSortOption || !e.item.project) return;
    await openProject(catalog, e.item.project, e.button === openNewButton);
    quickPick.hide();
  });

  quickPick.onDidAccept(async () => {
    const selection = quickPick.selectedItems[0];
    if (!selection) { quickPick.hide(); return; }
    if (selection.isSortOption && selection.sortKey) {
      currentSort = selection.sortKey as typeof currentSort;
      quickPick.items = buildItems(currentSort);
      return;
    }
    if (!selection.project) return;
    if (selection.stale) {
      quickPick.hide();
      await recoverStaleProject(catalog, selection.project);
      return;
    }
    await openProject(catalog, selection.project, false);
    quickPick.hide();
  });

  quickPick.show();
}

async function recoverStaleProject(catalog: CatalogStore, project: CatalogProject): Promise<void> {
  type RecoveryAction = 'remap' | 'remove' | 'cancel';
  const items: (vscode.QuickPickItem & { action: RecoveryAction })[] = [
    {
      label: '$(edit) Remap',
      description: 'Select the new folder location and update the catalog entry',
      action: 'remap',
    },
    {
      label: '$(trash) Remove from catalog',
      description: 'Delete this entry permanently',
      action: 'remove',
    },
    {
      label: '$(close) Cancel',
      description: 'Leave it for now',
      action: 'cancel',
    },
  ];

  const pick = await vscode.window.showQuickPick(items, {
    title: `Project not found: ${project.name}`,
    placeHolder: project.path,
  });
  if (!pick || pick.action === 'cancel') return;

  if (pick.action === 'remove') {
    await catalog.remove(project.id);
    void vscode.window.showInformationMessage(`Harbormaster: removed "${project.name}" from catalog.`);
    return;
  }

  if (pick.action === 'remap') {
    const picked = await vscode.window.showOpenDialog({
      canSelectFiles: false,
      canSelectFolders: true,
      canSelectMany: false,
      openLabel: 'Use this folder',
    });
    if (!picked || picked.length === 0) return;
    await catalog.updatePath(project.id, picked[0].fsPath);
    await vscode.commands.executeCommand('vscode.openFolder', picked[0], { forceNewWindow: false });
    await catalog.recordOpened(project.id);
  }
}

async function openProject(
  catalog: CatalogStore,
  project: CatalogProject,
  forceNewWindow: boolean
): Promise<void> {
  await vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(project.path), { forceNewWindow });
  await catalog.recordOpened(project.id);
}

async function fileExists(uri: vscode.Uri): Promise<boolean> {
  try { await vscode.workspace.fs.stat(uri); return true; } catch { return false; }
}

async function createProject(
  context: vscode.ExtensionContext,
  catalog: CatalogStore,
  settings: SettingsStore,
  scaffold: ProjectScaffold
): Promise<void> {
  const currentFolder = vscode.workspace.workspaceFolders?.[0];
  const globalSettings = await settings.read();
  const defaultUri = currentFolder?.uri
    ?? vscode.Uri.file(globalSettings.projectCreateDefaultFolder || path.join(os.homedir(), 'Documents'));

  const pick = await vscode.window.showOpenDialog({
    canSelectFiles: false,
    canSelectFolders: true,
    canSelectMany: false,
    defaultUri,
    openLabel: 'Create Harbormaster project here',
  });
  if (!pick || pick.length === 0) return;

  const folderUri = pick[0];
  const defaultName = path.basename(folderUri.fsPath);
  const name = await vscode.window.showInputBox({
    prompt: 'Project name',
    value: defaultName,
    ignoreFocusOut: true,
    validateInput: (v) => v.trim().length ? undefined : 'Project name is required',
  });
  if (!name) return;

  // First-time AI tool setup
  if (globalSettings.activeAiTools.length === 0) {
    const toolLabels = Object.keys(AI_TOOL_ENTRYPOINTS) as AiTool[];
    const chosen = await vscode.window.showQuickPick(
      toolLabels.map((t) => ({ label: t, picked: false })),
      { canPickMany: true, placeHolder: 'Which AI tools do you use? (select all that apply)' }
    );
    if (chosen && chosen.length > 0) {
      await settings.setActiveAiTools(chosen.map((c) => c.label as AiTool));
    }
  }

  const updatedSettings = await settings.read();
  const result = await scaffold.initProject(folderUri, name.trim(), updatedSettings.activeAiTools);
  await catalog.upsert({ name: name.trim(), path: folderUri.fsPath, tags: [] });

  void vscode.window.showInformationMessage(
    `Harbormaster: created "${name}". Files: ${result.created.length}`
  );
  await vscode.commands.executeCommand('vscode.openFolder', folderUri, { forceNewWindow: false });
}
