import * as vscode from 'vscode';
import type { AiTool } from '../types/global';
import { ProjectService } from './projectService';

/**
 * VS Code-facing adapter for the shared project adoption operation.
 * Adoption is intentionally idempotent and is used for both new projects and
 * live upgrades of existing Harbormaster projects.
 */
export class ProjectScaffold {
  async initProject(
    folderUri: vscode.Uri,
    name: string,
    activeAiTools: AiTool[]
  ): Promise<{ created: string[]; updated: string[] }> {
    const report = await new ProjectService(folderUri.fsPath).adopt(name, activeAiTools);
    return { created: report.created, updated: report.updated };
  }

  async ensureEntrypoints(
    folderUri: vscode.Uri,
    projectName: string,
    activeAiTools: AiTool[]
  ): Promise<{ created: string[]; updated: string[] }> {
    const report = await new ProjectService(folderUri.fsPath).adopt(projectName, activeAiTools);
    return { created: report.created, updated: report.updated };
  }
}
