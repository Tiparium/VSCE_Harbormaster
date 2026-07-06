import * as fs from 'fs/promises';
import * as path from 'path';
import { writeJsonAtomic, writeTextAtomic } from '../utils/atomicFile';
import { DIRECTIVES_TEMPLATE } from './projectService';

type Entry = {
  label?: string;
  path: string;
  mode: 'migrate' | 'rebuild' | 'exclude';
};

async function main(): Promise<void> {
  const manifestPath = path.resolve(process.argv[2]);
  const reportPath = path.resolve(process.argv[3]);
  const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8')) as { projects: Entry[] };
  const results = [];

  for (const entry of manifest.projects) {
    if (entry.mode === 'exclude') {
      results.push({ label: entry.label, path: entry.path, status: 'excluded' });
      continue;
    }
    const projectDir = path.join(entry.path, '.harbormaster');
    const configPath = path.join(projectDir, 'project.json');
    if (!(await exists(configPath))) {
      results.push({ label: entry.label, path: entry.path, status: 'missing-project' });
      continue;
    }

    await writeTextAtomic(path.join(projectDir, 'DIRECTIVES.md'), DIRECTIVES_TEMPLATE);
    const config = JSON.parse(await fs.readFile(configPath, 'utf8')) as Record<string, unknown>;
    if (Array.isArray(config.activeBranches)) {
      config.activeBranches = config.activeBranches.filter((id) => id !== 'core-directives');
      await writeJsonAtomic(configPath, config);
    }
    results.push({ label: entry.label, path: entry.path, status: 'replaced' });
  }

  const report = {
    completedAt: new Date().toISOString(),
    templateBytes: Buffer.byteLength(DIRECTIVES_TEMPLATE),
    results,
  };
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({
    replaced: results.filter((result) => result.status === 'replaced').length,
    excluded: results.filter((result) => result.status === 'excluded').length,
    missing: results.filter((result) => result.status === 'missing-project').length,
  }));
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
