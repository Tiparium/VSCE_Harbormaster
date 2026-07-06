import type { Branch } from '../types/global';

type CanonicalBranch = Omit<Branch, 'createdAt' | 'updatedAt' | 'score'>;

export const CANONICAL_BRANCH_IDS = [
  'brainstorm-session',
  'cookie-module',
  'shelf',
] as const;

export type CanonicalBranchId = typeof CANONICAL_BRANCH_IDS[number];
export const RETIRED_BRANCH_IDS = ['core-directives'] as const;

export const CANONICAL_BRANCHES: CanonicalBranch[] = [
  {
    id: 'shelf',
    name: 'Shelf',
    description: 'Lightweight project task staging backed by branch-owned state and focused MCP tools.',
    canonical: true,
    artifacts: {
      root: '.harbormaster/shelf',
      initialFiles: [{
        path: 'SHELF.md',
        legacyPaths: ['.harbormaster/.context/SHELF.md', '.context/SHELF.md'],
        content: `## Shelf

### Immediate Shelf

### Top Shelf

### Middle Shelf

### Bottom Shelf

### Long Term

### Completed
`,
      }],
    },
    directives: `## Branch: Shelf

Use \`.harbormaster/shelf/SHELF.md\` as this project's lightweight task staging area.

### Rules
- Prefer the Harbormaster shelf MCP tools for setting, adding, moving, replacing, and completing shelf items.
- Keep shelf entries short and actionable.
- Use a specific item description when moving, replacing, or completing an item.
- The shelf file remains human-editable when manual changes are useful.
`,
  },
  {
    id: 'brainstorm-session',
    name: 'Brainstorm Session',
    description: 'Lightweight brainstorm capture workflow with session summaries.',
    canonical: true,
    artifacts: {
      root: '.harbormaster/brainstorms',
      legacyRoots: ['.harbormaster/brainstorm'],
    },
    directives: `## Branch: Brainstorm Session

Trigger phrase: "condense and summarize" signals a Brainstorm Session recap.

### Rules
- During a brainstorm, provide a short high-level recap of the most recent discussion cluster.
- Recap should be conversational, not exhaustive.
- After recap, wait for user approval or tweaks before writing anything.
- Once approved, write a concise "Brainstorm Session" entry at the top of the active brainstorm file in \`.harbormaster/brainstorms/\`.
- On session close, create a git commit with message format: \`Brainstorm Session {xx} complete\`.
- Commit body must include a 1-3 bullet at-a-glance summary.
- Keep brainstorm file entries compact and scannable.
- File naming: zero-indexed numeric prefix (e.g. \`00_name.brainstorm\`).
- Preserve detailed notes below the summary; do not replace foundational content unless asked.
`,
  },
  {
    id: 'cookie-module',
    name: 'Cookie Module',
    description: 'Track notable AI behaviors with cookie/zuchinii feedback entries.',
    canonical: true,
    artifacts: {
      root: '.harbormaster/feedback',
      initialFiles: [{
        path: 'cookie_log.md',
        content: '# Feedback Log\n',
      }],
    },
    directives: `## Branch: Cookie Module

Track notable assistant behaviors using two feedback types:
- \`cookie\` — notably good behavior or code quality worth reinforcing
- \`zuchinii\` (alternate spelling \`zucchini\` is equivalent) — notably bad behavior to correct

### Rules
- Log every awarded cookie or zuchinii in \`.harbormaster/feedback/cookie_log.md\`.
- Each entry is append-only and must include: date (YYYY-MM-DD), type, short reason (one line), optional context.
- Format: \`- YYYY-MM-DD | type=<cookie|zuchinii> | reason=<brief reason> | context=<optional>\`
- Keep reasons concise and behavior-focused.
`,
  },
];
