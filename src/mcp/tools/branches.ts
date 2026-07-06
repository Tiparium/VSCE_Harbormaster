import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { BranchService } from '../../project/branchService';
import type { BranchStore } from '../../store/branches';
import type { ProjectProvider } from '../workspace';
import { mcpData, mcpOk, mcpError, mcpText } from '../response';

const artifactFileSchema = z.object({
  path: z.string(),
  content: z.string(),
});

const artifactsSchema = z.object({
  root: z.string().describe('Project-relative directory inside .harbormaster.'),
  initialFiles: z.array(artifactFileSchema).optional(),
});

export function registerBranchTools(
  server: McpServer,
  branchStore: BranchStore,
  getProject: ProjectProvider,
  devMode: boolean
): void {
  server.tool('branch_library_list', 'List all branches in the global Harbormaster library.', {}, async () => {
    const branches = await branchStore.list();
    return mcpData(branchStore.summaries(branches));
  });

  server.tool('project_branches_list', 'List branches active for the current project.', {}, async () =>
    run(getProject, branchStore, devMode, async (service) => mcpData(service.summaries(await service.listActive())))
  );

  server.tool('branch_get', 'Get the full directives for a specific branch.', { id: z.string() }, async ({ id }) => {
    const project = await getOptionalProject(getProject);
    const branch = await new BranchService(branchStore, project, devMode).get(id);
    return branch ? mcpText(branch.directives) : mcpError(`Branch "${id}" not found.`);
  });

  server.tool('branch_activate', 'Activate a branch for the current project.', { id: z.string() }, async ({ id }) =>
    run(getProject, branchStore, devMode, async (service) => mcpOk(`Branch "${(await service.activate(id)).name}" activated.`))
  );

  server.tool('branch_deactivate', 'Deactivate a branch for the current project.', { id: z.string() }, async ({ id }) =>
    run(getProject, branchStore, devMode, async (service) => {
      await service.deactivate(id);
      return mcpOk(`Branch "${id}" deactivated.`);
    })
  );

  server.tool(
    'branch_create',
    'Create a new branch in the global library.',
    { name: z.string(), description: z.string(), directives: z.string(), artifacts: artifactsSchema.optional() },
    async (input) => runGlobal(branchStore, devMode, async (service) =>
      mcpData(service.summaries([await service.create(input)])[0]))
  );

  server.tool('project_branch_library_list', 'List branches available to the current project, including project-local branches.', {}, async () =>
    run(getProject, branchStore, devMode, async (service) => mcpData(service.summaries(await service.listAvailable())))
  );

  server.tool('project_local_branches_list', 'List branches defined only in the current project.', {}, async () =>
    run(getProject, branchStore, devMode, async (service) => mcpData(service.summaries(await service.listLocal())))
  );

  server.tool(
    'project_branch_create',
    'Create a branch definition local to the current project without adding it to the global library.',
    { name: z.string(), description: z.string(), directives: z.string(), artifacts: artifactsSchema.optional() },
    async (input) => run(getProject, branchStore, devMode, async (service) =>
      mcpData(service.summaries([await service.createLocal(input)])[0]))
  );

  server.tool(
    'branch_fork',
    'Fork an existing global or local branch into a new project-local branch.',
    {
      id: z.string(),
      name: z.string().optional(),
      description: z.string().optional(),
      directives: z.string().optional(),
      artifacts: artifactsSchema.optional(),
    },
    async ({ id, ...overrides }) => run(getProject, branchStore, devMode, async (service) =>
      mcpData(service.summaries([await service.forkLocal(id, overrides)])[0]))
  );

  server.tool(
    'branch_remove',
    devMode ? 'Permanently delete a branch created in this dev session.' : 'Flag a branch for deletion pending UI confirmation.',
    { id: z.string() },
    async ({ id }) => runGlobal(branchStore, devMode, async (service) => {
      const result = await service.remove(id);
      return mcpOk(result === 'deleted' ? `Branch "${id}" permanently deleted.` : `Branch "${id}" flagged for deletion.`);
    })
  );

  server.tool(
    'branch_update',
    'Update an existing branch in the global library.',
    {
      id: z.string(),
      name: z.string().optional(),
      description: z.string().optional(),
      directives: z.string().optional(),
      artifacts: artifactsSchema.optional(),
    },
    async ({ id, ...patch }) => runGlobal(branchStore, devMode, async (service) => {
      const updated = await service.update(id, patch);
      return updated ? mcpData(service.summaries([updated])[0]) : mcpError('Branch not found.');
    })
  );

  server.tool(
    'project_branch_update',
    'Update a branch definition local to the current project.',
    {
      id: z.string(),
      name: z.string().optional(),
      description: z.string().optional(),
      directives: z.string().optional(),
      artifacts: artifactsSchema.optional(),
    },
    async ({ id, ...patch }) => run(getProject, branchStore, devMode, async (service) => {
      const updated = await service.updateLocal(id, patch);
      return updated ? mcpData(service.summaries([updated])[0]) : mcpError('Local branch not found.');
    })
  );
}

async function runGlobal<T>(
  store: BranchStore,
  devMode: boolean,
  operation: (service: BranchService) => Promise<T>
) {
  try {
    return await operation(new BranchService(store, undefined, devMode));
  } catch (error) {
    return mcpError(error instanceof Error ? error.message : String(error));
  }
}

async function run<T>(
  getProject: ProjectProvider,
  store: BranchStore,
  devMode: boolean,
  operation: (service: BranchService) => Promise<T>
) {
  try {
    return await operation(new BranchService(store, await getProject(), devMode));
  } catch (error) {
    return mcpError(error instanceof Error ? error.message : String(error));
  }
}

async function getOptionalProject(getProject: ProjectProvider) {
  try {
    return await getProject();
  } catch {
    return undefined;
  }
}
