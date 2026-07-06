import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { BranchStore } from '../../store/branches';
import type { ProjectProvider } from '../workspace';
import { mcpText, mcpError } from '../response';
import { SHELF_BRANCH_ID } from '../../project/projectService';
import { BranchService } from '../../project/branchService';

export function registerProjectTools(server: McpServer, getProject: ProjectProvider, branches: BranchStore): void {
  server.tool(
    'harbormaster_full_context_get',
    'Load core project context: directives and active branch list. Includes optional branch context such as Shelf when active.',
    {},
    async () => withProject(getProject, async (project) => {
      const sections: string[] = [];
      sections.push(`## DIRECTIVES\n\n${await project.readDirectives()}`);

      const activeIds = await project.getActiveBranchIds();
      if (activeIds.includes(SHELF_BRANCH_ID)) {
        sections.push(`## SHELF\n\n${await project.readShelf()}`);
      }
      const allBranches = await new BranchService(branches, project, false).listAvailable();
      const active = activeIds
        .map((id) => allBranches.find((branch) => branch.id === id))
        .filter((branch): branch is NonNullable<typeof branch> => !!branch);
      const list = active.length
        ? `${active.map((branch) => `- ${branch.id}${branch.local ? ' (local)' : ''}: ${branch.name} — ${branch.description}`).join('\n')}\n\nTo get full behavior for a branch: branch_get(id)`
        : '(none)';
      sections.push(`## ACTIVE BRANCHES\n\n${list}`);
      return mcpText(sections.join('\n\n---\n\n'));
    })
  );

  server.tool(
    'harbormaster_directives_get',
    'Get the current DIRECTIVES.md content.',
    {},
    async () => withProject(getProject, async (project) => mcpText(await project.readDirectives()))
  );

  server.tool(
    'harbormaster_shelf_get',
    'Get the current SHELF.md content. Requires the Shelf branch to be active.',
    {},
    async () => withProject(getProject, async (project) => {
      if (!(await project.isBranchActive(SHELF_BRANCH_ID))) {
        return mcpError('The Shelf branch is not active for this project.');
      }
      return mcpText(await project.readShelf());
    })
  );
}

async function withProject<T>(getProject: ProjectProvider, operation: (project: Awaited<ReturnType<ProjectProvider>>) => Promise<T>) {
  try {
    return await operation(await getProject());
  } catch (error) {
    return mcpError(error instanceof Error ? error.message : String(error));
  }
}
