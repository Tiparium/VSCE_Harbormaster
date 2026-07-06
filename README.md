# Harbormaster

Harbormaster is a VS Code extension and local MCP server for project identity,
project navigation, reusable AI behavior branches, and lightweight project
context.

## Core Features

- Project-aware VS Code window titles and accent colors.
- A global project catalog for opening and remapping projects.
- A global branch library with per-project branch activation.
- A standalone stdio MCP server for AI clients.
- Project directives plus optional branch-owned workflows exposed through MCP.
- First-class per-project Core Directives stored only in `DIRECTIVES.md`.
- Managed bootstrap instructions for configured AI clients.

## Project Layout

Harbormaster projects use:

```text
AGENTS.md / CLAUDE.md / configured AI entrypoints
.harbormaster/
├── DIRECTIVES.md
└── project.json
```

`project.json` stores project identity, version fields, tags, accent values,
and active branch IDs. `DIRECTIVES.md` remains an ordinary, human-editable
Markdown file. Its `## Core Directives` section is the single source for
project-specific objectives and instructions; AI entrypoint files contain only
the managed MCP bootstrap.

Optional branches can own project-local data and MCP workflows. Branch
definitions remain in the global library; only their project results live in
the project:

```text
.harbormaster/
├── shelf/
│   └── SHELF.md
├── brainstorms/
│   └── 00_example.brainstorm
└── feedback/
    └── cookie_log.md
```

Branches without project-local state create no folder. Deactivating a branch
leaves its project data intact.

## MCP Tools

The standalone MCP server exposes focused tools for:

- Loading core project context, active branches, and optional active-branch context.
- Getting, adding, and removing project Core Directives.
- Listing, reading, creating, updating, activating, and deactivating branches.
- Adding, moving, and completing shelf items when the Shelf branch is active.
- Listing and finding projects in the global catalog.

Project-specific tools resolve the active project from:

1. `HM_WORKSPACE`, when explicitly supplied.
2. MCP roots supplied by the client.
3. An upward search from the server launch directory.

If no Harbormaster project can be resolved, project mutations fail instead of
writing to an arbitrary directory.

## Live Upgrade And Adoption

On activation, an existing Harbormaster workspace is adopted idempotently:

- Existing `.harbormaster/project.json` data is preserved.
- Legacy `.harbormaster/.meta/project.json` and `.project.json` data is copied into
  the current metadata location without deleting the legacy source.
- Legacy context files and branch-owned result folders are copied into the
  current layout when their destination does not exist. Existing source files
  remain untouched, and discovered branch data activates its owning branch.
- Configured AI entrypoints receive a managed Harbormaster MCP instruction
  block that directs project-specific Core Directives to `DIRECTIVES.md`.
- Existing AI entrypoints are detected to preselect the tools used by older
  projects before MCP registration is requested.
- The adopted project is registered or refreshed in the global catalog.
- Previously approved MCP registrations are refreshed to point at the newly
  installed extension version.

The adoption operation can run repeatedly without duplicating managed
bootstrap blocks.

## Reviewed Migration

Major legacy-layout changes use an explicit dry-run planner rather than
silently deleting or restructuring project files during extension startup.

- Run `Harbormaster: Review current project migration` to inspect the open
  project's proposed migration as JSON.
- Run `npm run migration:plan` in this repository to regenerate the reviewed
  machine-wide migration report from `migration/live-projects.json`.
- Retired context and non-library local branches are planned for
  `.harbormaster/.old/`.
- Canonical branch artifacts are migrated into their formal locations and
  activate the matching global branches.
- Rebuild policies preserve the previous setup in a rebuild backup first.
- Explicitly excluded projects receive no automated file or catalog changes.

The planner does not execute migration actions. Live execution remains a
separate human-approved step.

## Storage Safety

The extension host and standalone MCP processes share global catalog, branch,
and settings data. Global and project mutations use cross-process locks and
atomic file replacement to prevent partial writes and unrelated updates from
overwriting each other.

## Development

```sh
npm install
npm test
npm run compile
```

`npm run compile` type-checks the source and creates clean bundled runtime
outputs:

```text
out/extension.js
out/mcp/standalone.js
out/webview.js
```

Use `./run build <dev|prod>` to package a VSIX.
