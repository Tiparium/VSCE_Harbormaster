import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { DirectivesService } from '../../project/directivesService';
import type { ProjectProvider } from '../workspace';
import { mcpError, mcpOk, mcpText } from '../response';

export function registerDirectivesTools(server: McpServer, getProject: ProjectProvider): void {
  server.tool(
    'harbormaster_core_directives_get',
    'Get only the project-specific Core Directives section from DIRECTIVES.md.',
    {},
    async () => run(getProject, async (directives) => mcpText(await directives.readCore()))
  );

  server.tool(
    'harbormaster_core_directive_add',
    'Add one project-specific core directive to DIRECTIVES.md.',
    { directive: z.string().describe('Concise project-specific objective or instruction') },
    async ({ directive }) => run(getProject, async (directives) => {
      await directives.addCore(directive);
      return mcpOk('Core directive added.');
    })
  );

  server.tool(
    'harbormaster_core_directive_remove',
    'Remove one uniquely matching project-specific core directive from DIRECTIVES.md.',
    { search: z.string().describe('Unique substring from the core directive') },
    async ({ search }) => run(getProject, async (directives) => {
      await directives.removeCore(search);
      return mcpOk('Core directive removed.');
    })
  );
}

async function run<T>(getProject: ProjectProvider, operation: (directives: DirectivesService) => Promise<T>) {
  try {
    const project = await getProject();
    return await operation(new DirectivesService(project.workspacePath));
  } catch (error) {
    return mcpError(error instanceof Error ? error.message : String(error));
  }
}
