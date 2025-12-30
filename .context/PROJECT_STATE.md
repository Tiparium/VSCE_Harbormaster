# PROJECT STATE

## Current goals
- Build the Harbormaster VS Code extension that sets window titles from a repo-local config.

## Constraints / assumptions
- Workspace-write sandbox; network restricted (dependencies not installed yet).
- Use the first workspace folder as the identity and write workspace-scoped settings only.
- Assume VS Code 1.85+/Node 18 runtime; TypeScript output targets ES2020.

## Plan
- Scaffold extension (package/tsconfig/gitignore/docs).
- Implement activation logic: read config file, update workspace window.title, watch config/settings/workspace changes; add optional version display.
- Document usage and note remaining setup/tests.

## Status
- Scaffold created; core logic implemented with config watching, optional version display, and workspace title updates; docs added. npm install/compile not run yet.

## Open questions
- Should config file renames be handled dynamically beyond settings changes?
- Should pre-existing workspace window.title values be preserved instead of overwritten?

## Active assumptions
- Targeting VS Code 1.85+/Node 18 for API compatibility and ES2020 output.
- User will install npm dependencies before running or packaging.
