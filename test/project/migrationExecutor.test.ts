import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { afterEach, describe, expect, it } from 'vitest';
import { ProjectMigrationPlanner } from '../../src/project/migration';
import { ProjectMigrationExecutor } from '../../src/project/migrationExecutor';

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

describe('ProjectMigrationExecutor', () => {
  it('executes and verifies a reviewed legacy migration', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'harbormaster-executor-'));
    tempDirs.push(root);
    await write(root, '.harbormaster/.meta/project.json', '{"project_name":"Legacy"}');
    await write(root, '.harbormaster/.context/DIRECTIVES.md', '# Directives');
    await write(root, '.harbormaster/.context/SHELF.md', '## Shelf');
    await write(root, '.harbormaster/.context/PROJECT_STATE.md', '# State');
    await write(root, '.harbormaster/branches/custom.branch', 'Custom');
    await write(root, 'agents.md', '# Old entrypoint');

    const policy = { mode: 'migrate' as const, activeTools: ['codex' as const] };
    const plan = await new ProjectMigrationPlanner(root).plan(policy);
    await new ProjectMigrationExecutor(root).execute(plan, policy);

    expect(await read(root, '.harbormaster/project.json')).toContain('Legacy');
    expect(await read(root, '.harbormaster/shelf/SHELF.md')).toContain('Shelf');
    expect(await read(root, '.harbormaster/.old/context/PROJECT_STATE.md')).toContain('State');
    expect(await read(root, '.harbormaster/.old/branches/custom.branch')).toContain('Custom');
    expect(await read(root, 'AGENTS.md')).toContain('harbormaster_full_context_get');
    expect((await fs.readdir(root))).not.toContain('agents.md');
  });
});

async function write(root: string, relativePath: string, content: string): Promise<void> {
  const target = path.join(root, relativePath);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, content);
}

function read(root: string, relativePath: string): Promise<string> {
  return fs.readFile(path.join(root, relativePath), 'utf8');
}

