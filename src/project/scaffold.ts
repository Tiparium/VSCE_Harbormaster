import * as vscode from 'vscode';
import type { AiTool } from '../types/global';
import { AI_TOOL_ENTRYPOINTS } from '../types/global';
import { ProjectStore } from '../store/projectStore';
import { CANONICAL_BRANCH_IDS } from '../store/canonicalBranches';

const DIRECTIVES_PATH = '.harbormaster/.context/DIRECTIVES.md';
const SHELF_PATH = '.harbormaster/.context/SHELF.md';

const DIRECTIVES_TEMPLATE = `# Directives

## On session start
Read this file and \`.harbormaster/.context/SHELF.md\` before doing any work.
If the Harbormaster MCP server is configured, \`harbormaster_full_context_get()\` loads both plus your active branch list in one call.

## Branch behaviors
This project uses Harbormaster branches — modular behavior directives for specific workflows.
Branches require the Harbormaster MCP server. If MCP is not configured, branch behaviors are not available.

- To see which branches are active: \`project_branches_list()\`
- To get the full instructions for a branch before performing that workflow: \`branch_get(id)\`
- Do not load all branch content at session start — fetch a branch only when you need it.

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
Read \`.harbormaster/.context/DIRECTIVES.md\` and \`.harbormaster/.context/SHELF.md\` before doing any work.
If the Harbormaster MCP server is configured, \`harbormaster_context_get()\` loads both in one call.
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
      const config = store.createDefault(name);
      config.activeBranches = [...CANONICAL_BRANCH_IDS];
      await store.write(config);
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
