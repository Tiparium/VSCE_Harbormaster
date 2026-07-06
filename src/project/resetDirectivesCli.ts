import * as fs from 'fs/promises';
import * as path from 'path';
import { writeTextAtomic } from '../utils/atomicFile';
import { DIRECTIVES_TEMPLATE } from './projectService';

type Entry = {
  label?: string;
  path: string;
  mode: 'migrate' | 'rebuild' | 'exclude';
};

const PREVIOUS_GENERATED_TEMPLATE = `# Directives

## Branch behaviors
This project uses Harbormaster branches — modular behavior directives for specific workflows.

- To see which branches are active: \`project_branches_list()\`
- To get the full instructions for a branch: \`branch_get(id)\`
- Load branch content only when you need that workflow.

## Operating rules
- Add project-specific AI operating rules here.
`;

const PREVIOUS_OPERATIONAL_TEMPLATE = `# Directives

## Operating loop
1. At session start, call \`harbormaster_full_context_get()\`.
2. Follow this project's operating rules and note which branches are active.
3. Before using an active branch workflow, call \`branch_get(id)\` for its full instructions.
4. Use Harbormaster MCP tools for project, branch, and branch-owned workflows when tools are available.
5. Fetch branch instructions only when needed; do not load the entire branch library into every session.

## Branch behaviors
This project uses Harbormaster branches — modular behavior directives for specific workflows.
Branches require the Harbormaster MCP server. If MCP is unavailable, only the core directives in this file are available.

- To see which branches are active: \`project_branches_list()\`
- To get the full instructions for a branch before performing its workflow: \`branch_get(id)\`
- Branch definitions live in the global library; branch-owned project data lives under \`.harbormaster/\`.
- Deactivating a branch disables its behavior but does not delete its project data.

## Operating rules
- Add project-specific AI operating rules here.
`;

const PREVIOUS_CORE_TEMPLATE = `# Directives

## Operating loop
1. At session start, call \`harbormaster_full_context_get()\`.
2. Follow this project's operating rules and note which branches are active.
3. Before using an active branch workflow, call \`branch_get(id)\` for its full instructions.
4. Use Harbormaster MCP tools for project, branch, and branch-owned workflows when tools are available.
5. Fetch branch instructions only when needed; do not load the entire branch library into every session.

## Core Directives

## Branch behaviors
This project uses Harbormaster branches — modular behavior directives for specific workflows.
Branches require the Harbormaster MCP server. If MCP is unavailable, only the core directives in this file are available.

- To see which branches are active: \`project_branches_list()\`
- To get the full instructions for a branch before performing its workflow: \`branch_get(id)\`
- Branch definitions live in the global library; branch-owned project data lives under \`.harbormaster/\`.
- Deactivating a branch disables its behavior but does not delete its project data.

`;

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
    const directivesPath = path.join(entry.path, '.harbormaster', 'DIRECTIVES.md');
    let content: string;
    try {
      content = await fs.readFile(directivesPath, 'utf8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        results.push({ label: entry.label, path: entry.path, status: 'missing' });
        continue;
      }
      throw error;
    }

    if (normalize(content) === normalize(DIRECTIVES_TEMPLATE)) {
      results.push({ label: entry.label, path: entry.path, status: 'already-template' });
      continue;
    }

    if ([PREVIOUS_GENERATED_TEMPLATE, PREVIOUS_OPERATIONAL_TEMPLATE, PREVIOUS_CORE_TEMPLATE].some((template) => normalize(content) === normalize(template))) {
      await writeTextAtomic(directivesPath, DIRECTIVES_TEMPLATE);
      results.push({ label: entry.label, path: entry.path, status: 'upgraded-generated-template' });
      continue;
    }

    const archiveDir = path.join(entry.path, '.harbormaster', '.old', 'context');
    await fs.mkdir(archiveDir, { recursive: true });
    const archivePath = await availableArchivePath(archiveDir);
    await fs.rename(directivesPath, archivePath);
    await writeTextAtomic(directivesPath, DIRECTIVES_TEMPLATE);
    results.push({
      label: entry.label,
      path: entry.path,
      status: 'replaced',
      archivedAt: path.relative(entry.path, archivePath),
    });
  }

  const report = {
    completedAt: new Date().toISOString(),
    templateBytes: Buffer.byteLength(DIRECTIVES_TEMPLATE),
    results,
  };
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({
    replaced: results.filter((result) => result.status === 'replaced').length,
    alreadyTemplate: results.filter((result) => result.status === 'already-template').length,
    upgradedGeneratedTemplate: results.filter((result) => result.status === 'upgraded-generated-template').length,
    excluded: results.filter((result) => result.status === 'excluded').length,
    missing: results.filter((result) => result.status === 'missing').length,
  }));
}

async function availableArchivePath(archiveDir: string): Promise<string> {
  const preferred = path.join(archiveDir, 'DIRECTIVES.md');
  if (!(await exists(preferred))) return preferred;
  for (let index = 1; ; index++) {
    const candidate = path.join(archiveDir, `DIRECTIVES.${index}.md`);
    if (!(await exists(candidate))) return candidate;
  }
}

function normalize(content: string): string {
  return content.endsWith('\n') ? content : `${content}\n`;
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
