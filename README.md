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
  "project_name": "Human-Readable Project Name"
}
```

## Settings

- `projectWindowTitle.configFile` (default `.project.json`): Relative path to the config file.
- `projectWindowTitle.projectNameKey` (default `project_name`): JSON key containing the project name.
- `projectWindowTitle.projectVersionKey` (default `project_version`): JSON key containing the project version.
- `projectWindowTitle.showVersion` (default `false`): When true, include the project version if present.
- `projectWindowTitle.versionFormat` (default `${projectName} (${projectVersion})`): Template used when `showVersion` is enabled.
- `projectWindowTitle.headlessPrefix` (default `[Headless] `): Prefix when no project name is present.
- `projectWindowTitle.namedFormat` (default `${projectName}`): Template used when a project name is found.

All settings are workspace-scoped; the extension never changes user/global settings.

## Development

- `npm run compile` — build once
- `npm run watch` — watch-mode build

Activate with the `Run Extension` launch config in VS Code or by pressing F5 from this folder.
