# Harbormaster

Project-aware window titles plus a lightweight project tracker for VS Code. Keep your workspace title in sync with your project config, and jump between projects from a single in-editor hub.

## What it does
- Reads a repo-local config (`.project.json` by default) and updates the workspace `window.title` to the project name; optional version display uses a derived SemVer `major.minor.<YY>[-prerelease]`.
- Status bar entry opens a quick menu for creating or opening the project config.
- Activity Bar view lists quick actions (create/open config, refresh title, menu).
- Project database: create a shared catalog (stored in extension global storage), add/reconnect the current workspace, and open projects directly from the list. Orphaned entries (moved/deleted folders) are detected and can be reconnected.
- Dev mode flag (`HARBORMASTER_DEV_TOOLS=1`) enables internal tools (e.g., path scramble) without shipping them to prod users.

## Quick start
1. Install or run the extension (Run Extension in VS Code or install the VSIX).
2. Command Palette → **Create project config** (search “Harbormaster” to find it). Enter a project name (required) and an optional version. This writes `.project.json` to the first workspace folder (you can keep it ignored in your repo).
3. (Optional) Command Palette → **Create projects database** to initialize the shared catalog.
4. Use the status bar item or Harbormaster Activity Bar view to open the menu, refresh the title, or open a project from the database.

## Project config (`.project.json`)
Config containing the project identity and version metadata (safe to ignore in git if you prefer):
```json
{
  "project_name": "Harbormaster",
  "project_version": "",
  "version_major": 1,
  "version_minor": 2,
  "version_prerelease": "alpha",
  "version_scheme_note": "version = <major>.<minor>.<YY>-<prerelease>; YY is last two digits of build year (computed automatically); prerelease is optional."
}
```
- `project_name` drives the workspace title. If missing, the title is prefixed with `[Headless] ` plus your normal template.
- If `project_version` is a valid SemVer, it is used. Otherwise Harbormaster derives `major.minor.<YY>[-prerelease]` from the numeric fields. Set `projectWindowTitle.showVersion` to true to display it.

## Project database
- Stored under the extension’s global storage (per-machine).
- Commands: create database, open project from database, reconnect current workspace, refresh window title, and dev-only path scramble.
- Orphan detection: entries whose paths no longer exist are marked and can be reconnected to the current workspace.

## UI surfaces
- **Status bar** (bottom left): Harbormaster item opens the quick menu.
- **Activity Bar**: Harbormaster view lists quick actions (create/open config, refresh title, database actions, menu). The view description shows the extension version and dev flag when enabled.

## Commands (Command Palette prefix: “Harbormaster”)
- Create project config (`projectWindowTitle.createConfig`)
- Open project config (`projectWindowTitle.openConfig`)
- Menu (`projectWindowTitle.showMenu`)
- Refresh window title (`projectWindowTitle.refresh`)
- Create projects database (`projectWindowTitle.createDatabase`)
- Open project from database (`projectWindowTitle.openProjectFromDatabase`)
- Reconnect current project to database (`projectWindowTitle.reconnectProject`)
- (Dev) Scramble project path (`projectWindowTitle.devBatman`)

## Settings
- `projectWindowTitle.configFile` (default `.project.json`): Relative path to the config file.
- `projectWindowTitle.projectNameKey` (default `project_name`)
- `projectWindowTitle.projectVersionKey` (default `project_version`)
- `projectWindowTitle.projectVersionMajorKey` (default `version_major`)
- `projectWindowTitle.projectVersionMinorKey` (default `version_minor`)
- `projectWindowTitle.projectVersionPrereleaseKey` (default `version_prerelease`)
- `projectWindowTitle.showVersion` (default `false`)
- `projectWindowTitle.versionFormat` (default `${projectName} (${projectVersion})`)
- `projectWindowTitle.headlessPrefix` (default `[Headless] `)
- `projectWindowTitle.namedFormat` (default `${projectName}`)

All settings are workspace-scoped; global/user settings are never modified.

## Versioning and builds
- Extension version derives from `.project.json` as `major.minor.<YY>[-prerelease]` (YY = last two digits of the build year).
- Scripts (`./run`):
  - `./run compile [dev|prod]` — derive version, single TypeScript build (no VSIX). Default dev.
  - `./run watch [dev|prod]` — derive version, watch mode. Default dev.
  - `./run build <dev|prod>` — derive version, package into `builds/<name>-<version>-<mode>.vsix` (prompts on conflicts). Prod bumps `version_minor`; dev skips bump.
  - `./run major_update` — bump `version_major`, reset `version_minor` to 0.
  - `./run help` — list commands.
- Dev mode sets `HARBORMASTER_DEV_TOOLS=1`; prod sets it to `0`.

## Development
- `npm install`
- `npm run compile` or `npm run watch`
- F5 (Run Extension) to launch an Extension Development Host.
