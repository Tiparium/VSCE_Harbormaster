import { z } from 'zod';
import * as fs from 'fs/promises';
import * as path from 'path';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { BranchStore } from '../../store/branches';

const CONFIG_PATH = '.harbormaster/.meta/project.json';

export function registerBranchTools(server: McpServer, branchStore: BranchStore, projectPath: string): void {
  server.tool(
    'branch_library_list',
    'List all branches in the global Harbormaster library, including canonical branches that ship with Harbormaster.',
    {},
    async () => {
      const branches = await branchStore.list();
      const summaries = branchStore.summaries(branches);
      return { content: [{ type: 'text', text: JSON.stringify(summaries, null, 2) }] };
    }
  );

  server.tool(
    'project_branches_list',
    'List the branches active for the current project, with their names and descriptions. Does not return full directives — use branch_get(id) for that.',
    {},
    async () => {
      const activeIds = await readActiveBranches(projectPath);
      if (activeIds.length === 0) {
        return { content: [{ type: 'text', text: 'No branches active for this project.' }] };
      }
      const allBranches = await branchStore.list();
      const active = activeIds
        .map((id) => allBranches.find((b) => b.id === id))
        .filter((b): b is NonNullable<typeof b> => b !== undefined)
        .map(({ id, name, description, score, canonical }) => ({ id, name, description, score, canonical }));
      return { content: [{ type: 'text', text: JSON.stringify(active, null, 2) }] };
    }
  );

  server.tool(
    'branch_get',
    'Get the full directives for a specific branch. Call this when you are about to perform a branch workflow.',
    { id: z.string().describe('Branch ID') },
    async ({ id }) => {
      const branch = await branchStore.get(id);
      if (!branch) {
        return { content: [{ type: 'text', text: `Branch "${id}" not found.` }], isError: true };
      }
      return { content: [{ type: 'text', text: branch.directives }] };
    }
  );

  server.tool(
    'branch_activate',
    'Activate a branch for the current project.',
    { id: z.string().describe('Branch ID to activate') },
    async ({ id }) => {
      const branch = await branchStore.get(id);
      if (!branch) {
        return { content: [{ type: 'text', text: `Branch "${id}" not found.` }], isError: true };
      }
      const activeIds = await readActiveBranches(projectPath);
      if (!activeIds.includes(id)) {
        await writeActiveBranches(projectPath, [...activeIds, id]);
        await branchStore.incrementScore(id);
      }
      return { content: [{ type: 'text', text: `Branch "${branch.name}" activated.` }] };
    }
  );

  server.tool(
    'branch_deactivate',
    'Deactivate a branch for the current project.',
    { id: z.string().describe('Branch ID to deactivate') },
    async ({ id }) => {
      const activeIds = await readActiveBranches(projectPath);
      if (activeIds.includes(id)) {
        await writeActiveBranches(projectPath, activeIds.filter((b) => b !== id));
        await branchStore.decrementScore(id);
      }
      return { content: [{ type: 'text', text: `Branch "${id}" deactivated.` }] };
    }
  );

  server.tool(
    'branch_create',
    'Create a new branch in the global library.',
    {
      name: z.string().describe('Short name for the branch'),
      description: z.string().describe('What this branch does'),
      directives: z.string().describe('Full directive content for this branch'),
    },
    async ({ name, description, directives }) => {
      const branch = await branchStore.create({ name, description, directives });
      return { content: [{ type: 'text', text: JSON.stringify(branchStore.summaries([branch])[0], null, 2) }] };
    }
  );

  server.tool(
    'branch_update',
    'Update an existing branch in the global library.',
    {
      id: z.string().describe('Branch ID'),
      name: z.string().optional(),
      description: z.string().optional(),
      directives: z.string().optional(),
    },
    async ({ id, ...patch }) => {
      const updated = await branchStore.update(id, patch);
      if (!updated) {
        return { content: [{ type: 'text', text: 'Branch not found.' }], isError: true };
      }
      return { content: [{ type: 'text', text: JSON.stringify(branchStore.summaries([updated])[0], null, 2) }] };
    }
  );
}

async function readActiveBranches(projectPath: string): Promise<string[]> {
  try {
    const raw = JSON.parse(await fs.readFile(path.join(projectPath, CONFIG_PATH), 'utf8'));
    return Array.isArray(raw.activeBranches) ? raw.activeBranches : [];
  } catch {
    return [];
  }
}

async function writeActiveBranches(projectPath: string, ids: string[]): Promise<void> {
  const configPath = path.join(projectPath, CONFIG_PATH);
  const raw = JSON.parse(await fs.readFile(configPath, 'utf8'));
  raw.activeBranches = ids;
  await fs.writeFile(configPath, JSON.stringify(raw, null, 2) + '\n', 'utf8');
}
