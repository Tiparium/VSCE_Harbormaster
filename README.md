# Harbormaster

Project-aware VS Code window titles. If a repo defines a `project_name`, the window title becomes exactly that name. Otherwise the title is prefixed with `[Headless] ` while keeping the user’s normal title template.

## How it works

1. On startup Harbormaster reads a JSON config file in the first workspace folder (default: `.project.json` with `project_name`).
2. When a project name exists, the extension writes a workspace-scoped `window.title` matching that name (saved in `.vscode/settings.json` or the workspace file).
3. If no project name is found, it prefixes `[Headless] ` to the user’s window title template. If the user has no custom title, it falls back to `${dirty}${activeEditorShort}${separator}${rootName}${separator}${appName}`.
4. The extension watches the config file and workspace changes to keep the title up to date.

## Default config file

Create `.project.json` in your repo root:

```json
{
  "project_name": "Human-Readable Project Name",
  "version_major": 0,
  "version_minor": 0,
  "version_prerelease": "alpha",
  "version_scheme_note": "version = <major>.<minor>.<YY>-<prerelease>; YY is last two digits of build year (computed automatically); prerelease is optional."
}
```

## Settings

- `projectWindowTitle.configFile` (default `.project.json`): Relative path to the config file.
- `projectWindowTitle.projectNameKey` (default `project_name`): JSON key containing the project name.
- `projectWindowTitle.projectVersionKey` (default `project_version`): JSON key containing the project version.
- `projectWindowTitle.projectVersionMajorKey` (default `version_major`): JSON key for the major component when deriving versions.
- `projectWindowTitle.projectVersionMinorKey` (default `version_minor`): JSON key for the minor component when deriving versions.
- `projectWindowTitle.projectVersionPrereleaseKey` (default `version_prerelease`): JSON key for the prerelease label when deriving versions.
- `projectWindowTitle.showVersion` (default `false`): When true, include the project version if present.
- `projectWindowTitle.versionFormat` (default `${projectName} (${projectVersion})`): Template used when `showVersion` is enabled.
- `projectWindowTitle.headlessPrefix` (default `[Headless] `): Prefix when no project name is present.
- `projectWindowTitle.namedFormat` (default `${projectName}`): Template used when a project name is found.

## Versioning and packaging

- The packaged extension version is derived as `major.minor.<YY>` with `YY` = last two digits of the current year, plus an optional prerelease (default `alpha`).
- Use `./run build` to sync the derived version into `package.json`, build, and emit `builds/<name>-<version>.vsix` (prompts if a file already exists).

### Commands
- `./run compile` — derive version, run a single TypeScript build (no VSIX).
- `./run watch` — derive version, run TypeScript watch mode.
- `./run build` — derive version, build, and package into `./builds/*.vsix` (prompts on conflicts).
- `./run help` — list available commands.

## Quick setup

Use the Command Palette → “Harbormaster: Create project config” to generate `.project.json`. You’ll be prompted for a project name (required) and a version (optional; saved even if left empty). The file is written to the first workspace folder.

## Status bar menu

A Harbormaster status bar item (bottom left) opens a quick menu with actions like creating or opening `.project.json`.

## Activity Bar

Harbormaster adds an Activity Bar icon with an “Harbormaster” view. It lists quick actions (create/open config, refresh title, menu) for easy access.

All settings are workspace-scoped; the extension never changes user/global settings.

## Development

- `npm run compile` — build once
- `npm run watch` — watch-mode build

Activate with the `Run Extension` launch config in VS Code or by pressing F5 from this folder.
