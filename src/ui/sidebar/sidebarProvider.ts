import * as vscode from 'vscode';
import type { CatalogStore } from '../../store/catalog';
import type { ProjectStore } from '../../store/projectStore';
import type { AccentManager } from '../../color/accentManager';
import type { SettingsStore } from '../../store/settings';
import { renderHomeView } from './views/home';
import { renderAccentView } from './views/accent';
import { renderCatalogView } from './views/catalog';

export type SidebarView = 'home' | 'accent' | 'catalog';

export class SidebarProvider implements vscode.WebviewViewProvider {
  private webviewView?: vscode.WebviewView;
  private currentView: SidebarView = 'home';

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly catalog: CatalogStore,
    private readonly projectStore: ProjectStore,
    private readonly accentManager: AccentManager,
    private readonly settings: SettingsStore
  ) {}

  resolveWebviewView(view: vscode.WebviewView): void {
    this.webviewView = view;
    view.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, 'resources')],
    };
    view.webview.onDidReceiveMessage((msg) => void this.handleMessage(msg));
    void this.render();
  }

  setView(view: SidebarView): void {
    this.currentView = view;
    void this.render();
    this.webviewView?.show?.(true);
  }

  refresh(): void {
    void this.render();
  }

  private async render(): Promise<void> {
    if (!this.webviewView) return;
    const cssUri = this.webviewView.webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'resources', 'harbormaster-ui.css')
    );
    this.webviewView.webview.html = await this.buildHtml(cssUri.toString());
  }

  private async buildHtml(cssUri: string): Promise<string> {
    switch (this.currentView) {
      case 'accent': {
        const config = await this.projectStore.read();
        return renderAccentView(cssUri, config?.accent);
      }
      case 'catalog': {
        const projects = await this.catalog.list();
        const sorted = this.catalog.sort(projects, 'lastEdited');
        return renderCatalogView(cssUri, sorted);
      }
      case 'home':
      default: {
        const config = await this.projectStore.read();
        const hasGit = false; // resolved by extension and passed in — placeholder
        return renderHomeView(cssUri, { projectName: config?.project_name, hasGit });
      }
    }
  }

  private async handleMessage(msg: unknown): Promise<void> {
    if (!msg || typeof msg !== 'object') return;
    const { type, ...payload } = msg as Record<string, unknown>;

    switch (type) {
      case 'navigate':
        if (typeof payload.view === 'string') {
          this.setView(payload.view as SidebarView);
        }
        break;
      case 'command':
        if (typeof payload.command === 'string') {
          await vscode.commands.executeCommand(payload.command, ...(Array.isArray(payload.args) ? payload.args : []));
        }
        break;
      case 'setAccentZone': {
        const folder = vscode.workspace.workspaceFolders?.[0];
        if (!folder) break;
        const config = await this.projectStore.read();
        if (!config) break;
        if (!config.accent) config.accent = {};
        const zone = payload.zone as 'frame' | 'accent' | 'surface';
        const value = typeof payload.value === 'string' ? payload.value : undefined;
        if (value) {
          config.accent[zone] = value;
        } else {
          delete config.accent[zone];
        }
        if (Object.keys(config.accent).length === 0) delete config.accent;
        await this.projectStore.write(config);
        await this.accentManager.apply(folder, config.accent ?? {});
        await this.render();
        break;
      }
      case 'clearAccent': {
        const folder = vscode.workspace.workspaceFolders?.[0];
        if (!folder) break;
        const config = await this.projectStore.read();
        if (config) {
          delete config.accent;
          await this.projectStore.write(config);
        }
        await this.accentManager.clear(folder);
        await this.render();
        break;
      }
      case 'openProject':
        if (typeof payload.path === 'string') {
          await vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(payload.path), { forceNewWindow: false });
        }
        break;
      case 'refresh':
        await this.render();
        break;
    }
  }
}
