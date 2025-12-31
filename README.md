# Harbormaster

Harbormaster keeps your VS Code window title in sync with your project name (and optional version) so you always know which repo is in focus.

## What it does
- Reads a small config (`.project.json` by default) from your workspace.
- Sets the workspace-scoped `window.title` to the project name you provide.
- Optionally appends the project version.
- Watches the config and workspace settings so the title stays fresh.
- Provides status bar and Activity Bar shortcuts to create or open the config.

## Quick start
1. Command Palette → **Harbormaster: Create project config**.
2. Enter a project name (required) and version info (optional).
3. Harbormaster writes `.project.json` to your first workspace folder and updates the window title immediately.
4. Use **Harbormaster: Refresh window title** if you edit the config manually.

### Config format (default)
```json
{
  "project_name": "Human-Readable Project Name",
  "version_major": 0,
  "version_minor": 0,
  "version_prerelease": "alpha"
}
```

## Commands
- **Harbormaster: Create project config** — prompt for name/version and write `.project.json`.
- **Harbormaster: Open project config** — open the config file.
- **Harbormaster: Refresh window title** — re-read config and update the title.
- **Harbormaster: Menu** — quick access to the above actions.

## Settings (workspace-scoped)
- `projectWindowTitle.configFile` — relative path to the config file (default `.project.json`).
- `projectWindowTitle.projectNameKey` — JSON key for the project name (default `project_name`).
- `projectWindowTitle.showVersion` — append version when available (default `false`).
- `projectWindowTitle.versionFormat` — template for name + version (default `${projectName} (${projectVersion})`).
- `projectWindowTitle.headlessPrefix` — prefix when no name is found (default `[Headless] `).
- `projectWindowTitle.namedFormat` — template when a name is present (default `${projectName}`).
- Additional version key settings are available for derived versions: `projectVersionKey`, `projectVersionMajorKey`, `projectVersionMinorKey`, `projectVersionPrereleaseKey`.

## UI entry points
- Status bar item (bottom left): opens the Harbormaster menu.
- Activity Bar view: quick actions to create/open config and refresh the title.

## Notes
- All settings are workspace-scoped; Harbormaster never changes your user/global settings.
- The packaged extension version is derived from `.project.json` as `major.minor.<YY>[-prerelease]` to keep Marketplace-friendly SemVer.
- Optional projects database: on first run you can create a Harbormaster projects DB (stored locally). New projects are added automatically, and you can open saved projects from the Harbormaster menu/view or reconnect if a project was moved.
