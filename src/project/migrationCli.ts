import * as fs from 'fs/promises';
import * as path from 'path';
import { ProjectMigrationPlanner, type MigrationPolicy } from './migration';

type ManifestEntry = MigrationPolicy & {
  path: string;
  label?: string;
};

type Manifest = {
  projects: ManifestEntry[];
};

async function main(): Promise<void> {
  const manifestPath = path.resolve(process.argv[2] ?? 'migration/live-projects.json');
  const outputPath = path.resolve(process.argv[3] ?? 'migration/live-migration-plan.json');
  const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8')) as Manifest;
  const projects = [];
  for (const entry of manifest.projects) {
    projects.push({
      label: entry.label,
      ...await new ProjectMigrationPlanner(entry.path).plan(entry),
    });
  }
  const report = {
    generatedAt: new Date().toISOString(),
    manifestPath,
    summary: {
      projects: projects.length,
      migrate: projects.filter((project) => project.mode === 'migrate').length,
      rebuild: projects.filter((project) => project.mode === 'rebuild').length,
      excluded: projects.filter((project) => project.mode === 'exclude').length,
      warnings: projects.reduce((count, project) => count + project.warnings.length, 0),
      archivedLocalBranches: projects.reduce((count, project) => count + project.archivedLocalBranches.length, 0),
    },
    archivedLocalBranches: projects.flatMap((project) =>
      project.archivedLocalBranches.map((branchPath) => ({
        project: project.label ?? project.projectPath,
        projectPath: project.projectPath,
        branchPath,
      }))
    ),
    projects,
  };
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(report, null, 2) + '\n');
  console.log(`Wrote migration dry-run report: ${outputPath}`);
  console.log(JSON.stringify(report.summary));
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

