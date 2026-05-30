import * as vscode from 'vscode';
import type { HealthSnapshot } from '../types/project';
import type { ProjectStore } from '../store/projectStore';

const REQUIRED_CONTEXT_FILES = [
  '.harbormaster/.context/DIRECTIVES.md',
  '.harbormaster/.context/SHELF.md',
];

export class HealthChecker {
  constructor(private readonly projectStore: ProjectStore) {}

  async check(folderUri: vscode.Uri): Promise<HealthSnapshot> {
    const missing: string[] = [];
    const corrupt: string[] = [];

    if (!(await this.projectStore.exists())) {
      missing.push(this.projectStore.configUri.fsPath);
    } else if (await this.projectStore.isCorrupt()) {
      corrupt.push(this.projectStore.configUri.fsPath);
    }

    for (const relativePath of REQUIRED_CONTEXT_FILES) {
      const uri = vscode.Uri.joinPath(folderUri, relativePath);
      if (!(await fileExists(uri))) {
        missing.push(relativePath);
      }
    }

    return { missing, corrupt };
  }

  isHealthy(snapshot: HealthSnapshot): boolean {
    return snapshot.missing.length === 0 && snapshot.corrupt.length === 0;
  }
}

async function fileExists(uri: vscode.Uri): Promise<boolean> {
  try {
    await vscode.workspace.fs.stat(uri);
    return true;
  } catch {
    return false;
  }
}
