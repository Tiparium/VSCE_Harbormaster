import type { Branch } from '../types/global';

type CanonicalBranch = Omit<Branch, 'createdAt' | 'updatedAt' | 'score'>;

export const CANONICAL_BRANCH_IDS = [
  'brainstorm-session',
  'cookie-module',
  'core-directives',
] as const;

export type CanonicalBranchId = typeof CANONICAL_BRANCH_IDS[number];

export const CANONICAL_BRANCHES: CanonicalBranch[] = [
  {
    id: 'brainstorm-session',
    name: 'Brainstorm Session',
    description: 'Lightweight brainstorm capture workflow with session summaries.',
    canonical: true,
    directives: `## Branch: Brainstorm Session

Trigger phrase: "condense and summarize" signals a Brainstorm Session recap.

### Rules
- During a brainstorm, provide a short high-level recap of the most recent discussion cluster.
- Recap should be conversational, not exhaustive.
- After recap, wait for user approval or tweaks before writing anything.
- Once approved, write a concise "Brainstorm Session" entry at the top of the active brainstorm file in \`.harbormaster/brainstorm/\`.
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
  {
    id: 'core-directives',
    name: 'Core Directives',
    description: 'Two-tier directives: entrypoint file holds durable behaviors, DIRECTIVES.md holds operational rules.',
    canonical: true,
    directives: `## Branch: Core Directives

Harbormaster uses two tiers of directives:

**Entrypoint file (CLAUDE.md / AGENTS.md / etc.)**
- Holds durable collaboration behaviors: tone, learning style, project-specific reminders.
- Rarely changes. This is how the AI is configured to work with this project and user.

**DIRECTIVES.md**
- Holds operational rules: workflows, file conventions, active constraints.
- Changes as the project evolves.

### Rules
- Core directives (tone, style, reminders) belong in the entrypoint file, not in DIRECTIVES.md.
- DIRECTIVES.md should contain only operational, project-specific rules.
- Do not move entrypoint content to DIRECTIVES.md or vice versa without being asked.
`,
  },
];
