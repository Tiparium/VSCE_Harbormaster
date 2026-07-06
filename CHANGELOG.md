# Changelog

## 3.0.0-alpha
- Added standalone MCP server, project/shelf/branch services, and focused MCP tools.
- Added idempotent live-project adoption and automatic catalog registration.
- Added safe MCP registration refresh across extension updates.
- Added locked atomic writes for shared global and project data.
- Bundled clean extension and MCP runtime outputs for reliable VSIX packaging.
- Moved Shelf from universal project scaffolding into an optional canonical branch.
- Formalized the minimal project layout and branch-owned artifact folders.
- Added conservative migration from legacy context, metadata, and brainstorm paths.
- Added reviewed migration planning, per-project policies, `.old` archival plans, and explicit rebuild/exclusion handling.
- Canonicalized AI entrypoint casing and removed deprecated lowercase entrypoints safely.
- Promoted Core Directives from a branch into a universal `DIRECTIVES.md` section with focused MCP tools.

## 0.0.1
- Initial scaffold for Harbormaster.
- Reads project name from `.project.json` and sets workspace window title.
- Headless mode prefixes the user’s normal window title template.
- Watches the config file for live updates.
