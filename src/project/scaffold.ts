import * as vscode from 'vscode';
import type { AiTool } from '../types/global';
import { AI_TOOL_ENTRYPOINTS } from '../types/global';
import { ProjectStore } from '../store/projectStore';

const DIRECTIVES_PATH = '.harbormaster/.context/DIRECTIVES.md';
const SHELF_PATH = '.harbormaster/.context/SHELF.md';

const DIRECTIVES_TEMPLATE = `# Directives

## On session start
- Call \`harbormaster_context_get()\` to load current project context
- Core directives are in \`.harbormaster/.context/DIRECTIVES.md\`

## Operating rules
- Add project-specific AI operating rules here.
`;

const SHELF_TEMPLATE = `## Shelf

### Immediate Shelf
0) #
1) #
2) #
3) #
4) #

### Top Shelf

### Middle Shelf

### Bottom Shelf

### Long Term

### Completed
`;

const ENTRYPOINT_TEMPLATE = (projectName: string) => `# ${projectName}

Harbormaster is installed for this project.

## On session start
1. Call \`harbormaster_context_get()\` to load current project context.
2. Read \`.harbormaster/.context/DIRECTIVES.md\` for operating directives.
`;

export class ProjectScaffold {
  async initProject(
    folderUri: vscode.Uri,
    name: string,
    activeAiTools: AiTool[]
  ): Promise<{ created: string[] }> {
    const created: string[] = [];

    // Create a project store scoped to the target folder
    const store = new ProjectStore(folderUri);
    if (!(await store.exists())) {
      await store.write(store.createDefault(name));
      created.push(store.configUri.fsPath);
    }

    // Context files
    for (const [relativePath, content] of [
      [DIRECTIVES_PATH, DIRECTIVES_TEMPLATE],
      [SHELF_PATH, SHELF_TEMPLATE],
    ] as [string, string][]) {
      const uri = vscode.Uri.joinPath(folderUri, relativePath);
      if (!(await fileExists(uri))) {
        await writeFile(uri, content);
        created.push(relativePath);
      }
    }

    // Entrypoint files for configured AI tools
    for (const tool of activeAiTools) {
      const uri = vscode.Uri.joinPath(folderUri, AI_TOOL_ENTRYPOINTS[tool]);
      if (!(await fileExists(uri))) {
        await writeFile(uri, ENTRYPOINT_TEMPLATE(name));
        created.push(AI_TOOL_ENTRYPOINTS[tool]);
      }
    }

    return { created };
  }

  /** Idempotently adds entrypoint files for newly configured AI tools. */
  async ensureEntrypoints(
    folderUri: vscode.Uri,
    projectName: string,
    activeAiTools: AiTool[]
  ): Promise<{ created: string[] }> {
    const created: string[] = [];
    for (const tool of activeAiTools) {
      const uri = vscode.Uri.joinPath(folderUri, AI_TOOL_ENTRYPOINTS[tool]);
      if (!(await fileExists(uri))) {
        await writeFile(uri, ENTRYPOINT_TEMPLATE(projectName));
        created.push(AI_TOOL_ENTRYPOINTS[tool]);
      }
    }
    return { created };
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

async function writeFile(uri: vscode.Uri, content: string): Promise<void> {
  const segments = uri.path.split('/');
  segments.pop();
  const dirUri = uri.with({ path: segments.join('/') || '/' });
  await vscode.workspace.fs.createDirectory(dirUri);
  await vscode.workspace.fs.writeFile(uri, Buffer.from(content, 'utf8'));
}
