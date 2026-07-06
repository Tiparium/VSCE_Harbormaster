import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { afterEach, describe, expect, it } from 'vitest';
import { ProjectService } from '../../src/project/projectService';
import { ShelfService } from '../../src/project/shelfService';
import { CANONICAL_BRANCHES } from '../../src/store/canonicalBranches';

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

describe('ShelfService', () => {
  it('adds and completes an item', async () => {
    const root = await setup();
    const shelf = new ShelfService(root);
    const added = await shelf.add('top', 'Ship migration', 'Live update');
    const completed = await shelf.complete('Ship migration', 'Released');
    const content = await shelf.read();
    expect(added.summary).toContain('Added');
    expect(completed.changedSection).toContain('Completion: Released');
    expect(content.indexOf('### Completed')).toBeLessThan(content.indexOf('- Ship migration'));
  });

  it('moves and replaces one item without rewriting unrelated sections', async () => {
    const root = await setup();
    const shelf = new ShelfService(root);
    await shelf.add('immediate', 'Fix UI state', 'Current priority');
    await shelf.add('top', 'Keep catalog stable');

    const moved = await shelf.move('Fix UI state', 'top', 'immediate', 0);
    const replaced = await shelf.replace('Fix UI state', 'Finish playback-first module system refactor', undefined, undefined, 'Restore timeline/runtime hooks');
    const content = await shelf.read();

    expect(moved.changedSection).toContain('- Fix UI state');
    expect(replaced.changedSection).toContain('Details: Restore timeline/runtime hooks');
    expect(content.indexOf('- Finish playback-first module system refactor')).toBeLessThan(content.indexOf('- Keep catalog stable'));
  });

  it('sets the full shelf content', async () => {
    const root = await setup();
    const shelf = new ShelfService(root);
    const result = await shelf.set('## Shelf\n\n### Immediate Shelf\n');
    expect(result.summary).toBe('Shelf content replaced.');
    expect(await shelf.read()).toBe('## Shelf\n\n### Immediate Shelf\n');
  });

  it('refuses an ambiguous substring match', async () => {
    const root = await setup();
    const shelf = new ShelfService(root);
    await shelf.add('top', 'Fix server registration');
    await shelf.add('top', 'Fix server storage');
    await expect(shelf.complete('Fix server')).rejects.toThrow('Multiple shelf items');
  });
});

async function setup(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'harbormaster-shelf-'));
  tempDirs.push(dir);
  const project = new ProjectService(dir);
  await project.adopt('Test', []);
  await project.ensureBranchArtifacts(CANONICAL_BRANCHES.find((branch) => branch.id === 'shelf')!);
  await project.setActiveBranchIds(['shelf']);
  return dir;
}
