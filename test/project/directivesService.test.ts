import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { afterEach, describe, expect, it } from 'vitest';
import { DirectivesService } from '../../src/project/directivesService';
import { ProjectService } from '../../src/project/projectService';

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

describe('DirectivesService', () => {
  it('adds, reads, and removes core directives without rewriting other sections', async () => {
    const root = await setup();
    const service = new DirectivesService(root);
    await service.addCore('Keep migrations reversible.');
    await service.addCore('Prefer focused tests.');
    expect(await service.readCore()).toContain('- Keep migrations reversible.');
    await service.removeCore('migrations reversible');
    expect(await service.readCore()).toBe('- Prefer focused tests.');
    expect(await fs.readFile(path.join(root, '.harbormaster/DIRECTIVES.md'), 'utf8')).toContain('## Branch behaviors');
  });

  it('rejects duplicate and ambiguous directives', async () => {
    const root = await setup();
    const service = new DirectivesService(root);
    await service.addCore('Keep tests focused.');
    await expect(service.addCore('keep tests focused.')).rejects.toThrow('already exists');
    await service.addCore('Keep changes focused.');
    await expect(service.removeCore('focused')).rejects.toThrow('Multiple core directives');
    await expect(service.addCore('Invalid\nheading injection')).rejects.toThrow('single line');
  });

  it('adds the universal section to an existing manually maintained directives file', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'harbormaster-directives-'));
    tempDirs.push(root);
    await fs.mkdir(path.join(root, '.harbormaster'), { recursive: true });
    await fs.writeFile(path.join(root, '.harbormaster/DIRECTIVES.md'), '# Custom\n\n## Rules\nKeep this.\n');
    const service = new DirectivesService(root);
    expect(await service.ensureCoreSection()).toBe(true);
    expect(await service.ensureCoreSection()).toBe(false);
    const content = await fs.readFile(path.join(root, '.harbormaster/DIRECTIVES.md'), 'utf8');
    expect(content).toContain('## Rules\nKeep this.');
    expect(content.match(/## Core Directives/g)).toHaveLength(1);
  });
});

async function setup(): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'harbormaster-directives-'));
  tempDirs.push(root);
  await new ProjectService(root).adopt('Test', []);
  return root;
}
