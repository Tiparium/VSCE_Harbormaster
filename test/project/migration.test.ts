import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { afterEach, describe, expect, it } from 'vitest';
import { ProjectMigrationPlanner } from '../../src/project/migration';

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

describe('ProjectMigrationPlanner', () => {
  it('plans a normal legacy migration without modifying files', async () => {
    const root = await tempDir();
    await write(root, '.harbormaster/.meta/project.json', '{"project_name":"Legacy"}');
    await write(root, '.harbormaster/.context/DIRECTIVES.md', '# Legacy directives');
    await write(root, '.harbormaster/.context/SHELF.md', '## Shelf');
    await write(root, '.harbormaster/.context/PROJECT_STATE.md', '# State');
    await write(root, '.harbormaster/brainstorm/00_test.brainstorm', 'Notes');
    await write(root, '.harbormaster/branches/shelf.branch', 'Shelf definition');
    await write(root, '.harbormaster/branches/custom.branch', 'Custom definition');
    await write(root, 'agents.md', '# Rules');

    const plan = await new ProjectMigrationPlanner(root).plan({ mode: 'migrate', activeTools: ['codex'] });

    expect(plan.actions).toContainEqual(expect.objectContaining({
      kind: 'copy',
      from: '.harbormaster/.meta/project.json',
      to: '.harbormaster/project.json',
    }));
    expect(plan.actions).toContainEqual(expect.objectContaining({ kind: 'activate-branch', branchId: 'shelf' }));
    expect(plan.actions).toContainEqual(expect.objectContaining({ kind: 'activate-branch', branchId: 'brainstorm-session' }));
    expect(plan.actions).toContainEqual(expect.objectContaining({
      kind: 'move',
      from: '.harbormaster/branches/custom.branch',
      to: '.harbormaster/.old/branches/custom.branch',
    }));
    expect(plan.actions).toContainEqual(expect.objectContaining({ kind: 'move', from: 'agents.md', to: 'AGENTS.md' }));
    expect(plan.archivedLocalBranches).toEqual(['.harbormaster/branches/custom.branch']);
    expect(await fs.readFile(path.join(root, 'agents.md'), 'utf8')).toBe('# Rules');
  });

  it('plans rebuilds with a backup instead of immediate deletion', async () => {
    const root = await tempDir();
    await write(root, '.harbormaster/project.json', '{}');

    const plan = await new ProjectMigrationPlanner(root).plan({
      mode: 'rebuild',
      projectName: 'Fresh',
      activeTools: ['codex'],
    });

    expect(plan.actions).toContainEqual(expect.objectContaining({
      kind: 'move',
      from: '.harbormaster',
      to: '.harbormaster-rebuild-backup',
    }));
    expect(plan.actions).toContainEqual(expect.objectContaining({ kind: 'create', path: '.harbormaster/project.json' }));
  });

  it('does not inspect excluded projects', async () => {
    const root = await tempDir();
    await write(root, '.harbormaster/.meta/project.json', '{}');
    const plan = await new ProjectMigrationPlanner(root).plan({ mode: 'exclude', reason: 'Manual migration.' });
    expect(plan.actions).toEqual([expect.objectContaining({ kind: 'review', path: root })]);
  });

  it('plans missing projects for catalog removal', async () => {
    const root = path.join(os.tmpdir(), `harbormaster-missing-${Date.now()}`);
    const plan = await new ProjectMigrationPlanner(root).plan({ mode: 'migrate' });
    expect(plan.actions).toContainEqual(expect.objectContaining({ kind: 'catalog-remove', path: root }));
  });
});

async function tempDir(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'harbormaster-migration-'));
  tempDirs.push(dir);
  return dir;
}

async function write(root: string, relativePath: string, content: string): Promise<void> {
  const target = path.join(root, relativePath);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, content);
}
