import * as fs from 'fs/promises';
import * as path from 'path';
import { DIRECTIVES_PATH } from './paths';
import { withFileLock, writeTextAtomic } from '../utils/atomicFile';

const CORE_HEADER = '## Core Directives';

export class DirectivesService {
  private readonly directivesPath: string;

  constructor(workspacePath: string) {
    this.directivesPath = path.join(workspacePath, DIRECTIVES_PATH);
  }

  async readCore(): Promise<string> {
    const content = await fs.readFile(this.directivesPath, 'utf8');
    const section = findSection(content);
    return section.body.trim();
  }

  async ensureCoreSection(): Promise<boolean> {
    let changed = false;
    await this.mutate((content) => {
      if (content.includes(CORE_HEADER)) return content;
      changed = true;
      const branchHeader = content.indexOf('\n## Branch behaviors');
      if (branchHeader >= 0) {
        return `${content.slice(0, branchHeader)}\n\n${CORE_HEADER}\n${content.slice(branchHeader)}`;
      }
      return `${content.trimEnd()}\n\n${CORE_HEADER}\n`;
    });
    return changed;
  }

  async addCore(directive: string): Promise<void> {
    const normalized = directive.trim();
    if (!normalized) throw new Error('Core directive cannot be empty.');
    if (/[\r\n]/.test(normalized)) throw new Error('Core directives must be a single line.');
    await this.mutate((content) => {
      const section = findSection(content);
      const items = parseItems(section.body);
      if (items.some((item) => item.text.toLowerCase() === normalized.toLowerCase())) {
        throw new Error('That core directive already exists.');
      }
      const body = section.body.trimEnd();
      const nextBody = `${body ? `${body}\n` : '\n'}- ${normalized}\n\n`;
      return replaceSection(content, section, nextBody);
    });
  }

  async removeCore(search: string): Promise<void> {
    const normalized = search.trim().toLowerCase();
    if (!normalized) throw new Error('Core directive search cannot be empty.');
    await this.mutate((content) => {
      const section = findSection(content);
      const matches = parseItems(section.body).filter((item) => item.text.toLowerCase().includes(normalized));
      if (matches.length === 0) throw new Error(`No core directive matching "${search}" found.`);
      if (matches.length > 1) throw new Error(`Multiple core directives match "${search}". Use a more specific search.`);
      const match = matches[0];
      const body = `${section.body.slice(0, match.start)}${section.body.slice(match.end)}`;
      return replaceSection(content, section, body.trim() ? body : '\n\n');
    });
  }

  private async mutate(mutator: (content: string) => string): Promise<void> {
    await withFileLock(this.directivesPath, async () => {
      const content = await fs.readFile(this.directivesPath, 'utf8');
      const next = mutator(content);
      if (next !== content) await writeTextAtomic(this.directivesPath, next);
    });
  }
}

type Section = { bodyStart: number; bodyEnd: number; body: string };
type Item = { start: number; end: number; text: string };

function findSection(content: string): Section {
  const headerStart = content.indexOf(CORE_HEADER);
  if (headerStart < 0) throw new Error(`${CORE_HEADER} section not found in DIRECTIVES.md.`);
  const bodyStart = content.indexOf('\n', headerStart) + 1;
  const nextHeader = content.indexOf('\n## ', bodyStart);
  const bodyEnd = nextHeader < 0 ? content.length : nextHeader + 1;
  return { bodyStart, bodyEnd, body: content.slice(bodyStart, bodyEnd) };
}

function replaceSection(content: string, section: Section, body: string): string {
  return `${content.slice(0, section.bodyStart)}${body}${content.slice(section.bodyEnd)}`;
}

function parseItems(body: string): Item[] {
  const lines = body.split(/(?<=\n)/);
  const items: Item[] = [];
  let offset = 0;
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    if (!line.startsWith('- ')) {
      offset += line.length;
      continue;
    }
    let end = offset + line.length;
    let text = line.slice(2).trim();
    while (index + 1 < lines.length && /^\s+/.test(lines[index + 1]) && !lines[index + 1].startsWith('## ')) {
      index++;
      const continuation = lines[index].trim();
      if (continuation) text += ` ${continuation}`;
      end += lines[index].length;
    }
    items.push({ start: offset, end, text });
    offset = end;
  }
  return items;
}
