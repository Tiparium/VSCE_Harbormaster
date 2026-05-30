import { z } from 'zod';
import * as fs from 'fs/promises';
import * as path from 'path';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { BranchStore } from '../../store/branches';

const DIRECTIVES_PATH = '.harbormaster/.context/DIRECTIVES.md';
const SHELF_PATH = '.harbormaster/.context/SHELF.md';
const CONFIG_PATH = '.harbormaster/.meta/project.json';

export function registerProjectTools(server: McpServer, workspacePath: string, branches: BranchStore): void {
  server.tool(
    'harbormaster_full_context_get',
    'Load full project context: directives, shelf, and active branch list. Use at session start. For targeted refreshes during work, prefer the focused tools.',
    {},
    async () => {
      const sections: string[] = [];

      try {
        const directives = await fs.readFile(path.join(workspacePath, DIRECTIVES_PATH), 'utf8');
        sections.push(`## DIRECTIVES\n\n${directives}`);
      } catch {
        sections.push('## DIRECTIVES\n\n(not found)');
      }

      try {
        const shelf = await fs.readFile(path.join(workspacePath, SHELF_PATH), 'utf8');
        sections.push(`## SHELF\n\n${shelf}`);
      } catch {
        sections.push('## SHELF\n\n(not found)');
      }

      const activeBranchSummaries = await getActiveBranchSummaries(workspacePath, branches);
      if (activeBranchSummaries.length > 0) {
        const list = activeBranchSummaries.map((b) => `- ${b.id}: ${b.name} — ${b.description}`).join('\n');
        sections.push(`## ACTIVE BRANCHES\n\n${list}\n\nTo get full behavior for a branch: branch_get(id)`);
      } else {
        sections.push('## ACTIVE BRANCHES\n\n(none)');
      }

      return { content: [{ type: 'text', text: sections.join('\n\n---\n\n') }] };
    }
  );

  server.tool(
    'harbormaster_directives_get',
    'Get the current DIRECTIVES.md content.',
    {},
    async () => {
      try {
        const content = await fs.readFile(path.join(workspacePath, DIRECTIVES_PATH), 'utf8');
        return { content: [{ type: 'text', text: content }] };
      } catch {
        return { content: [{ type: 'text', text: '(DIRECTIVES.md not found)' }], isError: true };
      }
    }
  );

  server.tool(
    'harbormaster_shelf_get',
    'Get the current SHELF.md content.',
    {},
    async () => {
      try {
        const content = await fs.readFile(path.join(workspacePath, SHELF_PATH), 'utf8');
        return { content: [{ type: 'text', text: content }] };
      } catch {
        return { content: [{ type: 'text', text: '(SHELF.md not found)' }], isError: true };
      }
    }
  );

  server.tool(
    'harbormaster_directives_set',
    'Overwrite DIRECTIVES.md with new content.',
    { content: z.string().describe('Full content to write to DIRECTIVES.md') },
    async ({ content }) => {
      const target = path.join(workspacePath, DIRECTIVES_PATH);
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, content.endsWith('\n') ? content : `${content}\n`, 'utf8');
      return { content: [{ type: 'text', text: 'DIRECTIVES.md updated.' }] };
    }
  );
}

async function getActiveBranchSummaries(
  workspacePath: string,
  branches: BranchStore
): Promise<{ id: string; name: string; description: string }[]> {
  try {
    const raw = JSON.parse(await fs.readFile(path.join(workspacePath, CONFIG_PATH), 'utf8'));
    const activeIds: string[] = Array.isArray(raw.activeBranches) ? raw.activeBranches : [];
    if (activeIds.length === 0) return [];
    const allBranches = await branches.list();
    return activeIds
      .map((id) => allBranches.find((b) => b.id === id))
      .filter((b): b is NonNullable<typeof b> => b !== undefined)
      .map(({ id, name, description }) => ({ id, name, description }));
  } catch {
    return [];
  }
}
