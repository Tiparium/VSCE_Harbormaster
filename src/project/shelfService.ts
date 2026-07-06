import * as fs from 'fs/promises';
import * as path from 'path';
import { SHELF_PATH } from './paths';
import { withFileLock, writeTextAtomic } from '../utils/atomicFile';

export type ShelfTier = 'immediate' | 'top' | 'middle' | 'bottom' | 'longterm' | 'completed';
export type ShelfMutationResult = {
  summary: string;
  content: string;
  changedSection?: string;
};

const TIER_HEADERS: Record<ShelfTier, string> = {
  immediate: '### Immediate Shelf',
  top: '### Top Shelf',
  middle: '### Middle Shelf',
  bottom: '### Bottom Shelf',
  longterm: '### Long Term',
  completed: '### Completed',
};
const ITEM_PREFIX_PATTERN = /^\s*(?:[-*+]\s+|\d+[\.)]\s+)/;

export class ShelfService {
  private readonly shelfPath: string;

  constructor(workspacePath: string) {
    this.shelfPath = path.join(workspacePath, SHELF_PATH);
  }

  read(): Promise<string> {
    return fs.readFile(this.shelfPath, 'utf8');
  }

  async set(content: string): Promise<ShelfMutationResult> {
    return this.replaceContent(content.endsWith('\n') ? content : `${content}\n`);
  }

  async add(tier: ShelfTier, description: string, reason?: string, impact?: string, details?: string): Promise<ShelfMutationResult> {
    return this.mutate((lines) => {
      insertInTier(lines, tier, formatItem(description, reason, impact, details));
      return {
        summary: `Added "${description}" to ${TIER_HEADERS[tier]}.`,
        changedTier: tier,
      };
    });
  }

  async move(search: string, targetTier: ShelfTier, fromTier?: ShelfTier, position?: number): Promise<ShelfMutationResult> {
    return this.mutate((lines) => {
      const found = findUniqueItem(lines, search, fromTier);
      const item = lines.splice(found.start, found.end - found.start);
      insertInTier(lines, targetTier, item, position);
      return {
        summary: `Moved "${linesToItemDescription(item)}" from ${TIER_HEADERS[found.tier]} to ${TIER_HEADERS[targetTier]}.`,
        changedTier: targetTier,
      };
    });
  }

  async replace(search: string, description: string, reason?: string, impact?: string, details?: string): Promise<ShelfMutationResult> {
    return this.mutate((lines) => {
      const found = findUniqueItem(lines, search);
      lines.splice(found.start, found.end - found.start, ...formatItem(description, reason, impact, details));
      return {
        summary: `Replaced "${search}" with "${description}" in ${TIER_HEADERS[found.tier]}.`,
        changedTier: found.tier,
      };
    });
  }

  async complete(search: string, completionNote?: string): Promise<ShelfMutationResult> {
    return this.mutate((lines) => {
      const found = findUniqueItem(lines, search);
      const item = lines.splice(found.start, found.end - found.start);
      if (completionNote) item.push(`\tCompletion: ${completionNote}`);
      insertInTier(lines, 'completed', item, 0);
      return {
        summary: `Moved "${linesToItemDescription(item)}" from ${TIER_HEADERS[found.tier]} to ${TIER_HEADERS.completed}.`,
        changedTier: 'completed',
      };
    });
  }

  private async replaceContent(content: string): Promise<ShelfMutationResult> {
    return withFileLock(this.shelfPath, async () => {
      const before = await this.read();
      await writeTextAtomic(this.shelfPath, content);
      return {
        summary: before === content ? 'Shelf content unchanged.' : 'Shelf content replaced.',
        content,
      };
    });
  }

  private async mutate(mutator: (lines: string[]) => { summary: string; changedTier?: ShelfTier }): Promise<ShelfMutationResult> {
    return withFileLock(this.shelfPath, async () => {
      const lines = (await this.read()).split('\n');
      const result = mutator(lines);
      const content = lines.join('\n');
      await writeTextAtomic(this.shelfPath, content);
      return {
        summary: result.summary,
        content,
        changedSection: result.changedTier ? sectionContent(lines, result.changedTier) : undefined,
      };
    });
  }
}

