import * as fs from 'fs/promises';
import * as path from 'path';
import { GlobalStore } from '../store/globalStore';
import { CatalogStore } from '../store/catalog';
import { ProjectMigrationPlanner, type MigrationPolicy } from './migration';
import { ProjectMigrationExecutor } from './migrationExecutor';

type Entry = MigrationPolicy & { path: string; label?: string };
type Manifest = { projects: Entry[] };

async function main(): Promise<void> {
  const manifestPath = path.resolve(process.argv[2]);
  const storagePath = path.resolve(process.argv[3]);
  const outputPath = path.resolve(process.argv[4]);
  const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8')) as Manifest;
  const backupPath = `${storagePath}.migration-backup-${new Date().toISOString().split(':').join('-')}`;
  await fs.cp(storagePath, backupPath, { recursive: true, errorOnExist: true });

  const global = new GlobalStore(storagePath, false);
  const catalog = new CatalogStore(global);
  const results = [];
  for (const entry of manifest.projects) {
    const plan = await new ProjectMigrationPlanner(entry.path).plan(entry);
    if (entry.mode === 'exclude') {
      results.push({ label: entry.label, status: 'excluded', plan });
      continue;
    }
    if (plan.actions.some((action) => action.kind === 'catalog-remove')) {
      const existing = await catalog.findByPath(entry.path);
      if (existing) await catalog.remove(existing.id);
      results.push({ label: entry.label, status: 'catalog-removed', plan });
      continue;
    }
    const execution = await new ProjectMigrationExecutor(entry.path).execute(plan, entry);
    const config = JSON.parse(await fs.readFile(path.join(entry.path, '.harbormaster/project.json'), 'utf8')) as Record<string, unknown>;
    await catalog.upsert({
      name: typeof config.project_name === 'string' ? config.project_name : entry.label ?? path.basename(entry.path),
      path: entry.path,
      tags: Array.isArray(config.tags) ? config.tags.filter((tag): tag is string => typeof tag === 'string') : [],
    });
    results.push({ label: entry.label, status: 'migrated', plan, execution });
  }
  await global.update(async (data) => {
    const counts = new Map<string, number>();
    for (const project of data.catalog) {
      try {
        const config = JSON.parse(await fs.readFile(path.join(project.path, '.harbormaster/project.json'), 'utf8')) as Record<string, unknown>;
        for (const id of Array.isArray(config.activeBranches) ? config.activeBranches : []) {
          if (typeof id === 'string') counts.set(id, (counts.get(id) ?? 0) + 1);
        }
      } catch {
        // Catalog verification below reports unreadable projects.
      }
    }
    for (const branch of data.branches) branch.score = counts.get(branch.id) ?? 0;
  });
  const report = { completedAt: new Date().toISOString(), backupPath, results };
  await fs.writeFile(outputPath, JSON.stringify(report, null, 2) + '\n');
  console.log(`Migration completed. Backup: ${backupPath}`);
  console.log(`Report: ${outputPath}`);
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
