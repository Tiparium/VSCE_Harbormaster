import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { afterEach, describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { ProjectService } from '../../src/project/projectService';
import { createMcpServer } from '../../src/mcp/server';
import { GlobalStore } from '../../src/store/globalStore';
import { CatalogStore } from '../../src/store/catalog';
import { BranchStore } from '../../src/store/branches';
import { CANONICAL_BRANCHES } from '../../src/store/canonicalBranches';

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

describe('MCP server', () => {
  it('loads project context and mutates the shelf through services', async () => {
    const root = await tempDir('project');
    const storage = await tempDir('storage');
    await new ProjectService(root).adopt('Integration', []);
    const global = new GlobalStore(storage, true);
    const branches = new BranchStore(global);
    await branches.seed(CANONICAL_BRANCHES);
    const server = createMcpServer({
      workspacePath: root,
      catalog: new CatalogStore(global),
      branches,
      devMode: true,
    });
    const client = new Client({ name: 'test', version: '1.0.0' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const context = await client.callTool({ name: 'harbormaster_full_context_get', arguments: {} });
    expect(text(context)).toContain('## DIRECTIVES');
    expect(text(context)).not.toContain('## SHELF');

    await client.callTool({
      name: 'harbormaster_core_directive_add',
      arguments: { directive: 'Keep MCP behavior deterministic.' },
    });
    expect(text(await client.callTool({ name: 'harbormaster_core_directives_get', arguments: {} })))
      .toContain('Keep MCP behavior deterministic.');
    await client.callTool({
      name: 'harbormaster_core_directive_remove',
      arguments: { search: 'deterministic' },
    });
    expect(text(await client.callTool({ name: 'harbormaster_core_directives_get', arguments: {} }))).toBe('');

    await client.callTool({ name: 'branch_activate', arguments: { id: 'shelf' } });
    await client.callTool({ name: 'branch_activate', arguments: { id: 'brainstorm-session' } });
    expect((await fs.stat(path.join(root, '.harbormaster/brainstorms'))).isDirectory()).toBe(true);

    const created = await client.callTool({
      name: 'project_branch_create',
      arguments: {
        name: 'Local Workflow',
        description: 'Only for this project',
        directives: '## Local Workflow\nUse local instructions.',
      },
    });
    const localId = JSON.parse(text(created)).id;
    await client.callTool({ name: 'branch_activate', arguments: { id: localId } });
    expect(text(await client.callTool({ name: 'branch_get', arguments: { id: localId } })))
      .toContain('Use local instructions.');
    expect(text(await client.callTool({ name: 'harbormaster_full_context_get', arguments: {} })))
      .toContain(`${localId} (local): Local Workflow`);

    const forked = await client.callTool({
      name: 'branch_fork',
      arguments: { id: 'brainstorm-session', name: 'Local Brainstorm' },
    });
    expect(JSON.parse(text(forked)).forkedFrom).toBe('brainstorm-session');

    await client.callTool({
      name: 'harbormaster_shelf_item_add',
      arguments: { tier: 'top', description: 'Integration item', details: 'Created through MCP' },
    });
    await client.callTool({
      name: 'shelf_item_replace',
      arguments: { search: 'Integration item', description: 'Updated integration item' },
    });
    const shelfResult = await client.callTool({
      name: 'harbormaster_shelf_item_complete',
      arguments: { search: 'Updated integration item', completionNote: 'Verified by MCP test' },
    });
    expect(JSON.parse(text(shelfResult)).changedSection).toContain('Verified by MCP test');
    expect(await fs.readFile(path.join(root, '.harbormaster/shelf/SHELF.md'), 'utf8')).toContain('Updated integration item');

    await client.close();
    await server.close();
  });
});

function text(result: { content: unknown[] }): string {
  const item = result.content[0] as { type?: string; text?: string };
  return item.type === 'text' ? item.text ?? '' : '';
}

async function tempDir(label: string): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), `harbormaster-${label}-`));
  tempDirs.push(dir);
  return dir;
}
