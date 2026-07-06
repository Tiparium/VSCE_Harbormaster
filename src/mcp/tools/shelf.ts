import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ShelfService } from '../../project/shelfService';
import type { ProjectProvider } from '../workspace';
import { mcpData, mcpError } from '../response';
import { SHELF_BRANCH_ID } from '../../project/projectService';

const TIER_PARAM = z.enum(['immediate', 'top', 'middle', 'bottom', 'longterm', 'completed']);

export function registerShelfTools(server: McpServer, getProject: ProjectProvider): void {
  registerShelfSetTool(server, getProject);
  registerShelfAddTool(server, getProject, 'harbormaster_shelf_item_add');
  registerShelfMoveTool(server, getProject, 'harbormaster_shelf_item_move');
  registerShelfReplaceTool(server, getProject, 'harbormaster_shelf_item_replace');
  registerShelfCompleteTool(server, getProject, 'harbormaster_shelf_item_complete');

  registerShelfAddTool(server, getProject, 'shelf_item_add');
  registerShelfMoveTool(server, getProject, 'shelf_item_move');
  registerShelfReplaceTool(server, getProject, 'shelf_item_replace');
  registerShelfCompleteTool(server, getProject, 'shelf_item_complete');
}

function registerShelfSetTool(server: McpServer, getProject: ProjectProvider): void {
  server.tool(
    'harbormaster_shelf_set',
    'Replace the full SHELF.md content.',
    { content: z.string().describe('Full Markdown content for SHELF.md') },
    async ({ content }) => run(getProject, async (shelf) => shelf.set(content))
  );
}

function registerShelfAddTool(server: McpServer, getProject: ProjectProvider, name: string): void {
  server.tool(
    name,
    'Add a new item to the specified shelf tier.',
    {
      tier: TIER_PARAM.describe('Shelf tier to add the item to'),
      description: z.string().describe('Short description of the item'),
      details: z.string().optional().describe('Additional detail for the item'),
      reason: z.string().optional().describe('Why this item is on the shelf'),
      impact: z.string().optional().describe('What completing it would affect'),
    },
    async ({ tier, description, reason, impact, details }) => run(getProject, async (shelf) =>
      shelf.add(tier, description, reason, impact, details)
    )
  );
}

function registerShelfMoveTool(server: McpServer, getProject: ProjectProvider, name: string): void {
  server.tool(
    name,
    'Move one uniquely matching shelf item to a different tier.',
    {
      search: z.string().describe('Unique substring from the item description'),
      fromTier: TIER_PARAM.optional().describe('Optional source shelf tier to narrow the match'),
      targetTier: TIER_PARAM.describe('Tier to move the item to'),
      position: z.number().int().min(0).optional().describe('Optional zero-based item position in the target tier'),
    },
    async ({ search, targetTier, fromTier, position }) => run(getProject, async (shelf) =>
      shelf.move(search, targetTier, fromTier, position)
    )
  );
}

function registerShelfReplaceTool(server: McpServer, getProject: ProjectProvider, name: string): void {
  server.tool(
    name,
    'Replace one uniquely matching shelf item.',
    {
      search: z.string().describe('Unique substring from the current item description'),
      description: z.string().describe('Replacement short description for the item'),
      details: z.string().optional().describe('Replacement detail for the item'),
      reason: z.string().optional().describe('Replacement reason for the item'),
      impact: z.string().optional().describe('Replacement impact for the item'),
    },
    async ({ search, description, reason, impact, details }) => run(getProject, async (shelf) =>
      shelf.replace(search, description, reason, impact, details)
    )
  );
}

function registerShelfCompleteTool(server: McpServer, getProject: ProjectProvider, name: string): void {
  server.tool(
    name,
    'Mark one uniquely matching shelf item as completed.',
    {
      search: z.string().describe('Unique substring from the item description'),
      completionNote: z.string().optional().describe('Optional note to add when completing the item'),
    },
    async ({ search, completionNote }) => run(getProject, async (shelf) =>
      shelf.complete(search, completionNote)
    )
  );
}

async function run(getProject: ProjectProvider, operation: (shelf: ShelfService) => Promise<unknown>) {
  try {
    const project = await getProject();
    if (!(await project.isBranchActive(SHELF_BRANCH_ID))) {
      return mcpError('The Shelf branch is not active for this project. Activate it with branch_activate(id: "shelf").');
    }
    return mcpData({ ok: true, ...(await operation(new ShelfService(project.workspacePath)) as object) });
  } catch (error) {
    return mcpError(error instanceof Error ? error.message : String(error));
  }
}
