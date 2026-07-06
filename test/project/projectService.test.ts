import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { afterEach, describe, expect, it } from 'vitest';
import { ProjectService, resolveProjectPath } from '../../src/project/projectService';

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

describe('ProjectService adoption', () => {
  it('adopts legacy metadata without discarding unknown fields', async () => {
    const root = await tempDir();
    await fs.mkdir(path.join(root, '.harbormaster'), { recursive: true });
    await fs.writeFile(path.join(root, '.harbormaster/project.json'), JSON.stringify({
      project_name: 'Legacy',
      window_accent_sections: { window: '#112233' },
      custom_user_field: true,
    }));

    const report = await new ProjectService(root).adopt('Fallback', ['codex']);
    const config = JSON.parse(await fs.readFile(path.join(root, '.harbormaster/project.json'), 'utf8'));
    expect(config.project_name).toBe('Legacy');
    expect(config.custom_user_field).toBe(true);
    expect(config.window_accent_sections.window).toBe('#112233');
    expect(config.activeBranches).toEqual([]);
    expect(report.preserved).toContain('.harbormaster/project.json');
    expect(await fs.readFile(path.join(root, 'AGENTS.md'), 'utf8')).toContain('harbormaster_full_context_get');
    expect(await fs.readFile(path.join(root, '.harbormaster/DIRECTIVES.md'), 'utf8')).toContain('# Directives');
    await expect(fs.access(path.join(root, '.harbormaster/shelf/SHELF.md'))).rejects.toThrow();
  });

  it('updates a managed bootstrap block without replacing user content', async () => {
    const root = await tempDir();
    await fs.writeFile(path.join(root, 'AGENTS.md'), '# User instructions\n\nKeep this.\n');
    const service = new ProjectService(root);
    await service.adopt('Test', ['codex']);
    await service.adopt('Test', ['codex']);
    const content = await fs.readFile(path.join(root, 'AGENTS.md'), 'utf8');
    expect(content).toContain('Keep this.');
    expect(content.match(/harbormaster:mcp-start/g)).toHaveLength(1);
  });

  it('resolves a project by searching parent directories', async () => {
    const root = await tempDir();
    await new ProjectService(root).adopt('Test', []);
    const nested = path.join(root, 'a/b/c');
    await fs.mkdir(nested, { recursive: true });
    expect(await resolveProjectPath(nested)).toBe(root);
  });

  it('migrates legacy context and removes lowercase agent entrypoints', async () => {
    const root = await tempDir();
    await fs.mkdir(path.join(root, '.context'), { recursive: true });
    await fs.writeFile(path.join(root, '.context/DIRECTIVES.md'), '# Legacy directives\n');
    await fs.writeFile(path.join(root, '.context/SHELF.md'), '## Legacy shelf\n');
    await fs.writeFile(path.join(root, 'agents.md'), '# Existing agent rules\n');

    await new ProjectService(root).adopt('Test', ['codex']);
    expect(await fs.readFile(path.join(root, '.harbormaster/DIRECTIVES.md'), 'utf8')).toContain('Legacy directives');
    expect(await fs.readFile(path.join(root, '.harbormaster/shelf/SHELF.md'), 'utf8')).toContain('Legacy shelf');
    expect(await new ProjectService(root).getActiveBranchIds()).toContain('shelf');
    expect(await fs.readFile(path.join(root, 'AGENTS.md'), 'utf8')).toContain('harbormaster_full_context_get');
    expect(await fs.readdir(root)).toContain('AGENTS.md');
    expect(await fs.readdir(root)).not.toContain('agents.md');
  });

  it('detects AI tools from existing entrypoints', async () => {
    const root = await tempDir();
    await fs.writeFile(path.join(root, 'AGENTS.md'), '# Codex\n');
    await fs.writeFile(path.join(root, 'CLAUDE.md'), '# Claude\n');
    expect(await new ProjectService(root).detectAiTools()).toEqual(['claude', 'codex']);
  });

  it('copies branch-owned collections into their formal artifact roots', async () => {
    const root = await tempDir();
    await fs.mkdir(path.join(root, '.harbormaster/brainstorm'), { recursive: true });
    await fs.writeFile(path.join(root, '.harbormaster/brainstorm/00_legacy.brainstorm'), 'Legacy brainstorm\n');

    await new ProjectService(root).adopt('Test', []);

    expect(await fs.readFile(path.join(root, '.harbormaster/brainstorms/00_legacy.brainstorm'), 'utf8'))
      .toContain('Legacy brainstorm');
    expect(await new ProjectService(root).getActiveBranchIds()).toContain('brainstorm-session');
    expect(await fs.readFile(path.join(root, '.harbormaster/brainstorm/00_legacy.brainstorm'), 'utf8'))
      .toContain('Legacy brainstorm');
  });

  it('retires the old core-directives branch during adoption', async () => {
    const root = await tempDir();
    await fs.mkdir(path.join(root, '.harbormaster'), { recursive: true });
    await fs.writeFile(path.join(root, '.harbormaster/project.json'), JSON.stringify({
      project_name: 'Legacy',
      activeBranches: ['core-directives', 'shelf'],
    }));
    await new ProjectService(root).adopt('Legacy', []);
    expect(await new ProjectService(root).getActiveBranchIds()).toEqual(['shelf']);
  });

  it('stores local branches in project config', async () => {
    const root = await tempDir();
    const service = new ProjectService(root);
    await service.adopt('Local Branches', []);

    const branch = await service.createLocalBranch({
      name: 'Project Only',
      description: 'Specialized workflow',
      directives: '## Project Only\nUse local rules.',
    });

    expect(branch.local).toBe(true);
    expect(await service.getLocalBranch(branch.id)).toMatchObject({
      id: branch.id,
      name: 'Project Only',
      directives: '## Project Only\nUse local rules.',
      local: true,
    });
    const config = JSON.parse(await fs.readFile(path.join(root, '.harbormaster/project.json'), 'utf8'));
    expect(config.localBranches).toHaveLength(1);
  });
});

async function tempDir(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'harbormaster-project-'));
  tempDirs.push(dir);
  return dir;
}