function findUniqueItem(lines: string[], search: string, tier?: ShelfTier): { start: number; end: number; tier: ShelfTier } {
  const normalizedSearch = normalizeText(search);
  const allCandidates: { index: number; tier: ShelfTier; title: string }[] = [];
  const matches: { index: number; tier: ShelfTier; title: string }[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (!isItemLine(lines[i])) continue;
    const itemTier = tierForLine(lines, i);
    if (!itemTier || (tier && itemTier !== tier)) continue;

    const end = itemEnd(lines, i);
    const title = itemTitle(lines[i]);
    const candidate = { index: i, tier: itemTier, title };
    allCandidates.push(candidate);
    if (itemSearchText(lines, i, end).includes(normalizedSearch)) matches.push(candidate);
  }
  if (matches.length === 0) {
    throw new Error(`No shelf item matching "${search}" found.${candidateHint(allCandidates)}`);
  }
  if (matches.length > 1) {
    throw new Error(`Multiple shelf items match "${search}". Use a more specific search.${candidateHint(matches)}`);
  }
  const start = matches[0].index;
  const end = itemEnd(lines, start);
  return { start, end, tier: matches[0].tier };
}

function insertInTier(lines: string[], tier: ShelfTier, item: string[], position?: number): void {
  const header = lines.indexOf(TIER_HEADERS[tier]);
  if (header < 0) throw new Error(`Shelf section "${TIER_HEADERS[tier]}" not found.`);
  let end = lines.length;
  for (let i = header + 1; i < lines.length; i++) {
    if (lines[i].startsWith('### ')) {
      end = i;
      break;
    }
  }
  let index = end;
  if (position !== undefined) {
    const itemStarts: number[] = [];
    for (let i = header + 1; i < end; i++) {
      if (isItemLine(lines[i])) itemStarts.push(i);
    }
    index = itemStarts[Math.max(0, Math.floor(position))] ?? end;
  }
  while (index > header + 1 && lines[index - 1].trim() === '') index--;
  lines.splice(index, 0, ...item);
}

function formatItem(description: string, reason?: string, impact?: string, details?: string): string[] {
  const item = [`- ${description}`];
  if (details) item.push(`\tDetails: ${details}`);
  if (reason) item.push(`\tReason: ${reason}`);
  if (impact) item.push(`\tImpact: ${impact}`);
  return item;
}

function linesToItemDescription(item: string[]): string {
  return item[0] ? itemTitle(item[0]) : 'shelf item';
}

function tierForLine(lines: string[], line: number): ShelfTier | undefined {
  const headers = Object.entries(TIER_HEADERS) as [ShelfTier, string][];
  for (let i = line; i >= 0; i--) {
    const match = headers.find(([, header]) => lines[i] === header);
    if (match) return match[0];
  }
  return undefined;
}

function sectionContent(lines: string[], tier: ShelfTier): string {
  const header = lines.indexOf(TIER_HEADERS[tier]);
  if (header < 0) return '';
  let end = lines.length;
  for (let i = header + 1; i < lines.length; i++) {
    if (lines[i].startsWith('### ')) {
      end = i;
      break;
    }
  }
  return lines.slice(header, end).join('\n');
}

function isItemLine(line: string): boolean {
  return ITEM_PREFIX_PATTERN.test(line);
}

function itemTitle(line: string): string {
  return line.replace(ITEM_PREFIX_PATTERN, '').trim();
}

function itemEnd(lines: string[], start: number): number {
  let end = start + 1;
  while (end < lines.length && !lines[end].startsWith('### ') && !isItemLine(lines[end])) end++;
  return end;
}

function itemSearchText(lines: string[], start: number, end: number): string {
  return normalizeText([
    itemTitle(lines[start]),
    ...lines.slice(start + 1, end).map((line) => line.trim()),
  ].join('\n'));
}

function normalizeText(text: string): string {
  return text.replace(ITEM_PREFIX_PATTERN, '').trim().toLowerCase();
}

function candidateHint(candidates: { tier: ShelfTier; title: string }[]): string {
  if (candidates.length === 0) return '';
  const rendered = candidates
    .slice(0, 8)
    .map((candidate) => `${TIER_HEADERS[candidate.tier]}: ${candidate.title}`)
    .join('; ');
  const suffix = candidates.length > 8 ? `; +${candidates.length - 8} more` : '';
  return ` Candidates: ${rendered}${suffix}.`;
}
