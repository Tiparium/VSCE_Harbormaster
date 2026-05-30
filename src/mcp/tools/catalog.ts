import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CatalogStore } from '../../store/catalog';

const SORT_KEYS = ['lastEdited', 'lastOpened', 'created', 'name', 'tags'] as const;

export function registerCatalogTools(server: McpServer, catalog: CatalogStore): void {
  server.tool(
    'catalog_list',
    'List all projects in the Harbormaster catalog.',
    {
      sortBy: z.enum(SORT_KEYS).optional().describe('Sort order (default: lastEdited)'),
    },
    async ({ sortBy }) => {
      const projects = await catalog.list();
      const sorted = catalog.sort(projects, sortBy ?? 'lastEdited');
      return {
        content: [{ type: 'text', text: JSON.stringify(sorted, null, 2) }],
      };
    }
  );

  server.tool(
    'catalog_find',
    'Find a project in the catalog by its filesystem path.',
    { path: z.string().describe('Absolute path to the project folder') },
    async ({ path }) => {
      const project = await catalog.findByPath(path);
      if (!project) {
        return { content: [{ type: 'text', text: 'Project not found.' }], isError: true };
      }
      return { content: [{ type: 'text', text: JSON.stringify(project, null, 2) }] };
    }
  );
}
