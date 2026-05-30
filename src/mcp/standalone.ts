/**
 * Standalone MCP server entry point — runs outside the VS Code extension host.
 * Uses Node.js fs directly instead of vscode.workspace.fs.
 *
 * Environment variables:
 *   HM_WORKSPACE       — absolute path to the project folder (required)
 *   HM_GLOBAL_STORAGE  — path to Harbormaster global storage (optional, auto-detected)
 *   HM_DEV             — set to '1' to use the dev database
 */
import * as nodeFs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CatalogStore } from '../store/catalog';
import { BranchStore } from '../store/branches';
import { registerCatalogTools } from './tools/catalog';
import { registerProjectTools } from './tools/project';
import { registerBranchTools } from './tools/branches';
import type { GlobalData } from '../types/global';
import { defaultGlobalData } from '../types/global';
import { migrateGlobalData } from '../store/migration';
import type { GlobalStoreApi } from '../store/globalStore';

// ── Configuration ────────────────────────────────────────────────────────────

const WORKSPACE = process.env.HM_WORKSPACE ?? process.cwd();
const DEV = process.env.HM_DEV === '1';

function resolveGlobalStoragePath(): string {
  if (process.env.HM_GLOBAL_STORAGE) return process.env.HM_GLOBAL_STORAGE;
  switch (process.platform) {
    case 'darwin':
      return path.join(os.homedir(), 'Library/Application Support/Code/User/globalStorage/harbormaster.harbormaster');
    case 'win32':
      return path.join(os.homedir(), 'AppData/Roaming/Code/User/globalStorage/harbormaster.harbormaster');
    default:
      return path.join(os.homedir(), '.config/Code/User/globalStorage/harbormaster.harbormaster');
  }
}

const GLOBAL_FILE = path.join(
  resolveGlobalStoragePath(),
  DEV ? 'harbormaster.global.dev.json' : 'harbormaster.global.json'
);

// ── Node.js-backed store ─────────────────────────────────────────────────────

class NodeGlobalStore implements GlobalStoreApi {
  constructor(private readonly filePath: string) {}

  async read(): Promise<GlobalData> {
    try {
      const content = await nodeFs.readFile(this.filePath, 'utf8');
      return migrateGlobalData(JSON.parse(content));
    } catch {
      return defaultGlobalData();
    }
  }

  async write(data: GlobalData): Promise<void> {
    await nodeFs.mkdir(path.dirname(this.filePath), { recursive: true });
    await nodeFs.writeFile(this.filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
  }
}

// ── Server setup ─────────────────────────────────────────────────────────────

const store = new NodeGlobalStore(GLOBAL_FILE);
const catalog = new CatalogStore(store);
const branches = new BranchStore(store);

const server = new McpServer({ name: 'harbormaster', version: '3.0.0' });
registerCatalogTools(server, catalog);
registerProjectTools(server, WORKSPACE, branches);
registerBranchTools(server, branches, WORKSPACE);

const transport = new StdioServerTransport();
void server.connect(transport);
