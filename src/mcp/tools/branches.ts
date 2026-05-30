import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { BranchStore } from '../../store/branches';

export function registerBranchTools(server: McpServer, branchStore: BranchStore, projectPath: string): void {
  server.tool(
    'branch_list',
    'List all branches in the global Harbormaster library.',
    {},
    async () => {
      const branches = await branchStore.list();
      const candidates = branchStore.getPromotionCandidates(branches);
      const result = {
        branches,
        promotionCandidates: candidates.map((b) => b.id),
      };
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    'branch_create',
    'Create a new branch in the global library.',
    {
      name: z.string().describe('Short name for the branch'),
      description: z.string().describe('What this branch does'),
      directives: z.string().describe('The full directive content for this branch'),
    },
    async ({ name, description, directives }) => {
      const branch = await branchStore.create({ name, description, directives });
      return { content: [{ type: 'text', text: JSON.stringify(branch, null, 2) }] };
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
      return { content: [{ type: 'text', text: JSON.stringify(updated, null, 2) }] };
    }
  );

  server.tool(
    'branch_activate',
    'Activate a branch for the current project.',
    { id: z.string().describe('Branch ID to activate') },
    async ({ id }) => {
      const branch = await branchStore.get(id);
      if (!branch) {
        return { content: [{ type: 'text', text: 'Branch not found.' }], isError: true };
      }
      await branchStore.activate(id, projectPath);
      const score = branch.activatedBy.length + 1;
      const mention = score >= 3
        ? ` (Note: this branch has been activated in ${score} projects — consider promoting it to core.)`
        : '';
      return { content: [{ type: 'text', text: `Branch "${branch.name}" activated.${mention}` }] };
    }
  );

  server.tool(
    'branch_deactivate',
    'Deactivate a branch for the current project.',
    { id: z.string().describe('Branch ID to deactivate') },
    async ({ id }) => {
      await branchStore.deactivate(id, projectPath);
      return { content: [{ type: 'text', text: 'Branch deactivated.' }] };
    }
  );
}
