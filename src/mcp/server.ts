import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { CatalogStore } from '../store/catalog';
import type { BranchStore } from '../store/branches';
import { registerCatalogTools } from './tools/catalog';
import { registerProjectTools } from './tools/project';
import { registerBranchTools } from './tools/branches';
import { registerShelfTools } from './tools/shelf';
import { registerDirectivesTools } from './tools/directives';
import { createProjectProvider } from './workspace';

export type HarbormasterMcpConfig = {
  workspacePath?: string;
  catalog: CatalogStore;
  branches: BranchStore;
  devMode?: boolean;
};

export function createMcpServer(config: HarbormasterMcpConfig): McpServer {
  const server = new McpServer({
    name: 'harbormaster',
    version: '3.0.0',
  });
  const getProject = createProjectProvider(server, config.workspacePath);

  registerCatalogTools(server, config.catalog);
  registerProjectTools(server, getProject, config.branches);
  registerDirectivesTools(server, getProject);
  registerBranchTools(server, config.branches, getProject, config.devMode ?? false);
  registerShelfTools(server, getProject);

  return server;
}

/** Entry point when the server is launched as a child process via stdio. */
export async function runMcpServer(config: HarbormasterMcpConfig): Promise<void> {
  const server = createMcpServer(config);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
