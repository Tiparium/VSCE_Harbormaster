import { fileURLToPath } from 'url';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ProjectService, resolveProjectPath } from '../project/projectService';

export type ProjectProvider = () => Promise<ProjectService>;

export function createProjectProvider(server: McpServer, workspaceHint?: string): ProjectProvider {
  return async () => {
    const candidates: string[] = [];
    if (workspaceHint) candidates.push(workspaceHint);

    if (server.isConnected()) {
      try {
        const result = await server.server.listRoots();
        for (const root of result.roots) {
          if (root.uri.startsWith('file:')) candidates.push(fileURLToPath(root.uri));
        }
      } catch {
        // Roots are optional. Fall back to the launch directory.
      }
    }

    candidates.push(process.cwd());
    for (const candidate of [...new Set(candidates)]) {
      const resolved = await resolveProjectPath(candidate);
      if (resolved) return new ProjectService(resolved);
    }

    throw new Error('No Harbormaster project found. Open a folder containing .harbormaster/project.json or set HM_WORKSPACE.');
  };
}
