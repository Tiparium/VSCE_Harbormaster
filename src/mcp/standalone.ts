/**
 * Standalone stdio MCP server entry point.
 *
 * HM_WORKSPACE is an optional explicit project override. Without it, project
 * tools resolve the client's MCP roots and then search upward from process.cwd().
 */
import * as path from 'path';
import * as os from 'os';
import { CatalogStore } from '../store/catalog';
import { BranchStore } from '../store/branches';
import { CANONICAL_BRANCHES, RETIRED_BRANCH_IDS } from '../store/canonicalBranches';
import { GlobalStore } from '../store/globalStore';
import { runMcpServer } from './server';

const devMode = process.env.HM_DEV === '1';
const storagePath = process.env.HM_GLOBAL_STORAGE ?? resolveGlobalStoragePath();
const globalStore = new GlobalStore(storagePath, devMode);
const catalog = new CatalogStore(globalStore);
const branches = new BranchStore(globalStore);

void branches.seed(CANONICAL_BRANCHES).then(() => branches.retire(RETIRED_BRANCH_IDS)).then(() => runMcpServer({
  workspacePath: process.env.HM_WORKSPACE,
  catalog,
  branches,
  devMode,
}));

function resolveGlobalStoragePath(): string {
  switch (process.platform) {
    case 'darwin':
      return path.join(os.homedir(), 'Library/Application Support/Code/User/globalStorage/harbormaster.harbormaster');
    case 'win32':
      return path.join(os.homedir(), 'AppData/Roaming/Code/User/globalStorage/harbormaster.harbormaster');
    default:
      return path.join(os.homedir(), '.config/Code/User/globalStorage/harbormaster.harbormaster');
  }
}
