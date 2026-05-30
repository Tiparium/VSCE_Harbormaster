import * as vscode from 'vscode';
import type { CatalogStore } from '../../store/catalog';
import type { ProjectStore } from '../../store/projectStore';
import type { ExtensionMessage, SidebarData, WebviewMessage } from '../../webview/types';
import { shell } from './shell';

export class SidebarProvider implements vscode.WebviewViewProvider {
  private view?: vscode.WebviewView;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly catalog: CatalogStore,
    private readonly projectStore: ProjectStore
  ) {}

  resolveWebviewView(view: vscode.WebviewView): void {
    this.view = view;
    view.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, 'out'), vscode.Uri.joinPath(this.extensionUri, 'resources')],
    };

    const cssUri = view.webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'resources', 'harbormaster-ui.css'));
    const scriptUri = view.webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'out', 'webview.js'));
    view.webview.html = shell(cssUri.toString(), scriptUri.toString());

    view.webview.onDidReceiveMessage(async (msg: WebviewMessage) => {
      if (msg.type === 'ready') {
        await this.sendData();
      }
      if (msg.type === 'command') {
        await vscode.commands.executeCommand(msg.command);
      }
    });
  }

  refresh(): void {
    void this.sendData();
  }

  private async sendData(): Promise<void> {
    if (!this.view) return;
    const config = await this.projectStore.read();
    const data: SidebarData = {
      projectName: config?.project_name ?? '',
      version: deriveVersion(config),
      tags: config?.tags ?? [],
      isHarbormasterProject: config !== null,
    };
    const msg: ExtensionMessage = { type: 'update', data };
    await this.view.webview.postMessage(msg);
  }
}

function deriveVersion(config: { version_major?: number; version_minor?: number; version_patch?: number; version_prerelease?: string; project_version?: string } | null): string {
  if (!config) return '';
  if (config.project_version) return config.project_version;
  const base = `${config.version_major ?? 0}.${config.version_minor ?? 0}.${config.version_patch ?? 0}`;
  return config.version_prerelease ? `${base}-${config.version_prerelease}` : base;
}
