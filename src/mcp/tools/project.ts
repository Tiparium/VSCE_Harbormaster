import { z } from 'zod';
import * as fs from 'fs/promises';
import * as path from 'path';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

const DIRECTIVES_PATH = '.harbormaster/.context/DIRECTIVES.md';
const SHELF_PATH = '.harbormaster/.context/SHELF.md';

export function registerProjectTools(server: McpServer, workspacePath: string): void {
  server.tool(
    'harbormaster_context_get',
    'Get the current project context: directives and shelf contents. Call this at the start of every session.',
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

      return { content: [{ type: 'text', text: sections.join('\n\n---\n\n') }] };
    }
  );

  server.tool(
    'harbormaster_directives_set',
    'Overwrite the project DIRECTIVES.md with new content.',
    { content: z.string().describe('Full content to write to DIRECTIVES.md') },
    async ({ content }) => {
      const target = path.join(workspacePath, DIRECTIVES_PATH);
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, content.endsWith('\n') ? content : `${content}\n`, 'utf8');
      return { content: [{ type: 'text', text: 'DIRECTIVES.md updated.' }] };
    }
  );
}
